/* "How to use" guide: adds a button to the top bar of every page and opens a popup with a tab per page. */
(function () {
  var TABS = [
    ['timer', 'Timer page'], ['dash', 'Dashboard'], ['review', 'Review'], ['script', 'Userscript & Url Notes'], ['keys', 'Shortcuts & tips']
  ];
  var H = {};
  H.timer =
    '<h3>The seven timers</h3>' +
    '<p>Work ⏰, Paused ⏸️, Workflow 🛠️, Workout 🏋️, Eating 🍽️, Shower 🚿 and Sleep 🌙. Each one shows today\'s total, counted from zero every day (the day changes at midnight). Press a card\'s button to start it; only one runs at a time, so starting one simply stops the other. Pressing the running timer again stops it and switches to <b>Paused</b>.</p>' +
    '<ul>' +
    '<li><b>Work</b> is a 1-hour countdown. When it reaches zero a loud alarm rings until you press <i>Stop alarm</i>, and you get <b>+1 point</b>. With <i>Auto-restart</i> on, it gives a short beep, adds the point and starts the next hour by itself. Stopping a round keeps the time left.</li>' +
    '<li><b>Paused</b> starts by itself when nothing else runs and the page is open (from the first time you open the site each day). Closed time is counted as Paused when you come back.</li>' +
    '<li><b>Sleep</b> keeps counting even with the page closed or the computer asleep, until you stop it.</li>' +
    '<li>If the page is closed or hidden for more than about 30 seconds, the running timer is stopped at the last moment it was seen (Sleep excepted).</li>' +
    '<li>The <b>tab icon</b> (favicon) shows an emoji for the running timer.</li>' +
    '<li>Blocks that cross midnight are split between the two days.</li>' +
    '</ul>' +
    '<h3>Notes and projects</h3>' +
    '<ul>' +
    '<li>The small <b>📝 Note</b> button on every card adds a note to the running session, or to that timer\'s most recent session if it is stopped. If a note exists it opens for editing; clearing the text removes it.</li>' +
    '<li>Work and Workflow also have a <b>Project</b> field (it remembers the last one and suggests earlier ones). Projects show up in the dashboard and in tags sent to Url Notes.</li>' +
    '<li>The note box starts as one line. <b>Enter</b> saves; <b>Shift+Enter</b> adds a new line (the box grows to several lines, and Enter still saves). Notes can be up to 1000 characters.</li>' +
    '<li>A note box also opens when you stop Work or switch away from it.</li>' +
    '</ul>' +
    '<h3>Daily goals</h3>' +
    '<p>Click <b>Goal</b> on a card to set a daily goal: Work and Workout are goals to <i>reach</i>, Paused is a <i>maximum</i>. A progress bar shows how you are doing today.</p>' +
    '<h3>Settings bar</h3>' +
    '<ul>' +
    '<li><b>Auto-restart</b> – Work starts the next hour by itself.</li>' +
    '<li><b>🔊 Volume</b> – for the alarm and all beeps (saved with your data).</li>' +
    '<li><b>Beep every</b> – the reminder beep interval (5–30 min) for Paused, Workflow, Workout and Eating; the <b>🔔</b> checkboxes switch each one on or off.</li>' +
    '<li><b>Short pause</b> – if Paused ran less than this many seconds (default 20) when you start another timer, that Paused time moves into the new timer. 0 = off.</li>' +
    '<li><b>Idle nudge</b> – after this many minutes of Paused with the page open (default 30), a bar and a short beep ask what you are doing. 0 = off.</li>' +
    '<li>Browsers only allow sound after one click on the page, so click anywhere once after opening it.</li>' +
    '</ul>' +
    '<h3>Bottom row</h3>' +
    '<ul>' +
    '<li><b>Export all data / Import backup</b> – saves or restores everything in one file named with the date and time. Importing replaces what is saved in this browser.</li>' +
    '<li><b>Send day summary</b> – queues today\'s summary as a note for Url Notes (needs the userscript; otherwise it copies the text).</li>' +
    '<li><b>Outreach counter</b> – <b>+1</b> adds an outreach, <b>−</b> removes one, <b>Goal</b> changes the daily goal. After +1 a small box lets you type a name or note for that outreach.</li>' +
    '<li><b>Chronometer</b> – a separate stopwatch that keeps counting through refreshes and is not part of the export.</li>' +
    '</ul>';
  H.dash =
    '<h3>Top and activity cards</h3>' +
    '<ul>' +
    '<li><b>Floating running-timer box</b> – shows which timer runs and for how long, on every dashboard view.</li>' +
    '<li><b>Timeline of the day</b> – colored blocks in time order for any day (use ‹ › to change day). Hover or tap a block to see its details, times and note; blocks with a note have a small white corner mark. Details stay open until you click elsewhere.</li>' +
    '<li><b>Time per activity</b> – totals, daily averages and the number of sessions for each timer.</li>' +
    '<li><b>Daily goals</b> – appears once you set a goal: today\'s progress, days met, and streaks.</li>' +
    '</ul>' +
    '<h3>Score and days</h3>' +
    '<ul>' +
    '<li><b>Score per day</b> – chart of your Work points (finished hours) per day.</li>' +
    '<li><b>Calendar</b> – month view of each day\'s score; use ‹ › to change month.</li>' +
    '<li><b>Where each day went</b> – a stacked bar per day with all timers.</li>' +
    '<li><b>Share of the day</b> – how the day splits between the timers.</li>' +
    '<li><b>Every day</b> – a table of each day. You can type a new number into a past day\'s <b>Outreach</b> cell to correct it (marked with a pencil).</li>' +
    '</ul>' +
    '<h3>Outreach</h3>' +
    '<ul>' +
    '<li><b>Outreach</b> – number cards, a chart per day and goal progress.</li>' +
    '<li><b>Outreaches by hour of day</b> – only real clicks, not hand corrections.</li>' +
    '<li><b>Outreach log</b> – every outreach with its name/note; search it, open links, export CSV.</li>' +
    '</ul>' +
    '<h3>Sessions, notes, projects</h3>' +
    '<ul>' +
    '<li><b>Work rounds by hour of day</b> – when you finish most of your hours.</li>' +
    '<li><b>Sessions</b> – every start and stop. The dropdown picks one timer, or <b>All timers</b> (the default). Notes show two lines with a fade and a <i>more…</i> link.</li>' +
    '<li><b>Time per project</b> – time spent on each project; you can <b>rename</b> a project everywhere.</li>' +
    '<li><b>Notes</b> – every note from every timer, with a search box and an activity filter. You can edit or delete a note here.</li>' +
    '</ul>' +
    '<h3>Your data</h3>' +
    '<ul>' +
    '<li><b>Export / Import</b> – same one-file backup as on the Timer page.</li>' +
    '<li><b>Spreadsheet files (CSV)</b> – four downloads: sessions, daily totals, outreach per day and notes (comma-separated, durations in seconds).</li>' +
    '<li><b>Daily backup</b> – when on, the first time you open the site each day it downloads a backup file by itself. Still use Export now and then, because browsers can clear site data.</li>' +
    '</ul>';
  H.review =
    '<h3>Week and month review</h3>' +
    '<ul>' +
    '<li>Switch between <b>Week</b> (starts on Sunday) and <b>Month</b>; use ‹ › to go to other periods. Every timer total is compared with the previous period over the same number of elapsed days, so a half-finished week is not unfairly compared with a full one.</li>' +
    '<li><b>Work heatmap</b> – a calendar colored by how much Work you did each day, relative to your own best days.</li>' +
    '<li><b>Work by hour of day</b> – minutes of Work in each hour, so you can see your productive hours.</li>' +
    '<li><b>Streaks</b> – consecutive days meeting your goals, current and best.</li>' +
    '</ul>';
  H.script =
    '<h3>Setup</h3>' +
    '<p>This part needs the <b>Make Highlights &amp; Notes</b> userscript (version 2.8 or newer) installed in Tampermonkey. The timer site is expected at <code>gabryan.com/timer</code> and Url Notes at <code>gabryan.com/notes</code>. Keep the timer page open in a tab so the script can see it.</p>' +
    '<h3>Running-timer capsule</h3>' +
    '<ul>' +
    '<li>On every other web page a small capsule at the bottom shows the running timer: emoji, name, project and elapsed time. It disappears when no timer runs (about 45 seconds after the timer page closes; Sleep stays).</li>' +
    '<li><b>Click</b> it to open the timer page. <b>Drag</b> it anywhere on the screen; the position is remembered for every site. <b>Double-click</b> it to put it back in the bottom-left corner.</li>' +
    '</ul>' +
    '<h3>Notes to Url Notes</h3>' +
    '<ul>' +
    '<li>Every note you save on a finished timer session is queued automatically for Url Notes, tagged with the timer, the day and the project, e.g. <code>#workflow #2026-11-15 #my-project</code>, with the time range in the text. They arrive the next time the notes site is open.</li>' +
    '<li>Old notes are not sent at first. In the Tampermonkey menu choose <b>Send ALL past timer notes to Url Notes</b> to send them once.</li>' +
    '<li>If you edit a note after it was sent, an updated copy is queued.</li>' +
    '<li><b>Send day summary</b> (Timer page) queues a <code>#summary</code> note with today\'s totals, goals, points, outreach and notes.</li>' +
    '</ul>' +
    '<h3>Highlights</h3>' +
    '<p>Notes you send to Url Notes from other pages while a timer runs get the running timer\'s tag (and project) added, e.g. <code>#work #my-project</code>.</p>' +
    '<h3>Highlighting and notes on web pages</h3>' +
    '<p>The same script lets you highlight text and attach notes on any page: <b>Alt+Shift+H</b> opens the panel, <b>Alt+Shift+N</b> sends a note to Url Notes.</p>';
  H.keys =
    '<h3>Keyboard shortcuts (Timer page)</h3>' +
    '<table><tbody>' +
    '<tr><td><kbd>1</kbd></td><td>Work</td></tr><tr><td><kbd>2</kbd></td><td>Paused</td></tr><tr><td><kbd>3</kbd></td><td>Workflow</td></tr>' +
    '<tr><td><kbd>4</kbd></td><td>Workout</td></tr><tr><td><kbd>5</kbd></td><td>Eating</td></tr><tr><td><kbd>6</kbd></td><td>Shower</td></tr><tr><td><kbd>7</kbd></td><td>Sleep</td></tr>' +
    '<tr><td><kbd>N</kbd></td><td>Note on the running timer</td></tr>' +
    '</tbody></table>' +
    '<p class="muted">Shortcuts are ignored while you are typing in a box.</p>' +
    '<h3>Good to know</h3>' +
    '<ul>' +
    '<li>All data lives in this browser only (localStorage). Use <b>Export all data</b> regularly and keep the files.</li>' +
    '<li>Theme: the button in the top bar cycles auto / light / dark.</li>' +
    '<li>In Chrome-based browsers the site can be installed as an app, and installed apps may play sound without a first click.</li>' +
    '<li>Nothing is sent anywhere by the site itself; the only link to other sites is through your userscript.</li>' +
    '</ul>';

  function init(page) {
    var nav = document.querySelector('.nav nav'); if (!nav) return;
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'ghost'; btn.id = 'helpBtn'; btn.textContent = '? How to use';
    nav.parentNode.insertBefore(btn, nav);
    var dlg = document.createElement('dialog'); dlg.id = 'helpDlg'; dlg.className = 'helpdlg';
    dlg.innerHTML = '<h2>How to use</h2><div class="htabs" role="tablist"></div><div class="hbody"></div><div class="drow"><button type="button" class="primary" id="helpClose">Close</button></div>';
    document.body.appendChild(dlg);
    var tabs = dlg.querySelector('.htabs'), body = dlg.querySelector('.hbody');
    TABS.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.dataset.t = t[0]; b.textContent = t[1]; b.setAttribute('role', 'tab');
      tabs.appendChild(b);
    });
    function show(k) {
      body.innerHTML = H[k]; body.scrollTop = 0;
      [].forEach.call(tabs.children, function (b) { b.classList.toggle('on', b.dataset.t === k); b.setAttribute('aria-selected', b.dataset.t === k); });
    }
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.t); });
    btn.addEventListener('click', function () { show(page); dlg.showModal(); });
    dlg.querySelector('#helpClose').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }
  window.TSAHelp = { init: init };
})();
