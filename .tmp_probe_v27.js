/* v27 临时探针：提取本轮改动源码原文，供 .tmp_validate.js 静态断言对齐 */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "Atria-协同体检中心-v27.html"), "utf8");
const blocks = [];
{
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) blocks.push({ attrs: m[1] || "", code: m[2] });
}
const mainCode = blocks[1].code;
console.log("blocks:", blocks.length, "mainCode length:", mainCode.length);
const styleM = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
const css = styleM[1];

console.log("=== A scrollDetailNarrow def ===");
const i = mainCode.indexOf("function scrollDetailNarrow");
console.log(JSON.stringify(mainCode.slice(i - 60, i + 240)));
console.log("=== A2 scrollDetailNarrow call count ===", (mainCode.match(/scrollDetailNarrow\(\);/g) || []).length);

console.log("=== B runBlkSearch clear branch ===");
const j = mainCode.indexOf("if(activeBlocker!==null||selNode||selLink){");
console.log(JSON.stringify(mainCode.slice(j, j + 460)));

console.log("=== C canvas Escape guard ===");
const k = mainCode.indexOf('if(k==="Escape"){');
console.log(JSON.stringify(mainCode.slice(k, k + 420)));

console.log("=== D singular sentence ===");
const m = mainCode.indexOf("good.length===1");
console.log(JSON.stringify(mainCode.slice(m - 40, m + 230)));

console.log("=== E 640 theme-btn rule ===");
const c6 = css.indexOf("@media(max-width:640px)");
console.log(JSON.stringify(css.slice(c6, c6 + 700)));
