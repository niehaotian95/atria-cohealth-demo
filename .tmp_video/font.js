/* 纯 JS 中文字形光栅化：解析 TTF/TTC → cmap → glyf 轮廓（二次曲线细分）→ 扫描线填充（2x2 超采样）
 * 用于无浏览器沙箱里的演示视频字幕渲染。轮廓一律用「字形空间、y 向上」，绘制时再翻到屏幕坐标。 */
"use strict";
const fs = require("fs");

function openFont(path) {
  const buf = fs.readFileSync(path);
  const tag = buf.toString("ascii", 0, 4);
  let off = 0;
  if (tag === "ttcf") off = buf.readUInt32BE(12);   /* 第一个 face（tag4+ver4+num4 → 偏移表在 12） */
  const numTables = buf.readUInt16BE(off + 4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const de = off + 12 + i * 16;
    tables[buf.toString("ascii", de, de + 4)] = { off: buf.readUInt32BE(de + 8), len: buf.readUInt32BE(de + 12) };
  }
  const head = tables["head"], maxp = tables["maxp"], hhea = tables["hhea"], hmtx = tables["hmtx"];
  const upem = buf.readInt16BE(head.off + 18);
  const numGlyphs = buf.readUInt16BE(maxp.off + 4);
  const indexToLocFmt = buf.readInt16BE(head.off + 50);
  const numberOfHMetrics = buf.readUInt16BE(hhea.off + 34);
  const ascent = buf.readInt16BE(hhea.off + 4);
  const descent = buf.readInt16BE(hhea.off + 6);

  /* cmap：优先 format12（(3,10) 或 (0,4)），其次 format4 */
  const cmap = tables["cmap"];
  const numSub = buf.readUInt16BE(cmap.off + 2);
  let mapOff = -1, mapFmt = 0;
  const pref = [[3, 10], [0, 4], [3, 1], [0, 3], [0, 2]];
  outer: for (const [p, e] of pref) {
    for (let i = 0; i < numSub; i++) {
      const rec = cmap.off + 4 + i * 8;
      if (buf.readUInt16BE(rec) !== p || buf.readUInt16BE(rec + 2) !== e) continue;
      const o = cmap.off + buf.readUInt32BE(rec + 4);
      const f = buf.readUInt16BE(o);
      if (f === 12 || f === 4) { mapOff = o; mapFmt = f; break outer; }
    }
  }
  if (mapOff < 0) throw new Error("no usable cmap subtable");
  const fnGid = mapFmt === 12 ? (cp) => {
    const n = buf.readUInt32BE(mapOff + 12);
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, g = mapOff + 16 + mid * 12;
      const s = buf.readUInt32BE(g), e = buf.readUInt32BE(g + 4);
      if (cp < s) hi = mid - 1; else if (cp > e) lo = mid + 1;
      else return buf.readUInt32BE(g + 8) + (cp - s);
    }
    return 0;
  } : (cp) => {
    const sc = buf.readUInt16BE(mapOff + 6) >> 1;
    const endOff = mapOff + 14, startOff = endOff + sc * 2 + 2, deltaOff = startOff + sc * 2, rangeOff = deltaOff + sc * 2;
    let seg = -1;
    for (let i = 0; i < sc; i++) if (buf.readUInt16BE(endOff + i * 2) >= cp) { seg = i; break; }
    if (seg < 0) return 0;
    if (buf.readUInt16BE(startOff + seg * 2) > cp) return 0;
    const delta = buf.readInt16BE(deltaOff + seg * 2);
    const ro = buf.readUInt16BE(rangeOff + seg * 2);
    if (ro === 0) return (cp + delta) & 0xffff;
    return (buf.readUInt16BE(rangeOff + seg * 2 + ro + (cp - buf.readUInt16BE(startOff + seg * 2)) * 2) + delta) & 0xffff;
  };

  const loca = tables["loca"], glyf = tables["glyf"];
  function glyphRaw(gid) {
    if (indexToLocFmt === 0) {
      const a = buf.readUInt16BE(loca.off + gid * 2) * 2, b = buf.readUInt16BE(loca.off + (gid + 1) * 2) * 2;
      return a === b ? null : [glyf.off + a, b - a];
    }
    const a = buf.readUInt32BE(loca.off + gid * 4), b = buf.readUInt32BE(loca.off + gid * 4 + 4);
    return a === b ? null : [glyf.off + a, b - a];
  }

  /* 取轮廓（字形空间，y 上）。二次曲线细分为 4 段。复合字形按平移/缩放递归 */
  function readGlyph(gid, m /* {sx,sy,dx,dy} */, out, depth) {
    if (depth > 6 || gid <= 0) return;
    const raw = glyphRaw(gid);
    if (!raw) return;
    const base = raw[0], len = raw[1];
    if (len <= 0) return;
    const n = buf.readInt16BE(base);
    if (n >= 0) {
      const endPts = [];
      for (let i = 0; i < n; i++) endPts.push(buf.readUInt16BE(base + 10 + i * 2));
      const instLen = buf.readUInt16BE(base + 10 + n * 2);
      let p = base + 12 + n * 2 + instLen;
      const cnt = endPts[n - 1] + 1;
      const x = new Float64Array(cnt), y = new Float64Array(cnt), on = new Uint8Array(cnt);
      let cur = 0, i = 0;
      while (i < cnt) {
        const fl = buf[p++];
        let rep = 1;
        if (fl & 0x08) rep = 1 + buf[p++];
        for (let r = 0; r < rep && i < cnt; r++, i++) {
          on[i] = fl & 1;
          if (fl & 0x02) { const d = buf[p++]; cur += (fl & 0x10) ? d : -d; }
          x[i] = cur;
        }
      }
      cur = 0; i = 0;
      while (i < cnt) {
        const fl = on[i] !== undefined ? 0 : 0;   /* 占位：y 的 flag 与 x 同字节 */
        i++;
      }
      /* y 需用同一组 flag 重读：回退重扫 */
      p = base + 12 + n * 2 + instLen;
      { const flags2 = new Uint8Array(cnt); let j = 0;
        while (j < cnt) {
          const fl = buf[p++];
          let rep = 1;
          if (fl & 0x08) rep = 1 + buf[p++];
          for (let r = 0; r < rep && j < cnt; r++, j++) flags2[j] = fl;
        }
        /* 重读 x 增量 */
        let cx = 0; j = 0;
        while (j < cnt) {
          const fl = flags2[j];
          let rep = 1;
          if (fl & 0x08) rep = 1 + buf[p++];
          for (let r = 0; r < rep && j < cnt; r++, j++) {
            if (fl & 0x02) { const d = buf[p++]; cx += (fl & 0x10) ? d : -d; }
            x[j] = cx;
          }
        }
        /* 读 y 增量 */
        let cy = 0; j = 0;
        while (j < cnt) {
          const fl = flags2[j];
          if (fl & 0x04) { const d = buf[p++]; cy += (fl & 0x20) ? d : -d; }
          else if (!(fl & 0x20)) { cy += buf.readInt16BE(p); p += 2; }
          y[j] = cy;
          j++;
        }
        /* on[] 与 flags2 的 bit0 一致 */
        for (let k = 0; k < cnt; k++) on[k] = flags2[k] & 1;
      }
      /* 分轮廓 + 二次曲线细分 */
      let s = 0;
      const N = 4;
      for (const e of endPts) {
        const pts = [];
        const push = (px, py, po) => pts.push([px, py, po]);
        /* 先把本轮廓的点收集成 [{x,y,on}]，起点补全 */
        const cpts = [];
        for (let k = s; k <= e; k++) cpts.push([x[k], y[k], on[k] ? 1 : 0]);
        /* 若首/尾是 off-curve，补隐式起点 */
        const m0 = cpts.length;
        if (!cpts[0][2] && !cpts[m0 - 1][2]) {
          cpts.unshift([(cpts[0][0] + cpts[m0 - 1][0]) / 2, (cpts[0][1] + cpts[m0 - 1][1]) / 2, 1]);
        } else if (!cpts[0][2]) {
          cpts.unshift([...cpts[m0 - 1]]);
        }
        /* 平滑：连续 off-curve 中间补隐式点 */
        const smooth = [];
        for (let k = 0; k < cpts.length; k++) {
          const a = cpts[k], b = cpts[(k + 1) % cpts.length];
          smooth.push(a);
          if (!a[2] && !b[2]) smooth.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1]);
        }
        for (let k = 0; k < smooth.length; k++) {
          const a = smooth[k], b = smooth[(k + 1) % smooth.length];
          if (!a[2] && !b[2]) continue;
          if (a[2] && b[2]) { push(a[0], a[1], 1); continue; }
          /* 一段二次：a(起点) → 控制点 → 终点 */
          let p0, ctrl, p1;
          if (!a[2]) { p0 = smooth[(k - 1 + smooth.length) % smooth.length]; ctrl = a; p1 = b; }
          else { p0 = a; ctrl = b; p1 = smooth[(k + 2) % smooth.length]; }
          push(p0[0], p0[1], 1);
          for (let q = 1; q < N; q++) {
            const t = q / N, it = 1 - t;
            push(it * it * ctrl[0] + 2 * it * t * p1[0] + t * t * p1[0] * 0 + (p1[0] * t * t), 0, 0);
            const X = it * it * p0[0] + 2 * it * t * ctrl[0] + t * t * p1[0];
            const Y = it * it * p0[1] + 2 * it * t * ctrl[1] + t * t * p1[1];
            pts[pts.length - 1][0] = X; pts[pts.length - 1][1] = Y; pts[pts.length - 1][2] = 0;
          }
        }
        /* 变换到 m 空间 */
        const tf = (pt) => { pt[0] = pt[0] * m.sx + m.dx; pt[1] = pt[1] * m.sy + m.dy; };
        for (const pt of pts) tf(pt);
        out.push(pts.filter(pt => pt[2] === 1 || pt[2] === 0).map(pt => [pt[0], pt[1], pt[2] === 1 ? 1 : 0]));
        s = e + 1;
      }
    } else {
      /* 复合 */
      let p = base + 10;
      for (;;) {
        const fl = buf.readUInt16BE(p); p += 2;
        const gidx = buf.readUInt16BE(p); p += 2;
        const words = !!(fl & 0x0002), xy = !!(fl & 0x0001);
        let a1 = 0, a2 = 0;
        if (words) { a1 = buf.readInt16BE(p); a2 = buf.readInt16BE(p + 2); p += 4; }
        else { a1 = buf.readInt8(p); a2 = buf.readInt8(p + 1); p += 2; }
        let sx = 1, sy = 1;
        if (fl & 0x0008) { sx = sy = buf.readInt16BE(p) / 16384; p += 2; }
        else if (fl & 0x0040) { sx = buf.readInt16BE(p) / 16384; sy = buf.readInt16BE(p + 2) / 16384; p += 4; }
        else if (fl & 0x0080) { p += 8; }
        const sub = { sx: m.sx * sx, sy: m.sy * sy, dx: m.dx + (xy ? a1 : 0) * m.sx, dy: m.dy + (xy ? a2 : 0) * m.sy };
        readGlyph(gidx, sub, out, depth + 1);
        if (!(fl & 0x0020)) break;
      }
    }
  }

  return {
    upem, numGlyphs, ascent, descent,
    glyphId: (ch) => fnGid(ch.codePointAt(0)),
    contours: (gid) => { const out = []; readGlyph(gid, { sx: 1, sy: 1, dx: 0, dy: 0 }, out, 0); return out; },
    advance: (gid) => gid < numberOfHMetrics
      ? buf.readUInt16BE(hmtx.off + gid * 4)
      : buf.readUInt16BE(hmtx.off + (numberOfHMetrics - 1) * 4 + 2),
  };
}

/* 扫描线填充：contours 为屏幕空间（y 向下）像素坐标 */
function rasterizeScreen(contours, w, h, ss) {
  const W = w * ss, H = h * ss;
  const cv = new Uint8Array(W * H);
  const edges = [];
  for (const c of contours) {
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      if (a[1] === b[1]) continue;
      edges.push([a[0] * ss, a[1] * ss, b[0] * ss, b[1] * ss]);
    }
  }
  if (!edges.length) return cv;
  let yMin = H, yMax = -1;
  for (const e of edges) {
    yMin = Math.min(yMin, Math.floor(Math.min(e[1], e[3])));
    yMax = Math.max(yMax, Math.ceil(Math.max(e[1], e[3])));
  }
  yMin = Math.max(0, yMin); yMax = Math.min(H - 1, yMax);
  const xs = [];
  for (let y = yMin; y <= yMax; y++) {
    const ym = y + 0.5;
    xs.length = 0;
    for (const e of edges) {
      if ((e[1] <= ym && ym < e[3]) || (e[3] <= ym && ym < e[1])) {
        xs.push(e[0] + (ym - e[1]) * (e[2] - e[0]) / (e[3] - e[1]));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i] - 0.5)), x1 = Math.min(W - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = x0; x <= x1; x++) cv[y * W + x] = 1;
    }
  }
  return cv;
}
function superview(cv, w, h, ss) {
  const out = new Float64Array(w * h), W = w * ss;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) s += cv[(y * ss + dy) * W + (x * ss + dx)];
    out[y * w + x] = s / (ss * ss);
  }
  return out;
}

function drawText(font, buf, W, H, text, x, y, size, color) {
  const scale = size / font.upem;
  let cx = x;
  const baseY = y + size * (font.ascent / font.upem);
  const ss = 2;
  for (const ch of text) {
    if (ch === " " || ch === "\u3000") { cx += size * 0.3; continue; }
    if (ch === "\n") { cx = x; continue; }
    const gid = font.glyphId(ch);
    if (gid <= 0) { cx += size * 0.5; continue; }
    const contours = font.contours(gid);
    if (!contours.length) { cx += font.advance(gid) * scale; continue; }
    let xmin = 1e9, ymin = 1e9, xmax = -1e9, ymax = -1e9;
    for (const c of contours) for (const p of c) {
      if (p[0] < xmin) xmin = p[0]; if (p[0] > xmax) xmax = p[0];
      if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1];
    }
    const pw = Math.max(1, Math.ceil((xmax - xmin) * scale) + 2);
    const ph = Math.max(1, Math.ceil((ymax - ymin) * scale) + 2);
    const px = Math.floor(cx + xmin * scale) - 1;
    const py = Math.floor(baseY - ymax * scale) - 1;
    /* 转到屏幕坐标（y 下）的小场景 */
    const local = contours.map(c => c.map(p => [(p[0] - xmin) * scale, (ymax - p[1]) * scale]));
    const cv = rasterizeScreen(local, pw, ph, ss);
    const cov = superview(cv, pw, ph, ss);
    const r = color[0], g = color[1], b = color[2];
    for (let yy = 0; yy < ph; yy++) for (let xx = 0; xx < pw; xx++) {
      const bx = px + xx, by = py + yy;
      if (bx < 0 || by < 0 || bx >= W || by >= H) continue;
      const a = cov[yy * pw + xx];
      if (a <= 0.02) continue;
      const p = (by * W + bx) * 4;
      buf[p] = Math.round(buf[p] * (1 - a) + r * a);
      buf[p + 1] = Math.round(buf[p + 1] * (1 - a) + g * a);
      buf[p + 2] = Math.round(buf[p + 2] * (1 - a) + b * a);
      buf[p + 3] = 255;
    }
    cx += font.advance(gid) * scale;
  }
  return { endX: cx };
}

function measure(font, text, size) {
  const scale = size / font.upem;
  let w = 0;
  for (const ch of text) w += ch === " " ? size * 0.3 : font.advance(font.glyphId(ch)) * scale;
  return { width: w, ascent: size * font.ascent / font.upem, descent: size * (-font.descent) / font.upem };
}

function pickFont() {
  const dir = "C:\\Windows\\Fonts";
  for (const c of ["msyh.ttc", "msyhbd.ttc", "simsun.ttc", "simhei.ttf", "msyhl.ttc"]) {
    const p = dir + "\\" + c;
    if (fs.existsSync(p)) return p;
  }
  throw new Error("no CJK font in " + dir);
}

module.exports = { openFont, drawText, measure, pickFont, rasterizeScreen, superview };
