/* Bund Wall Calculator – tiny offline PDF writer (text, lines, boxes, JPEG images) + report layout */
(function (root) {
  'use strict';
  var PW = 595.28, PH = 841.89; // A4 points

  function ansi(s) {
    s = String(s == null ? '' : s)
      .replace(/⌀/g, 'Ø').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[−–—]/g, '-')
      .replace(/✓/g, '').replace(/✗/g, '').replace(/Σ\s?/g, 'Sum ').replace(/π/g, 'pi')
      .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/…/g, '...').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    var o = '';
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); o += c < 256 ? s[i] : '?'; }
    return o;
  }
  function escPdf(s) { return ansi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function rgb(hex) { hex = (hex || '#000').replace('#', ''); var n = parseInt(hex, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(function (v) { return v.toFixed(3); }).join(' '); }
  function textW(s, size, bold) {
    s = ansi(s); var w = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (/[0-9]/.test(ch)) w += 556; else if (/[.,:;' ]/.test(ch)) w += 278; else if (/[il|]/.test(ch)) w += 240; else if (/[mwMW]/.test(ch)) w += 860;
      else if (/[A-Z]/.test(ch)) w += 680; else w += 520;
    }
    return w / 1000 * size * (bold ? 1.06 : 1);
  }

  function Doc() { this.pages = []; this.images = []; this.page(); }
  Doc.prototype.page = function () { this.ops = []; this.pages.push(this.ops); this.y = 40; return this; };
  Doc.prototype.text = function (x, y, s, size, o) {
    o = o || {}; size = size || 10;
    if (o.align === 'right') x -= textW(s, size, o.bold); else if (o.align === 'center') x -= textW(s, size, o.bold) / 2;
    this.ops.push('BT /' + (o.bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + rgb(o.color || '#18202b') + ' rg ' + x.toFixed(2) + ' ' + (PH - y).toFixed(2) + ' Td (' + escPdf(s) + ') Tj ET');
  };
  Doc.prototype.line = function (x1, y1, x2, y2, w, color) {
    this.ops.push((w || 0.5) + ' w ' + rgb(color || '#c8ced6') + ' RG ' + x1.toFixed(2) + ' ' + (PH - y1).toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + (PH - y2).toFixed(2) + ' l S');
  };
  Doc.prototype.rect = function (x, y, w, h, fill, stroke) {
    var s = x.toFixed(2) + ' ' + (PH - y - h).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re ';
    if (fill && stroke) this.ops.push(rgb(fill) + ' rg ' + rgb(stroke) + ' RG 0.6 w ' + s + 'B');
    else if (fill) this.ops.push(rgb(fill) + ' rg ' + s + 'f');
    else this.ops.push(rgb(stroke || '#000') + ' RG 0.6 w ' + s + 'S');
  };
  Doc.prototype.image = function (canvas, x, y, w, h) {
    var data = atob(canvas.toDataURL('image/jpeg', 0.92).split(',')[1]);
    var id = 'Im' + (this.images.length + 1);
    this.images.push({ id: id, w: canvas.width, h: canvas.height, data: data });
    this.ops.push('q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' + x.toFixed(2) + ' ' + (PH - y - h).toFixed(2) + ' cm /' + id + ' Do Q');
  };
  Doc.prototype.output = function () {
    var objs = [], self = this;
    function add(s) { objs.push(s); return objs.length; }
    var cat = add(null), pages = add(null);
    var f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    var f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    var xo = [];
    this.images.forEach(function (im) {
      var n = add('<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + im.data.length + ' >>\nstream\n' + im.data + '\nendstream');
      xo.push('/' + im.id + ' ' + n + ' 0 R');
    });
    var kids = [];
    this.pages.forEach(function (ops) {
      var content = ops.join('\n');
      var c = add('<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
      var p = add('<< /Type /Page /Parent ' + pages + ' 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> /XObject << ' + xo.join(' ') + ' >> >> /Contents ' + c + ' 0 R >>');
      kids.push(p + ' 0 R');
    });
    objs[cat - 1] = '<< /Type /Catalog /Pages ' + pages + ' 0 R >>';
    objs[pages - 1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
    var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', offs = [];
    objs.forEach(function (o, i) { offs.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    var xref = out.length;
    out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n';
    offs.forEach(function (o) { out += ('0000000000' + o).slice(-10) + ' 00000 n \n'; });
    out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  };

  /* ---------- Report layout ---------- */
  function fx(v, d) { return isFinite(v) ? (+v).toFixed(d == null ? 3 : d) : '–'; }

  function report(p, r, imgs, version) {
    var d = new Doc(), M = 40, CW = PW - 2 * M;
    var info = p.info || {};
    var pageNo = 1;
    function header() {
      d.rect(0, 0, PW, 54, '#16324f');
      d.text(M, 24, 'BUND WALL CALCULATION – SANS 10089-1', 15, { bold: true, color: '#ffffff' });
      d.text(M, 41, (info.project || 'Untitled project') + (info.client ? '  ·  ' + info.client : ''), 10, { color: '#d6e2ef' });
      d.text(PW - M, 24, info.date || '', 10, { align: 'right', color: '#ffffff' });
      d.text(PW - M, 41, 'Page ' + pageNo, 9, { align: 'right', color: '#d6e2ef' });
      d.y = 76;
    }
    function footer() { d.text(M, PH - 22, 'Bund Wall Calculator ' + version + ' – verify against current SANS 10089-1 before final design.', 7.5, { color: '#7a828e' }); }
    function newPage() { footer(); d.page(); pageNo++; header(); }
    function need(h) { if (d.y + h > PH - 40) newPage(); }
    function h2(s) { need(30); d.text(M, d.y + 4, s, 12, { bold: true, color: '#16324f' }); d.line(M, d.y + 9, PW - M, d.y + 9, 1, '#16324f'); d.y += 22; }

    header();
    // project block
    var rows = [['Project', info.project], ['Client', info.client], ['Site', info.site], ['Prepared by', info.by], ['Mode', p.mode === 'check' ? 'Check existing bund' : 'Design (minimum bund)']];
    rows.forEach(function (rw, i) {
      var x = M + (i % 2) * (CW / 2), y = d.y + Math.floor(i / 2) * 15;
      d.text(x, y, rw[0] + ':', 9, { color: '#5d6878' }); d.text(x + 70, y, rw[1] || '–', 9.5, { bold: true });
    });
    d.y += Math.ceil(rows.length / 2) * 15 + 6;

    // result box
    var ok = r.ok;
    d.rect(M, d.y, CW, 46, ok ? '#1e8a4c' : '#c62828');
    d.text(M + 12, d.y + 19, ok ? 'SANS 10089-1 COMPLIANT' : 'NON-COMPLIANT', 14, { bold: true, color: '#ffffff' });
    d.text(M + 12, d.y + 36, 'Bund ' + fx(r.L, 2) + ' m × ' + fx(r.W, 2) + ' m × ' + fx(r.H, 2) + ' m   ·   Required height ' + fx(r.Hreq, 3) + ' m (rounded ' + fx(r.HreqRec, 2) + ' m)', 9.5, { color: '#ffffff' });
    d.y += 60;

    // KPIs
    var k = [['L_min', fx(r.Lmin, 2) + ' m'], ['W_min', fx(r.Wmin, 2) + ' m'], ['H_calc', fx(r.Hreq, 3) + ' m'], ['V_largest', fx(r.vLargest, 2) + ' m³'], ['V_bund', fx(r.vBund, 2) + ' m³'], ['V_eff', fx(r.vEff, 2) + ' m³']];
    var kw = CW / 6;
    k.forEach(function (it, i) {
      d.rect(M + i * kw + 2, d.y, kw - 4, 36, '#f1f4f8', '#d9dfe7');
      d.text(M + i * kw + 8, d.y + 13, it[0], 7.5, { color: '#5d6878' });
      d.text(M + i * kw + 8, d.y + 28, it[1], 10, { bold: true });
    });
    d.y += 48;

    // 3D image
    if (imgs.mimic) {
      var ih = Math.min(CW * imgs.mimic.height / imgs.mimic.width, PH - 60 - d.y);
      var iw = ih * imgs.mimic.width / imgs.mimic.height;
      d.image(imgs.mimic, M + (CW - iw) / 2, d.y, iw, ih); d.y += ih + 10;
    }

    // tank schedule
    newPage();
    h2('Tank schedule');
    var cols = [M, M + 50, M + 200, M + 280, M + 360, M + 440];
    function th(labels) { need(18); labels.forEach(function (l, i) { d.text(cols[i] + (i > 1 ? 70 : 0), d.y, l, 8, { bold: true, color: '#5d6878', align: i > 1 ? 'right' : 'left' }); }); d.y += 6; d.line(M, d.y, PW - M, d.y); d.y += 12; }
    th(['Tank', 'Row', 'Ø (m)', 'Height (m)', 'Area (m²)', 'Volume (m³)']);
    r.tanks.forEach(function (t) {
      need(14);
      var vals = ['T' + t.no + (t === r.largest ? ' (largest)' : ''), r.rows[t.row].name, fx(t.d, 2), fx(t.h, 2), fx(t.area, 3), fx(t.v, 3) + (t.vOverride ? '*' : '')];
      vals.forEach(function (v, i) { d.text(cols[i] + (i > 1 ? 70 : 0), d.y, v, 8.5, { align: i > 1 ? 'right' : 'left', bold: t === r.largest }); });
      d.y += 13;
    });
    if (r.tanks.some(function (t) { return t.vOverride; })) { d.text(M, d.y, '* nominal volume entered manually', 7.5, { color: '#5d6878' }); d.y += 12; }
    d.y += 4;
    d.text(M, d.y, 'Spacing: tank-to-tank S_tank = ' + fx(r.sTank, 2) + ' m, tank-to-bund S_bund = ' + fx(r.sBund, 2) + ' m. Containment: ' + fx(r.factor * 100, 0) + '% of largest tank. Displacement: ' + (p.disp === 'exceptLargest' ? 'all tanks except largest.' : 'all tank footprints.'), 8.5, { color: '#3b4250' });
    d.y += 22;

    // working
    h2('Calculation working');
    var sec = '';
    r.working.forEach(function (s) {
      if (s.sec !== sec) { need(30); sec = s.sec; d.rect(M, d.y - 9, CW, 14, '#eef1f5'); d.text(M + 4, d.y + 1, sec.toUpperCase(), 8, { bold: true, color: '#5d6878' }); d.y += 16; }
      need(14);
      var key = /[A-Z]/.test(s.desc) && s.desc === s.desc.toUpperCase();
      d.text(M + 4, d.y, s.desc, 8.5, { bold: key });
      d.text(M + 215, d.y, s.sym, 8.5, { color: '#16324f', bold: true });
      d.text(M + 290, d.y, s.f, 7.5, { color: '#5d6878' });
      d.text(PW - M - 4, d.y, fx(s.v, s.dp) + ' ' + s.u, 8.5, { align: 'right', bold: key });
      d.y += 13;
    });
    d.y += 10;

    h2('Compliance verification');
    var cc = [M + 4, M + 300, M + 370, M + 440, PW - M - 4];
    need(18);
    ['Check', 'Required', 'Provided', 'Margin', 'Status'].forEach(function (l, i) { d.text(cc[i], d.y, l, 8, { bold: true, color: '#5d6878', align: i ? 'right' : 'left' }); });
    d.y += 6; d.line(M, d.y, PW - M, d.y); d.y += 12;
    r.checks.forEach(function (c) {
      need(14);
      var dp = c.unit === 'm³' ? 2 : 2;
      d.text(cc[0], d.y, c.name, 8.5);
      d.text(cc[1], d.y, fx(c.req, dp + 1) + ' ' + c.unit, 8.5, { align: 'right' });
      d.text(cc[2], d.y, fx(c.prov, dp + 1) + ' ' + c.unit, 8.5, { align: 'right' });
      d.text(cc[3], d.y, fx(c.margin, dp + 1), 8.5, { align: 'right' });
      d.text(cc[4], d.y, c.ok ? 'COMPLIANT' : 'NON-COMPLIANT', 8.5, { align: 'right', bold: true, color: c.ok ? '#1e8a4c' : '#c62828' });
      d.y += 13;
    });

    // drawings
    newPage();
    h2('Drawings (to scale)');
    ['plan', 'elev'].forEach(function (n) {
      var c = imgs[n]; if (!c) return;
      var w = CW, h = w * c.height / c.width;
      if (h > (PH - 120) / 2) { h = (PH - 120) / 2; w = h * c.width / c.height; }
      need(h + 10);
      d.image(c, M + (CW - w) / 2, d.y, w, h); d.y += h + 16;
    });
    footer();
    return d.output();
  }

  root.BWPdf = { Doc: Doc, report: report };
})(typeof window !== 'undefined' ? window : globalThis);
