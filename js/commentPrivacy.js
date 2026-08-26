// ============================================================
// Hifzhelper -- shared student-comment + privacy block
// student_comment is the student's own performance self-assessment
// (distinct from tadabbur/reflection on content, and distinct from
// teacher_feedback, which isn't editable here). Renders a textarea + a
// private/public checkbox. teacher_feedback is shown read-only if present.
//
// Scoped to whichever container it's rendered into (V3.6.1) -- class-
// scoped queries inside the given container, not global ids, since the
// unified day-log view mounts all 3 log cards simultaneously.
//
// V3.14.2: reverted from V3.12.0's Public/Private switch back to a plain
// checkbox next to "Notes" -- default unchecked (public), checked means
// private. The switch was judged too large for what's a minor, occasional
// toggle.
// V3.18.0: the checkbox+label move up onto the same row as the "Notes"
// label itself, instead of sitting on their own row below the textarea.
// V3.56.0 (2026-08-15, confirmed in chat -- maktab delivery (b)): default
// flipped to PRIVATE for NEW entries -- a fresh form renders the checkbox
// checked; an existing entry still shows its own stored value exactly as
// before. Paired with the worker-side fresh-save note fix (the same
// delivery): before it, this checkbox's value was silently dropped on new
// saves anyway.
// ============================================================

// V3.64.0 (maktab): in MAKTAB mode this same block renders the teacher's
// side instead of the student's -- teacher note ABOVE, editable, with the
// three small visibility radios (Public/Teachers/Private, Teachers
// default); the student's note BELOW, read-only, and only when there IS
// one (it flowed from their PJ and is not the teacher's to edit -- it
// freezes into the maktab row on save exactly as displayed). Everything
// else about the card is the PJ's, unchanged. All confirmed in chat
// 2026-08-16.
function renderCommentBlock(containerId, existingEntry){
  if(typeof logCtxIsMaktab === 'function' && logCtxIsMaktab()) return renderMaktabCommentBlock(containerId, existingEntry);
  const el = document.getElementById(containerId);
  const feedback = existingEntry && existingEntry.teacher_feedback;
  const isPrivate = existingEntry ? !!existingEntry.student_comment_private : true;
  el.innerHTML = `
    <div class="notes-header-row">
      <label>Notes</label>
      <label class="cb-private-row">
        <input type="checkbox" class="cb-private-checkbox"${isPrivate ? ' checked' : ''}>
        Private
      </label>
    </div>
    <textarea class="cb-comment" rows="2">${existingEntry && existingEntry.student_comment ? existingEntry.student_comment : ''}</textarea>
    ${feedback ? `<div class="teacher-feedback-box"><strong>Teacher feedback:</strong> ${feedback}</div>` : ''}
  `;
}

function esc(v){ const d = document.createElement('span'); d.textContent = v == null ? '' : String(v); return d.innerHTML; }

function renderMaktabCommentBlock(containerId, existingEntry){
  const el = document.getElementById(containerId);
  const vis = (existingEntry && existingEntry.teacher_feedback_visibility) || 'teachers_only';
  const teacherNote = (existingEntry && existingEntry.teacher_feedback) || '';
  // The student's note, read-only. Either already frozen onto a saved
  // maktab row, or -- for a new entry -- the student's own non-private
  // PJ note for this day, the third permitted PJ input.
  // V3.64.1 fix: this used to read el.dataset.pjNote, which NOTHING ever
  // set, so the note silently never appeared. The fetch had existed in
  // V3.63.0 and was dropped in the rewrite, leaving the read dangling.
  // V3.73.0: the live PJ-note lookup is gone. A note FROZEN onto a saved
  // maktab row still shows — that is maktab data on a maktab row.
  const studentNote = (existingEntry && existingEntry.student_comment) || '';

  // V3.73.0: three full-size radios became the SAME segmented control the
  // Quarter/Half/Juz portion selector uses, at the .switch-track-small-wide
  // size — a compact variant that already existed in detail-pages.css and
  // had never been wired to anything.
  //
  // It sits INSIDE the note box because it governs who can see THE NOTE,
  // not the entry. Detached above the box, it read as unrelated chrome.
  const opt = (value, label) =>
    `<button type="button" class="switch-option${vis === value ? ' active' : ''}" data-value="${value}" role="radio" aria-checked="${vis === value}">${label}</button>`;
  el.innerHTML = `
    <div class="cb-note-box">
      <div class="cb-note-head">
        <label>Teacher note</label>
        <div class="switch-track switch-track-small-wide mk-vis-switch" role="radiogroup" aria-label="Teacher note visibility">
          ${opt('all', 'Public')}${opt('teachers_only', 'Teachers')}${opt('private', 'Private')}
        </div>
      </div>
      <textarea class="cb-teacher-note" rows="2">${esc(teacherNote)}</textarea>
    </div>
    ${studentNote ? `<div class="mk-student-note"><span class="mk-student-note-label">Student note</span><div class="mk-student-note-text">${esc(studentNote)}</div></div>` : ''}
  `;
}

// V3.73.0: wired by DELEGATION on document, once — not per render.
// renderCommentBlock rewrites innerHTML on every entry load and mode change,
// so per-render listeners would either leak or silently stop working after a
// re-render.
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.mk-vis-switch .switch-option');
  if(!btn) return;
  btn.closest('.mk-vis-switch').querySelectorAll('.switch-option').forEach(b => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
});

function readCommentBlock(containerId){
  const el = document.getElementById(containerId);
  if(typeof logCtxIsMaktab === 'function' && logCtxIsMaktab()){
    const noteEl = el.querySelector('.mk-student-note-text');
    // .dataset.value, not .value: these are buttons now, not radios.
    const checked = el.querySelector('.mk-vis-switch .switch-option.active');
    return {
      teacher_feedback: el.querySelector('.cb-teacher-note').value || null,
      teacher_feedback_visibility: checked ? checked.dataset.value : 'teachers_only',
      // frozen exactly as displayed; absent when there was nothing to show
      student_comment: noteEl ? noteEl.textContent : null,
    };
  }
  return {
    student_comment: el.querySelector('.cb-comment').value || null,
    student_comment_private: el.querySelector('.cb-private-checkbox').checked
  };
}
