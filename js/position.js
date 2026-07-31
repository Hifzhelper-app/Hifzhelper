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
// confirmed rules: any Dhor history → don't prepopulate either field, the
// caller passes hasDhor and just gets nulls back for both; no Sabaq history
// yet either → 114:1/114:6 (juz' 30's start, per the study order); has
// Sabaq history → the last reached point prefills To if currently in juz'
// 30 (studied backwards, so the frontier is the FURTHER-along end) or From
// otherwise (studied forwards, so the frontier is the starting point for
// what's next).
function nextSabaqDefaults(position, ref, hasDhor){
  if(hasDhor) return { from: null, to: null };
  if(!position.sabaqTo){
    return { from: { surah: 114, ayah: 1 }, to: { surah: 114, ayah: 6 } };
  }
  const juz = getJuzForPosition(position.sabaqTo.surah, position.sabaqTo.ayah, ref);
  if(juz === 30){
    return { from: null, to: { surah: position.sabaqTo.surah, ayah: position.sabaqTo.ayah } };
  }
  return { from: { surah: position.sabaqTo.surah, ayah: position.sabaqTo.ayah }, to: null };
}

// Called after a Sabaq entry saves, with its own sabaq_to surah/ayah.
// Just advances the frontier — no juz'-completion detection, no baseline
// side effects (see the file header for why that changed).
function advancePositionAfterSabaq(position, toSurah, toAyah, ref){
  return {
    sabaqTo: { surah: toSurah, ayah: toAyah },
    activeJuz: getJuzForPosition(toSurah, toAyah, ref)
  };
}

// Sabaq Dhor recites the CURRENT juz' from its start up to the current
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
