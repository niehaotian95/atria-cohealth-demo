const fs = require("fs");
const { openFont, drawText, measure, pickFont } = require("./font.js");
const path = pickFont();
console.log("font:", path);
const f = openFont(path);
console.log("upem:", f.upem, "glyphs:", f.numGlyphs, "ascent:", f.ascent, "descent:", f.descent);
const W = 768, H = 448;
const buf = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { buf[i * 4] = 20; buf[i * 4 + 1] = 24; buf[i * 4 + 2] = 40; buf[i * 4 + 3] = 255; }
const t0 = Date.now();
drawText(f, buf, W, H, "协同体检中心 Atria", 40, 60, 44, [255, 255, 255]);
const ms = Date.now() - t0;
console.log("drawText ms:", ms);
let cov = 0;
for (let i = 0; i < W * H; i++) if (buf[i * 4] > 200) cov++;
console.log("bright pixels:", cov, "(expect >3000 for real glyphs)");
const { encodeRGBA } = require("./jpeg.js");
fs.writeFileSync("font-test.jpg", encodeRGBA(buf, W, H, 80));
console.log("jpg written");
