/*
===============================================================================
MAKTABHELPER — APPS SCRIPT MIGRATION STATUS
Last verified: 20 July 2026
Production milestone: V97.1.3
===============================================================================

The application is being migrated gradually from Apps Script to direct
Cloudflare Worker-to-Google Sheets API access.

MIGRATED TO DIRECT GOOGLE SHEETS API:
- Resource/Library reads
  Legacy Apps Script action retained: getStudentResources
- Timetable reads
  Legacy Apps Script action retained: getTimetable
- Weekly Planner reads and writes
  Weekly Planner records use the direct Google Sheets API.
  The Google Drive preview submission remains a narrow Apps Script action because it uses DriveApp.

STILL ACTIVE ON APPS SCRIPT:
- Student and Admin authentication
- PIN setup and reset
- Attendance reads and writes
- Progress reads and writes
- Timetable Zoom-link writes
- Student management
- Curriculum and task management
- Student-task assignment

IMPORTANT:
- Migrated functions marked LEGACY ROLLBACK must not be modified, reused or
  removed without first checking the active Worker routing configuration.
- Reads and writes are migrated separately. A migrated read does not mean its
  related write operation has also migrated.
- getStudentResources and getTimetable remain here only as rollback paths.
- updateTimetableZoomLink remains an active Apps Script operation.
- Remove a legacy function and its doPost action together only after the
  rollback path has been explicitly retired.
- Record every future migration in:
  apps-script/MIGRATION-CHANGELOG.md

Backend routing is controlled by backend/wrangler.jsonc.
Encrypted credentials remain in Cloudflare Worker secrets.
===============================================================================
*/

/* M4L v96.0 - Targeted StudentTasks progress writes
   Baseline: deployed v95.3.1. Progress status batches are validated as one unit,
   serialized with a script lock, and write only the requested status/date cells.
   Existing action names and single/batch request formats remain unchanged.
*/

const SHEET_NAME = "StudentRecords";
const BASE_STUDENT_LOGIN_URL = "https://developmentmaktab4life.pages.dev/student/";
const DEFAULT_STUDENT_GROUP = 1;
const DEFAULT_WHATSAPP6 = "999999";
const WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_ID = "1Uz-unVcnO729RE88_pr9Y1cNp8lNgRcX";
const WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1Uz-unVcnO729RE88_pr9Y1cNp8lNgRcX?usp=share_link";
const WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_LABEL = "Weekly Planner";



function normalizeWhatsapp6_(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (!digits) {
    return DEFAULT_WHATSAPP6;
  }

  return digits.slice(-6).padStart(6, "0");
}

function registerStudent(data) {
  data = data || {};

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { success: false, error: "StudentRecords sheet not found" };
  }

  const username = String(data.username || "").trim();
  const whatsapp6 = normalizeWhatsapp6_(data.whatsapp6);
  const classgroup = String(data.classgroup || DEFAULT_STUDENT_GROUP).trim();
  const registeredby = String(
    data.registeredby ||
    data.registeredBy ||
    data.registeredbyAdminId ||
    data.adminid ||
    data.adminId ||
    data.assignedBy ||
    "ADMIN"
  ).trim();

  if (!username) {
    return { success: false, error: "Missing student name" };
  }

  if (!classgroup) {
    return { success: false, error: "Missing class group" };
  }

  data.username = username;
  data.whatsapp6 = whatsapp6;
  data.classgroup = classgroup;

  if (!data.confirmDuplicate) {
    const duplicateCheck = checkStudentDuplicate(data);

    if (duplicateCheck.duplicate) {
      return {
        success: false,
        duplicate: true,
        matches: duplicateCheck.matches,
        suggestedUsername: duplicateCheck.suggestedUsername,
        error: "Duplicate student found. Confirmation required."
      };
    }
  } else {
    data.username = getNextAvailableUsername(data.username);
  }

  const studentId = generateStudentId();
  const uniqueId = generateUniqueId();
  const now = new Date().toISOString();

  const row = [
    studentId,              // studentid
    data.username,          // username
    whatsapp6,              // whatsapp6
    uniqueId,               // uniqueid
    false,                  // pinsetup
    "",                     // pinhash
    classgroup,             // classgroup
    now,                    // createdate
    "",                     // lastlogin
    0,                      // failed attempts
    true,                   // active
    registeredby            // registeredby
  ];

  sheet.appendRow(row);

  const appendedRow = sheet.getLastRow();
  const registeredByCol = findStudentRecordColumn_(sheet, ["registeredby", "RegisteredBy", "Registered By"]);
  if (registeredByCol !== -1) {
    sheet.getRange(appendedRow, registeredByCol + 1).setValue(registeredby);
  }

  const assignmentResult = assignStudentTasksForSelection_({
    studentid: studentId,
    assignedBy: registeredby || "SYSTEM",
    assignmentMode: data.assignmentMode || "all",
    selectedModules: Array.isArray(data.selectedModules) ? data.selectedModules : []
  });

  return {
    success: true,
    studentid: studentId,
    username: data.username,
    whatsapp6: whatsapp6,
    classgroup: classgroup,
    active: true,
    uniqueid: uniqueId,
    registeredby: registeredby,
    loginUrl: BASE_STUDENT_LOGIN_URL + uniqueId,
    assignment: assignmentResult
  };
}

function testCreateTaskResource() {
  const result = createTaskResource({
    taskid: "TASK1",
    taskResourceName: "An-Naas audio",
    resourceType: "AUDIO",
    resourceLink: "https://rebootyourmaktab.github.io/MaktabApp/Audiosurahs/Naas.mp3"
  });

  Logger.log(JSON.stringify(result, null, 2));
}
function generateStudentId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SystemConfig");

  const current = Number(sheet.getRange("B1").getValue());

  sheet.getRange("B1").setValue(current + 1);

  return "MAKTAB" + current;
}

function generateUniqueId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";

  for (let i = 0; i < 10; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return id;
}

function getStudentByUniqueId(uniqueId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim() === uniqueId) {
      return {
        row: i + 1,
        studentid: data[i][0],
        username: data[i][1],
        whatsapp6: data[i][2],
        uniqueid: data[i][3],
        pinsetup: data[i][4],
        classgroup: data[i][6],
        active: data[i][10]
      };
    }
  }

  return null;
}

function setStudentPin(data) {
  const student = getStudentByUniqueId(data.uniqueid);

  if (!student) {
    return { success: false, error: "Student not found" };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  sheet.getRange(student.row, 5).setValue(true);        // pinsetup
  sheet.getRange(student.row, 6).setValue(data.pinhash); // pinhash
  sheet.getRange(student.row, 10).setValue(0);          // failed attempts

  return {
    success: true,
    studentid: student.studentid,
    username: student.username
  };
}

function getStudentForLogin(uniqueId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]).trim() === uniqueId) {
      return {
        row: i + 1,
        studentid: data[i][0],
        username: data[i][1],
        uniqueid: data[i][3],
        pinsetup: data[i][4],
        pinhash: data[i][5],
        classgroup: data[i][6],
        lastlogin: data[i][8],
        failedattempts: data[i][9],
        active: data[i][10]
      };
    }
  }

  return null;
}


function resetStudentPin(uniqueId) {
  const student = getStudentByUniqueId(uniqueId);

  if (!student) {
    return { success: false, error: "Student not found" };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  sheet.getRange(student.row, 5).setValue(false); // pinsetup
  sheet.getRange(student.row, 6).setValue("");    // pinhash
  sheet.getRange(student.row, 10).setValue(0);    // failed attempts

  return {
    success: true,
    message: "PIN reset successfully",
    studentid: student.studentid,
    username: student.username
  };
}

function registerAdmin(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("AdminRecords");

  const adminId = generateAdminId();
  const uniqueId = generateUniqueId();
  const now = new Date().toISOString();

  const row = [
    adminId,                  // adminid
    data.username,            // username
    uniqueId,                 // uniqueid
    false,                    // pinsetup
    "",                       // pinhash
    data.role,                // role
    data.assignedgroup,       // assignedgroup
    true,                     // active
    now,                      // createdate
    ""                        // lastlogin
  ];

  sheet.appendRow(row);

  return {
    success: true,
    adminid: adminId,
    username: data.username,
    uniqueid: uniqueId,
    role: data.role
  };
}

function generateAdminId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SystemConfig");

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === "NextAdminNumber") {

      const current = Number(data[i][1]);

      sheet.getRange(i + 1, 2).setValue(current + 1);

      return "ADMIN" + current;
    }
  }

  throw new Error("NextAdminNumber not found");
}

function getAdminByUsername(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("AdminRecords");

  const data = sheet.getDataRange().getValues();
  const searchUsername = String(username).trim().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const rowUsername = String(data[i][1]).trim().toLowerCase();

    if (rowUsername === searchUsername) {
      return {
        row: i + 1,
        adminid: data[i][0],
        username: data[i][1],
        uniqueid: data[i][2],
        pinsetup: data[i][3],
        pinhash: data[i][4],
        role: data[i][5],
        assignedgroup: data[i][6],
        active: data[i][7],
        createdate: data[i][8],
        lastlogin: data[i][9]
      };
    }
  }

  return null;
}



function setAdminPin(data) {
  const admin = getAdminByUniqueId(data.uniqueid);

  if (!admin) {
    return { success: false, error: "Admin not found" };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("AdminRecords");

  sheet.getRange(admin.row, 4).setValue(true);        // pinsetup
  sheet.getRange(admin.row, 5).setValue(data.pinhash); // pinhash

  return {
    success: true,
    adminid: admin.adminid,
    username: admin.username,
    role: admin.role,
    assignedgroup: admin.assignedgroup
  };
}


function getAdminByUniqueId(uniqueId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("AdminRecords");

  const data = sheet.getDataRange().getValues();
  const searchUniqueId = String(uniqueId).trim();

  for (let i = 1; i < data.length; i++) {
    const rowUniqueId = String(data[i][2]).trim();

    if (rowUniqueId === searchUniqueId) {
      return {
        row: i + 1,
        adminid: data[i][0],
        username: data[i][1],
        uniqueid: data[i][2],
        pinsetup: data[i][3],
        pinhash: data[i][4],
        role: data[i][5],
        assignedgroup: data[i][6],
        active: data[i][7],
        createdate: data[i][8],
        lastlogin: data[i][9]
      };
    }
  }

  return null;
}

function normalizeUsername(username) {
  return String(username)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function checkStudentDuplicate(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  const targetName = normalizeUsername(data.username);
  const targetWhatsapp6 = String(data.whatsapp6).trim();

  const matches = [];

  for (let i = 1; i < rows.length; i++) {
    const rowName = normalizeUsername(rows[i][1]);
    const rowWhatsapp6 = String(rows[i][2]).trim();

    if (rowName === targetName && rowWhatsapp6 === targetWhatsapp6) {
      matches.push({
        studentid: rows[i][0],
        username: rows[i][1],
        whatsapp6: rows[i][2],
        uniqueid: rows[i][3],
        classgroup: rows[i][6],
        createdate: rows[i][7],
        lastlogin: rows[i][8],
        active: rows[i][10]
      });
    }
  }

  return {
    success: true,
    duplicate: matches.length > 0,
    matches,
    suggestedUsername: matches.length > 0
      ? getNextAvailableUsername(data.username)
      : data.username
  };
}

function getNextAvailableUsername(baseUsername) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();

  const existingNames = new Set();

  for (let i = 1; i < rows.length; i++) {
    existingNames.add(normalizeUsername(rows[i][1]));
  }

  let counter = 1;
  let candidate = String(baseUsername).trim() + counter;

  while (existingNames.has(normalizeUsername(candidate))) {
    counter++;
    candidate = String(baseUsername).trim() + counter;
  }

  return candidate;
}

function updateStudent(data) {
  const student = getStudentByUniqueId(data.uniqueid);

  if (!student) {
    return {
      success: false,
      error: "Student not found"
    };
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SHEET_NAME);

  if (data.username !== undefined) {
    sheet.getRange(student.row, 2).setValue(data.username); // username
  }

  if (data.whatsapp6 !== undefined) {
    sheet.getRange(student.row, 3).setValue(normalizeWhatsapp6_(data.whatsapp6)); // whatsapp6
  }

  if (data.classgroup !== undefined) {
    sheet.getRange(student.row, 7).setValue(data.classgroup); // classgroup
  }

  if (data.active !== undefined) {
    sheet.getRange(student.row, 11).setValue(data.active); // active
  }

  return {
    success: true,
    message: "Student updated successfully",
    studentid: student.studentid,
    uniqueid: student.uniqueid,
    username: data.username !== undefined ? data.username : student.username,
    whatsapp6: data.whatsapp6 !== undefined ? normalizeWhatsapp6_(data.whatsapp6) : student.whatsapp6,
    classgroup: data.classgroup !== undefined ? data.classgroup : student.classgroup,
    active: data.active !== undefined ? data.active : student.active
  };
}

 

/* =========================
   STUDENT MANAGEMENT MODULE
========================= */

function searchStudents(data) {
  data = data || {};

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { success: false, error: "StudentRecords sheet not found" };
  }

  const range = sheet.getDataRange();
  const rows = range.getValues();
  const displayRows = range.getDisplayValues();
  const headerMap = buildStudentRecordHeaderMap_(displayRows[0] || rows[0] || []);

  const rawQuery = String(data.query || "").trim();
  const listAll = data.listAll === true;
  const normalizedQuery = normalizeStudentSearchText_(rawQuery);
  const queryWords = normalizedQuery ? normalizedQuery.split(" ").filter(Boolean) : [];
  const queryDigits = rawQuery.replace(/\D/g, "");
  const whatsapp6 = String(data.whatsapp6 || "").replace(/\D/g, "").slice(-6);

  if (!normalizedQuery && !queryDigits && !whatsapp6 && !listAll) {
    return { success: true, students: [], count: 0 };
  }

  const matches = [];

  for (let i = 1; i < rows.length; i++) {
    const valueRow = rows[i];
    const displayRow = displayRows[i] || rows[i];

    const studentId = String(getStudentRecordCell_(displayRow, headerMap, ["studentid", "StudentID", "StudentId"], getStudentRecordCell_(valueRow, headerMap, ["studentid", "StudentID", "StudentId"], ""))).trim();
    const username = String(getStudentRecordCell_(displayRow, headerMap, ["username", "Username", "Name", "StudentName"], getStudentRecordCell_(valueRow, headerMap, ["username", "Username", "Name", "StudentName"], ""))).trim();
    const rowWhatsappRaw = String(getStudentRecordCell_(displayRow, headerMap, ["whatsapp6", "WhatsAppLast6", "WhatsApp6", "WhatsApp Last 6"], getStudentRecordCell_(valueRow, headerMap, ["whatsapp6", "WhatsAppLast6", "WhatsApp6", "WhatsApp Last 6"], ""))).trim();
    const rowWhatsappDigits = rowWhatsappRaw.replace(/\D/g, "");
    const rowWhatsapp6 = rowWhatsappDigits.length > 6 ? rowWhatsappDigits.slice(-6) : rowWhatsappDigits;
    const uniqueId = String(getStudentRecordCell_(displayRow, headerMap, ["uniqueid", "UniqueID", "UniqueId"], getStudentRecordCell_(valueRow, headerMap, ["uniqueid", "UniqueID", "UniqueId"], ""))).trim();
    const classgroup = String(getStudentRecordCell_(displayRow, headerMap, ["classgroup", "ClassGroup", "Group", "group"], getStudentRecordCell_(valueRow, headerMap, ["classgroup", "ClassGroup", "Group", "group"], ""))).trim();
    const createdate = getStudentRecordCell_(valueRow, headerMap, ["createdate", "CreatedDate", "Created Date"], "");
    const lastlogin = getStudentRecordCell_(valueRow, headerMap, ["lastlogin", "LastLogin", "Last Login"], "");
    const active = getStudentRecordCell_(valueRow, headerMap, ["active", "Active"], true);
    const registeredby = String(getStudentRecordCell_(displayRow, headerMap, ["registeredby", "RegisteredBy", "Registered By"], getStudentRecordCell_(valueRow, headerMap, ["registeredby", "RegisteredBy", "Registered By"], ""))).trim();

    if (!studentId || studentId === "SYSTEM1") {
      continue;
    }

    const normalizedName = normalizeStudentSearchText_(username);
    const nameMatches = normalizedQuery && (
      normalizedName.indexOf(normalizedQuery) !== -1 ||
      queryWords.every(function(word) { return normalizedName.indexOf(word) !== -1; })
    );

    const whatsappMatches = Boolean(
      (whatsapp6 && rowWhatsapp6 && rowWhatsapp6 === whatsapp6) ||
      (queryDigits && rowWhatsapp6 && (rowWhatsapp6 === queryDigits || rowWhatsapp6.endsWith(queryDigits) || rowWhatsapp6.indexOf(queryDigits) !== -1))
    );

    if (listAll || nameMatches || whatsappMatches) {
      matches.push({
        studentid: studentId,
        username: username,
        whatsapp6: rowWhatsapp6,
        uniqueid: uniqueId,
        classgroup: classgroup,
        createdate: createdate,
        lastlogin: lastlogin,
        active: active === true || String(active).toLowerCase() === "true",
        registeredby: registeredby,
        loginUrl: BASE_STUDENT_LOGIN_URL + uniqueId
      });
    }
  }

  matches.sort(function(a, b) {
    const groupCompare = String(a.classgroup || "").localeCompare(String(b.classgroup || ""), undefined, { numeric: true, sensitivity: "base" });
    if (groupCompare !== 0) return groupCompare;
    return String(a.username || "").localeCompare(String(b.username || ""), undefined, { numeric: true, sensitivity: "base" });
  });

  const maxResults = listAll ? 500 : 50;

  return {
    success: true,
    count: matches.length,
    students: matches.slice(0, maxResults)
  };
}

function buildStudentRecordHeaderMap_(headers) {
  const map = {};

  headers.forEach(function(header, index) {
    const key = normalizeStudentHeader_(header);
    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function normalizeStudentHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getStudentRecordCell_(row, headerMap, names, fallback) {
  for (let i = 0; i < names.length; i++) {
    const key = normalizeStudentHeader_(names[i]);
    if (headerMap[key] !== undefined) {
      return row[headerMap[key]];
    }
  }

  return fallback;
}

function findStudentRecordColumn_(sheet, names) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] || [];
  const headerMap = buildStudentRecordHeaderMap_(headers);

  for (let i = 0; i < names.length; i++) {
    const key = normalizeStudentHeader_(names[i]);
    if (headerMap[key] !== undefined) {
      return headerMap[key];
    }
  }

  return -1;
}

function normalizeStudentSearchText_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getStudentAssignmentOptions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const subjectSheet = ss.getSheetByName("SubjectList");
  const moduleSheet = ss.getSheetByName("ModuleList");
  const taskSheet = ss.getSheetByName("TaskList");

  if (!subjectSheet) return { success: false, error: "SubjectList sheet not found" };
  if (!taskSheet) return { success: false, error: "TaskList sheet not found" };

  const subjectRows = subjectSheet.getDataRange().getValues();
  const subjectHeaderMap = buildHeaderMapForTasks_(subjectRows[0] || []);
  const subjectMap = {};
  const knownSubjectIds = {};

  for (let i = 1; i < subjectRows.length; i++) {
    const subjectid = String(getTaskCell_(subjectRows[i], subjectHeaderMap, ["SubjectID", "SubjectId", "subjectid"])).trim();
    const subjectname = String(getTaskCell_(subjectRows[i], subjectHeaderMap, ["SubjectName", "Subject", "subjectname"], subjectid)).trim();
    const active = getTaskCell_(subjectRows[i], subjectHeaderMap, ["Active", "Status", "active"], true);

    if (!subjectid) continue;

    knownSubjectIds[subjectid] = true;

    if (!isTaskActiveValue_(active)) continue;

    subjectMap[subjectid] = {
      subjectid: subjectid,
      subjectname: subjectname || subjectid,
      modules: [],
      _moduleMap: {}
    };
  }

  if (moduleSheet) {
    const moduleRows = moduleSheet.getDataRange().getValues();
    const moduleHeaderMap = buildHeaderMapForTasks_(moduleRows[0] || []);

    for (let i = 1; i < moduleRows.length; i++) {
      const moduleid = String(getTaskCell_(moduleRows[i], moduleHeaderMap, ["ModuleID", "ModuleId", "moduleid"])).trim();
      const modulename = String(getTaskCell_(moduleRows[i], moduleHeaderMap, ["ModuleName", "Module", "modulename"], moduleid)).trim();
      const subjectid = String(getTaskCell_(moduleRows[i], moduleHeaderMap, ["SubjectID", "SubjectId", "subjectid"])).trim();
      const subjectname = String(getTaskCell_(moduleRows[i], moduleHeaderMap, ["SubjectName", "Subject", "subjectname"], "")).trim();
      const sortOrderRaw = getTaskCell_(moduleRows[i], moduleHeaderMap, ["Sort Order", "SortOrder", "ModuleSortOrder", "sortorder"], "");
      const active = getTaskCell_(moduleRows[i], moduleHeaderMap, ["Active", "Status", "active"], true);

      if (!moduleid || !subjectid) continue;
      if (!isTaskActiveValue_(active)) continue;
      if (knownSubjectIds[subjectid] && !subjectMap[subjectid]) continue;

      if (!subjectMap[subjectid]) {
        subjectMap[subjectid] = {
          subjectid: subjectid,
          subjectname: subjectname || subjectid,
          modules: [],
          _moduleMap: {}
        };
      }

      if (!subjectMap[subjectid]._moduleMap[moduleid]) {
        const sortOrder = Number(sortOrderRaw);
        subjectMap[subjectid]._moduleMap[moduleid] = {
          moduleid: moduleid,
          modulename: modulename || moduleid,
          sortorder: Number.isFinite(sortOrder) ? sortOrder : 999999,
          taskCount: 0
        };
        subjectMap[subjectid].modules.push(subjectMap[subjectid]._moduleMap[moduleid]);
      }
    }
  }

  const taskRows = taskSheet.getDataRange().getValues();
  const taskHeaderMap = buildHeaderMapForTasks_(taskRows[0] || []);

  for (let i = 1; i < taskRows.length; i++) {
    const taskid = String(getTaskCell_(taskRows[i], taskHeaderMap, ["TaskID", "TaskId", "taskid"])).trim();
    const subjectid = String(getTaskCell_(taskRows[i], taskHeaderMap, ["SubjectID", "SubjectId", "subjectid"])).trim();
    const subjectname = String(getTaskCell_(taskRows[i], taskHeaderMap, ["SubjectName", "Subject", "subjectname"], subjectid)).trim();
    const moduleid = String(getTaskCell_(taskRows[i], taskHeaderMap, ["ModuleID", "ModuleId", "moduleid", "ModuletID"])).trim();
    const modulename = String(getTaskCell_(taskRows[i], taskHeaderMap, ["ModuleName", "Module", "modulename"], moduleid)).trim();
    const active = getTaskCell_(taskRows[i], taskHeaderMap, ["Active", "Status", "active"], true);

    if (!taskid || !subjectid) continue;
    if (!isTaskActiveValue_(active)) continue;
    if (knownSubjectIds[subjectid] && !subjectMap[subjectid]) continue;

    if (!subjectMap[subjectid]) {
      subjectMap[subjectid] = {
        subjectid: subjectid,
        subjectname: subjectname || subjectid,
        modules: [],
        _moduleMap: {}
      };
    }

    const safeModuleId = moduleid || "NO_MODULE";
    const safeModuleName = modulename || "General";

    if (!subjectMap[subjectid]._moduleMap[safeModuleId]) {
      subjectMap[subjectid]._moduleMap[safeModuleId] = {
        moduleid: safeModuleId,
        modulename: safeModuleName,
        sortorder: 999999,
        taskCount: 0
      };
      subjectMap[subjectid].modules.push(subjectMap[subjectid]._moduleMap[safeModuleId]);
    }

    subjectMap[subjectid]._moduleMap[safeModuleId].taskCount++;
  }

  const subjects = Object.keys(subjectMap).map(function(subjectid) {
    const subject = subjectMap[subjectid];

    subject.modules = subject.modules
      .filter(function(module) { return module.taskCount > 0; })
      .sort(function(a, b) {
        if (a.sortorder !== b.sortorder) return a.sortorder - b.sortorder;
        return String(a.moduleid || "").localeCompare(String(b.moduleid || ""), undefined, { numeric: true, sensitivity: "base" });
      });

    delete subject._moduleMap;
    return subject;
  }).filter(function(subject) {
    return subject.modules.length > 0;
  }).sort(function(a, b) {
    return String(a.subjectid || "").localeCompare(String(b.subjectid || ""), undefined, { numeric: true, sensitivity: "base" });
  });

  return {
    success: true,
    subjects: subjects
  };
}

function assignStudentTasksForSelection_(data) {
  data = data || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentTaskSheet = ss.getSheetByName("StudentTasks");
  const taskSheet = ss.getSheetByName("TaskList");

  if (!studentTaskSheet) return { success: false, error: "StudentTasks sheet not found", assignedCount: 0 };
  if (!taskSheet) return { success: false, error: "TaskList sheet not found", assignedCount: 0 };

  const studentid = String(data.studentid || "").trim();
  const assignedBy = String(data.assignedBy || "SYSTEM").trim();
  const assignmentMode = String(data.assignmentMode || "all").trim().toLowerCase();
  const selectedModules = Array.isArray(data.selectedModules) ? data.selectedModules : [];

  if (!studentid) {
    return { success: false, error: "Missing studentid", assignedCount: 0 };
  }

  const selectedModuleKeys = new Set();

  selectedModules.forEach(function(item) {
    const subjectid = String(item.subjectid || item.SubjectID || item.subjectId || "").trim();
    const moduleid = String(item.moduleid || item.ModuleID || item.moduleId || "").trim() || "NO_MODULE";

    if (subjectid && moduleid) {
      selectedModuleKeys.add(subjectid + "|" + moduleid);
    }
  });

  const taskRows = taskSheet.getDataRange().getValues();
  const taskHeaderMap = buildHeaderMapForTasks_(taskRows[0] || []);
  const tasksToAssign = [];

  for (let i = 1; i < taskRows.length; i++) {
    const taskid = String(getTaskCell_(taskRows[i], taskHeaderMap, ["TaskID", "TaskId", "taskid"])).trim();
    const subjectid = String(getTaskCell_(taskRows[i], taskHeaderMap, ["SubjectID", "SubjectId", "subjectid"])).trim();
    const subjectname = String(getTaskCell_(taskRows[i], taskHeaderMap, ["SubjectName", "Subject", "subjectname"], "")).trim();
    const moduleid = String(getTaskCell_(taskRows[i], taskHeaderMap, ["ModuleID", "ModuleId", "moduleid", "ModuletID"], "")).trim();
    const modulename = String(getTaskCell_(taskRows[i], taskHeaderMap, ["ModuleName", "Module", "modulename"], "")).trim();
    const taskname = String(getTaskCell_(taskRows[i], taskHeaderMap, ["TaskName", "Task", "taskname"], taskid)).trim();
    const active = getTaskCell_(taskRows[i], taskHeaderMap, ["Active", "Status", "active"], true);

    if (!taskid || !subjectid) continue;
    if (!isTaskActiveValue_(active)) continue;

    if (assignmentMode === "selected") {
      const key = subjectid + "|" + (moduleid || "NO_MODULE");
      if (!selectedModuleKeys.has(key)) {
        continue;
      }
    }

    tasksToAssign.push({
      taskid: taskid,
      subjectid: subjectid,
      subjectname: subjectname,
      moduleid: moduleid,
      modulename: modulename,
      taskname: taskname
    });
  }

  if (tasksToAssign.length === 0) {
    return {
      success: true,
      assignedCount: 0,
      skippedDuplicate: 0,
      message: "No matching active tasks selected."
    };
  }

  const studentTaskRows = studentTaskSheet.getDataRange().getValues();
  const studentTaskHeaders = studentTaskRows[0] || [];
  const studentTaskHeaderMap = buildHeaderMapForTasks_(studentTaskHeaders);

  const studentIdCol = findTaskColumn_(studentTaskHeaderMap, ["StudentID", "StudentId", "studentid"]);
  const taskIdCol = findTaskColumn_(studentTaskHeaderMap, ["TaskID", "TaskId", "taskid"]);

  if (studentIdCol === -1 || taskIdCol === -1) {
    return { success: false, error: "StudentTasks sheet is missing StudentID or TaskID", assignedCount: 0 };
  }

  const existingPairs = new Set();

  for (let i = 1; i < studentTaskRows.length; i++) {
    const existingStudentId = String(studentTaskRows[i][studentIdCol] || "").trim();
    const existingTaskId = String(studentTaskRows[i][taskIdCol] || "").trim();

    if (existingStudentId && existingTaskId) {
      existingPairs.add(existingStudentId + "|" + existingTaskId);
    }
  }

  const rowsToAdd = [];
  let skippedDuplicate = 0;

  const now = new Date().toISOString();

  tasksToAssign.forEach(function(task) {
    const pairKey = studentid + "|" + task.taskid;

    if (existingPairs.has(pairKey)) {
      skippedDuplicate++;
      return;
    }

    existingPairs.add(pairKey);

    const newRow = new Array(studentTaskHeaders.length).fill("");

    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"], "");
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["StudentID", "StudentId", "studentid"], studentid);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["TaskID", "TaskId", "taskid"], task.taskid);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["SubjectID", "SubjectId", "subjectid"], task.subjectid);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["SubjectName", "Subject", "subjectname"], task.subjectname);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["ModuleID", "ModuleId", "moduleid", "ModuletID"], task.moduleid);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["ModuleName", "Module", "modulename"], task.modulename);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["TaskName", "Task", "taskname"], task.taskname);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["CompleteStatus", "Complete", "Completed", "completestatus"], "");
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["CompleteDate", "CompletedDate", "completedate"], "");
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["VerifyStatus", "Verified", "verifystatus"], "");
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["VerifyDate", "VerifiedDate", "verifydate"], "");
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["AssignedBy", "assignedby"], assignedBy);
    setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["AssignedDate", "assigneddate"], now);

    rowsToAdd.push(newRow);
  });

  if (rowsToAdd.length === 0) {
    return {
      success: true,
      assignedCount: 0,
      skippedDuplicate: skippedDuplicate,
      message: "All selected tasks were already assigned."
    };
  }

  const newIds = reserveStudentTaskIds_(rowsToAdd.length);
  const idCol = findTaskColumn_(studentTaskHeaderMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"]);

  if (idCol !== -1) {
    rowsToAdd.forEach(function(row, index) {
      row[idCol] = newIds[index];
    });
  }

  studentTaskSheet
    .getRange(studentTaskSheet.getLastRow() + 1, 1, rowsToAdd.length, studentTaskHeaders.length)
    .setValues(rowsToAdd);

  return {
    success: true,
    assignedCount: rowsToAdd.length,
    skippedDuplicate: skippedDuplicate,
    message: "Student tasks assigned successfully."
  };
}

/* =========================
   ATTENDANCE MODULE
   Date system: YYYY-MM-DD strings.
   Timezone basis: South African Standard Time.
========================= */

const ATTENDANCE_TIMEZONE = "Africa/Johannesburg";

function submitAbsentStudents(data) {
  data = data || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Attendance");

  if (!sheet) {
    return { success: false, error: "Attendance sheet not found" };
  }

  ensureAttendanceHeaders_(sheet);

  const date = normalizeAttendanceDate_(data.date);
  const absentStudents = Array.isArray(data.absentStudents)
    ? data.absentStudents
    : [];

  if (!date) {
    return { success: false, error: "Missing date" };
  }

  const range = sheet.getDataRange();
  const rows = range.getValues();
  const displayRows = range.getDisplayValues();
  const headerMap = buildAttendanceHeaderMap_(rows[0] || []);

  const dateCol = findAttendanceColumn_(headerMap, ["AttendanceDate", "Date"]);
  const studentIdCol = findAttendanceColumn_(headerMap, ["StudentID", "StudentId", "studentid"]);
  const usernameCol = findAttendanceColumn_(headerMap, ["Username", "StudentName", "Name"]);
  const statusCol = findAttendanceColumn_(headerMap, ["Status", "AttendanceStatus"]);

  if (dateCol === -1 || studentIdCol === -1 || usernameCol === -1 || statusCol === -1) {
    return { success: false, error: "Attendance sheet is missing required headers" };
  }

  const existingStudentDatePairs = new Set();

  for (let i = 1; i < rows.length; i++) {
    const existingDate = normalizeAttendanceDateFromSheet_(rows[i][dateCol], displayRows[i][dateCol]);
    const existingStudentId = String(rows[i][studentIdCol] || "").trim();

    if (!existingDate || !existingStudentId || existingStudentId === "SYSTEM1") {
      continue;
    }

    existingStudentDatePairs.add(existingDate + "|" + existingStudentId);
  }

  const now = Utilities.formatDate(new Date(), ATTENDANCE_TIMEZONE, "yyyy-MM-dd HH:mm:ss");

  // The Worker should send adminid, for example ADMIN1.
  // The fallbacks keep the code compatible with older Worker versions,
  // but if none is sent it will write ADMIN.
  const adminId = String(
    data.adminid ||
    data.adminId ||
    data.AdminID ||
    data.markedBy ||
    data.markedby ||
    "ADMIN"
  ).trim();

  const outputRows = [];
  const submittedPairs = new Set();

  absentStudents.forEach(student => {
    const studentId = String(student.studentid || student.StudentID || "").trim();
    if (!studentId) return;

    const pairKey = date + "|" + studentId;

    // Keep duplicate student absence rows out of the sheet where possible.
    // The report calculation also deduplicates date + studentid, so existing
    // duplicates will still count as one absence only.
    if (existingStudentDatePairs.has(pairKey) || submittedPairs.has(pairKey)) {
      return;
    }

    submittedPairs.add(pairKey);

    const row = new Array(rows[0].length).fill("");
    setAttendanceCell_(row, headerMap, ["AttendanceDate", "Date"], date);
    setAttendanceCell_(row, headerMap, ["StudentID", "StudentId", "studentid"], studentId);
    setAttendanceCell_(row, headerMap, ["Username", "StudentName", "Name"], student.username || student.Username || "");
    setAttendanceCell_(row, headerMap, ["ClassGroup", "classgroup", "Group"], student.classgroup || student.ClassGroup || "");
    setAttendanceCell_(row, headerMap, ["Status", "AttendanceStatus"], "ABSENT");
    setAttendanceCell_(row, headerMap, ["Notes"], "");
    setAttendanceCell_(row, headerMap, ["AdminID", "AdminId", "adminid", "MarkedBy"], adminId);
    setAttendanceCell_(row, headerMap, ["DateStamp", "Datestamp", "Timestamp", "MarkedDate"], now);
    outputRows.push(row);
  });

  const realAbsentCount = outputRows.length;

  // Every register submission gets a SYSTEM1/daycounter row.
  // This records that a teacher/admin marked the register.
  // getAttendanceReport uses Sets, so repeated SYSTEM1 rows for the same date
  // still count as one maktab day only.
  const systemRow = new Array(rows[0].length).fill("");
  setAttendanceCell_(systemRow, headerMap, ["AttendanceDate", "Date"], date);
  setAttendanceCell_(systemRow, headerMap, ["StudentID", "StudentId", "studentid"], "SYSTEM1");
  setAttendanceCell_(systemRow, headerMap, ["Username", "StudentName", "Name"], "daycounter");
  setAttendanceCell_(systemRow, headerMap, ["ClassGroup", "classgroup", "Group"], "SYSTEM");
  setAttendanceCell_(systemRow, headerMap, ["Status", "AttendanceStatus"], "ABSENT");
  setAttendanceCell_(systemRow, headerMap, ["DayCounter", "Day Counter"], "daycounter");
  setAttendanceCell_(systemRow, headerMap, ["Notes"], absentStudents.length === 0 ? "All students present" : "Register marked");
  setAttendanceCell_(systemRow, headerMap, ["AdminID", "AdminId", "adminid", "MarkedBy"], adminId);
  setAttendanceCell_(systemRow, headerMap, ["DateStamp", "Datestamp", "Timestamp", "MarkedDate"], now);
  outputRows.push(systemRow);

  sheet
    .getRange(sheet.getLastRow() + 1, 1, outputRows.length, rows[0].length)
    .setValues(outputRows);

  return {
    success: true,
    message: "Attendance submitted",
    date,
    absentCount: realAbsentCount,
    rowsAdded: outputRows.length,
    systemDayCounterAdded: true,
    adminid: adminId,
    datestamp: now,
    skippedDuplicateCount: absentStudents.length - realAbsentCount
  };
}

function getStudentsForAttendance(classgroup) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("StudentRecords");

  if (!sheet) {
    return { success: false, error: "StudentRecords sheet not found" };
  }

  const rows = sheet.getDataRange().getValues();
  const headerMap = buildAttendanceHeaderMap_(rows[0] || []);
  const requestedGroup = String(classgroup || "ALL").trim();

  const students = [];

  for (let i = 1; i < rows.length; i++) {
    const studentId = String(getAttendanceCell_(rows[i], headerMap, ["StudentID", "StudentId", "studentid"])).trim();
    const username = String(getAttendanceCell_(rows[i], headerMap, ["Username", "StudentName", "Name", "username"], "")).trim();
    const rowClassGroup = String(getAttendanceCell_(rows[i], headerMap, ["classgroup", "ClassGroup", "Group", "GroupNo"], "")).trim();
    const active = getAttendanceCell_(rows[i], headerMap, ["Active", "Status"], true);

    if (!studentId) continue;
    if (!isAttendanceActiveValue_(active)) continue;
    if (rowClassGroup === "0") continue;
    if (requestedGroup !== "ALL" && rowClassGroup !== requestedGroup) continue;

    students.push({
      studentid: studentId,
      username,
      classgroup: rowClassGroup
    });
  }

  students.sort((a, b) => {
    const groupCompare = String(a.classgroup).localeCompare(String(b.classgroup), undefined, { numeric: true });
    if (groupCompare !== 0) return groupCompare;

    return String(a.username).localeCompare(String(b.username), undefined, { numeric: true, sensitivity: "base" });
  });

  return {
    success: true,
    classgroup: requestedGroup,
    count: students.length,
    students
  };
}

function getAttendanceReport(data) {
  data = data || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentSheet = ss.getSheetByName("StudentRecords");
  const attendanceSheet = ss.getSheetByName("Attendance");

  if (!studentSheet) {
    return { success: false, error: "StudentRecords sheet not found" };
  }

  if (!attendanceSheet) {
    return { success: false, error: "Attendance sheet not found" };
  }

  ensureAttendanceHeaders_(attendanceSheet);

  const startDate = normalizeAttendanceDate_(data.startDate);
  const endDate = normalizeAttendanceDate_(data.endDate);
  const requestedGroup = String(data.classgroup || "ALL").trim();

  if (!startDate || !endDate) {
    return { success: false, error: "Missing startDate or endDate" };
  }

  if (startDate > endDate) {
    return { success: false, error: "Start date cannot be after end date" };
  }

  const studentRows = studentSheet.getDataRange().getValues();
  const studentHeaderMap = buildAttendanceHeaderMap_(studentRows[0] || []);

  const activeStudents = [];

  for (let i = 1; i < studentRows.length; i++) {
    const studentId = String(getAttendanceCell_(studentRows[i], studentHeaderMap, ["StudentID", "StudentId", "studentid"])).trim();
    const username = String(getAttendanceCell_(studentRows[i], studentHeaderMap, ["Username", "StudentName", "Name", "username"], "")).trim();
    const classgroup = String(getAttendanceCell_(studentRows[i], studentHeaderMap, ["classgroup", "ClassGroup", "Group", "GroupNo"], "")).trim();
    const active = getAttendanceCell_(studentRows[i], studentHeaderMap, ["Active", "Status"], true);

    if (!studentId) continue;
    if (!isAttendanceActiveValue_(active)) continue;
    if (classgroup === "0") continue;
    if (requestedGroup !== "ALL" && classgroup !== requestedGroup) continue;

    activeStudents.push({
      studentid: studentId,
      username,
      classgroup
    });
  }

  const attendanceRange = attendanceSheet.getDataRange();
  const attendanceRows = attendanceRange.getValues();
  const attendanceDisplayRows = attendanceRange.getDisplayValues();
  const attendanceHeaderMap = buildAttendanceHeaderMap_(attendanceRows[0] || []);

  const dateCol = findAttendanceColumn_(attendanceHeaderMap, ["AttendanceDate", "Date"]);
  const studentIdCol = findAttendanceColumn_(attendanceHeaderMap, ["StudentID", "StudentId", "studentid"]);
  const usernameCol = findAttendanceColumn_(attendanceHeaderMap, ["Username", "StudentName", "Name"]);

  if (dateCol === -1 || studentIdCol === -1 || usernameCol === -1) {
    return { success: false, error: "Attendance sheet is missing required headers" };
  }

  const maktabDays = new Set();
  const absentDateSetByStudentId = {};
  const seenAbsentPairs = new Set();

  for (let i = 1; i < attendanceRows.length; i++) {
    const rowDate = normalizeAttendanceDateFromSheet_(attendanceRows[i][dateCol], attendanceDisplayRows[i][dateCol]);
    const studentid = String(attendanceRows[i][studentIdCol] || "").trim();

    if (!rowDate) continue;
    if (rowDate < startDate || rowDate > endDate) continue;

    maktabDays.add(rowDate);

    if (!studentid || studentid === "SYSTEM1") {
      continue;
    }

    const pairKey = rowDate + "|" + studentid;

    if (seenAbsentPairs.has(pairKey)) {
      continue;
    }

    seenAbsentPairs.add(pairKey);

    if (!absentDateSetByStudentId[studentid]) {
      absentDateSetByStudentId[studentid] = new Set();
    }

    absentDateSetByStudentId[studentid].add(rowDate);
  }

  const totalMaktabDays = maktabDays.size;

  const students = activeStudents.map(student => {
    const absentDateSet = absentDateSetByStudentId[student.studentid] || new Set();
    const absentDates = Array.from(absentDateSet).sort();
    const absentDays = absentDates.length;

    const attendancePercent = totalMaktabDays === 0
      ? 0
      : roundAttendancePercent_(((totalMaktabDays - absentDays) / totalMaktabDays) * 100);

    return {
      studentid: student.studentid,
      username: student.username,
      classgroup: student.classgroup,
      absentDays,
      absentDates,
      attendancePercent
    };
  });

  students.sort((a, b) => {
    const groupCompare = String(a.classgroup).localeCompare(String(b.classgroup), undefined, { numeric: true });
    if (groupCompare !== 0) return groupCompare;

    return String(a.username).localeCompare(String(b.username), undefined, { numeric: true, sensitivity: "base" });
  });

  const groupMap = {};

  students.forEach(student => {
    if (!groupMap[student.classgroup]) {
      groupMap[student.classgroup] = [];
    }

    groupMap[student.classgroup].push(student);
  });

  const groupAverages = Object.keys(groupMap)
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
    .map(group => {
      const groupStudents = groupMap[group];
      const averageAttendancePercent = groupStudents.length === 0
        ? 0
        : roundAttendancePercent_(
            groupStudents.reduce((sum, s) => sum + s.attendancePercent, 0) / groupStudents.length
          );

      return {
        classgroup: group,
        studentCount: groupStudents.length,
        averageAttendancePercent
      };
    });

  const registerAverageAttendancePercent = students.length === 0
    ? 0
    : roundAttendancePercent_(
        students.reduce((sum, s) => sum + s.attendancePercent, 0) / students.length
      );

  const perfectAttendanceStudents = students
    .filter(student => student.absentDays === 0 && totalMaktabDays > 0)
    .map(student => ({
      studentid: student.studentid,
      username: student.username,
      classgroup: student.classgroup
    }));

  return {
    success: true,
    startDate,
    endDate,
    classgroup: requestedGroup,
    totalMaktabDays,
    registerAverageAttendancePercent,
    debug: {
      activeStudentCount: activeStudents.length,
      attendanceRowCount: Math.max(0, attendanceRows.length - 1),
      uniqueMaktabDays: Array.from(maktabDays).sort(),
      uniqueAbsentStudentDatePairCount: seenAbsentPairs.size
    },
    groupAverages,
    perfectAttendanceStudents,
    students
  };
}

function ensureAttendanceHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "AttendanceDate",
      "StudentID",
      "Username",
      "ClassGroup",
      "Status",
      "Notes",
      "AdminID",
      "DateStamp"
    ]);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 8)).getValues()[0];
  const hasDate = firstRow.some(value => {
    const key = normalizeAttendanceHeaderKey_(value);
    return key === normalizeAttendanceHeaderKey_("AttendanceDate") || key === normalizeAttendanceHeaderKey_("Date");
  });

  if (!hasDate) {
    sheet.getRange(1, 1, 1, 8).setValues([[
      "AttendanceDate",
      "StudentID",
      "Username",
      "ClassGroup",
      "Status",
      "Notes",
      "AdminID",
      "DateStamp"
    ]]);
  }
}


function normalizeAttendanceDateFromSheet_(rawValue, displayValue) {
  const displayText = String(displayValue || "").trim();

  if (displayText) {
    const normalizedDisplay = normalizeAttendanceDateText_(displayText);
    if (normalizedDisplay) {
      return normalizedDisplay;
    }
  }

  return normalizeAttendanceDate_(rawValue);
}

function normalizeAttendanceDateText_(text) {
  text = String(text || "").trim();

  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  let match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    let first = Number(match[1]);
    let second = Number(match[2]);
    let year = Number(match[3]);

    if (year < 100) {
      year += 2000;
    }

    let day;
    let month;

    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      month = first;
      day = second;
    } else {
      // For ambiguous slash dates, default to South African display order: dd/mm/yyyy.
      day = first;
      month = second;
    }

    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0")
    ].join("-");
  }

  match = text.match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const monthName = match[2].toLowerCase().slice(0, 3);
    const year = Number(match[3]);

    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12
    };

    const month = months[monthName];
    if (month) {
      return [
        String(year).padStart(4, "0"),
        String(month).padStart(2, "0"),
        String(day).padStart(2, "0")
      ].join("-");
    }
  }

  return "";
}


function normalizeAttendanceDate_(value) {
  if (!value) return "";

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, ATTENDANCE_TIMEZONE, "yyyy-MM-dd");
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, ATTENDANCE_TIMEZONE, "yyyy-MM-dd");
  }

  return text;
}

function buildAttendanceHeaderMap_(headers) {
  const map = {};

  headers.forEach((header, index) => {
    const key = normalizeAttendanceHeaderKey_(header);
    if (key) {
      map[key] = index;
    }
  });

  return map;
}

function normalizeAttendanceHeaderKey_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findAttendanceColumn_(headerMap, possibleHeaders) {
  for (const header of possibleHeaders) {
    const key = normalizeAttendanceHeaderKey_(header);
    if (Object.prototype.hasOwnProperty.call(headerMap, key)) {
      return headerMap[key];
    }
  }

  return -1;
}

function getAttendanceCell_(row, headerMap, possibleHeaders, fallback) {
  const col = findAttendanceColumn_(headerMap, possibleHeaders);
  if (col === -1) {
    return fallback;
  }

  const value = row[col];
  return value === "" || value === null || typeof value === "undefined"
    ? fallback
    : value;
}

function setAttendanceCell_(row, headerMap, possibleHeaders, value) {
  const col = findAttendanceColumn_(headerMap, possibleHeaders);
  if (col !== -1) {
    row[col] = value;
  }
}

function isAttendanceActiveValue_(value) {
  if (value === true) return true;

  const text = String(value || "").trim().toUpperCase();
  return text === "TRUE" || text === "ACTIVE" || text === "YES" || text === "1";
}


function normalizeAttendanceSystemName_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


function normalizeAttendanceStatus_(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

function roundAttendancePercent_(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}



/*End of Addmisssion module

*/


/*Start of Academic Module
*/
function generateSubjectId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SystemConfig");

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === "NextSubjectNumber") {
      const current = Number(data[i][1]);

      sheet.getRange(i + 1, 2).setValue(current + 1);

      return "SUBJ" + current;
    }
  }

  throw new Error("NextSubjectNumber not found");
}

function createSubject(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectList");

  const subjectName = String(data.subjectName || "").trim();

  if (!subjectName) {
    return {
      success: false,
      error: "Missing subjectName"
    };
  }

  const duplicate = findSubjectByName(subjectName);

  if (duplicate) {
    return {
      success: false,
      duplicate: true,
      error: "Subject already exists",
      subject: duplicate
    };
  }

  const subjectId = generateSubjectId();
  const now = new Date().toISOString();

  sheet.appendRow([
    subjectId,
    subjectName,
    true,
    now
  ]);

  return {
    success: true,
    subject: {
      subjectid: subjectId,
      subjectname: subjectName,
      active: true,
      createdate: now
    }
  };
}

function findSubjectByName(subjectName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectList");

  const data = sheet.getDataRange().getValues();
  const target = normalizeText(subjectName);

  for (let i = 1; i < data.length; i++) {
    const existing = normalizeText(data[i][1]);

    if (existing === target) {
      return {
        row: i + 1,
        subjectid: data[i][0],
        subjectname: data[i][1],
        active: data[i][2],
        createdate: data[i][3]
      };
    }
  }

  return null;
}



function findSubjectByNameExcludingId(subjectName, subjectId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectList");

  const data = sheet.getDataRange().getValues();
  const target = normalizeText(subjectName);
  const excludeId = String(subjectId || "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowSubjectId = String(data[i][0]).trim();
    const existing = normalizeText(data[i][1]);

    if (rowSubjectId !== excludeId && existing === target) {
      return {
        row: i + 1,
        subjectid: data[i][0],
        subjectname: data[i][1],
        active: data[i][2],
        createdate: data[i][3]
      };
    }
  }

  return null;
}


function listSubjects() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectList");

  const data = sheet.getDataRange().getValues();
  const subjects = [];

  for (let i = 1; i < data.length; i++) {
    subjects.push({
      subjectid: data[i][0],
      subjectname: data[i][1],
      active: data[i][2],
      createdate: data[i][3]
    });
  }

  subjects.sort((a, b) => {
    return String(a.subjectname).localeCompare(String(b.subjectname));
  });

  return {
    success: true,
    count: subjects.length,
    subjects
  };
}


function updateSubject(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectList");

  const subjectId = String(data.subjectid || "").trim();

  if (!subjectId) {
    return {
      success: false,
      error: "Missing subjectid"
    };
  }

  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === subjectId) {
      if (data.subjectName !== undefined) {
        const subjectName = String(data.subjectName || "").trim();

        if (!subjectName) {
          return {
            success: false,
            error: "Subject name cannot be empty"
          };
        }

        const duplicate = findSubjectByNameExcludingId(subjectName, subjectId);

        if (duplicate) {
          return {
            success: false,
            duplicate: true,
            error: "Another subject with that name already exists",
            subject: duplicate
          };
        }

        sheet.getRange(i + 1, 2).setValue(subjectName);
      }

      if (data.active !== undefined) {
        if (typeof data.active !== "boolean") {
          return {
            success: false,
            error: "active must be true or false"
          };
        }

        sheet.getRange(i + 1, 3).setValue(data.active);
      }

      return {
        success: true,
        message: "Subject updated successfully",
        subjectid: subjectId
      };
    }
  }

  return {
    success: false,
    error: "Subject not found"
  };
}

function generateResourceId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SystemConfig");

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === "NextResourceNumber") {
      const current = Number(data[i][1]);

      sheet.getRange(i + 1, 2).setValue(current + 1);

      return "RES" + current;
    }
  }

  throw new Error("NextResourceNumber not found");
}

function createSubjectResource(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectResources");

  const subjectId = String(data.subjectid || "").trim();
  const resourceName = String(data.resourceName || "").trim();
  const resourceType = String(data.resourceType || "").trim().toUpperCase();
  const resourceLink = String(data.resourceLink || "").trim();

  if (!subjectId) {
    return { success: false, error: "Missing subjectid" };
  }

  if (!resourceName) {
    return { success: false, error: "Missing resourceName" };
  }

  if (!resourceType) {
    return { success: false, error: "Missing resourceType" };
  }

  if (!resourceLink) {
    return { success: false, error: "Missing resourceLink" };
  }

  const allowedTypes = ["PDF", "AUDIO", "VIDEO", "IMAGE", "LINK", "TEXT", "OTHER"];

  if (!allowedTypes.includes(resourceType)) {
    return {
      success: false,
      error: "Invalid resourceType"
    };
  }

  const resourceId = generateResourceId();
  const now = new Date().toISOString();

  sheet.appendRow([
    resourceId,
    subjectId,
    resourceName,
    resourceType,
    resourceLink,
    true,
    now
  ]);

  return {
    success: true,
    resource: {
      resourceid: resourceId,
      subjectid: subjectId,
      resourcename: resourceName,
      resourcetype: resourceType,
      resourcelink: resourceLink,
      active: true,
      createdate: now
    }
  };
}

function listSubjectResources(subjectId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectResources");

  const data = sheet.getDataRange().getValues();
  const requestedSubjectId = String(subjectId || "ALL").trim();

  const resources = [];

  for (let i = 1; i < data.length; i++) {
    const rowSubjectId = String(data[i][1]).trim();

    if (requestedSubjectId !== "ALL" && rowSubjectId !== requestedSubjectId) {
      continue;
    }

    resources.push({
      resourceid: data[i][0],
      subjectid: data[i][1],
      resourcename: data[i][2],
      resourcetype: data[i][3],
      resourcelink: data[i][4],
      active: data[i][5],
      createdate: data[i][6]
    });
  }

  resources.sort((a, b) => {
    const subjectCompare = String(a.subjectid).localeCompare(String(b.subjectid));
    if (subjectCompare !== 0) return subjectCompare;

    return String(a.resourcename).localeCompare(String(b.resourcename));
  });

  return {
    success: true,
    subjectid: requestedSubjectId,
    count: resources.length,
    resources
  };
}

function updateSubjectResource(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SubjectResources");

  const resourceId = String(data.resourceid || "").trim();

  if (!resourceId) {
    return { success: false, error: "Missing resourceid" };
  }

  const rows = sheet.getDataRange().getValues();
  const allowedTypes = ["PDF", "AUDIO", "VIDEO", "IMAGE", "LINK", "TEXT", "OTHER"];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === resourceId) {
      if (data.subjectid !== undefined) {
        const subjectId = String(data.subjectid || "").trim();

        if (!subjectId) {
          return { success: false, error: "subjectid cannot be empty" };
        }

        sheet.getRange(i + 1, 2).setValue(subjectId);
      }

      if (data.resourceName !== undefined) {
        const resourceName = String(data.resourceName || "").trim();

        if (!resourceName) {
          return { success: false, error: "resourceName cannot be empty" };
        }

        sheet.getRange(i + 1, 3).setValue(resourceName);
      }

      if (data.resourceType !== undefined) {
        const resourceType = String(data.resourceType || "").trim().toUpperCase();

        if (!allowedTypes.includes(resourceType)) {
          return { success: false, error: "Invalid resourceType" };
        }

        sheet.getRange(i + 1, 4).setValue(resourceType);
      }

      if (data.resourceLink !== undefined) {
        const resourceLink = String(data.resourceLink || "").trim();

        if (!resourceLink) {
          return { success: false, error: "resourceLink cannot be empty" };
        }

        sheet.getRange(i + 1, 5).setValue(resourceLink);
      }

      if (data.active !== undefined) {
        if (typeof data.active !== "boolean") {
          return { success: false, error: "active must be true or false" };
        }

        sheet.getRange(i + 1, 6).setValue(data.active);
      }

      return {
        success: true,
        message: "Subject resource updated successfully",
        resourceid: resourceId
      };
    }
  }

  return {
    success: false,
    error: "Resource not found"
  };
}

function isActiveFlag(value) {
  return value === true || String(value).trim().toUpperCase() === "TRUE";
}


/* Task Resources*/

async function createTaskResourceAdmin(request, env) {
  const permission = await requireAdminOrSenior(request, env);

  if (!permission.ok) {
    return permission.response;
  }

  const body = await request.json();

  const taskid = String(body.taskid || "").trim();
  const taskResourceName = String(body.taskResourceName || "").trim();
  const resourceType = String(body.resourceType || "").trim().toUpperCase();
  const resourceLink = String(body.resourceLink || "").trim();

  if (!taskid) {
    return json({ success: false, error: "Missing taskid" }, 400);
  }

  if (!taskResourceName) {
    return json({ success: false, error: "Missing taskResourceName" }, 400);
  }

  if (!resourceType) {
    return json({ success: false, error: "Missing resourceType" }, 400);
  }

  if (!resourceLink) {
    return json({ success: false, error: "Missing resourceLink" }, 400);
  }

  const allowedTypes = ["PDF", "AUDIO", "VIDEO", "IMAGE", "LINK", "TEXT", "OTHER"];

  if (!allowedTypes.includes(resourceType)) {
    return json({ success: false, error: "Invalid resourceType" }, 400);
  }

  const result = await callAppsScript(env, {
    action: "createTaskResource",
    data: {
      taskid,
      taskResourceName,
      resourceType,
      resourceLink
    }
  });

  return json(result);
}

async function listTaskResourcesAdmin(request, env) {
  const authUser = await getAuthUser(request, env);

  if (!authUser || authUser.type !== "admin") {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const body = await request.json();

  const taskid = String(body.taskid || "ALL").trim();
  const activeOnly = body.activeOnly === true;

  const result = await callAppsScript(env, {
    action: "listTaskResources",
    data: {
      taskid,
      activeOnly
    }
  });

  return json(result);
}

async function updateTaskResourceAdmin(request, env) {
  const permission = await requireAdminOrSenior(request, env);

  if (!permission.ok) {
    return permission.response;
  }

  const body = await request.json();

  const taskresourceid = String(body.taskresourceid || "").trim();

  if (!taskresourceid) {
    return json({ success: false, error: "Missing taskresourceid" }, 400);
  }

  const updateData = {
    taskresourceid
  };

  if (body.taskid !== undefined) {
    const taskid = String(body.taskid || "").trim();

    if (!taskid) {
      return json({ success: false, error: "taskid cannot be empty" }, 400);
    }

    updateData.taskid = taskid;
  }

  if (body.taskResourceName !== undefined) {
    const taskResourceName = String(body.taskResourceName || "").trim();

    if (!taskResourceName) {
      return json({ success: false, error: "taskResourceName cannot be empty" }, 400);
    }

    updateData.taskResourceName = taskResourceName;
  }

  if (body.resourceType !== undefined) {
    const resourceType = String(body.resourceType || "").trim().toUpperCase();
    const allowedTypes = ["PDF", "AUDIO", "VIDEO", "IMAGE", "LINK", "TEXT", "OTHER"];

    if (!allowedTypes.includes(resourceType)) {
      return json({ success: false, error: "Invalid resourceType" }, 400);
    }

    updateData.resourceType = resourceType;
  }

  if (body.resourceLink !== undefined) {
    const resourceLink = String(body.resourceLink || "").trim();

    if (!resourceLink) {
      return json({ success: false, error: "resourceLink cannot be empty" }, 400);
    }

    updateData.resourceLink = resourceLink;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return json({ success: false, error: "active must be true or false" }, 400);
    }

    updateData.active = body.active;
  }

  const result = await callAppsScript(env, {
    action: "updateTaskResource",
    data: updateData
  });

  return json(result);
}

function generateTaskResourceId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SystemConfig");

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === "NextTaskResourceNumber") {
      const current = Number(data[i][1]);

      sheet.getRange(i + 1, 2).setValue(current + 1);

      return "TRES" + current;
    }
  }

  throw new Error("NextTaskResourceNumber not found");
}

function findTaskResourceByTaskAndName(taskId, taskResourceName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const rows = sheet.getDataRange().getValues();

  const targetTaskId = String(taskId || "").trim();
  const targetResourceName = normalizeText(taskResourceName);

  for (let i = 1; i < rows.length; i++) {
    const rowTaskId = String(rows[i][1]).trim();
    const rowResourceName = normalizeText(rows[i][2]);

    if (
      rowTaskId === targetTaskId &&
      rowResourceName === targetResourceName
    ) {
      return {
        row: i + 1,
        taskresourceid: rows[i][0],
        taskid: rows[i][1],
        taskresourcename: rows[i][2],
        resourcetype: rows[i][3],
        resourcelink: rows[i][4],
        active: rows[i][5],
        createdate: rows[i][6]
      };
    }
  }

  return null;
}

function findTaskResourceByTaskAndNameExcludingId(taskId, taskResourceName, taskResourceId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const rows = sheet.getDataRange().getValues();

  const targetTaskId = String(taskId || "").trim();
  const targetResourceName = normalizeText(taskResourceName);
  const excludeResourceId = String(taskResourceId || "").trim();

  for (let i = 1; i < rows.length; i++) {
    const rowResourceId = String(rows[i][0]).trim();
    const rowTaskId = String(rows[i][1]).trim();
    const rowResourceName = normalizeText(rows[i][2]);

    if (
      rowResourceId !== excludeResourceId &&
      rowTaskId === targetTaskId &&
      rowResourceName === targetResourceName
    ) {
      return {
        row: i + 1,
        taskresourceid: rows[i][0],
        taskid: rows[i][1],
        taskresourcename: rows[i][2],
        resourcetype: rows[i][3],
        resourcelink: rows[i][4],
        active: rows[i][5],
        createdate: rows[i][6]
      };
    }
  }

  return null;
}

function createTaskResource(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const taskId = String(data.taskid || "").trim();
  const taskResourceName = String(data.taskResourceName || "").trim();
  const resourceType = String(data.resourceType || "").trim().toUpperCase();
  const resourceLink = String(data.resourceLink || "").trim();
  const subjectId = String(data.subjectid || "").trim();

  if (!taskId) {
    return { success: false, error: "Missing taskid" };
  }

if (!subjectId) {
  return { success: false, error: "Missing subjectid" };
}

  if (!taskResourceName) {
    return { success: false, error: "Missing taskResourceName" };
  }

  if (!resourceType) {
    return { success: false, error: "Missing resourceType" };
  }

  if (!resourceLink) {
    return { success: false, error: "Missing resourceLink" };
  }

  const allowedTypes = ["PDF", "AUDIO", "VIDEO", "IMAGE", "LINK", "TEXT", "OTHER"];

  if (!allowedTypes.includes(resourceType)) {
    return {
      success: false,
      error: "Invalid resourceType"
    };
  }

  const taskMap = getTaskMapByIds([taskId]);

  if (!taskMap[taskId]) {
    return {
      success: false,
      error: "Task not found or inactive"
    };
  }

  const duplicate = findTaskResourceByTaskAndName(taskId, taskResourceName);

  if (duplicate) {
    return {
      success: false,
      duplicate: true,
      error: "Task resource already exists for this task",
      resource: duplicate
    };
  }

  const taskResourceId = generateTaskResourceId();
  const now = new Date().toISOString();

  sheet.appendRow([
  taskResourceId,
  taskId,
  taskResourceName,
  resourceType,
  resourceLink,
  true,
  now,
  subjectId
]);

  return {
    success: true,
    resource: {
      taskresourceid: taskResourceId,
      taskid: taskId,
      taskresourcename: taskResourceName,
      subjectid: subjectId,
      resourcetype: resourceType,
      resourcelink: resourceLink,
      active: true,
      createdate: now
    }
  };
}

function listTaskResources(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const rows = sheet.getDataRange().getValues();

  const requestedTaskId = String((data && data.taskid) || "ALL").trim();
  const activeOnly = data && data.activeOnly === true;

  const resources = [];

  for (let i = 1; i < rows.length; i++) {
    const rowTaskId = String(rows[i][1]).trim();
    const active = rows[i][5];

    if (requestedTaskId !== "ALL" && rowTaskId !== requestedTaskId) {
      continue;
    }

    if (activeOnly && active !== true) {
      continue;
    }

    resources.push({
      taskresourceid: rows[i][0],
      taskid: rows[i][1],
      taskresourcename: rows[i][2],
      resourcetype: rows[i][3],
      resourcelink: rows[i][4],
      active: rows[i][5],
      createdate: rows[i][6]
    });
  }

  resources.sort((a, b) => {
    const taskCompare = String(a.taskid).localeCompare(String(b.taskid));
    if (taskCompare !== 0) return taskCompare;

    return String(a.taskresourcename).localeCompare(String(b.taskresourcename));
  });

  return {
    success: true,
    taskid: requestedTaskId,
    count: resources.length,
    resources
  };
}

function updateTaskResource(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const taskResourceId = String(data.taskresourceid || "").trim();

  if (!taskResourceId) {
    return { success: false, error: "Missing taskresourceid" };
  }

  const rows = sheet.getDataRange().getValues();
  const allowedTypes = ["PDF", "AUDIO", "VIDEO", "IMAGE", "LINK", "TEXT", "OTHER"];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === taskResourceId) {
      const currentTaskId = String(rows[i][1]).trim();

      if (data.taskid !== undefined) {
        const taskId = String(data.taskid || "").trim();

        if (!taskId) {
          return { success: false, error: "taskid cannot be empty" };
        }

        const taskMap = getTaskMapByIds([taskId]);

        if (!taskMap[taskId]) {
          return {
            success: false,
            error: "Task not found or inactive"
          };
        }
      }

      if (data.taskResourceName !== undefined) {
        const taskResourceName = String(data.taskResourceName || "").trim();

        if (!taskResourceName) {
          return { success: false, error: "taskResourceName cannot be empty" };
        }

        const taskIdToCheck = data.taskid !== undefined
          ? String(data.taskid || "").trim()
          : currentTaskId;

        const duplicate = findTaskResourceByTaskAndNameExcludingId(
          taskIdToCheck,
          taskResourceName,
          taskResourceId
        );

        if (duplicate) {
          return {
            success: false,
            duplicate: true,
            error: "Another task resource with that name already exists for this task",
            resource: duplicate
          };
        }
      }

      if (data.resourceType !== undefined) {
        const resourceType = String(data.resourceType || "").trim().toUpperCase();

        if (!allowedTypes.includes(resourceType)) {
          return { success: false, error: "Invalid resourceType" };
        }
      }

      if (data.resourceLink !== undefined) {
        const resourceLink = String(data.resourceLink || "").trim();

        if (!resourceLink) {
          return { success: false, error: "resourceLink cannot be empty" };
        }
      }

      if (data.active !== undefined) {
        if (typeof data.active !== "boolean") {
          return { success: false, error: "active must be true or false" };
        }
      }

      if (data.taskid !== undefined) {
        sheet.getRange(i + 1, 2).setValue(String(data.taskid || "").trim());
      }

      if (data.taskResourceName !== undefined) {
        sheet.getRange(i + 1, 3).setValue(String(data.taskResourceName || "").trim());
      }

      if (data.resourceType !== undefined) {
        sheet.getRange(i + 1, 4).setValue(String(data.resourceType || "").trim().toUpperCase());
      }

      if (data.resourceLink !== undefined) {
        sheet.getRange(i + 1, 5).setValue(String(data.resourceLink || "").trim());
      }

      if (data.active !== undefined) {
        sheet.getRange(i + 1, 6).setValue(data.active);
      }

      return {
        success: true,
        message: "Task resource updated successfully",
        taskresourceid: taskResourceId
      };
    }
  }

  return {
    success: false,
    error: "Task resource not found"
  };
}

function getActiveTaskResourcesMap() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const rows = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const active = rows[i][5];

    if (active !== true) {
      continue;
    }

    const taskId = String(rows[i][1]).trim();

    if (!map[taskId]) {
      map[taskId] = [];
    }

    map[taskId].push({
      taskresourceid: rows[i][0],
      taskid: rows[i][1],
      taskresourcename: rows[i][2],
      resourcetype: rows[i][3],
      resourcelink: rows[i][4],
      active: rows[i][5],
      createdate: rows[i][6]
    });
  }

  Object.keys(map).forEach(taskId => {
    map[taskId].sort((a, b) => {
      return String(a.taskresourcename).localeCompare(String(b.taskresourcename));
    });
  });

  return map;
}

/*
 * MIGRATION STATUS: LEGACY ROLLBACK READ (V97, production verified 2026-07-20).
 * Active Worker traffic reads Resources through the Google Sheets API.
 * Keep this implementation with its doPost action until rollback is retired.
 * See apps-script/MIGRATION-CHANGELOG.md.
 */
function getStudentResources(data) {
  data = data || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const studentId = String(data.studentid || data.studentId || "").trim();
  const requestedGroup = String(data.classgroup || data.groupNo || data.group || "").trim();

  const resourceTabs = [
    {
      sheetName: "eBooks",
      type: "EBOOKS",
      key: "ebooks",
      label: "eBooks",
      description: "Books and reading resources",
      idHeaders: ["eBookId", "eBookID", "EBookId", "EBookID", "ResourceID"],
      nameHeaders: ["eBookName", "EBookName", "ResourceName"],
      subjectIdHeaders: ["SubjectId", "SubjectID"],
      subjectNameHeaders: ["SubjectName", "Subject"],
      moduleIdHeaders: ["ModuleId", "ModuleID", "ModuletID"],
      moduleNameHeaders: ["ModuleName", "Module"],
      taskIdHeaders: ["TaskId", "TaskID"],
      groupNoHeaders: ["GroupNo", "Group", "ClassGroup", "classgroup"],
      formatHeaders: ["eBookFormat", "ebookFormat", "EBookFormat", "Format"],
      descriptionHeaders: ["eBookDescription", "EBookDescription", "ResourceDescription", "Description"],
      linkHeaders: ["eBookLink", "EBookLink", "ResourceLink", "Link"],
      activeHeaders: ["Active"],
      dateHeaders: ["Date", "CreatedDate"]
    },
    {
      sheetName: "Printable",
      type: "PRINTABLES",
      key: "printables",
      label: "Printables",
      description: "Worksheets and printable files",
      idHeaders: ["PrintableId", "PrintableID", "ResourceID"],
      nameHeaders: ["PrintableName", "ResourceName"],
      subjectIdHeaders: ["SubjectId", "SubjectID"],
      subjectNameHeaders: ["SubjectName", "Subject"],
      moduleIdHeaders: ["ModuleId", "ModuleID", "ModuletID"],
      moduleNameHeaders: ["ModuleName", "Module"],
      taskIdHeaders: ["TaskId", "TaskID"],
      groupNoHeaders: ["GroupNo", "Group", "ClassGroup", "classgroup"],
      formatHeaders: ["PrintableFormat", "Format"],
      descriptionHeaders: ["PrintableDescription", "PrintableDescrip", "ResourceDescription", "Description"],
      linkHeaders: ["PrintableLink", "ResourceLink", "Link"],
      activeHeaders: ["Active"],
      dateHeaders: ["Date", "CreatedDate"]
    },
    {
      sheetName: "Audio",
      type: "AUDIO",
      key: "audio",
      label: "Audio",
      description: "Listening resources",
      idHeaders: ["AudioId", "AudioID", "ResourceID"],
      nameHeaders: ["AudioName", "ResourceName"],
      subjectIdHeaders: ["SubjectId", "SubjectID"],
      subjectNameHeaders: ["SubjectName", "Subject"],
      moduleIdHeaders: ["ModuleId", "ModuleID", "ModuletID"],
      moduleNameHeaders: ["ModuleName", "Module"],
      taskIdHeaders: ["TaskId", "TaskID"],
      groupNoHeaders: ["GroupNo", "Group", "ClassGroup", "classgroup"],
      formatHeaders: ["AudioFormat", "Format"],
      descriptionHeaders: ["AudioDescription", "ResourceDescription", "Description"],
      linkHeaders: ["AudioLink", "ResourceLink", "Link"],
      activeHeaders: ["Active"],
      dateHeaders: ["Date", "CreatedDate"]
    },
    {
      sheetName: "Video",
      type: "VIDEO",
      key: "video",
      label: "Video",
      description: "Movie and video resources",
      idHeaders: ["VideoId", "VideoID", "ResourceID"],
      nameHeaders: ["VideoName", "ResourceName"],
      subjectIdHeaders: ["SubjectId", "SubjectID"],
      subjectNameHeaders: ["SubjectName", "Subject"],
      moduleIdHeaders: ["ModuleId", "ModuleID", "ModuletID"],
      moduleNameHeaders: ["ModuleName", "Module"],
      taskIdHeaders: ["TaskId", "TaskID"],
      groupNoHeaders: ["GroupNo", "Group", "ClassGroup", "classgroup"],
      formatHeaders: ["VideoFormat", "Format"],
      descriptionHeaders: ["VideoDescription", "ResourceDescription", "Description"],
      linkHeaders: ["VideoLink", "ResourceLink", "Link"],
      activeHeaders: ["Active"],
      dateHeaders: ["Date", "CreatedDate"]
    },
    {
      sheetName: "OtherResource",
      type: "OTHER",
      key: "other",
      label: "Other",
      description: "Images, links, text and other files",
      idHeaders: ["OtherResourceID", "OtherResourceId", "ResourceID"],
      nameHeaders: ["OtherResourceName", "ResourceName"],
      subjectIdHeaders: ["SubjectId", "SubjectID"],
      subjectNameHeaders: ["SubjectName", "Subject"],
      moduleIdHeaders: ["ModuleId", "ModuleID", "ModuletID"],
      moduleNameHeaders: ["ModuleName", "Module"],
      taskIdHeaders: ["TaskId", "TaskID"],
      groupNoHeaders: ["GroupNo", "Group", "ClassGroup", "classgroup"],
      formatHeaders: ["OtherResourceFormat", "OtherResouceFormat", "OtherFormat", "ResourceFormat", "Format"],
      descriptionHeaders: ["OtherResourceDescription", "OtherResourceDescrip", "ResourceDescription", "Description"],
      linkHeaders: ["OtherResourceLink", "ResourceLink", "OtherLink", "Link"],
      activeHeaders: ["Active"],
      dateHeaders: ["Date", "CreatedDate"]
    }
  ];

  function clean(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function normalizeHeader(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function normalizeMatch(value) {
    return clean(value).toLowerCase().replace(/\s+/g, "");
  }

  function isActive(value) {
    const text = clean(value).toUpperCase();
    return value === true || text === "TRUE" || text === "YES" || text === "Y" || text === "ACTIVE" || text === "1";
  }

  function buildHeaderMap(headers) {
    const map = {};

    headers.forEach(function(header, index) {
      const key = normalizeHeader(header);
      if (key) {
        map[key] = index;
      }
    });

    return map;
  }

  function findColumn(headerMap, possibleHeaders) {
    for (let i = 0; i < possibleHeaders.length; i++) {
      const key = normalizeHeader(possibleHeaders[i]);
      if (headerMap[key] !== undefined) {
        return headerMap[key];
      }
    }

    return -1;
  }

  function getCell(row, colIndex) {
    return colIndex >= 0 ? row[colIndex] : "";
  }

  function compareText(a, b) {
    return clean(a).localeCompare(clean(b), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function makeGroup(config) {
    return {
      type: config.type,
      key: config.key,
      label: config.label,
      description: config.description,
      count: 0,
      subjects: []
    };
  }

  function getStudentClassGroup(studentid) {
    if (!studentid) {
      return "";
    }

    const sheet = ss.getSheetByName("StudentRecords");
    if (!sheet) {
      return "";
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      return "";
    }

    const headerMap = buildHeaderMap(rows[0]);
    const studentIdCol = findColumn(headerMap, ["studentid", "StudentID", "StudentId"]);
    const groupCol = findColumn(headerMap, ["classgroup", "ClassGroup", "Group", "GroupNo"]);

    const fallbackStudentIdCol = studentIdCol >= 0 ? studentIdCol : 0;
    const fallbackGroupCol = groupCol >= 0 ? groupCol : 6;

    for (let i = 1; i < rows.length; i++) {
      if (clean(rows[i][fallbackStudentIdCol]) === studentid) {
        return clean(rows[i][fallbackGroupCol]);
      }
    }

    return "";
  }

  function groupMatches(rowGroup, studentGroup) {
    const rowValue = normalizeMatch(rowGroup);

    if (!rowValue || rowValue === "all") {
      return true;
    }

    if (!studentGroup) {
      return true;
    }

    return rowValue === normalizeMatch(studentGroup);
  }

  const studentGroup = requestedGroup || getStudentClassGroup(studentId);
  const groups = [];
  const response = {
    success: true,
    studentid: studentId,
    classgroup: studentGroup,
    groups: groups,
    count: 0
  };

  resourceTabs.forEach(function(config) {
    const group = makeGroup(config);
    groups.push(group);
    response[config.key] = group;

    const sheet = ss.getSheetByName(config.sheetName);
    if (!sheet) {
      group.warning = "Missing sheet: " + config.sheetName;
      return;
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      return;
    }

    const headerMap = buildHeaderMap(rows[0]);

    const idCol = findColumn(headerMap, config.idHeaders);
    const nameCol = findColumn(headerMap, config.nameHeaders);
    const subjectIdCol = findColumn(headerMap, config.subjectIdHeaders);
    const subjectNameCol = findColumn(headerMap, config.subjectNameHeaders);
    const moduleIdCol = findColumn(headerMap, config.moduleIdHeaders);
    const moduleNameCol = findColumn(headerMap, config.moduleNameHeaders);
    const taskIdCol = findColumn(headerMap, config.taskIdHeaders);
    const groupNoCol = findColumn(headerMap, config.groupNoHeaders);
    const formatCol = findColumn(headerMap, config.formatHeaders);
    const descriptionCol = findColumn(headerMap, config.descriptionHeaders);
    const linkCol = findColumn(headerMap, config.linkHeaders);
    const activeCol = findColumn(headerMap, config.activeHeaders);
    const dateCol = findColumn(headerMap, config.dateHeaders);

    if (nameCol < 0 || linkCol < 0) {
      group.warning = "Missing required name or link column in sheet: " + config.sheetName;
      return;
    }

    const subjectMap = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const activeValue = activeCol >= 0 ? getCell(row, activeCol) : true;

      if (!isActive(activeValue)) {
        continue;
      }

      const resourceName = clean(getCell(row, nameCol));
      const link = clean(getCell(row, linkCol));

      if (!resourceName || !link) {
        continue;
      }

      const rowGroupNo = clean(getCell(row, groupNoCol));
      if (!groupMatches(rowGroupNo, studentGroup)) {
        continue;
      }

      const subjectName = clean(getCell(row, subjectNameCol)) || "Unassigned Subject";
      const moduleName = clean(getCell(row, moduleNameCol)) || "General";
      const subjectKey = normalizeMatch(subjectName);
      const moduleKey = normalizeMatch(moduleName);

      if (!subjectMap[subjectKey]) {
        subjectMap[subjectKey] = {
          subjectid: clean(getCell(row, subjectIdCol)),
          subjectname: subjectName,
          modules: [],
          _moduleMap: {}
        };
      }

      const subject = subjectMap[subjectKey];

      if (!subject._moduleMap[moduleKey]) {
        subject._moduleMap[moduleKey] = {
          moduleid: clean(getCell(row, moduleIdCol)),
          modulename: moduleName,
          resources: []
        };
        subject.modules.push(subject._moduleMap[moduleKey]);
      }

      subject._moduleMap[moduleKey].resources.push({
        resourceid: clean(getCell(row, idCol)),
        name: resourceName,
        resourcename: resourceName,
        type: config.type,
        label: config.label,
        subjectid: clean(getCell(row, subjectIdCol)),
        subjectname: subjectName,
        moduleid: clean(getCell(row, moduleIdCol)),
        modulename: moduleName,
        taskid: clean(getCell(row, taskIdCol)),
        groupno: rowGroupNo,
        format: clean(getCell(row, formatCol)),
        description: clean(getCell(row, descriptionCol)),
        link: link,
        date: clean(getCell(row, dateCol))
      });

      group.count++;
      response.count++;
    }

    group.subjects = Object.keys(subjectMap).map(function(key) {
      const subject = subjectMap[key];
      subject.modules.sort(function(a, b) {
        return compareText(a.modulename, b.modulename);
      });

      subject.modules.forEach(function(module) {
        module.resources.sort(function(a, b) {
          return compareText(a.name, b.name);
        });
      });

      delete subject._moduleMap;
      return subject;
    });

    group.subjects.sort(function(a, b) {
      return compareText(a.subjectname, b.subjectname);
    });
  });

  groups.sort(function(a, b) {
    return resourceTabs.findIndex(function(config) { return config.type === a.type; }) -
      resourceTabs.findIndex(function(config) { return config.type === b.type; });
  });

  return response;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove accents
    .replace(/[^a-z0-9]/g, "");        // remove spaces, apostrophes, punctuation
}

function generateTaskId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SystemConfig");

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === "NextTaskNumber") {
      const current = Number(data[i][1]);

      sheet.getRange(i + 1, 2).setValue(current + 1);

      return "TASK" + current;
    }
  }

  throw new Error("NextTaskNumber not found");
}

function createTask(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskList");

  const subjectId = String(data.subjectid || "").trim();
  const taskName = String(data.taskName || "").trim();

  const audioLink = String(data.audioLink || "").trim();
  const visualLink = String(data.visualLink || "").trim();
  const videoLink = String(data.videoLink || "").trim();
  const pdfLink = String(data.pdfLink || "").trim();

  if (!subjectId) {
    return { success: false, error: "Missing subjectid" };
  }

  if (!taskName) {
    return { success: false, error: "Missing taskName" };
  }

  const duplicate = findTaskBySubjectAndName(subjectId, taskName);

  if (duplicate) {
    return {
      success: false,
      duplicate: true,
      error: "Task already exists for this subject",
      task: duplicate
    };
  }

  const taskId = generateTaskId();
  const now = new Date().toISOString();

  sheet.appendRow([
    taskId,
    subjectId,
    taskName,
    audioLink,
    visualLink,
    videoLink,
    pdfLink,
    true,
    now
  ]);

  return {
    success: true,
    task: {
      taskid: taskId,
      subjectid: subjectId,
      taskname: taskName,
      audiolink: audioLink,
      visuallink: visualLink,
      videolink: videoLink,
      pdflink: pdfLink,
      active: true,
      createdate: now
    }
  };
}

function findTaskBySubjectAndName(subjectId, taskName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskList");

  const data = sheet.getDataRange().getValues();

  const targetSubject = String(subjectId || "").trim();
  const targetTask = normalizeText(taskName);

  for (let i = 1; i < data.length; i++) {
    const rowSubject = String(data[i][1]).trim();
    const rowTask = normalizeText(data[i][2]);

    if (rowSubject === targetSubject && rowTask === targetTask) {
      return {
        taskid: data[i][0],
        subjectid: data[i][1],
        taskname: data[i][2],
        audiolink: data[i][3],
        visuallink: data[i][4],
        videolink: data[i][5],
        pdflink: data[i][6],
        active: data[i][7],
        createdate: data[i][8]
      };
    }
  }

  return null;
}

function listTasks(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskList");

  const rows = sheet.getDataRange().getValues();

  const requestedSubjectId = String((data && data.subjectid) || "ALL").trim();
  const activeOnly = data && data.activeOnly === true;

  const tasks = [];

  for (let i = 1; i < rows.length; i++) {
    const subjectId = String(rows[i][1]).trim();
    const active = rows[i][7];

    if (requestedSubjectId !== "ALL" && subjectId !== requestedSubjectId) {
      continue;
    }

    if (activeOnly && active !== true) {
      continue;
    }

    tasks.push({
      taskid: rows[i][0],
      subjectid: rows[i][1],
      taskname: rows[i][2],
      audiolink: rows[i][3],
      visuallink: rows[i][4],
      videolink: rows[i][5],
      pdflink: rows[i][6],
      active: rows[i][7],
      createdate: rows[i][8]
    });
  }

  tasks.sort((a, b) => {
    const subjectCompare = String(a.subjectid).localeCompare(String(b.subjectid));
    if (subjectCompare !== 0) return subjectCompare;

    return String(a.taskname).localeCompare(String(b.taskname));
  });

  return {
    success: true,
    subjectid: requestedSubjectId,
    count: tasks.length,
    tasks
  };
}

function updateTask(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskList");

  const taskId = String(data.taskid || "").trim();

  if (!taskId) {
    return { success: false, error: "Missing taskid" };
  }

  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === taskId) {
      const currentSubjectId = String(rows[i][1]).trim();

      if (data.subjectid !== undefined) {
        const subjectId = String(data.subjectid || "").trim();

        if (!subjectId) {
          return { success: false, error: "subjectid cannot be empty" };
        }

        sheet.getRange(i + 1, 2).setValue(subjectId);
      }

      if (data.taskName !== undefined) {
        const taskName = String(data.taskName || "").trim();

        if (!taskName) {
          return { success: false, error: "taskName cannot be empty" };
        }

        const subjectToCheck = data.subjectid !== undefined
          ? String(data.subjectid || "").trim()
          : currentSubjectId;

        const duplicate = findTaskBySubjectAndNameExcludingId(subjectToCheck, taskName, taskId);

        if (duplicate) {
          return {
            success: false,
            duplicate: true,
            error: "Another task with that name already exists for this subject",
            task: duplicate
          };
        }

        sheet.getRange(i + 1, 3).setValue(taskName);
      }

      if (data.audioLink !== undefined) {
        sheet.getRange(i + 1, 4).setValue(String(data.audioLink || "").trim());
      }

      if (data.visualLink !== undefined) {
        sheet.getRange(i + 1, 5).setValue(String(data.visualLink || "").trim());
      }

      if (data.videoLink !== undefined) {
        sheet.getRange(i + 1, 6).setValue(String(data.videoLink || "").trim());
      }

      if (data.pdfLink !== undefined) {
        sheet.getRange(i + 1, 7).setValue(String(data.pdfLink || "").trim());
      }

      if (data.active !== undefined) {
        if (typeof data.active !== "boolean") {
          return { success: false, error: "active must be true or false" };
        }

        sheet.getRange(i + 1, 8).setValue(data.active);
      }

      return {
        success: true,
        message: "Task updated successfully",
        taskid: taskId
      };
    }
  }

  return {
    success: false,
    error: "Task not found"
  };
}

function findTaskBySubjectAndNameExcludingId(subjectId, taskName, taskId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskList");

  const data = sheet.getDataRange().getValues();

  const targetSubject = String(subjectId || "").trim();
  const targetTask = normalizeText(taskName);
  const excludeTaskId = String(taskId || "").trim();

  for (let i = 1; i < data.length; i++) {
    const rowTaskId = String(data[i][0]).trim();
    const rowSubject = String(data[i][1]).trim();
    const rowTask = normalizeText(data[i][2]);

    if (
      rowTaskId !== excludeTaskId &&
      rowSubject === targetSubject &&
      rowTask === targetTask
    ) {
      return {
        taskid: data[i][0],
        subjectid: data[i][1],
        taskname: data[i][2],
        active: data[i][7],
        createdate: data[i][8]
      };
    }
  }

  return null;
}

function generateStudentTaskId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("SystemConfig");

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === "NextStudentTaskNumber") {
      const current = Number(data[i][1]);

      sheet.getRange(i + 1, 2).setValue(current + 1);

      return "STASK" + current;
    }
  }

  throw new Error("NextStudentTaskNumber not found");
}

function assignTasksToStudents(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const studentTaskSheet = ss.getSheetByName("StudentTasks");
  const studentSheet = ss.getSheetByName("StudentRecords");
  const taskSheet = ss.getSheetByName("TaskList");

  const assignedBy = String(data.assignedBy || "").trim();
  const taskIds = Array.isArray(data.taskids) ? data.taskids.map(String) : [];
  const studentIds = Array.isArray(data.studentids) ? data.studentids.map(String) : [];
  const classgroup = String(data.classgroup || "").trim();
  const assignAllStudents = data.assignAllStudents === true;
  const assignAllTasksForSubject = data.assignAllTasksForSubject === true;
  const subjectid = String(data.subjectid || "").trim();

  if (!assignedBy) {
    return { success: false, error: "Missing assignedBy" };
  }

  let finalTaskIds = taskIds.map(id => id.trim()).filter(Boolean);
  let finalStudentIds = studentIds.map(id => id.trim()).filter(Boolean);

  if (assignAllTasksForSubject) {
    if (!subjectid) {
      return { success: false, error: "Missing subjectid for assignAllTasksForSubject" };
    }

    finalTaskIds = getActiveTaskIdsBySubject(subjectid);
  }

  if (assignAllStudents) {
    finalStudentIds = getActiveStudentIdsByGroup("ALL");
  } else if (classgroup) {
    finalStudentIds = getActiveStudentIdsByGroup(classgroup);
  }

  if (finalTaskIds.length === 0) {
    return { success: false, error: "No tasks selected" };
  }

  if (finalStudentIds.length === 0) {
    return { success: false, error: "No students selected" };
  }

  const validTasks = getTaskMapByIds(finalTaskIds);
  const validStudents = getStudentMapByIds(finalStudentIds);

  const existingAssignments = getExistingStudentTaskPairs();

  const now = new Date().toISOString();
  const rowsToAdd = [];

  let skippedDuplicate = 0;
  let skippedInvalidTask = 0;
  let skippedInvalidStudent = 0;

  finalStudentIds.forEach(studentId => {
    const student = validStudents[studentId];

    if (!student) {
      skippedInvalidStudent++;
      return;
    }

    finalTaskIds.forEach(taskId => {
      const task = validTasks[taskId];

      if (!task) {
        skippedInvalidTask++;
        return;
      }

      const pairKey = studentId + "|" + taskId;

      if (existingAssignments.has(pairKey)) {
        skippedDuplicate++;
        return;
      }

      existingAssignments.add(pairKey);

      rowsToAdd.push([
        generateStudentTaskId(),
        studentId,
        taskId,
        task.subjectid,
        "",       // CompleteStatus empty = to be completed
        "",       // CompleteDate
        "",       // VerifyStatus empty = not verified
        "",       // VerifyDate
        assignedBy,
        now
      ]);
    });
  });

  if (rowsToAdd.length > 0) {
    studentTaskSheet
      .getRange(
        studentTaskSheet.getLastRow() + 1,
        1,
        rowsToAdd.length,
        rowsToAdd[0].length
      )
      .setValues(rowsToAdd);
  }

  return {
    success: true,
    message: "Task assignment completed",
    assignedCount: rowsToAdd.length,
    skippedDuplicate,
    skippedInvalidTask,
    skippedInvalidStudent
  };
}

function getActiveTaskIdsBySubject(subjectid) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskList");

  const rows = sheet.getDataRange().getValues();
  const taskIds = [];

  for (let i = 1; i < rows.length; i++) {
    const rowSubjectId = String(rows[i][1]).trim();
    const active = rows[i][7];

    if (rowSubjectId === subjectid && active === true) {
      taskIds.push(String(rows[i][0]).trim());
    }
  }

  return taskIds;
}

function getActiveStudentIdsByGroup(classgroup) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("StudentRecords");

  const rows = sheet.getDataRange().getValues();
  const studentIds = [];
  const requestedGroup = String(classgroup || "ALL").trim();

  for (let i = 1; i < rows.length; i++) {
    const active = rows[i][10];
    const rowGroup = String(rows[i][6]).trim();

    if (active !== true) {
      continue;
    }

    if (requestedGroup !== "ALL" && rowGroup !== requestedGroup) {
      continue;
    }

    studentIds.push(String(rows[i][0]).trim());
  }

  return studentIds;
}

function getTaskMapByIds(taskIds) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskList");

  const rows = sheet.getDataRange().getValues();
  const wanted = new Set(taskIds.map(id => String(id).trim()));
  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const taskId = String(rows[i][0]).trim();
    const active = rows[i][7];

    if (!wanted.has(taskId)) {
      continue;
    }

    if (active !== true) {
      continue;
    }

    map[taskId] = {
      taskid: taskId,
      subjectid: rows[i][1],
      taskname: rows[i][2]
    };
  }

  return map;
}

function getStudentMapByIds(studentIds) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("StudentRecords");

  const rows = sheet.getDataRange().getValues();
  const wanted = new Set(studentIds.map(id => String(id).trim()));
  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const studentId = String(rows[i][0]).trim();
    const active = rows[i][10];

    if (!wanted.has(studentId)) {
      continue;
    }

    if (active !== true) {
      continue;
    }

    map[studentId] = {
      studentid: studentId,
      username: rows[i][1],
      classgroup: rows[i][6]
    };
  }

  return map;
}

function getExistingStudentTaskPairs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("StudentTasks");

  const rows = sheet.getDataRange().getValues();
  const pairs = new Set();

  for (let i = 1; i < rows.length; i++) {
    const studentId = String(rows[i][1]).trim();
    const taskId = String(rows[i][2]).trim();

    if (studentId && taskId) {
      pairs.add(studentId + "|" + taskId);
    }
  }

  return pairs;
}


/**
 * Header-based, simplified bulk assignment.
 * Populates StudentTasks with every active TaskList task for every active student.
 * Skips existing StudentID + TaskID pairs.
 *
 * Optional data:
 * {
 *   assignedBy: "SYSTEM",
 *   classgroup: "ALL",     // or a specific group
 *   subjectid: "ALL",      // or a specific SubjectID
 *   dryRun: true           // true = count only, false = write rows
 * }
 */
function populateAllStudentTasks(data) {
  data = data || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const studentTaskSheet = ss.getSheetByName("StudentTasks");
  const studentSheet = ss.getSheetByName("StudentRecords");
  const taskSheet = ss.getSheetByName("TaskList");

  if (!studentTaskSheet) return { success: false, error: "StudentTasks sheet not found" };
  if (!studentSheet) return { success: false, error: "StudentRecords sheet not found" };
  if (!taskSheet) return { success: false, error: "TaskList sheet not found" };

  const assignedBy = String(data.assignedBy || "SYSTEM").trim();
  const requestedGroup = String(data.classgroup || "ALL").trim();
  const requestedSubjectId = String(data.subjectid || "ALL").trim();
  const dryRun = data.dryRun === true;

  const studentTaskRows = studentTaskSheet.getDataRange().getValues();
  const studentTaskHeaders = studentTaskRows[0] || [];
  const studentTaskHeaderMap = buildHeaderMapForTasks_(studentTaskHeaders);

  const studentRows = studentSheet.getDataRange().getValues();
  const studentHeaderMap = buildHeaderMapForTasks_(studentRows[0] || []);

  const taskRows = taskSheet.getDataRange().getValues();
  const taskHeaderMap = buildHeaderMapForTasks_(taskRows[0] || []);

  const studentTaskIdCol = findTaskColumn_(studentTaskHeaderMap, [
    "StudentTaskID",
    "StudentTaskId",
    "studenttaskid"
  ]);

  const studentTaskStudentIdCol = findTaskColumn_(studentTaskHeaderMap, [
    "StudentID",
    "StudentId",
    "studentid"
  ]);

  const studentTaskTaskIdCol = findTaskColumn_(studentTaskHeaderMap, [
    "TaskID",
    "TaskId",
    "taskid"
  ]);

  if (studentTaskIdCol === -1) {
    return { success: false, error: "StudentTasks is missing StudentTaskID column" };
  }

  if (studentTaskStudentIdCol === -1) {
    return { success: false, error: "StudentTasks is missing StudentID column" };
  }

  if (studentTaskTaskIdCol === -1) {
    return { success: false, error: "StudentTasks is missing TaskID column" };
  }

  const existingPairs = new Set();

  for (let i = 1; i < studentTaskRows.length; i++) {
    const studentId = String(studentTaskRows[i][studentTaskStudentIdCol] || "").trim();
    const taskId = String(studentTaskRows[i][studentTaskTaskIdCol] || "").trim();

    if (studentId && taskId) {
      existingPairs.add(studentId + "|" + taskId);
    }
  }

  const activeStudents = [];

  for (let i = 1; i < studentRows.length; i++) {
    const studentId = String(getTaskCell_(studentRows[i], studentHeaderMap, [
      "StudentID",
      "StudentId",
      "studentid"
    ])).trim();

    const username = String(getTaskCell_(studentRows[i], studentHeaderMap, [
      "Username",
      "StudentName",
      "Name",
      "username"
    ], "")).trim();

    const classgroup = String(getTaskCell_(studentRows[i], studentHeaderMap, [
      "classgroup",
      "ClassGroup",
      "Group",
      "GroupNo"
    ], "")).trim();

    const active = getTaskCell_(studentRows[i], studentHeaderMap, [
      "Active",
      "Status"
    ], true);

    if (!studentId) continue;
    if (!isTaskActiveValue_(active)) continue;
    if (requestedGroup !== "ALL" && classgroup !== requestedGroup) continue;

    activeStudents.push({
      studentid: studentId,
      username: username,
      classgroup: classgroup
    });
  }

  const activeTasks = [];

  for (let i = 1; i < taskRows.length; i++) {
    const taskId = String(getTaskCell_(taskRows[i], taskHeaderMap, [
      "TaskID",
      "TaskId",
      "taskid"
    ])).trim();

    const subjectId = String(getTaskCell_(taskRows[i], taskHeaderMap, [
      "SubjectID",
      "SubjectId",
      "subjectid"
    ])).trim();

    const subjectName = String(getTaskCell_(taskRows[i], taskHeaderMap, [
      "SubjectName",
      "Subject",
      "subjectname"
    ], "")).trim();

    const moduleId = String(getTaskCell_(taskRows[i], taskHeaderMap, [
      "ModuleID",
      "ModuleId",
      "moduleid",
      "ModuletID"
    ], "")).trim();

    const moduleName = String(getTaskCell_(taskRows[i], taskHeaderMap, [
      "ModuleName",
      "Module",
      "modulename"
    ], "")).trim();

    const taskName = String(getTaskCell_(taskRows[i], taskHeaderMap, [
      "TaskName",
      "Task",
      "taskname"
    ], taskId)).trim();

    const active = getTaskCell_(taskRows[i], taskHeaderMap, [
      "Active",
      "Status"
    ], true);

    if (!taskId) continue;
    if (!subjectId) continue;
    if (!isTaskActiveValue_(active)) continue;
    if (requestedSubjectId !== "ALL" && subjectId !== requestedSubjectId) continue;

    activeTasks.push({
      taskid: taskId,
      subjectid: subjectId,
      subjectname: subjectName,
      moduleid: moduleId,
      modulename: moduleName,
      taskname: taskName
    });
  }

  let missingCount = 0;
  let skippedDuplicate = 0;

  activeStudents.forEach(student => {
    activeTasks.forEach(task => {
      const pairKey = student.studentid + "|" + task.taskid;

      if (existingPairs.has(pairKey)) {
        skippedDuplicate++;
      } else {
        missingCount++;
      }
    });
  });

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      message: "Dry run completed. No rows were added.",
      activeStudentCount: activeStudents.length,
      activeTaskCount: activeTasks.length,
      existingAssignmentCount: existingPairs.size,
      rowsThatWouldBeAdded: missingCount,
      skippedDuplicate: skippedDuplicate
    };
  }

  if (missingCount === 0) {
    return {
      success: true,
      dryRun: false,
      message: "No missing StudentTasks to add.",
      activeStudentCount: activeStudents.length,
      activeTaskCount: activeTasks.length,
      existingAssignmentCount: existingPairs.size,
      rowsAdded: 0,
      skippedDuplicate: skippedDuplicate
    };
  }

  const newIds = reserveStudentTaskIds_(missingCount);
  let nextIdIndex = 0;

  const now = new Date().toISOString();
  const rowsToAdd = [];
  const livePairs = new Set(existingPairs);

  activeStudents.forEach(student => {
    activeTasks.forEach(task => {
      const pairKey = student.studentid + "|" + task.taskid;

      if (livePairs.has(pairKey)) {
        return;
      }

      livePairs.add(pairKey);

      const newRow = new Array(studentTaskHeaders.length).fill("");

      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"], newIds[nextIdIndex++]);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["StudentID", "StudentId", "studentid"], student.studentid);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["TaskID", "TaskId", "taskid"], task.taskid);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["SubjectID", "SubjectId", "subjectid"], task.subjectid);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["SubjectName", "Subject", "subjectname"], task.subjectname);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["ModuleID", "ModuleId", "moduleid", "ModuletID"], task.moduleid);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["ModuleName", "Module", "modulename"], task.modulename);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["TaskName", "Task", "taskname"], task.taskname);

      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["CompleteStatus", "Complete", "Completed", "completestatus"], "");
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["CompleteDate", "CompletedDate", "completedate"], "");
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["VerifyStatus", "Verified", "verifystatus"], "");
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["VerifyDate", "VerifiedDate", "verifydate"], "");

      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["AssignedBy", "assignedby"], assignedBy);
      setBulkStudentTaskCell_(newRow, studentTaskHeaderMap, ["AssignedDate", "assigneddate"], now);

      rowsToAdd.push(newRow);
    });
  });

  if (rowsToAdd.length > 0) {
    studentTaskSheet
      .getRange(
        studentTaskSheet.getLastRow() + 1,
        1,
        rowsToAdd.length,
        studentTaskHeaders.length
      )
      .setValues(rowsToAdd);
  }

  return {
    success: true,
    dryRun: false,
    message: "StudentTasks populated successfully.",
    activeStudentCount: activeStudents.length,
    activeTaskCount: activeTasks.length,
    existingAssignmentCount: existingPairs.size,
    rowsAdded: rowsToAdd.length,
    skippedDuplicate: skippedDuplicate
  };
}

function setBulkStudentTaskCell_(row, headerMap, possibleHeaders, value) {
  const col = findTaskColumn_(headerMap, possibleHeaders);
  if (col !== -1) {
    row[col] = value;
  }
}

function reserveStudentTaskIds_(count) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SystemConfig");

  if (!sheet) {
    throw new Error("SystemConfig sheet not found");
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim() === "NextStudentTaskNumber") {
      const current = Number(data[i][1]);

      if (!current || current < 1) {
        throw new Error("NextStudentTaskNumber is invalid");
      }

      const ids = [];

      for (let n = 0; n < count; n++) {
        ids.push("STASK" + (current + n));
      }

      sheet.getRange(i + 1, 2).setValue(current + count);

      return ids;
    }
  }

  throw new Error("NextStudentTaskNumber not found");
}

function testPopulateAllStudentTasksDryRun() {
  const result = populateAllStudentTasks({
    assignedBy: "SYSTEM",
    classgroup: "ALL",
    subjectid: "ALL",
    dryRun: true
  });

  Logger.log(JSON.stringify(result, null, 2));
}

function testPopulateAllStudentTasksReal() {
  const result = populateAllStudentTasks({
    assignedBy: "SYSTEM",
    classgroup: "ALL",
    subjectid: "ALL",
    dryRun: false
  });

  Logger.log(JSON.stringify(result, null, 2));
}


function normalizeHeaderKeyForTasks_(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildHeaderMapForTasks_(headers) {
  const map = {};
  headers.forEach((header, index) => {
    const key = normalizeHeaderKeyForTasks_(header);
    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });
  return map;
}

function findTaskColumn_(headerMap, possibleHeaders) {
  for (let i = 0; i < possibleHeaders.length; i++) {
    const key = normalizeHeaderKeyForTasks_(possibleHeaders[i]);
    if (headerMap[key] !== undefined) {
      return headerMap[key];
    }
  }
  return -1;
}

function getTaskCell_(row, headerMap, possibleHeaders, fallback) {
  const col = findTaskColumn_(headerMap, possibleHeaders);
  if (col === -1) {
    return fallback === undefined ? "" : fallback;
  }
  const value = row[col];
  if (value === undefined || value === null) {
    return fallback === undefined ? "" : fallback;
  }
  return value;
}

function setTaskCell_(sheet, rowNumber, headerMap, possibleHeaders, value) {
  const col = findTaskColumn_(headerMap, possibleHeaders);
  if (col === -1) {
    throw new Error("Missing required column: " + possibleHeaders[0]);
  }
  sheet.getRange(rowNumber, col + 1).setValue(value);
}

function isTaskActiveValue_(value) {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (value === true) {
    return true;
  }
  const text = String(value).trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes" || text === "active";
}

function buildSubjectLookupForTasks_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("SubjectList");
  const rows = sheet.getDataRange().getValues();
  const headerMap = buildHeaderMapForTasks_(rows[0] || []);
  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const subjectid = String(getTaskCell_(rows[i], headerMap, ["SubjectID", "SubjectId", "subjectid"])).trim();
    if (!subjectid) continue;

    map[subjectid] = {
      subjectid,
      subjectname: getTaskCell_(rows[i], headerMap, ["SubjectName", "Subject", "subjectname"], subjectid),
      active: getTaskCell_(rows[i], headerMap, ["Active", "Status"], true)
    };
  }

  return map;
}

function buildTaskLookupForTasks_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("TaskList");
  const rows = sheet.getDataRange().getValues();
  const headerMap = buildHeaderMapForTasks_(rows[0] || []);
  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const taskid = String(getTaskCell_(rows[i], headerMap, ["TaskID", "TaskId", "taskid"])).trim();
    if (!taskid) continue;

    map[taskid] = {
      taskid,
      subjectid: String(getTaskCell_(rows[i], headerMap, ["SubjectID", "SubjectId", "subjectid"])).trim(),
      subjectname: getTaskCell_(rows[i], headerMap, ["SubjectName", "Subject", "subjectname"], ""),
      moduleid: String(getTaskCell_(rows[i], headerMap, ["ModuleID", "ModuleId", "moduleid", "ModuletID"])).trim(),
      modulename: getTaskCell_(rows[i], headerMap, ["ModuleName", "Module", "modulename"], ""),
      taskname: getTaskCell_(rows[i], headerMap, ["TaskName", "Task", "taskname"], taskid),
      audiolink: getTaskCell_(rows[i], headerMap, ["AudioLink", "Audio", "audiolink"], ""),
      graphiclink: getTaskCell_(rows[i], headerMap, ["GraphicLink", "GraphicsLink", "Graphic", "ImageLink", "graphiclink"], ""),
      visuallink: getTaskCell_(rows[i], headerMap, ["VisualLink", "Visual", "visuallink"], ""),
      videolink: getTaskCell_(rows[i], headerMap, ["VideoLink", "Video", "videolink"], ""),
      pdflink: getTaskCell_(rows[i], headerMap, ["PDFLink", "PdfLink", "PDF", "pdflink"], ""),
      active: getTaskCell_(rows[i], headerMap, ["Active", "Status"], true)
    };
  }

  return map;
}

function buildStudentLookupForTasks_(requestedStudentId, requestedGroup) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("StudentRecords");
  const rows = sheet.getDataRange().getValues();
  const headerMap = buildHeaderMapForTasks_(rows[0] || []);
  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const studentid = String(getTaskCell_(rows[i], headerMap, ["StudentID", "StudentId", "studentid"])).trim();
    const username = getTaskCell_(rows[i], headerMap, ["Username", "Name", "StudentName"], "");
    const classgroup = String(getTaskCell_(rows[i], headerMap, ["classgroup", "ClassGroup", "Group", "GroupNo"], "")).trim();
    const active = getTaskCell_(rows[i], headerMap, ["Active", "Status"], true);

    if (!studentid) continue;
    if (!isTaskActiveValue_(active)) continue;
    if (classgroup === "0") continue;
    if (requestedStudentId && requestedStudentId !== "ALL" && studentid !== requestedStudentId) continue;
    if (requestedGroup && requestedGroup !== "ALL" && classgroup !== requestedGroup) continue;

    map[studentid] = {
      studentid,
      username,
      classgroup,
      active
    };
  }

  return map;
}

function getStudentTaskSheetRows_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("StudentTasks");
  const rows = sheet.getDataRange().getValues();
  const headerMap = buildHeaderMapForTasks_(rows[0] || []);
  return { sheet, rows, headerMap };
}

function getStudentTasks(data) {
  const studentId = String(data.studentid || "").trim();
  const subjectIdFilter = String(data.subjectid || "ALL").trim();

  if (!studentId) {
    return {
      success: false,
      error: "Missing studentid"
    };
  }

  const taskMap = buildTaskLookupForTasks_();
  const subjectMap = buildSubjectLookupForTasks_();
  const taskResourcesMap = getActiveTaskResourcesMap();
  const studentTaskData = getStudentTaskSheetRows_();
  const rows = studentTaskData.rows;
  const headerMap = studentTaskData.headerMap;

  const tasks = [];

  for (let i = 1; i < rows.length; i++) {
    const rowStudentId = String(getTaskCell_(rows[i], headerMap, ["StudentID", "StudentId", "studentid"])).trim();
    const rowTaskId = String(getTaskCell_(rows[i], headerMap, ["TaskID", "TaskId", "taskid"])).trim();

    if (rowStudentId !== studentId) {
      continue;
    }

    const task = taskMap[rowTaskId];

    if (!task) {
      continue;
    }

    // TaskList is the source of truth for subject/module/task display.
    const taskSubjectId = String(task.subjectid || getTaskCell_(rows[i], headerMap, ["SubjectID", "SubjectId", "subjectid"])).trim();

    if (subjectIdFilter !== "ALL" && taskSubjectId !== subjectIdFilter) {
      continue;
    }

    const subject = subjectMap[taskSubjectId] || {};
    const completeStatus = getTaskCell_(rows[i], headerMap, ["CompleteStatus", "Complete", "Completed", "completestatus"], "");
    const verifyStatus = getTaskCell_(rows[i], headerMap, ["VerifyStatus", "Verified", "verifystatus"], "");

    tasks.push({
      studenttaskid: getTaskCell_(rows[i], headerMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"], ""),
      studentid: rowStudentId,
      taskid: rowTaskId,
      subjectid: taskSubjectId,
      subjectname: task.subjectname || subject.subjectname || taskSubjectId,
      moduleid: task.moduleid || String(getTaskCell_(rows[i], headerMap, ["ModuleID", "ModuleId", "moduleid"])).trim(),
      modulename: task.modulename || getTaskCell_(rows[i], headerMap, ["ModuleName", "Module", "modulename"], ""),
      taskname: task.taskname,
      completestatus: completeStatus,
      completedate: getTaskCell_(rows[i], headerMap, ["CompleteDate", "CompletedDate", "completedate"], ""),
      verifystatus: verifyStatus,
      verifydate: getTaskCell_(rows[i], headerMap, ["VerifyDate", "VerifiedDate", "verifydate"], ""),

      displayCompleteStatus: completeStatus ? completeStatus : "to be completed",
      displayVerifyStatus: verifyStatus ? verifyStatus : "not verified",

      audiolink: task.audiolink,
      graphiclink: task.graphiclink,
      visuallink: task.visuallink,
      videolink: task.videolink,
      pdflink: task.pdflink,
      resources: taskResourcesMap[rowTaskId] || [],

      assignedby: getTaskCell_(rows[i], headerMap, ["AssignedBy", "assignedby"], ""),
      assigneddate: getTaskCell_(rows[i], headerMap, ["AssignedDate", "assigneddate"], "")
    });
  }

  tasks.sort((a, b) => {
    const subjectCompare = String(a.subjectname || "").localeCompare(String(b.subjectname || ""), undefined, { numeric: true, sensitivity: "base" });
    if (subjectCompare !== 0) return subjectCompare;

    const moduleCompare = String(a.modulename || "").localeCompare(String(b.modulename || ""), undefined, { numeric: true, sensitivity: "base" });
    if (moduleCompare !== 0) return moduleCompare;

    return String(a.taskname || "").localeCompare(String(b.taskname || ""), undefined, { numeric: true, sensitivity: "base" });
  });

  return {
    success: true,
    studentid: studentId,
    subjectid: subjectIdFilter,
    count: tasks.length,
    tasks
  };
}
function hasOwnProgressStatusField_(source, key) {
  return !!source && Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeProgressCompleteStatus_(value) {
  if (value === true) return "COMPLETE";
  if (value === false || value === null || value === undefined) return "";

  const text = String(value || "").trim();
  if (!text) return "";

  const normalized = text.toLowerCase();
  if (["true", "1", "yes", "y", "complete", "completed"].indexOf(normalized) !== -1) {
    return "COMPLETE";
  }
  if (["false", "0", "no", "n", "blank", "clear", "incomplete"].indexOf(normalized) !== -1) {
    return "";
  }

  return text;
}

function normalizeProgressVerifyStatus_(value) {
  if (value === true) return "VERIFIED";
  if (value === false || value === null || value === undefined) return "";

  const text = String(value || "").trim();
  if (!text) return "";

  const normalized = text.toLowerCase();
  if (["true", "1", "yes", "y", "verify", "verified"].indexOf(normalized) !== -1) {
    return "VERIFIED";
  }
  if (["false", "0", "no", "n", "blank", "clear", "unverified", "not verified"].indexOf(normalized) !== -1) {
    return "";
  }

  return text;
}

function normalizeStudentTaskStatusUpdates_(data) {
  const sourceRows = Array.isArray(data)
    ? data
    : (data && Array.isArray(data.updates) ? data.updates : [data || {}]);

  const updates = [];
  const errors = [];

  sourceRows.forEach((row, index) => {
    const source = row || {};
    const studentTaskId = String(
      source.studenttaskid ||
      source.studentTaskId ||
      source.StudentTaskID ||
      ""
    ).trim();

    if (!studentTaskId) {
      errors.push({ index: index, error: "Missing studenttaskid" });
      return;
    }

    const update = {
      studenttaskid: studentTaskId,
      index: index
    };

    if (hasOwnProgressStatusField_(source, "completeStatus")) {
      update.completeStatus = normalizeProgressCompleteStatus_(source.completeStatus);
    } else if (hasOwnProgressStatusField_(source, "complete")) {
      update.completeStatus = normalizeProgressCompleteStatus_(source.complete);
    }

    if (hasOwnProgressStatusField_(source, "verifyStatus")) {
      update.verifyStatus = normalizeProgressVerifyStatus_(source.verifyStatus);
    } else if (hasOwnProgressStatusField_(source, "verified")) {
      update.verifyStatus = normalizeProgressVerifyStatus_(source.verified);
    }

    if (!hasOwnProgressStatusField_(update, "completeStatus") && !hasOwnProgressStatusField_(update, "verifyStatus")) {
      errors.push({ index: index, studenttaskid: studentTaskId, error: "No progress status supplied" });
      return;
    }

    updates.push(update);
  });

  return {
    updates: updates,
    errors: errors,
    isBatch: Array.isArray(data) || !!(data && Array.isArray(data.updates))
  };
}

function canActorUpdateStudentTaskStatus_(actor, task) {
  if (!actor || !actor.type) {
    return { ok: true };
  }

  if (actor.type === "student") {
    if (String(task.studentid || "") !== String(actor.studentid || "")) {
      return { ok: false, error: "Forbidden" };
    }
    return { ok: true };
  }

  if (actor.type === "admin") {
    if (String(actor.role || "") === "TEACHER" && String(task.classgroup || "") !== String(actor.assignedgroup || "")) {
      return { ok: false, error: "Forbidden" };
    }
    return { ok: true };
  }

  return { ok: false, error: "Unauthorized" };
}

function studentTaskColumnToA1_(columnNumber) {
  let value = Number(columnNumber);
  let letters = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}

function applyStudentTaskStatusCellUpdates_(sheet, cellUpdates) {
  const groups = {};
  const groupOrder = [];

  cellUpdates.forEach(change => {
    const key = JSON.stringify([typeof change.value, change.value]);

    if (!groups[key]) {
      groups[key] = {
        value: change.value,
        ranges: []
      };
      groupOrder.push(key);
    }

    groups[key].ranges.push(
      studentTaskColumnToA1_(change.columnIndex + 1) + String(change.rowIndex + 1)
    );
  });

  groupOrder.forEach(key => {
    const group = groups[key];
    sheet.getRangeList(group.ranges).setValue(group.value);
  });
}

function buildStudentTaskStatusValidationFailure_(normalized, validationErrors, message) {
  const firstError = validationErrors[0] || {};
  const errorByIndex = {};

  validationErrors.forEach(item => {
    if (item && item.index !== undefined && errorByIndex[item.index] === undefined) {
      errorByIndex[item.index] = item.error || "Invalid progress update";
    }
  });

  const results = normalized.updates.map(update => ({
    success: false,
    index: update.index,
    studenttaskid: update.studenttaskid,
    error: errorByIndex[update.index] || "Batch not applied because another update failed"
  }));

  const response = {
    success: false,
    error: firstError.error || message || "Invalid progress update",
    message: message || "No student task progress was updated",
    errors: validationErrors,
    updatedCount: 0,
    failedCount: normalized.updates.length || validationErrors.length,
    results: results
  };

  if (!normalized.isBatch && results.length === 1) {
    response.studenttaskid = results[0].studenttaskid;
  }

  return response;
}

function updateStudentTaskStatus(data) {
  const normalized = normalizeStudentTaskStatusUpdates_(data);

  if (normalized.errors.length > 0) {
    return {
      success: false,
      error: normalized.errors[0].error || "Invalid progress update",
      errors: normalized.errors,
      updatedCount: 0,
      failedCount: normalized.errors.length
    };
  }

  const requestedIdIndexes = {};
  const duplicateRequestErrors = [];

  normalized.updates.forEach(update => {
    if (requestedIdIndexes[update.studenttaskid] !== undefined) {
      duplicateRequestErrors.push({
        index: update.index,
        studenttaskid: update.studenttaskid,
        error: "Duplicate studenttaskid in request"
      });
    } else {
      requestedIdIndexes[update.studenttaskid] = update.index;
    }
  });

  if (duplicateRequestErrors.length > 0) {
    return buildStudentTaskStatusValidationFailure_(
      normalized,
      duplicateRequestErrors,
      "No student task progress was updated"
    );
  }

  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(10000);

    if (!lockAcquired) {
      return {
        success: false,
        error: "Progress update busy. Please retry.",
        updatedCount: 0,
        failedCount: normalized.updates.length
      };
    }

    const actor = data && data.actor ? data.actor : null;
    const studentTaskData = getStudentTaskSheetRows_();
    const sheet = studentTaskData.sheet;
    const rows = studentTaskData.rows;
    const headerMap = studentTaskData.headerMap;
    const studentMap = buildStudentLookupForTasks_("ALL", "ALL");

    const studentTaskIdCol = findTaskColumn_(headerMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"]);
    const studentIdCol = findTaskColumn_(headerMap, ["StudentID", "StudentId", "studentid"]);
    const taskIdCol = findTaskColumn_(headerMap, ["TaskID", "TaskId", "taskid"]);
    const completeStatusCol = findTaskColumn_(headerMap, ["CompleteStatus", "Complete", "Completed", "completestatus"]);
    const completeDateCol = findTaskColumn_(headerMap, ["CompleteDate", "CompletedDate", "completedate"]);
    const verifyStatusCol = findTaskColumn_(headerMap, ["VerifyStatus", "Verified", "verifystatus"]);
    const verifyDateCol = findTaskColumn_(headerMap, ["VerifyDate", "VerifiedDate", "verifydate"]);

    if (studentTaskIdCol === -1) {
      return { success: false, error: "Missing required column: StudentTaskID", updatedCount: 0, failedCount: normalized.updates.length };
    }

    const needsComplete = normalized.updates.some(update => hasOwnProgressStatusField_(update, "completeStatus"));
    const needsVerify = normalized.updates.some(update => hasOwnProgressStatusField_(update, "verifyStatus"));

    if (needsComplete && (completeStatusCol === -1 || completeDateCol === -1)) {
      return { success: false, error: "Missing required complete status/date column", updatedCount: 0, failedCount: normalized.updates.length };
    }

    if (needsVerify && (verifyStatusCol === -1 || verifyDateCol === -1)) {
      return { success: false, error: "Missing required verify status/date column", updatedCount: 0, failedCount: normalized.updates.length };
    }

    const rowByStudentTaskId = {};
    const duplicateSheetIds = {};

    for (let i = 1; i < rows.length; i++) {
      const rowStudentTaskId = String(rows[i][studentTaskIdCol] || "").trim();

      if (!rowStudentTaskId || requestedIdIndexes[rowStudentTaskId] === undefined) {
        continue;
      }

      if (rowByStudentTaskId[rowStudentTaskId] !== undefined) {
        duplicateSheetIds[rowStudentTaskId] = true;
      } else {
        rowByStudentTaskId[rowStudentTaskId] = i;
      }
    }

    const now = new Date().toISOString();
    const validationErrors = [];
    const pendingUpdates = [];
    const results = [];

    normalized.updates.forEach(update => {
      const rowIndex = rowByStudentTaskId[update.studenttaskid];

      if (duplicateSheetIds[update.studenttaskid]) {
        validationErrors.push({
          index: update.index,
          studenttaskid: update.studenttaskid,
          error: "Duplicate StudentTaskID in StudentTasks sheet"
        });
        return;
      }

      if (rowIndex === undefined) {
        validationErrors.push({
          index: update.index,
          studenttaskid: update.studenttaskid,
          error: "Student task not found"
        });
        return;
      }

      const row = rows[rowIndex];
      const studentId = studentIdCol === -1 ? "" : String(row[studentIdCol] || "").trim();
      const student = studentMap[studentId] || {};
      const task = {
        studenttaskid: update.studenttaskid,
        studentid: studentId,
        classgroup: student.classgroup || ""
      };

      if (actor && actor.type === "student" && hasOwnProgressStatusField_(update, "verifyStatus")) {
        validationErrors.push({
          index: update.index,
          studenttaskid: update.studenttaskid,
          error: "Students cannot verify tasks"
        });
        return;
      }

      const permission = canActorUpdateStudentTaskStatus_(actor, task);
      if (!permission.ok) {
        validationErrors.push({
          index: update.index,
          studenttaskid: update.studenttaskid,
          error: permission.error || "Forbidden"
        });
        return;
      }

      if (hasOwnProgressStatusField_(update, "completeStatus")) {
        pendingUpdates.push({ rowIndex: rowIndex, columnIndex: completeStatusCol, value: update.completeStatus });
        pendingUpdates.push({ rowIndex: rowIndex, columnIndex: completeDateCol, value: update.completeStatus ? now : "" });
      }

      if (hasOwnProgressStatusField_(update, "verifyStatus")) {
        pendingUpdates.push({ rowIndex: rowIndex, columnIndex: verifyStatusCol, value: update.verifyStatus });
        pendingUpdates.push({ rowIndex: rowIndex, columnIndex: verifyDateCol, value: update.verifyStatus ? now : "" });
      }

      results.push({
        success: true,
        index: update.index,
        studenttaskid: update.studenttaskid,
        studentid: studentId,
        taskid: taskIdCol === -1 ? "" : row[taskIdCol]
      });
    });

    if (validationErrors.length > 0) {
      return buildStudentTaskStatusValidationFailure_(
        normalized,
        validationErrors,
        "No student task progress was updated"
      );
    }

    applyStudentTaskStatusCellUpdates_(sheet, pendingUpdates);

    const response = {
      success: true,
      message: "Student task progress updated successfully",
      updatedCount: normalized.updates.length,
      failedCount: 0,
      results: results
    };

    if (!normalized.isBatch && results.length === 1) {
      response.studenttaskid = results[0].studenttaskid;
      response.studentid = results[0].studentid || "";
      response.taskid = results[0].taskid || "";
    }

    return response;
  } catch (error) {
    return {
      success: false,
      error: error && error.message ? error.message : "Progress update failed",
      updatedCount: 0,
      failedCount: normalized.updates.length
    };
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}
function getStudentTaskById(studentTaskId) {
  const studentTaskData = getStudentTaskSheetRows_();
  const rows = studentTaskData.rows;
  const headerMap = studentTaskData.headerMap;
  const studentMap = buildStudentLookupForTasks_("ALL", "ALL");

  const targetId = String(studentTaskId || "").trim();

  for (let i = 1; i < rows.length; i++) {
    const rowStudentTaskId = String(getTaskCell_(rows[i], headerMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"])).trim();

    if (rowStudentTaskId === targetId) {
      const studentId = String(getTaskCell_(rows[i], headerMap, ["StudentID", "StudentId", "studentid"])).trim();
      const student = studentMap[studentId] || {};

      return {
        studenttaskid: rowStudentTaskId,
        studentid: studentId,
        taskid: getTaskCell_(rows[i], headerMap, ["TaskID", "TaskId", "taskid"], ""),
        moduleid: getTaskCell_(rows[i], headerMap, ["ModuleID", "ModuleId", "moduleid"], ""),
        modulename: getTaskCell_(rows[i], headerMap, ["ModuleName", "Module", "modulename"], ""),
        subjectid: getTaskCell_(rows[i], headerMap, ["SubjectID", "SubjectId", "subjectid"], ""),
        completestatus: getTaskCell_(rows[i], headerMap, ["CompleteStatus", "Complete", "Completed", "completestatus"], ""),
        completedate: getTaskCell_(rows[i], headerMap, ["CompleteDate", "CompletedDate", "completedate"], ""),
        verifystatus: getTaskCell_(rows[i], headerMap, ["VerifyStatus", "Verified", "verifystatus"], ""),
        verifydate: getTaskCell_(rows[i], headerMap, ["VerifyDate", "VerifiedDate", "verifydate"], ""),
        assignedby: getTaskCell_(rows[i], headerMap, ["AssignedBy", "assignedby"], ""),
        assigneddate: getTaskCell_(rows[i], headerMap, ["AssignedDate", "assigneddate"], ""),
        username: student.username || "",
        classgroup: student.classgroup || "",
        active: student.active
      };
    }
  }

  return null;
}
function getTaskProgressReport(data) {
  const requestedStudentId = String(data.studentid || "ALL").trim();
  const requestedGroup = String(data.classgroup || "ALL").trim();
  const requestedSubjectId = String(data.subjectid || "ALL").trim();

  const activeStudents = buildStudentLookupForTasks_(requestedStudentId, requestedGroup);
  const taskMap = buildTaskLookupForTasks_();
  const subjectMap = buildSubjectLookupForTasks_();
  const studentTaskData = getStudentTaskSheetRows_();
  const rows = studentTaskData.rows;
  const headerMap = studentTaskData.headerMap;

  const studentProgressMap = {};
  const subjectProgressMap = {};
  const groupProgressMap = {};

  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalVerified = 0;

  for (let i = 1; i < rows.length; i++) {
    const studenttaskid = String(getTaskCell_(rows[i], headerMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"])).trim();
    const studentid = String(getTaskCell_(rows[i], headerMap, ["StudentID", "StudentId", "studentid"])).trim();
    const taskid = String(getTaskCell_(rows[i], headerMap, ["TaskID", "TaskId", "taskid"])).trim();
    const completeStatus = String(getTaskCell_(rows[i], headerMap, ["CompleteStatus", "Complete", "Completed", "completestatus"], "") || "").trim();
    const verifyStatus = String(getTaskCell_(rows[i], headerMap, ["VerifyStatus", "Verified", "verifystatus"], "") || "").trim();

    const student = activeStudents[studentid];
    if (!student) continue;

    const task = taskMap[taskid];
    if (!task) continue;

    const subjectid = String(task.subjectid || getTaskCell_(rows[i], headerMap, ["SubjectID", "SubjectId", "subjectid"], "")).trim();
    if (requestedSubjectId !== "ALL" && subjectid !== requestedSubjectId) continue;

    const subject = subjectMap[subjectid] || {};
    const subjectname = task.subjectname || subject.subjectname || subjectid;
    const completed = completeStatus !== "";
    const verified = verifyStatus !== "";

    totalAssigned++;
    if (completed) totalCompleted++;
    if (verified) totalVerified++;

    if (!studentProgressMap[studentid]) {
      studentProgressMap[studentid] = {
        studentid,
        username: student.username,
        classgroup: student.classgroup,
        assignedCount: 0,
        completedCount: 0,
        verifiedCount: 0,
        subjects: {}
      };
    }

    studentProgressMap[studentid].assignedCount++;
    if (completed) studentProgressMap[studentid].completedCount++;
    if (verified) studentProgressMap[studentid].verifiedCount++;

    if (!studentProgressMap[studentid].subjects[subjectid]) {
      studentProgressMap[studentid].subjects[subjectid] = {
        subjectid,
        subjectname,
        assignedCount: 0,
        completedCount: 0,
        verifiedCount: 0
      };
    }

    studentProgressMap[studentid].subjects[subjectid].assignedCount++;
    if (completed) studentProgressMap[studentid].subjects[subjectid].completedCount++;
    if (verified) studentProgressMap[studentid].subjects[subjectid].verifiedCount++;

    const groupKey = student.classgroup || "Ungrouped";
    if (!groupProgressMap[groupKey]) {
      groupProgressMap[groupKey] = {
        classgroup: groupKey,
        assignedCount: 0,
        completedCount: 0,
        verifiedCount: 0
      };
    }

    groupProgressMap[groupKey].assignedCount++;
    if (completed) groupProgressMap[groupKey].completedCount++;
    if (verified) groupProgressMap[groupKey].verifiedCount++;

    if (!subjectProgressMap[subjectid]) {
      subjectProgressMap[subjectid] = {
        subjectid,
        subjectname,
        assignedCount: 0,
        completedCount: 0,
        verifiedCount: 0
      };
    }

    subjectProgressMap[subjectid].assignedCount++;
    if (completed) subjectProgressMap[subjectid].completedCount++;
    if (verified) subjectProgressMap[subjectid].verifiedCount++;
  }

  const students = Object.values(studentProgressMap).map(student => {
    const subjects = Object.values(student.subjects).map(subject => ({
      ...subject,
      completedPercent: percent(subject.completedCount, subject.assignedCount),
      verifiedPercent: percent(subject.verifiedCount, subject.assignedCount)
    }));

    subjects.sort((a, b) => {
    const subjectIdCompare = String(a.subjectid || "").localeCompare(String(b.subjectid || ""), undefined, { numeric: true, sensitivity: "base" });
    if (subjectIdCompare !== 0) return subjectIdCompare;
    return String(a.subjectname).localeCompare(String(b.subjectname), undefined, { numeric: true, sensitivity: "base" });
  });

    return {
      studentid: student.studentid,
      username: student.username,
      classgroup: student.classgroup,
      assignedCount: student.assignedCount,
      completedCount: student.completedCount,
      verifiedCount: student.verifiedCount,
      completedPercent: percent(student.completedCount, student.assignedCount),
      verifiedPercent: percent(student.verifiedCount, student.assignedCount),
      subjects
    };
  });

  students.sort((a, b) => {
    const groupCompare = String(a.classgroup).localeCompare(String(b.classgroup), undefined, { numeric: true, sensitivity: "base" });
    if (groupCompare !== 0) return groupCompare;
    return String(a.username).localeCompare(String(b.username), undefined, { numeric: true, sensitivity: "base" });
  });

  const groups = Object.values(groupProgressMap).map(group => ({
    ...group,
    completedPercent: percent(group.completedCount, group.assignedCount),
    verifiedPercent: percent(group.verifiedCount, group.assignedCount)
  }));

  groups.sort((a, b) => String(a.classgroup).localeCompare(String(b.classgroup), undefined, { numeric: true, sensitivity: "base" }));

  const subjects = Object.values(subjectProgressMap).map(subject => ({
    ...subject,
    completedPercent: percent(subject.completedCount, subject.assignedCount),
    verifiedPercent: percent(subject.verifiedCount, subject.assignedCount)
  }));

  subjects.sort((a, b) => {
    const subjectIdCompare = String(a.subjectid || "").localeCompare(String(b.subjectid || ""), undefined, { numeric: true, sensitivity: "base" });
    if (subjectIdCompare !== 0) return subjectIdCompare;
    return String(a.subjectname).localeCompare(String(b.subjectname), undefined, { numeric: true, sensitivity: "base" });
  });

  return {
    success: true,
    filters: {
      studentid: requestedStudentId,
      classgroup: requestedGroup,
      subjectid: requestedSubjectId
    },
    summary: {
      assignedCount: totalAssigned,
      completedCount: totalCompleted,
      verifiedCount: totalVerified,
      completedPercent: percent(totalCompleted, totalAssigned),
      verifiedPercent: percent(totalVerified, totalAssigned)
    },
    groups,
    subjects,
    students
  };
}
function percent(part, total) {
  if (!total || total === 0) {
    return 0;
  }

  return Math.round((part / total) * 1000) / 10;
}

function getTaskProgressDetail(data) {
  const requestedStudentId = String(data.studentid || "ALL").trim();
  const requestedGroup = String(data.classgroup || "ALL").trim();
  // This value is kept as "subjectid" for Worker/API compatibility,
  // but the progress UI now uses it as the selected ModuleID.
  const requestedModuleId = String(data.subjectid || "ALL").trim();
  const requestedTaskId = String(data.taskid || "ALL").trim();

  const activeStudents = buildStudentLookupForTasks_(requestedStudentId, requestedGroup);
  const taskMap = buildTaskLookupForTasks_();
  const subjectMap = buildSubjectLookupForTasks_();
  const studentTaskData = getStudentTaskSheetRows_();
  const rows = studentTaskData.rows;
  const headerMap = studentTaskData.headerMap;

  const moduleSummaryMap = {};
  const taskSummaryMap = {};
  const studentTaskDetails = [];

  for (let i = 1; i < rows.length; i++) {
    const studenttaskid = String(getTaskCell_(rows[i], headerMap, ["StudentTaskID", "StudentTaskId", "studenttaskid"])).trim();
    const studentid = String(getTaskCell_(rows[i], headerMap, ["StudentID", "StudentId", "studentid"])).trim();
    const taskid = String(getTaskCell_(rows[i], headerMap, ["TaskID", "TaskId", "taskid"])).trim();

    const student = activeStudents[studentid];
    if (!student) continue;

    const task = taskMap[taskid];
    if (!task) continue;

    const subjectid = String(task.subjectid || getTaskCell_(rows[i], headerMap, ["SubjectID", "SubjectId", "subjectid"], "")).trim();
    const subject = subjectMap[subjectid] || {};
    const subjectname = task.subjectname || subject.subjectname || subjectid;

    const moduleid = String(task.moduleid || getTaskCell_(rows[i], headerMap, ["ModuleID", "ModuleId", "moduleid"], "") || subjectid || "GENERAL").trim();
    const modulename = String(task.modulename || getTaskCell_(rows[i], headerMap, ["ModuleName", "Module", "modulename"], "") || subjectname || "General").trim();

    if (requestedModuleId !== "ALL" && moduleid !== requestedModuleId) continue;
    if (requestedTaskId !== "ALL" && taskid !== requestedTaskId) continue;

    const completestatus = String(getTaskCell_(rows[i], headerMap, ["CompleteStatus", "Complete", "Completed", "completestatus"], "") || "").trim();
    const completedate = getTaskCell_(rows[i], headerMap, ["CompleteDate", "CompletedDate", "completedate"], "");
    const verifystatus = String(getTaskCell_(rows[i], headerMap, ["VerifyStatus", "Verified", "verifystatus"], "") || "").trim();
    const verifydate = getTaskCell_(rows[i], headerMap, ["VerifyDate", "VerifiedDate", "verifydate"], "");

    const completed = completestatus !== "";
    const verified = verifystatus !== "";

    if (!moduleSummaryMap[moduleid]) {
      moduleSummaryMap[moduleid] = {
        subjectid: moduleid,
        subjectname: modulename,
        moduleid,
        modulename,
        assignedCount: 0,
        completedCount: 0,
        verifiedCount: 0
      };
    }

    moduleSummaryMap[moduleid].assignedCount++;
    if (completed) moduleSummaryMap[moduleid].completedCount++;
    if (verified) moduleSummaryMap[moduleid].verifiedCount++;

    if (!taskSummaryMap[taskid]) {
      taskSummaryMap[taskid] = {
        taskid,
        taskname: task.taskname,
        subjectid,
        subjectname,
        moduleid,
        modulename,
        assignedCount: 0,
        completedCount: 0,
        verifiedCount: 0
      };
    }

    taskSummaryMap[taskid].assignedCount++;
    if (completed) taskSummaryMap[taskid].completedCount++;
    if (verified) taskSummaryMap[taskid].verifiedCount++;

    studentTaskDetails.push({
      studenttaskid,
      studentid,
      username: student.username,
      classgroup: student.classgroup,
      taskid,
      taskname: task.taskname,
      subjectid,
      subjectname,
      moduleid,
      modulename,
      completestatus,
      completedate,
      verifystatus,
      verifydate,
      displayCompleteStatus: completed ? "COMPLETE" : "to be completed",
      displayVerifyStatus: verified ? "VERIFIED" : "not verified"
    });
  }

  const subjects = Object.values(moduleSummaryMap).map(module => ({
    ...module,
    completedPercent: percent(module.completedCount, module.assignedCount),
    verifiedPercent: percent(module.verifiedCount, module.assignedCount)
  }));

  const tasks = Object.values(taskSummaryMap).map(task => ({
    ...task,
    completedPercent: percent(task.completedCount, task.assignedCount),
    verifiedPercent: percent(task.verifiedCount, task.assignedCount)
  }));

  subjects.sort((a, b) => {
    const moduleIdCompare = String(a.moduleid || "").localeCompare(String(b.moduleid || ""), undefined, { numeric: true, sensitivity: "base" });
    if (moduleIdCompare !== 0) return moduleIdCompare;
    return String(a.modulename || "").localeCompare(String(b.modulename || ""), undefined, { numeric: true, sensitivity: "base" });
  });

  tasks.sort((a, b) => {
    const moduleCompare = String(a.moduleid || "").localeCompare(String(b.moduleid || ""), undefined, { numeric: true, sensitivity: "base" });
    if (moduleCompare !== 0) return moduleCompare;
    const taskIdCompare = String(a.taskid || "").localeCompare(String(b.taskid || ""), undefined, { numeric: true, sensitivity: "base" });
    if (taskIdCompare !== 0) return taskIdCompare;
    return String(a.taskname).localeCompare(String(b.taskname), undefined, { numeric: true, sensitivity: "base" });
  });

  studentTaskDetails.sort((a, b) => {
    const groupCompare = String(a.classgroup).localeCompare(String(b.classgroup), undefined, { numeric: true, sensitivity: "base" });
    if (groupCompare !== 0) return groupCompare;
    return String(a.username).localeCompare(String(b.username), undefined, { numeric: true, sensitivity: "base" });
  });

  return {
    success: true,
    filters: {
      studentid: requestedStudentId,
      classgroup: requestedGroup,
      subjectid: requestedModuleId,
      moduleid: requestedModuleId,
      taskid: requestedTaskId
    },
    subjects,
    modules: subjects,
    tasks,
    students: studentTaskDetails
  };
}
function getActiveTaskResourcesMap() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const rows = sheet.getDataRange().getValues();
  const map = {};

  for (let i = 1; i < rows.length; i++) {
    const active = rows[i][5];

    if (active !== true) {
      continue;
    }

    const taskId = String(rows[i][1]).trim();

    if (!map[taskId]) {
      map[taskId] = [];
    }

    map[taskId].push({
      taskresourceid: rows[i][0],
      taskid: rows[i][1],
      taskresourcename: rows[i][2],
      resourcetype: rows[i][3],
      resourcelink: rows[i][4],
      active: rows[i][5],
      createdate: rows[i][6]
    });
  }

  Object.keys(map).forEach(taskId => {
    map[taskId].sort((a, b) => {
      return String(a.taskresourcename).localeCompare(String(b.taskresourcename));
    });
  });

  return map;
}

function findTaskResourceByTaskAndName(taskId, taskResourceName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const rows = sheet.getDataRange().getValues();

  const targetTaskId = String(taskId || "").trim();
  const targetResourceName = normalizeText(taskResourceName);

  for (let i = 1; i < rows.length; i++) {
    const rowTaskId = String(rows[i][1]).trim();
    const rowResourceName = normalizeText(rows[i][2]);

    if (
      rowTaskId === targetTaskId &&
      rowResourceName === targetResourceName
    ) {
      return {
        row: i + 1,
        taskresourceid: rows[i][0],
        taskid: rows[i][1],
        taskresourcename: rows[i][2],
        resourcetype: rows[i][3],
        resourcelink: rows[i][4],
        active: rows[i][5],
        createdate: rows[i][6]
      };
    }
  }

  return null;
}

function findTaskResourceByTaskAndNameExcludingId(taskId, taskResourceName, taskResourceId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("TaskResources");

  const rows = sheet.getDataRange().getValues();

  const targetTaskId = String(taskId || "").trim();
  const targetResourceName = normalizeText(taskResourceName);
  const excludeResourceId = String(taskResourceId || "").trim();

  for (let i = 1; i < rows.length; i++) {
    const rowResourceId = String(rows[i][0]).trim();
    const rowTaskId = String(rows[i][1]).trim();
    const rowResourceName = normalizeText(rows[i][2]);

    if (
      rowResourceId !== excludeResourceId &&
      rowTaskId === targetTaskId &&
      rowResourceName === targetResourceName
    ) {
      return {
        row: i + 1,
        taskresourceid: rows[i][0],
        taskid: rows[i][1],
        taskresourcename: rows[i][2],
        resourcetype: rows[i][3],
        resourcelink: rows[i][4],
        active: rows[i][5],
        createdate: rows[i][6]
      };
    }
  }

  return null;
}









/*End of Academic Module
*/


/* =========================
   TIMETABLE MODULE
========================= */

const TIMETABLE_SHEET_NAME = "TimeTable";

function timetableClean_(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function timetableNormalizeHeader_(value) {
  return timetableClean_(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function timetableNormalizeMatch_(value) {
  return timetableClean_(value).toLowerCase().replace(/\s+/g, "");
}

function timetableBuildHeaderMap_(headers) {
  const map = {};

  headers.forEach(function(header, index) {
    const key = timetableNormalizeHeader_(header);

    if (key && map[key] === undefined) {
      map[key] = index;
    }
  });

  return map;
}

function timetableFindColumn_(headerMap, possibleHeaders) {
  for (let i = 0; i < possibleHeaders.length; i++) {
    const key = timetableNormalizeHeader_(possibleHeaders[i]);

    if (headerMap[key] !== undefined) {
      return headerMap[key];
    }
  }

  return -1;
}

function timetableGetCell_(row, colIndex) {
  return colIndex >= 0 ? timetableClean_(row[colIndex]) : "";
}

function timetableFilterMatches_(rowValue, requestedValue) {
  const rowText = timetableNormalizeMatch_(rowValue);
  const requestedText = timetableNormalizeMatch_(requestedValue);

  if (!rowText || rowText === "all") {
    return true;
  }

  if (!requestedText || requestedText === "all") {
    return true;
  }

  return rowText === requestedText;
}

/*
 * MIGRATION STATUS: LEGACY ROLLBACK READ (V97.1.3, production verified 2026-07-20).
 * Active Worker traffic reads TimeTable through the Google Sheets API.
 * updateTimetableZoomLink remains an active Apps Script write operation.
 * Keep this implementation with its doPost action until rollback is retired.
 * See apps-script/MIGRATION-CHANGELOG.md.
 */
function getTimetable(data) {
  data = data || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TIMETABLE_SHEET_NAME);

  if (!sheet) {
    return {
      success: false,
      error: TIMETABLE_SHEET_NAME + " sheet not found",
      sessions: [],
      zoomlink: ""
    };
  }

  const range = sheet.getDataRange();
  const values = range.getValues();
  const displayRows = range.getDisplayValues();

  if (!values || values.length < 2) {
    return {
      success: true,
      sessions: [],
      zoomlink: "",
      count: 0
    };
  }

  const headers = displayRows[0] || values[0] || [];
  const headerMap = timetableBuildHeaderMap_(headers);

  const sessionIdCol = timetableFindColumn_(headerMap, ["SessionID", "SessionId", "Session"]);
  const subjectIdCol = timetableFindColumn_(headerMap, ["SubjectID", "SubjectId"]);
  const subjectNameCol = timetableFindColumn_(headerMap, ["SubjectName", "Subject"]);
  const dayCol = timetableFindColumn_(headerMap, ["DayofWeek", "DayOfWeek", "Day", "DayName"]);
  const startTimeCol = timetableFindColumn_(headerMap, ["StartTime", "start time", "Start Time", "Time"]);
  const zoomLinkCol = timetableFindColumn_(headerMap, ["ZoomLink", "Zoom Link", "ClassLink", "MeetingLink"]);
  const groupNoCol = timetableFindColumn_(headerMap, ["GroupNo", "Group", "ClassGroup", "Class Group"]);
  const assignedTeacherCol = timetableFindColumn_(headerMap, ["AssignedTeacher", "Assigned Teacher", "Teacher"]);

  if (subjectNameCol < 0 || dayCol < 0 || startTimeCol < 0) {
    return {
      success: false,
      error: "TimeTable sheet must include SubjectName, DayofWeek and StartTime columns",
      sessions: [],
      zoomlink: ""
    };
  }

  const requestedGroup = timetableClean_(data.groupNo || data.classgroup || data.group || "ALL");
  const requestedTeacher = timetableClean_(data.assignedTeacher || data.teacher || "ALL");
  const globalZoomLink = zoomLinkCol >= 0 && displayRows.length > 1
    ? timetableGetCell_(displayRows[1], zoomLinkCol)
    : "";

  const sessions = [];

  for (let i = 1; i < displayRows.length; i++) {
    const displayRow = displayRows[i];
    const valueRow = values[i];

    const subjectName = timetableGetCell_(displayRow, subjectNameCol);
    const dayOfWeek = timetableGetCell_(displayRow, dayCol);
    const startTime = timetableGetCell_(displayRow, startTimeCol);

    if (!subjectName || !dayOfWeek || !startTime) {
      continue;
    }

    const groupNo = timetableGetCell_(displayRow, groupNoCol);
    const assignedTeacher = timetableGetCell_(displayRow, assignedTeacherCol);

    if (!timetableFilterMatches_(groupNo, requestedGroup)) {
      continue;
    }

    if (!timetableFilterMatches_(assignedTeacher, requestedTeacher)) {
      continue;
    }

    sessions.push({
      row: i + 1,
      sessionid: timetableGetCell_(displayRow, sessionIdCol),
      subjectid: timetableGetCell_(displayRow, subjectIdCol),
      subjectname: subjectName,
      dayofweek: dayOfWeek,
      starttime: startTime,
      zoomlink: zoomLinkCol >= 0 ? timetableGetCell_(displayRow, zoomLinkCol) : "",
      groupno: groupNo || "ALL",
      assignedteacher: assignedTeacher || "ALL"
    });
  }

  return {
    success: true,
    sessions: sessions,
    zoomlink: globalZoomLink,
    groupno: requestedGroup,
    assignedteacher: requestedTeacher,
    count: sessions.length
  };
}

function updateTimetableZoomLink(data) {
  data = data || {};

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TIMETABLE_SHEET_NAME);

  if (!sheet) {
    return {
      success: false,
      error: TIMETABLE_SHEET_NAME + " sheet not found"
    };
  }

  const zoomLink = timetableClean_(data.zoomlink || data.zoomLink || data.link || "");
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] || [];
  const headerMap = timetableBuildHeaderMap_(headers);
  let zoomLinkCol = timetableFindColumn_(headerMap, ["ZoomLink", "Zoom Link", "ClassLink", "MeetingLink"]);

  if (zoomLinkCol < 0) {
    zoomLinkCol = lastColumn;
    sheet.getRange(1, zoomLinkCol + 1).setValue("ZoomLink");
  }

  if (sheet.getLastRow() < 2) {
    sheet.insertRowsAfter(1, 1);
  }

  sheet.getRange(2, zoomLinkCol + 1).setValue(zoomLink);

  const timetable = getTimetable({
    groupNo: data.groupNo || "ALL",
    assignedTeacher: data.assignedTeacher || "ALL"
  });

  timetable.message = "Zoom link saved";
  return timetable;
}

/* =========================
   WEEKLY PLANNER PREVIEW DRIVE SAVE - V97.1.8.5 
========================= */

function saveWeeklyPlannerPreviewToDrive(data) {
  data = data || {};

  const mimeType = String(data.mimeType || "image/png").trim();

  if (mimeType !== "image/png") {
    return { success: false, error: "Only PNG planner previews are supported" };
  }

  const fileName = sanitizeWeeklyPlannerDriveFileName_(data.fileName);

  if (!fileName) {
    return { success: false, error: "Missing fileName" };
  }

  const base64 = extractWeeklyPlannerPreviewBase64_(data);

  if (!base64) {
    return { success: false, error: "Missing preview image data" };
  }

  try {
    const bytes = Utilities.base64Decode(base64);
    const blob = Utilities.newBlob(bytes, mimeType, fileName);
    const folder = DriveApp.getFolderById(WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_ID);
    const file = folder.createFile(blob);

    return {
      success: true,
      message: "Weekly planner preview saved to Google Drive",
      fileName: file.getName(),
      fileId: file.getId(),
      fileUrl: file.getUrl(),
      folderId: WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_ID,
      destinationLabel: WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_LABEL,
      destinationUrl: WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_URL,
      teacherName: String(data.teacherName || "").trim(),
      saveDate: String(data.saveDate || "").trim(),
      weekStart: String(data.weekStart || "").trim(),
      requestedBy: String(data.requestedBy || "").trim(),
      requestedByAdminId: String(data.requestedByAdminId || "").trim()
    };
  } catch (error) {
    console.error("Weekly planner Drive save failed", error);

    return {
      success: false,
      error: "Unable to save Weekly Planner. The configured Google Drive folder is not accessible. Please verify that the folder has been shared with the M4L Apps Script account.",
      destinationLabel: WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_LABEL,
      destinationUrl: WEEKLY_PLANNER_PREVIEW_DRIVE_FOLDER_URL
    };
  }
}

function testDriveAccess() {
  const folder = DriveApp.getFolderById("1Uz-unVcnO729RE88_pr9Y1cNp8lNgRcX");
  folder.createFile("test.txt", "M4L Drive access test");
}




function extractWeeklyPlannerPreviewBase64_(data) {
  const directBase64 = String(data.base64 || "").replace(/\s/g, "");

  if (directBase64) {
    return directBase64;
  }

  const dataUrl = String(data.dataUrl || "").trim();
  const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/);

  return match ? match[1].replace(/\s/g, "") : "";
}

function sanitizeWeeklyPlannerDriveFileName_(value) {
  let name = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!name) {
    return "";
  }

  if (!/\.png$/i.test(name)) {
    name += ".png";
  }

  return name.slice(0, 140);
}

// Start of dopost//
// Backend ownership ledger: apps-script/MIGRATION-CHANGELOG.md


function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

if (body.action === "checkStudentDuplicate") {
  return jsonResponse(checkStudentDuplicate(body.data));
}

    if (body.action === "registerStudent") {
      return jsonResponse(registerStudent(body.data));
    }

    if (body.action === "getStudentByUniqueId") {
      return jsonResponse({
        success: true,
        student: getStudentByUniqueId(body.uniqueid)
      });
    }

    if (body.action === "setStudentPin") {
      return jsonResponse(setStudentPin(body.data));
    }

if (body.action === "getStudentForLogin") {
  return jsonResponse({
    success: true,
    student: getStudentForLogin(body.uniqueid)
  });
}
if (body.action === "resetStudentPin") {
  return jsonResponse(resetStudentPin(body.uniqueid));
}
if (body.action === "registerAdmin") {
  return jsonResponse(registerAdmin(body.data));
}

if (body.action === "setAdminPin") {
  return jsonResponse(setAdminPin(body.data));
}


if (body.action === "getAdminByUniqueId") {
  return jsonResponse({
    success: true,
    admin: getAdminByUniqueId(body.uniqueid)
  });
}
if (body.action === "getAdminByUsername") {
  return jsonResponse({
    success: true,
    admin: getAdminByUsername(body.username)
  });
}
if (body.action === "updateStudent") {
  return jsonResponse(updateStudent(body.data));
}

if (body.action === "searchStudents") {
  return jsonResponse(searchStudents(body.data));
}

if (body.action === "getStudentAssignmentOptions") {
  return jsonResponse(getStudentAssignmentOptions());
}

if (body.action === "submitAbsentStudents") {
  return jsonResponse(submitAbsentStudents(body.data));
}

if (body.action === "getStudentsForAttendance") {
  return jsonResponse(getStudentsForAttendance(body.classgroup));
}

if (body.action === "getAttendanceReport") {
  return jsonResponse(getAttendanceReport(body.data));
}
// Academic function calls //
if (body.action === "createSubject") {
  return jsonResponse(createSubject(body.data));
}

if (body.action === "listSubjects") {
  return jsonResponse(listSubjects());
}

if (body.action === "updateSubject") {
  return jsonResponse(updateSubject(body.data));
}
if (body.action === "createSubjectResource") {
  return jsonResponse(createSubjectResource(body.data));
}

if (body.action === "listSubjectResources") {
  return jsonResponse(listSubjectResources(body.subjectid));
}

if (body.action === "updateSubjectResource") {
  return jsonResponse(updateSubjectResource(body.data));
}

if (body.action === "createTaskResource") {
  return jsonResponse(createTaskResource(body.data));
}

if (body.action === "listTaskResources") {
  return jsonResponse(listTaskResources(body.data));
}

if (body.action === "updateTaskResource") {
  return jsonResponse(updateTaskResource(body.data));
}




if (body.action === "createTask") {
  return jsonResponse(createTask(body.data));
}

if (body.action === "listTasks") {
  return jsonResponse(listTasks(body.data));
}

if (body.action === "updateTask") {
  return jsonResponse(updateTask(body.data));
}
if (body.action === "assignTasksToStudents") {
  return jsonResponse(assignTasksToStudents(body.data));
}

if (body.action === "populateAllStudentTasks") {
  return jsonResponse(populateAllStudentTasks(body.data));
}

if (body.action === "getStudentTasks") {
  return jsonResponse(getStudentTasks(body.data));
}
if (body.action === "getStudentResources") {
  // LEGACY ROLLBACK: production Resources reads use the direct Google Sheets route.
  return jsonResponse(getStudentResources(body.data));
}

if (body.action === "getTimetable") {
  // LEGACY ROLLBACK: production timetable reads use the direct Google Sheets route.
  return jsonResponse(getTimetable(body.data));
}

if (body.action === "updateTimetableZoomLink") {
  return jsonResponse(updateTimetableZoomLink(body.data));
}

if (body.action === "saveWeeklyPlannerPreviewToDrive") {
  return jsonResponse(saveWeeklyPlannerPreviewToDrive(body.data));
}


if (body.action === "updateStudentTaskStatus") {
  return jsonResponse(updateStudentTaskStatus(body.data));
}

if (body.action === "getStudentTaskById") {
  return jsonResponse({
    success: true,
    task: getStudentTaskById(body.studenttaskid)
  });
}
if (body.action === "getTaskProgressReport") {
  return jsonResponse(getTaskProgressReport(body.data));
}

if (body.action === "getTaskProgressDetail") {
  return jsonResponse(getTaskProgressDetail(body.data));
}


// end of  function calls //

    return jsonResponse({
      success: false,
      error: "Unknown action"
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message
    });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // Your logic here (e.g., retrieving data)
  
  return ContentService.createTextOutput(
    JSON.stringify({ status: "success", message: "Connected to Apps Script!" })
  ).setMimeType(ContentService.MimeType.JSON);
}


