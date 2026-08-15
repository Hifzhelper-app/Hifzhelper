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

function renderCommentBlock(containerId, existingEntry){
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

function readCommentBlock(containerId){
  const el = document.getElementById(containerId);
  return {
    student_comment: el.querySelector('.cb-comment').value || null,
    student_comment_private: el.querySelector('.cb-private-checkbox').checked
  };
}
