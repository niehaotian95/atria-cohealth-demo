const fs = require("fs");
const { encodeRGBA } = require("./jpeg.js");
const W = 768, H = 448;

function enc(buf, file) {
  const jpeg = encodeRGBA(buf, W, H, 72);
  fs.writeFileSync(file, jpeg);
  console.log(file, jpeg.length, "bytes");
}

/* 1）只有渐变 */
{
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4;
    buf[p] = (x * 255 / W) | 0; buf[p + 1] = (y * 255 / H) | 0; buf[p + 2] = 128; buf[p + 3] = 255;
  }
  enc(buf, "case-grad.jpg");
}
/* 2）只有纯色矩形 */
{
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) { const p = i * 4; buf[p] = 20; buf[p + 1] = 40; buf[p + 2] = 90; buf[p + 3] = 255; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x > 100 && x < 300 && y > 100 && y < 300) { const p = (y * W + x) * 4; buf[p] = 200; buf[p + 1] = 120; buf[p + 2] = 60; }
  }
  enc(buf, "case-rect.jpg");
}
