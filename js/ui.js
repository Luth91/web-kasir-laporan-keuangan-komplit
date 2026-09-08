/* ============================================================
 * UI — notifikasi & konfirmasi animasi kustom (tanpa bawaan browser)
 * - toast(msg, type) : success | error | warning | info
 * - UI.confirm({title, message, confirmText, cancelText, tone})
 *   -> Promise<boolean>, dialog pop-up animasi (ESC / klik luar = batal)
 * Kompatibel: pemanggilan toast('...') lama tetap jalan, tipe
 * dideteksi otomatis dari isi pesan (⚠️ / ✓ / gagal).
 * ============================================================ */
var UI = (function () {
  'use strict';

  var MAX_STACK = 4;
  var DEFAULT_MS = 2600;

  var ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

  function detectType(msg) {
    var s = String(msg || '');
    if (/batal|hapus/i.test(s) && /✓/.test(s) === false) return 'info';
    if (/tidak cukup|habis|kurang|wajib|harus|⚠/.test(s)) return 'warning';
    if (/✓|tersimpan|berhasil|ditambahkan|lunas/i.test(s)) return 'success';
    if (/gagal|error/i.test(s)) return 'error';
    return 'info';
  }

  function ensureStack() {
    var stack = document.getElementById('toastStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'toastStack';
      document.body.appendChild(stack);
    }
    return stack;
  }

  function show(msg, type, ms) {
    var stack = ensureStack();
    type = type || detectType(msg);
    ms = ms || DEFAULT_MS;

    while (stack.children.length >= MAX_STACK) stack.removeChild(stack.firstChild);

    var el = document.createElement('div');
    el.className = 'ui-toast ui-toast-' + type;
    el.setAttribute('role', 'status');
    el.innerHTML =
      '<span class="ui-toast-icon">' + (ICONS[type] || ICONS.info) + '</span>' +
      '<span class="ui-toast-msg"></span>' +
      '<span class="ui-toast-bar"></span>';
    el.querySelector('.ui-toast-msg').textContent = String(msg || '');
    stack.appendChild(el);

    var bar = el.querySelector('.ui-toast-bar');
    bar.style.animationDuration = ms + 'ms';

    var timer = null, start = Date.now(), remaining = ms, done = false;

    function dismiss() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.classList.add('leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 240);
    }
    function arm(delay) {
      clearTimeout(timer);
      start = Date.now();
      timer = setTimeout(dismiss, delay);
    }
    el.addEventListener('mouseenter', function () {
      clearTimeout(timer);
      remaining -= Date.now() - start;
      bar.style.animationPlayState = 'paused';
    });
    el.addEventListener('mouseleave', function () {
      bar.style.animationPlayState = 'running';
      arm(Math.max(remaining, 400));
    });
    el.addEventListener('click', dismiss);
    arm(ms);
    return dismiss;
  }

  /* ---------- Dialog konfirmasi animasi ---------- */

  var confirmState = null;

  function getModal() {
    return {
      root: document.getElementById('confirmModal'),
      icon: document.getElementById('confirmIcon'),
      title: document.getElementById('confirmTitle'),
      message: document.getElementById('confirmMessage'),
      ok: document.getElementById('confirmOk'),
      cancel: document.getElementById('confirmCancel')
    };
  }

  function closeConfirm(value) {
    var m = getModal();
    if (!m.root || !confirmState) return;
    var resolve = confirmState.resolve;
    confirmState = null;
    m.root.classList.remove('ui-open');
    document.removeEventListener('keydown', onEsc);
    setTimeout(function () { m.root.classList.add('hidden'); }, 180);
    resolve(value);
  }

  function onEsc(e) {
    if (e.key === 'Escape') closeConfirm(false);
  }

  function confirmDlg(opts) {
    opts = opts || {};
    var m = getModal();
    if (!m.root) return Promise.resolve(window.confirm(opts.message || 'Lanjutkan?'));

    // Jika ada dialog terbuka, selesaikan dulu sebagai batal
    if (confirmState) closeConfirm(false);

    var tone = opts.tone === 'danger' ? 'danger' : 'primary';
    m.icon.textContent = tone === 'danger' ? '!' : '?';
    m.icon.className = 'ui-confirm-icon ui-confirm-' + tone;
    m.title.textContent = opts.title || 'Konfirmasi';
    m.message.textContent = opts.message || 'Apakah Anda yakin?';
    m.ok.textContent = opts.confirmText || 'Ya, lanjutkan';
    m.ok.className = 'ui-confirm-ok ui-confirm-ok-' + tone;
    m.cancel.textContent = opts.cancelText || 'Batal';

    m.root.classList.remove('hidden');
    // paksa reflow agar animasi pop berjalan ulang tiap dibuka
    void m.root.offsetWidth;
    m.root.classList.add('ui-open');
    setTimeout(function () { try { m.ok.focus(); } catch (e) {} }, 60);

    return new Promise(function (resolve) {
      confirmState = { resolve: resolve };
      m.ok.onclick = function () { closeConfirm(true); };
      m.cancel.onclick = function () { closeConfirm(false); };
      document.addEventListener('keydown', onEsc);
    });
  }

  // klik backdrop = batal
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'confirmModal' && confirmState) closeConfirm(false);
  });

  return {
    toast: show,
    success: function (msg, ms) { return show(msg, 'success', ms); },
    error: function (msg, ms) { return show(msg, 'error', ms); },
    warning: function (msg, ms) { return show(msg, 'warning', ms); },
    info: function (msg, ms) { return show(msg, 'info', ms); },
    confirm: confirmDlg
  };
})();

/* API global — kompatibel dgn pemanggilan lama toast('pesan') */
function toast(msg, type) { return UI.toast(msg, type); }
toast.success = function (msg, ms) { return UI.success(msg, ms); };
toast.error = function (msg, ms) { return UI.error(msg, ms); };
toast.warning = function (msg, ms) { return UI.warning(msg, ms); };
toast.info = function (msg, ms) { return UI.info(msg, ms); };
