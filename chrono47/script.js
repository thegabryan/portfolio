// Diamond District Pitch — small helpers. The page works without this file;
// it only adds the video placeholder handling, image slots, the time picker and live contact links.

(function () {
  'use strict';

  var body = document.body;
  var whatsapp = (body.getAttribute('data-whatsapp') || '').replace(/\D/g, '');
  var email = (body.getAttribute('data-email') || '').trim();

  // 1. Hide the video placeholder once a real video file has loaded.
  var video = document.querySelector('.player video');
  var placeholder = document.getElementById('video-placeholder');
  if (video && placeholder) {
    var hidePlaceholder = function () { placeholder.classList.add('is-hidden'); };
    video.addEventListener('loadedmetadata', hidePlaceholder);
    if (video.readyState >= 1) hidePlaceholder();
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

  // 3. Contact row: fill links from the data attributes on <body>.
  var waLink = document.getElementById('contact-whatsapp');
  var mailLink = document.getElementById('contact-email');

  if (waLink && whatsapp.length >= 8) {
    waLink.href = 'https://wa.me/' + whatsapp;
    waLink.target = '_blank';
    waLink.rel = 'noopener';
    var waValue = waLink.querySelector('[data-value]');
    if (waValue) waValue.textContent = '+' + whatsapp;
  }

  if (mailLink && email) {
    mailLink.href = 'mailto:' + email;
    var mailValue = mailLink.querySelector('[data-value]');
    if (mailValue) mailValue.textContent = email;
  }

  // 4. Time picker: selecting a slot writes it into the WhatsApp and email requests.
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
        reqWhatsapp.rel = 'noopener';
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
