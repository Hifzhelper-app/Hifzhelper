// Hifzhelper -- shared custom date display (2026-08-03, confirmed in
// chat). A native <input type="date">'s own displayed text is entirely
// browser/OS-controlled -- no amount of CSS can reformat it, which is
// exactly why desktop Chrome and mobile Safari were showing 2 different
// formats for the identical date. This wraps each date input with a
// visible button showing a consistent "DDD dd-MMM" format everywhere,
// while leaving the input itself fully intact underneath -- same id,
// same .value, same change event -- so every existing read/write against
// it (payload construction, etc.) keeps working completely unchanged.
// Only how it's DISPLAYED changes.

function formatCustomDate(iso){
  if(!iso) return 'Select date';
  const [y, m, d] = iso.split('-').map(Number);
  // Parsed as UTC and formatted as UTC throughout, deliberately -- iso is
  // a plain YYYY-MM-DD with no time/zone component, so treating it as
  // local time here would risk toLocaleDateString rolling it back or
  // forward a day right at midnight in some timezones. Matches the
  // convention the input's own value already uses (a bare date, not a
  // moment in time).
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const day = String(d).padStart(2, '0');
  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${weekday} ${day}-${month}`;
}

// Call once, right after the target <input type="date"> exists in the
// DOM (idempotent via dataset.customDateWired -- safe to call again if a
// render function that creates this markup runs more than once in a
// session, won't double-wrap).
function wireCustomDateDisplay(inputId){
  const input = document.getElementById(inputId);
  if(!input || input.dataset.customDateWired) return;
  input.dataset.customDateWired = 'true';
  const originalClasses = input.className;

  const wrap = document.createElement('div');
  wrap.className = 'custom-date-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  input.classList.add('native-date-hidden');

  const display = document.createElement('button');
  display.type = 'button';
  display.className = ('custom-date-display ' + originalClasses).trim();
  wrap.appendChild(display);

  const render = () => { display.textContent = formatCustomDate(input.value); };

  // Bug fix (2026-08-04): every page sets this input's date with a plain
  // input.value = todayISO() assignment (or entry.date, when loading an
  // entry for edit) -- that NEVER fires a 'change' event on its own,
  // which is standard, unavoidable DOM behavior, not a bug in those
  // files. A listener on 'change' alone only ever catches the user
  // actually using the picker; it missed every one of those programmatic
  // sets entirely, which is exactly why the display stayed stuck on
  // "Select date" even once the real value had been set moments later.
  // Overriding the native value property itself means ANY assignment --
  // from the picker, or from any of those other call sites, present or
  // future -- re-renders automatically, without needing to find and
  // update every caller individually.
  const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  Object.defineProperty(input, 'value', {
    get(){ return nativeDescriptor.get.call(input); },
    set(v){ nativeDescriptor.set.call(input, v); render(); },
    configurable: true
  });

  render();

  display.addEventListener('click', () => {
    // showPicker() is the direct, modern way to open a date input's
    // native picker programmatically; not every browser has it yet, so
    // focus()+click() is the fallback -- most browsers already open the
    // native picker on a plain click/focus of a date input.
    if(typeof input.showPicker === 'function'){
      try{ input.showPicker(); } catch(e){ input.focus(); input.click(); }
    } else {
      input.focus();
      input.click();
    }
  });
  input.addEventListener('change', render);
}

// All 3 date inputs are static HTML, already in the DOM by the time this
// script runs (scripts load at the end of the page) -- wiring them here,
// once, covers every card without needing a call from each page's own
// script. Tadabbur has no date field of its own to wire.
['sabaq_date', 'sabaqDhor_date', 'dhor_date'].forEach(wireCustomDateDisplay);
