// ============================================================
// Hifzhelper — client-side position tracking (V3.12.0)
// The Worker's position.js only stores whatever JSON blob it's given (see
// that file's own comment) — all the actual progress logic lives here,
// same "computed client-side" design already documented in SCHEMA.md.
//
// Shape used: { activeJuz, sabaqFrontier: {surah, ayah} | null }.
// activeJuz is which juz' Sabaq is currently working through (per
// SABAQ_STUDY_ORDER); sabaqFrontier is the most recent Sabaq entry's end
// point within it, or null for a juz' just started (nothing sabaq'd yet).
//
// Sabaq Dhor (a later delivery) will read this same position to build its
// checkable-quarters list — not wired in yet, this delivery is Sabaq only.
// ============================================================

async function loadPosition(){
  const row = await apiGetPosition();
  let position = null;
  try{ position = row && row.position_json ? JSON.parse(row.position_json) : null; } catch(e){ position = null; }
  if(!position || !position.activeJuz){
    position = { activeJuz: SABAQ_STUDY_ORDER[0], sabaqFrontier: null }; // brand new student — juz' 30 first
  }
  return position;
}

function savePosition(position){
  return apiSavePosition(JSON.stringify(position), null);
}

// The default {surah, ayah} to prefill for a NEW Sabaq entry, given the
// current position and mushaf ref (13-line/15-line/Hybrid juz' boundaries
// can differ at the margins — see the ref-aware helpers in shared/data.js).
function nextSabaqDefault(position, ref){
  if(!position.sabaqFrontier) return firstSabaqPositionForJuz(position.activeJuz, ref);
  const { surah, ayah, juzComplete } = nextSabaqPosition(position.sabaqFrontier.surah, position.sabaqFrontier.ayah, ref);
  if(juzComplete){
    // Shouldn't normally be reached (a completed juz' advances activeJuz
    // and clears the frontier at save time, see advancePositionAfterSabaq
    // below) — but if it is, fall back to wherever activeJuz would start.
    return firstSabaqPositionForJuz(position.activeJuz, ref);
  }
  return { surah, ayah };
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
function computeSabaqDhorSections(position, ref){
  if(!position.sabaqFrontier) return [];
  const juz = position.activeJuz;
  const { quarterIndex: frontierStructuralQ } = structuralQuarterOf(position.sabaqFrontier.surah, position.sabaqFrontier.ayah, ref);
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
      toSurah: isCurrent ? position.sabaqFrontier.surah : bounds.endSurah,
      toAyah: isCurrent ? position.sabaqFrontier.ayah : bounds.endAyah
    });
  }
  return sections;
}

// Returns the updated position AND whether the just-finished juz' should
// be added to Hifz Setup's baseline_selection (confirmed in chat: Sabaq
// crossing a juz' boundary auto-adds it, no manual Juz' grid check-off
// needed). Caller is responsible for actually persisting both — this
// function only computes what changed.
function advancePositionAfterSabaq(position, savedSurah, savedAyah, ref){
  const { juzComplete } = nextSabaqPosition(savedSurah, savedAyah, ref);
  if(!juzComplete){
    return { position: { activeJuz: position.activeJuz, sabaqFrontier: { surah: savedSurah, ayah: savedAyah } }, completedJuz: null };
  }
  const completedJuz = position.activeJuz;
  const nextJuz = nextJuzInStudyOrder(completedJuz);
  return {
    position: { activeJuz: nextJuz, sabaqFrontier: null }, // null: nothing sabaq'd yet in the new juz'
    completedJuz
  };
}
