// dashboard.js
(function () {
  // ---- Config ----
  var cfg    = (window.HW_CONFIG || {});
  var WEB_APP = cfg.WEB_APP_URL || '';
  var TOKEN   = cfg.ADMIN_TOKEN || ''; // if empty, user will type it at login

  // ---- Elements ----
  var loginBtn       = document.getElementById('loginBtn');
  var pwdInput       = document.getElementById('pwd');
  var loginMsg       = document.getElementById('loginMsg');
  var loginSection   = document.getElementById('loginSection');
  var gallerySection = document.getElementById('gallerySection');
  var grid           = document.getElementById('grid');
  var empty          = document.getElementById('empty');
  var dlAllBtn       = document.getElementById('dlAll');
  var dlAllWrap      = document.getElementById('dlAllWrap');   // NEW

  if (!WEB_APP) {
    if (loginMsg) loginMsg.textContent = 'Missing WEB_APP_URL in js/config.js';
    console.error('[dashboard] Missing WEB_APP_URL');
    return;
  }

  if (dlAllWrap) dlAllWrap.classList.add('hidden');

  // Reuse one hidden iframe to trigger downloads without opening new tabs
  function triggerDownload(url){
    var f = document.getElementById('hwDlFrame');
    if (!f) {
      f = document.createElement('iframe');
      f.id = 'hwDlFrame';
      f.style.display = 'none';
      document.body.appendChild(f);
    }
    // cache-buster to ensure the request fires each time
    f.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'dlts=' + Date.now();
  }

  // ---- JSONP helper (avoids CORS for listing) ----
  function jsonp(url, cb) {
    var cbName = 'hw_cb_' + Math.random().toString(36).slice(2);
    window[cbName] = function (data) {
      try { cb(data); }
      finally {
        delete window[cbName];
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }
    };
    var script = document.createElement('script');
    script.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + cbName;
    script.onerror = function () { cb({ _error: 'Network error' }); };
    document.body.appendChild(script);
  }

  // ---- Render grid ----
  function render(items) {
    grid.innerHTML = '';
    var files = Array.isArray(items) ? items : [];

    if (!files.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    files.forEach(function (f) {
      var tile = document.createElement('div');
      tile.className = 'tile';

      var mediaWrap = document.createElement('div');
      mediaWrap.style.background = '#000';
      mediaWrap.style.height = '180px';
      mediaWrap.style.display = 'flex';
      mediaWrap.style.alignItems = 'center';
      mediaWrap.style.justifyContent = 'center';
      mediaWrap.style.overflow = 'hidden';

      var isImg = (f.mimeType || '').indexOf('image/') === 0;
      var isVid = (f.mimeType || '').indexOf('video/') === 0;

      if (isImg) {
        var img = document.createElement('img');
        img.src = f.thumbnailLink || f.webContentLink;
        img.alt = 'Photo';
        img.loading = 'lazy';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.referrerPolicy = 'no-referrer';
        img.onerror = function () {
          if (img.parentNode) img.parentNode.removeChild(img);
          var a = document.createElement('a');
          a.textContent = 'Open image';
          var fileUrl = WEB_APP + '?action=file&id=' + encodeURIComponent(f.id) +
                        '&token=' + encodeURIComponent(TOKEN) + '&download=true';
          a.href = fileUrl;
          a.style.color = '#fff';
          a.addEventListener('click', function(e){
            e.preventDefault();
            triggerDownload(fileUrl);
          });
          mediaWrap.appendChild(a);
        };        
        mediaWrap.appendChild(img);
      }
       else if (isVid) {
        var v = document.createElement('video');
        v.src = f.webContentLink;
        v.controls = true;
        v.style.maxWidth = '100%';
        v.style.maxHeight = '100%';
        v.onerror = function () {
          if (v.parentNode) v.parentNode.removeChild(v);
          var a2 = document.createElement('a');
          a2.textContent = 'Open video';
          var fileUrl = WEB_APP + '?action=file&id=' + encodeURIComponent(f.id) +
                        '&token=' + encodeURIComponent(TOKEN);
          a2.href = fileUrl;
          a2.style.color = '#fff';
          a2.addEventListener('click', function(e){
            e.preventDefault();
            triggerDownload(fileUrl);     // <-- use hidden iframe, no new tab
          });
          mediaWrap.appendChild(a2);
        };        
        mediaWrap.appendChild(v);
      } else {
        var span = document.createElement('span');
        span.textContent = f.name;
        span.style.color = '#fff';
        span.style.fontSize = '12px';
        mediaWrap.appendChild(span);
      }

      var bar = document.createElement('div');
      bar.className = 'tile-bar'; // styled in CSS
      bar.style.display = 'flex';
      bar.style.justifyContent = 'space-between';
      bar.style.alignItems = 'center';
      bar.style.padding = '8px 10px';
      bar.style.background = '#fff';
      bar.style.borderTop = '1px solid #eadfd7';

      var name = document.createElement('div');
      name.textContent = f.name;
      name.style.fontSize = '12px';
      name.style.overflow = 'hidden';
      name.style.whiteSpace = 'nowrap';
      name.style.textOverflow = 'ellipsis';
      name.style.maxWidth = '70%';

      var dl = document.createElement('a');
      dl.className = 'icon-btn';
      var fileUrl = WEB_APP + '?action=file&id=' + encodeURIComponent(f.id) + '&token=' + encodeURIComponent(TOKEN) + '&download=true';
      dl.href = fileUrl;
      dl.title = 'Download';

      // simple inline SVG (download)
      dl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9m0 0l4-4m-4 4L8 8M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      dl.addEventListener('click', function(e){
        e.preventDefault();
        triggerDownload(fileUrl);
      });

      bar.appendChild(dl);
      tile.appendChild(mediaWrap);
      tile.appendChild(bar);
      grid.appendChild(tile);
    });
  }

  // ---- Load list ----
  function loadList() {
    var url = WEB_APP + '?action=list&token=' + encodeURIComponent(TOKEN) + '&ts=' + Date.now();
    jsonp(url, function (res) {
      if (!res) {
        if (loginMsg) loginMsg.textContent = 'No response from server.';
        return;
      }
      if (res.error) {
        if (loginMsg) loginMsg.textContent = 'Auth error: ' + res.error;
        return;
      }
      render(res);
    });
  }

  // ---- Download all (ZIP) ----
  if (dlAllBtn) {
    dlAllBtn.addEventListener('click', function () {
      if (!TOKEN) { alert('Please login first.'); return; }
      var zipUrl = WEB_APP + '?action=zip&token=' + encodeURIComponent(TOKEN);
      triggerDownload(zipUrl);
    });
  }

  // ---- Login flow ----
  function doLogin() {
    if (!WEB_APP) { alert('WEB_APP_URL missing in js/config.js'); return; }

    if (!TOKEN) {
      var typed = (pwdInput && pwdInput.value) || '';
      if (!typed) { if (loginMsg) loginMsg.textContent = 'Enter password.'; return; }
      TOKEN = typed.trim(); // keep for this session
    } else {
      if (pwdInput && pwdInput.value && pwdInput.value !== TOKEN) {
        if (loginMsg) loginMsg.textContent = 'Incorrect password.';
        return;
      }
    }

    if (loginSection)  loginSection.style.display = 'none';
    if (gallerySection) {
      gallerySection.classList.remove('hidden');  // <-- important
      gallerySection.style.display = 'block';
    }
    if (dlAllWrap) dlAllWrap.classList.remove('hidden'); // <-- show ZIP button after login
    loadList();
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', doLogin);
  }
  if (pwdInput) {
    // Allow pressing Enter in the password field
    pwdInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doLogin();
      }
    });
  }
})();
