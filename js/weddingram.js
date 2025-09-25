// weddingram.js — Weddingram feed (single-column + better form toggling)
(function () {
  var cfg = window.HW_CONFIG || {};
  var WEB_APP = cfg.WEB_APP_URL || '';
  if (!WEB_APP) { console.error('[weddingram] Missing WEB_APP_URL'); return; }

  // Feed
  var grid  = document.getElementById('wgGrid');
  var empty = document.getElementById('wgEmpty');

  // Photo form
  var photoForm   = document.getElementById('wgPhotoForm');
  var photoInput  = document.getElementById('wgPhoto');
  var captionIn   = document.getElementById('wgCaption');
  var photoStatus = document.getElementById('wgPhotoStatus');

  // Text form
  var textForm    = document.getElementById('wgTextForm');
  var msgIn       = document.getElementById('wgMessage');
  var textStatus  = document.getElementById('wgTextStatus');
  var showMsgBtn  = document.getElementById('wgShowMsg'); // "Post a message" gold button

  // Small helper
  function setText(el, msg){ if (el) el.textContent = msg || ''; }

  // JSONP (for list)
  function jsonp(url, cb){
    var name = 'wg_cb_' + Math.random().toString(36).slice(2);
    window[name] = function(data){ try{ cb(data); } finally{ delete window[name]; } };
    var s = document.createElement('script');
    s.src = url + (url.indexOf('?')>-1?'&':'?') + 'callback=' + name;
    s.onerror = function(){ cb({ _error:'Network error' }); };
    document.body.appendChild(s);
  }

  // Drive preview helpers
  function asPreviewUrlFromContent(link){
    // Converts ...uc?export=download&id=XYZ to ...uc?export=view&id=XYZ
    if (!link) return '';
    var m = link.match(/[?&]id=([^&]+)/);
    if (m) return 'https://drive.google.com/uc?export=view&id=' + decodeURIComponent(m[1]);
    return link;
  }
  function previewSrc(entry){
    // Prefer backend-provided fields from your updated Apps Script
    // For images: use thumbnailLink (fast, static), else viewLink
    if (entry.type === 'photo') {
      return entry.thumbnailLink || entry.viewLink || asPreviewUrlFromContent(entry.webContentLink);
    }
    // For videos: use viewLink (streamable)
    if (entry.type === 'video') {
      return entry.viewLink || asPreviewUrlFromContent(entry.webContentLink);
    }
    // Fallbacks
    return entry.viewLink || asPreviewUrlFromContent(entry.webContentLink) || '';
  }

  // Render feed (single column)
  function render(items){
    grid.innerHTML = '';
    var list = Array.isArray(items) ? items : [];
    if (!list.length){ empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    list.forEach(function(entry){
      var tile = document.createElement('div');
      tile.className = 'wg-tile';

      // normalize type based on mimeType if present
      var t = entry.type || '';
      if (!t && entry.mimeType) {
        t = entry.mimeType.indexOf('video/') === 0 ? 'video'
          : entry.mimeType.indexOf('image/') === 0 ? 'photo' : 'text';
      }

      if (t === 'photo') {
        var img = document.createElement('img');
        img.src = previewSrc(entry);
        img.alt = 'Photo';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        tile.appendChild(img);

        if (entry.caption){
          var cap = document.createElement('div');
          cap.className = 'wg-cap';
          cap.textContent = entry.caption;
          tile.appendChild(cap);
        }
      }
      else if (t === 'video') {
        var v = document.createElement('video');
        v.src = previewSrc(entry);
        v.controls = true;
        v.preload = 'metadata';
        v.style.maxWidth = '100%';
        v.style.maxHeight = '100%';
        tile.appendChild(v);

        if (entry.caption){
          var cap2 = document.createElement('div');
          cap2.className = 'wg-cap';
          cap2.textContent = entry.caption;
          tile.appendChild(cap2);
        }
      }
      else if (t === 'text') {
        tile.classList.add('wg-text');
        var p = document.createElement('p');
        p.textContent = entry.caption || '';
        tile.appendChild(p);
      }

      grid.appendChild(tile);
    });
  }

  function loadFeed(){
    jsonp(WEB_APP + '?action=wg_list&ts=' + Date.now(), function(res){
      if (!res) {
        empty.style.display = 'block'; setText(empty, 'Could not load posts.'); return;
      }
      if (Array.isArray(res)) {
        render(res); return;
      }
      if (Array.isArray(res.items)) {
        render(res.items); return;
      }
      if (res.error || res._error) {
        empty.style.display = 'block'; setText(empty, 'Could not load posts.'); return;
      }
      // Fallback: try to render what we got
      render(res);
    });
  }

  // ---- UI toggles ----

  // Show caption only after a file is picked
  if (captionIn && photoInput) {
    captionIn.classList.add('hidden'); // hidden on load
    photoInput.addEventListener('change', function(){
      if (photoInput.files && photoInput.files.length) {
        captionIn.classList.remove('hidden');
      } else {
        captionIn.classList.add('hidden');
      }
    });
  }

  // Message textarea appears only after clicking "Post a message"
  if (showMsgBtn && textForm){
    textForm.classList.add('hidden'); // hidden on load
    showMsgBtn.addEventListener('click', function(){
      textForm.classList.remove('hidden');
      showMsgBtn.style.display = 'none';   // hide the button when form is visible
      if (msgIn) setTimeout(function(){ msgIn.focus(); }, 0);
    });
  }

  // Submit: photo + caption (JSON/base64, robust cross-origin)
  if (photoForm) {
    photoForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!photoInput.files || !photoInput.files.length) {
        setText(photoStatus, 'Choose a photo or video.');
        return;
      }
      setText(photoStatus, 'Uploading…');

      var file = photoInput.files[0];
      var reader = new FileReader();
      reader.onload = function (ev) {
        var dataUrl = String(ev.target.result || '');
        var base64  = dataUrl.split(',')[1] || '';

        var payload = {
          action:   'wg_post',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileData: base64,
          caption:  captionIn.value || ''
        };

        // We don’t need to read the response; this avoids CORS headaches
        fetch(WEB_APP, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .catch(function(){ /* ignore */ })
        .finally(function () {
          setText(photoStatus, 'Thanks! Your post is live (refresh in a moment).');
          photoInput.value = '';
          if (captionIn) { captionIn.value = ''; captionIn.classList.add('hidden'); }
          // give Apps Script a moment, then refresh feed
          setTimeout(loadFeed, 800);
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // Submit: text-only message (JSON)
  if (textForm){
    textForm.addEventListener('submit', function(e){
      e.preventDefault();
      var msg = (msgIn.value || '').trim();
      if (!msg) { setText(textStatus, 'Write a message first.'); return; }
      setText(textStatus, 'Posting…');

      fetch(WEB_APP + '?action=wg_text', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ message: msg })
      })
      .then(function(r){ return r && typeof r.json === 'function' ? r.json() : Promise.resolve(null); })
      .then(function(){
        setText(textStatus, 'Your message is live!');
      })
      .catch(function(){
        setText(textStatus, 'Failed to post. Please try again.');
      })
      .finally(function(){
        // reset + hide form + show button again
        msgIn.value = '';
        textForm.classList.add('hidden');
        if (showMsgBtn) showMsgBtn.style.display = '';
        loadFeed();
      });
    });
  }

  loadFeed(); // initial
})();
