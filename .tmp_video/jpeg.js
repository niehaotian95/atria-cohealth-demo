/* 纯 JS baseline JPEG 编码器（JFIF，YUV420 同一扫描内交错）
 * 无第三方依赖；沙箱无浏览器时用它把 RGBA 帧编码进演示视频。 */
"use strict";

/* zigzag：自然序下标 i → 扫描序位置 */
const ZZ = (() => {
  const z = new Uint8Array(64);
  const order = [
    [0, 1, 5, 6, 14, 15, 27, 28], [2, 4, 7, 13, 16, 26, 29, 42],
    [3, 8, 12, 17, 25, 30, 41, 43], [9, 11, 18, 24, 31, 40, 44, 53],
    [10, 19, 23, 32, 39, 45, 52, 54], [20, 22, 33, 38, 46, 51, 55, 60],
    [21, 34, 37, 47, 50, 56, 59, 61], [35, 36, 48, 49, 57, 58, 62, 63]];
  let pos = 0;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) z[pos++] = order[i][j];
  return z;
})();

function scaleQtab(tab, q) {
  if (q < 1) q = 1; if (q > 100) q = 100;
  const f = q < 50 ? 5000 / q : 200 - q * 2;
  const out = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    let v = Math.floor((tab[i] * f + 50) / 100);
    if (v < 1) v = 1; if (v > 255) v = 255;
    out[i] = v;
  }
  return out;
}
const Q_LUM = [16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,18,22,27,40,58,77,65,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
const Q_CHR = [17,18,24,47,99,99,119,119, 18,21,26,66,99,99,119,119, 24,26,56,99,104,119,119,119, 47,66,99,99,104,119,119,119, 99,99,99,99,99,119,119,119, 99,99,99,99,99,119,119,119, 99,99,99,99,99,119,119,119, 99,99,99,99,99,119,119,119];
if (Q_CHR.length !== 64) throw new Error("Q_CHR must have 64 values, got " + Q_CHR.length);

/* Huffman 标准表（Annex K） */
function buildHuff(bits, vals) {
  const tables = new Array(257);
  let code = 0, k = 0;
  for (let len = 1; len <= 16; len++) {
    const cnt = bits[len - 1];
    for (let i = 0; i < cnt; i++) {
      tables[vals[k++]] = { code: code++, len };
    }
    code <<= 1;
  }
  return tables;
}
const BITS_LUM_DC = [0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0], VALS_LUM_DC = [0,1,2,3,4,5,6,7,8,9,10,11];
const BITS_LUM_AC = [0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d];
const VALS_LUM_AC = [
  0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,
  0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,
  0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,
  0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,
  0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,
  0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
  0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,
  0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,
  0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,
  0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
  0xf9,0xfa];
const BITS_CHR_DC = [0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0], VALS_CHR_DC = [0,1,2,3,4,5,6,7,8,9,10,11];
const BITS_CHR_AC = [0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,0x77];
const VALS_CHR_AC = [
  0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,
  0x13,0x22,0x32,0x81,0x08,0x14,0x42,0x91,0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,
  0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,0xe1,0x25,0xf1,0x17,0x18,0x19,0x1a,0x26,
  0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,
  0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,
  0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x82,0x83,0x84,0x85,0x86,0x87,
  0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,
  0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,
  0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,
  0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,
  0xf9,0xfa];

const COS = new Float64Array(64);
for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) COS[i * 8 + j] = Math.cos((2 * i + 1) * j * Math.PI / 16);
const ALPHA = new Float64Array(8); ALPHA[0] = 1 / Math.SQRT2; for (let i = 1; i < 8; i++) ALPHA[i] = 1;
const C = Math.cos, PI = Math.PI;

function BitWriter() { this.bytes = []; this.acc = 0; this.nbits = 0; }
BitWriter.prototype.put = function (code, len) {
  if (len <= 0) return;
  this.acc = (this.acc << len) | (code & ((1 << len) - 1));
  this.nbits += len;
  while (this.nbits >= 8) {
    this.nbits -= 8;
    const b = (this.acc >>> this.nbits) & 0xff;
    this.bytes.push(b);
    if (b === 0xff) this.bytes.push(0);
  }
};
BitWriter.prototype.flush = function () {
  if (this.nbits > 0) this.put((1 << (8 - this.nbits)) - 1, 8 - this.nbits);
};

function huffEncode(w, table, runlen, magnitude) {
  const len = (runlen << 4) | magnitude;
  const h = table[len];
  if (!h) throw new Error("missing huffman code " + len);
  w.put(h.code, h.len);
}

/* block：Float64Array(64) 空间域（-128 基准）→ 量化系数（自然序）写回 */
const _t = new Float64Array(64);
function fdctQuantize(src, qout, qt) {
  for (let y = 0; y < 8; y++) {
    const base = y * 8;
    for (let u = 0; u < 8; u++) {
      let s = 0;
      for (let x = 0; x < 8; x++) s += src[base + x] * COS[x * 8 + u];
      _t[base + u] = s * 0.5;
    }
  }
  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let s = 0;
      for (let y = 0; y < 8; y++) s += _t[y * 8 + u] * COS[y * 8 + v];
      qout[u * 8 + v] = Math.round(s * 0.25 * ALPHA[u] * ALPHA[v] / qt[u * 8 + v]);
    }
  }
}

const _src = new Float64Array(64), _q = new Int16Array(64), _qz = new Int16Array(64);

function encodeRGBA(buf, W, H, quality) {
  if (W % 16 || H % 16) throw new Error("W/H must be multiple of 16, got " + W + "x" + H);
  const qv = quality || 72;
  const ql = scaleQtab(Q_LUM, qv), qc = scaleQtab(Q_CHR, qv);
  const dcL = buildHuff(BITS_LUM_DC, VALS_LUM_DC), acL = buildHuff(BITS_LUM_AC, VALS_LUM_AC);
  const dcC = buildHuff(BITS_CHR_DC, VALS_CHR_DC), acC = buildHuff(BITS_CHR_AC, VALS_CHR_AC);

  const cW = W / 2, cH = H / 2;
  const Y = new Float64Array(W * H), Cb = new Float64Array(cW * cH), Cr = new Float64Array(cW * cH);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const r = buf[p], g = buf[p + 1], b = buf[p + 2];
    Y[i] = 0.299 * r + 0.587 * g + 0.114 * b - 128;
  }
  for (let cy = 0; cy < cH; cy++) {
    for (let cx = 0; cx < cW; cx++) {
      let cb = 0, cr = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const p = ((cy * 2 + dy) * W + (cx * 2 + dx)) * 4;
        cb += (-0.168736 * buf[p] - 0.331264 * buf[p + 1] + 0.5 * buf[p + 2]);
        cr += (0.5 * buf[p] - 0.418688 * buf[p + 1] - 0.081312 * buf[p + 2]);
      }
      Cb[cy * cW + cx] = cb * 0.25;
      Cr[cy * cW + cx] = cr * 0.25;
    }
  }

  const w = new BitWriter();
  const prevDC = [0, 0, 0];

  function encBlock(plane, px, py, stride, qt, dcT, acT, idx) {
    for (let y = 0; y < 8; y++) {
      const base = (py + y) * stride + px;
      for (let x = 0; x < 8; x++) _src[y * 8 + x] = plane[base + x];
    }
    fdctQuantize(_src, _q, qt);
    let q0 = _q[0], diff = q0 - prevDC[idx];
    let dcLen = diff === 0 ? 0 : 32 - Math.clz32(Math.abs(diff));   /* 位长 = log2|v| + 1 */
    huffEncode(w, dcT, 0, dcLen);
    if (diff !== 0) w.put(diff < 0 ? diff + (1 << dcLen) - 1 : diff, dcLen);
    prevDC[idx] = q0;
    let run = 0;
    for (let i = 1; i < 64; i++) {
      const v = _q[ZZ[i]];
      if (v === 0) { run++; continue; }
      while (run > 15) { huffEncode(w, acT, 15, 0); run -= 16; }
      const len = 32 - Math.clz32(Math.abs(v));
      huffEncode(w, acT, run, len);
      w.put(v < 0 ? v + (1 << len) - 1 : v, len);
      run = 0;
    }
    if (run > 0) huffEncode(w, acT, 0, 0);
  }

  const body = [];
  for (let my = 0; my < H / 16; my++) {   /* 顺序位流中途绝不做字节对齐（无 DRI 时对齐=注入伪系数） */
    for (let mx = 0; mx < W / 16; mx++) {
      encBlock(Y, mx * 16, my * 16, W, ql, dcL, acL, 0);
      encBlock(Y, mx * 16 + 8, my * 16, W, ql, dcL, acL, 0);
      encBlock(Y, mx * 16, my * 16 + 8, W, ql, dcL, acL, 0);
      encBlock(Y, mx * 16 + 8, my * 16 + 8, W, ql, dcL, acL, 0);
      encBlock(Cb, mx * 8, my * 8, cW, qc, dcC, acC, 1);
      encBlock(Cr, mx * 8, my * 8, cW, qc, dcC, acC, 2);
    }
  }
  w.flush();   /* 整个扫描结束才补位 */

  const header = [];
  header.push(0xff, 0xd8);                                          /* SOI */
  header.push(0xff, 0xe0, 0x00, 0x10);                              /* APP0 JFIF（len=16：数据 14 字节） */
  for (const ch of "JFIF") header.push(ch.charCodeAt(0));
  header.push(0x00);                                               /* JFIF 标识的 NULL 终止符 */
  header.push(0x00, 0x01, 0x01, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00); /* 版本1.1、单位1、密度1x1、无缩略图 */
  header.push(0xff, 0xdb, 0x00, 0x43, 0x00);                        /* DQT luma */
  for (let i = 0; i < 64; i++) header.push(ql[i]);
  header.push(0xff, 0xdb, 0x00, 0x43, 0x01);                        /* DQT chroma */
  for (let i = 0; i < 64; i++) header.push(qc[i]);
  header.push(0xff, 0xc0, 0x00, 0x11, 8,                            /* SOF0 */
    (H >> 8) & 0xff, H & 0xff, (W >> 8) & 0xff, W & 0xff, 3,
    1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1);
  function dht(bits, vals, id) {
    const len = 2 + 1 + 16 + vals.length;
    header.push(0xff, 0xc4, (len >> 8) & 0xff, len & 0xff, id);
    for (let i = 0; i < 16; i++) header.push(bits[i]);
    for (const v of vals) header.push(v);
  }
  dht(BITS_LUM_DC, VALS_LUM_DC, 0x00);
  dht(BITS_LUM_AC, VALS_LUM_AC, 0x10);
  dht(BITS_CHR_DC, VALS_CHR_DC, 0x01);
  dht(BITS_CHR_AC, VALS_CHR_AC, 0x11);
  header.push(0xff, 0xda, 0x00, 0x0c, 3,                            /* SOS：ns=3，组件 1/2/3 各带表号 */
    1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0);

  return Buffer.concat([
    Buffer.from(header), Buffer.from(w.bytes), Buffer.from([0xff, 0xd9])   /* EOI */
  ]);
}

module.exports = { encodeRGBA };
