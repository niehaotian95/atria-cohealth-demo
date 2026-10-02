const fs = require("fs");
const { encodeRGBA } = require("./jpeg.js");
const W = 768, H = 448;
const buf = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) { const p = i * 4; buf[p] = 30; buf[p + 1] = 64; buf[p + 2] = 175; buf[p + 3] = 255; }
fs.writeFileSync("flat-big.jpg", encodeRGBA(buf, W, H, 72));
console.log("written");
