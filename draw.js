/* Bund Wall Calculator – to-scale drawings (3D mimic, plan, elevation) as SVG strings */
(function (root) {
  'use strict';
  var ROW_COLORS = [
    { side: '#4682B4', dark: '#24486a', light: '#8fb8dc', top: '#5b93c4', text: '#1f4e8c' },  // blue (front row)
    { side: '#E07A4F', dark: '#8a3b1d', light: '#f6b393', top: '#FF8C5A', text: '#b8471d' },  // orange (back row)
    { side: '#5aa469', dark: '#2a5c34', light: '#a6d8b0', top: '#6cbf7c', text: '#2d6b3a' },
    { side: '#9b6bc4', dark: '#4e3170', light: '#cdb2e6', top: '#ad84d4', text: '#5d3a87' },
    { side: '#c4a53b', dark: '#6b5a1c', light: '#e8d78f', top: '#d9b94a', text: '#7a6510' }
  ];
  function rc(i) { return ROW_COLORS[i % ROW_COLORS.length]; }
  function f(n, d) { return (+n).toFixed(d == null ? 2 : d); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var FONT = 'font-family="Segoe UI, Roboto, Helvetica, Arial, sans-serif"';

  /* ---------------- 3D mimic (orthographic, to scale) ---------------- */
  function mimic3D(r, opt) {
    opt = opt || {};
    var az = (opt.az == null ? -28 : opt.az) * Math.PI / 180;
    var el = (opt.el == null ? 24 : opt.el) * Math.PI / 180;
    var L = r.L, W = r.W, H = r.H, t = opt.wallT || 0.23;
    var ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    // camera looks from -y (front row side) towards +y, rotated by azimuth about the bund centre
    var cx0 = L / 2, cy0 = W / 2;
    function P(x, y, z) {
      var dx = x - cx0, dy = y - cy0;
      var xr = dx * ca - dy * sa;
      var yr = dx * sa + dy * ca;          // depth (away from viewer)
      return [xr, -z * ce - yr * se, yr];
    }
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    function grow(p) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
    function pts(arr) { return arr.map(function (p) { return f(p[0], 3) + ',' + f(p[1], 3); }).join(' '); }

    var out = [], defs = [];
    // gradients for cylinders
    r.rows.forEach(function (row, i) {
      var c = rc(i);
      defs.push('<linearGradient id="cg' + i + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="' + c.dark + '"/><stop offset="0.35" stop-color="' + c.side + '"/><stop offset="0.6" stop-color="' + c.light + '"/><stop offset="1" stop-color="' + c.dark + '"/></linearGradient>');
    });

    // ground grid (5 m)
    var g0 = -2, gx1 = Math.ceil((L + 2) / 5) * 5, gy1 = Math.ceil((W + 2) / 5) * 5;
    var grid = [];
    for (var gx = 0; gx <= gx1; gx += 5) { var a = P(gx, g0, 0), b = P(gx, gy1, 0); grow(a); grow(b); grid.push('<line x1="' + f(a[0], 3) + '" y1="' + f(a[1], 3) + '" x2="' + f(b[0], 3) + '" y2="' + f(b[1], 3) + '"/>'); }
    for (var gy = 0; gy <= gy1; gy += 5) { var a2 = P(g0, gy, 0), b2 = P(gx1, gy, 0); grow(a2); grow(b2); grid.push('<line x1="' + f(a2[0], 3) + '" y1="' + f(a2[1], 3) + '" x2="' + f(b2[0], 3) + '" y2="' + f(b2[1], 3) + '"/>'); }
    out.push('<g stroke="#c9ced6" stroke-width="0.04">' + grid.join('') + '</g>');
    var lbl = [];
    for (gx = 0; gx <= gx1; gx += 5) { var q = P(gx, g0 - 0.9, 0); lbl.push('<text x="' + f(q[0], 3) + '" y="' + f(q[1], 3) + '">' + gx + '</text>'); }
    for (gy = 0; gy <= gy1; gy += 5) { var q2 = P(g0 - 0.9, gy, 0); lbl.push('<text x="' + f(q2[0], 3) + '" y="' + f(q2[1], 3) + '">' + gy + '</text>'); }
    out.push('<g fill="#7a828e" font-size="0.75" text-anchor="middle" ' + FONT + '>' + lbl.join('') + '</g>');

    // bund floor (outer footprint incl. wall)
    var floor = [P(-t, -t, 0), P(L + t, -t, 0), P(L + t, W + t, 0), P(-t, W + t, 0)];
    floor.forEach(grow);
    out.push('<polygon points="' + pts(floor) + '" fill="#d5d8dd" stroke="#9aa1ab" stroke-width="0.04"/>');

    // walls as boxes
    var walls = [
      { n: 'front', b: [-t, -t, L + t, 0] },
      { n: 'back', b: [-t, W, L + t, W + t] },
      { n: 'left', b: [-t, 0, 0, W] },
      { n: 'right', b: [L, 0, L + t, W] }
    ];
    function boxSvg(b, h, fillTop, fillSide, op) {
      var x0 = b[0], y0 = b[1], x1 = b[2], y1 = b[3];
      var c = [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]].map(function (p) { return P(p[0], p[1], p[2]); });
      c.forEach(grow);
      // faces with outward CCW winding (seen from outside, world coords)
      var faces = [[4, 5, 6, 7, 'top'], [0, 1, 5, 4, 's'], [1, 2, 6, 5, 's'], [2, 3, 7, 6, 's'], [3, 0, 4, 7, 's']];
      var s = '';
      faces.forEach(function (fc) {
        var poly = [c[fc[0]], c[fc[1]], c[fc[2]], c[fc[3]]];
        var area = 0;
        for (var i = 0; i < 4; i++) { var p1 = poly[i], p2 = poly[(i + 1) % 4]; area += p1[0] * p2[1] - p2[0] * p1[1]; }
        if (area >= 0) return; // back-facing (screen y is down)
        s += '<polygon points="' + pts(poly) + '" fill="' + (fc[4] === 'top' ? fillTop : fillSide) + '" fill-opacity="' + op + '" stroke="#3b4048" stroke-width="0.035" stroke-linejoin="round"/>';
      });
      return s;
    }
    walls.forEach(function (w) { var m = P((w.b[0] + w.b[2]) / 2, (w.b[1] + w.b[3]) / 2, 0); w.depth = m[2]; });
    walls.sort(function (a, b) { return b.depth - a.depth; });
    var back = walls.slice(0, 2), front = walls.slice(2);
    back.forEach(function (w) { out.push(boxSvg(w.b, H, '#b9bec6', '#9ea4ad', 0.95)); });

    // spill level
    if (opt.spill !== false && isFinite(r.Hreq) && r.Hreq > 0) {
      var hs = Math.min(r.Hreq, H);
      var sp = [P(0, 0, hs), P(L, 0, hs), P(L, W, hs), P(0, W, hs)];
      out.push('<polygon points="' + pts(sp) + '" fill="#3aa0e8" fill-opacity="0.28" stroke="#1d7cc2" stroke-width="0.03" stroke-dasharray="0.2 0.15"/>');
    }

    // tanks, far to near
    var tanks = r.tanks.slice().map(function (tk) { var p = P(tk.x, tk.y, 0); return { tk: tk, p: p }; });
    tanks.sort(function (a, b) { return b.p[2] - a.p[2]; });
    tanks.forEach(function (o) {
      var labels = [];
      var tk = o.tk, c = rc(tk.row), rad = tk.d / 2, ry = rad * se;
      var b = P(tk.x, tk.y, 0), tp = P(tk.x, tk.y, tk.h);
      var x = b[0], yb = b[1], yt = tp[1];
      grow([x - rad, yt - ry]); grow([x + rad, yb + ry]);
      var isL = r.largest && tk === r.largest;
      out.push('<path d="M' + f(x - rad, 3) + ',' + f(yt, 3) + ' L' + f(x - rad, 3) + ',' + f(yb, 3) + ' A' + f(rad, 3) + ',' + f(ry, 3) + ' 0 0 0 ' + f(x + rad, 3) + ',' + f(yb, 3) + ' L' + f(x + rad, 3) + ',' + f(yt, 3) + ' Z" fill="url(#cg' + tk.row + ')" stroke="' + c.dark + '" stroke-width="0.04"/>');
      out.push('<ellipse cx="' + f(x, 3) + '" cy="' + f(yt, 3) + '" rx="' + f(rad, 3) + '" ry="' + f(ry, 3) + '" fill="' + c.top + '" stroke="' + (isL ? '#d01b1b' : '#1b2a6b') + '" stroke-width="' + (isL ? 0.1 : 0.05) + '"/>');
      labels.push('<text x="' + f(x, 3) + '" y="' + f(yt - ry - 0.25, 3) + '" fill="#c0262d" font-size="0.62" font-weight="700">⌀' + f(tk.d) + 'm</text>');
      var mid = P(tk.x, tk.y, tk.h * 0.5);
      labels.push('<text x="' + f(x, 3) + '" y="' + f(mid[1], 3) + '" fill="#fff" font-size="0.6" font-weight="700" stroke="rgba(0,0,0,.35)" stroke-width="0.02">T' + tk.no + '</text>');
      labels.push('<text x="' + f(x, 3) + '" y="' + f(mid[1] + 0.8, 3) + '" fill="#fff" font-size="0.48">' + f(tk.v, 1) + 'm³</text>');
      out.push('<g text-anchor="middle" ' + FONT + '>' + labels.join('') + '</g>');
    });

    front.forEach(function (w) { out.push(boxSvg(w.b, H, '#c4c9d0', '#a7adb6', 0.9)); });

    // dimension labels
    var dl = [];
    var pL = P(L / 2, -t - 1.6, 0), pW = P(L + t + 1.6, W / 2, 0), pH = P(-t, -t, H);
    grow(pL); grow(pW);
    dl.push('<text x="' + f(pL[0], 3) + '" y="' + f(pL[1], 3) + '">L = ' + f(L) + ' m</text>');
    dl.push('<text x="' + f(pW[0], 3) + '" y="' + f(pW[1], 3) + '">W = ' + f(W) + ' m</text>');
    dl.push('<text x="' + f(pH[0] - 0.4, 3) + '" y="' + f(pH[1] - 0.3, 3) + '" text-anchor="end">H = ' + f(H) + ' m</text>');
    grow([pH[0] - 7, pH[1]]);
    out.push('<g fill="#6a1b9a" font-size="0.85" font-weight="700" text-anchor="middle" ' + FONT + '>' + dl.join('') + '</g>');

    var pad = 1.2;
    minX -= pad; minY -= pad + 2.6; maxX += pad; maxY += pad;
    var vw = maxX - minX, vh = maxY - minY;
    var title = opt.title !== false ?
      '<text x="' + f(minX + vw / 2, 3) + '" y="' + f(minY + 1.2, 3) + '" text-anchor="middle" font-size="' + f(Math.max(0.9, vw / 38), 3) + '" font-weight="700" fill="#1d232b" ' + FONT + '>' + esc((r.mode === 'check' ? 'Existing bund' : 'SANS 10089-1 compliant bund') + ' · ' + r.nTotal + ' tanks · ' + f(r.vTotal, 1) + ' m³') + '</text>' +
      '<text x="' + f(minX + vw / 2, 3) + '" y="' + f(minY + 2.3, 3) + '" text-anchor="middle" font-size="' + f(Math.max(0.75, vw / 46), 3) + '" font-weight="600" fill="#3b4250" ' + FONT + '>Bund ' + f(L) + ' m × ' + f(W) + ' m × ' + f(H) + ' m (to scale)</text>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f(minX, 3) + ' ' + f(minY, 3) + ' ' + f(vw, 3) + ' ' + f(vh, 3) + '" width="' + (opt.px || 1000) + '" height="' + Math.round((opt.px || 1000) * vh / vw) + '"><defs>' + defs.join('') + '</defs><rect x="' + f(minX, 3) + '" y="' + f(minY, 3) + '" width="' + f(vw, 3) + '" height="' + f(vh, 3) + '" fill="#ffffff"/>' + title + out.join('') + '</svg>';
  }

  /* ---------------- Plan view ---------------- */
  function dimH(x1, x2, y, text, tick, fs) {
    return '<line x1="' + f(x1, 3) + '" y1="' + f(y, 3) + '" x2="' + f(x2, 3) + '" y2="' + f(y, 3) + '"/>' +
      '<line x1="' + f(x1, 3) + '" y1="' + f(y - tick, 3) + '" x2="' + f(x1, 3) + '" y2="' + f(y + tick, 3) + '"/>' +
      '<line x1="' + f(x2, 3) + '" y1="' + f(y - tick, 3) + '" x2="' + f(x2, 3) + '" y2="' + f(y + tick, 3) + '"/>' +
      '<text x="' + f((x1 + x2) / 2, 3) + '" y="' + f(y - tick * 0.6, 3) + '" font-size="' + fs + '" text-anchor="middle" stroke="none">' + text + '</text>';
  }
  function dimV(y1, y2, x, text, tick, fs) {
    var cy = (y1 + y2) / 2;
    return '<line x1="' + f(x, 3) + '" y1="' + f(y1, 3) + '" x2="' + f(x, 3) + '" y2="' + f(y2, 3) + '"/>' +
      '<line x1="' + f(x - tick, 3) + '" y1="' + f(y1, 3) + '" x2="' + f(x + tick, 3) + '" y2="' + f(y1, 3) + '"/>' +
      '<line x1="' + f(x - tick, 3) + '" y1="' + f(y2, 3) + '" x2="' + f(x + tick, 3) + '" y2="' + f(y2, 3) + '"/>' +
      '<text x="' + f(x - tick * 0.6, 3) + '" y="' + f(cy, 3) + '" font-size="' + fs + '" text-anchor="middle" stroke="none" transform="rotate(-90 ' + f(x - tick * 0.6, 3) + ' ' + f(cy, 3) + ')">' + text + '</text>';
  }

  function plan(r, opt) {
    opt = opt || {};
    var L = r.L, W = r.W, t = opt.wallT || 0.23, fs = 0.55, tick = 0.25;
    var o = [];
    // plan: x right = length, y down = width; row 1 (front) at bottom
    function Y(y) { return W - y; }
    o.push('<rect x="' + f(-t, 3) + '" y="' + f(-t, 3) + '" width="' + f(L + 2 * t, 3) + '" height="' + f(W + 2 * t, 3) + '" fill="#9ea4ad" stroke="#3b4048" stroke-width="0.04"/>');
    o.push('<rect x="0" y="0" width="' + f(L, 3) + '" height="' + f(W, 3) + '" fill="#eef0f3" stroke="#3b4048" stroke-width="0.04"/>');
    // S_bund clearance zone
    var sb = r.sBund;
    o.push('<rect x="' + f(sb, 3) + '" y="' + f(sb, 3) + '" width="' + f(Math.max(0, L - 2 * sb), 3) + '" height="' + f(Math.max(0, W - 2 * sb), 3) + '" fill="none" stroke="#9aa1ab" stroke-width="0.03" stroke-dasharray="0.25 0.18"/>');
    r.tanks.forEach(function (tk) {
      var c = rc(tk.row), isL = r.largest && tk === r.largest;
      o.push('<circle cx="' + f(tk.x, 3) + '" cy="' + f(Y(tk.y), 3) + '" r="' + f(tk.d / 2, 3) + '" fill="' + c.top + '" fill-opacity="0.85" stroke="' + (isL ? '#d01b1b' : c.dark) + '" stroke-width="' + (isL ? 0.09 : 0.05) + '"/>');
      o.push('<text x="' + f(tk.x, 3) + '" y="' + f(Y(tk.y) - 0.1, 3) + '" font-size="0.5" font-weight="700" fill="#fff" text-anchor="middle" ' + FONT + '>T' + tk.no + '</text>');
      o.push('<text x="' + f(tk.x, 3) + '" y="' + f(Y(tk.y) + 0.5, 3) + '" font-size="0.36" fill="#fff" text-anchor="middle" ' + FONT + '>' + f(tk.v, 1) + 'm³</text>');
    });
    // dimensions
    var d = [];
    d.push(dimH(0, L, -t - 1.4, 'L = ' + f(L) + ' m', tick, fs));
    d.push(dimV(0, W, -t - 1.4, 'W = ' + f(W) + ' m', tick, fs));
    var used = r.rows.filter(function (x) { return x.n > 0; });
    if (used.length && used[0].tanks.length) {
      var first = used[0].tanks[0], yb = W + t + 1.0;
      var x1 = first.x - r.dLen / 2;
      d.push(dimH(0, x1, yb, f(x1) + '', tick, fs * 0.85));
      if (used[0].tanks.length > 1) {
        var sec = used[0].tanks[1];
        d.push(dimH(first.x + first.d / 2, sec.x - sec.d / 2, yb, f(sec.x - sec.d / 2 - first.x - first.d / 2) + '', tick, fs * 0.85));
      }
      d.push(dimH(first.x - first.d / 2, first.x + first.d / 2, yb + 1.0, '⌀' + f(first.d), tick, fs * 0.85));
      var lastT = used[0].tanks[used[0].tanks.length - 1];
      d.push(dimH(lastT.x + lastT.d / 2, L, yb, f(L - lastT.x - lastT.d / 2) + '', tick, fs * 0.85));
      // across width on the right
      var xr = L + t + 1.0, yPrev = 0;
      used.forEach(function (row, i) {
        var lo = row.cy - row.dMax / 2, hi = row.cy + row.dMax / 2;
        d.push(dimV(Y(lo), Y(yPrev), xr, f(lo - yPrev), tick, fs * 0.85));
        d.push(dimV(Y(hi), Y(lo), xr, '⌀' + f(row.dMax), tick, fs * 0.85));
        yPrev = hi;
      });
      d.push(dimV(Y(W), Y(yPrev), xr, f(W - yPrev), tick, fs * 0.85));
    }
    o.push('<g stroke="#5b2a86" stroke-width="0.03" fill="#5b2a86" ' + FONT + '>' + d.join('') + '</g>');
    // row labels
    used.forEach(function (row) {
      o.push('<text x="' + f(L / 2, 3) + '" y="' + f(Y(row.cy - row.dMax / 2) + 0.55, 3) + '" font-size="0.42" fill="' + rc(row.index).text + '" text-anchor="middle" ' + FONT + '>' + esc(row.name) + '</text>');
    });
    var mx = -t - 2.6, my = -t - 2.6, vw = L + 2 * t + 5.2, vh = W + 2 * t + 2.6 + 3.4;
    if (opt.title !== false) { my -= 1.2; vh += 1.2; o.push('<text x="' + f(L / 2, 3) + '" y="' + f(my + 0.9, 3) + '" font-size="0.8" font-weight="700" text-anchor="middle" fill="#1d232b" ' + FONT + '>PLAN VIEW (to scale) – dashed line = ' + f(sb) + ' m clearance to bund wall</text>'); }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f(mx, 3) + ' ' + f(my, 3) + ' ' + f(vw, 3) + ' ' + f(vh, 3) + '" width="' + (opt.px || 1000) + '" height="' + Math.round((opt.px || 1000) * vh / vw) + '"><rect x="' + f(mx, 3) + '" y="' + f(my, 3) + '" width="' + f(vw, 3) + '" height="' + f(vh, 3) + '" fill="#fff"/>' + o.join('') + '</svg>';
  }

  /* ---------------- Side elevation ---------------- */
  function elevation(r, opt) {
    opt = opt || {};
    var L = r.L, H = r.H, t = opt.wallT || 0.23;
    var maxH = r.tanks.reduce(function (m, x) { return Math.max(m, x.h); }, H);
    var o = [];
    function Y(z) { return -z; }
    o.push('<line x1="' + f(-t - 1.5, 3) + '" y1="0" x2="' + f(L + t + 1.5, 3) + '" y2="0" stroke="#3b4048" stroke-width="0.06"/>');
    // back rows first
    var rowsBack = r.rows.filter(function (x) { return x.n > 0; }).slice().reverse();
    rowsBack.forEach(function (row) {
      var c = rc(row.index);
      row.tanks.forEach(function (tk) {
        o.push('<rect x="' + f(tk.x - tk.d / 2, 3) + '" y="' + f(Y(tk.h), 3) + '" width="' + f(tk.d, 3) + '" height="' + f(tk.h, 3) + '" fill="' + c.side + '" fill-opacity="0.9" stroke="' + c.dark + '" stroke-width="0.04"/>');
        o.push('<text x="' + f(tk.x, 3) + '" y="' + f(Y(tk.h) - 0.25, 3) + '" font-size="0.5" fill="' + c.text + '" text-anchor="middle" ' + FONT + '>' + f(tk.h, 1) + 'm</text>');
      });
    });
    // spill level
    if (isFinite(r.Hreq) && r.Hreq > 0) {
      o.push('<rect x="0" y="' + f(Y(Math.min(r.Hreq, H)), 3) + '" width="' + f(L, 3) + '" height="' + f(Math.min(r.Hreq, H), 3) + '" fill="#3aa0e8" fill-opacity="0.35"/>');
    }
    // bund walls (section)
    o.push('<rect x="' + f(-t, 3) + '" y="' + f(Y(H), 3) + '" width="' + f(t, 3) + '" height="' + f(H, 3) + '" fill="#6e747d" stroke="#2b2f35" stroke-width="0.03"/>');
    o.push('<rect x="' + f(L, 3) + '" y="' + f(Y(H), 3) + '" width="' + f(t, 3) + '" height="' + f(H, 3) + '" fill="#6e747d" stroke="#2b2f35" stroke-width="0.03"/>');
    o.push('<line x1="' + f(-t, 3) + '" y1="' + f(Y(H), 3) + '" x2="' + f(L + t, 3) + '" y2="' + f(Y(H), 3) + '" stroke="#6a1b9a" stroke-width="0.04" stroke-dasharray="0.3 0.2"/>');
    o.push('<g stroke="#5b2a86" stroke-width="0.03" fill="#5b2a86" ' + FONT + '>' + dimV(Y(H), 0, -t - 0.9, '', 0.2, 0.5) + dimH(0, L, 1.3, 'L = ' + f(L) + ' m', 0.2, 0.55) + '</g>');
    o.push('<text x="' + f(-t - 1.2, 3) + '" y="' + f(Y(H) - 0.35, 3) + '" font-size="0.55" font-weight="700" fill="#6a1b9a" text-anchor="end" ' + FONT + '>H = ' + f(H) + ' m</text>');
    var mx = -t - 6, my = -maxH - 1.5, vw = L + 2 * t + 7.5, vh = maxH + 1.5 + 2.2;
    if (opt.title !== false) { my -= 1.2; vh += 1.2; o.push('<text x="' + f(L / 2, 3) + '" y="' + f(my + 0.9, 3) + '" font-size="0.8" font-weight="700" text-anchor="middle" fill="#1d232b" ' + FONT + '>SIDE ELEVATION (to scale) – blue = spill level ' + f(r.Hreq, 3) + ' m</text>'); }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f(mx, 3) + ' ' + f(my, 3) + ' ' + f(vw, 3) + ' ' + f(vh, 3) + '" width="' + (opt.px || 1000) + '" height="' + Math.round((opt.px || 1000) * vh / vw) + '"><rect x="' + f(mx, 3) + '" y="' + f(my, 3) + '" width="' + f(vw, 3) + '" height="' + f(vh, 3) + '" fill="#fff"/>' + o.join('') + '</svg>';
  }

  // Rasterise an SVG string to a canvas (used for the PDF)
  function svgToCanvas(svg, widthPx) {
    return new Promise(function (resolve, reject) {
      var m = svg.match(/width="(\d+)" height="(\d+)"/);
      var w = widthPx, h = Math.round(widthPx * (+m[2]) / (+m[1]));
      svg = svg.replace(/width="\d+" height="\d+"/, 'width="' + w + '" height="' + h + '"');
      var img = new Image();
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        resolve(c);
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    });
  }

  root.BWDraw = { mimic3D: mimic3D, plan: plan, elevation: elevation, svgToCanvas: svgToCanvas, rowColor: rc };
})(typeof window !== 'undefined' ? window : globalThis);
