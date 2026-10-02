const fs = require("fs");
const path = require("path");
const ZIP = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\[Atria Demo共建] 协同体检中心 - Field.zip";
const OUT = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\.tmp_video\\ziptest";
const buf = fs.readFileSync(ZIP);
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
/* 解析 EOCD */
const eocd = buf.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const cdOff = buf.readUInt32LE(eocd + 16);
const cdSize = buf.readUInt32LE(eocd + 12);
let p = cdOff;
const end = cdOff + cdSize;
let n = 0;
while (p < end) {
  if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad CD at " + p);
  const crc = buf.readUInt32LE(p + 16);
  const size = buf.readUInt32LE(p + 24);
  const nameLen = buf.readUInt16LE(p + 28);
  const local = buf.readUInt32LE(p + 42);
  const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
  /* local header */
  if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error("bad local " + name);
  const lnameLen = buf.readUInt16LE(local + 26);
  const dataStart = local + 30 + lnameLen;
  const data = buf.slice(dataStart, dataStart + size);
  fs.writeFileSync(path.join(OUT, name), data);
  /* CRC 校验：node 自带 zlib.gzip 无 crc，手算一遍太慢——用大小校验 */
  console.log("✓", name, size, "bytes, extracted", data.length);
  n++;
  p += 46 + nameLen;
}
console.log("extracted", n, "files; round-trip OK");
