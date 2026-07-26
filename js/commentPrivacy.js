// ============================================================
// Hifzhelper — shared student-comment + privacy block
// student_comment is the student's own performance self-assessment
// (distinct from tadabbur/reflection on content, and distinct from
// teacher_feedback, which isn't editable here — a student doesn't write
// their own teacher's feedback). Renders a textarea + a private checkbox.
// teacher_feedback is shown read-only if present, respecting whatever
// visibility already applied server-side (a student who can see it at
// all is always allowed to see it — the server already filtered).
//
// Scoped to whichever container it's rendered into (V3.6.1) — previously
// used fixed #cb_comment/#cb_private ids, which only ever worked because
// exactly one detail page was mounted at a time. The unified day-log view
// mounts all 3 log cards simultaneously, so this now reads/writes via
// class-scoped queries inside the given container instead of global ids.
// ============================================================

function renderCommentBlock(containerId, existingEntry){
  const el = document.getElementById(containerId);
  const feedback = existingEntry && existingEntry.teacher_feedback;
  el.innerHTML = `
    <label>Your comment on this session</label>
    <textarea class="cb-comment" rows="2">${existingEntry && existingEntry.student_comment ? existingEntry.student_comment : ''}</textarea>
    <label style="display:flex;align-items:center;gap:8px;margin-top:8px;">
      <input type="checkbox" class="cb-private" style="width:auto;" ${existingEntry && existingEntry.student_comment_private ? 'checked' : ''}>
      Keep this comment private (hidden from teachers)
    </label>
    ${feedback ? `<div class="teacher-feedback-box"><strong>Teacher feedback:</strong> ${feedback}</div>` : ''}
  `;
}

function readCommentBlock(containerId){
  const el = document.getElementById(containerId);
  return {
    student_comment: el.querySelector('.cb-comment').value || null,
    student_comment_private: el.querySelector('.cb-private').checked
  };
}
