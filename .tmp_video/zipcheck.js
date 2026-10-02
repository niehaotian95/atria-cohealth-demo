const fs = require("fs");
const { execFileSync } = require("child_process");
const PATH = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\[Atria Demo共建] 协同体检中心 - Field.zip";
const buf = fs.readFileSync(PATH);
console.log("size", buf.length);
/* 扫描 central directory 签名 PK\x01\x02 */
let n = 0, i = 0;
const names = [];
while ((i = buf.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), i)) !== -1) {
  const nameLen = buf.readUInt16LE(i + 28);
  const name = buf.toString("utf8", i + 46, i + 46 + nameLen);
  const size = buf.readUInt32LE(i + 24);
  names.push([name, size]);
  i += 46 + nameLen;
  n++;
}
console.log("central dir entries:", n);
for (const [name, size] of names) console.log(" -", name, size, "bytes");
/* 尾签名 */
console.log("EOCD found:", buf.indexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) !== -1);
