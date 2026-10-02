/* 临时探针：用 v20 里实际的 DIM_RULES + dimOfBlocker 验证五场景归因分布（用完即删） */
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const start = html.indexOf("const DEFAULT_DATA={");
const end = html.indexOf("/* ================= 数据层");
const dataRegion = html.slice(start, end);
const fnSrc = html.slice(html.indexOf("function dimOfBlocker"), html.indexOf("function clearDimSel"));
const ALL_SCENES = (new Function(dataRegion + ";return [DEFAULT_DATA].concat(SCENARIOS);"))();
const makeDimOf = (new Function("DATA", "DIM_RULES", fnSrc + "\nreturn dimOfBlocker;"));
const DIM_RULES = [
  /权责|边界|职责|分工|牵头/,
  /信息|数据|口径|对称|资料|报表|告知|投诉/,
  /审批|时序|前置|许可|串联|报装|迁改|征拆|占道/,
  /目标|错位|考核|优先|冲突/,
  /需求|变更|反复|界面|专项/
];
console.log("dimOf source check: 含 clean/计票/firstPos:",
  fnSrc.includes("（示例[^）]*）") && fnSrc.includes("hits.length") && fnSrc.includes("firstPos"));
ALL_SCENES.forEach((sc, si) => {
  const dimOf = makeDimOf(sc, DIM_RULES);
  const am = sc.blockers.map(b => dimOf(b));
  const counts = sc.dims.map((_, i) => am.filter(a => a === i).length);
  console.log("\n场景" + si + " " + (sc.meta.project || "").slice(0, 22));
  sc.dims.forEach((d, i) => console.log("  " + d.n + ": 归因 " + counts[i] + " 项"));
  sc.blockers.forEach((b, i) => {
    const di = am[i];
    const name = di >= 0 ? sc.dims[di].n : "未归因";
    console.log("  - " + b.t + " -> " + name);
  });
});
