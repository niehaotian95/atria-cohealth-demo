const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SRC = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\交付包";
const OUT = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\[Atria Demo共建] 协同体检中心 - Field.zip";

/* 纯 JS zip 写入（store 模式 + CRC32）——不依赖 PowerShell */
function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const files = fs.readdirSync(SRC).filter(f => fs.statSync(path.join(SRC, f)).isFile());
const chunks = [];
const entries = [];
let offset = 0;
const enc = s => Buffer.from(s, "utf8");

for (const name of files) {
  const data = fs.readFileSync(path.join(SRC, name));
  const crc = crc32(data);
  const nameBuf = enc(name);
  const now = new Date();
  const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() / 2) & 31);
  const dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0);
  h.writeUInt16LE(20, 4);            /* version */
  h.writeUInt16LE(0x0800, 6);        /* UTF-8 文件名标志位 */
  h.writeUInt16LE(0, 8);             /* method: store */
  h.writeUInt16LE(dosTime, 10);
  h.writeUInt16LE(dosDate, 12);
  h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(data.length, 18);
  h.writeUInt32LE(data.length, 22);
  h.writeUInt16LE(nameBuf.length, 26);
  h.writeUInt16LE(0, 28);
  chunks.push(h, nameBuf, data);
  offset += h.length + nameBuf.length + data.length;
  entries.push({ name: nameBuf, crc, size: data.length, off: offset - data.length - nameBuf.length - 0, htime: dosTime, hdate: dosDate, localStart: offset - data.length - nameBuf.length - h.length + h.length - 0 });
  entries[entries.length - 1].localStart = offset - (h.length + nameBuf.length + data.length);
}

let cdOff = offset;
const cdParts = [];
entries.forEach((e) => {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0);
  h.writeUInt16LE(20, 4);
  h.writeUInt16LE(0x0800, 8);
  h.writeUInt16LE(0, 10);
  h.writeUInt16LE(e.htime, 12);
  h.writeUInt16LE(e.hdate, 14);
  h.writeUInt32LE(e.crc, 16);
  h.writeUInt32LE(e.size, 20);
  h.writeUInt32LE(e.size, 24);
  h.writeUInt16LE(e.name.length, 28);
  h.writeUInt16LE(0, 30);
  h.writeUInt16LE(0, 32);
  h.writeUInt16LE(0, 34);
  h.writeUInt16LE(0, 36);
  h.writeUInt32LE(0, 38);
  h.writeUInt32LE(e.localStart, 42);
  cdParts.push(h, e.name);
});
const cd = Buffer.concat(cdParts);
chunks.push(cd);
let end = Buffer.alloc(22 + 65535);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(cd.length, 12);   /* central directory size */
end.writeUInt32LE(cdOff, 16);
const endLen = 22;
chunks.push(end.slice(0, endLen));

fs.writeFileSync(OUT, Buffer.concat(chunks));
console.log("zip written:", OUT, fs.statSync(OUT).size, "bytes");
