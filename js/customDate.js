/* Hifzhelper build 4.2.8 | js/customDate.js */
// Hifzhelper -- shared custom date display (2026-08-03, confirmed in
// chat; reworked V3.50.1). A native <input type="date">'s own displayed
// text is entirely browser/OS-controlled -- no amount of CSS can
// reformat it, which is exactly why desktop Chrome and mobile Safari
// were showing 2 different formats for the identical date. This wraps
// each date input with a visible pill showing a consistent "DDD dd-MMM"
// format everywhere, while leaving the input itself fully intact --
// same id, same .value, same change event -- so every existing
// read/write against it keeps working completely unchanged.
//
// V3.50.1 (confirmed in chat): the tap path is inverted. The original
// design put a button on top and called input.showPicker() from its
// click handler -- but showPicker() for date inputs has NEVER been
// implemented on iOS (WebKit bug 268114, still open): the method
// exists and silently does nothing, so the focus+click fallback (which
// only ran when showPicker was absent or threw) never fired, and the
// picker never opened on iOS. Now the NATIVE INPUT itself is the tap
// target -- invisible but sitting on top of the pill
// (css/detail-pages.css: .native-date-hidden) -- so every tap is a
// direct user tap on a real date input, which iOS opens reliably and
// always has (Tadabbur's then-unwired bare input proved it on the
// affected device). The pill underneath is purely visual
// (aria-hidden), there is no click handler and no showPicker anywhere,
// and the input carries an aria-label since no visible text labels it.

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
  input.setAttribute('aria-label', 'Date');

  // Purely visual (V3.50.1): a span, not a button -- the input above it
  // is the real, tappable, focusable control, and a button here would
  // add a second pointless tab stop announcing nothing.
  const display = document.createElement('span');
  display.setAttribute('aria-hidden', 'true');
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

  input.addEventListener('change', render);
}

// All 4 date inputs are static HTML, already in the DOM by the time this
// script runs (scripts load at the end of the page) -- wiring them here,
// once, covers every card without needing a call from each page's own
// script. tadabbur_date joined in V3.50.1 (confirmed in chat): its date
// field arrived in V3.44.1, six days after this file was written, and
// was never added -- which accidentally left it the one WORKING card on
// iOS (bare native input = the direct-tap pattern this file now uses),
// but also the one card showing the browser-native format instead of
// the app's own. Now all four both work and match.
['sabaq_date', 'sabaqDhor_date', 'dhor_date', 'tadabbur_date'].forEach(wireCustomDateDisplay);

// V3.88.0 (user): the app's PLAIN-TEXT date format is dd-mmm-yy
// (24-Sep-26) — one shared formatter for prose/list dates. Date INPUTS
// stay with the device's region format (native pickers); the journal's
// two-line weekday cells keep their own designed layout.
const FMT_DMY_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDMY(iso){
  if(!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  return `${iso.slice(8, 10)}-${FMT_DMY_MONTHS[parseInt(iso.slice(5, 7), 10) - 1]}-${iso.slice(2, 4)}`;
}
