/* "How to use" guide: adds a button to the top bar of every page and opens a popup with a tab per page. */
(function () {
  var TABS = [
    ['timer', 'Timer page'], ['dash', 'Dashboard'], ['outreach', 'Outreach'], ['review', 'Review'], ['script', 'Userscript & Url Notes'], ['keys', 'Shortcuts & tips']
  ];
  var H = {};
  H.outreach =
    '<h3>Outreach page</h3>' +
    '<p>Your outreach tracker, the same data as <b>📋 Outreach lists</b> on the timer page. Every lead has a <b>stage</b>: <b>Pre-initiated</b> (in To reach out), <b>A · Initiated</b> (first message sent), <b>B · Engaged</b> (they answered), <b>C · Pitched</b> (you made the offer) and <b>D · Closed</b> (client). A lead can also be marked <b>Not interested</b>.</p>' +
    '<ul>' +
    '<li><b>Follow-ups</b>: due 1 day after a stage starts, then every 2 days. Stage A allows 3, stage B 5, stage C 5. <b>Followed up</b> logs one; <b>Engaged ✓ / Pitched ✓ / Closed ✓</b> moves the lead to the next stage and starts that stage\'s follow-ups. The header chips count the due ones.</li>' +
    '<li><b>Funnel and conversion by source</b>: leads per stage, A &gt; B, B &gt; C, C &gt; D and the total close rate, per source (Actively Hiring, YouTube, X, Instagram, Discord, YT Jobs, Other) and in total.</li>' +
    '<li><b>Over time</b>: initiated, engaged, pitched and closed per week, average days between stages, and the best hours and weekdays.</li>' +
    '<li><b>Tracker</b>: one row per lead like the spreadsheet (dates of each stage and follow-up, email, notes). Click a header to sort; search and filter by source or stage. Grey = not interested, green = closed, amber = follow-up due. ✏️ opens the edit popup on the timer page.</li>' +
    '<li>Source is picked automatically from the link (YouTube, X, Instagram, Discord, YT Jobs) and can be changed in the edit popup. <b>CSV</b> exports the tracker in the spreadsheet\'s column layout.</li>' +
    '</ul>';
  H.timer =
    '<h3>The seven timers</h3>' +
    '<p>Work 💼, Paused ⏸️, Workflow 🛠️, Workout 🏋️, Eating 🍽️, Shower 🚿 and Sleep 🌙. Each one shows today\'s total, counted from zero every day (the day changes at midnight). Press a card\'s button to start it; only one runs at a time, so starting one simply stops the other. Pressing the running timer again stops it and switches to <b>Paused</b>.</p>' +
    '<ul>' +
    '<li><b>Work</b> is a 1-hour countdown. When it reaches zero a loud alarm rings until you press <i>Stop alarm</i>, and you get <b>+1 point</b>. With <i>Auto-restart</i> on, it gives a short beep, adds the point and starts the next hour by itself. Stopping a round keeps the time left.</li>' +
    '<li><b>Paused</b> starts by itself when nothing else runs and the page is open (from the first time you open the site each day). Closed time is counted as Paused when you come back.</li>' +
    '<li><b>Sleep</b> keeps counting even with the page closed or the computer asleep, until you stop it.</li>' +
    '<li>If the page is closed or hidden for more than about 30 seconds, the running timer is stopped at the last moment it was seen (Sleep excepted).</li>' +
    '<li><b>Enter</b> or <b>N</b> (when you are not typing in a text box) opens a note for the running timer, or for the most recent run if none is running; the number keys 1–7 switch timers. Both work anywhere on this page, also while a popup is open (the note opens on top of it).</li>' +
    '<li><b>Click outside a popup</b> to close it. In the Links popup, <b>Search Gmail</b> and the other links are real links: middle-click or Ctrl+click opens them in a background tab. The pill at the bottom of Dashboard and Review takes you back to this page.</li>' +
    '<li>The <b>tab icon</b> (favicon) shows an emoji for the running timer.</li>' +
    '<li>Blocks that cross midnight are split between the two days.</li>' +
    '</ul>' +
    '<h3>Notes and projects</h3>' +
    '<ul>' +
    '<li>The small <b>📝 Note</b> button on every card adds a note to the running session, or to that timer\'s most recent session if it is stopped. If a note exists it opens for editing; clearing the text removes it.</li>' +
    '<li>Work and Workflow also have a <b>Project</b> field (it starts empty for every new run and suggests earlier projects as you type). Projects show up in the dashboard and in tags sent to Url Notes.</li>' +
    '<li><b>Channel file (📁 Links)</b>: on any page (an AI chat, YTJobs, their website…) click <b>📁</b> on the timer capsule (needs the Focus Timer Capsule script) and pick the channel; the page is saved with its favicon. On a YouTube About page of a channel in your lists, the YouTube script offers to save the website and social links it finds. In <i>Outreach lists</i> every channel has a <b>📁 Links N</b> button that opens its file: picture, name, channel link, note, then all links with favicon, type, date, own note, <b>📌 Pin</b> (pinned links go first and show on the row), ✏️ edit label/type/note, ✕ remove, <b>Open all</b> and <b>Copy all</b>. Links also show in the dashboard outreach log. Videos you comment on with the YouTube Timestamp Comments script are added automatically to the creator&rsquo;s links (title, thumbnail, publish date and first-comment date), with the YouTube Outreach Popup script. They arrive when a timer page is open.</li>' +
    '<li><b>Outreached ✓ asks when</b>: marking a channel as outreached (here or from the YouTube popup) asks <i>when</i> it happened, default now, with quick Yesterday / 2 / 3 days ago buttons. The +1 and the follow-up reminders count from that date. No automatic note is added.</li>' +
    '<li><b>🎯 Daily ask</b>: one message a day to someone you admire. The green chip in the header (<i>🎯 Daily ask: Name 🔥3</i>) shows today&rsquo;s person until you press <b>I sent it</b>; after that it only comes back as <i>💬 No reply yet</i> when an answer is 7+ days overdue. The <b>🎯 Daily ask</b> button on the timer page opens it: <b>Today</b> (pick the person, fill in who you are / what you are doing / why their insight matters / your specific ask, copy the message), <b>People</b> (name, link, why you admire them, what they could advise on; the one asked longest ago comes first) and <b>Log</b> (mark replies and write what you learned). <b>🧠 Copy AI prompt</b> (Today tab) and <b>🧠 Prep</b> (each person in People) copy a ready prompt for any AI chat: it holds your intro, the person, your past messages and replies with them, and what you worked on this week; the AI interviews you first, then researches them, asks you for transcripts or posts if needed, recommends the outreach method, scores your ask and drafts 3 versions plus a follow-up. Streak, weekly count and the log also show on the Dashboard. It is separate from the outreach +1 score.</li>' +
    '<li><b>Edit a channel</b>: ✏️ Edit in Outreach lists opens a popup (no scrolling): name, link and note on the left, outreach date, follow-ups done and status on the right, with <b>Save</b>, <b>Cancel</b> and <b>Delete…</b> always visible at the bottom. Enter saves (Shift+Enter = new line in the note).</li>' +
    '<li><b>Auto-sleep</b> (settings bar, default 20:00): if the page was closed, or the computer asleep, past that time, the part of the gap after it counts as <b>Sleep</b> instead of Paused (a gap that started before it stays Paused until it). Night runs until 06:00, so closing at 02:00 is already Sleep. Sleep lasts until you open the page again. Clear the time box to turn it off.</li>' +
    '<li>The bar at the top of the page (like <i>The page was closed…</i>) has an <b>×</b> to dismiss it. The old &ldquo;follow-ups due&rdquo; bar is gone: the 📋 Outreach lists button already shows the number due.</li>' +
    '<li><b>YouTube pill</b> (YouTube Outreach Popup 2.1): on every channel page a small pill stays in the top-right corner. A new creator gets the question (with an optional <b>note</b> box that is saved with your answer); <b>Not now</b> or × shrinks it to a <b>📌 Add to outreach</b> pill. For a creator already in your lists the pill shows where they stand (To reach out, or Outreached with the follow-up date), <b>🔗 Suggestions</b> (links from the About page, with a count of new ones), <b>📝 Note</b> (adds a dated line to their note; Enter saves, Shift+Enter new line) and <b>📁 Links</b> (opens their Links popup here). Notes and links arrive when a timer page is open.</li>' +
    '<li><b>🎬 New videos</b> (script <b>Timer New Videos</b>): while this page is open, the script reads each creator&rsquo;s YouTube feed (about every 3 hours, or press <b>🎬 Check videos</b> in 📋 Outreach lists). A creator who posted since you added them gets a <b>green bar</b> and a green <b>🎬 N new</b> button on their row, and a green <b>🎬 New videos</b> chip in the top bar of every page (click it for the <b>🎬 New videos</b> tab). The button opens their 📁 Links with the <b>🎬 New videos</b> section expanded (it is collapsed when you open Links normally): thumbnail, title, and how long ago. New ones have a green dot, followed by the latest 3 older ones in grey. Opening a video marks it seen; <b>✓ Mark all seen</b> (next to Close in the Links popup, and as <b>✓ Seen</b> next to the green button on the row) clears the rest. It needs a channel link (youtube.com/@name or /channel/&hellip;).</li>' +
    '<li><b>🎬 New-video toast</b>: when a creator in your lists posts, a card appears under the header (top right) on any page of the site, with a short chime (three soft bells, different from every other sound). It shows the thumbnail, creator and title, with <b>▶ Open video</b>, <b>📁 Open Links</b> (videos expanded) and <b>✓ Mark seen</b>. <b>×</b> only closes it; the video stays marked as new. Each video is announced once; the first time the feature runs, videos that are already new are not announced.</li>' +
    '<li><b>Status buttons in 📁 Links</b>: the top of the popup has <b>Followed up</b> (closes the popup), <b>Answered ✓</b> (moves to the next stage), <b>Not interested</b> / <b>Reopen</b> (and <b>Outreached ✓</b> for someone in To reach out; it also closes the popup), so you can mark it without hunting for the right list.</li>' +
    '<li><b>YouTube link in 📁 Links</b>: the first row of each creator&rsquo;s Links popup is their YouTube channel, with <b>Open YouTube ↗</b> and <b>Copy</b> buttons, in the same style as the Gmail row.</li>' +
    '<li><b>Find their email</b>: each creator&rsquo;s <b>📁 Links</b> popup starts with a Gmail search box, pre-filled with their name (filler words like &ldquo;The&rdquo; are skipped; edit the text and it is saved). <b>Search Gmail ↗</b> opens it in Gmail; the <i>account /u/</i> number is for your Google account.</li>' +
    '<li><b>📎 Outreach clip (bookmarklet)</b>: drag the <b>📎 Outreach clip</b> button at the bottom of <i>Outreach lists</i> to your bookmarks bar. On any page, select text and click the bookmark: a small window opens, you pick the channel and the text is added to its note with the date. If the text has an email you can also add a Gmail search link for it, and you can link the page it came from.</li>' +
    '<li><b>Sound check</b>: if the browser blocks or suspends sound, the page rebuilds it by itself within a few seconds and shows a red notice until it works. ⏰ Alarms has a <b>🔊 Test sound</b> button, and turning a card&rsquo;s bell back on plays a short beep to confirm.</li>' +
    '<li><b>Edit an alarm</b>: in ⏰ Alarms, ✏️ Edit puts the alarm in the form; change time, label or repeat and press Save changes. The Claude reset alarm always rings 1 minute after the reset time.</li>' +
    '<li><b>Esc never throws away what you typed</b>: in a note box or any popup text field it does nothing, and a popup with text in it will not close on Esc – use its Save, Cancel or Close button.</li>' +
    '<li>The note box starts as one line. <b>Enter</b> saves; <b>Shift+Enter</b> adds a new line (the box grows to several lines, and Enter still saves). Every line you start writing gets the time you started it, like <code>16:12 · text</code> (24 h). Lines already in a note keep what they have, and an existing note opens with the cursor at the end so you can add to it. Notes can be up to 1000 characters.</li>' +
    '<li>The note box never opens by itself when you switch timers – use the <b>Note</b> button (or Enter) when you want to add one.</li>' +
    '</ul>' +
    '<h3>Alarms</h3>' +
    '<p>The top bar (on every page) has three small buttons in this order: <b>theme</b> (🌓 auto, ☀️ light, 🌙 dark – click to cycle), <b>?</b> (this guide) and <b>⏰</b> (alarms). When someone waits in <i>To reach out</i>, an amber <b>📌 Reach out: Name</b> chip (+N more) appears next to the ⏰ button on every page; click it to open that list. In the same way a blue <b>🔁 Follow up: Name</b> chip shows the follow-ups that are due (Due now tab), and the green <b>🎯 Daily ask</b> chip today\'s person. The chips are always visible: when there is nothing to do they turn grey and say <i>nobody</i>, <i>all done</i> or <i>done ✓</i>. The ⏰ button shows the time of the next alarm, e.g. <i>⏰ 17:50</i>; hover it to see all alarms. Click it to open the alarm list. Pick a time on the 24-hour clock, an optional label, and <i>Once</i> or <i>Every day</i>, then press Add. When the time comes a loud repeating alarm rings with a <b>Stop alarm</b> banner. Alarms ring while any page of this site is open; one missed by more than 15 minutes only shows a notice. Alarms are included in Export / Import.</p>' +
    '<p>While an alarm rings (the Work round, a clock alarm, the Claude reset) the tab\'s icon blinks between the timer icon and 🔔 and the tab title blinks <i>⏰ ALARM</i>. The 10-minute beeps, the idle nudge and the auto-restart beep only blink twice, quickly. On other sites the capsule turns red and pulses with a <b>Stop</b> button that stops the alarm on the timer page.</p>' +
    '<h3>Daily goals</h3>' +
    '<p>Click <b>Goal</b> on a card to set a daily goal: Work and Workout are goals to <i>reach</i>, Paused is a <i>maximum</i>. A progress bar shows how you are doing today.</p>' +
    '<h3>Settings (⚙️ box, bottom left)</h3>' +
    '<p class="muted">The bottom row is: <b>⚙️ Settings</b>, <b>🎯 Daily ask</b>, <b>📋 Outreach lists</b>, then the counters and the chronometer. <b>Export all data</b>, <b>Import backup</b> and <b>Send day summary</b> are at the bottom of the Settings popup.</p>' +
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
    '<li><b>Export all data / Import backup</b> – saves or restores everything in one file named with the date and time: timer data, outreach (names, notes, To-reach-out list, follow-ups), alarms and the capsule\'s linked-sites list (needs the capsule script to have run once). Importing replaces what is saved in this browser.</li>' +
    '<li><b>📋 Outreach lists</b> – a popup with a <b>search bar</b> on top and one tab per stage: <b>Due now</b> (every follow-up that is due, from all stages), <b>To reach out</b>, <b>A · Initiated</b>, <b>B · Engaged</b>, <b>C · Pitched</b>, <b>D · Closed</b> and <b>Not interested</b>, each with a count. The search looks in every list at once: name, channel link or @handle, email, note, source, stage and the titles and notes of the 📁 Links; each result shows its stage. Clear the box to go back to the tab. Pinned links are shown only inside 📁 Links. Each channel shows its YouTube profile picture (a letter circle until the picture is known). Every entry can have a <b>note</b>; a note written in To reach out moves along when you press Outreached ✓. The <b>✏️ Edit</b> button on each row lets you change the name, link and note (and for follow-ups the outreach date, follow-ups done and status) or <b>Delete…</b> the entry, with an option to also remove its +1 from the outreach score. In To reach out you can add a creator (name and optional link, typed by you) and press <i>Outreached ✓</i> when you contact them; that counts +1 and starts follow-ups.</li>' +
    '<li><b>Send day summary</b> – queues today\'s summary as a note for Url Notes (needs the userscript; otherwise it copies the text).</li>' +
    '<li><b>Outreach today / Follow-ups today</b> – two read-only boxes at the bottom (and small 📤 / ✅ chips in the header of the other pages). They only count: outreaches are logged with <b>Outreached ✓</b> in the Outreach lists, follow-ups with <b>Followed up</b>. The daily outreach goal is in <b>⚙️ Settings</b>. The number on top of each timer card is the key that starts it. Notes can also be edited in the dashboard\'s outreach log, are searchable there and are in the CSV and the backup.</li>' +
    '<li><b>Follow-up bar</b> – when a follow-up is due, a slim bar appears above the cards. Follow-ups are due 2 days after the outreach, then 2 days after each follow-up. Press <b>Followed up</b> (the 3rd one finishes it), <b>Replied</b> or <b>Stop</b>. Following up does not change your score.</li>' +
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
    '<li><b>Outreach log</b> – every outreach with its name/note; search it, open links, export CSV. An outreach with no name and no note has a <b>Delete</b> button, and <b>Delete N empty</b> removes all of them at once (their +1s are removed too).</li>' +
    '<li><b>Notes and ⭐ Favorites</b> – the Notes list is a scrollable block. Click <b>☆</b> on a note (Notes, Sessions, or the note popup) to favorite it; favorites are collected in the <b>⭐ Favorite notes</b> card.</li>' +
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
    '<h3>The userscripts</h3>' +
    '<p>These pieces live in Tampermonkey and are separate scripts. The timer site is expected at <code>gabryan.com/timer</code> and Url Notes at <code>gabryan.com/notes</code>.</p>' +
    '<ul>' +
    '<li><b>Focus Timer Capsule</b> – the capsule, the site list with the switch prompt, and copying timer notes to Url Notes.</li>' +
    '<li><b>Claude Reset Alarm</b> – reads when your Claude limit resets and sets an alarm.</li>' +
    '<li><b>YouTube Outreach Popup</b> – on a creator\'s channel page it asks whether to add them to your outreach list.</li>' +
    '<li><b>Make Highlights &amp; Notes</b> – highlights and notes on any page (version 3.0 also tags notes with the running timer).</li>' +
    '</ul>' +
    '<h3>Running-timer capsule</h3>' +
    '<ul>' +
    '<li>On every other web page a small see-through capsule shows the running timer (emoji, name and elapsed time – no project or tags). It keeps the same size on every site whatever the page zoom; the Tampermonkey menu has <b>Capsule size</b> (small / normal / large) and a recalibrate command.</li>' +
    '<li>It shows the timer (emoji, name, elapsed time). It shows <i>⏱ timer off</i> when the timer page has been closed for a while.</li>' +
    '<li><b>Click</b> it to open the timer page. <b>Drag</b> it anywhere; the position is remembered for every site. <b>Double-click</b> puts it back in the bottom-left corner.</li>' +
    '</ul>' +
    '<h3>Switch timer when I open a site</h3>' +
    '<ul>' +
    '<li>Press the <b>+</b> on the capsule while you are on a site and pick a timer (for example Claude → Workflow). The whole website is linked (the list is copied into the timer page, so Export / Import keeps it); the + turns green when a site is linked, and the same menu lets you change or remove it and shows all linked sites.</li>' +
    '<li>When you open a linked site and a different timer is running, the capsule asks <i>Switch to Workflow now?</i> with <b>Switch</b> and <b>Not now</b>. Switch changes the timer on the timer page; if the timer page is not open, it opens in a new tab and switches. The question disappears by itself after 5 seconds. After <i>Not now</i>, that site does not ask again for 30 minutes.</li>' +
    '</ul>' +
    '<h3>Notes to Url Notes</h3>' +
    '<ul>' +
    '<li>Every note you save on a finished timer session is queued automatically for Url Notes, tagged with the timer, the day and the project, e.g. <code>#workflow #2026-11-15 #my-project</code>, with the time range in the text. They arrive the next time the notes site is open and appear in its <b>⏱ Timer</b> tab.</li>' +
    '<li>Old notes are not sent at first. In the Tampermonkey menu choose <b>Send ALL past timer notes to Url Notes</b> to send them once.</li>' +
    '<li>If you edit a note after it was sent, an updated copy is queued.</li>' +
    '<li><b>Send day summary</b> (Timer page) queues a <code>#summary</code> note with today\'s totals, goals, points, outreach and notes.</li>' +
    '<li>Notes you send from other pages with the highlights script while a timer runs get the running timer\'s tag (and project) added, e.g. <code>#work #my-project</code>.</li>' +
    '</ul>' +
    '<h3>Claude limit-reset alarm</h3>' +
    '<p>When a claude.ai page says when your usage limit resets (wording like <i>resets at 3:00 PM</i>, <i>resets in 2 hr 10 min</i> or <i>You are out of free messages until 5:50 PM</i>), the Claude Reset Alarm script reads that time and the timer page (when open) adds a <b>Claude limit resets</b> alarm for it. A newer time replaces the old one; you can delete it like any alarm.</p>' +
    '<h3>YouTube outreach popup</h3>'+
    '<p>On a YouTube channel page (<code>/@name</code>, <code>/channel/…</code>) a small popup asks: <b>I want to outreach to them</b> (adds to <i>To reach out</i>), <b>I already outreached (+1)</b> (counts +1, saves the name and starts follow-ups) or <b>Not now</b> (asks again after a day). Channels already in your lists are skipped. The script also remembers each channel\'s profile picture whenever you visit its page, so channels already in your lists get theirs the next time you open them. Your choice is delivered the next time the timer page is open.</p>' +
    '<h3>Highlighting and notes on web pages</h3>' +
    '<p>The Make Highlights &amp; Notes script lets you highlight text and attach notes on any page: <b>Alt+Shift+H</b> opens the panel, <b>Alt+Shift+N</b> sends a note to Url Notes.</p>';
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
    btn.type = 'button'; btn.className = 'ghost hbtn'; btn.id = 'helpBtn'; btn.textContent = '?'; btn.title = 'How to use'; btn.setAttribute('aria-label', 'How to use');
    var hdr = nav.parentNode, left = hdr.querySelector('.navleft');
    if (!left) { left = document.createElement('div'); left.className = 'navleft'; [].slice.call(hdr.children).forEach(function (c) { if (c !== nav) left.appendChild(c); }); hdr.insertBefore(left, nav); }
    left.appendChild(btn);
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
