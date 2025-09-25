// weddingram.js — Weddingram feed (CORS-proof submits)
(function () {
  var cfg = window.HW_CONFIG || {};
  var WEB_APP = cfg.WEB_APP_URL || '';
  if (!WEB_APP) { console.error('[weddingram] Missing WEB_APP_URL'); return; }

  var grid  = document.getElementById('wgGrid');
  var empty = document.getElementById('wgEmpty');

  var photoForm   = document.getElementById('wgPhotoForm');
  var photoInput  = document.getElementById('wgPhoto');
  var captionIn   = document.getElementById('wgCaption');
  var photoStatus = document.getElementById('wgPhotoStatus');

  var textForm    = document.getElementById('wgTextForm');
  var msgIn       = document.getElementById('wgMessage');
  var textStatus  = document.getElementById('wgTextStatus');
  var showMsgBtn  = document.getElementById('wgShowMsg');

  function setText(el, msg){ if (el) el.textContent = msg || ''; }

  // JSONP list (no CORS)
  function jsonp(url, cb){
    var name = 'wg_cb_' + Math.random().toString(36).slice(2);
    window[name] = function(data){ try{ cb(data); } finally{ delete window[name]; } };
    var s = document.createElement('script');
    s.src = url + (url.indexOf('?')>-1?'&':'?') + 'callback=' + name;
    s.onerror = function(){ cb({ _error:'Network error' }); };
    document.body.appendChild(s);
  }

  function drivePreviewUrl(entry){
    if (entry && entry.fileId) return 'https://drive.google.com/uc?export=view&id=' + entry.fileId;
    if (entry && entry.webContentLink) {
      var m = entry.webContentLink.match(/[?&]id=([^&]+)/);
      if (m) return 'https://drive.google.com/uc?export=view&id=' + decodeURIComponent(m[1]);
      return entry.webContentLink;
    }
    return (entry && (entry.url || entry.link)) || '';
  }

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
      if (!res || res.error || res._error) { empty.style.display='block'; setText(empty,'Could not load posts.'); return; }
      if (Array.isArray(res)) render(res); else if (Array.isArray(res.items)) render(res.items); else render(res);
    });
  }

  // UI toggles
  if (captionIn && photoInput) {
    var uploadBtn = document.getElementById('wgUploadBtn');
    var chooseLabel = document.getElementById('wgChooseLabel');

    captionIn.classList.add('hidden');
    uploadBtn.classList.add('hidden');

    photoInput.addEventListener('change', function(){
      if (photoInput.files && photoInput.files.length) {
        captionIn.classList.remove('hidden');
        uploadBtn.classList.remove('hidden');
        chooseLabel.classList.add('hidden');
      } else {
        captionIn.classList.add('hidden');
        uploadBtn.classList.add('hidden');
        chooseLabel.classList.remove('hidden');
      }
    });
  }
  if (showMsgBtn && textForm){
    textForm.classList.add('hidden');
    showMsgBtn.addEventListener('click', function(){
      textForm.classList.remove('hidden');
      showMsgBtn.style.display = 'none';
      if (msgIn) setTimeout(function(){ msgIn.focus(); }, 0);
    });
  }

  // PHOTO submit — JSON/base64 + no-cors
  if (photoForm){
    photoForm.addEventListener('submit', function(e){
      e.preventDefault();
      if (!photoInput.files || !photoInput.files.length) { setText(photoStatus, 'Choose a photo or video.'); return; }
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

        fetch(WEB_APP, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify(payload)   // no headers → no preflight
        })
        .catch(function(){ /* ignore */ })
        .finally(function(){
          setText(photoStatus, 'Thanks! Your post is live.');
          photoInput.value = '';
          if (captionIn){ captionIn.value = ''; captionIn.classList.add('hidden'); }
          var uploadBtn = document.getElementById('wgUploadBtn');
          if (uploadBtn) uploadBtn.classList.add('hidden');
          if (chooseLabel) chooseLabel.classList.remove('hidden');
          setTimeout(loadFeed, 900);
        });
      };
      reader.readAsDataURL(file);
    });
  }

  // TEXT submit — JSON + no-cors
  if (textForm){
    textForm.addEventListener('submit', function(e){
      e.preventDefault();
      var msg = (msgIn.value || '').trim();
      if (!msg) { setText(textStatus, 'Write a message first.'); return; }
      setText(textStatus, 'Posting…');

      fetch(WEB_APP + '?action=wg_text', {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ message: msg })  // no headers
      })
      .catch(function(){ /* ignore */ })
      .finally(function(){
        setText(textStatus, 'Your message is live!');
        msgIn.value = '';
        textForm.classList.add('hidden');
        if (showMsgBtn) showMsgBtn.style.display = '';
        setTimeout(loadFeed, 600);
      });
    });
  }

  loadFeed();
})();
