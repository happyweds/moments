// weddingram.js — Weddingram feed (single-column + better form toggling)
(function () {
  var cfg = window.HW_CONFIG || {};
  var WEB_APP = cfg.WEB_APP_URL || '';
  if (!WEB_APP) { console.error('[weddingram] Missing WEB_APP_URL'); return; }

  // Feed
  var grid  = document.getElementById('wgGrid');
  var empty = document.getElementById('wgEmpty');

  // Photo form
  var photoForm    = document.getElementById('wgPhotoForm');
  var photoInput   = document.getElementById('wgPhoto');
  var captionIn    = document.getElementById('wgCaption');
  var photoStatus  = document.getElementById('wgPhotoStatus');
  var photoLabel   = document.getElementById('wgPhotoLabel');   // NEW
  var uploadBtn    = document.getElementById('wgUploadBtn');    // NEW

  // Text form
  var textForm    = document.getElementById('wgTextForm');
  var msgIn       = document.getElementById('wgMessage');
  var textStatus  = document.getElementById('wgTextStatus');
  var showMsgBtn  = document.getElementById('wgShowMsg');

  function setText(el, msg){ if (el) el.textContent = msg || ''; }

  // JSONP for list
  function jsonp(url, cb){
    var name = 'wg_cb_' + Math.random().toString(36).slice(2);
    window[name] = function(data){ try{ cb(data); } finally{ delete window[name]; } };
    var s = document.createElement('script');
    s.src = url + (url.indexOf('?')>-1?'&':'?') + 'callback=' + name;
    s.onerror = function(){ cb({ _error:'Network error' }); };
    document.body.appendChild(s);
  }

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

      if (entry.type === 'photo' || entry.type === 'video'){
        var media;
        if (entry.type === 'video') {
          media = document.createElement('video');
          media.controls = true;
        } else {
          media = document.createElement('img');
        }
        media.src = entry.thumbnailLink || drivePreviewUrl(entry);
        media.alt = 'Photo';
        media.loading = 'lazy';
        media.referrerPolicy = 'no-referrer';
        tile.appendChild(media);

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
      if (!res || res.error || res._error) {
        empty.style.display = 'block';
        setText(empty, 'Could not load posts.');
        return;
      }
      render(Array.isArray(res) ? res : (res.items || []));
    });
  }

  /* ---------- UI toggles for photo form ---------- */

  // Start with caption + upload hidden
  if (captionIn) captionIn.classList.add('hidden');
  if (uploadBtn) uploadBtn.classList.add('hidden');

  // When a file is selected: show caption + Upload button
  if (photoInput){
    photoInput.addEventListener('change', function(){
      var hasFile = photoInput.files && photoInput.files.length > 0;
      if (captionIn) captionIn.classList.toggle('hidden', !hasFile);
      if (uploadBtn)  uploadBtn.classList.toggle('hidden', !hasFile);

      // Optional: reflect choice on the label
      if (photoLabel){
        if (hasFile) {
          var f = photoInput.files[0];
          photoLabel.textContent = '📸 ' + (f && f.name ? f.name : '1 file selected');
        } else {
          photoLabel.textContent = '📸 Choose a photo / video';
        }
      }
    });
  }

  // Message textarea appears only after clicking "Post a message"
  if (showMsgBtn && textForm){
    textForm.classList.add('hidden'); // hidden on load
    showMsgBtn.addEventListener('click', function(){
      textForm.classList.remove('hidden');
      showMsgBtn.style.display = 'none';
      msgIn && setTimeout(function(){ msgIn.focus(); }, 0);
    });
  }

  // Submit: photo + caption (multipart)
  if (photoForm){
    photoForm.addEventListener('submit', function(e){
      e.preventDefault();
      if (!photoInput.files || !photoInput.files.length) {
        setText(photoStatus, 'Choose a photo or video.');
        return;
      }

      // Disable & show uploading state
      if (uploadBtn){
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Uploading…';
      }
      setText(photoStatus, '');

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
          // Reset inputs + hide caption & Upload
          photoInput.value = '';
          if (captionIn){ captionIn.value = ''; captionIn.classList.add('hidden'); }
          if (uploadBtn){
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload';
            uploadBtn.classList.add('hidden');     // hide after upload
          }
          if (photoLabel){ photoLabel.textContent = '📸 Choose a photo / video'; }
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
        msgIn.value = '';
        textForm.classList.add('hidden');
        if (showMsgBtn) showMsgBtn.style.display = '';
        loadFeed();
      });
    });
  }

  loadFeed(); // initial
})();
