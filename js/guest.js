// guest.js — JSON/base64 uploader for cross-origin uploads
(function () {
  var cfg       = window.HW_CONFIG || {};
  var WEB_APP   = cfg.WEB_APP_URL || '';

  var form      = document.getElementById('uploadForm');
  var picker    = document.getElementById('picker');
  var statusEl  = document.getElementById('status');
  var resetBtn  = document.getElementById('resetBtn');
  var chosenTxt = document.getElementById('chosenText');
  // Try to find the submit button in the form
  var submitBtn = form ? form.querySelector('button[type="submit"], .btn[type="submit"]') : null;

  if (!WEB_APP) {
    console.error('[guest] Missing WEB_APP_URL in js/config.js');
    if (statusEl) statusEl.textContent = 'Configuration error.';
    return;
  }

  function setStatus(msg){ if (statusEl) statusEl.textContent = msg; }

  // Update the "chosen files" text when user picks files
  if (picker) {
    picker.addEventListener('change', function () {
      var count = (picker.files && picker.files.length) ? picker.files.length : 0;
      if (chosenTxt) {
        chosenTxt.textContent = count
          ? (count + ' file' + (count === 1 ? '' : 's') + ' selected')
          : 'No files selected yet.';
      }
      // enable/disable submit depending on selection
      if (submitBtn) submitBtn.disabled = (count === 0);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      if (picker) picker.value = '';
      if (chosenTxt) chosenTxt.textContent = 'No files selected yet.';
      setStatus('');
      if (submitBtn) submitBtn.disabled = true;
    });
  }

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!picker || !picker.files || !picker.files.length) {
      alert('Please choose at least one photo or video.');
      return;
    }

    var files = Array.prototype.slice.call(picker.files);
    var total = files.length;
    var done  = 0;

    setStatus('Uploading ' + total + ' file' + (total > 1 ? 's' : '') + '…');
    if (submitBtn) submitBtn.disabled = true;

    files.forEach(function (file) {
      // Optional size guard (~50MB practical limit per request)
      var MAX_MB = 50;
      if (file.size > MAX_MB * 1024 * 1024) {
        done++;
        setStatus('Skipped large file: ' + file.name + ' (' + Math.round(file.size/1e6) + 'MB)');
        if (done >= total) {
          if (submitBtn) submitBtn.disabled = false;
        }
        return;
      }

      var reader = new FileReader();
      reader.onload = function (ev) {
        var dataUrl = String(ev.target.result || '');
        var base64  = dataUrl.split(',')[1] || '';  // strip "data:...;base64,"

        var payload = {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          fileData: base64
        };

        fetch(WEB_APP, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .catch(function(){ /* ignore; upload happens server-side */ })
        .finally(function () {
          done++;
          if (done >= total) {
            setStatus('Thanks! Your files were uploaded.');
            if (picker) picker.value = '';
            if (chosenTxt) chosenTxt.textContent = 'No files selected yet.';
            if (submitBtn) submitBtn.disabled = false;
          } else {
            setStatus('Uploaded ' + done + '/' + total + '…');
          }
        });
      };
      reader.readAsDataURL(file);
    });
  });

  // Initial state
  if (submitBtn) submitBtn.disabled = true;
})();
