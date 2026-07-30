// ============================================================
// Hifzhelper -- shared student-comment + privacy block
// student_comment is the student's own performance self-assessment
// (distinct from tadabbur/reflection on content, and distinct from
// teacher_feedback, which isn't editable here -- a student doesn't write
// their own teacher's feedback). Renders a textarea + a private/public
// switch. teacher_feedback is shown read-only if present, respecting
// whatever visibility already applied server-side (a student who can see
// it at all is always allowed to see it -- the server already filtered).
//
// Scoped to whichever container it's rendered into (V3.6.1) -- previously
// used fixed #cb_comment/#cb_private ids, which only ever worked because
// exactly one detail page was mounted at a time. The unified day-log view
// mounts all 3 log cards simultaneously, so this now reads/writes via
// class-scoped queries inside the given container instead of global ids.
//
// V3.12.0: "Your comment on this session" -> "Notes"; the private
// checkbox ("keep hidden from teachers") is now a genuine Private/Public
// switch, using the same component as Setup (js/uiSwitch.js) -- default
// Public, switching shows Private. Container gets a unique switch-track id
// per instance (containerId-based) since renderSwitch/wireSwitch key off
// a single element id, and this block can be mounted more than once.
// ============================================================

function renderCommentBlock(containerId, existingEntry){
  const el = document.getElementById(containerId);
  const feedback = existingEntry && existingEntry.teacher_feedback;
  const switchId = containerId + '_privacySwitch';
  const isPrivate = !!(existingEntry && existingEntry.student_comment_private);
  el.innerHTML = `
    <label>Notes</label>
    <textarea class="cb-comment" rows="2">${existingEntry && existingEntry.student_comment ? existingEntry.student_comment : ''}</textarea>
    <div class="switch-track switch-track-small-wide" id="${switchId}" style="margin-top:8px;">
      <div class="switch-thumb"></div>
      <button type="button" class="switch-option" data-value="public">Public</button>
      <button type="button" class="switch-option" data-value="private">Private</button>
    </div>
    ${feedback ? `<div class="teacher-feedback-box"><strong>Teacher feedback:</strong> ${feedback}</div>` : ''}
  `;
  renderSwitch(switchId, isPrivate ? 'private' : 'public');
  wireSwitch(switchId, (value) => renderSwitch(switchId, value));
}

function readCommentBlock(containerId){
  const el = document.getElementById(containerId);
  const activeOption = el.querySelector('.switch-option.active');
  return {
    student_comment: el.querySelector('.cb-comment').value || null,
    student_comment_private: !!(activeOption && activeOption.dataset.value === 'private')
  };
}
