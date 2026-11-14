/* Focus Timer — shared logic.
   Seven activities (work, paused, workflow, workout, eating, shower, sleep); exactly one is "active" at a time.
   Every stretch of an activity is stored as a segment; daily totals are computed from segments.
   The outreach counter is a list of click times. Everything is saved in this browser's localStorage. */
(function (root) {
  'use strict';

  var KEY = 'tsa2_data', OLD_KEY = 'tsa1_data', CHRONO_KEY = 'tsa2_chrono', LEADER_KEY = 'tsa2_leader';
  var RESUME_MS = 30000;    // a page that comes back within 30 s keeps the running timer
  var WORK_SEC = 3600;      // every work round is one hour
  var ACTS = ['work', 'paused', 'workflow', 'workout', 'eating', 'shower', 'sleep'];
  var BEEP_ACTS = ['paused', 'workflow', 'workout', 'eating'];
  var NOTE_ACTS = ['work', 'workflow'];          // sessions that can carry a note
  var KEEPS_RUNNING = { sleep: true };           // counts by the clock even if the page is closed
  var META = {
    work:     { label: 'Work',     icon: '⏰',             color: '--c-work'   },
    paused:   { label: 'Paused',   icon: '⏸️',       color: '--c-paused' },
    workflow: { label: 'Workflow', icon: '🛠️', color: '--c-flow'   },
    workout:  { label: 'Workout',  icon: '🏋️', color: '--c-gym'    },
    eating:   { label: 'Eating',   icon: '🍽️', color: '--c-eat'    },
    shower:   { label: 'Shower',   icon: '🚿',       color: '--c-shower' },
    sleep:    { label: 'Sleep',    icon: '🌙',       color: '--c-sleep'  }
  };

  var pad = function (n) { return String(n).padStart(2, '0'); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  var zero = function () { var o = {}; ACTS.forEach(function (a) { o[a] = 0; }); return o; };

  function dayKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function startOfDay(ms) { var d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function nextMidnight(ms) { var d = new Date(ms); d.setHours(24, 0, 0, 0); return d.getTime(); }
  function addDays(key, n) {
    var p = key.split('-').map(Number);
    return dayKey(new Date(p[0], p[1] - 1, p[2] + n).getTime());
  }
  function keyToDate(key) { var p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function fmtDur(sec) {
    sec = Math.round(sec || 0);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h) return h + 'h ' + pad(m) + 'm';
    if (m) return m + 'm ' + pad(s) + 's';
    return s + 's';
  }

  /* ---------- state ---------- */
  var S = null;
  var memoryOnly = false;

  function defaults() {
    return {
      version: 2,
      settings: {
        autoRestart: false, theme: 'auto', volume: 0.5, beepMinutes: 10, shortPauseSec: 20,
        beep: { paused: true, workflow: true, workout: true, eating: true }
      },
      timer: { mode: 'idle' },   // the work countdown: idle | running | paused
      active: 'paused',          // which activity is running right now
      activeSince: null,         // when it started
      beepFrom: null,            // reference time for the reminder beeps
      lastSeen: null,            // heartbeat of the last open page
      segments: [],              // finished stretches: { act, start, end, [id, note] }
      sessions: [],              // finished work rounds (= points)
      outreach: { clicks: [], goal: 3, adj: {} },   // click times of the outreach counter + hand corrections per day
      days: {}                   // 'YYYY-MM-DD' -> { firstOpen }
    };
  }
  function normalize(o) {
    var d = defaults();
    if (!o || typeof o !== 'object') return d;
    var r = Object.assign(d, o);
    r.settings = Object.assign(defaults().settings, o.settings || {});
    r.settings.beep = Object.assign({ paused: true, workflow: true, workout: true, eating: true }, (o.settings && o.settings.beep) || {});
    if (!(r.settings.beepMinutes > 0)) r.settings.beepMinutes = 10;
    if (!(r.settings.shortPauseSec >= 0 && r.settings.shortPauseSec <= 600)) r.settings.shortPauseSec = 20;
    ['segments', 'sessions'].forEach(function (k) { if (!Array.isArray(r[k])) r[k] = defaults()[k]; });
    if (!r.outreach || typeof r.outreach !== 'object') r.outreach = { clicks: [], goal: 3, adj: {} };
    if (!Array.isArray(r.outreach.clicks)) r.outreach.clicks = [];
    if (!(r.outreach.goal >= 1)) r.outreach.goal = 3;
    if (!r.outreach.adj || typeof r.outreach.adj !== 'object' || Array.isArray(r.outreach.adj)) r.outreach.adj = {};   // hand-typed corrections per day
    if (typeof r.liveNote !== 'string') r.liveNote = '';
    if (!r.days || typeof r.days !== 'object') r.days = {};
    if (!r.timer || !r.timer.mode) r.timer = { mode: 'idle' };
    r.segments.forEach(function (g) { if (g && g.act === 'family') { g.act = 'paused'; delete g.id; delete g.note; } });   // the removed Family timer counts as Paused
    if (ACTS.indexOf(r.active) < 0) r.active = 'paused';
    delete r.presets; delete r.selectedDurationSec;   // rounds are always one hour now
    r.version = 2;
    return r;
  }

  /* Old data (version 1: one countdown, pauses and gaps) becomes version 2. */
  function migrate(o, now) {
    if (!o || typeof o !== 'object') return null;
    if (o.version === 2 && Array.isArray(o.segments)) return o;
    var n = {
      version: 2, settings: o.settings,
      sessions: Array.isArray(o.sessions) ? o.sessions : [], days: o.days || {}, segments: []
    };
    n.sessions.forEach(function (s) {
      if (s && s.durationSec > 0 && s.end) n.segments.push({ act: 'work', start: s.end - s.durationSec * 1000, end: s.end });
    });
    (Array.isArray(o.intervals) ? o.intervals : []).forEach(function (i) {
      if (i && i.end > i.start) n.segments.push({ act: 'paused', start: i.start, end: i.end });
    });
    n.segments.sort(function (a, b) { return a.end - b.end; });
    var t = o.timer;
    if (t && (t.mode === 'running' || t.mode === 'paused')) {
      n.timer = { mode: 'paused', durationSec: t.durationSec, presetName: t.presetName, startedAt: t.startedAt,
        remainingMs: t.mode === 'running' ? Math.max(0, t.endAt - now) : t.remainingMs };
    } else n.timer = { mode: 'idle' };
    n.active = 'paused';
    n.activeSince = o.nw && o.nw.start ? o.nw.start : null;
    n.lastSeen = null;
    return n;
  }

  function readStore() {
    try {
      var raw = root.localStorage.getItem(KEY);
      if (raw) return migrate(JSON.parse(raw), Date.now());
      var old = root.localStorage.getItem(OLD_KEY);          // the first version's data stays untouched as a backup
      return old ? migrate(JSON.parse(old), Date.now()) : null;
    } catch (e) { return null; }
  }
  function save() {
    try { root.localStorage.setItem(KEY, JSON.stringify(S)); memoryOnly = false; }
    catch (e) { memoryOnly = true; }
  }
  function reload() { var o = readStore(); if (o) S = normalize(o); return S; }

  function ensureDay(now, fromMidnight) {
    var k = dayKey(now);
    if (!S.days[k]) { S.days[k] = { firstOpen: fromMidnight ? startOfDay(now) : now }; return true; }
    return false;
  }

  /* Calls fn(dayKey, seconds) for each calendar day a stretch covers.
     Paused only counts from that day's first open. */
  function dayParts(act, start, end, fn) {
    var s = start;
    while (s < end) {
      var e = Math.min(end, nextMidnight(s)), k = dayKey(s), from = s;
      if (act === 'paused') {
        var d = S.days[k];
        if (!d) { s = e; continue; }
        from = Math.max(s, d.firstOpen);
      }
      if (e > from) fn(k, (e - from) / 1000);
      s = e;
    }
  }

  /* The stretch that is running now. If the page vanished a while ago, the activity only counts
     until it was last seen, and the rest counts as Paused (Sleep is the exception: it keeps counting). */
  function liveParts(now) {
    if (S.activeSince == null) return [];
    var a = S.active, st = S.activeSince;
    if (a !== 'paused' && !KEEPS_RUNNING[a] && S.lastSeen != null && now - S.lastSeen > RESUME_MS) {
      var cut = Math.max(S.lastSeen, st);
      return [{ act: a, start: st, end: cut, note: S.liveNote || '' }, { act: 'paused', start: cut, end: Math.max(now, cut) }];
    }
    return [{ act: a, start: st, end: Math.max(now, st), note: S.liveNote || '' }];
  }

  function closeSeg(now) {
    var st = S.activeSince;
    if (st != null && now > st) {
      var seg = { act: S.active, start: st, end: now, id: uid() };
      if (S.liveNote) seg.note = S.liveNote;           // a note added while it was running
      S.liveNote = '';
      S.segments.push(seg);
      return seg;
    }
    S.liveNote = '';
    return null;
  }
  function pauseCountdown(at) {
    if (S.timer.mode === 'running') {
      S.timer.remainingMs = Math.max(0, S.timer.endAt - at);
      S.timer.mode = 'paused';
    }
  }
  function completeSession(endAt, t, auto) {
    S.sessions.push({
      id: uid(), start: t.startedAt, end: endAt, day: dayKey(endAt),
      preset: t.presetName || '1 hour', durationSec: t.durationSec, auto: !!auto
    });
  }
  function newRound(at) {
    return { mode: 'running', durationSec: WORK_SEC, presetName: '1 hour', startedAt: at, endAt: at + WORK_SEC * 1000 };
  }

  /* Finish countdown rounds that are due (no reload, no save). */
  function settle(now) {
    var rounds = 0, auto = !!S.settings.autoRestart;
    while (S.active === 'work' && S.timer.mode === 'running' && now >= S.timer.endAt && rounds < 1000) {
      var t = S.timer, endAt = t.endAt;
      completeSession(endAt, t, auto);
      rounds++;
      if (auto) {
        S.timer = newRound(endAt);
      } else {
        closeSeg(endAt);
        S.timer = { mode: 'idle' };
        S.active = 'paused'; S.activeSince = endAt; S.beepFrom = endAt;
      }
    }
    return { rounds: rounds, auto: auto };
  }

  /* Call once when a page opens. */
  function boot(now, opts) {
    now = now || Date.now();
    if (opts === true) opts = { keep: true };
    opts = opts || {};
    if (!opts.keep || !S) S = normalize(readStore());
    ensureDay(now, false);
    var closedAct = null;
    if (S.activeSince == null) { S.activeSince = now; S.beepFrom = now; }
    if (S.beepFrom == null) S.beepFrom = now;
    if (S.lastSeen == null) S.lastSeen = now;
    if (now - S.lastSeen > RESUME_MS) {
      var stopAt = Math.max(S.lastSeen, S.activeSince);
      settle(stopAt);                                  // rounds that ended before the page vanished
      if (S.active !== 'paused' && !KEEPS_RUNNING[S.active]) {
        closedAct = { act: S.active, at: stopAt };
        closeSeg(stopAt);
        if (S.active === 'work') pauseCountdown(stopAt);
        S.active = 'paused'; S.activeSince = stopAt;   // closed time counts as Paused
      }
      S.beepFrom = now;
    }
    S.lastSeen = now;
    save();
    return { closedAct: closedAct };
  }

  /* ---------- actions ---------- */
  /* Makes `act` the running activity. The previous one only stops; nothing is reset. */
  function switchTo(act, now) {
    now = now || Date.now();
    if (ACTS.indexOf(act) < 0 || S.active === act) return null;
    var closed = null, at = now, cdAt = now, lim = S.settings.shortPauseSec;
    if (S.active === 'paused' && lim > 0 && S.activeSince != null && now - S.activeSince < lim * 1000) {
      /* A short Paused (you just switched tasks): it leaves no block of its own, its time goes to the new timer. */
      at = cdAt = S.activeSince;
      var last = S.segments[S.segments.length - 1];
      if (last && last.act === act && last.end === at) {       // same timer again: the two runs join into one
        S.segments.pop();
        at = last.start;
        S.liveNote = [last.note, S.liveNote].filter(Boolean).join(' / ').slice(0, 200);
      }
    } else {
      closed = closeSeg(now);
      if (S.active === 'work') pauseCountdown(now);
    }
    if (act === 'work') {
      if (S.timer.mode === 'paused') {
        S.timer.endAt = cdAt + S.timer.remainingMs;
        delete S.timer.remainingMs;
        S.timer.mode = 'running';
      } else S.timer = newRound(cdAt);
    }
    S.active = act; S.activeSince = at; S.beepFrom = at; S.lastSeen = now;
    save();
    return { closed: closed };
  }
  function setNote(id, note) {
    var s = S.segments.find(function (x) { return x.id === id; });
    if (!s) return false;
    s.note = String(note || '').trim().slice(0, 200);
    save(); return true;
  }
  /* ----- notes on any timer's run ----- */
  var cleanNote = function (t) { return String(t || '').trim().slice(0, 200); };
  /* The run a note button of `act` points at: the running one, else that timer's most recent run. */
  function noteTarget(act) {
    if (S.active === act && S.activeSince != null) return { act: act, start: S.activeSince, end: null, live: true, note: S.liveNote || '' };
    for (var i = S.segments.length - 1, best = null; i >= 0; i--) {
      var g = S.segments[i];
      if (g && g.act === act && (!best || g.start > best.start)) best = g;
    }
    return best ? { act: act, start: best.start, end: best.end, live: false, note: best.note || '' } : null;
  }
  /* Sets (or, with empty text, removes) the note of the run of `act` that started at `start`. */
  function setNoteAt(act, start, text) {
    var n = cleanNote(text);
    if (S.active === act && S.activeSince === start) { S.liveNote = n; save(); return true; }
    var g = S.segments.find(function (x) { return x.act === act && x.start === start; });
    if (!g) return false;
    if (!g.id) g.id = uid();
    if (n) g.note = n; else delete g.note;
    save(); return true;
  }
  /* Every note, newest first. */
  function allNotes(now) {
    var out = S.segments.filter(function (g) { return g && g.note; })
      .map(function (g) { return { act: g.act, start: g.start, end: g.end, note: g.note, live: false }; });
    if (S.liveNote && S.activeSince != null) out.push({ act: S.active, start: S.activeSince, end: Math.max(now || Date.now(), S.activeSince), note: S.liveNote, live: true });
    return out.sort(function (a, b) { return b.start - a.start; });
  }
  /* Keeps "last seen" fresh so a vanished page can be told apart from a running one. */
  function heartbeat(now, force) {
    now = now || Date.now();
    if (!S) return;
    if (force || S.lastSeen == null || now - S.lastSeen >= 5000) { S.lastSeen = Math.max(S.lastSeen || 0, now); save(); }
  }
  /* Call a few times per second. Returns null, or {rounds, auto} when countdown rounds finished. */
  function tick(now) {
    now = now || Date.now();
    if (!S) return null;
    if (ensureDay(now, true)) save();
    var due = function () { return S.active === 'work' && S.timer.mode === 'running' && now >= S.timer.endAt; };
    if (!due()) return null;
    reload(); ensureDay(now, true);                       // another tab may have handled it already
    if (!due()) return { rounds: 0, refreshed: true };
    var r = settle(now);
    save();
    return r;
  }

  /* ---------- outreach counter ---------- */
  function clicksOn(k) {
    var c = S.outreach.clicks, n = 0;
    for (var i = c.length - 1; i >= 0; i--) {
      var d = dayKey(c[i]);
      if (d === k) n++; else if (d < k) break;
    }
    return n;
  }
  /* A day's count = real clicks + the hand correction for that day (never below 0). */
  function outreachOn(k) { return Math.max(0, clicksOn(k) + (S.outreach.adj[k] || 0)); }
  function outreachToday(now) { return outreachOn(dayKey(now || Date.now())); }
  function outreachAdd(now) {
    now = now || Date.now();
    S.outreach.clicks.push(now); save();
    return outreachToday(now);
  }
  /* Removes the latest click if it was made today, else lowers a hand-added amount for today. */
  function outreachUndo(now) {
    now = now || Date.now();
    var k = dayKey(now), c = S.outreach.clicks;
    if (outreachOn(k) === 0) return false;
    if (c.length && dayKey(c[c.length - 1]) === k) c.pop();
    else if ((S.outreach.adj[k] || 0) > 0) { S.outreach.adj[k]--; if (!S.outreach.adj[k]) delete S.outreach.adj[k]; }
    else return false;
    save(); return true;
  }
  /* Sets a day's total by hand. Real click times stay; the difference is stored as a correction. */
  function setOutreachDay(k, n, now) {
    n = Math.round(+n);
    if (!(n >= 0) || n > 9999 || !/^\d{4}-\d{2}-\d{2}$/.test(k) || k > dayKey(now || Date.now())) return false;
    var d = n - clicksOn(k);
    if (d) S.outreach.adj[k] = d; else delete S.outreach.adj[k];
    save(); return true;
  }
  function setGoal(n) {
    n = Math.round(+n);
    if (!(n >= 1)) return false;
    S.outreach.goal = Math.min(n, 9999); save(); return true;
  }

  /* ---------- statistics ---------- */
  function todayTotals(now) {
    now = now || Date.now();
    var tk = dayKey(now), t0 = startOfDay(now), out = zero();
    var add = function (act, s, e) { dayParts(act, Math.max(s, t0), e, function (k, sec) { if (k === tk) out[act] += sec; }); };
    for (var i = S.segments.length - 1; i >= 0; i--) {
      var g = S.segments[i];
      if (g.end <= t0) break;
      add(g.act, g.start, g.end);
    }
    liveParts(now).forEach(function (g) { add(g.act, g.start, g.end); });
    return out;
  }
  function todayPoints(now) {
    var tk = dayKey(now || Date.now()), n = 0;
    for (var i = S.sessions.length - 1; i >= 0; i--) {
      var d = S.sessions[i].day;
      if (d === tk) n++; else if (d < tk) break;
    }
    return n;
  }

  /* The day as ordered blocks (clipped to the calendar day), for the dashboard timeline. */
  function timeline(k, now) {
    now = now || Date.now();
    var t0 = keyToDate(k).getTime(), t1 = keyToDate(addDays(k, 1)).getTime(), out = [];
    var put = function (g, live) {
      var s = Math.max(g.start, t0), e = Math.min(g.end, t1);
      if (e - s >= 1000) out.push({ act: g.act, start: s, end: e, orig: g.start, note: g.note || '', live: !!live });
    };
    S.segments.forEach(function (g) { put(g, false); });
    liveParts(now).forEach(function (g) { put(g, true); });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  function analyze(now) {
    now = now || Date.now();
    var todayK = dayKey(now), per = {}, segs = {};
    ACTS.forEach(function (a) { segs[a] = []; });
    var get = function (k) {
      return per[k] || (per[k] = { day: k, points: 0, outreach: 0, firstOpen: null, t: zero(), total: 0 });
    };
    Object.keys(S.days).forEach(function (k) { get(k).firstOpen = S.days[k].firstOpen; });
    S.sessions.forEach(function (s) { get(s.day).points++; });
    var ocHour = [];
    for (var hh = 0; hh < 24; hh++) ocHour.push(0);
    S.outreach.clicks.forEach(function (ms) { get(dayKey(ms)).outreach++; ocHour[new Date(ms).getHours()]++; });   // hour chart: real clicks only
    Object.keys(S.outreach.adj).forEach(function (k) { var d = get(k); d.outreach = Math.max(0, d.outreach + S.outreach.adj[k]); d.outreachEdited = true; });
    var addSeg = function (g, live) {
      var sec = 0;
      dayParts(g.act, g.start, g.end, function (k, s) { get(k).t[g.act] += s; sec += s; });
      if (sec >= 1) segs[g.act].push({ start: g.start, end: g.end, sec: sec, note: g.note || '', id: g.id, live: !!live });
    };
    S.segments.forEach(function (g) { addSeg(g, false); });
    liveParts(now).forEach(function (g) { addSeg(g, true); });
    ACTS.forEach(function (a) { segs[a].sort(function (x, y) { return y.start - x.start; }); });

    var days = Object.keys(per).map(function (k) { return per[k]; }).sort(function (a, b) { return a.day < b.day ? 1 : -1; });
    var tot = zero();
    days.forEach(function (d) { ACTS.forEach(function (a) { tot[a] += d.t[a]; d.total += d.t[a]; }); });
    var tracked = days.filter(function (d) { return d.firstOpen != null; }).length;
    var weekStart = addDays(todayK, -keyToDate(todayK).getDay());   // weeks start on Sunday
    var perAct = {};
    ACTS.forEach(function (a) {
      var done = segs[a].filter(function (x) { return !x.live; }), sum = 0, longest = 0;
      done.forEach(function (x) { sum += x.sec; if (x.sec > longest) longest = x.sec; });
      perAct[a] = { act: a, totalSec: tot[a], todaySec: per[todayK] ? per[todayK].t[a] : 0, weekSec: 0,
        avgDaySec: tracked ? tot[a] / tracked : 0, best: null,
        count: done.length, avgSessionSec: done.length ? sum / done.length : 0, longestSec: longest };
    });
    var ocWeek = 0, ocBest = null, goal = S.outreach.goal, met = 0;
    days.forEach(function (d) {
      ACTS.forEach(function (a) {
        if (d.day >= weekStart && d.day <= todayK) perAct[a].weekSec += d.t[a];
        var b = perAct[a].best;
        if (d.t[a] > 0 && (!b || d.t[a] > b.sec)) perAct[a].best = { day: d.day, sec: d.t[a] };
      });
      if (d.day >= weekStart && d.day <= todayK) ocWeek += d.outreach;
      if (d.outreach > 0 && (!ocBest || d.outreach > ocBest.count)) ocBest = { day: d.day, count: d.outreach };
      if (d.outreach >= goal) met++;
    });
    var ocTotal = 0;
    days.forEach(function (d) { ocTotal += d.outreach; });
    var outreach = {
      total: ocTotal, today: per[todayK] ? per[todayK].outreach : 0, week: ocWeek,
      avgPerDay: tracked ? ocTotal / tracked : 0, best: ocBest, goal: goal, goalMetDays: met, trackedDays: tracked, byHour: ocHour
    };

    var best = null;
    days.forEach(function (d) { if (d.points > 0 && (!best || d.points > best.points)) best = d; });
    var has = {};
    days.forEach(function (d) { if (d.points > 0) has[d.day] = true; });
    var cur = 0, k = has[todayK] ? todayK : addDays(todayK, -1);
    while (has[k]) { cur++; k = addDays(k, -1); }
    var longestStreak = 0, run = 0;
    if (days.length) {
      var first = days[days.length - 1].day, kk = first, guard = 0;
      while (kk <= todayK && guard++ < 20000) {
        if (has[kk]) { run++; if (run > longestStreak) longestStreak = run; } else run = 0;
        kk = addDays(kk, 1);
      }
    }
    var byHour = [];
    for (var h = 0; h < 24; h++) byHour.push({ hour: h, points: 0 });
    S.sessions.forEach(function (s) { byHour[new Date(s.start).getHours()].points++; });

    return {
      todayK: todayK, weekStart: weekStart, per: per, days: days, totals: tot, perAct: perAct, segs: segs, outreach: outreach,
      points: S.sessions.length, trackedDays: tracked, avgPerDay: tracked ? S.sessions.length / tracked : 0,
      best: best, streak: { current: cur, longest: longestStreak }, byHour: byHour
    };
  }

  /* ---------- backup ---------- */
  function exportAll(now) {
    var d = new Date(now || Date.now());
    var name = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' +
      pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds()) + '.json';
    return { name: name, json: JSON.stringify({ app: 'timer-score', exportedAt: d.toISOString(), data: S }, null, 2) };
  }
  function importText(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
    var d = o && o.app === 'timer-score' ? o.data : null;
    if (!d || !Array.isArray(d.sessions)) throw new Error('This does not look like a backup from this app.');
    S = normalize(migrate(d, Date.now()));
    boot(Date.now(), { keep: true });
    return S.sessions.length;
  }

  /* ---------- sound ---------- */
  var ac = null, alarmTimer = null, alarmBox = null, hintEl = null;
  function audio() {
    try {
      if (!ac) ac = new (root.AudioContext || root.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
    } catch (e) {}
    return ac;
  }
  function audioReady() { return !!ac && ac.state === 'running'; }
  function beep(freq, dur, vol) {
    var a = audio();
    if (!a || a.state !== 'running') return;
    var level = (S && S.settings.volume != null ? S.settings.volume : 0.5) * (vol / 0.5);
    if (level <= 0) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(Math.min(1, level), a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  }
  function alarmPattern() {
    beep(880, .18, .5);
    setTimeout(function () { beep(880, .18, .5); }, 250);
    setTimeout(function () { beep(880, .18, .5); }, 500);
    setTimeout(function () { beep(1175, .4, .5); }, 750);
  }
  function alarmStart() {
    alarmStop(); alarmPattern();
    alarmTimer = setInterval(alarmPattern, 1600);
    if (!alarmBox) {
      alarmBox = root.document.createElement('div');
      alarmBox.className = 'alarm'; alarmBox.hidden = true;
      alarmBox.innerHTML = '<span>⏰ Time’s up — point added!</span><button type="button">Stop alarm</button>';
      alarmBox.querySelector('button').addEventListener('click', alarmStop);
      root.document.body.appendChild(alarmBox);
    }
    alarmBox.hidden = false;
  }
  function alarmStop() {
    if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
    if (alarmBox) alarmBox.hidden = true;
  }
  function reminderBeep() {
    beep(784, .16, .4);
    setTimeout(function () { beep(784, .16, .4); }, 220);
  }
  function updateHint() {
    var need = !audioReady();
    if (need && !hintEl) {
      hintEl = root.document.createElement('div');
      hintEl.className = 'notice warn';
      hintEl.textContent = 'Click anywhere on the page once so the beeps and the alarm are allowed to play.';
      var w = root.document.querySelector('.wrap');
      if (w) w.insertBefore(hintEl, w.children[1] || null);
    }
    if (hintEl) hintEl.hidden = !need;
  }

  var lastFav = null;
  function setFavicon(act) {
    if (!root.document || lastFav === act || !META[act]) return;
    lastFav = act;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + META[act].icon + '</text></svg>';
    var d = root.document, old = d.querySelector('link[rel~="icon"]');
    var l = d.createElement('link');
    l.rel = 'icon'; l.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    if (old) old.remove();
    d.head.appendChild(l);
  }

  /* Only one open page plays sounds, so two tabs never double the beeps. */
  var ME = uid();
  function isLeader(now) {
    try {
      var o = JSON.parse(root.localStorage.getItem(LEADER_KEY) || 'null');
      if (!o || o.id === ME || now - o.ts > 3000) {
        if (!o || o.id !== ME || now - o.ts > 1000) root.localStorage.setItem(LEADER_KEY, JSON.stringify({ id: ME, ts: now }));
        return true;
      }
      return false;
    } catch (e) { return true; }
  }

  /* The loop every page runs: finishes rounds, plays reminder beeps, keeps the heartbeat. */
  function engine(onEvent) {
    var g = { key: null, iv: 0, k: 0 };
    var sync = function (now) {
      g.key = S.beepFrom; g.iv = S.settings.beepMinutes * 60000;
      g.k = Math.floor((now - S.beepFrom) / g.iv);
    };
    sync(Date.now());
    ['pointerdown', 'keydown'].forEach(function (ev) {
      root.document.addEventListener(ev, function () { audio(); }, { passive: true });
    });
    audio();
    root.addEventListener('pagehide', function () { heartbeat(Date.now(), true); });
    root.addEventListener('pageshow', function (e) {
      if (e.persisted) { boot(Date.now(), {}); sync(Date.now()); onEvent('refresh'); }
    });
    root.addEventListener('storage', function (e) {
      if (e.key === KEY) { reload(); sync(Date.now()); onEvent('refresh'); }
    });
    setInterval(function () {
      var now = Date.now(), r = tick(now), lead = isLeader(now);
      if (r && r.rounds) {
        if (lead) { if (r.auto) beep(1000, .22, .4); else alarmStart(); }
        onEvent('round');
      } else if (r && r.refreshed) onEvent('refresh');
      var iv = S.settings.beepMinutes * 60000;
      if (S.beepFrom !== g.key || iv !== g.iv) sync(now);
      else {
        var k = Math.floor((now - S.beepFrom) / iv);
        if (k > g.k) {
          g.k = k;
          if (lead && BEEP_ACTS.indexOf(S.active) >= 0 && S.settings.beep[S.active] !== false) reminderBeep();
        }
      }
      setFavicon(S.active); heartbeat(now); updateHint();
      onEvent('tick');
    }, 250);
    setFavicon(S.active); updateHint();
  }

  /* ---------- page helpers ---------- */
  function applyTheme() {
    var t = S && S.settings.theme;
    var el = root.document.documentElement;
    if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t); else el.removeAttribute('data-theme');
  }
  function initTheme(btn) {
    var label = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' };
    var paint = function () { applyTheme(); if (btn) btn.textContent = label[S.settings.theme] || label.auto; };
    paint();
    if (btn) btn.addEventListener('click', function () {
      var order = ['auto', 'light', 'dark'];
      S.settings.theme = order[(order.indexOf(S.settings.theme) + 1) % 3];
      save(); paint();
    });
  }
  function mountDataTools(el, onChange) {
    el.innerHTML =
      '<button type="button" class="ghost" data-a="exp">Export all data</button>' +
      '<button type="button" class="ghost" data-a="imp">Import backup</button>' +
      '<input type="file" accept="application/json,.json" hidden>';
    var file = el.querySelector('input');
    el.querySelector('[data-a=exp]').addEventListener('click', function () {
      heartbeat(Date.now(), true);
      var r = exportAll();
      var a = root.document.createElement('a');
      a.href = root.URL.createObjectURL(new root.Blob([r.json], { type: 'application/json' }));
      a.download = r.name;
      root.document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { root.URL.revokeObjectURL(a.href); }, 1500);
    });
    el.querySelector('[data-a=imp]').addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; if (!f) return;
      var fr = new root.FileReader();
      fr.onload = function () {
        try {
          if (!root.confirm('Importing replaces everything currently saved in this browser. Continue?')) return;
          var n = importText(String(fr.result));
          root.alert('Imported. ' + n + ' finished work rounds in the history.');
          if (onChange) onChange();
        } catch (e) { root.alert(e.message); }
        file.value = '';
      };
      fr.readAsText(f);
    });
  }

  /* Lets the browser offer to install the site as an app (installed apps may play sound without a click). */
  if (root.navigator && 'serviceWorker' in root.navigator && root.location && /^https?:$/.test(root.location.protocol)) {
    root.addEventListener('load', function () { root.navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  root.TSA = {
    timeline: timeline, ACTS: ACTS, BEEP_ACTS: BEEP_ACTS, NOTE_ACTS: NOTE_ACTS, META: META, WORK_SEC: WORK_SEC, pad: pad,
    dayKey: dayKey, addDays: addDays, keyToDate: keyToDate, fmtDur: fmtDur,
    boot: boot, get: function () { return S; }, reload: reload, save: save,
    storageOK: function () { return !memoryOnly; },
    switchTo: switchTo, setNote: setNote, setNoteAt: setNoteAt, noteTarget: noteTarget, allNotes: allNotes, heartbeat: heartbeat, tick: tick,
    outreachToday: outreachToday, outreachAdd: outreachAdd, outreachUndo: outreachUndo, setOutreachDay: setOutreachDay, setGoal: setGoal,
    todayTotals: todayTotals, todayPoints: todayPoints, analyze: analyze,
    exportAll: exportAll, importText: importText,
    audio: audio, audioReady: audioReady, beep: beep, alarmStart: alarmStart, alarmStop: alarmStop,
    setFavicon: setFavicon, engine: engine, initTheme: initTheme, mountDataTools: mountDataTools,
    KEY: KEY, CHRONO_KEY: CHRONO_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
