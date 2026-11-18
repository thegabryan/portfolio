/* Focus Timer — shared logic.
   Seven activities (work, paused, workflow, workout, eating, shower, sleep); exactly one is "active" at a time.
   Every stretch of an activity is stored as a segment; daily totals are computed from segments.
   The outreach counter is a list of click times. Everything is saved in this browser's localStorage. */
(function (root) {
  'use strict';

  var KEY = 'tsa2_data', OLD_KEY = 'tsa1_data', CHRONO_KEY = 'tsa2_chrono', LEADER_KEY = 'tsa2_leader';
  var RESUME_MS = 30000;    // a page that comes back within 30 s keeps the running timer
  var WORK_SEC = 3600;      // every work round is one hour
  var GOALS = { work: 'min', workout: 'min', paused: 'max' };   // daily goals: reach it (min) or stay under it (max)
  var ACTS = ['work', 'paused', 'workflow', 'workout', 'eating', 'shower', 'sleep'];
  var BEEP_ACTS = ['paused', 'workflow', 'workout', 'eating'];
  var NOTE_ACTS = ['work', 'workflow'];          // sessions that can carry a note
  var KEEPS_RUNNING = { sleep: true };           // counts by the clock even if the page is closed
  var META = {
    work:     { label: 'Work',     icon: '💼',             color: '--c-work'   },
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
        autoRestart: false, theme: 'auto', volume: 0.5, beepMinutes: 10, shortPauseSec: 20, goals: {}, autoBackup: true, idleNudgeMin: 30,
        beep: { paused: true, workflow: true, workout: true, eating: true }
      },
      timer: { mode: 'idle' },   // the work countdown: idle | running | paused
      active: 'paused',          // which activity is running right now
      activeSince: null,         // when it started
      beepFrom: null,            // reference time for the reminder beeps
      lastSeen: null,            // heartbeat of the last open page
      lastBackup: null,          // when the daily backup download last ran
      liveProject: '', lastProject: '',   // project tag of the running Work/Workflow run; the last one used
      segments: [],              // finished stretches: { act, start, end, [id, note] }
      sessions: [],              // finished work rounds (= points)
      outreach: { clicks: [], goal: 3, adj: {}, names: {}, notes: {}, todo: [], follow: [], seen: [], pics: {} },   // click times of the outreach counter + hand corrections per day
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
    var g0 = r.settings.goals, g1 = {};
    if (g0 && typeof g0 === 'object') Object.keys(GOALS).forEach(function (a) { if (g0[a] >= 1 && g0[a] <= 86399) g1[a] = Math.round(g0[a]); });
    r.settings.goals = g1;
    if (typeof r.settings.autoBackup !== 'boolean') r.settings.autoBackup = true;
    if (!(r.settings.idleNudgeMin >= 0 && r.settings.idleNudgeMin <= 600)) r.settings.idleNudgeMin = 30;
    if (!(r.lastBackup > 0)) r.lastBackup = null;
    ['segments', 'sessions'].forEach(function (k) { if (!Array.isArray(r[k])) r[k] = defaults()[k]; });
    if (!r.outreach || typeof r.outreach !== 'object') r.outreach = { clicks: [], goal: 3, adj: {}, names: {}, notes: {}, todo: [], follow: [], seen: [] };
    if (!Array.isArray(r.outreach.clicks)) r.outreach.clicks = [];
    if (!(r.outreach.goal >= 1)) r.outreach.goal = 3;
    if (!r.outreach.adj || typeof r.outreach.adj !== 'object' || Array.isArray(r.outreach.adj)) r.outreach.adj = {};   // hand-typed corrections per day
    if (typeof r.liveNote !== 'string') r.liveNote = '';
    if (typeof r.liveProject !== 'string') r.liveProject = '';
    if (typeof r.lastProject !== 'string') r.lastProject = '';
    if (!r.outreach.names || typeof r.outreach.names !== 'object' || Array.isArray(r.outreach.names)) r.outreach.names = {};   // who each outreach was to, by click time
    var oc = r.outreach;
    if (!oc.notes || typeof oc.notes !== 'object' || Array.isArray(oc.notes)) oc.notes = {};     // a note for each outreach, by click time
    if (!oc.pics || typeof oc.pics !== 'object' || Array.isArray(oc.pics)) oc.pics = {};          // channel profile picture links, by channel key
    ['todo', 'follow', 'seen'].forEach(function (k) { if (!Array.isArray(oc[k])) oc[k] = []; });   // 'To reach out' list, follow-up reminders, ids already applied from the userscript
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
      return [{ act: a, start: st, end: cut, note: S.liveNote || '', project: S.liveProject || '' }, { act: 'paused', start: cut, end: Math.max(now, cut) }];
    }
    return [{ act: a, start: st, end: Math.max(now, st), note: S.liveNote || '', project: S.liveProject || '' }];
  }

  function closeSeg(now) {
    var st = S.activeSince;
    if (st != null && now > st) {
      var seg = { act: S.active, start: st, end: now, id: uid() };
      if (S.liveNote) seg.note = S.liveNote;           // a note added while it was running
      if (S.liveProject && NOTE_ACTS.indexOf(S.active) >= 0) seg.project = S.liveProject;
      S.liveNote = ''; S.liveProject = '';
      S.segments.push(seg);
      return seg;
    }
    S.liveNote = ''; S.liveProject = '';
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
        S.liveNote = [last.note, S.liveNote].filter(Boolean).join(' / ').slice(0, 1000);
        S.liveProject = S.liveProject || last.project || '';
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
    s.note = String(note || '').replace(/\r\n?/g, '\n').trim().slice(0, 1000);
    save(); return true;
  }
  /* The note box: one line at first. Enter saves; Shift+Enter adds a new line (the box then grows to
     several lines, and Enter still saves). `save` is the form's Save button.
     Every line you start writing gets the time you started it as a prefix ("16:12 · text", 24 h).
     Lines that were already in the note when the box opened are left alone. */
  var STAMP = /^\d{2}:\d{2} · /;
  var stampNow = function () { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' · '; };
  function noteBox(ta, save) {
    var freshLine = 0;                 // first line number still waiting for its time (-1 = none)
    var setMulti = function (on) { ta.classList.toggle('multi', on); ta.rows = on ? 5 : 1; };
    /* Keeps what you are writing in view: the box grows with the lines (up to 12), then scrolls to the caret. */
    var follow = function () {
      if (!ta.classList.contains('multi')) return;
      if (!ta.style.height) ta.rows = Math.max(5, Math.min(12, ta.value.split('\n').length + 1));
      if (ta.selectionStart >= ta.value.length - 1) ta.scrollTop = ta.scrollHeight;
      else {                                       // caret in the middle: scroll just enough to show its line
        var lh = parseFloat(getComputedStyle(ta).lineHeight) || 20, y = (ta.value.slice(0, ta.selectionStart).split('\n').length - 1) * lh;
        if (y < ta.scrollTop) ta.scrollTop = y; else if (y + lh > ta.scrollTop + ta.clientHeight) ta.scrollTop = y + lh - ta.clientHeight + 8;
      }
    };
    var lineNo = function (pos) { return ta.value.slice(0, pos).split('\n').length - 1; };
    ta.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (e.shiftKey) {
        setMulti(true);
        ta.setRangeText('\n', ta.selectionStart, ta.selectionEnd, 'end');
        freshLine = lineNo(ta.selectionStart);
        follow();
      } else save.click();
    });
    ta.addEventListener('input', function (e) {
      if (freshLine < 0 || e.isComposing) { follow(); return; }
      var lines = ta.value.split('\n'), caret = ta.selectionStart, changed = false, start = 0;
      for (var n = 0; n < lines.length; n++) {
        if (n >= freshLine && lines[n].trim() && !STAMP.test(lines[n])) {
          var st = stampNow();
          lines[n] = st + lines[n].replace(/^\s+/, '');
          if (caret >= start) caret += st.length;
          changed = true;
        }
        start += lines[n].length + 1;
      }
      if (changed) { ta.value = lines.join('\n'); ta.setSelectionRange(caret, caret); freshLine = -1; }
      follow();
    });
    return function (text) { ta.value = text || ''; setMulti(/\n/.test(ta.value)); freshLine = ta.value ? -1 : 0; };
  }

  /* ----- notes on any timer's run ----- */
  var NOTE_MAX = 1000;
  var cleanNote = function (t) { return String(t || '').replace(/\r\n?/g, '\n').split('\n').filter(function (l) { return !/^\d{2}:\d{2} ·\s*$/.test(l); }).join('\n').trim().slice(0, NOTE_MAX); };
  /* The run a note button of `act` points at: the running one, else that timer's most recent run. */
  function noteTarget(act) {
    if (S.active === act && S.activeSince != null) return { act: act, start: S.activeSince, end: null, live: true, note: S.liveNote || '', project: S.liveProject || '' };
    for (var i = S.segments.length - 1, best = null; i >= 0; i--) {
      var g = S.segments[i];
      if (g && g.act === act && (!best || g.start > best.start)) best = g;
    }
    return best ? { act: act, start: best.start, end: best.end, live: false, note: best.note || '', project: best.project || '' } : null;
  }
  /* Sets (or, with empty text, removes) the note of the run of `act` that started at `start`. */
  var cleanProject = function (t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 60); };
  /* `project` is optional (undefined = leave it alone); only Work and Workflow runs take one. */
  function setNoteAt(act, start, text, project) {
    var n = cleanNote(text), p = project === undefined ? undefined : cleanProject(project);
    if (NOTE_ACTS.indexOf(act) < 0) p = undefined;
    if (p) S.lastProject = p;
    if (S.active === act && S.activeSince === start) { S.liveNote = n; if (p !== undefined) S.liveProject = p; save(); return true; }
    var g = S.segments.find(function (x) { return x.act === act && x.start === start; });
    if (!g) return false;
    if (!g.id) g.id = uid();
    if (n) g.note = n; else delete g.note;
    if (p !== undefined) { if (p) g.project = p; else delete g.project; }
    save(); return true;
  }
  /* Recent projects, most recently used first. */
  function projectList() {
    var seen = {}, out = [], add = function (p) { if (p && !seen[p]) { seen[p] = 1; out.push(p); } };
    add(S.liveProject);
    for (var i = S.segments.length - 1; i >= 0 && out.length < 40; i--) add(S.segments[i].project);
    return out;
  }
  /* Renames (or merges into an existing one) a project on every run. Returns how many runs changed. */
  function renameProject(from, to) {
    to = cleanProject(to); if (!from || !to || from === to) return 0;
    var n = 0;
    S.segments.forEach(function (g) { if (g.project === from) { g.project = to; n++; } });
    if (S.liveProject === from) { S.liveProject = to; n++; }
    if (S.lastProject === from) S.lastProject = to;
    save(); return n;
  }
  /* Work + Workflow seconds per project since day key `sinceKey` (null = all time). */
  function projectTime(sinceKey, now) {
    var by = {}, add = function (g) {
      if (NOTE_ACTS.indexOf(g.act) < 0) return;
      var p = g.project || '';
      dayParts(g.act, g.start, g.end, function (k, sec) {
        if (sinceKey && k < sinceKey) return;
        var o = by[p] || (by[p] = { project: p, sec: 0, work: 0, workflow: 0 });
        o.sec += sec; o[g.act] += sec;
      });
    };
    S.segments.forEach(add); liveParts(now || Date.now()).forEach(add);
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.sec - a.sec; });
  }
  /* Seconds of `act` per hour of day (24 numbers) between two times. */
  function actByHour(act, from, to, now) {
    var out = [], h;
    for (h = 0; h < 24; h++) out.push(0);
    var add = function (g) {
      if (g.act !== act) return;
      var s = Math.max(g.start, from), e = Math.min(g.end, to);
      while (s < e) {
        var d = new Date(s), nx = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime(), t = Math.min(e, nx);
        out[d.getHours()] += (t - s) / 1000; s = t;
      }
    };
    S.segments.forEach(add); liveParts(now || Date.now()).forEach(add);
    return out;
  }
  /* Every note, newest first. */
  function allNotes(now) {
    var out = S.segments.filter(function (g) { return g && g.note; })
      .map(function (g) { return { act: g.act, start: g.start, end: g.end, note: g.note, project: g.project || '', live: false }; });
    if (S.liveNote && S.activeSince != null) out.push({ act: S.active, start: S.activeSince, end: Math.max(now || Date.now(), S.activeSince), note: S.liveNote, project: S.liveProject || '', live: true });
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
  /* Adds one outreach at `now` (or any past time, kept in order). name / note are optional. Returns the click time. */
  function outreachAdd(now, name, note) {
    var c = S.outreach.clicks;
    now = now || Date.now();
    while (c.indexOf(now) >= 0) now++;                    // click times are the ids, so they stay unique
    var i = c.length; while (i > 0 && c[i - 1] > now) i--;
    c.splice(i, 0, now);
    save();
    if (name) setOutreachName(now, name);
    if (note) setOutreachNote(now, note);
    return now;
  }
  /* Removes the latest click if it was made today, else lowers a hand-added amount for today. */
  function outreachUndo(now) {
    now = now || Date.now();
    var k = dayKey(now), c = S.outreach.clicks;
    if (outreachOn(k) === 0) return false;
    if (c.length && dayKey(c[c.length - 1]) === k) { var ms = c.pop(); delete S.outreach.names[ms]; delete S.outreach.notes[ms]; }
    else if ((S.outreach.adj[k] || 0) > 0) { S.outreach.adj[k]--; if (!S.outreach.adj[k]) delete S.outreach.adj[k]; }
    else return false;
    save(); return true;
  }
  /* Who an outreach was to (empty text removes the name). `ms` is the click's time. */
  /* Removes one specific counted click (and its name/note) from the score. */
  function outreachRemoveClick(ms) {
    ms = +ms; var i = S.outreach.clicks.indexOf(ms);
    if (i < 0) return false;
    S.outreach.clicks.splice(i, 1); delete S.outreach.names[ms]; delete S.outreach.notes[ms];
    save(); return true;
  }
  function setOutreachName(ms, text) {
    ms = +ms;
    if (S.outreach.clicks.indexOf(ms) < 0) return false;
    var n = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (n) S.outreach.names[ms] = n; else delete S.outreach.names[ms];
    save(); return true;
  }
  /* A note for an outreach (empty text removes it). */
  function setOutreachNote(ms, text) {
    ms = +ms;
    if (S.outreach.clicks.indexOf(ms) < 0) return false;
    var n = String(text || '').replace(/\r\n?/g, '\n').trim().slice(0, NOTE_MAX);
    if (n) S.outreach.notes[ms] = n; else delete S.outreach.notes[ms];
    save(); return true;
  }
  /* Every counted click, newest first, with its name and note. */
  function outreachLog() {
    var nm = S.outreach.names, nt = S.outreach.notes;
    return S.outreach.clicks.map(function (ms) { return { ms: ms, name: nm[ms] || '', note: nt[ms] || '' }; }).sort(function (a, b) { return b.ms - a.ms; });
  }

  /* ---------- 'To reach out' list and follow-up reminders ---------- */
  var FOLLOW_DAYS = 2, FOLLOW_MAX = 3;
  var leadKey = function (name, url) { return String(url || name || '').toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '').trim(); };
  var dayStartOf = function (k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); };
  var due2 = function (from) { return dayStartOf(addDays(dayKey(from), FOLLOW_DAYS)); };      // two calendar days later, from midnight
  var cleanNote = function (t) { return String(t || '').replace(/\r\n?/g, '\n').trim().slice(0, NOTE_MAX); };
  function todoList() { return S.outreach.todo.slice(); }
  function addTodo(name, url, now, note) {
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120); url = String(url || '').trim().slice(0, 300);
    if (!name && !url) return false;
    var key = leadKey(name, url);
    if (S.outreach.todo.some(function (t) { return leadKey(t.name, t.url) === key; })) return false;
    S.outreach.todo.push({ id: uid(), name: name, url: url, note: cleanNote(note), added: now || Date.now() });
    save(); return true;
  }
  function removeTodo(id) {
    var n = S.outreach.todo.length;
    S.outreach.todo = S.outreach.todo.filter(function (t) { return t.id !== id; });
    if (S.outreach.todo.length !== n) { save(); return true; } return false;
  }
  /* Counts one outreach (+1, logged with the name/link) and starts the follow-up reminders for it. */
  function markReached(name, url, now, opts) {
    now = now || Date.now();
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 120); url = String(url || '').trim().slice(0, 300);
    var key = leadKey(name, url);
    var old = S.outreach.todo.filter(function (t) { return leadKey(t.name, t.url) === key; })[0];
    S.outreach.todo = S.outreach.todo.filter(function (t) { return leadKey(t.name, t.url) !== key; });
    var note = cleanNote((opts && opts.note) || (old && old.note));          // a note written in "To reach out" moves along
    var ms = outreachAdd(now, [name, url].filter(Boolean).join(' ').slice(0, 200), note);
    if (!(opts && opts.noFollow)) startFollow(name, url, now, { note: note, ms: ms });
    return ms;
  }
  function startFollow(name, url, now, extra) {
    now = now || Date.now();
    var key = leadKey(name, url);
    if (!key || S.outreach.follow.some(function (f) { return f.status === 'active' && leadKey(f.name, f.url) === key; })) return false;
    S.outreach.follow.push({ id: uid(), name: name || '', url: url || '', note: cleanNote(extra && extra.note), ms: (extra && +extra.ms) || 0, started: now, count: 0, due: due2(now), status: 'active', log: [] });
    save(); return true;
  }
  function followList() { return S.outreach.follow.slice(); }
  function followDue(now) { now = now || Date.now(); return S.outreach.follow.filter(function (f) { return f.status === 'active' && f.due <= now; }).sort(function (a, b) { return a.due - b.due; }); }
  /* 'Followed up': counts it, schedules the next one two days later; the third one finishes the reminders. */
  function followDone(id, now) {
    now = now || Date.now();
    var f = S.outreach.follow.filter(function (x) { return x.id === id && x.status === 'active'; })[0];
    if (!f) return false;
    f.count++; f.log.push(now);
    if (f.count >= FOLLOW_MAX) f.status = 'done'; else f.due = due2(now);
    save(); return true;
  }
  function followStop(id, status) {
    var f = S.outreach.follow.filter(function (x) { return x.id === id && x.status === 'active'; })[0];
    if (!f) return false;
    f.status = status === 'replied' ? 'replied' : 'stopped'; save(); return true;
  }
  /* Editing. A "To reach out" entry: name, link, note. */
  function editTodo(id, f) {
    var t = S.outreach.todo.filter(function (x) { return x.id === id; })[0]; if (!t) return false;
    var name = String(f.name || '').replace(/\s+/g, ' ').trim().slice(0, 120), url = String(f.url || '').trim().slice(0, 300);
    if (!name && !url) return false;
    t.name = name; t.url = url; t.note = cleanNote(f.note); save(); return true;
  }
  /* A follow-up entry: name, link, note, outreach date, follow-ups done (0-3) and status. The linked +1 in the log follows name and note. */
  function editFollow(id, f) {
    var x = S.outreach.follow.filter(function (y) { return y.id === id; })[0]; if (!x) return false;
    var name = String(f.name || '').replace(/\s+/g, ' ').trim().slice(0, 120), url = String(f.url || '').trim().slice(0, 300);
    if (!name && !url) return false;
    x.name = name; x.url = url; x.note = cleanNote(f.note);
    if (+f.started > 0) x.started = +f.started;
    var n = Math.max(0, Math.min(FOLLOW_MAX, Math.round(+f.count)));
    if (n === n) { while (x.log.length > n) x.log.pop(); while (x.log.length < n) x.log.push(x.started); x.count = n; }
    var st = ['active', 'replied', 'stopped', 'done'].indexOf(f.status) >= 0 ? f.status : x.status;
    if (st === 'active' && x.count >= FOLLOW_MAX) st = 'done';
    if (st === 'done' && x.count < FOLLOW_MAX) st = 'active';
    x.status = st;
    if (st === 'active') x.due = due2(x.log.length ? x.log[x.log.length - 1] : x.started);
    if (x.ms && S.outreach.clicks.indexOf(x.ms) >= 0) {
      S.outreach.names[x.ms] = [name, url].filter(Boolean).join(' ').slice(0, 200);
      if (x.note) S.outreach.notes[x.ms] = x.note; else delete S.outreach.notes[x.ms];
    }
    save(); return true;
  }
  /* Deletes a follow-up entry; optionally also takes its +1 out of the outreach score. */
  function removeFollow(id, alsoScore) {
    var x = S.outreach.follow.filter(function (y) { return y.id === id; })[0]; if (!x) return false;
    S.outreach.follow = S.outreach.follow.filter(function (y) { return y.id !== id; });
    if (alsoScore && x.ms) outreachRemoveClick(x.ms);
    save(); return true;
  }
  /* A request from the YouTube userscript: { id, kind: 'todo' | 'done', name, url, ts }. Applied once per id. */
  /* Channel profile pictures: only the image link is saved. A channel is found by its @handle / channel id / name. */
  var PIC_HOST = /^https:\/\/[a-z0-9.-]*(googleusercontent\.com|ggpht\.com|ytimg\.com)\//i;
  function picKeys(name, url) {
    var keys = [], m = /youtube\.com\/(@[^\s\/?#"')]+|channel\/[^\s\/?#"')]+|c\/[^\s\/?#"')]+|user\/[^\s\/?#"')]+)/i.exec(String(url || ''));
    if (m) { var k = m[1]; try { k = decodeURIComponent(k); } catch (e) {} keys.push(k.toLowerCase()); }
    var n = String(name || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (n) keys.push('n:' + n);
    return keys;
  }
  function picFor(item) {
    var p = S.outreach.pics || {}, ks = picKeys(item && item.name, item && item.url);
    for (var i = 0; i < ks.length; i++) if (p[ks[i]]) return p[ks[i]];
    return '';
  }
  /* map = { key: imageUrl }. Only channels that are in the To-reach-out list or in follow-ups keep a picture. */
  function setPics(map) {
    if (!map || typeof map !== 'object') return false;
    var want = {};
    S.outreach.todo.concat(S.outreach.follow).forEach(function (it) { picKeys(it.name, it.url).forEach(function (k) { want[k] = 1; }); });
    var changed = false;
    Object.keys(map).forEach(function (k) {
      var u = String(map[k] || '');
      if (!want[k] || !PIC_HOST.test(u) || u.length > 400 || S.outreach.pics[k] === u) return;
      S.outreach.pics[k] = u; changed = true;
    });
    if (changed) save();
    return changed;
  }
  function leadFromScript(m) {
    if (!m || !m.id) return false;
    var seen = S.outreach.seen;
    if (seen.indexOf(m.id) >= 0) return true;
    var ts = +m.ts > 0 && +m.ts <= Date.now() + 60000 ? +m.ts : Date.now();
    if (m.kind === 'done') markReached(m.name, m.url, ts, { note: 'From the YouTube channel page' });
    else if (m.kind === 'todo') addTodo(m.name, m.url, ts);
    else return false;
    if (m.pic) { var pm = {}; picKeys(m.name, m.url).forEach(function (k) { pm[k] = m.pic; }); setPics(pm); }
    seen.push(m.id); S.outreach.seen = seen.slice(-300); save(); return true;
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
      if (e - s >= 1000) out.push({ act: g.act, start: s, end: e, orig: g.start, note: g.note || '', project: g.project || '', live: !!live });
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
      if (sec >= 1) segs[g.act].push({ start: g.start, end: g.end, sec: sec, note: g.note || '', project: g.project || '', id: g.id, live: !!live });
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

    var goals = {};
    Object.keys(GOALS).forEach(function (a) {
      var tgt = S.settings.goals[a]; if (!tgt) return;
      var kind = GOALS[a], ok = function (d) { return kind === 'min' ? d.t[a] >= tgt : d.t[a] <= tgt; };
      var met = 0, tr = 0, streak = 0, i, k, d;
      for (i = 0; i < 30; i++) { k = addDays(todayK, -i); d = per[k]; if (d && d.firstOpen != null) { tr++; if (ok(d)) met++; } }
      for (i = 0; i < 3650; i++) {
        k = addDays(todayK, -i); d = per[k];
        if (!d || d.firstOpen == null) { if (i === 0) continue; break; }
        if (ok(d)) streak++; else if (i === 0 && kind === 'min') continue; else break;
      }
      goals[a] = { act: a, kind: kind, target: tgt, todaySec: per[todayK] ? per[todayK].t[a] : 0, metDays: met, trackedDays: tr, streak: streak };
    });
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
      todayK: todayK, weekStart: weekStart, per: per, days: days, totals: tot, perAct: perAct, segs: segs, outreach: outreach, goals: goals,
      points: S.sessions.length, trackedDays: tracked, avgPerDay: tracked ? S.sessions.length / tracked : 0,
      best: best, streak: { current: cur, longest: longestStreak }, byHour: byHour
    };
  }

  /* ---------- backup ---------- */
  /* Alarms live under their own key (see alarms.js) but travel in the backup file. */
  var ALARMS_KEY = 'tsa2_alarms';
  function readAlarmsRaw() { try { var a = JSON.parse(root.localStorage.getItem(ALARMS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  var CAPSULE_KEY = 'tsa2_capsule';     // the capsule script's linked sites, copied here by the userscript
  function readCapsuleRaw() { try { var c = JSON.parse(root.localStorage.getItem(CAPSULE_KEY) || 'null'); return c && typeof c === 'object' ? c : null; } catch (e) { return null; } }
  function exportAll(now) {
    var d = new Date(now || Date.now());
    var name = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' +
      pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds()) + '.json';
    return { name: name, json: JSON.stringify({ app: 'timer-score', exportedAt: d.toISOString(), data: S, alarms: readAlarmsRaw(), capsule: readCapsuleRaw() }, null, 2) };
  }
  function importText(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { throw new Error('That file is not valid JSON.'); }
    var d = o && o.app === 'timer-score' ? o.data : null;
    if (!d || !Array.isArray(d.sessions)) throw new Error('This does not look like a backup from this app.');
    S = normalize(migrate(d, Date.now()));
    if (o.capsule && typeof o.capsule === 'object') { try { o.capsule.at = Date.now(); root.localStorage.setItem(CAPSULE_KEY, JSON.stringify(o.capsule)); } catch (e) {} }   // the newer copy wins: the userscript takes it back
    if (Array.isArray(o.alarms)) { try { root.localStorage.setItem(ALARMS_KEY, JSON.stringify(o.alarms)); } catch (e) {} }
    boot(Date.now(), { keep: true });
    return S.sessions.length;
  }

  /* ---------- daily goals ---------- */
  function setGoalSec(act, sec) {
    sec = Math.round(+sec);
    if (!GOALS[act] || !(sec >= 0) || sec > 86399) return false;
    if (sec) S.settings.goals[act] = sec; else delete S.settings.goals[act];
    save(); return true;
  }

  /* ---------- files: download, CSV, daily backup ---------- */
  function download(name, text, type) {
    var a = root.document.createElement('a');
    a.href = root.URL.createObjectURL(new root.Blob([text], { type: type || 'application/json' }));
    a.download = name;
    root.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { root.URL.revokeObjectURL(a.href); }, 1500);
  }
  var csvCell = function (v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var csvText = function (rows) { return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; };
  var stamp = function (d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '-' + pad(d.getSeconds());
  };
  var dt = function (ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
  /* kind: sessions | days | outreach | notes. Comma separated, durations in seconds. */
  function csvExport(kind, now) {
    now = now || Date.now();
    var A = analyze(now), rows;
    if (kind === 'sessions') {
      var all = [];
      ACTS.forEach(function (a) { A.segs[a].forEach(function (g) { all.push({ act: a, g: g }); }); });
      all.sort(function (x, y) { return x.g.start - y.g.start; });
      rows = [['day', 'start', 'end', 'timer', 'seconds', 'project', 'note']].concat(all.map(function (o) {
        return [dayKey(o.g.start), dt(o.g.start), dt(o.g.end), META[o.act].label, o.g.sec, o.g.project, o.g.note];
      }));
    } else if (kind === 'days') {
      rows = [['day', 'points', 'outreach', 'first_open'].concat(ACTS.map(function (a) { return META[a].label.toLowerCase() + '_seconds'; }))]
        .concat(A.days.slice().reverse().map(function (d) {
          return [d.day, d.points, d.outreach, d.firstOpen ? dt(d.firstOpen) : ''].concat(ACTS.map(function (a) { return Math.round(d.t[a]); }));
        }));
    } else if (kind === 'outreachlog') {
      rows = [['day', 'time', 'name', 'note']].concat(outreachLog().reverse().map(function (o) { return [dayKey(o.ms), dt(o.ms), o.name, o.note]; }));
    } else if (kind === 'outreach') {
      var goal = S.outreach.goal;
      rows = [['day', 'outreach', 'goal', 'goal_met', 'edited_by_hand']].concat(A.days.slice().reverse().map(function (d) {
        return [d.day, d.outreach, goal, d.outreach >= goal ? 'yes' : 'no', d.outreachEdited ? 'yes' : 'no'];
      }));
    } else {
      rows = [['day', 'start', 'end', 'timer', 'seconds', 'project', 'note']].concat(allNotes(now).reverse().map(function (n) {
        return [dayKey(n.start), dt(n.start), dt(n.end), META[n.act].label, Math.round((n.end - n.start) / 1000), n.project, n.note];
      }));
    }
    return { name: stamp(new Date(now)) + '_' + kind + '.csv', text: csvText(rows) };
  }
  /* Once a day, on the first open, downloads a backup file by itself (if switched on). */
  function maybeAutoBackup(now) {
    now = now || Date.now();
    reload();
    if (!S.settings.autoBackup || (S.lastBackup && dayKey(S.lastBackup) === dayKey(now))) return false;
    if (!S.segments.length && !S.sessions.length) return false;
    var r = exportAll(now);
    S.lastBackup = now; save();
    try { download(r.name, r.json, 'application/json'); } catch (e) { return false; }
    return true;
  }
  function setAutoBackup(on) { S.settings.autoBackup = !!on; save(); }

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
  /* The ringing alarm is also shown on screen: favicon blinks between the timer icon and a bell, the tab title blinks
     '⏰ ALARM', and a heartbeat in localStorage ('tsa2_ring') lets the capsule userscript on other sites turn red. */
  var RING_KEY = 'tsa2_ring', ringText = '';
  function writeRing() { try { root.localStorage.setItem(RING_KEY, JSON.stringify({ text: ringText, at: Date.now() })); } catch (e) {} }
  function clearRing() { try { root.localStorage.removeItem(RING_KEY); } catch (e) {} }
  function alarmStart(text) {
    alarmStop(); alarmPattern();
    ringText = text || '⏰ Time’s up — point added!'; writeRing(); startFlash(0);
    alarmTimer = setInterval(function () { alarmPattern(); writeRing(); }, 1600);
    if (!alarmBox) {
      alarmBox = root.document.createElement('div');
      alarmBox.className = 'alarm'; alarmBox.hidden = true;
      alarmBox.innerHTML = '<span>⏰ Time’s up — point added!</span><button type="button">Stop alarm</button>';
      alarmBox.querySelector('button').addEventListener('click', alarmStop);
      root.document.body.appendChild(alarmBox);
    }
    alarmBox.querySelector('span').textContent = text || '⏰ Time’s up — point added!';
    alarmBox.hidden = false;
  }
  function alarmStop() {
    if (alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; clearRing(); stopFlash(); }
    if (alarmBox) alarmBox.hidden = true;
  }
  /* Blinking favicon + title. ms = 0 keeps going until stopFlash (alarms); a number stops by itself (short beeps). */
  var flashTimer = null, flashEnd = null, flashPhase = 0, baseTitle = '', baseAct = 'paused';
  function startFlash(ms) {
    if (!root.document) return;
    if (flashQuick) { clearInterval(flashTimer); flashTimer = null; flashQuick = false; flashPhase = 0; putIcon(META[baseAct].icon); root.document.title = baseTitle; }   // an alarm takes over from a quick blink
    if (!flashTimer) {
      baseTitle = root.document.title;
      flashTimer = setInterval(function () {
        flashPhase ^= 1;
        putIcon(flashPhase ? '🔔' : META[baseAct].icon);
        root.document.title = flashPhase ? (alarmTimer ? '⏰ ALARM' : '🔔 ' + baseTitle) : baseTitle;
      }, 500);
    }
    if (flashEnd) { clearTimeout(flashEnd); flashEnd = null; }
    if (ms && !alarmTimer) flashEnd = setTimeout(stopFlash, ms);   // a ringing alarm never times out
  }
  /* Beeps (10-minute beep, idle nudge, auto-restart): just two quick blinks, 200 ms apart. */
  var flashQuick = false;
  function quickBlink() {
    if (!root.document || alarmTimer || flashTimer) return;
    baseTitle = root.document.title; flashQuick = true;
    var steps = [1, 0, 1, 0], i = 0;
    flashTimer = setInterval(function () {
      if (i >= steps.length) { stopFlash(); return; }
      flashPhase = steps[i++];
      putIcon(flashPhase ? '🔔' : META[baseAct].icon);
      root.document.title = flashPhase ? '🔔 ' + baseTitle : baseTitle;
    }, 200);
  }
  function stopFlash() {
    if (flashEnd) { clearTimeout(flashEnd); flashEnd = null; }
    if (!flashTimer) return;
    clearInterval(flashTimer); flashTimer = null; flashPhase = 0; flashQuick = false;
    root.document.title = baseTitle; putIcon(META[baseAct].icon);
  }
  /* Called by the page whenever it sets the tab title, so the blink never fights with the clock in it. */
  function setTitle(t) { baseTitle = t; if (!flashTimer || !flashPhase) root.document.title = t; }
  /* A short two-tone beep for the idle nudge. */
  function nudgeBeep() {
    if (!audioReady()) return;
    quickBlink();
    beep(660, 0.14, 0.4); setTimeout(function () { beep(880, 0.18, 0.4); }, 190);
  }
  function reminderBeep() {
    quickBlink();
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
    if (!root.document || !META[act]) return;
    baseAct = act;
    if (flashTimer && flashPhase) return;      // the bell is showing; the blink puts the right icon back
    putIcon(META[act].icon);
  }
  function putIcon(emoji) {
    if (!root.document || lastFav === emoji) return;
    lastFav = emoji;
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>" + emoji + '</text></svg>';
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
        if (lead) { if (r.auto) { beep(1000, .22, .4); quickBlink(); } else alarmStart(); }
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
    var label = { auto: 'Theme: auto', light: 'Theme: light', dark: 'Theme: dark' }, sym = { auto: '🌓', light: '☀️', dark: '🌙' };
    var paint = function () { applyTheme(); if (btn) { var t = S.settings.theme in label ? S.settings.theme : 'auto'; btn.textContent = sym[t]; btn.title = label[t] + ' (click to change)'; btn.setAttribute('aria-label', label[t]); } };
    paint();
    if (btn) btn.addEventListener('click', function () {
      var order = ['auto', 'light', 'dark'];
      S.settings.theme = order[(order.indexOf(S.settings.theme) + 1) % 3];
      save(); paint();
    });
  }
  function mountCsvTools(el) {
    el.innerHTML = [['sessions', 'Sessions'], ['days', 'Daily totals'], ['outreach', 'Outreach per day'], ['outreachlog', 'Outreach log'], ['notes', 'Notes']].map(function (k) {
      return '<button type="button" class="ghost" data-csv="' + k[0] + '">CSV · ' + k[1] + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-csv]'); if (!b) return;
      heartbeat(Date.now(), true);
      var r = csvExport(b.dataset.csv);
      download(r.name, r.text, 'text/csv;charset=utf-8');
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
      download(r.name, r.json, 'application/json');
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


  /* ---------- daily summary for the Url Notes site ---------- */
  var fmtClock = function (ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var slug = function (t) { return String(t || '').toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').replace(/^-+|-+$/g, ''); };
  function dailySummary(now) {
    now = now || Date.now();
    var k = dayKey(now), d = new Date(now), tot = todayTotals(now), L = [];
    L.push('📊 Daily summary — ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + k, '');
    ACTS.forEach(function (a) {
      var g = S.settings.goals && S.settings.goals[a], line = META[a].icon + ' ' + META[a].label + ': ' + fmtDur(tot[a]);
      if (g) line += ' (' + (GOALS[a] === 'max' ? 'max ' : 'goal ') + fmtDur(g) + ')';
      L.push(line);
    });
    L.push('', '⏰ Work rounds (points): ' + todayPoints(now));
    L.push('🤝 Outreach: ' + outreachToday(now) + ' / ' + S.outreach.goal);
    var ns = allNotes(now).filter(function (n) { return dayKey(n.start) === k; }).sort(function (a, b) { return a.start - b.start; });
    if (ns.length) {
      L.push('', 'Notes:');
      ns.forEach(function (n) {
        L.push('• ' + fmtClock(n.start) + '–' + fmtClock(n.end || now) + ' ' + META[n.act].label + (n.project ? ' [' + n.project + ']' : '') + ': ' + n.note.replace(/\n+/g, ' '));
      });
    }
    L.push('', '#summary #' + k);
    return L.join('\n');
  }
  /* Asks the "Make Highlights & Notes" userscript (on this page) to queue the text for Url Notes.
     cb(true) when the userscript confirmed, cb(false) when nothing answered. */
  function sendSummary(now, cb) {
    var text = dailySummary(now), id = 'tm-summary-' + dayKey(now || Date.now()) + '-' + uid(), done = false;
    var onMsg = function (e) {
      var m = e.data;
      if (e.source !== root || !m || m.channel !== 'timer-bridge' || m.from !== 'userscript' || m.type !== 'queued' || m.id !== id) return;
      done = true; root.removeEventListener('message', onMsg); cb(true, text);
    };
    root.addEventListener('message', onMsg);
    root.postMessage({ channel: 'timer-bridge', from: 'page', type: 'summary', id: id, text: text, created: Date.now() }, root.location.origin);
    setTimeout(function () { if (!done) { root.removeEventListener('message', onMsg); cb(false, text); } }, 1200);
  }

  /* Lets the browser offer to install the site as an app (installed apps may play sound without a click). */
  if (root.navigator && 'serviceWorker' in root.navigator && root.location && /^https?:$/.test(root.location.protocol)) {
    root.addEventListener('load', function () { root.navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  /* Esc never throws away typing (vim habit): in a text field inside a popup it does nothing, and a popup that
     holds text in a text field refuses to close on Esc. Close it with its Save / Cancel / Close button instead. */
  if (root.document) {
    var isText = function (el) { return el && el.matches && el.matches('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=date]):not([type=time]):not([type=number])'); };
    root.document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var el = root.document.activeElement;
      if (isText(el) && el.closest('dialog, #whoBox')) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    root.document.addEventListener('cancel', function (e) {      // the popup's own Esc handling
      var d = e.target;
      if (d && d.querySelectorAll && [].some.call(d.querySelectorAll('textarea, input'), function (el) { return isText(el) && el.value.trim(); })) e.preventDefault();
    }, true);
  }
  root.TSA = {
    noteBox: noteBox, timeline: timeline, ACTS: ACTS, BEEP_ACTS: BEEP_ACTS, NOTE_ACTS: NOTE_ACTS, META: META, WORK_SEC: WORK_SEC, pad: pad,
    dayKey: dayKey, addDays: addDays, keyToDate: keyToDate, fmtDur: fmtDur,
    boot: boot, get: function () { return S; }, reload: reload, save: save,
    storageOK: function () { return !memoryOnly; },
    switchTo: switchTo, setNote: setNote, setNoteAt: setNoteAt, noteTarget: noteTarget, allNotes: allNotes, heartbeat: heartbeat, tick: tick,
    outreachToday: outreachToday, outreachAdd: outreachAdd, outreachUndo: outreachUndo, setOutreachDay: setOutreachDay, setOutreachName: setOutreachName, setOutreachNote: setOutreachNote, todoList: todoList, addTodo: addTodo, removeTodo: removeTodo, markReached: markReached, startFollow: startFollow, followList: followList, followDue: followDue, followDone: followDone, followStop: followStop, leadFromScript: leadFromScript, FOLLOW_MAX: FOLLOW_MAX, outreachLog: outreachLog, projectList: projectList, renameProject: renameProject, projectTime: projectTime, actByHour: actByHour, setGoal: setGoal,
    todayTotals: todayTotals, todayPoints: todayPoints, analyze: analyze,
    exportAll: exportAll, importText: importText,
    audio: audio, audioReady: audioReady, beep: beep, nudgeBeep: nudgeBeep, alarmStart: alarmStart, alarmStop: alarmStop,
    setFavicon: setFavicon, setTitle: setTitle, picFor: picFor, editTodo: editTodo, editFollow: editFollow, removeFollow: removeFollow, outreachRemoveClick: outreachRemoveClick, setPics: setPics, startFlash: startFlash, quickBlink: quickBlink, engine: engine, initTheme: initTheme, mountDataTools: mountDataTools, mountCsvTools: mountCsvTools, csvExport: csvExport, maybeAutoBackup: maybeAutoBackup, setAutoBackup: setAutoBackup, setGoalSec: setGoalSec, GOALS: GOALS,
    dailySummary: dailySummary, sendSummary: sendSummary,
    KEY: KEY, CHRONO_KEY: CHRONO_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
