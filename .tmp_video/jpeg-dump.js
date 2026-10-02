const fs = require("fs");
const b = fs.readFileSync("jpeg-test.jpg");
let i = 0;
console.log("size", b.length);
function hex(n) { return b.slice(i, i + n).toString("hex"); }
if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error("no SOI");
i = 2;
while (i < b.length) {
  if (b[i] !== 0xff) { console.log("MISSING MARKER at", i, hex(8)); break; }
  const m = b[i + 1];
  if (m === 0xd9) { console.log(i, "EOI"); break; }
  if (m === 0xda) {
    const len = b.readUInt16BE(i + 2);
    console.log(i, "SOS len", len, "payload", b.slice(i + 4, i + 2 + len).toString("hex"));
    break;
  }
  const len = b.readUInt16BE(i + 2);
  const name = { 0xe0: "APP0", 0xdb: "DQT", 0xc0: "SOF0", 0xc4: "DHT" }[m] || ("M" + m.toString(16));
  let extra = "";
  if (m === 0xdb) {
    const id = b[i + 4];
    const vals = b.slice(i + 5, i + 2 + len);
    const zeros = [];
    for (let k = 0; k < 64; k++) if (vals[k] === 0) zeros.push(k);
    extra = ` id=${id} nVals=${vals.length} zeros=${JSON.stringify(zeros)}`;
  }
  if (m === 0xc4) {
    const id = b[i + 4];
    extra = ` id=0x${id.toString(16)} bitsSum=${[...b.slice(i + 5, i + 21)].reduce((a, x) => a + x, 0)} vals=${len - 2 - 1 - 16}`;
  }
  if (m === 0xc0) {
    extra = ` payload=${b.slice(i + 4, i + 2 + len).toString("hex")}`;
  }
  if (m === 0xe0) {
    extra = ` payload=${b.slice(i + 4, i + 2 + len).toString("hex")} (len says ${len - 2} bytes)`;
  }
  console.log(i, name, "len", len, extra);
  i += 2 + len;
}
console.log("entropy starts at", i);
