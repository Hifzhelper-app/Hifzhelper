/* Hifzhelper build 4.2.11.3 | js/logDetailScreen.js */
// ============================================================
// Hifzhelper — unified day-log view orchestrator (V3.6.1)
// Replaces the old 3 separate Sabaq/Sabaq Dhor/Dhor screens with one
// screen holding all 4 cards (Sabaq/Sabaq Dhor/Dhor/Tadabbur). Renders all
// 4 on entry, scrolls the rail so whichever journal column header was
// clicked opens on that card, and keeps the dot indicators in sync with
// scroll position on the tablet/mobile rail (desktop is a static 1x4
// grid — no scrolling, dots hidden via CSS).
// ============================================================

// V3.45.7: 'timer' removed from this order -- it's no longer a rail
// card at all (index.html/js/dhorPage.js), relocated to a truly
// top-level, always-mounted element outside the whole screen-swapping
// system. The rail is exactly 3 cards now.
// V3.85.0: back to THREE cards — the student summary is a STANDALONE
// page now (the user's V3.82 revision), not a rail card. The dots
// driver's hidden-card guard below stays: correct in general.
const LOG_DETAIL_CARD_ORDER = ['sabaq', 'sabaqDhor', 'dhor'];

// V3.12.0: header icons (display only, no click action) + save-button
// icons for all 3 real cards, injected once here rather than per-render
// since they never change. Tadabbur's own icons moved out along with the
// rest of its markup -- js/reflectionCard.js is otherwise unchanged.
document.getElementById('sabaqHeaderIcon').innerHTML = iconHtml('sabaq');
document.getElementById('sabaqDhorHeaderIcon').innerHTML = iconHtml('sabaqDhor');
document.getElementById('dhorHeaderIcon').innerHTML = iconHtml('dhor');
document.getElementById('sabaqSaveIcon').innerHTML = iconHtml('save');
document.getElementById('sabaqDhorSaveIcon').innerHTML = iconHtml('save');
document.getElementById('dhorSaveIcon').innerHTML = iconHtml('save');
// V3.45.7: new timer-icon buttons, one per card (Sabaq/Sabaq Dhor/Dhor
// only, confirmed explicitly NOT Tadabbur) -- click handlers wired in
// js/dhorPage.js alongside the rest of the timer's own open/close logic.
document.getElementById('sabaqTimerBtnIcon').innerHTML = iconHtml('timer');
document.getElementById('sabaqDhorTimerBtnIcon').innerHTML = iconHtml('timer');
document.getElementById('dhorTimerBtnIcon').innerHTML = iconHtml('timer');


// V4.2.11.3: ONE date for Sabaq / Sabaq Dhor / Dhor. The original three
// inputs stay in the DOM as hidden source controls because edit-history mode
// moves the selected entry's real date into its edit header. In normal mode
// this shared date is the only visible date and mirrors to all three sources.
const LOG_DETAIL_DATE_INPUT_IDS = ['sabaq_date', 'sabaqDhor_date', 'dhor_date'];

function logDetailDefaultDate(){
  if(typeof logCtxIsMaktab === 'function' && logCtxIsMaktab() && typeof logCtxDate === 'function' && logCtxDate()) return logCtxDate();
  if(typeof appTodayISO === 'function') return appTodayISO();
  if(typeof todayISO === 'function') return todayISO();
  return new Date().toISOString().slice(0, 10);
}

function applyLogDetailSharedDate(date, updateContext){
  const value = date || logDetailDefaultDate();
  const shared = document.getElementById('logDetailSharedDate');
  if(shared && shared.value !== value) shared.value = value;
  LOG_DETAIL_DATE_INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    if(input && input.value !== value) input.value = value;
  });
  if(updateContext && typeof setLogCtxDate === 'function') setLogCtxDate(value);
  return value;
}

function syncLogDetailSharedDate(){
  return applyLogDetailSharedDate(logDetailDefaultDate(), false);
}
function logDetailSelectedDate(){
  const shared = document.getElementById('logDetailSharedDate');
  return (shared && shared.value) || logDetailDefaultDate();
}

(function wireLogDetailSharedDate(){
  const input = document.getElementById('logDetailSharedDate');
  if(!input) return;
  if(typeof wireCustomDateDisplay === 'function') wireCustomDateDisplay('logDetailSharedDate');
  input.addEventListener('change', () => applyLogDetailSharedDate(input.value, true));
})();

// V3.41: xclose now exits to Home like every other screen (confirmed
// in chat -- was Journal-only before, per the reasoning below, which no
// longer applies now that ALL screens get a consistent X-to-Home).
document.getElementById('logDetailClose').innerHTML = iconHtml('close');
// V4.1.1: the day card closes to the maktab summary for a teaching
// profile, Home for a student — homeScreenFor() in js/app.js.
document.getElementById('logDetailClose').addEventListener('click', () => showScreen(typeof homeScreenFor === 'function' ? homeScreenFor() : 'home'));

// V4.2.10: one student search above the shared Sabaq / Sabaq Dhor / Dhor
// rail. It is deliberately a MAKTAB TEACHING control only: PJ mode has no
// other student to switch to, and a student's read-only Maktab view must
// never expose the maktab roster. The normal route into this screen is the
// summary, so its in-memory roster cache is reused instantly. A defensive
// fallback to the same summary endpoint runs only if that cache is absent.
let logDetailStudentSearchRoster = [];
let logDetailStudentSearchLoad = null;

function logDetailCurrentCard(){
  const active = document.querySelector('#logDetailDots .dot.active');
  if(active){
    const idx = parseInt(active.dataset.index, 10);
    if(Number.isInteger(idx) && LOG_DETAIL_CARD_ORDER[idx]) return LOG_DETAIL_CARD_ORDER[idx];
  }
  return 'sabaq';
}

function seedLogDetailStudentSearchFromCache(){
  if(typeof maktabRosterCache !== 'undefined' && Array.isArray(maktabRosterCache) && maktabRosterCache.length){
    logDetailStudentSearchRoster = maktabRosterCache.slice();
    return true;
  }
  return false;
}

async function ensureLogDetailStudentSearchRoster(){
  if(seedLogDetailStudentSearchFromCache()) return logDetailStudentSearchRoster;
  if(logDetailStudentSearchRoster.length) return logDetailStudentSearchRoster;
  if(logDetailStudentSearchLoad) return logDetailStudentSearchLoad;
  logDetailStudentSearchLoad = (async () => {
    try{
      const date = (typeof logCtxDate === 'function' && logCtxDate())
        || (typeof appTodayISO === 'function' ? appTodayISO() : null);
      const data = await apiMaktabSummary(date);
      logDetailStudentSearchRoster = (data && Array.isArray(data.students))
        ? data.students.map(stu => ({
            id: stu.id,
            name: stu.name,
            group_name: stu.group_name || '',
            track_haidh: !!stu.track_haidh
          }))
        : [];
    } catch(e){
      logDetailStudentSearchRoster = [];
    } finally {
      logDetailStudentSearchLoad = null;
    }
    return logDetailStudentSearchRoster;
  })();
  return logDetailStudentSearchLoad;
}

function closeLogDetailStudentSearchResults(){
  const results = document.getElementById('logDetailStudentSearchResults');
  if(results){ results.innerHTML = ''; results.classList.add('hidden'); }
}

async function renderLogDetailStudentSearchResults(){
  const input = document.getElementById('logDetailStudentSearchInput');
  const results = document.getElementById('logDetailStudentSearchResults');
  if(!input || !results) return;
  const q = input.value.trim().toLowerCase();
  if(!q){ closeLogDetailStudentSearchResults(); return; }

  const roster = await ensureLogDetailStudentSearchRoster();
  // The context may have changed while the roster was loading.
  if(!(typeof logCtxIsMaktab === 'function' && logCtxIsMaktab())
     || (typeof logCtxReadOnly === 'function' && logCtxReadOnly())) return;

  const matches = roster.filter(stu =>
    String(stu.name || '').toLowerCase().includes(q)
    || String(stu.id || '').toLowerCase().includes(q)
  ).slice(0, 10);

  results.innerHTML = '';
  if(!matches.length){
    const empty = document.createElement('div');
    empty.className = 'log-detail-student-search-empty';
    empty.textContent = 'No matching student.';
    results.appendChild(empty);
  } else {
    matches.forEach(stu => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'log-detail-student-search-result';
      btn.textContent = stu.name + (stu.group_name ? ' · ' + stu.group_name : '');
      btn.addEventListener('click', async () => {
        const initialCard = logDetailCurrentCard();
        const date = (typeof logCtxDate === 'function' && logCtxDate()) || null;
        input.value = '';
        closeLogDetailStudentSearchResults();
        await openMaktabDay(stu, date, initialCard);
      });
      results.appendChild(btn);
    });
  }
  results.classList.remove('hidden');
}

function syncLogDetailStudentSearch(){
  const wrap = document.getElementById('logDetailStudentSearch');
  const input = document.getElementById('logDetailStudentSearchInput');
  if(!wrap || !input) return;
  const canSearch = typeof logCtxIsMaktab === 'function'
    && logCtxIsMaktab()
    && !(typeof logCtxReadOnly === 'function' && logCtxReadOnly());
  wrap.classList.toggle('hidden', !canSearch);
  if(!canSearch){
    input.value = '';
    closeLogDetailStudentSearchResults();
    return;
  }
  seedLogDetailStudentSearchFromCache();
}

(function wireLogDetailStudentSearch(){
  const input = document.getElementById('logDetailStudentSearchInput');
  if(!input) return;
  input.addEventListener('input', renderLogDetailStudentSearchResults);
  input.addEventListener('focus', renderLogDetailStudentSearchResults);
  input.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      input.value = '';
      closeLogDetailStudentSearchResults();
      input.blur();
    }
  });
  document.addEventListener('click', e => {
    if(!e.target.closest || !e.target.closest('#logDetailStudentSearch')){
      closeLogDetailStudentSearchResults();
    }
  });
})();

// V3.51.0 (confirmed in chat): the icon bottombar (Cancel/Delete/Update)
// is gone -- Cancel is the X in each edit topbar now, and the button flow
// below (Confirm changes -> Save, red Delete) replaced the rest.
['sabaq', 'sabaqDhor', 'dhor', 'tadabbur'].forEach(prefix => {
  document.getElementById(`${prefix}EditCloseBtn`).innerHTML = iconHtml('close');
});

// ---- V3.51.0 shared edit flow (confirmed in chat) ----------------------
// Dirty tracking + the Confirm-changes -> Save gate, one instance per
// card. collect() serializes every editable field; a 300ms poll compares
// it to the snapshot taken at load -- polling deliberately, because
// several fields change via JS writes (surah pickers, tajweed picker)
// that fire no input/change events, and a poll catches every path by
// construction instead of needing a notify call at each write site.
// Any change AFTER confirming drops back to unconfirmed, so Save always
// saves exactly what was confirmed.
const EDIT_FLOW = {};
function initEditFlow(prefix, collect, onSave){
  teardownEditFlow(prefix);
  const flow = { collect, snapshot: collect(), confirmed: false, dirty: false };
  EDIT_FLOW[prefix] = flow;
  const confirmBtn = document.getElementById(`${prefix}EditConfirmBtn`);
  const saveBtn = document.getElementById(`${prefix}EditSaveBtn`);
  const sync = () => {
    confirmBtn.disabled = !flow.dirty;
    confirmBtn.classList.toggle('ready', flow.dirty && !flow.confirmed);
    confirmBtn.classList.toggle('confirmed', flow.confirmed);
    confirmBtn.textContent = flow.confirmed ? 'Changes confirmed' : 'Confirm changes';
    saveBtn.disabled = !flow.confirmed;
  };
  flow.timer = setInterval(() => {
    const nowDirty = flow.collect() !== flow.snapshot;
    if(nowDirty !== flow.dirty){
      flow.dirty = nowDirty;
      if(flow.confirmed) flow.confirmed = false; // re-dirty (or revert) resets
      sync();
    } else if(nowDirty && flow.confirmed && flow.collect() !== flow.confirmedState){
      flow.confirmed = false; // changed again while staying dirty
      sync();
    }
  }, 300);
  confirmBtn.onclick = () => {
    if(!flow.dirty) return;
    flow.confirmed = true;
    flow.confirmedState = flow.collect();
    sync();
  };
  saveBtn.onclick = () => { if(flow.confirmed) onSave(); };
  sync();
}
function teardownEditFlow(prefix){
  const flow = EDIT_FLOW[prefix];
  if(flow && flow.timer) clearInterval(flow.timer);
  delete EDIT_FLOW[prefix];
}
function isEditConfirmed(prefix){
  return !!(EDIT_FLOW[prefix] && EDIT_FLOW[prefix].confirmed);
}

// The card's own date control (its .custom-date-wrap) physically moves
// into the edit heading's slot while editing -- entry's real date,
// fully editable -- and returns to its .card-date-row on exit. Same
// one-element relocation pattern as V3.50.0's confirm box.
function moveDateIntoEditSlot(prefix){
  const input = document.getElementById(`${prefix}_date`);
  const wrap = input.closest('.custom-date-wrap') || input;
  document.getElementById(`${prefix}EditDateSlot`).appendChild(wrap);
}
function restoreDateFromEditSlot(prefix, cardId){
  const input = document.getElementById(`${prefix}_date`);
  const wrap = input.closest('.custom-date-wrap') || input;
  const row = document.getElementById(cardId).querySelector('.card-date-row');
  if(row) row.insertBefore(wrap, row.firstChild);
}

// V3.22.0: the edit "screen" is a full takeover of THIS screen rather
// than a new entry in js/app.js's router -- reuses each card's existing
// fields/pickers as-is instead of duplicating them. Hides the tabs/dots
// row and every card except the one being edited; within that card, its
// own loadXEntryForEdit (js/sabaqPage.js etc.) hides the normal header/
// History and shows the grey top/bottom bars in their place.
// V3.51.0 (confirmed in chat): editing is a POPUP now, not the V3.22.0
// full-screen takeover -- the card element physically MOVES into a
// body-level .modal-overlay (other screens stay visible beneath), and
// moves back on exit. Same relocation pattern as V3.50.0's confirm box,
// deliberately instead of CSS-elevating the card inside the
// horizontally-scrolling rail (the position-fixed-inside-scroller
// Safari trap from the V3.34.x era). A same-class placeholder keeps the
// card's rail slot, so layout and scroll never shift. Tap-outside does
// NOT close this popup (unlike History) -- unsaved changes deserve an
// explicit X, not an accidental dismissal.
function enterEditScreenMode(cardId){
  const card = document.getElementById(cardId);
  if(document.getElementById('editPopupOverlay')) return;
  const ph = document.createElement('div');
  ph.id = 'editPopupPlaceholder';
  ph.className = card.className;             // keeps the rail slot's size
  card.parentNode.insertBefore(ph, card);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay edit-popup-modal';
  overlay.id = 'editPopupOverlay';
  const inner = document.createElement('div');
  inner.className = 'modal-card edit-popup-card';
  inner.appendChild(card);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
  card.classList.add('editing-active');
}
function exitEditScreenMode(cardId){
  const card = document.getElementById(cardId);
  card.classList.remove('editing-active');
  const ph = document.getElementById('editPopupPlaceholder');
  if(ph){ ph.parentNode.insertBefore(card, ph); ph.remove(); }
  const overlay = document.getElementById('editPopupOverlay');
  if(overlay) overlay.remove();
  updateLogDetailDots();
}

async function renderLogDetailScreen(initialCard){
  // V4.2.11.3: establish the shared day before the cards load; each card's
  // reset still runs independently, then the same day is mirrored back to
  // all three source inputs once those resets are complete.
  const sharedDate = syncLogDetailSharedDate();
  // V4.2.10: paint the teaching-only student switcher immediately from
  // the summary's memory cache; card data may continue loading below.
  syncLogDetailStudentSearch();
  // V3.91.0 (user scribble, 2026-08-29): the calendar-info label is
  // GONE from the day-card date rows — the markers stay on the journal
  // cells, the calendars, and the calendar page.
  await Promise.all([
    renderSabaqScreen(),
    renderSabaqDhorScreen(),
    renderDhorScreen()
  ]);
  applyLogDetailSharedDate(sharedDate, false);

  const rail = document.getElementById('logDetailRail');
  const startIndex = Math.max(0, LOG_DETAIL_CARD_ORDER.indexOf(initialCard));
  const startCard = rail.children[startIndex];
  // Instant jump on entry — no smooth-scroll animation for the initial
  // position, that's reserved for deliberate dot taps below.
  if(startCard) rail.scrollLeft = startCard.offsetLeft;
  updateLogDetailDots();
}

// V3.18.0 fix: this used to compare card.offsetLeft against rail.scrollLeft,
// which silently broke once #appContent gained `transform: translateZ(0)`
// (V3.4.3's Safari-paint fix) -- a transformed ancestor becomes the nearest
// offsetParent for elements inside it in every major browser, so each
// card's offsetLeft was actually being measured from #appContent's edge,
// several DOM levels above the rail, not from the rail's own content box.
// That added a constant (#appContent's own padding) to every comparison,
// so a dot only flipped "active" once you'd scrolled well past where the
// card had actually snapped into place -- exactly the "erratic"/
// "misaligned" symptom reported, and invisible from reading either file in
// isolation since neither one looks wrong on its own.
// getBoundingClientRect() is always viewport-relative regardless of any
// ancestor's transform/position tricks, so comparing the rail's own edge
// to each card's edge this way can't drift the same way offsetLeft did.
function updateLogDetailDots(){
  const rail = document.getElementById('logDetailRail');
  const dots = document.querySelectorAll('#logDetailDots .dot');
  const cards = Array.from(rail.children);
  const railLeft = rail.getBoundingClientRect().left;
  // The rightmost card whose left edge has scrolled into (or past) view is
  // the "active" one — works for both the 1-in-view (mobile) and
  // 2-in-view (tablet) cases without needing to special-case either.
  let activeIndex = 0;
  cards.forEach((card, i) => {
    if(card.hidden) return;   // V3.82.0: a hidden card rects to 0,0 and would always win
    if(card.getBoundingClientRect().left <= railLeft + 4) activeIndex = i;
  });
  dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
}

document.getElementById('logDetailRail').addEventListener('scroll', () => {
  window.requestAnimationFrame(updateLogDetailDots);
});

document.querySelectorAll('#logDetailDots .dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const rail = document.getElementById('logDetailRail');
    const card = rail.children[parseInt(dot.dataset.index, 10)];
    if(card) rail.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
  });
});


// ============================================================
// applyLogDetailReadOnly (V3.71.0)
//
// A student viewing her own maktab day gets the SAME shared log cards a
// teacher gets — that reuse is what keeps the maktab from drifting away
// from the personal journal, and it should not be abandoned just to make a
// read-only variant.
//
// This is deliberately a SWEEP, not a list of known control ids. Enumerating
// them would leave the next control anyone adds visible by default; the same
// failure shape as the four scattered pool writes before (i). Anything that
// can write is either a button, an input, a select or a textarea, so the
// sweep catches controls that do not exist yet.
//
// KEPT deliberately: the History buttons and the entry-count badges. Those
// are reads, and reading her own history is the entire point of the screen.
// ============================================================
function applyLogDetailReadOnly(on){
  const screen = document.getElementById('screen-logDetail');
  if(!screen) return;
  screen.classList.toggle('log-detail-readonly', !!on);
  screen.querySelectorAll('input, textarea, select').forEach(el => {
    if(on){ el.setAttribute('disabled', 'disabled'); }
    else { el.removeAttribute('disabled'); }
  });
  // Buttons that are reads stay live; everything else is inert. Matching on
  // a positive allow-list of READ controls (rather than a deny-list of write
  // ones) is what makes this safe as the screen grows.
  screen.querySelectorAll('button').forEach(btn => {
    const isRead = btn.classList.contains('history-btn')
                || btn.classList.contains('entry-count-badge')
                || btn.classList.contains('close-btn')
                || btn.hasAttribute('data-nav');
    if(on && !isRead){ btn.setAttribute('disabled', 'disabled'); }
    else { btn.removeAttribute('disabled'); }
  });
}
