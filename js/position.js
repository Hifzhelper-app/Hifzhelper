/* Hifzhelper build 4.2.8 | js/position.js */
// ============================================================
// Hifzhelper — client-side position tracking (V3.12.0, rebuilt V3.14.0)
// Current as of V3.45.5
// The Worker's position.js only stores whatever JSON blob it's given (see
// that file's own comment) — all the actual progress logic lives here,
// same "computed client-side" design already documented in SCHEMA.md.
//
// V3.45.4: architectural rebuild of how the Sabaq frontier itself works,
// confirmed in chat after a real bug -- a Sabaq entry saved correctly but
// the separately-stored position.sabaqTo silently failed to advance
// alongside it (a savePosition() call swallowed by an empty catch),
// leaving prepopulation and Sabaq Dhor's "current" quarter both stuck on
// stale data with zero visible trace anything had gone wrong. sabaqTo/
// activeJuz are no longer stored at all -- computeActualSabaqFrontier
// (below) computes them FRESH every time, directly from real Sabaq
// history, so there's nothing left to silently desync from what actually
// happened. Confirmed explicitly: the default frontier is simply
// whichever Sabaq entry is most recently dated -- NOT an attempt to
// algorithmically determine which juz' is "further along" across a
// student's whole history. That was this rebuild's first draft and the
// user caught a real flaw in it: study order is only fixed through juz'
// 30 then 29 (backwards from surah 114, then forward from 29's start) --
// after that, students genuinely diverge (some continue backwards, some
// jump to juz' 1), "there isn't a system to code against" for that
// branching. Comparing across juz' with one hardcoded order would
// silently misjudge "further along" for any student whose real path
// doesn't match it. The simpler "most recent entry wins" rule sidesteps
// that entirely -- no cross-juz' comparison anywhere in this file
// anymore.
//
// V3.45.5: V3.45.4 also added position.sabaqDhorManualOverride, a
// persistent manual-position override for Sabaq Dhor -- REMOVED again
// here after further discussion. That field was never actually needed:
// Sabaq Dhor's manual-select field turned out to just be a 3rd input
// into the exact same composited from/to range its own "Confirm Sabaq
// Dhor" checkboxes already build for whichever single entry is being
// saved (compositeCheckedSabaqDhorRows, js/sabaqDhorPage.js) -- nothing
// about it needs to persist on `position` at all, let alone affect a
// future prepopulation the way this field would have.
//
// Everything below computeActualSabaqFrontier/advancePositionAfterSabaq
// -- computeLingeringRows, computeSabaqDhorRows, computeCurrentJuzRows,
// computeSabaqDhorSections, etc. -- is UNCHANGED from before this
// version. They still just read .sabaqTo/.activeJuz/.previousJuz off
// whatever position-shaped object they're given; what changed is only
// WHO constructs that object and HOW (js/sabaqPage.js and
// js/sabaqDhorPage.js now compute sabaqTo/activeJuz fresh before calling
// into any of this, rather than reading a stored value).
// ============================================================

async function loadPosition(){
  // V3.64.0 skipped position entirely in maktab mode: /position is
  // auth-token-keyed, so it would have read (and savePosition would have
  // OVERWRITTEN) the TEACHER's own row while they logged a student.
  // V3.66.0 (delivery (h)) replaces that skip with the maktab's OWN
  // position store, so the computation functions below — lingering rows,
  // rollup, "already moved to Dhor" — work in the maktab unchanged.
  // User: "sabaq dhor needs to copy the logic from the PJ".
  const row = (typeof logCtxIsMaktab === 'function' && logCtxIsMaktab())
    ? await apiGetMaktabPosition(logCtxStudentId())
    : await apiGetPosition();
  let position = null;
  try{ position = row && row.position_json ? JSON.parse(row.position_json) : null; } catch(e){ position = null; }
  // V3.45.4: sabaqTo/activeJuz removed from the stored/default shape --
  // no longer persisted at all, computed fresh instead (see file header).
  // previousJuz/sabaqDhorRollup/sabaqDhorManualOverride are still the
  // genuinely stateful fields this object carries.
  if(!position) position = {};
  return position;
}

// V3.45.4: strips sabaqTo/activeJuz before persisting, regardless of
// what's on the object passed in -- both js/sabaqPage.js and
// js/sabaqDhorPage.js now carry these IN MEMORY on their own position
// objects (for computeSabaqDhorRows/etc. to read, unchanged from
// before), but neither should ever be written to storage -- they're
// computed fresh every load now, not read from what's stored (see this
// file's header). Centralizing the strip here means every savePosition
// call site is automatically protected, rather than needing each one to
// remember to strip these itself.
function savePosition(position){
  const toStore = Object.assign({}, position);
  delete toStore.sabaqTo;
  delete toStore.activeJuz;
  // V3.66.0: in maktab mode this writes the MAKTAB's position row for the
  // student being logged — never the teacher's own (the bug the V3.64.0
  // guard existed to prevent, now solved properly rather than skipped).
  if(typeof logCtxIsMaktab === 'function' && logCtxIsMaktab()){
    return apiSaveMaktabPosition(logCtxStudentId(), JSON.stringify(toStore), null);
  }
  return apiSavePosition(JSON.stringify(toStore), null);
}

// V3.45.4: the new source of truth for where Sabaq actually is, computed
// fresh from real history every time rather than trusting a separately-
// stored value -- see file header for why. Deliberately simple: no
// cross-juz' comparison at all, confirmed in chat -- just whichever
// entry is most recently dated (same sort renderRecentEntries already
// uses elsewhere: date descending, id as tiebreaker), then that ONE
// entry's own frontier via the existing, still-reliable within-entry
// compareVerseKey check (comparing 2 endpoints of the SAME entry stays
// correct regardless of the cross-juz' branching problem this sidesteps
// entirely). Returns null if there's no usable Sabaq history at all.
function computeActualSabaqFrontier(allEntries, ref){
  const parseVerseRef = (raw) => {
    const parts = String(raw || '').split(':').map(Number);
    return (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) ? { surah: parts[0], ayah: parts[1] } : null;
  };
  const parsed = (allEntries || [])
    .map(e => ({ date: e.date, id: e.id, from: parseVerseRef(e.sabaq_from), to: parseVerseRef(e.sabaq_to) }))
    .filter(p => p.from && p.to);
  if(parsed.length === 0) return null;
  parsed.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id||0) - (a.id||0));
  const latest = parsed[0];
  const juz = getJuzForPosition(latest.from.surah, latest.from.ayah, ref);
  const cmp = compareVerseKey(latest.from.surah, latest.from.ayah, latest.to.surah, latest.to.ayah);
  const fromIsFrontier = juz === 30 ? cmp <= 0 : cmp >= 0;
  const frontier = fromIsFrontier ? latest.from : latest.to;
  return { surah: frontier.surah, ayah: frontier.ayah };
}

// Any Dhor history at all (not just recent) — used by Sabaq's prepopulation
// rule: once real Dhor revision exists, Sabaq stops prepopulating entirely
// (confirmed in chat) rather than guessing where a student wants to resume.
async function hasDhorHistory(){
  try{
    const rows = await logClient('dhor').get();
    return Array.isArray(rows) && rows.length > 0;
  } catch(e){
    return false; // fail open to "no history" — prepopulation is a convenience, never a blocker
  }
}

// The default {surah, ayah}-pair prefill for a new Sabaq entry, per the
// confirmed rules: no Sabaq history AND no Dhor history → 114:1/114:6
// (juz' 30's start); no Sabaq history but Dhor history exists → nothing
// prepopulates (prior memorisation recorded directly via Setup, nothing
// for Sabaq's own position tracker to advance from); has REAL Sabaq
// history → always prepopulates from it regardless of Dhor history, via
// nextSabaqPosition advancing one ayah past the last reached point in the
// correct study direction, prefilling To if currently in juz' 30
// (studied backwards, so the frontier is the FURTHER-along end) or From
// otherwise. If advancing would leave the juz' entirely (it's fully
// complete), nothing prepopulates -- there's no single correct next point
// to guess at.
//
// V3.19.2 fix: hasDhor used to gate everything unconditionally, so a
// student with BOTH real Sabaq history and any Dhor history at all (e.g.
// Umme) got nothing prepopulated even though there's a perfectly good
// Sabaq frontier to continue from. Confirmed in chat: the no-prepopulate
// rule was only ever meant for the no-Sabaq-history case.
// V3.45.4: takes `frontier` directly now (the result of
// computeActualSabaqFrontier), not the whole position object -- this
// function only ever used position.sabaqTo anyway, and that's no longer
// something stored on position at all.
function nextSabaqDefaults(frontier, ref, hasDhor){
  if(!frontier){
    if(hasDhor) return { from: null, to: null };
    return { from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 6 } };
  }
  const next = nextSabaqPosition(frontier.surah, frontier.ayah, ref);
  if(next.juzComplete) return { from: null, to: null };
  // 2026-08-04, confirmed in chat: both From and To now prepopulate with
  // the same starting ayah -- previously only one field got a value
  // (which one depended on juz' 30's backwards study direction vs every
  // other juz' ascending), leaving the other blank/dashed for no clear
  // reason visible to the student. getJuzForPosition (used only for that
  // now-removed branching) is no longer called from here -- still used
  // elsewhere in this file, so not dead code.
  return { from: { surah: next.surah, ayah: next.ayah }, to: { surah: next.surah, ayah: next.ayah } };
}

// Phase 2a (V3.16.0): builds the actual DISPLAYABLE rows for Sabaq Dhor,
// applying a rollup level to the COMPLETED portion only -- the current,
// still-in-progress quarter is never rolled up (confirmed in chat: only
// already-finished quarters/halves can merge). rollupLevel is one of
// 'quarters' (each completed quarter its own row -- the default),
// 'halves' (merges completed quarters into First/Second Half rows where
// both halves of a pair are actually complete), or 'full' (merges
// everything into one row, only once the whole juz' is complete).
// Persisted per-juz' in position.sabaqDhorRollup so a student's chosen
// granularity sticks across sessions rather than resetting every open.
// The lingering previous juz's rows -- whatever portion of it hasn't
// already moved to Dhor (checked against baselineSelection directly:
// membership there IS "already moved", since moving to Dhor means
// joining that same pool). Respects the same rollup preference as the
// current juz', so a student who prefers halves sees the lingering
// content the same way. Second Half only ever appears here once First
// Half is confirmed already in the pool (the sequential rule) -- if
// neither half has moved yet, both are still eligible together.
// V3.74.3 REWRITE. Was: each half carried its own Dhor option, sequenced —
// Second Half stayed locked until First Half had actually moved. That whole
// mechanism is retired.
//
// Now the Dhor option belongs to the JUZ, not to a row:
//   - one option per juz, never one per half or quarter;
//   - it ignores roll-up entirely, so collapsing or expanding the quarters
//     does not make it appear or vanish;
//   - it activates only when all four quarters are complete;
//   - moving takes ALL FOUR quarters and the juz leaves Sabaq Dhor.
//
// A lingering juz is complete by definition — that is what makes it linger,
// the student having moved on to the next one. So its option is active
// immediately. The rows below are display only; `canMoveToDhor` is gone
// from them.
function computeLingeringRows(previousJuz, ref, rollupLevel, baselineSelection){
  const allUnits = quarterUnitsForJuz(previousJuz);
  const fullyMoved = allUnits.every(u => baselineSelection.includes(u));
  if(fullyMoved) return []; // already in the pool -- the juz has left Sabaq Dhor

  const juzBounds = { from: structuralQuarterBounds(previousJuz, 1, ref), to: structuralQuarterBounds(previousJuz, 4, ref) };
  if(rollupLevel === 'full'){
    return [{ id: 'lingering-full', label: `Juz ${previousJuz} (complete)`,
      fromSurah: juzBounds.from.startSurah, fromAyah: juzBounds.from.startAyah,
      toSurah: juzBounds.to.endSurah, toAyah: juzBounds.to.endAyah,
      complete: true, isFull: true, lingeringJuz: previousJuz }];
  }
  const halfBounds = (h) => {
    const start = structuralQuarterBounds(previousJuz, h === 1 ? 1 : 3, ref);
    const end = structuralQuarterBounds(previousJuz, h === 1 ? 2 : 4, ref);
    return { fromSurah: start.startSurah, fromAyah: start.startAyah, toSurah: end.endSurah, toAyah: end.endAyah };
  };
  // Most-recent-first (2026-08-07, "4321 for all"): Second Half before
  // First. Hizb is a standalone global 1-60 number, as everywhere else.
  const rows = [];
  [2, 1].forEach(h => {
    const label = ref === 'uthmani' ? `Hizb ${globalHizbNumber(previousJuz, h)}` : `Juz ${previousJuz}, ${h === 1 ? 'First' : 'Second'} Half`;
    rows.push(Object.assign({ id: `lingering-h${h}`, label }, halfBounds(h), { complete: true, isHalf: true, halfIndex: h, lingeringJuz: previousJuz }));
  });
  return rows;
}

// The per-juz move option. Returned alongside the rows rather than attached
// to one of them, because it belongs to the juz and must survive whatever
// roll-up level happens to be showing.
function computeJuzMoveOption(juz, ref, baselineSelection, completeQuarters){
  if(!juz) return null;
  const units = quarterUnitsForJuz(juz);
  if(units.every(u => baselineSelection.includes(u))) return null; // already moved
  return {
    juz,
    units,
    label: `Juz ${juz}`,
    // Visible either way; enabled only at four. Showing it inactive is
    // deliberate -- it tells the teacher the option exists and what it is
    // waiting for, rather than appearing from nowhere on the fourth tick.
    enabled: completeQuarters >= 4,
    completeQuarters,
  };
}

function computeSabaqDhorRows(position, ref, rollupLevel, baselineSelection){
  const pool = baselineSelection || [];
  const lingering = position.previousJuz ? computeLingeringRows(position.previousJuz, ref, rollupLevel, pool) : [];
  const currentRows = computeCurrentJuzRows(position, ref, rollupLevel);
  return lingering.concat(currentRows);
}

// V3.74.3: the move options for whatever juz the card is showing. At most
// two -- the lingering juz (complete, so active) and the current one
// (active only once its fourth quarter is done).
function computeSabaqDhorMoveOptions(position, ref, baselineSelection){
  const pool = baselineSelection || [];
  const out = [];
  if(position.previousJuz){
    const o = computeJuzMoveOption(position.previousJuz, ref, pool, 4);
    if(o) out.push(o);
  }
  if(position.activeJuz && position.activeJuz !== position.previousJuz){
    const done = (position.completedQuarters || []).length;
    const o = computeJuzMoveOption(position.activeJuz, ref, pool, done);
    if(o) out.push(o);
  }
  return out;
}

// 2026-08-07 (V3.37): plain "Quarter N"/"Ru'b N" rows for a list of
// ALREADY-COMPLETE sections, each its own row, unmerged, most-recent-
// first. Shared by the 'quarters'/'rubs' rollup level directly AND by
// 'maqras' for any Rub' beyond the current one -- confirmed in chat:
// Maqra has no bearing on an already-complete Rub', which is not "2
// merged Maqras", it's just an ordinary completed Rub' row, rendered
// through this exact same logic every completed Quarter already used --
// not a parallel implementation (see CONVENTIONS.md principle 2).
function buildIndividualCompletedRows(completed, ref){
  return completed
    .slice()
    .sort((a, b) => b.studyQuarter - a.studyQuarter) // 2026-08-07: most-recent-first (was ascending)
    .map(s => ({
      id: `q${s.studyQuarter}`,
      label: `${quarterUnitWord(ref)} ${s.studyQuarter}`,
      fromSurah: s.fromSurah, fromAyah: s.fromAyah, toSurah: s.toSurah, toAyah: s.toAyah,
      complete: true
    }));
}

function computeCurrentJuzRows(position, ref, rollupLevel){
  // 2026-08-07, confirmed in chat: Maqra only ever describes the ONE
  // Rub' currently in progress -- it's a Sabaq-Dhor-only lens, has no
  // bearing on Dhor at all, and isn't a new merge concept. So: get the
  // normal Quarter/Rub-level sections first (ref='uthmani' whenever this
  // branch runs), render every OTHER (already-complete) Rub' through the
  // exact same buildIndividualCompletedRows every completed Quarter
  // already uses, and ONLY break the current Rub' into its Maqra
  // sub-rows.
  if(rollupLevel === 'maqras'){
    const sections = computeSabaqDhorSections(position, ref);
    if(sections.length === 0) return [];
    const completedRubRows = buildIndividualCompletedRows(sections.slice(1), ref);

    const maqraSections = computeSabaqDhorSectionsMaqra(position);
    if(maqraSections.length === 0) return completedRubRows;
    const currentM = maqraSections[0];
    // Only the current Rub's own pair-partner can still show as a lone
    // Maqra (done, but the Rub' isn't complete since the other Maqra is
    // still current) -- Math.ceil(studyMaqra/2) === studyQuarter holds
    // both forward and reversed (Juz' 30), since the 9-x/5-x reversal
    // formulas preserve pairing symmetrically either way.
    const currentRubStudyIndex = sections[0].studyQuarter;
    const completedM = maqraSections.slice(1)
      .filter(s => Math.ceil(s.studyMaqra / 2) === currentRubStudyIndex)
      .sort((a, b) => b.studyMaqra - a.studyMaqra); // most-recent-first

    const maqraRows = [{
      id: `m${currentM.studyMaqra}`,
      label: `Maqra ${currentM.studyMaqra} (current)`,
      fromSurah: currentM.fromSurah, fromAyah: currentM.fromAyah,
      toSurah: currentM.toSurah, toAyah: currentM.toAyah,
      complete: false
    }];
    completedM.forEach(s => maqraRows.push({
      id: `m${s.studyMaqra}`,
      label: `Maqra ${s.studyMaqra}`,
      fromSurah: s.fromSurah, fromAyah: s.fromAyah, toSurah: s.toSurah, toAyah: s.toAyah,
      complete: true
    }));
    return maqraRows.concat(completedRubRows);
  }

  const sections = computeSabaqDhorSections(position, ref);
  if(sections.length === 0) return [];
  const current = sections[0]; // studyQuarter === highest, i.e. the in-progress one
  const completed = sections.slice(1);
  const juz = position.activeJuz;

  const rows = [{
    id: `q${current.studyQuarter}`,
    label: `${quarterUnitWord(ref)} ${current.studyQuarter} (current)`,
    fromSurah: current.fromSurah, fromAyah: current.fromAyah,
    toSurah: current.toSurah, toAyah: current.toAyah,
    complete: false
  }];

  if(rollupLevel === 'quarters' || completed.length === 0){
    rows.push(...buildIndividualCompletedRows(completed, ref));
  } else {
    // Merge into halves (1+2, 3+4) wherever BOTH members of the pair are
    // actually present in `completed` -- a lone quarter (e.g. only Q1
    // done, Q2 still the current one) stays on its own, unmerged.
    const byQuarter = {};
    completed.forEach(s => { byQuarter[s.studyQuarter] = s; });
    // completed can have at most 3 members here (current is always one
    // of 1-4, and completed = everything below it) -- a genuinely fully-
    // completed juz' is no longer "the current juz'" at all by the time
    // Sabaq has moved on, it's the PREVIOUS juz', handled separately by
    // computeLingeringRows (which has its own real 'full' case). Kept
    // here unreachable-but-harmless rather than removed, to avoid
    // changing behavior beyond what was actually asked for this delivery.
    if(rollupLevel === 'full' && byQuarter[1] && byQuarter[2] && byQuarter[3] && byQuarter[4]){
      rows.length = 1; // keep just the current row
      rows.push({
        id: 'full', label: 'Full Juz\'',
        fromSurah: completed[completed.length-1].fromSurah, fromAyah: completed[completed.length-1].fromAyah,
        toSurah: completed[0].toSurah, toAyah: completed[0].toAyah,
        complete: true, isFull: true   // V3.74.3: no per-row Dhor option
      });
    } else {
      // 2026-08-07: a single descending walk (4->1) rather than "process
      // pairs, then push any leftover standalone quarters separately" --
      // that 2-pass shape is what the earlier version of this delivery
      // had, and testing it directly caught a real ordering bug: a
      // standalone quarter (e.g. Q3, pair partner Q4 still current) was
      // always pushed AFTER every merged half regardless of which was
      // actually more recent -- e.g. Q1+Q2 merged + Q3 standalone showed
      // "First Half, then Q3" even though Q3 is the more recent one.
      // Walking positions once, most-recent-first, and consuming both
      // members of a pair together when it merges, fixes this for every
      // mix of merged/standalone quarters, not just the common cases.
      const consumed = new Set();
      for(let q = 4; q >= 1; q--){
        if(consumed.has(q) || !byQuarter[q]) continue;
        const isTopOfPair = (q === 4 && byQuarter[3]) || (q === 2 && byQuarter[1]);
        if(isTopOfPair){
          const a = q === 4 ? 3 : 1, halfIndex = q === 4 ? 2 : 1;
          const label = ref === 'uthmani' ? `Hizb ${globalHizbNumber(juz, halfIndex)}` : (halfIndex === 1 ? 'First Half' : 'Second Half');
          rows.push({
            id: `h${a}`, label,
            fromSurah: byQuarter[a].fromSurah, fromAyah: byQuarter[a].fromAyah,
            toSurah: byQuarter[q].toSurah, toAyah: byQuarter[q].toAyah,
            complete: true, isHalf: true, halfIndex   // V3.74.3: no per-row Dhor option
          });
          consumed.add(a); consumed.add(q);
        } else {
          const s = byQuarter[q];
          rows.push({
            id: `q${q}`, label: `${quarterUnitWord(ref)} ${q}`,
            fromSurah: s.fromSurah, fromAyah: s.fromAyah, toSurah: s.toSurah, toAyah: s.toAyah,
            complete: true
          });
          consumed.add(q);
        }
      }
    }
  }
  return rows;
}


// Just advances the frontier — no juz'-completion detection, no baseline
// side effects (see the file header for why that changed).
// V3.17.0 (Phase 2b): preserves every other field already on `position`
// (sabaqDhorRollup, previousJuz) rather than replacing the whole object —
// V3.16.0's version didn't, which would have silently dropped Phase 2a's
// rollup preference on every single Sabaq save. Also tracks previousJuz:
// when this save crosses into a NEW juz', the juz' just left behind
// becomes "lingering" in Sabaq Dhor (confirmed in chat) until it moves to
// Dhor, manually or automatically — see maybeAutoMoveToDhor below.
// V3.19.1: takes BOTH endpoints now, not just "to" -- determines the
// actual frontier by comparing them against the juz's real study
// direction (compareVerseKey, shared/data.js), rather than assuming "to"
// always represents the newest point reached. A bulk/historical catch-up
// entry can have its fields filled in ascending numeric order (lower as
// From, higher as To) rather than juz' 30's actual backward chronology,
// where the numerically LOWER endpoint is really the frontier -- e.g.
// From=88:1/To=114:6 means surahs 89-114 are fully done and only ayah 1
// of surah 88 is done, so 88:1 (not 114:6) is where the next sabaq
// continues from. For every other (forward-studied) juz', the frontier
// is the numerically HIGHER endpoint instead. Found live (confirmed in
// chat) after V3.19.0 still got a bulk-entry student's frontier wrong.
// V3.45.4: substantially simplified -- no longer computes or stores
// sabaqTo/activeJuz at all (see file header), so the old "is this
// genuinely further along" cross-juz' comparison this used to need is
// gone entirely, along with its SABAQ_STUDY_ORDER dependency. Takes
// oldFrontier/newFrontier directly -- the result of
// computeActualSabaqFrontier computed by the caller BEFORE and AFTER
// this save respectively. Still needs to detect a juz'-crossing for
// previousJuz's own "lingering juz'" tracking (genuinely stateful,
// unrelated to the frontier-storage problem this rebuild fixes).
// V3.45.5: the sabaqDhorManualOverride clearing added in V3.45.4 is
// REMOVED again -- turned out, after further discussion, that field
// was never actually needed. Sabaq Dhor's manual-select field isn't a
// persistent override on stored position at all; it's a 3rd input into
// the exact same composited from/to range Sabaq Dhor's own "Confirm
// Sabaq Dhor" checkboxes already build (compositeCheckedSabaqDhorRows,
// js/sabaqDhorPage.js), scoped to whichever single entry is being
// saved right now -- nothing about it persists on `position` at all,
// so there's nothing here to clear.
function advancePositionAfterSabaq(position, oldFrontier, newFrontier, ref){
  if(!newFrontier) return position;
  const newActiveJuz = getJuzForPosition(newFrontier.surah, newFrontier.ayah, ref);
  const oldActiveJuz = oldFrontier ? getJuzForPosition(oldFrontier.surah, oldFrontier.ayah, ref) : null;
  const crossedIntoNewJuz = oldActiveJuz != null && newActiveJuz !== oldActiveJuz;
  return Object.assign({}, position, {
    previousJuz: crossedIntoNewJuz ? oldActiveJuz : (position.previousJuz || null)
  });
}

// Phase 2b (V3.17.0): which quarter-unit IDs a given row represents, for
// actually moving it into Dhor's eligibility pool (baseline_selection).
// V3.74.3: called for a whole juz now, not a row —
// a lone quarter never has this option (confirmed in chat).
function quarterUnitsForRow(row, juz){
  if(row.isFull) return quarterUnitsForJuz(juz);
  if(row.isHalf) return quarterUnitsForHalf(juz, row.halfIndex);
  return [];
}

// Adds a row's quarter-units to the given baseline_selection pool
// (deduped) and returns the updated pool — caller is responsible for
// actually persisting it (apiSaveProfile). Moving to Dhor means becoming
// eligible content for the Dhor Schedule generator, confirmed in chat —
// not an immediately-logged Dhor entry.
function addRowToBaselinePool(row, juz, baselineSelection){
  const units = quarterUnitsForRow(row, juz);
  const pool = baselineSelection.slice();
  units.forEach(u => { if(!pool.includes(u)) pool.push(u); });
  return pool;
}

// The automatic move-to-Dhor trigger: once a lingering previous juz' has
// ANY still-not-moved portion, and Sabaq has completed at least one full
// quarter of the NEW (current) juz', the entire remaining lingering
// portion moves to Dhor and previousJuz clears — confirmed in chat as an
// independent path to the same outcome the manual tickbox reaches, not a
// replacement for it. Returns { position, baselineSelection, moved } —
// moved is false (no-op) if the trigger condition isn't met yet.
function maybeAutoMoveToDhor(position, ref, baselineSelection){
  if(!position.previousJuz) return { position, baselineSelection, moved: false };
  const currentJuzSections = computeSabaqDhorSections(position, ref);
  const hasCompletedQuarterInNewJuz = currentJuzSections.some(s => s.complete);
  if(!hasCompletedQuarterInNewJuz) return { position, baselineSelection, moved: false };

  const remainingUnits = quarterUnitsForJuz(position.previousJuz).filter(u => !baselineSelection.includes(u));
  const newPool = baselineSelection.concat(remainingUnits);
  return {
    position: Object.assign({}, position, { previousJuz: null }),
    baselineSelection: newPool,
    moved: remainingUnits.length > 0
  };
}


// Sabaq point, excluding today's brand-new portion — confirmed in chat,
// replacing the earlier "beginning of Quran / halfway point" rule
// entirely. Builds quarter by quarter as Sabaq progresses: the quarter
// Sabaq is currently IN (partial, up to the frontier) is section 1;
// each already-fully-memorised quarter before it is its own section too
// (at most 3, since a juz' has 4 quarters and the 4th-equivalent is
// always the one currently in progress). Returns [] if nothing's been
// sabaq'd yet in this juz' (nothing to revise).
// NOTE: still V3.13.0's model, reading position.activeJuz as before —
// Sabaq Dhor's own rebuild (rollable quarter/half/juz' sections,
// progressive Dhor-eligibility) is a separate, later phase; this function
// is untouched here so that still-live card keeps working against the
// same position shape in the meantime.
// 2026-08-06, confirmed in chat: exact structural mirror of
// computeSabaqDhorSections above, using structuralMaqraOf/
// structuralMaqraBounds/studyMaqraIndex (8 per Juz') instead of the
// quarter equivalents (4 per Juz'). Only meaningful when the Rub'/Hizb
// model is active (ref='uthmani') -- Maqra has no Waterval equivalent.
function computeSabaqDhorSectionsMaqra(position){
  if(!position.sabaqTo) return [];
  const juz = position.activeJuz;
  const { maqraIndex: frontierStructuralM } = structuralMaqraOf(position.sabaqTo.surah, position.sabaqTo.ayah);
  const currentStudyM = studyMaqraIndex(juz, frontierStructuralM);
  const sections = [];
  for(let studyM = currentStudyM; studyM >= 1; studyM--){
    const structuralM = studyMaqraIndex(juz, studyM); // self-inverse, converts either direction
    const bounds = structuralMaqraBounds(juz, structuralM);
    const isCurrent = studyM === currentStudyM;
    sections.push({
      studyMaqra: studyM,
      complete: !isCurrent,
      fromSurah: bounds.startSurah, fromAyah: bounds.startAyah,
      toSurah: isCurrent ? position.sabaqTo.surah : bounds.endSurah,
      toAyah: isCurrent ? position.sabaqTo.ayah : bounds.endAyah
    });
  }
  return sections;
}

function computeSabaqDhorSections(position, ref){
  if(!position.sabaqTo) return [];
  const juz = position.activeJuz;
  const { quarterIndex: frontierStructuralQ } = structuralQuarterOf(position.sabaqTo.surah, position.sabaqTo.ayah, ref);
  const currentStudyQ = studyQuarterIndex(juz, frontierStructuralQ);
  const sections = [];
  for(let studyQ = currentStudyQ; studyQ >= 1; studyQ--){
    const structuralQ = studyQuarterIndex(juz, studyQ); // self-inverse, converts either direction
    const bounds = structuralQuarterBounds(juz, structuralQ, ref);
    const isCurrent = studyQ === currentStudyQ;
    sections.push({
      studyQuarter: studyQ,
      complete: !isCurrent,
      fromSurah: bounds.startSurah, fromAyah: bounds.startAyah,
      toSurah: isCurrent ? position.sabaqTo.surah : bounds.endSurah,
      toAyah: isCurrent ? position.sabaqTo.ayah : bounds.endAyah
    });
  }
  return sections;
}
