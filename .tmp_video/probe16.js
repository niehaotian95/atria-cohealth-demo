const fs = require("fs");
const c = fs.readFileSync(process.argv[2] || "Atria-协同体检中心-v16.html", "utf8");
const m = c.match(/<script>([\s\S]*)<\/script>/) || ["", ""];
const code = m[1];
const css = (c.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ["", ""])[1];
const probes = [
  ["code has finishTyping in tour area", /⑨[\s\S]{0,500}finishTyping\(\)/.test(code)],
  ["finishTyping mention count", (code.match(/finishTyping\(\)/g) || []).length],
  ["badge 四 line", c.includes('<span class="no">四</span> · 协同时间轴')],
  ["badge 五 line", c.includes('<span class="no">五</span> · 跨组织协同关系网络')],
  ["hero footnote", c.includes("总分为综合评值（含定性判断）")],
  ["tour chip subtitle", code.includes("③ 关联卡点：详情面板里的归因卡点")],
  ["tour ⑦", code.includes("⑦ 一键切换场景")],
  ["tour ⑨", code.includes("⑨ 生成复盘报告")],
  ["no ② 续", !code.includes("② 续")],
  ["weak N fullwidth", code.includes("（健康度最低 ${weak.length} 项）")],
  ["weak fallback", code.includes("关系网络无薄弱项")],
];
for (const [k, v] of probes) console.log(k, "=>", v);
console.log("dim-row text around 1224:", code.slice(code.indexOf("ddHtml"), code.indexOf("ddHtml") + 120).replace(/\n/g, " "));
