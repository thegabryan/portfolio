/* Alarms: a "⏰ Alarms" button in the top bar of every page. Alarms ring (loud, repeating, with a banner and a
   Stop button) while any page of the site is open. They are kept in localStorage under 'tsa2_alarms' and are
   part of the Export / Import backup. The userscript can add the "Claude limit resets" alarm by itself. */
(function () {
  var KEY = 'tsa2_alarms', LATE_MS = 15 * 60 * 1000;     // an alarm missed by more than 15 min only shows a notice
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var read = function () { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  var write = function (a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} };
  var uid = function () { return 'al-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function nextAt(h, m, from) {                          // next time the clock shows h:m
    var d = new Date(from || Date.now()); d.setHours(h, m, 0, 0);
    if (d.getTime() <= (from || Date.now())) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function when(at) {
    var d = new Date(at), n = new Date(), t = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var a = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(), b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var diff = Math.round((b - a) / 864e5);
    if (diff === 0) return 'today ' + t;
    if (diff === 1) return 'tomorrow ' + t;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + t;
  }

  /* ---- ringing ---- */
  var lastClaim = '';
  function ring(text, silent) {
    if (silent) { notice(text); return; }
    if (window.TSA && TSA.alarmStart) TSA.alarmStart(text);
  }
  function notice(text) {
    var b = document.createElement('div'); b.className = 'alarm';
    b.innerHTML = '<span></span><button type="button">OK</button>';
    b.firstChild.textContent = text;
    b.querySelector('button').addEventListener('click', function () { b.remove(); });
    document.body.appendChild(b);
  }
  function tick() {
    var now = Date.now(), list = read(), changed = false, out = [];
    list.forEach(function (a) {
      if (!a || !a.at || a.at > now) { out.push(a); return; }
      var claim = a.id + ':' + a.at;
      var late = now - a.at > LATE_MS, label = (a.label ? a.label + ' · ' : '') + pad(new Date(a.at).getHours()) + ':' + pad(new Date(a.at).getMinutes());
      if (claim !== lastClaim) {
        lastClaim = claim;
        if (late) ring('Missed alarm: ' + label, true);
        else ring('⏰ ' + (a.label || 'Alarm') + ' — ' + pad(new Date(a.at).getHours()) + ':' + pad(new Date(a.at).getMinutes()));
      }
      changed = true;
      if (a.repeat === 'daily') { a.at = nextAt(a.h, a.m, now); out.push(a); }   // once alarms are removed after ringing
    });
    if (changed) { write(out); refreshUi(); }
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY) refreshUi(); });

  /* ---- adding / removing ---- */
  function add(h, m, label, repeat) {
    var list = read(); list.push({ id: uid(), h: h, m: m, label: String(label || '').slice(0, 60), repeat: repeat === 'daily' ? 'daily' : 'once', at: nextAt(h, m) });
    write(list); refreshUi();
  }
  function remove(id) { write(read().filter(function (a) { return a.id !== id; })); refreshUi(); }
  /* Set by the userscript (id 'claude-reset'): one alarm at an exact time that is replaced when a new time arrives. */
  function upsertAt(id, at, label) {
    var d = new Date(at), list = read().filter(function (a) { return a.id !== id; });
    if (at > Date.now() - LATE_MS) list.push({ id: id, h: d.getHours(), m: d.getMinutes(), label: label || '', repeat: 'once', at: at, auto: true });
    write(list); refreshUi();
  }

  /* ---- interface ---- */
  var btn, dlg, listEl, hSel, mSel;
  function refreshUi() {
    if (!btn) return;
    var list = read().sort(function (a, b) { return a.at - b.at; });
    var nx = list[0];
    btn.textContent = nx ? '⏰ ' + pad(new Date(nx.at).getHours()) + ':' + pad(new Date(nx.at).getMinutes()) : '⏰';
    btn.title = list.length ? 'Alarms: ' + list.map(function (a) { return pad(new Date(a.at).getHours()) + ':' + pad(new Date(a.at).getMinutes()) + (a.label ? ' ' + a.label : '') + ' (' + when(a.at) + ')'; }).join(' · ') : 'Alarms (none set)';
    if (!listEl) return;
    listEl.innerHTML = list.length ? list.map(function (a) {
      return '<div class="alrow"><b>' + pad(new Date(a.at).getHours()) + ':' + pad(new Date(a.at).getMinutes()) + '</b>' +
        '<span class="almeta">' + esc(a.label || (a.auto ? 'Claude limit resets' : 'Alarm')) + ' · ' + (a.repeat === 'daily' ? 'every day · next ' : '') + when(a.at) + (a.auto ? ' · set by the userscript' : '') + '</span>' +
        '<button type="button" class="ghost" data-del="' + a.id + '">Delete</button></div>';
    }).join('') : '<p class="muted">No alarms yet.</p>';
  }
  /* "Reach out" chip: shows who is waiting in the To-reach-out list (read from the site data, so it works on every page). */
  function initReach(after) {
    var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'ghost hbtn reachchip'; chip.id = 'reachChip'; chip.hidden = true;
    after.after(chip);
    function waiting() {
      try { var d = JSON.parse(localStorage.getItem('tsa2_data') || 'null'); var t = d && d.outreach && d.outreach.todo; return Array.isArray(t) ? t.slice().sort(function (a, b) { return a.added - b.added; }) : []; } catch (e) { return []; }
    }
    function paint() {
      var t = waiting();
      chip.hidden = !t.length;
      if (!t.length) return;
      var nm = function (x) { return x.name || x.url || 'a creator'; };
      chip.textContent = '📌 Reach out: ' + nm(t[0]) + (t.length > 1 ? ' +' + (t.length - 1) : '');
      chip.title = 'To reach out (' + t.length + '):\n' + t.map(nm).join('\n') + '\n\nClick to open the list';
    }
    chip.addEventListener('click', function () {
      if (document.getElementById('lstDlg')) window.dispatchEvent(new CustomEvent('tsa-open-lists', { detail: { tab: 'todo' } }));
      else location.href = 'index.html#todo';
    });
    window.addEventListener('storage', function (e) { if (e.key === 'tsa2_data') paint(); });
    window.addEventListener('tsa-lists-changed', paint);
    setInterval(paint, 3000); paint();
  }
  function init() {
    var nav = document.querySelector('.nav nav'); if (!nav) return;
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ghost hbtn alarmtime'; btn.id = 'alarmBtn';
    var hb = document.getElementById('helpBtn');                       // order in the header: theme, how to use, alarms
    if (hb) hb.after(btn); else nav.parentNode.insertBefore(btn, nav);
    initReach(btn);
    dlg = document.createElement('dialog'); dlg.id = 'alarmDlg'; dlg.className = 'alarmdlg';
    var opts = function (n) { var s = ''; for (var i = 0; i < n; i++) s += '<option value="' + i + '">' + pad(i) + '</option>'; return s; };
    dlg.innerHTML = '<h2>⏰ Alarms</h2>' +
      '<p class="muted">Rings (loud, repeating) while any page of this site is open. Times use the 24-hour clock.</p>' +
      '<div class="alform"><select id="alH" aria-label="Hour">' + opts(24) + '</select><b>:</b><select id="alM" aria-label="Minute">' + opts(60) + '</select>' +
      '<input id="alLabel" type="text" maxlength="60" placeholder="Label (optional)" aria-label="Label">' +
      '<select id="alRep" aria-label="Repeat"><option value="once">Once</option><option value="daily">Every day</option></select>' +
      '<button type="button" class="primary" id="alAdd">Add</button></div>' +
      '<div id="alList"></div><div class="drow"><button type="button" class="primary" id="alClose">Close</button></div>';
    document.body.appendChild(dlg);
    listEl = dlg.querySelector('#alList'); hSel = dlg.querySelector('#alH'); mSel = dlg.querySelector('#alM');
    btn.addEventListener('click', function () {
      var n = new Date(Date.now() + 3600e3); hSel.value = n.getHours(); mSel.value = 0;
      refreshUi(); dlg.showModal();
    });
    dlg.querySelector('#alAdd').addEventListener('click', function () {
      add(+hSel.value, +mSel.value, dlg.querySelector('#alLabel').value.trim(), dlg.querySelector('#alRep').value);
      dlg.querySelector('#alLabel').value = '';
    });
    dlg.addEventListener('click', function (e) {
      var d = e.target.closest('[data-del]'); if (d) { remove(d.dataset.del); return; }
      if (e.target === dlg) dlg.close();
    });
    dlg.querySelector('#alClose').addEventListener('click', function () { dlg.close(); });
    refreshUi();
    setInterval(tick, 1000); tick();

    /* the userscript sends the Claude reset time here */
    window.addEventListener('message', function (e) {
      var m = e.data;
      if (e.origin !== location.origin || !m || m.channel !== 'timer-bridge' || m.from !== 'userscript' || m.type !== 'alarm') return;
      var at = Number(m.at); if (!at || !isFinite(at)) return;
      upsertAt(String(m.id || 'claude-reset'), at, String(m.label || '').slice(0, 60));
      window.postMessage({ channel: 'timer-bridge', from: 'page', type: 'alarm-ok', id: m.id, at: at }, location.origin);
    });
  }
  window.TSAAlarms = { init: init, add: add, remove: remove, upsertAt: upsertAt };
})();
