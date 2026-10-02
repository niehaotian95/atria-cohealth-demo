const fs = require("fs");
const P = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\.tmp_validate.js";
let c = fs.readFileSync(P, "utf8");
const rep = [
  ['!mainCode.includes("fromBlkSearch") && !mainCode.includes("function clearBlkSearch(){") &&\n      !mainCode.includes("let fromBlkSearch="));',
   '/* 注释里提到了这个词不算——只钉真正的代码符号 */\n      !/let\\s+fromBlkSearch/.test(mainCode) && !/fromBlkSearch\\s*=/.test(mainCode) &&\n      !/function\\s+clearBlkSearch\\s*\\(/.test(mainCode));'],
  ['!mainCode.includes("fromBlkSearch") && /* v32：互斥清场走 setSelection(*,null) */',
   '/* v32：fromBlkSearch 只剩注释（见上条：钉符号不钉词） */\n      !/let\\s+fromBlkSearch/.test(mainCode) && !/fromBlkSearch\\s*=/.test(mainCode) &&'],
];
let n = 0;
for (const [a, b] of rep) {
  if (!c.includes(a)) { console.log("MISS:", JSON.stringify(a.slice(0, 60))); continue; }
  c = c.replace(a, b);
  n++;
}
fs.writeFileSync(P, c);
console.log("replaced", n, "/", rep.length);
