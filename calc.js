/* Bund Wall Calculator – calculation engine (SANS 10089-1)
   Reproduces the "Combined Bund Calculator" sheet of Calculator_manual_entry.xlsx */
(function (root) {
  'use strict';
  var PI = Math.PI;

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function round(x, d) { var p = Math.pow(10, d); return Math.round(x * p) / p; }
  // Excel-style CEILING(x, step) that ignores floating-point noise (9.7000000001 -> 9.7)
  function ceilStep(x, step) {
    if (!isFinite(x)) return x;
    var k = Math.ceil(round(x / step, 9));
    return round(k * step, 6);
  }

  function defaultProject() {
    function row(name, d, h) {
      var t = []; for (var i = 0; i < 7; i++) t.push({ d: d, h: h, v: '' });
      return { name: name, tanks: t };
    }
    return {
      info: { project: '', client: '', site: '', by: '', date: new Date().toISOString().slice(0, 10) },
      sTank: 1.0, sBund: 1.5,
      rows: [row('Row 1 – Front', 2.85, 8), row('Row 2 – Back', 2.85, 12)],
      mode: 'design',
      actual: { L: 29.591, W: 10.51, H: 1.5 },
      factor: 100,
      disp: 'all',            // 'all' | 'exceptLargest'
      provided: { sTank: 1.0, sBund: 1.5 },
      wallT: 0.23
    };
  }

  function calc(p) {
    var sTank = num(p.sTank), sBund = num(p.sBund);
    var factor = num(p.factor) > 0 ? num(p.factor) / 100 : 1;
    var tanks = [], rows = [], no = 0;

    p.rows.forEach(function (row, ri) {
      var st = { name: row.name, index: ri, n: 0, dMax: 0, area: 0, vol: 0, tanks: [] };
      row.tanks.forEach(function (t, ti) {
        var d = num(t.d), h = num(t.h);
        if (d <= 0) return;
        var a = PI * Math.pow(d / 2, 2);
        var vCalc = a * h;
        var vOv = num(t.v);
        var tk = { no: ++no, row: ri, slot: st.n, idx: ti, d: d, h: h, area: a, vCalc: vCalc,
                   vOverride: vOv > 0 ? vOv : null, v: vOv > 0 ? vOv : vCalc };
        st.n++; st.dMax = Math.max(st.dMax, d); st.area += a; st.vol += tk.v;
        st.tanks.push(tk); tanks.push(tk);
      });
      rows.push(st);
    });

    var used = rows.filter(function (r) { return r.n > 0; });
    var r = { rows: rows, tanks: tanks, sTank: sTank, sBund: sBund, factor: factor, mode: p.mode, errors: [] };
    r.nTotal = tanks.length;
    r.vTotal = tanks.reduce(function (s, t) { return s + t.v; }, 0);
    r.aTotal = tanks.reduce(function (s, t) { return s + t.area; }, 0);
    if (!tanks.length) { r.errors.push('Enter at least one tank with a diameter.'); return r; }

    var largest = tanks.reduce(function (a, b) { return b.v > a.v ? b : a; });
    r.largest = largest;
    r.vLargest = largest.v;
    r.vReq = r.vLargest * factor;
    r.aDisp = p.disp === 'exceptLargest' ? r.aTotal - largest.area : r.aTotal;

    // Minimum dimensions
    r.dLen = Math.max.apply(null, used.map(function (x) { return x.dMax; }));
    r.nRow = Math.max.apply(null, used.map(function (x) { return x.n; }));
    r.nGaps = r.nRow - 1;
    r.nRows = used.length;
    r.Lmin = r.dLen * r.nRow + r.nGaps * sTank + 2 * sBund;
    r.sumDmax = used.reduce(function (s, x) { return s + x.dMax; }, 0);
    r.Wmin = r.sumDmax + (r.nRows - 1) * sTank + 2 * sBund;

    // Height on minimum footprint (design)
    r.aBundMin = r.Lmin * r.Wmin;
    r.aEffMin = r.aBundMin - r.aDisp;
    r.Hcalc = r.aEffMin > 0 ? r.vReq / r.aEffMin : NaN;
    r.Hrec = ceilStep(r.Hcalc, 0.1);
    r.Lrec = ceilStep(r.Lmin, 0.1);
    r.Wrec = ceilStep(r.Wmin, 0.1);

    if (p.mode === 'check') {
      var L = num(p.actual.L), W = num(p.actual.W), H = num(p.actual.H);
      r.L = L; r.W = W; r.H = H;
      r.aBund = L * W;
      r.aEff = r.aBund - r.aDisp;
      r.Hreq = r.aEff > 0 ? r.vReq / r.aEff : NaN;
      r.HreqRec = ceilStep(r.Hreq, 0.1);
    } else {
      r.L = r.Lrec; r.W = r.Wrec; r.H = r.Hrec;
      r.aBund = r.aBundMin; r.aEff = r.aEffMin;
      r.Hreq = r.Hcalc; r.HreqRec = r.Hrec;
    }
    if (!(r.aEff > 0)) r.errors.push('Tanks occupy the whole bund – effective area is zero or negative.');

    r.vBund = r.L * r.W * r.H;
    r.vDisp = r.aDisp * r.H;
    r.vEff = r.vBund - r.vDisp;

    // Compliance
    var pr = p.provided || {};
    function chk(name, req, prov, unit) {
      var ok = isFinite(req) && isFinite(prov) && round(prov - req, 6) >= 0;
      return { name: name, req: req, prov: prov, margin: prov - req, ok: ok, unit: unit };
    }
    r.checks = [
      chk('Tank-to-tank spacing ≥ ' + sTank + ' m', sTank, num(pr.sTank), 'm'),
      chk('Tank-to-bund spacing ≥ ' + sBund + ' m', sBund, num(pr.sBund), 'm'),
      chk('Effective volume ≥ ' + (factor === 1 ? 'largest tank' : round(factor * 100, 1) + '% of largest tank'), r.vReq, r.vEff, 'm³')
    ];
    if (p.mode === 'check') {
      r.checks.push(chk('Bund length ≥ minimum', r.Lmin, r.L, 'm'));
      r.checks.push(chk('Bund width ≥ minimum', r.Wmin, r.W, 'm'));
      r.checks.push(chk('Bund height ≥ required (rounded)', r.HreqRec, r.H, 'm'));
    }
    r.ok = r.errors.length === 0 && r.checks.every(function (c) { return c.ok; });

    // Layout (tank centres, metres, inside the bund; group centred in the bund)
    var pitch = r.dLen + sTank;
    var offX = Math.max(0, (r.L - r.Lmin) / 2), offY = Math.max(0, (r.W - r.Wmin) / 2);
    var y = offY + sBund;
    used.forEach(function (row) {
      var cy = y + row.dMax / 2;
      row.tanks.forEach(function (t) {
        t.x = offX + sBund + r.dLen / 2 + t.slot * pitch;
        t.y = cy;
      });
      row.cy = cy;
      y += row.dMax + sTank;
    });
    r.offX = offX; r.offY = offY; r.pitch = pitch;

    // Working steps for display / report
    var w = [];
    function s(sec, desc, sym, formula, val, unit, dp) { w.push({ sec: sec, desc: desc, sym: sym, f: formula, v: val, u: unit, dp: dp == null ? 3 : dp }); }
    used.forEach(function (row, i) {
      var k = i + 1;
      s('Tank summary', row.name + ' – number of tanks', 'n' + k, 'COUNT(D > 0)', row.n, 'tanks', 0);
      s('Tank summary', row.name + ' – max diameter', 'D' + k + '_max', 'MAX(D)', row.dMax, 'm');
      s('Tank summary', row.name + ' – total volume', 'V' + k + '_total', 'Σ π(D/2)²·H', row.vol, 'm³');
      s('Tank summary', row.name + ' – footprint area', 'A' + k + '_total', 'Σ π(D/2)²', row.area, 'm²');
    });
    s('Tank summary', 'Total tanks', 'n_total', 'Σ n', r.nTotal, 'tanks', 0);
    s('Tank summary', 'Total tank volume', 'V_total', 'Σ V', r.vTotal, 'm³');
    s('Tank summary', 'Largest tank volume (T' + largest.no + ')', 'V_largest', 'MAX(V)', r.vLargest, 'm³');
    if (factor !== 1) s('Tank summary', 'Required containment (' + round(factor * 100, 1) + '%)', 'V_req', 'V_largest × factor', r.vReq, 'm³');
    s('Tank summary', 'Total footprint area', 'A_total', 'Σ A_row', r.aTotal, 'm²');
    s('Minimum length', 'Max diameter for length', 'D_len', 'MAX(D_max)', r.dLen, 'm');
    s('Minimum length', 'Tanks in longest row', 'n_row', 'MAX(n)', r.nRow, 'tanks', 0);
    s('Minimum length', 'Gaps between tanks', 'n_gaps', 'n_row − 1', r.nGaps, 'gaps', 0);
    s('Minimum length', 'MINIMUM BUND LENGTH', 'L_min', '(D_len×n_row)+(n_gaps×S_tank)+(2×S_bund)', r.Lmin, 'm');
    s('Minimum width', 'Sum of row max diameters', 'ΣD_max', 'D1+D2+…', r.sumDmax, 'm');
    s('Minimum width', 'Gaps between rows', 'S_row', '(rows−1)×S_tank', (r.nRows - 1) * sTank, 'm');
    s('Minimum width', 'MINIMUM BUND WIDTH', 'W_min', 'ΣD_max+(rows−1)×S_tank+(2×S_bund)', r.Wmin, 'm');
    var hs = p.mode === 'check' ? 'Required height (actual bund)' : 'Minimum height';
    s(hs, 'Bund plan area', 'A_bund', p.mode === 'check' ? 'L × W (actual)' : 'L_min × W_min', r.aBund, 'm²');
    s(hs, p.disp === 'exceptLargest' ? 'Footprint of other tanks' : 'Total tank footprint', 'A_tanks', p.disp === 'exceptLargest' ? 'A_total − A_largest' : 'A_total', r.aDisp, 'm²');
    s(hs, 'Effective bund area', 'A_effective', 'A_bund − A_tanks', r.aEff, 'm²');
    s(hs, 'CALCULATED BUND HEIGHT', 'H_calc', (factor !== 1 ? 'V_req' : 'V_largest') + ' / A_effective', r.Hreq, 'm', 4);
    s(hs, 'RECOMMENDED HEIGHT (rounded up)', 'H_rec', 'CEILING(H_calc, 0.1)', r.HreqRec, 'm', 2);
    var ds = p.mode === 'check' ? 'Existing bund' : 'Recommended design';
    s(ds, 'Bund length', 'L', p.mode === 'check' ? 'actual' : 'CEILING(L_min, 0.1)', r.L, 'm', 2);
    s(ds, 'Bund width', 'W', p.mode === 'check' ? 'actual' : 'CEILING(W_min, 0.1)', r.W, 'm', 2);
    s(ds, 'Bund height', 'H', p.mode === 'check' ? 'actual' : 'H_rec', r.H, 'm', 2);
    s(ds, 'Bund internal volume', 'V_bund', 'L × W × H', r.vBund, 'm³');
    s(ds, 'Tank displacement in bund', 'V_disp', 'A_tanks × H', r.vDisp, 'm³');
    s(ds, 'Effective available volume', 'V_eff', 'V_bund − V_disp', r.vEff, 'm³');
    r.working = w;
    return r;
  }

  // Self-test cases taken from the spreadsheet
  function selfTest() {
    var out = [];
    function near(a, b, tol) { return Math.abs(a - b) <= tol; }
    function t(caseName, label, got, exp, tol) { out.push({ c: caseName, label: label, got: got, exp: exp, ok: near(got, exp, tol) }); }

    var p = defaultProject(), r = calc(p), c = '1. Design – default 14 tanks';
    t(c, 'Row 1 tank volume', r.tanks[0].v, 51.035, 0.001);
    t(c, 'Row 2 tank volume', r.tanks[7].v, 76.553, 0.001);
    t(c, 'V_largest', r.vLargest, 76.553, 0.001);
    t(c, 'A_total', r.aTotal, 89.312, 0.001);
    t(c, 'L_min', r.Lmin, 28.95, 0.0005);
    t(c, 'W_min', r.Wmin, 9.70, 0.0005);
    t(c, 'A_bund', r.aBund, 280.815, 0.001);
    t(c, 'A_effective', r.aEff, 191.503, 0.001);
    t(c, 'H_calc', r.Hcalc, 0.3997, 0.0001);
    t(c, 'H_rec', r.Hrec, 0.4, 1e-9);
    t(c, 'L_rec', r.Lrec, 29.0, 1e-9);
    t(c, 'W_rec', r.Wrec, 9.7, 1e-9);
    t(c, 'V_bund', r.vBund, 112.52, 0.001);
    t(c, 'V_disp', r.vDisp, 35.725, 0.001);
    t(c, 'V_eff', r.vEff, 76.795, 0.001);
    out.push({ c: c, label: 'Overall COMPLIANT', got: r.ok ? 'yes' : 'no', exp: 'yes', ok: r.ok });

    p = defaultProject(); p.mode = 'check'; p.actual = { L: 29.591, W: 10.51, H: 1.5 };
    r = calc(p); c = '2. Check – existing 29.591 × 10.51 × 1.5 m';
    t(c, 'V_bund', r.vBund, 466.502, 0.001);
    t(c, 'V_eff', r.vEff, 332.535, 0.001);
    out.push({ c: c, label: 'Length / width / height COMPLIANT', got: r.ok ? 'yes' : 'no', exp: 'yes', ok: r.ok });

    p = defaultProject(); p.mode = 'check'; p.actual = { L: 29.13, W: 10.10, H: 0.5 };
    p.rows[1].tanks[0].v = 83;
    r = calc(p); c = '3. Wall Height sheet – 29.13 × 10.10 m, 83 m³ largest';
    t(c, 'V_largest', r.vLargest, 83, 1e-9);
    t(c, 'H_calc', r.Hreq, 0.405, 0.0005);
    t(c, 'H_rec', r.HreqRec, 0.5, 1e-9);
    return out;
  }

  root.BWC = { calc: calc, defaultProject: defaultProject, selfTest: selfTest, ceilStep: ceilStep, round: round, num: num };
  if (typeof module !== 'undefined') module.exports = root.BWC;
})(typeof window !== 'undefined' ? window : globalThis);
