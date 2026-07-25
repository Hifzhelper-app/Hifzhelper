// ============================================================
// Hifzhelper — Dhor timer (start / lap / stop)
// lap_times only gets populated if the student actually taps Lap at least
// once — a plain start-to-stop session just produces duration_seconds,
// per "make inputs optional wherever possible." When laps ARE used, the
// final segment (last lap to stop) is captured too, so sum(lap_times)
// always exactly equals duration_seconds — verified invariant, not assumed.
// ============================================================

let timerState = null; // { startTime, lastLapTime, laps: [], intervalId }

function formatMinSec(totalSeconds){
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

function renderTimer(containerId, onFinish){
  const el = document.getElementById(containerId);
  el.innerHTML = `
    <div class="timer-display" id="timerDisplay">0:00</div>
    <div class="timer-laps" id="timerLaps"></div>
    <div class="timer-controls">
      <button type="button" class="secondary" id="timerStartBtn">Start</button>
      <button type="button" class="secondary hidden" id="timerLapBtn">Lap</button>
      <button type="button" class="primary hidden" id="timerStopBtn">Stop</button>
    </div>
  `;

  document.getElementById('timerStartBtn').addEventListener('click', () => {
    const now = Date.now();
    timerState = { startTime: now, lastLapTime: now, laps: [] };
    document.getElementById('timerStartBtn').classList.add('hidden');
    document.getElementById('timerLapBtn').classList.remove('hidden');
    document.getElementById('timerStopBtn').classList.remove('hidden');
    timerState.intervalId = setInterval(() => {
      const elapsed = (Date.now() - timerState.startTime) / 1000;
      document.getElementById('timerDisplay').textContent = formatMinSec(elapsed);
    }, 250);
  });

  document.getElementById('timerLapBtn').addEventListener('click', () => {
    if(!timerState) return;
    const now = Date.now();
    const lapSeconds = (now - timerState.lastLapTime) / 1000;
    timerState.laps.push(lapSeconds);
    timerState.lastLapTime = now;
    const lapsEl = document.getElementById('timerLaps');
    lapsEl.innerHTML += `<div class="lap-row">Lap ${timerState.laps.length}: ${formatMinSec(lapSeconds)}</div>`;
  });

  document.getElementById('timerStopBtn').addEventListener('click', () => {
    if(!timerState) return;
    clearInterval(timerState.intervalId);
    const now = Date.now();
    const totalSeconds = Math.round((now - timerState.startTime) / 1000);
    let lapTimes = null;
    if(timerState.laps.length > 0){
      const finalLap = (now - timerState.lastLapTime) / 1000;
      lapTimes = timerState.laps.concat([finalLap]).map(s => Math.round(s));
    }
    timerState = null;
    onFinish({ duration_seconds: totalSeconds, lap_times: lapTimes });
  });
}
