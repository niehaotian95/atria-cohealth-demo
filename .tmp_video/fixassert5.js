const fs = require("fs");
const P = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\.tmp_validate.js";
let c = fs.readFileSync(P, "utf8");
const a = '      !mainCode.includes("activeBlocker=null;selNode=null;selLink=null;"));';
const b = '      /* runBlkSearch 的手写清场分支已删（clearSelection 自身的多重赋值合法，须按函数体范围验） */\n      (()=>{const i=mainCode.indexOf("function runBlkSearch");const j=mainCode.indexOf("function clearBlkSel");const b=mainCode.slice(i,j>0?j:i+3000);return !b.includes("activeBlocker=null;selNode=null;selLink=null;")&&!b.includes("clearBlkSel();updateQuickSel();");})());';
if (!c.includes(a)) { console.log("MISS"); process.exit(1); }
c = c.replace(a, b);
fs.writeFileSync(P, c);
console.log("replaced");
