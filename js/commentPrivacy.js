// ============================================================
// Hifzhelper — shared student-comment + privacy block
// student_comment is the student's own performance self-assessment
// (distinct from tadabbur/reflection on content, and distinct from
// teacher_feedback, which isn't editable here — a student doesn't write
// their own teacher's feedback). Renders a textarea + a private checkbox.
// teacher_feedback is shown read-only if present, respecting whatever
// visibility already applied server-side (a student who can see it at
// all is always allowed to see it — the server already filtered).
// ============================================================

function renderCommentBlock(containerId, existingEntry){
  const el = document.getElementById(containerId);
  const feedback = existingEntry && existingEntry.teacher_feedback;
  el.innerHTML = `
    <label>Your comment on this session</label>
    <textarea id="cb_comment" rows="2">${existingEntry && existingEntry.student_comment ? existingEntry.student_comment : ''}</textarea>
    <label style="display:flex;align-items:center;gap:8px;margin-top:8px;">
      <input type="checkbox" id="cb_private" style="width:auto;" ${existingEntry && existingEntry.student_comment_private ? 'checked' : ''}>
      Keep this comment private (hidden from teachers)
    </label>
    ${feedback ? `<div class="teacher-feedback-box"><strong>Teacher feedback:</strong> ${feedback}</div>` : ''}
  `;
}

function readCommentBlock(){
  return {
    student_comment: document.getElementById('cb_comment').value || null,
    student_comment_private: document.getElementById('cb_private').checked
  };
}
