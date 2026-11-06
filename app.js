/* Bund Wall Calculator – app controller */
(function () {
  'use strict';
  var APP_VERSION = '1.0.0';
  var PAGES_URL = 'https://m9r1u5.github.io/Bund-Wall-Calculator/';
  var APK_URL = 'https://github.com/m9r1u5/Bund-Wall-Calculator/releases/latest/download/BundWallCalculator.apk';
  var KEY = 'bwc.current', PKEY = 'bwc.projects', TKEY = 'bwc.theme';
  var Cap = window.Capacitor;
  var isNative = !!window.androidBridge || !!(Cap && (Cap.isNativePlatform ? Cap.isNativePlatform() : (Cap.getPlatform && Cap.getPlatform() !== 'web')));
  // Call a native Capacitor plugin without a bundler
  function nat(plugin, method, opts) {
    var p = Cap && Cap.Plugins && Cap.Plugins[plugin];
    if (p && typeof p[method] === 'function') return p[method](opts);
    if (Cap && Cap.nativePromise) return Cap.nativePromise(plugin, method, opts);
    return Promise.reject(new Error('Native ' + plugin + ' not available'));
  }

  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function fx(v, d) { return isFinite(v) ? (+v).toFixed(d == null ? 3 : d) : '–'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, 2600); }

  var P = store(KEY) || BWC.defaultProject();
  var R = null;
  var view = { az: -28, el: 24 };
  var page = 'tanks';

  function getK(k) { return k.split('.').reduce(function (o, p) { return o == null ? o : o[p]; }, P); }
  function setK(k, v) { var a = k.split('.'), o = P; for (var i = 0; i < a.length - 1; i++) o = o[a[i]] = o[a[i]] || {}; o[a[a.length - 1]] = v; }
  function save() { store(KEY, P); }

  /* ---------- Tank rows ---------- */
  function renderRows() {
    var html = '';
    P.rows.forEach(function (row, ri) {
      var c = BWDraw.rowColor(ri);
      html += '<div class="card" data-row="' + ri + '"><div class="rowhead"><span class="dot" style="background:' + c.side + '"></span>' +
        '<input type="text" value="' + esc(row.name) + '" data-rn="' + ri + '" aria-label="Row name">' +
        (P.rows.length > 1 ? '<button class="x" data-delrow="' + ri + '" title="Remove row">✕</button>' : '') + '</div>' +
        '<div class="tkh"><span>Tank</span><span>Ø D (m)</span><span>Height (m)</span><span>Vol. override</span><span></span></div>';
      row.tanks.forEach(function (t, ti) {
        html += '<div class="tk"><span class="no" data-no="' + ri + '-' + ti + '">T?</span>' +
          '<input type="number" inputmode="decimal" step="any" value="' + esc(t.d) + '" data-t="' + ri + '-' + ti + '-d" aria-label="Diameter">' +
          '<input type="number" inputmode="decimal" step="any" value="' + esc(t.h) + '" data-t="' + ri + '-' + ti + '-h" aria-label="Height">' +
          '<input type="number" inputmode="decimal" step="any" value="' + esc(t.v) + '" placeholder="m³" data-t="' + ri + '-' + ti + '-v" aria-label="Nominal volume override">' +
          '<button class="x" data-deltk="' + ri + '-' + ti + '" title="Remove tank">✕</button>' +
          '<span></span><span class="vol" data-vol="' + ri + '-' + ti + '"></span></div>';
      });
      html += '<div class="rowbtns"><button class="btn small ghost" data-addtk="' + ri + '">+ Add tank</button>' +
        '<button class="btn small ghost" data-copy="' + ri + '">Copy first tank to all in row</button></div></div>';
    });
    $('#rows').innerHTML = html;
  }

  function updateTankInfo() {
    var map = {};
    (R.tanks || []).forEach(function (t) { map[t.row + '-' + t.idx] = t; });
    $$('[data-no]').forEach(function (el) { var t = map[el.dataset.no]; el.textContent = t ? 'T' + t.no : '–'; });
    $$('[data-vol]').forEach(function (el) {
      var t = map[el.dataset.vol];
      el.innerHTML = t ? 'Calc. ' + fx(t.vCalc, 3) + ' m³ · area ' + fx(t.area, 3) + ' m²' + (t.vOverride ? ' · <b>using ' + fx(t.v, 2) + ' m³</b>' : '') + (t === R.largest ? ' · <b style="color:var(--bad)">largest</b>' : '') : 'ignored (no diameter)';
    });
  }

  /* ---------- Results ---------- */
  function renderStrip() {
    var s = '';
    if (R.errors.length) s += '<div class="kpi bad"><span>Error</span><b>Check inputs</b></div>';
    else s += '<div class="kpi ' + (R.ok ? 'ok' : 'bad') + '"><span>Status</span><b>' + (R.ok ? '✓ Compliant' : '✗ Non-compl.') + '</b></div>';
    s += '<div class="kpi"><span>' + (P.mode === 'check' ? 'H required' : 'H rec.') + '</span><b>' + fx(R.HreqRec, 2) + ' m</b></div>';
    s += '<div class="kpi"><span>H calc</span><b>' + fx(R.Hreq, 3) + ' m</b></div>';
    s += '<div class="kpi"><span>L × W</span><b>' + fx(R.L, 2) + ' × ' + fx(R.W, 2) + '</b></div>';
    s += '<div class="kpi"><span>V eff / req</span><b>' + fx(R.vEff, 1) + ' / ' + fx(R.vReq, 1) + '</b></div>';
    $('#strip').innerHTML = s;
  }

  function renderResults() {
    var s = '';
    if (R.errors.length) s += '<p class="err">' + R.errors.map(esc).join('<br>') + '</p>';
    s += '<div class="big ' + (R.ok ? 'ok' : 'bad') + '">' + (R.ok ? '✓ SANS 10089-1 COMPLIANT' : '✗ NON-COMPLIANT') +
      '<small>' + (P.mode === 'check' ? 'Existing bund ' : 'Recommended bund ') + fx(R.L, 2) + ' m × ' + fx(R.W, 2) + ' m × ' + fx(R.H, 2) + ' m</small></div>';
    s += '<div class="sum">' +
      '<div><span>Minimum length L_min</span><b>' + fx(R.Lmin, 2) + ' m</b></div>' +
      '<div><span>Minimum width W_min</span><b>' + fx(R.Wmin, 2) + ' m</b></div>' +
      '<div><span>Calculated height H_calc</span><b>' + fx(R.Hreq, 4) + ' m</b></div>' +
      '<div><span>Recommended height</span><b>' + fx(R.HreqRec, 2) + ' m</b></div>' +
      '<div><span>Largest tank (T' + (R.largest ? R.largest.no : '') + ')</span><b>' + fx(R.vLargest, 2) + ' m³</b></div>' +
      '<div><span>Bund volume V_bund</span><b>' + fx(R.vBund, 2) + ' m³</b></div>' +
      '<div><span>Tank displacement</span><b>' + fx(R.vDisp, 2) + ' m³</b></div>' +
      '<div><span>Effective volume V_eff</span><b>' + fx(R.vEff, 2) + ' m³</b></div>' +
      '</div>';
    $('#summary').innerHTML = s;

    var c = '<div class="tablewrap"><table><tr><th>Check</th><th>Required</th><th>Provided</th><th>Margin</th><th>Status</th></tr>';
    (R.checks || []).forEach(function (k) {
      c += '<tr><td>' + esc(k.name) + '</td><td class="n">' + fx(k.req, 3) + ' ' + k.unit + '</td><td class="n">' + fx(k.prov, 3) + ' ' + k.unit + '</td><td class="n">' + fx(k.margin, 3) + '</td><td class="' + (k.ok ? 'st-ok' : 'st-bad') + '">' + (k.ok ? '✓ COMPLIANT' : '✗ NON-COMPLIANT') + '</td></tr>';
    });
    $('#checks').innerHTML = c + '</table></div>';

    var w = '<div class="tablewrap"><table><tr><th>Description</th><th>Symbol</th><th>Value</th></tr>', sec = '';
    (R.working || []).forEach(function (x) {
      if (x.sec !== sec) { sec = x.sec; w += '<tr class="sec"><td colspan="3">' + esc(sec) + '</td></tr>'; }
      var key = /[A-Z]/.test(x.desc) && x.desc === x.desc.toUpperCase();
      w += '<tr' + (key ? ' class="key"' : '') + '><td>' + esc(x.desc) + '<span class="f">' + esc(x.f) + '</span></td><td>' + esc(x.sym) + '</td><td class="n">' + fx(x.v, x.dp) + ' ' + x.u + '</td></tr>';
    });
    $('#working').innerHTML = w + '</table></div>';
  }

  /* ---------- Drawings ---------- */
  var drawPending = false;
  function renderDrawings() {
    if (page !== 'draw' || !R || !R.tanks.length || !isFinite(R.L)) { if (R && !R.tanks.length) $('#v3d').innerHTML = '<p class="hint" style="padding:20px">Add tanks to see the drawing.</p>'; return; }
    if (drawPending) return; drawPending = true;
    requestAnimationFrame(function () {
      drawPending = false;
      var o = { az: view.az, el: view.el, wallT: +P.wallT || 0.23, spill: $('#spill').checked };
      $('#v3d').innerHTML = BWDraw.mimic3D(R, o);
      $('#vplan').innerHTML = BWDraw.plan(R, o);
      $('#velev').innerHTML = BWDraw.elevation(R, o);
    });
  }
  function draw3DOnly() {
    if (drawPending) return; drawPending = true;
    requestAnimationFrame(function () { drawPending = false; $('#v3d').innerHTML = BWDraw.mimic3D(R, { az: view.az, el: view.el, wallT: +P.wallT || 0.23, spill: $('#spill').checked }); });
  }
  (function dragRotate() {
    var el = $('#v3d'), sx, sy, az0, el0, on = false;
    el.addEventListener('pointerdown', function (e) { on = true; sx = e.clientX; sy = e.clientY; az0 = view.az; el0 = view.el; el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'; });
    el.addEventListener('pointermove', function (e) {
      if (!on) return;
      view.az = az0 - (e.clientX - sx) * 0.4;
      view.el = Math.max(2, Math.min(89.9, el0 + (e.clientY - sy) * 0.3));
      draw3DOnly();
    });
    function end() { on = false; el.style.cursor = ''; }
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  })();
  $$('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = { iso: [-28, 24], front: [0, 6], end: [-90, 6], top: [0, 89.9] }[b.dataset.view];
      view.az = v[0]; view.el = v[1]; draw3DOnly();
    });
  });
  $('#spill').addEventListener('change', draw3DOnly);

  /* ---------- Recalculate ---------- */
  function recalc() {
    R = BWC.calc(P);
    save();
    updateTankInfo(); renderStrip(); renderResults(); renderDrawings();
  }

  function bindFields() {
    $$('[data-k]').forEach(function (el) {
      var v = getK(el.dataset.k);
      el.value = v == null ? '' : v;
    });
    $('#check-card').hidden = P.mode !== 'check';
    $$('.seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === P.mode); });
  }

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.dataset.k) {
      var v = el.type === 'number' ? (el.value === '' ? '' : parseFloat(el.value)) : el.value;
      setK(el.dataset.k, v); recalc();
    } else if (el.dataset.t) {
      var a = el.dataset.t.split('-');
      P.rows[+a[0]].tanks[+a[1]][a[2]] = el.value === '' ? '' : parseFloat(el.value);
      recalc();
    } else if (el.dataset.rn != null) {
      P.rows[+el.dataset.rn].name = el.value; recalc();
    }
  });
  document.addEventListener('change', function (e) { if (e.target.tagName === 'SELECT' && e.target.dataset.k) { setK(e.target.dataset.k, e.target.value); recalc(); } });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var d = b.dataset;
    if (d.addtk != null) { var row = P.rows[+d.addtk], last = row.tanks[row.tanks.length - 1] || { d: 2.85, h: 8 }; row.tanks.push({ d: last.d, h: last.h, v: '' }); renderRows(); recalc(); }
    else if (d.deltk) { var a = d.deltk.split('-'); P.rows[+a[0]].tanks.splice(+a[1], 1); renderRows(); recalc(); }
    else if (d.delrow != null) { P.rows.splice(+d.delrow, 1); renderRows(); recalc(); }
    else if (d.copy != null) { var r2 = P.rows[+d.copy], f = r2.tanks[0]; if (f) r2.tanks.forEach(function (t) { t.d = f.d; t.h = f.h; t.v = f.v; }); renderRows(); recalc(); toast('Copied T1 size to the whole row'); }
    else if (d.mode) { P.mode = d.mode; bindFields(); recalc(); }
    else if (d.pg) { showPage(d.pg); }
  });
  $('#add-row').addEventListener('click', function () {
    var n = P.rows.length + 1, prev = P.rows[P.rows.length - 1];
    var tanks = prev ? prev.tanks.map(function (t) { return { d: t.d, h: t.h, v: '' }; }) : [{ d: 2.85, h: 8, v: '' }];
    P.rows.push({ name: 'Row ' + n, tanks: tanks }); renderRows(); recalc();
  });

  function showPage(pg) {
    page = pg;
    $$('.page').forEach(function (s) { s.classList.toggle('on', s.id === 'pg-' + pg); });
    $$('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.pg === pg); });
    window.scrollTo(0, 0);
    if (pg === 'draw') renderDrawings();
    if (pg === 'more') renderProjects();
  }

  /* ---------- Files (PDF / JSON) ---------- */
  function b64(bytes) { var s = '', ch = 0x8000; for (var i = 0; i < bytes.length; i += ch) s += String.fromCharCode.apply(null, bytes.subarray(i, i + ch)); return btoa(s); }
  function saveFile(name, mime, bytes) {
    if (isNative && Cap) {
      return nat('Filesystem', 'writeFile', { path: name, data: b64(bytes), directory: 'CACHE' })
        .then(function (res) { return nat('Share', 'share', { title: name, files: [res.uri], dialogTitle: 'Share ' + name }); })
        .catch(function (err) { if (!/cancel/i.test(String(err && err.message))) toast('Could not share: ' + (err && err.message || err)); });
    }
    var blob = new Blob([bytes], { type: mime });
    try {
      var file = new File([blob], name, { type: mime });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        return navigator.share({ files: [file], title: name }).catch(function () { download(blob, name); });
      }
    } catch (e) { /* fall through */ }
    download(blob, name);
    return Promise.resolve();
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function fileBase() { return ((P.info && P.info.project) || 'Bund').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Bund'; }

  $('#pdf').addEventListener('click', function () {
    if (!R.tanks.length) return toast('Add tanks first');
    toast('Building PDF…');
    var o = { az: view.az, el: view.el, wallT: +P.wallT || 0.23, spill: $('#spill').checked };
    Promise.all([
      BWDraw.svgToCanvas(BWDraw.mimic3D(R, o), 1600),
      BWDraw.svgToCanvas(BWDraw.plan(R, o), 1600),
      BWDraw.svgToCanvas(BWDraw.elevation(R, o), 1600)
    ]).then(function (c) {
      var bytes = BWPdf.report(P, R, { mimic: c[0], plan: c[1], elev: c[2] }, 'v' + APP_VERSION);
      return saveFile(fileBase() + '_Bund_Report.pdf', 'application/pdf', bytes);
    }).catch(function (e) { toast('PDF failed: ' + (e && e.message || e)); });
  });

  $('#export').addEventListener('click', function () {
    var txt = JSON.stringify({ app: 'BundWallCalculator', version: APP_VERSION, project: P }, null, 2);
    saveFile(fileBase() + '.bund.json', 'application/json', new TextEncoder().encode(txt));
  });
  $('#import').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result), p = j.project || j;
        if (!p.rows || !p.rows.length) throw new Error('No tank rows in file');
        P = Object.assign(BWC.defaultProject(), p); init(); toast('Project imported');
      } catch (err) { toast('Import failed: ' + err.message); }
    };
    rd.readAsText(f); e.target.value = '';
  });

  /* ---------- Saved projects ---------- */
  function projects() { return store(PKEY) || {}; }
  function renderProjects() {
    var ps = projects(), keys = Object.keys(ps).sort();
    $('#projects').innerHTML = keys.length ? '<h3>Saved projects</h3>' + keys.map(function (k) {
      var p = ps[k];
      return '<div class="proj"><span>' + esc(k) + '<small>' + esc((p.info && p.info.client) || '') + ' ' + esc((p.info && p.info.date) || '') + '</small></span>' +
        '<button class="btn small ghost" data-open="' + esc(k) + '">Open</button><button class="x" data-delp="' + esc(k) + '">✕</button></div>';
    }).join('') : '';
  }
  $('#projects').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var ps = projects();
    if (b.dataset.open) { P = JSON.parse(JSON.stringify(ps[b.dataset.open])); init(); showPage('tanks'); toast('Opened ' + b.dataset.open); }
    if (b.dataset.delp) {
      if (b.dataset.armed) { delete ps[b.dataset.delp]; store(PKEY, ps); renderProjects(); toast('Deleted'); }
      else { b.dataset.armed = 1; b.textContent = 'Delete?'; b.style.color = 'var(--bad)'; setTimeout(function () { renderProjects(); }, 3000); }
    }
  });
  $('#save').addEventListener('click', function () {
    var name = (P.info.project || '').trim();
    if (!name) { toast('Enter a project name first'); $('[data-k="info.project"]').focus(); return; }
    var ps = projects(); ps[name] = JSON.parse(JSON.stringify(P)); store(PKEY, ps); renderProjects(); toast('Saved "' + name + '"');
  });
  $('#new').addEventListener('click', function () { P = BWC.defaultProject(); init(); showPage('tanks'); toast('New project with default 14 tanks'); });

  /* ---------- Self-test ---------- */
  $('#selftest').addEventListener('click', function () {
    var res = BWC.selfTest(), all = res.every(function (x) { return x.ok; }), c = '';
    var h = '<p class="' + (all ? 'test-ok' : 'test-bad') + '"><b>' + (all ? '✓ All ' + res.length + ' checks passed – matches the spreadsheet' : '✗ Some checks failed') + '</b></p><div class="tablewrap"><table><tr><th>Item</th><th>Got</th><th>Expected</th><th></th></tr>';
    res.forEach(function (x) {
      if (x.c !== c) { c = x.c; h += '<tr class="sec"><td colspan="4">' + esc(c) + '</td></tr>'; }
      h += '<tr><td>' + esc(x.label) + '</td><td class="n">' + (typeof x.got === 'number' ? fx(x.got, 4) : x.got) + '</td><td class="n">' + x.exp + '</td><td class="' + (x.ok ? 'st-ok' : 'st-bad') + '">' + (x.ok ? 'PASS' : 'FAIL') + '</td></tr>';
    });
    $('#testout').innerHTML = h + '</table></div>';
  });

  /* ---------- Theme ---------- */
  function applyTheme(t) { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme(store(TKEY));
  $('#theme').addEventListener('click', function () {
    var cur = store(TKEY), nxt = cur == null ? 'dark' : cur === 'dark' ? 'light' : null;
    store(TKEY, nxt); applyTheme(nxt); toast('Theme: ' + (nxt || 'auto'));
  });

  /* ---------- Install / update ---------- */
  var deferred = null;
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; if (!isNative) $('#install').hidden = false; });
  $('#install').addEventListener('click', function () { if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; $('#install').hidden = true; }); } });
  if (!isNative && !standalone && /iPhone|iPad|iPod/i.test(navigator.userAgent)) $('#iosmsg').hidden = false;

  function newer(a, b) { a = String(a).split('.').map(Number); b = String(b).split('.').map(Number); for (var i = 0; i < 3; i++) { if ((a[i] || 0) > (b[i] || 0)) return true; if ((a[i] || 0) < (b[i] || 0)) return false; } return false; }
  $('#update').addEventListener('click', function () {
    var msg = $('#updmsg'); msg.textContent = 'Checking…';
    fetch(PAGES_URL + 'version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!newer(j.version, APP_VERSION)) { msg.textContent = 'You have the latest version (v' + APP_VERSION + ').'; return; }
      if (isNative) {
        msg.innerHTML = 'Version ' + esc(j.version) + ' is available. <a class="btn small" href="' + APK_URL + '">Download new APK</a>';
      } else {
        msg.textContent = 'Updating to v' + j.version + '…';
        var clear = window.caches ? caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }) : Promise.resolve();
        clear.then(function () { return navigator.serviceWorker ? navigator.serviceWorker.getRegistration() : null; })
          .then(function (reg) { return reg && reg.update(); })
          .then(function () { location.reload(); });
      }
    }).catch(function () { msg.textContent = 'No internet – could not check for updates. The app keeps working offline.'; });
  });
  if (!isNative && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  /* ---------- Init ---------- */
  function init() {
    P = Object.assign(BWC.defaultProject(), P);
    P.info = Object.assign(BWC.defaultProject().info, P.info || {});
    P.provided = P.provided || { sTank: P.sTank, sBund: P.sBund };
    P.actual = P.actual || { L: 0, W: 0, H: 0 };
    bindFields(); renderRows(); recalc(); renderProjects();
  }
  $('#ver').textContent = 'v' + APP_VERSION;
  init();
  window.BWApp = { get project() { return P; }, get result() { return R; }, showPage: showPage };
})();
