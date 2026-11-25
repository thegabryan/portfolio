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
  function update(id, h, m, label, repeat) {
    var list = read(); list.forEach(function (a) {
      if (a.id !== id) return;
      a.h = h; a.m = m; a.label = String(label || '').slice(0, 60); a.repeat = repeat === 'daily' ? 'daily' : 'once'; a.at = nextAt(h, m); a.auto = false;
    });
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
        '<button type="button" class="ghost" data-edit="' + a.id + '" title="Edit this alarm">✏️ Edit</button><button type="button" class="ghost" data-del="' + a.id + '">Delete</button></div>';
    }).join('') : '<p class="muted">No alarms yet.</p>';
  }
  /* Header chips for the outreach lists, read from the site data so they work on every page:
     amber "Reach out: Name" (To reach out list) and blue "Follow up: Name" (follow-ups that are due). */
  function initReach(after) {
    var data = function () { try { var d = JSON.parse(localStorage.getItem('tsa2_data') || 'null'); return d && d.outreach ? d.outreach : {}; } catch (e) { return {}; } };
    var nm = function (x) { return x.name || x.url || 'a creator'; };
    function make(id, cls, anchor, tab, list, label, head) {
      var chip = document.createElement('button'); chip.type = 'button'; chip.className = 'ghost hbtn reachchip ' + cls; chip.id = id;
      anchor.after(chip);
      chip.paint = function () {
        var t = list(data());
        chip.classList.toggle('idle', !t.length);
        if (!t.length) {
          chip.textContent = label.replace(/: $/, '') + (tab === 'todo' ? ': nobody' : ': all done');
          chip.title = head + ': nothing for today\n\nClick to open the list';
          return;
        }
        chip.textContent = label + nm(t[0]) + (t.length > 1 ? ' +' + (t.length - 1) : '');
        chip.title = head + ' (' + t.length + '):\n' + t.map(nm).join('\n') + '\n\nClick to open the list';
      };
      chip.addEventListener('click', function () {
        if (document.getElementById('lstDlg')) window.dispatchEvent(new CustomEvent('tsa-open-lists', { detail: { tab: tab } }));
        else location.href = 'index.html#' + tab;
      });
      return chip;
    }
    var arr = function (v) { return Array.isArray(v) ? v : []; };
    var reach = make('reachChip', 'reachto', after, 'todo', function (o) { return arr(o.todo).slice().sort(function (a, b) { return a.added - b.added; }); }, '📌 Reach out: ', 'To reach out');
    var fu = make('followChip', 'followup', reach, 'follow', function (o) { var n = Date.now(); return arr(o.follow).filter(function (f) { return f.status === 'active' && f.due <= n; }).sort(function (a, b) { return a.due - b.due; }); }, '🔁 Follow up: ', 'Follow-ups due');
    /* amber-green "Daily ask": today's person until you press Sent; afterwards, a reminder only when an answer is overdue */
    var ask = document.createElement('button'); ask.type = 'button'; ask.className = 'ghost hbtn reachchip dailyask'; ask.id = 'askChip'; fu.after(ask);
    ask.paint = function () {
      var a = window.TSA && TSA.askPeek ? TSA.askPeek() : null;
      ask.classList.remove('idle');
      if (!a) { ask.classList.add('idle'); ask.textContent = '🎯 Daily ask: add someone'; ask.title = 'Open the Daily ask'; return; }
      var fire = a.stats.streak ? ' · 🔥' + a.stats.streak : '';
      if (!a.sent) {
        ask.textContent = '🎯 Daily ask: ' + (a.person ? a.person.name : 'add someone') + fire;
        ask.title = 'Send one message today to someone you admire' + (a.person && a.person.topic ? ' (about: ' + a.person.topic + ')' : '') + '\nStreak ' + a.stats.streak + ' · this week ' + a.stats.week + '\n\nClick to open';
      } else if (a.overdue.length) {
        ask.textContent = '💬 No reply yet: ' + a.overdue[0].name + (a.overdue.length > 1 ? ' +' + (a.overdue.length - 1) : '');
        ask.title = 'Asked 7+ days ago, no answer logged:\n' + a.overdue.map(function (l) { return l.name; }).join('\n') + '\n\nClick to open';
      } else { ask.classList.add('idle'); ask.textContent = '🎯 Daily ask: done ✓'; ask.title = 'Today\'s ask is sent' + (a.stats.streak ? ' · streak ' + a.stats.streak : '') + '\n\nClick to open'; }
    };
    ask.addEventListener('click', function () {
      if (document.getElementById('askDlg')) window.dispatchEvent(new CustomEvent('tsa-open-ask'));
      else location.href = 'index.html#ask';
    });
    /* read-only counters on the pages that have no counter boxes of their own (the Timer page has them) */
    var trk = [];
    if (!document.getElementById('ocCount')) {
      var mk = function (id, cls, anchor, tab) {
        var c = document.createElement('button'); c.type = 'button'; c.id = id; c.className = 'ghost hbtn reachchip trackchip ' + cls;
        anchor.after(c);
        c.addEventListener('click', function () {
          if (document.getElementById('lstDlg')) window.dispatchEvent(new CustomEvent('tsa-open-lists', { detail: { tab: tab } }));
          else location.href = 'index.html#' + tab;
        });
        return c;
      };
      var oc = mk('outChip', 'outchip', ask, 'todo'), fc = mk('fuTodayChip', 'fuchip', oc, 'follow');
      oc.paint = function () { var t = window.TSA && TSA.trackPeek ? TSA.trackPeek() : { out: 0, goal: 3, fu: 0 }; oc.textContent = '📤 Outreach ' + t.out + ' / ' + t.goal; oc.classList.toggle('met', t.out >= t.goal); oc.title = 'Outreaches done today (goal ' + t.goal + ')\nLog them in the Outreach lists popup'; };
      fc.paint = function () { var t = window.TSA && TSA.trackPeek ? TSA.trackPeek() : { fu: 0 }; fc.textContent = '✅ Follow-ups ' + t.fu; fc.title = 'Follow-ups done today'; };
      trk = [oc, fc];
    }
    var paint = function () { reach.paint(); fu.paint(); ask.paint(); trk.forEach(function (c) { c.paint(); }); };
    window.addEventListener('storage', function (e) { if (e.key === 'tsa2_data') paint(); });
    window.addEventListener('tsa-lists-changed', paint); window.addEventListener('tsa-ask-changed', paint);
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
      '<button type="button" class="primary" id="alAdd">Add</button><button type="button" class="ghost" id="alCancel" hidden>Cancel</button></div>' +
      '<div id="alList"></div><p class="muted" id="alTestMsg" style="margin:8px 0 0"></p><div class="drow"><button type="button" class="ghost" id="alTest">🔊 Test sound</button><button type="button" class="primary" id="alClose">Close</button></div>';
    document.body.appendChild(dlg);
    dlg.querySelector('#alTest').addEventListener('click', function () {
      var m = dlg.querySelector('#alTestMsg'); m.textContent = 'Playing…';
      if (window.TSA && TSA.testSound) TSA.testSound().then(function (r) { m.textContent = r.text; }); else m.textContent = 'Sound test is not available on this page.';
    });
    listEl = dlg.querySelector('#alList'); hSel = dlg.querySelector('#alH'); mSel = dlg.querySelector('#alM');
    btn.addEventListener('click', function () {
      var n = new Date(Date.now() + 3600e3); hSel.value = n.getHours(); mSel.value = 0;
      endEdit(); refreshUi(); dlg.showModal();
    });
    var editId = '', addBtn = dlg.querySelector('#alAdd'), cancelBtn = dlg.querySelector('#alCancel');
    var endEdit = function () { editId = ''; addBtn.textContent = 'Add'; cancelBtn.hidden = true; dlg.querySelector('#alLabel').value = ''; dlg.querySelector('#alRep').value = 'once'; };
    addBtn.addEventListener('click', function () {
      var label = dlg.querySelector('#alLabel').value.trim(), rep = dlg.querySelector('#alRep').value;
      if (editId) update(editId, +hSel.value, +mSel.value, label, rep); else add(+hSel.value, +mSel.value, label, rep);
      endEdit();
    });
    cancelBtn.addEventListener('click', endEdit);
    dlg.addEventListener('click', function (e) {
      var ed = e.target.closest('[data-edit]');
      if (ed) {                                              // put the alarm in the form; Save changes it in place
        var al = read().filter(function (a) { return a.id === ed.dataset.edit; })[0]; if (!al) return;
        editId = al.id; hSel.value = al.h; mSel.value = al.m;
        dlg.querySelector('#alLabel').value = al.label || ''; dlg.querySelector('#alRep').value = al.repeat === 'daily' ? 'daily' : 'once';
        addBtn.textContent = 'Save changes'; cancelBtn.hidden = false; dlg.querySelector('#alLabel').focus(); return;
      }
      var d = e.target.closest('[data-del]'); if (d) { if (editId === d.dataset.del) endEdit(); remove(d.dataset.del); return; }
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
  window.TSAAlarms = { init: init, add: add, update: update, remove: remove, upsertAt: upsertAt };
})();
