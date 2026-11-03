// Chrono47 Pitch — small helpers. The page reads fine without this file;
// it adds the YouTube embeds, the looping video popup, image slots and the live email link.

(function () {
  'use strict';

  var body = document.body;
  var whatsapp = (body.getAttribute('data-whatsapp') || '').replace(/\D/g, '');   // only used by the booking widget
  var email = (body.getAttribute('data-email') || '').trim();

  // Accepts a bare 11-character ID or any normal YouTube link.
  function parseYouTubeId(value) {
    value = (value || '').trim();
    if (!value) return '';
    if (/^[\w-]{11}$/.test(value)) return value;
    var m = value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : '';
  }

  function mainVideoId() {
    return parseYouTubeId(body.getAttribute('data-youtube-id'));
  }

  function embedUrl(id, params) {
    var query = Object.keys(params).map(function (key) {
      return key + '=' + encodeURIComponent(params[key]);
    }).join('&');
    return 'https://www.youtube-nocookie.com/embed/' + id + (query ? '?' + query : '');
  }

  function formatTime(total) {
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function toSeconds(value) {
    var n = parseInt(value, 10);
    return isNaN(n) || n < 0 ? null : n;
  }

  // 1. Hero: load the YouTube video and hide the placeholder.
  var hero = document.getElementById('hero-video');
  var placeholder = document.getElementById('video-placeholder');
  var heroId = mainVideoId();
  if (hero && heroId) {
    hero.src = embedUrl(heroId, { rel: 0, playsinline: 1 });
    if (placeholder) placeholder.classList.add('is-hidden');
  }

  // 2. Show GIFs and screenshots only when the file exists; otherwise the labelled slot stays.
  document.querySelectorAll('.frame__img').forEach(function (img) {
    var frame = img.closest('.frame');
    var show = function () {
      img.hidden = false;
      if (frame) frame.classList.add('has-image');
    };
    if (img.complete && img.naturalWidth > 0) {
      show();
    } else {
      img.addEventListener('load', show);
    }
  });

  // 3. Breakdown frames: write the timestamp from data-start / data-end.
  document.querySelectorAll('.frame--play').forEach(function (frame) {
    var start = toSeconds(frame.getAttribute('data-start'));
    var end = toSeconds(frame.getAttribute('data-end'));
    var stamp = frame.querySelector('.frame__stamp');
    if (!stamp || start === null) return;
    stamp.textContent = end !== null && end > start
      ? formatTime(start) + ' – ' + formatTime(end)
      : formatTime(start);
  });

  // 4. Video popup with looping.
  //    Opens the video at data-start. When playback reaches data-end it jumps back
  //    to data-start, over and over, until the popup is closed.
  //    Uses the official YouTube player API (loaded the first time a popup opens).
  var modal = document.getElementById('video-modal');
  var modalScreen = modal ? modal.querySelector('.modal__screen') : null;
  var modalStamp = document.getElementById('modal-stamp');
  var modalEmpty = document.getElementById('modal-empty');
  var modalClose = document.getElementById('modal-close');

  var apiState = 'idle';          // idle | loading | ready | failed
  var apiWaiting = [];
  var player = null;
  var playerReady = false;
  var pending = null;             // a video requested before the player finished loading
  var timer = null;
  var loop = { start: 0, end: null };
  var fallbackFrame = null;

  function loadYouTubeApi(onReady, onFail) {
    if (window.YT && window.YT.Player) { onReady(); return; }
    if (apiState === 'failed') { onFail(); return; }
    apiWaiting.push({ ok: onReady, fail: onFail });
    if (apiState === 'loading') return;
    apiState = 'loading';

    var previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previous === 'function') previous();
      apiState = 'ready';
      apiWaiting.splice(0).forEach(function (w) { w.ok(); });
    };

    var script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = function () {
      apiState = 'failed';
      apiWaiting.splice(0).forEach(function (w) { w.fail(); });
    };
    document.head.appendChild(script);
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  // Check the playhead a few times a second; at data-end, jump back to data-start.
  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (!playerReady || loop.end === null) return;
      if (player.getPlayerState() !== 1) return;              // 1 = playing
      if (player.getCurrentTime() >= loop.end) player.seekTo(loop.start, true);
    }, 150);
  }

  function onPlayerReady() {
    playerReady = true;
    if (!modal.open) { player.stopVideo(); return; }          // popup was closed while loading
    if (pending) { player.loadVideoById(pending); pending = null; }
  }

  function onPlayerState(event) {
    // Safety net: if the video really ends (no data-end, or data-end is the last second), restart it.
    if (event.data === 0 && modal.open) {                     // 0 = ended
      player.seekTo(loop.start, true);
      player.playVideo();
    }
  }

  function playInPlayer(id, start) {
    if (!player) {
      var vars = { autoplay: 1, rel: 0, playsinline: 1, start: start };
      if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
      player = new window.YT.Player('modal-player', {
        host: 'https://www.youtube-nocookie.com',
        videoId: id,
        playerVars: vars,
        events: { onReady: onPlayerReady, onStateChange: onPlayerState }
      });
      return;
    }
    var request = { videoId: id, startSeconds: start };
    if (playerReady) { player.loadVideoById(request); } else { pending = request; }
  }

  // If the YouTube player API cannot load, show a plain embed (it plays the range once, without looping).
  function showFallback(id, start, end) {
    removeFallback();
    var params = { autoplay: 1, rel: 0, playsinline: 1 };
    if (start !== null) params.start = start;
    if (end !== null && (start === null || end > start)) params.end = end;
    var frame = document.createElement('iframe');
    frame.src = embedUrl(id, params);
    frame.title = 'Video at the referenced moment';
    frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
    frame.setAttribute('allowfullscreen', '');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    modalScreen.appendChild(frame);
    fallbackFrame = frame;
  }

  function removeFallback() {
    if (fallbackFrame && fallbackFrame.parentNode) fallbackFrame.parentNode.removeChild(fallbackFrame);
    fallbackFrame = null;
  }

  function openVideo(frame) {
    var id = parseYouTubeId(frame.getAttribute('data-video')) || mainVideoId();
    var start = toSeconds(frame.getAttribute('data-start'));
    var end = toSeconds(frame.getAttribute('data-end'));
    var from = start === null ? 0 : start;

    loop.start = from;
    loop.end = (end !== null && end > from) ? end : null;

    var label = start === null
      ? 'Video'
      : (loop.end !== null
          ? formatTime(from) + ' – ' + formatTime(loop.end)
          : 'From ' + formatTime(from));

    // Very old browsers without <dialog>: open the video in a new tab instead.
    if (!modal || typeof modal.showModal !== 'function') {
      if (id) window.open(embedUrl(id, { autoplay: 1, rel: 0, start: from }), '_blank', 'noopener,noreferrer');
      return;
    }

    if (modalStamp) modalStamp.textContent = label;
    modal.showModal();

    if (!id) {
      modalEmpty.hidden = false;
      return;
    }
    modalEmpty.hidden = true;

    loadYouTubeApi(
      function () {
        if (!modal.open) return;
        playInPlayer(id, from);
        startTimer();
      },
      function () {
        if (modal.open) showFallback(id, start, end);
      }
    );
  }

  document.querySelectorAll('.frame--play').forEach(function (frame) {
    frame.addEventListener('click', function () { openVideo(frame); });
  });

  if (modal) {
    // Stop playback whenever the popup closes (Esc, Close button or backdrop click).
    modal.addEventListener('close', function () {
      stopTimer();
      pending = null;
      if (player && playerReady) player.stopVideo();
      removeFallback();
    });
    if (modalClose) modalClose.addEventListener('click', function () { modal.close(); });
    // A click on the dark backdrop lands on the <dialog> itself.
    modal.addEventListener('click', function (event) {
      if (event.target === modal) modal.close();
    });
  }

  // 5. Contact: fill the email link from data-email on <body>.
  var mailLink = document.getElementById('contact-email');
  if (mailLink && email) {
    mailLink.href = 'mailto:' + email;
    var mailValue = mailLink.querySelector('[data-value]');
    if (mailValue) mailValue.textContent = email;
  }

  // 6. Booking widget (currently commented out in index.html): the time picker
  //    writes the chosen slot into the WhatsApp and email requests.
  var slots = document.querySelectorAll('.slot');
  var picked = document.getElementById('picked');
  var reqWhatsapp = document.getElementById('request-whatsapp');
  var reqEmail = document.getElementById('request-email');

  function currentSlot() {
    var on = document.querySelector('.slot[aria-pressed="true"]');
    return on ? on.textContent.trim() : '';
  }

  function updateRequests() {
    var slot = currentSlot();
    if (picked) picked.textContent = slot || 'none';

    var message = 'Hi! I watched your edit and would like to talk about my next video. Could we do ' + slot + '?';

    if (reqWhatsapp) {
      if (whatsapp.length >= 8 && slot) {
        reqWhatsapp.href = 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(message);
        reqWhatsapp.target = '_blank';
        reqWhatsapp.rel = 'noopener noreferrer';
      } else {
        reqWhatsapp.href = '#book';
        reqWhatsapp.removeAttribute('target');
      }
    }

    if (reqEmail) {
      if (email && slot) {
        reqEmail.href = 'mailto:' + email +
          '?subject=' + encodeURIComponent('Call request: ' + slot) +
          '&body=' + encodeURIComponent(message);
      } else {
        reqEmail.href = '#book';
      }
    }
  }

  slots.forEach(function (slot) {
    slot.addEventListener('click', function () {
      slots.forEach(function (other) { other.setAttribute('aria-pressed', 'false'); });
      slot.setAttribute('aria-pressed', 'true');
      updateRequests();
    });
  });

  updateRequests();
})();
