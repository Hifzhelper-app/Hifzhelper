/* Hifzhelper build 4.2.14 | worker/src/haidhTimeline.js */
// ============================================================
// Hifzhelper — one normalized Haidh timeline (V4.2.14).
//
// Stored attendance rows are evidence; this module decides what state is
// actually allowed to surface. There are only two Haidh states now:
// confirmed `haidh` and planned `predicted-haidh`. Maktab activity is
// stronger than either and terminates that episode, so stale stored marks
// after a return log cannot make the old period resume on another screen.
// ============================================================

import { HAIDH_GAP_CODE, haidhCodeMaxRunDays, haidhAddDaysISO } from '../../shared/haidhRules.js';

function daysBetweenISO(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

function uniqueSorted(values) {
  return [...new Set(values || [])].filter(Boolean).sort();
}

function firstInRange(sortedDates, from, to) {
  for (const date of sortedDates) {
    if (date < from) continue;
    if (date > to) break;
    return date;
  }
  return null;
}

function splitContiguous(dates) {
  const out = [];
  for (const date of uniqueSorted(dates)) {
    const last = out[out.length - 1];
    if (!last || daysBetweenISO(last[last.length - 1], date) !== 1) out.push([date]);
    else last.push(date);
  }
  return out;
}

/**
 * Normalize raw attendance marks against stronger Maktab evidence.
 *
 * @param {Array<{date:string,status:string}>} attendanceRows
 * @param {Iterable<string>} activityDates dates with any Maktab log
 * @param {Iterable<string>} explicitStopDates non-Maktab stop-evidence (e.g. teacher Absent / stored Present)
 * @param {string} ruling retained for compatibility; V4.2.14's global max is 10
 */
export function normalizeHaidhTimeline(attendanceRows, activityDates = [], explicitStopDates = [], ruling = 'hanafi') {
  const rows = Array.isArray(attendanceRows) ? attendanceRows : [];
  const confirmedDates = uniqueSorted(rows.filter(r => r && r.status === 'haidh').map(r => r.date));
  const predictedDates = uniqueSorted(rows.filter(r => r && r.status === 'predicted-haidh').map(r => r.date));
  const activities = uniqueSorted(Array.from(activityDates || []));
  const explicitStops = uniqueSorted(Array.from(explicitStopDates || []));
  const stops = uniqueSorted([...activities, ...explicitStops]);
  const maxTouchedDates = haidhCodeMaxRunDays(ruling); // official 10, +1 partial-day edge

  const acceptedConfirmed = new Set();
  const episodes = [];
  let lastEpisode = null;

  for (const date of confirmedDates) {
    let canJoinLast = false;
    if (lastEpisode) {
      const joinEnd = lastEpisode.confirmed_window_end;
      canJoinLast = date <= joinEnd;
    }

    if (!canJoinLast) {
      if (lastEpisode) {
        const purityAnchor = lastEpisode.terminated_at || lastEpisode.last_confirmed;
        const gap = daysBetweenISO(purityAnchor, date) - 1;
        if (gap < HAIDH_GAP_CODE) continue; // stale/invalid continuation; never resume the old episode
      }

      const limit = haidhAddDaysISO(date, maxTouchedDates - 1);
      const stop = firstInRange(stops, date, limit);
      const confirmedWindowEnd = stop ? haidhAddDaysISO(stop, -1) : limit;
      lastEpisode = {
        start: date,
        limit,
        confirmed_window_end: confirmedWindowEnd,
        terminated_at: stop,
        first_confirmed: date,
        last_confirmed: date,
      };
      episodes.push(lastEpisode);
    }

    if (date <= lastEpisode.confirmed_window_end) {
      acceptedConfirmed.add(date);
      lastEpisode.last_confirmed = date;
    }
  }

  // If an episode has a stop, all stored predictions from that stop until the
  // purity window has elapsed belong to the old episode and are invalid. A
  // later predicted cycle remains intact.
  const blockedPredictionWindows = episodes
    .filter(ep => ep.terminated_at)
    .map(ep => ({ from: ep.terminated_at, to: haidhAddDaysISO(ep.terminated_at, HAIDH_GAP_CODE) }));

  const acceptedPredicted = new Set();
  for (const cluster of splitContiguous(predictedDates)) {
    const start = cluster[0], end = cluster[cluster.length - 1];
    const stop = firstInRange(stops, start, end);
    for (const date of cluster) {
      if (acceptedConfirmed.has(date)) continue;
      if (activities.includes(date) || explicitStops.includes(date)) continue;
      if (stop && date >= stop) continue; // activity/absence terminates this predicted run
      if (blockedPredictionWindows.some(w => date >= w.from && date <= w.to)) continue;
      acceptedPredicted.add(date);
    }
  }

  const byDate = new Map();
  for (const date of acceptedPredicted) byDate.set(date, 'predicted-haidh');
  for (const date of acceptedConfirmed) byDate.set(date, 'haidh'); // confirmed beats prediction
  for (const date of activities) byDate.set(date, 'activity');     // strongest evidence

  const normalizedRows = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, status]) => ({ date, status }));

  return {
    rows: normalizedRows,
    byDate,
    confirmedDates: [...acceptedConfirmed].sort(),
    predictedDates: [...acceptedPredicted].sort(),
    activityDates: activities,
    episodes,
  };
}

export function latestHaidhTerminationBefore(timeline, date) {
  const episodes = timeline && Array.isArray(timeline.episodes) ? timeline.episodes : [];
  let latest = null;
  for (const ep of episodes) {
    if (!ep.terminated_at || ep.terminated_at >= date) continue;
    if (latest == null || ep.terminated_at > latest) latest = ep.terminated_at;
  }
  return latest;
}
