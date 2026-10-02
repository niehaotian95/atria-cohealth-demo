const fs = require("fs");
const { encodeRGBA } = require("./jpeg.js");

function makeFlat(W, H, color, file) {
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H * i; i++);
  for (let i = 0; i < W * H; i++) {
    const p = i * 4;
    buf[p] = color[0]; buf[p + 1] = color[1]; buf[p + 2] = color[2]; buf[p + 3] = 255;
  }
  const jpeg = encodeRGBA(buf, W, H, 80);
  fs.writeFileSync(file, jpeg);
  console.log(file, jpeg.length, "bytes");
}
makeFlat(64, 64, [30, 64, 175], "flat.jpg");

/* 手工核对前两个块的位流：自己读 vlc */
const src = fs.readFileSync("flat.jpg");
let i = 2;
while (i < src.length) {
  if (src[i] !== 0xff) { throw new Error("marker expect at " + i); }
  const m = src[i + 1];
  if (m === 0xda || m === 0xd9) {
    if (m === 0xd9) throw new Error("EOI before entropy");
    i += 2 + src.readUInt16BE(i + 2);
    break;
  }
  i += 2 + src.readUInt16BE(i + 2);
}
console.log("entropy at", i, "bytes:", src.slice(i, i + 20).toString("hex"));
let bp = 0;
function rb() { const b = (src[i + (bp >> 3)] >> (7 - (bp & 7))) & 1; bp++; return b; }
/* 手工 DHT lum DC：仿标准表建码 */
const BITS = [0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0], VALS = [0,1,2,3,4,5,6,7,8,9,10,11];
const codes = []; let code = 0, k = 0;
for (let len = 1; len <= 16; len++) { const cnt = BITS[len - 1]; for (let c = 0; c < cnt; c++) { codes.push({ sym: VALS[k++], code, len }); } code <<= 1; }
function readSym() {
  let c = 0, l = 0;
  for (;;) {
    c = (c << 1) | rb(); l++;
    for (const e of codes) if (e.code === c && e.len === l) return e.sym;
    if (l > 16) throw new Error("no code");
  }
}
const sym = readSym();
console.log("first DC symbol (category):", sym);
let mag = 0; for (let b = 0; b < sym; b++) mag = (mag << 1) | rb();
const val = mag < (1 << (sym - 1)) ? mag - (1 << sym) + 1 : mag;
console.log("first DC diff:", val);
