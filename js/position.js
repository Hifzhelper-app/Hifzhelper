// ============================================================
// Hifzhelper — client-side position tracking (V3.12.0, rebuilt V3.14.0)
// The Worker's position.js only stores whatever JSON blob it's given (see
// that file's own comment) — all the actual progress logic lives here,
// same "computed client-side" design already documented in SCHEMA.md.
//
// V3.14.0 rebuild: Sabaq entries can now span multiple surahs and cross
// at most one juz' boundary in a single save (confirmed in chat) — the
// old model (a separately-tracked activeJuz, advanced+juz'-complete-
// detected ayah by ayah, auto-adding to Hifz Setup's baseline) no longer
// fits, since a single save can jump straight past a juz' boundary
// without ever visiting every ayah behind it one at a time. The auto-add-
// to-baseline behaviour is REMOVED here — that's now Setup's own job
// (3-way Juz'/Half-juz'/Surah marking, a separate phase), not something
// Sabaq does as a side effect.
//
// Shape used: { sabaqTo: {surah, ayah} | null, activeJuz }. sabaqTo is the
// single source of truth — the actual last point Sabaq reached. activeJuz
// is a DERIVED value (which juz' sabaqTo currently falls in), recomputed
// and stored alongside it purely so the still-live V3.13.0 Sabaq Dhor
// card (not yet rebuilt — separate phase) keeps working against this same
// position shape without its own changes; nothing here treats activeJuz
// as independently meaningful data.
// ============================================================

async function loadPosition(){
  const row = await apiGetPosition();
  let position = null;
  try{ position = row && row.position_json ? JSON.parse(row.position_json) : null; } catch(e){ position = null; }
  if(!position){
    position = { sabaqTo: null, activeJuz: SABAQ_STUDY_ORDER[0] }; // brand new student — juz' 30 first
  }
  return position;
}

function savePosition(position){
  return apiSavePosition(JSON.stringify(position), null);
}

// Any Dhor history at all (not just recent) — used by Sabaq's prepopulation
// rule: once real Dhor revision exists, Sabaq stops prepopulating entirely
// (confirmed in chat) rather than guessing where a student wants to resume.
async function hasDhorHistory(){
  try{
    const rows = await apiDhor.get();
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
function nextSabaqDefaults(position, ref, hasDhor){
  if(!position.sabaqTo){
    if(hasDhor) return { from: null, to: null };
    return { from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 6 } };
  }
  const next = nextSabaqPosition(position.sabaqTo.surah, position.sabaqTo.ayah, ref);
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
function computeLingeringRows(previousJuz, ref, rollupLevel, baselineSelection){
  const firstHalfUnits = quarterUnitsForHalf(previousJuz, 1);
  const secondHalfUnits = quarterUnitsForHalf(previousJuz, 2);
  const firstHalfMoved = firstHalfUnits.every(u => baselineSelection.includes(u));
  const secondHalfMoved = secondHalfUnits.every(u => baselineSelection.includes(u));
  if(firstHalfMoved && secondHalfMoved) return []; // fully moved already, nothing lingers

  const juzBounds = { from: structuralQuarterBounds(previousJuz, 1, ref), to: structuralQuarterBounds(previousJuz, 4, ref) };
  if(!firstHalfMoved && !secondHalfMoved && rollupLevel === 'full'){
    return [{ id: 'lingering-full', label: `Juz ${previousJuz} (complete)`,
      fromSurah: juzBounds.from.startSurah, fromAyah: juzBounds.from.startAyah,
      toSurah: juzBounds.to.endSurah, toAyah: juzBounds.to.endAyah,
      complete: true, canMoveToDhor: true, isFull: true, lingeringJuz: previousJuz }];
  }
  const rows = [];
  const halfBounds = (h) => {
    const start = structuralQuarterBounds(previousJuz, h === 1 ? 1 : 3, ref);
    const end = structuralQuarterBounds(previousJuz, h === 1 ? 2 : 4, ref);
    return { fromSurah: start.startSurah, fromAyah: start.startAyah, toSurah: end.endSurah, toAyah: end.endAyah };
  };
  // Both un-moved halves stay visible/revisable in Sabaq Dhor regardless
  // of order -- the sequential rule only governs canMoveToDhor (Second
  // Half's Dhor option isn't available until First Half has actually
  // moved), not whether the row is shown at all.
  if(!firstHalfMoved){
    const b = halfBounds(1);
    rows.push(Object.assign({ id: 'lingering-h1', label: `Juz ${previousJuz}, First Half` }, b, { complete: true, canMoveToDhor: true, isHalf: true, halfIndex: 1, lingeringJuz: previousJuz }));
  }
  if(!secondHalfMoved){
    const b = halfBounds(2);
    rows.push(Object.assign({ id: 'lingering-h2', label: `Juz ${previousJuz}, Second Half` }, b, { complete: true, canMoveToDhor: firstHalfMoved, isHalf: true, halfIndex: 2, lingeringJuz: previousJuz }));
  }
  return rows;
}

function computeSabaqDhorRows(position, ref, rollupLevel, baselineSelection){
  const pool = baselineSelection || [];
  const lingering = position.previousJuz ? computeLingeringRows(position.previousJuz, ref, rollupLevel, pool) : [];
  const currentRows = computeCurrentJuzRows(position, ref, rollupLevel);
  return lingering.concat(currentRows);
}

function computeCurrentJuzRows(position, ref, rollupLevel){
  const sections = computeSabaqDhorSections(position, ref); // current partial first, then completed ones descending
  if(sections.length === 0) return [];
  const current = sections[0]; // studyQuarter === highest, i.e. the in-progress one
  const completed = sections.slice(1).sort((a, b) => a.studyQuarter - b.studyQuarter); // ascending 1,2,3...

  const rows = [{
    id: `q${current.studyQuarter}`,
    label: `Quarter ${current.studyQuarter} (current)`,
    fromSurah: current.fromSurah, fromAyah: current.fromAyah,
    toSurah: current.toSurah, toAyah: current.toAyah,
    complete: false,
    canMoveToDhor: false
  }];

  if(rollupLevel === 'quarters' || completed.length === 0){
    completed.forEach(s => rows.push({
      id: `q${s.studyQuarter}`,
      label: `Quarter ${s.studyQuarter}`,
      fromSurah: s.fromSurah, fromAyah: s.fromAyah, toSurah: s.toSurah, toAyah: s.toAyah,
      complete: true,
      canMoveToDhor: false // a lone quarter never has its own Dhor option -- only halves and full juz' do
    }));
  } else {
    // Merge into halves (1+2, 3+4) wherever BOTH members of the pair are
    // actually present in `completed` -- a lone quarter (e.g. only Q1
    // done, Q2 still the current one) stays on its own, unmerged.
    const byQuarter = {};
    completed.forEach(s => { byQuarter[s.studyQuarter] = s; });
    const pairs = [[1,2,'First Half'], [3,4,'Second Half']];
    for(const [a, b, label] of pairs){
      if(byQuarter[a] && byQuarter[b]){
        const mergeFull = rollupLevel === 'full' && byQuarter[1] && byQuarter[2] && byQuarter[3] && byQuarter[4];
        if(!mergeFull){
          rows.push({
            id: `h${a}`, label,
            fromSurah: byQuarter[a].fromSurah, fromAyah: byQuarter[a].fromAyah,
            toSurah: byQuarter[b].toSurah, toAyah: byQuarter[b].toAyah,
            complete: true, canMoveToDhor: true, isHalf: true, halfIndex: a === 1 ? 1 : 2
          });
        }
        delete byQuarter[a]; delete byQuarter[b];
      }
    }
    if(rollupLevel === 'full' && byQuarter[1] === undefined && byQuarter[2] === undefined && byQuarter[3] === undefined && byQuarter[4] === undefined && completed.length === 4){
      // all 4 already consumed by the two half-merges above and rollupLevel
      // asked for full -- replace both half rows with one full-juz' row.
      rows.length = 1; // keep just the current row
      rows.push({
        id: 'full',
        label: 'Full Juz\'',
        fromSurah: completed[0].fromSurah, fromAyah: completed[0].fromAyah,
        toSurah: completed[completed.length-1].toSurah, toAyah: completed[completed.length-1].toAyah,
        complete: true, canMoveToDhor: true, isFull: true
      });
    } else {
      // any leftover unmerged single quarters (rare -- only if the pairing
      // didn't complete both halves) still need their own row.
      Object.values(byQuarter).forEach(s => rows.push({
        id: `q${s.studyQuarter}`, label: `Quarter ${s.studyQuarter}`,
        fromSurah: s.fromSurah, fromAyah: s.fromAyah, toSurah: s.toSurah, toAyah: s.toAyah,
        complete: true, canMoveToDhor: false
      }));
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
function advancePositionAfterSabaq(position, fromSurah, fromAyah, toSurah, toAyah, ref){
  const juz = getJuzForPosition(fromSurah, fromAyah, ref); // both endpoints share one juz' -- enforced at save time
  const cmp = compareVerseKey(fromSurah, fromAyah, toSurah, toAyah);
  const fromIsFrontier = juz === 30 ? cmp <= 0 : cmp >= 0;
  const frontier = fromIsFrontier ? { surah: fromSurah, ayah: fromAyah } : { surah: toSurah, ayah: toAyah };
  const newActiveJuz = getJuzForPosition(frontier.surah, frontier.ayah, ref);
  // Bug fix (2026-08-06, found by the user): this used to overwrite
  // sabaqTo unconditionally with whatever this one entry's own frontier
  // was -- correct for the normal case, where each new entry naturally
  // continues from the last, but wrong for a genuinely new entry
  // covering an already-passed range (a backfill, or splitting a
  // previously-logged range into two separate entries) -- confirmed
  // in chat as what actually happened. That entry's own save still
  // goes through this same unconditional path (it IS a new entry, not
  // an edit), silently dragging the real frontier backward to match
  // it even though nothing about genuine progress moved. Now compares
  // the newly-computed frontier against the position already stored,
  // using SABAQ_STUDY_ORDER for a different Juz' (later in study order
  // = genuinely further along) and the same study-direction-aware
  // compareVerseKey already used above for the same Juz' -- only
  // updates when the new frontier is genuinely further along than what
  // was already there. position.activeJuz == null (no prior position
  // at all yet) always accepts the new frontier, same as before.
  let isGenuineAdvance = true;
  if(position.activeJuz != null && newActiveJuz !== position.activeJuz){
    const oldStudyIndex = SABAQ_STUDY_ORDER.indexOf(position.activeJuz);
    const newStudyIndex = SABAQ_STUDY_ORDER.indexOf(newActiveJuz);
    isGenuineAdvance = oldStudyIndex === -1 || newStudyIndex === -1 || newStudyIndex > oldStudyIndex;
  } else if(position.activeJuz != null && position.sabaqTo){
    const withinJuzCmp = compareVerseKey(frontier.surah, frontier.ayah, position.sabaqTo.surah, position.sabaqTo.ayah);
    isGenuineAdvance = newActiveJuz === 30 ? withinJuzCmp <= 0 : withinJuzCmp >= 0;
  }
  if(!isGenuineAdvance) return position;
  const crossedIntoNewJuz = position.activeJuz != null && newActiveJuz !== position.activeJuz;
  return Object.assign({}, position, {
    sabaqTo: frontier,
    activeJuz: newActiveJuz,
    previousJuz: crossedIntoNewJuz ? position.activeJuz : (position.previousJuz || null)
  });
}

// Phase 2b (V3.17.0): which quarter-unit IDs a given row represents, for
// actually moving it into Dhor's eligibility pool (baseline_selection).
// Only ever called for halves/full-juz' rows (canMoveToDhor === true) —
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
