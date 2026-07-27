/* M4L v97.1.8.6 Weekly Planner
   - Four equal, swipeable cards: Monday to Thursday.
   - Current timetable supplies period order and subject defaults; times are not shown.
   - A new week can be prefilled from the previous planner.
   - Planner records save through the Worker's direct Google Sheets API route.
   - Preview Save uploads the portrait PNG to the configured Google Drive test folder after destination confirmation. */

const WEEKLY_PLANNER_DAYS = Object.freeze([
  { key: "monday", label: "Monday", timetableKeys: ["mon", "monday"] },
  { key: "tuesday", label: "Tuesday", timetableKeys: ["tue", "tues", "tuesday"] },
  { key: "wednesday", label: "Wednesday", timetableKeys: ["wed", "weds", "wednesday"] },
  { key: "thursday", label: "Thursday", timetableKeys: ["thu", "thur", "thurs", "thursday"] }
]);
const WEEKLY_PLANNER_PERIOD_COUNT = 3;
const WEEKLY_PLANNER_PREVIEW_STYLE_STORAGE_KEY = "m4l.weeklyPlanner.previewStyle.v95.3";

const WEEKLY_PLANNER_PREVIEW_FONTS = Object.freeze({
  normal: Object.freeze({
    label: "Standard",
    family: "Arial, sans-serif"
  }),
  comic: Object.freeze({
    label: "Comic Sans",
    family: "'Comic Sans MS', 'Comic Sans', cursive"
  }),
  handwritten: Object.freeze({
    label: "Handwritten",
    family: "'Chalkboard SE', 'Bradley Hand', 'Comic Sans MS', cursive"
  }),
  classic: Object.freeze({
    label: "Classic",
    family: "Georgia, 'Times New Roman', serif"
  })
});

const WEEKLY_PLANNER_PREVIEW_COLORS = Object.freeze({
  normal: Object.freeze({ label: "Standard", value: "var(--text)" }),
  violet: Object.freeze({ label: "Violet", value: "#a626aa" }),
  turquoise: Object.freeze({ label: "Turquoise", value: "#0066a1" }),
  navy: Object.freeze({ label: "Navy", value: "#000080" }),
  grey: Object.freeze({ label: "Grey", value: "#7d7f7c" })
});

const WEEKLY_PLANNER_DEFAULT_PREVIEW_STYLE = Object.freeze({
  fontKey: "handwritten",
  colorKey: "violet"
});

const weeklyPlannerState = {
  initialized: false,
  initializePromise: null,
  eventsBound: false,
  loadingSequence: 0,
  teachers: [],
  teacher: null,
  week: null,
  planner: null,
  previousPlanner: null,
  plannerData: null,
  feedback: "",
  expectedUpdatedDate: "",
  expectedPlannerExists: false,
  canEdit: false,
  viewedPlannerExists: false,
  screenReady: false,
  loadedKey: "",
  loadPromise: null,
  loadPromiseKey: "",
  dirty: false,
  activeCardIndex: 0,
  scrollFrame: 0,
  previewDataUrl: "",
  previewBlob: null,
  previewGenerationSequence: 0,
  editorSnapshot: null,
  previewStyle: loadWeeklyPlannerPreviewStyle()
};

async function showWeeklyPlanner() {
  showScreen("weekly-planner-screen");

  try {
    await initializeWeeklyPlanner();
  } catch (error) {
    setWeeklyPlannerMessage(error.message || "Unable to open the weekly planner.", "error");
  }
}

async function initializeWeeklyPlanner() {
  bindWeeklyPlannerEvents();
  const weekInput = document.getElementById("weekly-planner-week");

  if (weekInput && !weekInput.value) {
    weekInput.value = getWeeklyPlannerWeekMeta().weekStart;
  }

  if (!weeklyPlannerState.initialized) {
    if (!weeklyPlannerState.initializePromise) {
      weeklyPlannerState.initializePromise = bootstrapWeeklyPlanner();
    }

    try {
      await weeklyPlannerState.initializePromise;
    } finally {
      weeklyPlannerState.initializePromise = null;
    }
  }

  if (!canReuseWeeklyPlannerSession()) {
    await loadWeeklyPlanner({ confirmDiscard: false });
  }

  await generateWeeklyPlannerPreview();
}

async function bootstrapWeeklyPlanner() {
  setWeeklyPlannerMessage("Checking the planner connection...", "");

  const [health, teacherResult] = await Promise.all([
    apiPost("/api/admin/weekly-planner/health", {}, state.token),
    apiPost("/api/admin/weekly-planner/teachers", {}, state.token)
  ]);

  if (!health.success) {
    throw new Error(health.error || health.detail || "The WeeklyPlanners sheet is not available.");
  }

  if (!teacherResult.success) {
    throw new Error(teacherResult.error || "Unable to load teachers.");
  }

  weeklyPlannerState.teachers = Array.isArray(teacherResult.teachers)
    ? teacherResult.teachers
    : [];
  renderWeeklyPlannerTeacherOptions();
  weeklyPlannerState.initialized = true;
}

function bindWeeklyPlannerEvents() {
  if (weeklyPlannerState.eventsBound) return;

  weeklyPlannerState.eventsBound = true;
  const teacherSelect = document.getElementById("weekly-planner-teacher");
  const weekInput = document.getElementById("weekly-planner-week");
  const groupInput = document.getElementById("weekly-planner-group");
  const rail = document.getElementById("weekly-planner-rail");
  const dots = document.getElementById("weekly-planner-dots");
  const saveDialog = document.getElementById("weekly-planner-save-dialog");

  if (teacherSelect) {
    teacherSelect.addEventListener("change", () => {
      if (!confirmWeeklyPlannerDiscard()) {
        teacherSelect.value = String(weeklyPlannerState.teacher?.teacherId || "");
        return;
      }

      loadWeeklyPlanner({ confirmDiscard: false }).catch(error => {
        setWeeklyPlannerMessage(error.message || "Unable to load the selected teacher.", "error");
      });
    });
  }

  if (weekInput) {
    weekInput.addEventListener("change", () => {
      weekInput.value = getWeeklyPlannerWeekMeta(weekInput.value).weekStart;
      if (!confirmWeeklyPlannerDiscard()) {
        weekInput.value = String(weeklyPlannerState.week?.weekStart || getWeeklyPlannerWeekMeta().weekStart);
        return;
      }

      loadWeeklyPlanner({ confirmDiscard: false }).catch(error => {
        setWeeklyPlannerMessage(error.message || "Unable to load the selected week.", "error");
      });
    });
  }

  if (groupInput) {
    groupInput.addEventListener("input", () => {
      if (!weeklyPlannerState.canEdit) return;
      weeklyPlannerState.dirty = true;
    });
  }

  if (rail) {
    rail.addEventListener("scroll", scheduleWeeklyPlannerDotUpdate, { passive: true });
    rail.addEventListener("input", handleWeeklyPlannerCardInput);
    rail.addEventListener("click", handleWeeklyPlannerCardClick);
  }

  if (dots) {
    dots.addEventListener("click", event => {
      const button = event.target.closest("[data-weekly-planner-dot]");
      if (!button) return;
      scrollWeeklyPlannerToCard(Number(button.dataset.weeklyPlannerDot || 0));
    });
  }

  if (saveDialog) {
    saveDialog.addEventListener("click", event => {
      if (event.target === saveDialog) closeWeeklyPlannerSaveDialog();
    });
  }

  document.querySelectorAll("[data-weekly-planner-open-day]").forEach(button => {
    button.addEventListener("click", () => openWeeklyPlannerDayEditor(Number(button.dataset.weeklyPlannerOpenDay || 0)));
  });

  const dayEditor = document.getElementById("weekly-planner-day-editor");
  if (dayEditor) {
    dayEditor.addEventListener("click", event => {
      if (event.target === dayEditor) closeWeeklyPlannerDayEditor(false);
    });
  }
}

function renderWeeklyPlannerTeacherOptions() {
  const select = document.getElementById("weekly-planner-teacher");
  if (!select) return;

  const currentUser = state.user || {};
  const currentTeacherId = String(currentUser.adminid || "").trim();
  const currentRole = String(currentUser.role || "").trim().toUpperCase();
  let teachers = weeklyPlannerState.teachers.slice();

  if (!teachers.length && currentTeacherId) {
    teachers = [{
      teacherId: currentTeacherId,
      teacherName: String(currentUser.username || "Teacher").trim(),
      role: currentRole,
      assignedGroup: String(currentUser.assignedgroup || "").trim(),
      active: true
    }];
  }

  select.innerHTML = teachers.map(teacher => {
    const selected = teacher.teacherId === currentTeacherId ? " selected" : "";
    return `<option value="${weeklyPlannerEscapeAttribute(teacher.teacherId)}"${selected}>${weeklyPlannerEscapeHtml(teacher.teacherName)}</option>`;
  }).join("");

  select.disabled = teachers.length <= 1;
  weeklyPlannerState.teachers = teachers;
}

async function loadWeeklyPlanner(options = {}) {
  const teacher = getSelectedWeeklyPlannerTeacher();
  const weekInput = document.getElementById("weekly-planner-week");

  if (!teacher) {
    throw new Error("No teacher is available for this planner.");
  }

  const week = getWeeklyPlannerWeekMeta(weekInput ? weekInput.value : "");
  const loadKey = getWeeklyPlannerSessionKey(teacher, week);

  if (weeklyPlannerState.loadPromise && weeklyPlannerState.loadPromiseKey === loadKey) {
    return weeklyPlannerState.loadPromise;
  }

  if (options.confirmDiscard !== false && !confirmWeeklyPlannerDiscard()) {
    return false;
  }

  const loadPromise = performWeeklyPlannerLoad(teacher, week, loadKey);
  weeklyPlannerState.loadPromise = loadPromise;
  weeklyPlannerState.loadPromiseKey = loadKey;

  try {
    return await loadPromise;
  } finally {
    if (weeklyPlannerState.loadPromise === loadPromise) {
      weeklyPlannerState.loadPromise = null;
      weeklyPlannerState.loadPromiseKey = "";
    }
  }
}

async function performWeeklyPlannerLoad(teacher, week, loadKey) {
  const loadSequence = ++weeklyPlannerState.loadingSequence;
  const retainExistingView = canReuseWeeklyPlannerSession(teacher, week);

  if (retainExistingView) {
    setWeeklyPlannerMessage("Refreshing planner...", "");
  } else {
    weeklyPlannerState.activeCardIndex = 0;
    renderWeeklyPlannerLoadingState();
    setWeeklyPlannerMessage("Loading planner and timetable...", "");
  }

  const result = await apiPost("/api/admin/weekly-planner/get", {
    teacherId: teacher.teacherId,
    weekStart: week.weekStart
  }, state.token);

  if (loadSequence !== weeklyPlannerState.loadingSequence) return false;

  if (!result.success) {
    throw new Error(result.error || result.detail || "Unable to load the weekly planner.");
  }

  weeklyPlannerState.teacher = result.teacher || teacher;
  weeklyPlannerState.week = result.week || week;
  weeklyPlannerState.planner = result.planner || null;
  weeklyPlannerState.previousPlanner = result.previousPlanner || null;
  weeklyPlannerState.expectedUpdatedDate = String(result.planner?.updatedDate || "");
  weeklyPlannerState.expectedPlannerExists = !!result.planner;
  weeklyPlannerState.canEdit = result.canEdit === true || isOwnWeeklyPlannerTeacher(
    weeklyPlannerState.teacher
  );
  weeklyPlannerState.viewedPlannerExists = !!result.planner;

  const groupInput = document.getElementById("weekly-planner-group");
  const feedbackInput = document.getElementById("weekly-planner-feedback");
  const groupNo = String(
    result.planner?.groupNo ||
    result.teacher?.assignedGroup ||
    result.previousPlanner?.groupNo ||
    ""
  ).trim();

  if (groupInput) groupInput.value = groupNo.toUpperCase() === "ALL" ? "" : groupNo;
  weeklyPlannerState.feedback = String(result.planner?.feedback || "");
  if (feedbackInput) feedbackInput.value = weeklyPlannerState.feedback;

  let timetableResult = null;

  if (weeklyPlannerState.canEdit) {
    try {
      timetableResult = await fetchWeeklyPlannerTimetable(result.teacher || teacher, groupNo);
    } catch (error) {
      console.warn("Weekly Planner timetable defaults were unavailable:", error);
    }
  }

  if (loadSequence !== weeklyPlannerState.loadingSequence) return false;

  const timetableRows = normalizeWeeklyPlannerTimetableRows(timetableResult);
  renderWeeklyPlannerGroupOptions(
    weeklyPlannerState.canEdit ? timetableRows : [],
    result.teacher || teacher,
    groupNo
  );

  weeklyPlannerState.plannerData = result.planner
    ? normalizeWeeklyPlannerData(result.planner.plannerData, weeklyPlannerState.week)
    : weeklyPlannerState.canEdit
      ? buildWeeklyPlannerDataFromDefaults(
        timetableRows,
        result.previousPlanner?.plannerData,
        weeklyPlannerState.week
      )
      : normalizeWeeklyPlannerData(null, weeklyPlannerState.week);

  renderWeeklyPlannerCards();
  applyWeeklyPlannerAccessMode();
  weeklyPlannerState.loadedKey = loadKey;
  weeklyPlannerState.screenReady = true;
  weeklyPlannerState.dirty = false;

  if (!weeklyPlannerState.canEdit && result.planner) {
    setWeeklyPlannerMessage(
      `Viewing ${weeklyPlannerState.teacher?.teacherName || "teacher"}'s planner (read only).`,
      "success"
    );
  } else if (!weeklyPlannerState.canEdit) {
    setWeeklyPlannerMessage(
      `No planner has been saved for ${weeklyPlannerState.teacher?.teacherName || "this teacher"} this week.`,
      ""
    );
  } else if (result.planner) {
    setWeeklyPlannerMessage("Planner loaded.", "success");
  } else if (result.previousPlanner) {
    setWeeklyPlannerMessage("Last week copied.", "success");
  } else {
    setWeeklyPlannerMessage("Planner ready.", "success");
  }

  try {
    await generateWeeklyPlannerPreview();
  } catch (error) {
    setWeeklyPlannerMessage(error.message || "Unable to render the planner image.", "error");
  }

  return true;
}

function getWeeklyPlannerSessionKey(teacher, week) {
  return `${String(teacher?.teacherId || "").trim()}::${String(week?.weekStart || "").trim()}`;
}

function canReuseWeeklyPlannerSession(teacher = getSelectedWeeklyPlannerTeacher(), week = null) {
  const weekInput = document.getElementById("weekly-planner-week");
  const selectedWeek = week || getWeeklyPlannerWeekMeta(weekInput ? weekInput.value : "");
  const rail = document.getElementById("weekly-planner-rail");

  return !!(
    teacher &&
    weeklyPlannerState.screenReady &&
    weeklyPlannerState.plannerData &&
    weeklyPlannerState.loadedKey === getWeeklyPlannerSessionKey(teacher, selectedWeek) &&
    rail?.querySelector(".weekly-planner-day-card")
  );
}

function confirmWeeklyPlannerDiscard() {
  if (!weeklyPlannerState.dirty) return true;
  if (typeof window.confirm !== "function") return true;
  return window.confirm("Discard the unsaved Weekly Planner changes?");
}

async function fetchWeeklyPlannerTimetable(teacher, groupNo) {
  const options = {
    groupNo: groupNo || teacher.assignedGroup || "ALL",
    assignedTeacher: teacher.teacherName || "ALL"
  };

  if (window.M4LTimetable && typeof window.M4LTimetable.fetchTimetable === "function") {
    return window.M4LTimetable.fetchTimetable(options);
  }

  const result = await apiPost("/api/timetable/get", options, state.token);
  if (!result.success) throw new Error(result.error || "Unable to load timetable");
  return result;
}

function normalizeWeeklyPlannerTimetableRows(result) {
  if (!result) return [];

  if (typeof normalizeTimetableRows === "function") {
    return normalizeTimetableRows(result);
  }

  if (Array.isArray(result.sessions)) return result.sessions;
  if (Array.isArray(result.rows)) return result.rows;
  if (Array.isArray(result.data)) return result.data;
  return [];
}

function renderWeeklyPlannerGroupOptions(rows, teacher, selectedGroup) {
  const datalist = document.getElementById("weekly-planner-groups");
  if (!datalist) return;

  const groups = new Set();
  [selectedGroup, teacher?.assignedGroup].forEach(value => {
    const group = String(value || "").trim();
    if (group && group.toUpperCase() !== "ALL") groups.add(group);
  });

  (rows || []).forEach(row => {
    const group = String(row.groupno || row.groupNo || row.group || "").trim();
    if (group && group.toUpperCase() !== "ALL") groups.add(group);
  });

  datalist.innerHTML = Array.from(groups)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map(group => `<option value="${weeklyPlannerEscapeAttribute(group)}"></option>`)
    .join("");
}

function buildWeeklyPlannerDataFromDefaults(rows, previousData, week) {
  const previous = normalizeWeeklyPlannerData(previousData, week);
  const timetableByDay = buildWeeklyPlannerTimetablePeriods(rows);

  return {
    version: 1,
    days: WEEKLY_PLANNER_DAYS.map((dayConfig, dayIndex) => {
      const timetablePeriods = timetableByDay[dayConfig.key] || [];
      const previousDay = previous.days[dayIndex] || { periods: [] };
      const previousPeriods = Array.isArray(previousDay.periods) ? previousDay.periods : [];
      return {
        key: dayConfig.key,
        label: dayConfig.label,
        date: addWeeklyPlannerDays(week.weekStart, dayIndex),
        periods: Array.from({ length: WEEKLY_PLANNER_PERIOD_COUNT }, (_, periodIndex) => {
          const timetablePeriod = timetablePeriods[periodIndex] || {};
          const previousPeriod = previousPeriods[periodIndex] || {};
          const previousEntries = normalizeWeeklyPlannerEntries(previousPeriod.entries);
          return {
            id: String(previousPeriod.id || `period-${periodIndex + 1}`),
            label: String(previousPeriod.label || getWeeklyPlannerPeriodLabel(periodIndex)),
            subject: String(timetablePeriod.subject || previousPeriod.subject || ""),
            entries: previousEntries,
            prefilled: previousEntries.length > 0
          };
        })
      };
    })
  };
}

function buildWeeklyPlannerTimetablePeriods(rows) {
  const result = Object.fromEntries(WEEKLY_PLANNER_DAYS.map(day => [day.key, []]));

  WEEKLY_PLANNER_DAYS.forEach(dayConfig => {
    const dayRows = (rows || []).filter(row => {
      const value = weeklyPlannerNormalizeKey(
        row.dayofweek || row.dayOfWeek || row.day || ""
      );
      return dayConfig.timetableKeys.includes(value);
    });
    const periodsByTime = new Map();

    dayRows.forEach(row => {
      const timeValue = row.starttime ?? row.startTime ?? row.time ?? "";
      const timeKey = String(timeValue);
      const subject = String(
        row.subjectname || row.subjectName || row.subject || ""
      ).trim();

      if (!subject) return;

      if (!periodsByTime.has(timeKey)) {
        periodsByTime.set(timeKey, {
          time: timeValue,
          subjects: []
        });
      }

      const period = periodsByTime.get(timeKey);
      if (!period.subjects.some(value => weeklyPlannerNormalizeKey(value) === weeklyPlannerNormalizeKey(subject))) {
        period.subjects.push(subject);
      }
    });

    result[dayConfig.key] = Array.from(periodsByTime.values())
      .sort((a, b) => getWeeklyPlannerTimeMinutes(a.time) - getWeeklyPlannerTimeMinutes(b.time))
      .map(period => ({ subject: period.subjects.join(" / ") }));
  });

  return result;
}

function normalizeWeeklyPlannerData(value, week) {
  const source = value && typeof value === "object" ? value : {};
  const sourceDays = Array.isArray(source.days) ? source.days : [];

  return {
    version: 1,
    days: WEEKLY_PLANNER_DAYS.map((dayConfig, dayIndex) => {
      const matched = sourceDays.find(day => {
        return weeklyPlannerNormalizeKey(day?.key || day?.label) === dayConfig.key;
      }) || sourceDays[dayIndex] || {};
      const periods = Array.isArray(matched.periods) ? matched.periods : [];

      return {
        key: dayConfig.key,
        label: dayConfig.label,
        date: addWeeklyPlannerDays(week.weekStart, dayIndex),
        periods: Array.from({ length: WEEKLY_PLANNER_PERIOD_COUNT }, (_, periodIndex) => {
          const period = periods[periodIndex] || {};
          return {
            id: String(period?.id || `period-${periodIndex + 1}`),
            label: String(period?.label || getWeeklyPlannerPeriodLabel(periodIndex)),
            subject: String(period?.subject || ""),
            entries: normalizeWeeklyPlannerEntries(period?.entries),
            prefilled: false
          };
        })
      };
    })
  };
}

function normalizeWeeklyPlannerEntries(value) {
  if (Array.isArray(value)) {
    return value.map(entry => String(entry || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n/)
    .map(entry => entry.trim())
    .filter(Boolean);
}

function renderWeeklyPlannerLoadingState() {
  const rail = document.getElementById("weekly-planner-rail");
  const dots = document.getElementById("weekly-planner-dots");
  if (rail) rail.innerHTML = `<p class="helper-text">Loading weekly planner...</p>`;
  if (dots) dots.innerHTML = "";
}

function renderWeeklyPlannerCards() {
  const rail = document.getElementById("weekly-planner-rail");
  const dots = document.getElementById("weekly-planner-dots");
  const plannerData = weeklyPlannerState.plannerData;

  if (!rail || !dots || !plannerData) return;

  const readOnlyAttribute = weeklyPlannerState.canEdit
    ? ""
    : " readonly aria-readonly=\"true\"";
  const hiddenEditControls = weeklyPlannerState.canEdit ? "" : " hidden";

  rail.innerHTML = plannerData.days.map((day, dayIndex) => {
    const periods = Array.from({ length: WEEKLY_PLANNER_PERIOD_COUNT }, (_, periodIndex) => {
      return day.periods?.[periodIndex] || {
        id: `period-${periodIndex + 1}`,
        label: getWeeklyPlannerPeriodLabel(periodIndex),
        subject: "",
        entries: [],
        prefilled: false
      };
    });
    day.periods = periods;

    return `
      <article class="weekly-planner-day-card" data-weekly-planner-day="${dayIndex}" aria-label="${weeklyPlannerEscapeAttribute(day.label)} planner">
        <header class="weekly-planner-day-heading">
          <h3>${weeklyPlannerEscapeHtml(day.label)}</h3>
          <span class="weekly-planner-day-date">${weeklyPlannerEscapeHtml(formatWeeklyPlannerDisplayDate(day.date))}</span>
        </header>
        ${periods.map((period, periodIndex) => renderWeeklyPlannerPeriod(dayIndex, periodIndex, period, periods.length)).join("")}
        <div class="weekly-planner-feedback-row">
          <label for="weekly-planner-feedback-${dayIndex}">Weekly feedback</label>
          <textarea
            id="weekly-planner-feedback-${dayIndex}"
            data-weekly-planner-feedback-field
            rows="3"
            placeholder="Teacher or administrator feedback"
            ${readOnlyAttribute}
          >${weeklyPlannerEscapeHtml(weeklyPlannerState.feedback)}</textarea>
        </div>
        <div class="weekly-planner-add-period-wrap"${hiddenEditControls}>
          <button class="weekly-planner-add-period" type="button" data-weekly-planner-add-period="${dayIndex}">Add period</button>
        </div>
      </article>
    `;
  }).join("");

  dots.innerHTML = plannerData.days.map((day, index) => {
    const active = index === weeklyPlannerState.activeCardIndex;
    return `
      <button
        type="button"
        class="weekly-planner-dot${active ? " is-active" : ""}"
        data-weekly-planner-dot="${index}"
        aria-label="Show ${weeklyPlannerEscapeAttribute(day.label)}"
        aria-current="${active ? "true" : "false"}"
      ></button>
    `;
  }).join("");

  if (window.matchMedia && window.matchMedia("(max-width: 767px)").matches) {
    requestAnimationFrame(() => scrollWeeklyPlannerToCard(weeklyPlannerState.activeCardIndex, false));
  }
}

function renderWeeklyPlannerPeriod(dayIndex, periodIndex, period, periodCount) {
  const removeDisabled = periodCount <= 1 ? " disabled" : "";
  const prefilledClass = period.prefilled && period.entries?.length ? " is-prefilled" : "";

  return `
    <div class="weekly-planner-period-row" data-weekly-planner-period="${periodIndex}">
      <input
        class="weekly-planner-period-subject"
        type="text"
        value="${weeklyPlannerEscapeAttribute(period.subject)}"
        data-weekly-planner-field="subject"
        placeholder="Subject ${periodIndex + 1}"
        aria-label="Subject ${periodIndex + 1}"
        ${weeklyPlannerState.canEdit ? "" : "readonly aria-readonly=\"true\""}
      />
      <textarea
        class="weekly-planner-period-entries${prefilledClass}"
        data-weekly-planner-field="entries"
        rows="3"
        placeholder="Enter each activity on a new line"
        aria-label="Activities for subject ${periodIndex + 1}"
        ${weeklyPlannerState.canEdit ? "" : "readonly aria-readonly=\"true\""}
      >${weeklyPlannerEscapeHtml((period.entries || []).join("\n"))}</textarea>
      <button
        class="weekly-planner-remove-period"
        type="button"
        data-weekly-planner-remove-period="${dayIndex}:${periodIndex}"
        aria-label="Remove ${weeklyPlannerEscapeAttribute(period.label)}"
        ${removeDisabled}${weeklyPlannerState.canEdit ? "" : " hidden"}
      >Remove</button>
    </div>
  `;
}

function handleWeeklyPlannerCardInput(event) {
  if (!weeklyPlannerState.canEdit) return;

  const feedbackField = event.target.closest("[data-weekly-planner-feedback-field]");

  if (feedbackField) {
    weeklyPlannerState.dirty = true;
    weeklyPlannerState.feedback = String(feedbackField.value || "");
    const feedbackInput = document.getElementById("weekly-planner-feedback");
    if (feedbackInput) feedbackInput.value = weeklyPlannerState.feedback;
    document.querySelectorAll("[data-weekly-planner-feedback-field]").forEach(field => {
      if (field !== feedbackField && field.value !== weeklyPlannerState.feedback) {
        field.value = weeklyPlannerState.feedback;
      }
    });
    return;
  }

  const field = event.target.closest("[data-weekly-planner-field]");
  const dayCard = event.target.closest("[data-weekly-planner-day]");
  const periodRow = event.target.closest("[data-weekly-planner-period]");

  if (!field || !dayCard || !periodRow || !weeklyPlannerState.plannerData) return;

  const dayIndex = Number(dayCard.dataset.weeklyPlannerDay);
  const periodIndex = Number(periodRow.dataset.weeklyPlannerPeriod);
  const period = weeklyPlannerState.plannerData.days[dayIndex]?.periods[periodIndex];
  if (!period) return;

  weeklyPlannerState.dirty = true;
  const fieldName = field.dataset.weeklyPlannerField;
  if (fieldName === "entries") {
    period.entries = normalizeWeeklyPlannerEntries(field.value);
    period.prefilled = false;
    field.classList.remove("is-prefilled");
  } else if (fieldName === "label" || fieldName === "subject") {
    period[fieldName] = String(field.value || "");
  }
}

function handleWeeklyPlannerCardClick(event) {
  if (!weeklyPlannerState.canEdit) return;

  const addButton = event.target.closest("[data-weekly-planner-add-period]");
  const removeButton = event.target.closest("[data-weekly-planner-remove-period]");

  if (addButton) {
    const dayIndex = Number(addButton.dataset.weeklyPlannerAddPeriod);
    addWeeklyPlannerPeriod(dayIndex);
    return;
  }

  if (removeButton && !removeButton.disabled) {
    const [dayIndex, periodIndex] = String(removeButton.dataset.weeklyPlannerRemovePeriod || "")
      .split(":")
      .map(Number);
    removeWeeklyPlannerPeriod(dayIndex, periodIndex);
  }
}

function addWeeklyPlannerPeriod(dayIndex) {
  const day = weeklyPlannerState.plannerData?.days?.[dayIndex];
  if (!day) return;

  const periodIndex = day.periods.length;
  day.periods.push({
    id: `period-${Date.now()}-${periodIndex + 1}`,
    label: getWeeklyPlannerPeriodLabel(periodIndex),
    subject: "",
    entries: []
  });
  weeklyPlannerState.dirty = true;
  weeklyPlannerState.activeCardIndex = dayIndex;
  renderWeeklyPlannerCards();
}

function removeWeeklyPlannerPeriod(dayIndex, periodIndex) {
  const day = weeklyPlannerState.plannerData?.days?.[dayIndex];
  if (!day || day.periods.length <= 1) return;

  day.periods.splice(periodIndex, 1);
  weeklyPlannerState.dirty = true;
  weeklyPlannerState.activeCardIndex = dayIndex;
  renderWeeklyPlannerCards();
}

function scheduleWeeklyPlannerDotUpdate() {
  if (weeklyPlannerState.scrollFrame) return;

  weeklyPlannerState.scrollFrame = requestAnimationFrame(() => {
    weeklyPlannerState.scrollFrame = 0;
    updateWeeklyPlannerActiveDotFromRail();
  });
}

function updateWeeklyPlannerActiveDotFromRail() {
  const rail = document.getElementById("weekly-planner-rail");
  if (!rail) return;

  const cards = Array.from(rail.querySelectorAll(".weekly-planner-day-card"));
  if (!cards.length) return;

  const railCenter = rail.scrollLeft + rail.clientWidth / 2;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  cards.forEach((card, index) => {
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    const distance = Math.abs(cardCenter - railCenter);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  setWeeklyPlannerActiveDot(nearestIndex);
}

function setWeeklyPlannerActiveDot(index) {
  weeklyPlannerState.activeCardIndex = Math.max(0, Math.min(3, Number(index) || 0));
  document.querySelectorAll("[data-weekly-planner-dot]").forEach((dot, dotIndex) => {
    const active = dotIndex === weeklyPlannerState.activeCardIndex;
    dot.classList.toggle("is-active", active);
    dot.setAttribute("aria-current", active ? "true" : "false");
  });
}

function scrollWeeklyPlannerToCard(index, smooth = true) {
  const rail = document.getElementById("weekly-planner-rail");
  const cards = rail ? rail.querySelectorAll(".weekly-planner-day-card") : [];
  const safeIndex = Math.max(0, Math.min(cards.length - 1, Number(index) || 0));
  const card = cards[safeIndex];
  if (!rail || !card) return;

  const targetLeft = card.offsetLeft - Math.max(0, (rail.clientWidth - card.offsetWidth) / 2);
  rail.scrollTo({
    left: targetLeft,
    behavior: smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "smooth"
      : "auto"
  });
  setWeeklyPlannerActiveDot(safeIndex);
}

async function saveWeeklyPlannerAndPreview(button) {
  const teacher = getSelectedWeeklyPlannerTeacher();
  const weekInput = document.getElementById("weekly-planner-week");
  const groupInput = document.getElementById("weekly-planner-group");
  const feedbackInput = document.getElementById("weekly-planner-feedback");

  if (!teacher || !weeklyPlannerState.plannerData) {
    setWeeklyPlannerMessage("The planner has not finished loading.", "error");
    return;
  }

  if (!weeklyPlannerState.canEdit) {
    await copyWeeklyPlannerToCurrentUser(button);
    return;
  }

  const week = getWeeklyPlannerWeekMeta(weekInput ? weekInput.value : "");
  const labelElement = button?.querySelector("[data-weekly-planner-save-label]");
  const originalLabel = String(labelElement?.textContent || "Save");

  if (button) {
    setWeeklyPlannerSaveButtonState(button, "Saving...", true);
  }

  setWeeklyPlannerMessage("", "");

  try {
    const result = await apiPost("/api/admin/weekly-planner/save", {
      teacherId: teacher.teacherId,
      weekStart: week.weekStart,
      groupNo: String(groupInput?.value || "").trim(),
      status: "READY",
      plannerData: getWeeklyPlannerDataForSave(weeklyPlannerState.plannerData),
      feedback: String(weeklyPlannerState.feedback || feedbackInput?.value || "").trim(),
      expectedUpdatedDate: weeklyPlannerState.expectedUpdatedDate,
      expectedExists: weeklyPlannerState.expectedPlannerExists
    }, state.token);

    if (!result.success) {
      throw new Error(result.error || result.detail || "Unable to save the planner.");
    }

    weeklyPlannerState.teacher = result.teacher || teacher;
    weeklyPlannerState.week = result.week || week;
    weeklyPlannerState.planner = result.planner;
    weeklyPlannerState.expectedUpdatedDate = String(result.planner?.updatedDate || "");
    weeklyPlannerState.expectedPlannerExists = true;
    weeklyPlannerState.canEdit = true;
    weeklyPlannerState.viewedPlannerExists = true;
    weeklyPlannerState.feedback = String(result.planner?.feedback || "");
    weeklyPlannerState.plannerData = normalizeWeeklyPlannerData(
      result.planner?.plannerData || weeklyPlannerState.plannerData,
      weeklyPlannerState.week
    );

    if (feedbackInput) feedbackInput.value = weeklyPlannerState.feedback;
    renderWeeklyPlannerCards();
    applyWeeklyPlannerAccessMode();
    weeklyPlannerState.loadedKey = getWeeklyPlannerSessionKey(
      weeklyPlannerState.teacher,
      weeklyPlannerState.week
    );
    weeklyPlannerState.screenReady = true;
    weeklyPlannerState.dirty = false;

    
    try {
      await generateWeeklyPlannerPreview();
    } catch (previewError) {
      setWeeklyPlannerMessage(
        `Planner saved, but the image preview could not be created: ${previewError.message || "unknown error"}`,
        "error"
      );
    }
  } catch (error) {
    setWeeklyPlannerMessage(error.message || "Unable to save the planner.", "error");
  } finally {
    if (button) {
      setWeeklyPlannerSaveButtonState(button, originalLabel, false);
    }
  }
}

async function copyWeeklyPlannerToCurrentUser(button) {
  const sourceTeacher = weeklyPlannerState.teacher;

  if (!sourceTeacher || !weeklyPlannerState.viewedPlannerExists || !weeklyPlannerState.plannerData) {
    setWeeklyPlannerMessage("There is no saved planner to copy.", "error");
    return;
  }

  const ownTeacher = getCurrentWeeklyPlannerTeacher();
  const teacherSelect = document.getElementById("weekly-planner-teacher");

  if (!ownTeacher || !teacherSelect) {
    setWeeklyPlannerMessage("Your teacher record is not available.", "error");
    return;
  }

  const copiedPlannerData = getWeeklyPlannerDataForSave(weeklyPlannerState.plannerData);
  const sourceTeacherId = sourceTeacher.teacherId;
  const sourceTeacherName = sourceTeacher.teacherName || "the selected teacher";

  if (button) setWeeklyPlannerSaveButtonState(button, "Copying...", true);

  try {
    teacherSelect.value = ownTeacher.teacherId;
    await loadWeeklyPlanner({ confirmDiscard: false });

    if (weeklyPlannerState.expectedPlannerExists && typeof window.confirm === "function") {
      const replace = window.confirm(
        "You already have a planner for this week. Replace its plan content with this copy?"
      );

      if (!replace) {
        teacherSelect.value = sourceTeacherId;
        await loadWeeklyPlanner({ confirmDiscard: false });
        return;
      }
    }

    weeklyPlannerState.plannerData = normalizeWeeklyPlannerData(
      copiedPlannerData,
      weeklyPlannerState.week
    );
    weeklyPlannerState.dirty = true;
    renderWeeklyPlannerCards();
    applyWeeklyPlannerAccessMode();
    setWeeklyPlannerMessage(
      `Copied from ${sourceTeacherName}. Edit and save it under your name.`,
      "success"
    );
  } catch (error) {
    teacherSelect.value = sourceTeacherId;
    setWeeklyPlannerMessage(error.message || "Unable to copy the planner.", "error");
  } finally {
    applyWeeklyPlannerAccessMode();
  }
}

function applyWeeklyPlannerAccessMode() {
  const groupInput = document.getElementById("weekly-planner-group");
  const saveButton = document.getElementById("weekly-planner-save");
  const canCopy = !weeklyPlannerState.canEdit && weeklyPlannerState.viewedPlannerExists;

  if (groupInput) {
    groupInput.readOnly = !weeklyPlannerState.canEdit;
    groupInput.setAttribute("aria-readonly", weeklyPlannerState.canEdit ? "false" : "true");
  }

  if (saveButton) {
    saveButton.hidden = !weeklyPlannerState.canEdit && !canCopy;
    setWeeklyPlannerSaveButtonState(
      saveButton,
      weeklyPlannerState.canEdit ? "Save" : "Copy to My Planner",
      false
    );
    saveButton.setAttribute(
      "aria-label",
      weeklyPlannerState.canEdit ? "Save planner" : "Copy to my planner"
    );
  }
}

function setWeeklyPlannerSaveButtonState(button, label, disabled) {
  if (!button) return;

  button.disabled = disabled === true;
  const labelElement = button.querySelector("[data-weekly-planner-save-label]");

  if (labelElement) {
    labelElement.textContent = String(label || "Save");
  }
}

function returnToWeeklyPlanner() {
  closeWeeklyPlannerDayEditor(false);
}

function openWeeklyPlannerDayEditor(dayIndex) {
  if (!weeklyPlannerState.plannerData) return;
  const editor = document.getElementById("weekly-planner-day-editor");
  const title = document.getElementById("weekly-planner-day-editor-title");
  weeklyPlannerState.activeCardIndex = Math.max(0, Math.min(WEEKLY_PLANNER_DAYS.length - 1, Number(dayIndex) || 0));
  weeklyPlannerState.editorSnapshot = {
    plannerData: JSON.parse(JSON.stringify(weeklyPlannerState.plannerData)),
    feedback: weeklyPlannerState.feedback,
    dirty: weeklyPlannerState.dirty
  };
  renderWeeklyPlannerCards();
  if (title) title.textContent = `Edit ${WEEKLY_PLANNER_DAYS[weeklyPlannerState.activeCardIndex].label}`;
  if (typeof editor?.showModal === "function") editor.showModal();
  else editor?.setAttribute("open", "");
  requestAnimationFrame(() => scrollWeeklyPlannerToCard(weeklyPlannerState.activeCardIndex, false));
}

async function closeWeeklyPlannerDayEditor(saveChanges) {
  const editor = document.getElementById("weekly-planner-day-editor");
  if (typeof editor?.close === "function" && editor.open) editor.close();
  else editor?.removeAttribute("open");

  if (saveChanges === true && weeklyPlannerState.canEdit) {
    weeklyPlannerState.editorSnapshot = null;
    await saveWeeklyPlannerAndPreview(null);
  } else {
    if (weeklyPlannerState.editorSnapshot) {
      weeklyPlannerState.plannerData = weeklyPlannerState.editorSnapshot.plannerData;
      weeklyPlannerState.feedback = weeklyPlannerState.editorSnapshot.feedback;
      weeklyPlannerState.dirty = weeklyPlannerState.editorSnapshot.dirty;
      const feedbackInput = document.getElementById("weekly-planner-feedback");
      if (feedbackInput) feedbackInput.value = weeklyPlannerState.feedback;
    }
    weeklyPlannerState.editorSnapshot = null;
    await generateWeeklyPlannerPreview();
  }
}

async function generateWeeklyPlannerPreview() {
  const previewImage = document.getElementById("weekly-planner-preview-image");
  const previewMessage = document.getElementById("weekly-planner-preview-message");
  const generationSequence = ++weeklyPlannerState.previewGenerationSequence;
  if (previewMessage) previewMessage.textContent = "";

  const result = await renderWeeklyPlannerImage({
    teacher: weeklyPlannerState.teacher,
    week: weeklyPlannerState.week,
    plannerData: weeklyPlannerState.plannerData,
    groupNo: weeklyPlannerState.planner?.groupNo || document.getElementById("weekly-planner-group")?.value || "",
    feedback: weeklyPlannerState.feedback || weeklyPlannerState.planner?.feedback || "",
    feedbackBy: weeklyPlannerState.planner?.feedbackBy || ""
  }, weeklyPlannerState.previewStyle);

  if (generationSequence !== weeklyPlannerState.previewGenerationSequence) return result;

  weeklyPlannerState.previewDataUrl = result.dataUrl;
  weeklyPlannerState.previewBlob = result.blob;

  if (previewImage) previewImage.src = result.dataUrl;
  if (previewMessage) previewMessage.textContent = "";
  syncWeeklyPlannerPreviewSettingsControls();
  return result;
}

function toggleWeeklyPlannerPreviewSettings(button) {
  const panel = document.getElementById("weekly-planner-preview-settings");
  if (!panel) return;

  setWeeklyPlannerPreviewSettingsOpen(panel.hidden, button);
}

function setWeeklyPlannerPreviewSettingsOpen(open, button) {
  const panel = document.getElementById("weekly-planner-preview-settings");
  const toggle = button || document.getElementById("weekly-planner-preview-settings-toggle");
  if (!panel) return;

  panel.hidden = open !== true;
  if (toggle) toggle.setAttribute("aria-expanded", String(open === true));
  if (open === true) syncWeeklyPlannerPreviewSettingsControls();
}

async function updateWeeklyPlannerPreviewStyle() {
  const fontInput = document.querySelector('input[name="weekly-planner-preview-font"]:checked');
  const colorInput = document.querySelector('input[name="weekly-planner-preview-color"]:checked');
  const previewMessage = document.getElementById("weekly-planner-preview-message");

  weeklyPlannerState.previewStyle = normalizeWeeklyPlannerPreviewStyle({
    fontKey: fontInput?.value,
    colorKey: colorInput?.value
  });
  saveWeeklyPlannerPreviewStyle(weeklyPlannerState.previewStyle);
  syncWeeklyPlannerPreviewSettingsControls();

  try {
    await generateWeeklyPlannerPreview();
  } catch (error) {
    if (previewMessage) {
      previewMessage.textContent = error.message || "Unable to update the planner preview.";
    }
  }
}

function syncWeeklyPlannerPreviewSettingsControls() {
  const style = normalizeWeeklyPlannerPreviewStyle(weeklyPlannerState.previewStyle);
  const fontInput = document.querySelector(
    `input[name="weekly-planner-preview-font"][value="${style.fontKey}"]`
  );
  const colorInput = document.querySelector(
    `input[name="weekly-planner-preview-color"][value="${style.colorKey}"]`
  );

  if (fontInput) fontInput.checked = true;
  if (colorInput) colorInput.checked = true;
}

async function shareWeeklyPlannerImage(button) {
  const previewMessage = document.getElementById("weekly-planner-preview-message");

  try {
    if (!weeklyPlannerState.previewBlob) {
      await generateWeeklyPlannerPreview();
    }

    if (typeof File !== "function") {
      await downloadWeeklyPlannerImage();
      return;
    }

    const fileName = getWeeklyPlannerImageFileName();
    const file = new File([weeklyPlannerState.previewBlob], fileName, { type: "image/png" });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({ files: [file] });
      if (previewMessage) previewMessage.textContent = "";
      return;
    }

    await downloadWeeklyPlannerImage();
  } catch (error) {
    if (error && error.name === "AbortError") return;
    if (previewMessage) previewMessage.textContent = error.message || "Unable to share the image.";
  } finally {
    if (button) button.blur();
  }
}

async function saveWeeklyPlannerPreviewToDrive(button) {
  const previewMessage = document.getElementById("weekly-planner-preview-message");
  const originalLabel = getWeeklyPlannerButtonLabel(button, "Save");

  try {
    if (previewMessage) previewMessage.textContent = "";

    if (!weeklyPlannerState.previewBlob || !weeklyPlannerState.previewDataUrl) {
      await generateWeeklyPlannerPreview();
    }

    if (!weeklyPlannerState.previewBlob || !weeklyPlannerState.previewDataUrl) {
      throw new Error("The planner preview is not ready to save.");
    }

    const fileName = getWeeklyPlannerImageFileName();
    const confirmed = confirmWeeklyPlannerDriveSaveDestination(fileName);

    if (!confirmed) {
      if (previewMessage) previewMessage.textContent = "Save cancelled.";
      return false;
    }

    setWeeklyPlannerHeaderActionState(button, "Saving...", true);

    const result = await apiPost("/api/admin/weekly-planner/save-preview", {
      fileName,
      mimeType: "image/png",
      dataUrl: weeklyPlannerState.previewDataUrl,
      teacherName: String(weeklyPlannerState.teacher?.teacherName || state?.username || "Teacher").trim(),
      saveDate: getWeeklyPlannerTodayDateString(),
      weekStart: String(weeklyPlannerState.week?.weekStart || "")
    }, state.token);

    if (!result.success) {
      throw new Error(result.error || result.detail || "Unable to save the planner preview to Google Drive.");
    }

    const savedName = result.fileName || fileName;
    openWeeklyPlannerSaveDialog(
      `Saved to ${result.destinationLabel || "Google Drive"}: ${savedName}`
    );

    if (previewMessage) previewMessage.textContent = "";
    return true;
  } catch (error) {
    openWeeklyPlannerSaveDialog(error.message || "Unable to save the planner preview to Google Drive.");
    return false;
  } finally {
    setWeeklyPlannerHeaderActionState(button, originalLabel, false);
    if (button) button.blur();
  }
}

function confirmWeeklyPlannerDriveSaveDestination(fileName) {
  if (typeof window.confirm !== "function") return true;
  return window.confirm([
    "Submit this weekly planner to the configured Google Drive folder?",
    "",
    `Filename: ${fileName}`
  ].join("\n"));
}

function setWeeklyPlannerHeaderActionState(button, label, disabled) {
  if (!button) return;

  button.disabled = disabled === true;
  const labelElement = button.querySelector(".weekly-planner-header-action__label");

  if (labelElement) {
    labelElement.textContent = String(label || "Save");
  }
}

function getWeeklyPlannerButtonLabel(button, fallback) {
  return String(
    button?.querySelector(".weekly-planner-header-action__label")?.textContent ||
    fallback ||
    "Save"
  );
}

async function downloadWeeklyPlannerImage(button) {
  const previewMessage = document.getElementById("weekly-planner-preview-message");

  try {
    if (previewMessage) previewMessage.textContent = "";

    if (!weeklyPlannerState.previewBlob) {
      await generateWeeklyPlannerPreview();
    }
    if (!weeklyPlannerState.previewBlob) {
      throw new Error("The planner preview is not ready to save.");
    }

    const fileName = getWeeklyPlannerImageFileName();
    const previewBlob = weeklyPlannerState.previewBlob;

    if (isAppleTouchDevice() && typeof File === "function" && navigator.share) {
      const file = new File([previewBlob], fileName, { type: "image/png" });
      let canShareFile = true;

      if (typeof navigator.canShare === "function") {
        try {
          canShareFile = navigator.canShare({ files: [file] });
        } catch (_error) {
          canShareFile = false;
        }
      }

      if (canShareFile) {
        try {
          await navigator.share({ files: [file] });
          openWeeklyPlannerSaveDialog(
            `${fileName} was sent to the destination selected in the system menu.`
          );
          return true;
        } catch (error) {
          if (error && error.name === "AbortError") return false;
          // If the native file sheet is unavailable or blocked, retain the
          // Blob-download fallback instead of leaving the user without a file.
        }
      }
    }

    const objectUrl = URL.createObjectURL(previewBlob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Safari may begin consuming the Blob URL after the click task completes.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);

    openWeeklyPlannerSaveDialog(
      `${fileName} is being saved to your default Downloads folder.`
    );
    return true;
  } catch (error) {
    openWeeklyPlannerSaveDialog(error.message || "Unable to save the planner image.");
    return false;
  } finally {
    if (button) button.blur();
  }
}

function isAppleTouchDevice() {
  const userAgent = String(navigator.userAgent || "");
  const platform = String(navigator.platform || "");
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1);
}

function openWeeklyPlannerSaveDialog(message) {
  const dialog = document.getElementById("weekly-planner-save-dialog");
  const messageElement = document.getElementById("weekly-planner-save-dialog-message");
  if (!dialog || !messageElement) return;

  messageElement.textContent = String(message || "");

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  window.requestAnimationFrame(() => {
    dialog.querySelector(".weekly-planner-save-dialog-close")?.focus();
  });
}

function closeWeeklyPlannerSaveDialog() {
  const dialog = document.getElementById("weekly-planner-save-dialog");
  if (!dialog) return;

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function getWeeklyPlannerDataForSave(value) {
  const source = value && typeof value === "object" ? value : { days: [] };
  const days = Array.isArray(source.days) ? source.days : [];

  return {
    version: 1,
    days: WEEKLY_PLANNER_DAYS.map((dayConfig, dayIndex) => {
      const day = days[dayIndex] || {};
      const periods = Array.isArray(day.periods) ? day.periods : [];
      return {
        key: dayConfig.key,
        label: dayConfig.label,
        date: String(day.date || addWeeklyPlannerDays(weeklyPlannerState.week?.weekStart || "", dayIndex)),
        periods: Array.from({ length: WEEKLY_PLANNER_PERIOD_COUNT }, (_, periodIndex) => {
          const period = periods[periodIndex] || {};
          return {
            id: String(period.id || `period-${periodIndex + 1}`),
            label: String(period.label || getWeeklyPlannerPeriodLabel(periodIndex)),
            subject: String(period.subject || ""),
            entries: normalizeWeeklyPlannerEntries(period.entries)
          };
        })
      };
    })
  };
}

function getWeeklyPlannerImageFileName() {
  const teacherName = String(weeklyPlannerState.teacher?.teacherName || state?.username || "Teacher").trim();
  const safeTeacherName = sanitizeWeeklyPlannerFileNamePart(teacherName) || "Teacher";
  return `${safeTeacherName}_${getWeeklyPlannerTodayDateString()}.png`;
}

function getWeeklyPlannerTodayDateString() {
  const now = new Date();
  const pad = value => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("-");
}

function sanitizeWeeklyPlannerFileNamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeWeeklyPlannerPreviewStyle(value) {
  const source = value && typeof value === "object" ? value : {};
  const fontKey = Object.prototype.hasOwnProperty.call(WEEKLY_PLANNER_PREVIEW_FONTS, source.fontKey)
    ? source.fontKey
    : WEEKLY_PLANNER_DEFAULT_PREVIEW_STYLE.fontKey;
  const colorKey = Object.prototype.hasOwnProperty.call(WEEKLY_PLANNER_PREVIEW_COLORS, source.colorKey)
    ? source.colorKey
    : WEEKLY_PLANNER_DEFAULT_PREVIEW_STYLE.colorKey;

  return { fontKey, colorKey };
}

function loadWeeklyPlannerPreviewStyle() {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    const storedValue = storage?.getItem(WEEKLY_PLANNER_PREVIEW_STYLE_STORAGE_KEY);
    return normalizeWeeklyPlannerPreviewStyle(storedValue ? JSON.parse(storedValue) : null);
  } catch (error) {
    return normalizeWeeklyPlannerPreviewStyle(null);
  }
}

function saveWeeklyPlannerPreviewStyle(value) {
  try {
    const storage = typeof window !== "undefined" ? window.localStorage : null;
    storage?.setItem(
      WEEKLY_PLANNER_PREVIEW_STYLE_STORAGE_KEY,
      JSON.stringify(normalizeWeeklyPlannerPreviewStyle(value))
    );
  } catch (error) {
    // Preview preferences are optional; private browsing may block local storage.
  }
}

function resolveWeeklyPlannerTextColor() {
  try {
    if (typeof document === "undefined" || typeof getComputedStyle !== "function") {
      return "#111111";
    }

    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--text")
      .trim();
    return value || "#111111";
  } catch (error) {
    return "#111111";
  }
}

function getResolvedWeeklyPlannerPreviewStyle(value) {
  const style = normalizeWeeklyPlannerPreviewStyle(value);
  const font = WEEKLY_PLANNER_PREVIEW_FONTS[style.fontKey];
  const color = WEEKLY_PLANNER_PREVIEW_COLORS[style.colorKey];

  return {
    ...style,
    fontFamily: font.family,
    ink: style.colorKey === "normal" ? resolveWeeklyPlannerTextColor() : color.value
  };
}

async function renderWeeklyPlannerImage(model, previewStyleValue = weeklyPlannerState.previewStyle) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 2000;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Image preview is not supported by this browser.");

  const previewStyle = getResolvedWeeklyPlannerPreviewStyle(previewStyleValue);
  const colors = {
    page: "#efd7dc",
    paper: "#fffefb",
    cream: "#eadfbd",
    ink: previewStyle.ink,
    inkFont: previewStyle.fontFamily,
    text: "#111111",
    muted: "#4f534d",
    line: "#737772"
  };

  context.fillStyle = colors.page;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colors.paper;
  context.fillRect(26, 22, canvas.width - 52, canvas.height - 44);
  context.fillStyle = colors.page;
  context.fillRect(26, 22, canvas.width - 52, 270);

  let logo = null;
  try {
    logo = await loadWeeklyPlannerImage("/academy.png");
  } catch (error) {
    console.warn("Weekly Planner logo could not be loaded:", error);
  }

  if (logo) {
    context.save();
    weeklyPlannerRoundRectPath(context, 52, 50, 190, 190, 95);
    context.clip();
    context.drawImage(logo, 52, 50, 190, 190);
    context.restore();
  }

  context.fillStyle = colors.text;
  context.font = "900 70px Arial, sans-serif";
  context.fillText("UMM ABBAD ACADEMY", 270, 102);
  context.font = "italic 800 32px Arial, sans-serif";
  context.fillText("REBOOT YOUR MAKTAB WEEKLY PLANNER", 274, 150);

  context.font = "900 25px Arial, sans-serif";
  context.fillText("NAME OF MUALLIMA:", 274, 205);
  context.fillText("MONTH:", 930, 205);
  context.fillText("WEEK:", 274, 252);
  context.fillText("GROUP:", 930, 252);

  context.fillStyle = colors.ink;
  weeklyPlannerDrawTextBox(context, model.teacher?.teacherName || "", 575, 171, 325, 44, {
    color: colors.ink,
    fontFamily: colors.inkFont,
    fontWeight: "600",
    fontSize: 34,
    minFontSize: 22,
    lineHeight: 1.08,
    verticalAlign: "center"
  });
  weeklyPlannerDrawTextBox(context, model.week?.month || "", 1060, 175, 270, 40, {
    color: colors.ink,
    fontFamily: colors.inkFont,
    fontWeight: "600",
    fontSize: 30,
    minFontSize: 20,
    lineHeight: 1.08,
    verticalAlign: "center"
  });
  weeklyPlannerDrawTextBox(context, formatWeeklyPlannerRange(model.week), 395, 222, 505, 40, {
    color: colors.ink,
    fontFamily: colors.inkFont,
    fontWeight: "600",
    fontSize: 30,
    minFontSize: 20,
    lineHeight: 1.08,
    verticalAlign: "center"
  });
  weeklyPlannerDrawTextBox(context, String(model.groupNo || ""), 1060, 222, 270, 40, {
    color: colors.ink,
    fontFamily: colors.inkFont,
    fontWeight: "600",
    fontSize: 30,
    minFontSize: 20,
    lineHeight: 1.08,
    verticalAlign: "center"
  });

  const dayPanelWidth = 637;
  const dayPanelHeight = 650;
  const panelGap = 36;
  const panelX = [45, 45 + dayPanelWidth + panelGap];
  const panelY = [320, 1000];

  WEEKLY_PLANNER_DAYS.forEach((dayConfig, index) => {
    const day = model.plannerData?.days?.[index] || {
      label: dayConfig.label,
      date: addWeeklyPlannerDays(model.week?.weekStart, index),
      periods: []
    };
    drawWeeklyPlannerDayPanel(
      context,
      day,
      panelX[index % 2],
      panelY[Math.floor(index / 2)],
      dayPanelWidth,
      dayPanelHeight,
      colors
    );
  });

  drawWeeklyPlannerFeedbackPanel(context, model, 45, 1680, 1310, 260, colors);

  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(value => {
      if (value) resolve(value);
      else reject(new Error("Could not create the planner PNG."));
    }, "image/png");
  });

  return { dataUrl, blob };
}

function drawWeeklyPlannerDayPanel(context, day, x, y, width, height, colors) {
  const headingHeight = 72;
  const periods = Array.isArray(day.periods) && day.periods.length
    ? day.periods
    : [{ label: "Period One", subject: "", entries: [] }];
  const bodyHeight = height - headingHeight;
  const rowHeight = bodyHeight / periods.length;
  const periodColumnWidth = 150;

  context.fillStyle = colors.paper;
  context.fillRect(x, y, width, height);
  context.fillStyle = colors.cream;
  context.fillRect(x, y, width, headingHeight);
  context.strokeStyle = colors.line;
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);
  context.beginPath();
  context.moveTo(x, y + headingHeight);
  context.lineTo(x + width, y + headingHeight);
  context.stroke();

  context.fillStyle = colors.text;
  context.font = "500 34px Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(String(day.label || "").toUpperCase(), x + width / 2, y + 48);
  context.textAlign = "left";

  periods.forEach((period, index) => {
    const rowY = y + headingHeight + index * rowHeight;

    if (index > 0) {
      context.beginPath();
      context.moveTo(x, rowY);
      context.lineTo(x + width, rowY);
      context.stroke();
    }

    context.beginPath();
    context.moveTo(x + periodColumnWidth, rowY);
    context.lineTo(x + periodColumnWidth, rowY + rowHeight);
    context.stroke();

    weeklyPlannerDrawTextBox(context, String(period.label || "").toUpperCase(), x + 8, rowY + 12, periodColumnWidth - 16, rowHeight - 24, {
      color: colors.text,
      fontFamily: "Arial, sans-serif",
      fontWeight: "900",
      fontSize: 25,
      minFontSize: 18,
      lineHeight: 1.02,
      verticalAlign: "center"
    });

    const contentX = x + periodColumnWidth + 18;
    const contentWidth = width - periodColumnWidth - 36;
    weeklyPlannerDrawTextBox(context, period.subject || "", contentX, rowY + 12, contentWidth, Math.min(34, rowHeight * 0.25), {
      color: colors.muted,
      fontFamily: "Arial, sans-serif",
      fontWeight: "800",
      fontSize: 23,
      minFontSize: 17,
      lineHeight: 1.05
    });
    weeklyPlannerDrawTextBox(context, normalizeWeeklyPlannerEntries(period.entries).join("\n"), contentX, rowY + 47, contentWidth, Math.max(32, rowHeight - 58), {
      color: colors.ink,
      fontFamily: colors.inkFont,
      fontWeight: "700",
      fontSize: 32,
      minFontSize: 20,
      lineHeight: 1.12,
      verticalAlign: "center"
    });
  });
}

function drawWeeklyPlannerFeedbackPanel(context, model, x, y, width, height, colors) {
  const headingHeight = 66;

  context.fillStyle = colors.paper;
  context.fillRect(x, y, width, height);
  context.fillStyle = colors.cream;
  context.fillRect(x, y, width, headingHeight);
  context.strokeStyle = colors.line;
  context.lineWidth = 2;
  context.strokeRect(x, y, width, height);
  context.beginPath();
  context.moveTo(x, y + headingHeight);
  context.lineTo(x + width, y + headingHeight);
  context.stroke();

  context.fillStyle = colors.text;
  context.font = "900 34px Arial, sans-serif";
  context.fillText("WEEKLY FEEDBACK", x + 28, y + 45);

  weeklyPlannerDrawTextBox(context, model.feedback || "", x + 28, y + headingHeight + 18, width - 56, height - headingHeight - 52, {
    color: colors.ink,
    fontFamily: colors.inkFont,
    fontWeight: "700",
    fontSize: 28,
    minFontSize: 19,
    lineHeight: 1.16
  });
}

function weeklyPlannerDrawTextBox(context, text, x, y, width, height, options = {}) {
  const content = String(text || "").trim();
  if (!content || width <= 0 || height <= 0) return;

  const fontFamily = options.fontFamily || "Arial, sans-serif";
  const fontWeight = options.fontWeight || "400";
  const startingSize = Number(options.fontSize || 24);
  const minimumSize = Number(options.minFontSize || 14);
  const lineHeightMultiplier = Number(options.lineHeight || 1.15);
  let fontSize = startingSize;
  let lines = [];
  let lineHeight = fontSize * lineHeightMultiplier;

  while (fontSize >= minimumSize) {
    context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = weeklyPlannerWrapText(context, content, width);
    lineHeight = fontSize * lineHeightMultiplier;
    if (lines.length * lineHeight <= height) break;
    fontSize -= 1;
  }

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.fillStyle = options.color || "#111111";
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = options.textAlign || "left";
  context.textBaseline = "top";

  const textHeight = lines.length * lineHeight;
  const startY = options.verticalAlign === "center"
    ? y + Math.max(0, (height - textHeight) / 2)
    : y;
  const drawX = context.textAlign === "center" ? x + width / 2 : x;

  lines.forEach((line, index) => {
    context.fillText(line, drawX, startY + index * lineHeight);
  });
  context.restore();
}

function weeklyPlannerWrapText(context, text, maxWidth) {
  const lines = [];
  String(text || "").split(/\r?\n/).forEach(paragraph => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let line = words.shift();
    words.forEach(word => {
      const candidate = `${line} ${word}`;
      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    });
    lines.push(line);
  });
  return lines;
}

function weeklyPlannerRoundRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function loadWeeklyPlannerImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${src}`));
    image.src = src;
  });
}

function getSelectedWeeklyPlannerTeacher() {
  const select = document.getElementById("weekly-planner-teacher");
  const teacherId = String(select?.value || state.user?.adminid || "").trim();
  return weeklyPlannerState.teachers.find(teacher => teacher.teacherId === teacherId) || null;
}

function getCurrentWeeklyPlannerTeacher() {
  const ownTeacherId = String(state.user?.adminid || "").trim();
  return weeklyPlannerState.teachers.find(teacher => teacher.teacherId === ownTeacherId) || (
    ownTeacherId
      ? {
        teacherId: ownTeacherId,
        teacherName: String(state.user?.username || "Teacher").trim(),
        role: String(state.user?.role || "").trim().toUpperCase(),
        assignedGroup: String(state.user?.assignedgroup || "").trim(),
        active: true
      }
      : null
  );
}

function isOwnWeeklyPlannerTeacher(teacher) {
  return !!teacher && teacher.teacherId === String(state.user?.adminid || "").trim();
}

function getWeeklyPlannerWeekMeta(value) {
  const source = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    ? new Date(`${value}T12:00:00`)
    : new Date();
  const date = Number.isNaN(source.getTime()) ? new Date() : source;
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);

  const end = new Date(date);
  end.setDate(end.getDate() + 3);

  const weekStart = formatWeeklyPlannerInputDate(date);
  const weekEnd = formatWeeklyPlannerInputDate(end);
  const startMonth = date.toLocaleDateString(undefined, { month: "long" });
  const endMonth = end.toLocaleDateString(undefined, { month: "long" });
  const month = date.getMonth() === end.getMonth()
    ? `${startMonth} ${date.getFullYear()}`
    : `${startMonth} / ${endMonth} ${date.getFullYear()}`;

  return { weekStart, weekEnd, month };
}

function formatWeeklyPlannerRange(week) {
  if (!week?.weekStart || !week?.weekEnd) return "";
  const start = new Date(`${week.weekStart}T12:00:00`);
  const end = new Date(`${week.weekEnd}T12:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    const month = end.toLocaleDateString(undefined, { month: "short" });
    return `${start.getDate()}–${end.getDate()} ${month} ${end.getFullYear()}`;
  }

  const startText = start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const endText = end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return `${startText}–${endText}`;
}

function formatWeeklyPlannerDisplayDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatWeeklyPlannerInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addWeeklyPlannerDays(dateText, dayCount) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))
    ? new Date(`${dateText}T12:00:00`)
    : new Date();
  date.setDate(date.getDate() + Number(dayCount || 0));
  return formatWeeklyPlannerInputDate(date);
}

function getWeeklyPlannerTimeMinutes(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 24 * 60);
  }

  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  let hour = Number(match[1] || 0);
  const minute = Number(match[2] || 0);
  if (match[3] === "pm" && hour < 12) hour += 12;
  if (match[3] === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function getWeeklyPlannerPeriodLabel(index) {
  const words = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
  return `Period ${words[index] || index + 1}`;
}

function setWeeklyPlannerMessage(message, type) {
  const element = document.getElementById("weekly-planner-message");
  if (!element) return;

  element.textContent = String(message || "");
  element.classList.toggle("error-message", type === "error");
  element.classList.toggle("success-message", type === "success");
}

function weeklyPlannerNormalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function weeklyPlannerEscapeHtml(value) {
  if (typeof escapeHtml === "function") return escapeHtml(value);
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function weeklyPlannerEscapeAttribute(value) {
  return weeklyPlannerEscapeHtml(value).replace(/`/g, "&#096;");
}

window.showWeeklyPlanner = showWeeklyPlanner;
window.saveWeeklyPlannerAndPreview = saveWeeklyPlannerAndPreview;
window.returnToWeeklyPlanner = returnToWeeklyPlanner;
window.openWeeklyPlannerDayEditor = openWeeklyPlannerDayEditor;
window.closeWeeklyPlannerDayEditor = closeWeeklyPlannerDayEditor;
window.shareWeeklyPlannerImage = shareWeeklyPlannerImage;
window.downloadWeeklyPlannerImage = downloadWeeklyPlannerImage;
window.closeWeeklyPlannerSaveDialog = closeWeeklyPlannerSaveDialog;
window.toggleWeeklyPlannerPreviewSettings = toggleWeeklyPlannerPreviewSettings;
window.updateWeeklyPlannerPreviewStyle = updateWeeklyPlannerPreviewStyle;
window.M4LWeeklyPlanner = {
  show: showWeeklyPlanner,
  load: loadWeeklyPlanner,
  renderPreview: renderWeeklyPlannerImage,
  getWeekMeta: getWeeklyPlannerWeekMeta,
  buildPlannerDataFromDefaults: buildWeeklyPlannerDataFromDefaults,
  getPlannerDataForSave: getWeeklyPlannerDataForSave,
  normalizePreviewStyle: normalizeWeeklyPlannerPreviewStyle,
  canReuseSession: canReuseWeeklyPlannerSession,
  canEdit: () => weeklyPlannerState.canEdit,
  copyToCurrentUser: copyWeeklyPlannerToCurrentUser,
  hasUnsavedChanges: () => weeklyPlannerState.dirty,
  previewFonts: WEEKLY_PLANNER_PREVIEW_FONTS,
  previewColors: WEEKLY_PLANNER_PREVIEW_COLORS
};
