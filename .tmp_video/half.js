const fs = require("fs");
const { encodeRGBA } = require("./jpeg.js");
const W = 768, H = 448;
const buf = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const p = (y * W + x) * 4;
  if (x < W / 2) { buf[p] = 220; buf[p + 1] = 50; buf[p + 2] = 50; }      /* 左半红 */
  else { buf[p] = 50; buf[p + 1] = 50; buf[p + 2] = 220; }                /* 右半蓝 */
  buf[p + 3] = 255;
}
fs.writeFileSync("half.jpg", encodeRGBA(buf, W, H, 72));
const flat = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { const p = i * 4; flat[p] = 220; flat[p + 1] = 50; flat[p + 2] = 50; flat[p + 3] = 255; }
fs.writeFileSync("flat-red.jpg", encodeRGBA(flat, W, H, 72));
console.log("ok");
