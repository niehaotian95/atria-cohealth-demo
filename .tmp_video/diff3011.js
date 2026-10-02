const fs = require("fs");
const D = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\";
const a = fs.readFileSync(D + "Atria-协同体检中心-v30.html", "utf8").split("\n");
const b = fs.readFileSync(D + "Atria-协同体检中心-v31.html", "utf8").split("\n");
let s = 0;
while (s < a.length && s < b.length && a[s] === b[s]) s++;
let ea = a.length - 1, eb = b.length - 1;
while (ea > s && eb > s && a[ea] === b[eb]) { ea--; eb--; }
console.log("v30 lines", a.length, "| v31 lines", b.length);
console.log("first diff at line", s + 1, "; last diff v30:", ea + 1, "v31:", eb + 1);
console.log("--- v30 only region (max 30 lines) ---");
for (let i = s; i <= Math.min(ea, s + 29); i++) console.log("- " + (i + 1) + ": " + a[i].slice(0, 180));
console.log("--- v31 region (max 40 lines) ---");
for (let i = s; i <= Math.min(eb, s + 39); i++) console.log("+ " + (i + 1) + ": " + b[i].slice(0, 180));
