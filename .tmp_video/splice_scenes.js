/* v12 数据拼接：给 3 个旧场景加 prev 复查快照 + 插入 2 个新场景 */
const fs = require("fs");
const PATH = "../Atria-协同体检中心-v12.html";
let h = fs.readFileSync(PATH, "utf8");
let n = 0;

function addPrev(anchorVer, prev, tail) {
  const anchor = `需求稳定性",v:${anchorVer}}\n  ]\n}` + (tail || "");
  const rep = `需求稳定性",v:${anchorVer}}\n  ],\n  prev:${prev}\n}` + (tail || "");
  if (!h.includes(anchor)) throw new Error("anchor miss: v=" + anchorVer);
  h = h.replace(anchor, rep);
  n++;
}

addPrev(58, '{date:"2025-12",total:67,dims:[66,71,57,80,55],\n    orgs:{agent:71,owner:68,hosp:60,gov:63,design:74,epc:67,super:78,audit:85}}');
addPrev(60, '{date:"2025-11",total:73,dims:[68,73,52,70,56],\n    orgs:{owner:69,agent:74,gov:59,build:66,supervise:77,depot:58,public:64,design:68}}');
addPrev(51, '{date:"2025-10",total:66,dims:[67,68,52,70,57],\n    orgs:{agent:66,epc:55,design:64,supervise:72,community:66,gov:60}}');

/* 插入两个新场景（在 SCENARIOS 的 ]; 之前） */
const scenes = fs.readFileSync("scenes_new.js", "utf8").trim();
const anchor2 = "\n];\n\n/* ================= 数据层（导入 / 导出 / 重渲染） ================= */";
if (!h.includes(anchor2)) throw new Error("scenes tail anchor miss");
h = h.replace(anchor2, ",\n" + scenes + "\n];\n\n/* ================= 数据层（导入 / 导出 / 重渲染） ================= */");
n++;

fs.writeFileSync(PATH, h, "utf8");
console.log("splices:", n, "file:", fs.statSync(PATH).size);
