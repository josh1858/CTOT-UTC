(() => {
  'use strict';

  const CONFIG = {
    EARLY_MIN: 5,
    LATE_MIN: 10,
    ENGINE_WARMUP_MIN: 5,
    DAY_MIN: 1440,
    ALERT_THRESHOLDS_MIN: [10, 5, 2, 1, 0]
  };

  const $ = (id) => document.getElementById(id);
  const modDay = (m) => ((m % CONFIG.DAY_MIN) + CONFIG.DAY_MIN) % CONFIG.DAY_MIN;
  let countdownTimer = null;
  let lastResult = null;
  let actualPushbackMinutes = null;
  let alertState = new Set();

  function parseTime(value, label = 'Time') {
    const raw = String(value || '').trim();
    if (!raw) return { ok: false, blank: true, error: `${label} not entered.` };
    const match = raw.match(/^(\d{1,2})(\d{2})$/) || raw.match(/^(\d{1,2})[:.](\d{2})$/) || raw.match(/^(\d{1,2})\s+(\d{2})$/);
    if (!match) return { ok: false, error: `${label}: use HHMM or HH:MM UTC, e.g. 1430 or 14:30.` };
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return { ok: false, error: `${label}: enter a valid UTC time from 0000 to 2359.` };
    return { ok: true, minutes: h * 60 + m };
  }

  function parseTaxi(value) {
    const raw = String(value || '').trim();
    if (!raw) return { ok: false, error: 'Enter taxi time in minutes.' };
    if (!/^\d{1,3}$/.test(raw)) return { ok: false, error: 'Taxi time must be whole minutes.' };
    const mins = Number(raw);
    if (mins < 0 || mins > 240) return { ok: false, error: 'Taxi time must be 0–240 minutes.' };
    return { ok: true, minutes: mins };
  }

  function formatTime(minutes, suffix = 'Z') {
    const m = modDay(Math.round(minutes));
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return suffix ? `${hh}:${mm}${suffix}` : `${hh}:${mm}`;
  }

  function utcNowMinutes() {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  }

  function utcNowWholeMinutes() {
    const now = new Date();
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }

  function formatUtcClock(date = new Date()) {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}Z`;
  }

  function formatUtcDate(date = new Date()) {
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function minutesUntil(targetMinutes, fromMinutes = utcNowMinutes()) {
    let diff = modDay(targetMinutes) - modDay(fromMinutes);
    if (diff < -720) diff += CONFIG.DAY_MIN;
    if (diff > 720) diff -= CONFIG.DAY_MIN;
    return diff;
  }

  function formatCountdown(diffMinutes) {
    const sign = diffMinutes < 0 ? '-' : '';
    const totalSeconds = Math.abs(Math.round(diffMinutes * 60));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return h > 0 ? `${sign}${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${sign}${m}:${String(s).padStart(2, '0')}`;
  }

  function calculate({ ctotText, tsatText, taxiText, singleEngineTaxi, expectedPushText }) {
    const ctot = parseTime(ctotText, 'CTOT');
    if (!ctot.ok) return { ok: false, error: ctot.error };

    const taxi = parseTaxi(taxiText);
    if (!taxi.ok) return { ok: false, error: taxi.error };

    const tsatRaw = String(tsatText || '').trim();
    let tsat = null;
    if (tsatRaw) {
      const parsedTsat = parseTime(tsatRaw, 'TSAT');
      if (!parsedTsat.ok) return { ok: false, error: parsedTsat.error };
      tsat = parsedTsat.minutes;
    }

    const ctotEarliestPush = ctot.minutes - CONFIG.EARLY_MIN - taxi.minutes;
    const ctotLatestPush = ctot.minutes + CONFIG.LATE_MIN - taxi.minutes;
    const earliestPushback = tsat === null ? ctotEarliestPush : Math.max(ctotEarliestPush, tsat);
    const latestPushback = ctotLatestPush;
    const earliestDeparture = ctot.minutes - CONFIG.EARLY_MIN;
    const latestDeparture = ctot.minutes + CONFIG.LATE_MIN;

    const result = {
      ok: true,
      ctotMinutes: ctot.minutes,
      tsatMinutes: tsat,
      taxiMinutes: taxi.minutes,
      ctotEarliestPush,
      earliestPushback,
      latestPushback,
      earliestDeparture,
      latestDeparture,
      singleEngineTaxi: Boolean(singleEngineTaxi),
      engine: null,
      warning: earliestPushback > latestPushback ? 'TSAT is later than the CTOT-based latest pushback. Check ATC/handling constraints.' : ''
    };

    if (singleEngineTaxi) {
      const expectedRaw = String(expectedPushText || '').trim();
      if (expectedRaw) {
        const expected = parseTime(expectedRaw, 'Expected pushback');
        if (!expected.ok) return { ok: false, error: expected.error };
        const expectedTakeoff = expected.minutes + taxi.minutes;
        result.engine = { mode: 'expectedPushback', expectedPushback: expected.minutes, expectedTakeoff, latestEngineStart: expectedTakeoff - CONFIG.ENGINE_WARMUP_MIN };
      } else {
        result.engine = { mode: 'latestAllowedTakeoff', latestEngineStart: latestDeparture - CONFIG.ENGINE_WARMUP_MIN };
      }
    }

    return result;
  }

  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
  function setVisible(id, visible) { const el = $(id); if (el) el.hidden = !visible; }

  function setCountdownState(cardId, diff) {
    const card = $(cardId);
    if (!card) return;
    card.classList.remove('due-now', 'overdue', 'soon');
    if (diff < 0) card.classList.add('overdue');
    else if (diff <= 1) card.classList.add('due-now');
    else if (diff <= 10) card.classList.add('soon');
  }

  function beepOrVibrate(key, diffMinutes) {
    const whole = Math.ceil(diffMinutes);
    if (!CONFIG.ALERT_THRESHOLDS_MIN.includes(whole)) return;
    if (diffMinutes < -0.02 || diffMinutes > whole + 0.05) return;
    const id = `${key}:${whole}`;
    if (alertState.has(id)) return;
    alertState.add(id);
    if ('vibrate' in navigator) navigator.vibrate(whole === 0 ? [180, 80, 180] : 120);
  }

  function renderUtcClock() {
    const now = new Date();
    setText('utcClock', formatUtcClock(now));
    setText('utcDate', `${formatUtcDate(now)} · UTC`);
  }

  function renderCountdowns() {
    renderUtcClock();
    if (!lastResult || !lastResult.ok) {
      setText('earliestPushCountdown', '--:--');
      setText('engineCountdown', '--:--');
      setText('earliestPushCountdownLabel', 'Enter CTOT and taxi time.');
      setText('engineCountdownLabel', 'Tick Single Engine Taxi.');
      setCountdownState('earliestCountdownCard', 999);
      setCountdownState('engineCountdownCard', 999);
      return;
    }

    const epDiff = minutesUntil(lastResult.earliestPushback);
    setText('earliestPushCountdown', formatCountdown(epDiff));
    setText('earliestPushCountdownLabel', epDiff >= 0 ? `until earliest pushback ${formatTime(lastResult.earliestPushback)}` : `since earliest pushback ${formatTime(lastResult.earliestPushback)}`);
    setCountdownState('earliestCountdownCard', epDiff);
    beepOrVibrate('earliestPush', epDiff);

    if (lastResult.singleEngineTaxi && lastResult.engine) {
      const engineDiff = minutesUntil(lastResult.engine.latestEngineStart);
      setText('engineCountdown', formatCountdown(engineDiff));
      setText('engineCountdownLabel', engineDiff >= 0 ? `until latest engine start ${formatTime(lastResult.engine.latestEngineStart)}` : `past latest engine start ${formatTime(lastResult.engine.latestEngineStart)}`);
      setCountdownState('engineCountdownCard', engineDiff);
      beepOrVibrate('engineStart', engineDiff);
    } else {
      setText('engineCountdown', '--:--');
      setText('engineCountdownLabel', 'Tick Single Engine Taxi.');
      setCountdownState('engineCountdownCard', 999);
    }
  }

  function renderActualPushSummary() {
    if (actualPushbackMinutes === null) {
      setText('actualPushSummary', 'Actual pushback not recorded.');
      return;
    }
    if (!lastResult || !lastResult.ok) {
      setText('actualPushSummary', `Actual pushback recorded at ${formatTime(actualPushbackMinutes)}.`);
      return;
    }
    const comparedToEarliest = actualPushbackMinutes - modDay(lastResult.earliestPushback);
    const comparedToLatest = actualPushbackMinutes - modDay(lastResult.latestPushback);
    let note = 'inside calculated pushback window';
    if (comparedToEarliest < 0 && Math.abs(comparedToEarliest) < 720) note = `${Math.abs(Math.round(comparedToEarliest))} min before earliest pushback`;
    else if (comparedToLatest > 0 && Math.abs(comparedToLatest) < 720) note = `${Math.round(comparedToLatest)} min after latest pushback`;
    setText('actualPushSummary', `Actual pushback recorded at ${formatTime(actualPushbackMinutes)} · ${note}.`);
  }

  function render() {
    const singleEngineTaxi = $('singleEngineTaxi').checked;
    setVisible('expectedPushRow', singleEngineTaxi);
    setVisible('engineCard', singleEngineTaxi);

    const result = calculate({
      ctotText: $('ctot').value,
      tsatText: $('tsat').value,
      taxiText: $('taxi').value,
      singleEngineTaxi,
      expectedPushText: $('expectedPush').value
    });
    lastResult = result;

    if (!result.ok) {
      document.body.classList.add('has-error');
      setText('status', `${result.error} · all entries are UTC.`);
      ['earliestPush','latestPush','departureWindow','tsatSummary','engineStart'].forEach(id => setText(id, '--:--'));
      setText('taxiSummary', 'Taxi time not entered');
      setText('pushHint', 'Times shown in UTC.');
      setText('engineBasis', 'Tick Single Engine Taxi to show engine timing.');
      renderActualPushSummary();
      renderCountdowns();
      return false;
    }

    document.body.classList.remove('has-error');
    setText('status', result.warning || 'Calculated successfully · UTC');
    setText('earliestPush', formatTime(result.earliestPushback));
    setText('latestPush', formatTime(result.latestPushback));
    setText('departureWindow', `${formatTime(result.earliestDeparture)} to ${formatTime(result.latestDeparture)}`);
    setText('taxiSummary', `${result.taxiMinutes} min taxi`);
    setText('pushHint', `Earliest is ${result.tsatMinutes === null ? 'CTOT based' : 'TSAT/CTOT constrained'} · all times UTC.`);
    setText('tsatSummary', result.tsatMinutes === null ? 'No TSAT entered — earliest pushback is CTOT based.' : `TSAT ${formatTime(result.tsatMinutes)} applied. CTOT-only earliest pushback would be ${formatTime(result.ctotEarliestPush)}.`);

    if (singleEngineTaxi && result.engine) {
      setText('engineStart', formatTime(result.engine.latestEngineStart));
      setText('engineBasis', result.engine.mode === 'expectedPushback'
        ? `Based on expected pushback ${formatTime(result.engine.expectedPushback)} + ${result.taxiMinutes} min taxi, expected takeoff ${formatTime(result.engine.expectedTakeoff)}. Engine must be running 5 min before takeoff.`
        : `No expected pushback entered. Based on latest allowed takeoff ${formatTime(result.latestDeparture)}. Engine must be running 5 min before takeoff.`);
    }

    renderActualPushSummary();
    renderCountdowns();
    return true;
  }

  function startCountdownTimer() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(renderCountdowns, 1000);
  }

  function installHandlers() {
    ['ctot', 'tsat', 'taxi', 'expectedPush'].forEach((id) => {
      $(id).addEventListener('input', render);
      $(id).addEventListener('change', render);
    });
    $('singleEngineTaxi').addEventListener('change', render);
    $('calculate').addEventListener('click', (event) => { event.preventDefault(); alertState = new Set(); render(); });
    $('actualPushNow').addEventListener('click', () => { actualPushbackMinutes = utcNowWholeMinutes(); render(); });
    $('reset').addEventListener('click', () => {
      ['ctot', 'tsat', 'taxi', 'expectedPush'].forEach(id => { $(id).value = ''; });
      $('singleEngineTaxi').checked = false;
      actualPushbackMinutes = null;
      alertState = new Set();
      render();
      $('ctot').focus();
    });
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  window.CTOTApp = { parseTime, parseTaxi, formatTime, utcNowMinutes, minutesUntil, formatCountdown, calculate, render, renderCountdowns, formatUtcClock };
  document.addEventListener('DOMContentLoaded', () => { installHandlers(); registerServiceWorker(); renderUtcClock(); render(); startCountdownTimer(); });
})();
