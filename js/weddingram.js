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

  // Build a Drive preview URL that works in <img>
  function drivePreviewUrl(entry){
    if (entry && entry.fileId) {
      return 'https://drive.google.com/uc?export=view&id=' + entry.fileId;
    }
    if (entry && entry.webContentLink) {
      var m = entry.webContentLink.match(/[?&]id=([^&]+)/);
      if (m) return 'https://drive.google.com/uc?export=view&id=' + decodeURIComponent(m[1]);
      return entry.webContentLink;
    }
    return (entry && (entry.url || entry.link)) || '';
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

      if (entry.type === 'photo'){
        var img = document.createElement('img');
        img.src = entry.thumbnailLink || drivePreviewUrl(entry);
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
      } else if (entry.type === 'text'){
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
    // Hide caption at start
    captionIn.classList.add('hidden');
    photoInput.addEventListener('change', function(){
      // show/hide caption depending on selection
      if (photoInput.files && photoInput.files.length) {
        captionIn.classList.remove('hidden');
      } else {
        captionIn.classList.add('hidden');
      }
    });
  }

  // Message textarea appears only after clicking "Post a message"
  if (showMsgBtn && textForm){
    textForm.classList.add('hidden'); // ensure hidden on load
    showMsgBtn.addEventListener('click', function(){
      textForm.classList.remove('hidden');
      showMsgBtn.style.display = 'none';   // hide the button when form is visible
      if (msgIn) setTimeout(function(){ msgIn.focus(); }, 0);
    });
  }

  // Submit: photo + caption (multipart)
  if (photoForm){
    photoForm.addEventListener('submit', function(e){
      e.preventDefault();
      if (!photoInput.files || !photoInput.files.length) { setText(photoStatus, 'Choose a photo or video.'); return; }
      setText(photoStatus, 'Uploading…');

      var fd = new FormData();
      fd.append('action', 'wg_post');
      fd.append('caption', captionIn.value || '');
      fd.append('file', photoInput.files[0]);

      fetch(WEB_APP, { method:'POST', body: fd })
        .then(function(r){ return r && typeof r.json === 'function' ? r.json() : Promise.resolve(null); })
        .then(function(){
          setText(photoStatus, 'Thanks! Your post is live.');
        })
        .catch(function(){
          setText(photoStatus, 'Upload failed. Please try again.');
        })
        .finally(function(){
          // reset inputs
          photoInput.value = '';
          if (captionIn){ captionIn.value = ''; captionIn.classList.add('hidden'); }
          loadFeed();
        });
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
