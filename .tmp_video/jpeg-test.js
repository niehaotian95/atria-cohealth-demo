/* jpeg.js 自测：渲染一张 768x448 的合成图 → JPEG → 交 ffmpeg 解码转 PNG → 我亲眼看 */
const fs = require("fs");
const { encodeRGBA } = require("./jpeg.js");
const W = 768, H = 448;
const buf = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = (y * W + x) * 4;
  buf[p] = (x * 255 / W) | 0; buf[p + 1] = (y * 255 / H) | 0; buf[p + 2] = 128; buf[p + 3] = 255;
}
/* 叠几块纯色矩形 + 白色十字 */
function rect(x0, y0, w, h, r, g, b) {
  for (let y = y0; y < y0 + h && y < H; y++) for (let x = x0; x < x0 + w && x < W; x++) {
    const p = (y * W + x) * 4;
    buf[p] = r; buf[p + 1] = g; buf[p + 2] = b;
  }
}
rect(60, 60, 200, 120, 30, 64, 175);
rect(320, 200, 150, 150, 220, 90, 43);
for (let x = 0; x < W; x++) { rect(x, H / 2 - 2, 1, 5, 255, 255, 255); }
const t0 = Date.now();
const jpeg = encodeRGBA(buf, W, H, 72);
const ms = Date.now() - t0;
fs.writeFileSync("jpeg-test.jpg", jpeg);
console.log("encode ms:", ms, "bytes:", jpeg.length, "first bytes:", jpeg.slice(0, 2).toString("hex"), jpeg.slice(-2).toString("hex"));
