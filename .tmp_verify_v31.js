/* 一次性校验：v31 == v30 + 单一计划内插入 */
const fs = require("fs");
const a = fs.readFileSync("Atria-协同体检中心-v30.html", "utf8");
const b = fs.readFileSync("Atria-协同体检中心-v31.html", "utf8");
const old = [
  '  const cb=$("cmpBtn");',
  '  if(cb)cb.setAttribute("aria-pressed","true");',
  "  renderCompare();",
  "}",
  "function exitCmp(){"
].join("\n");
const nw = [
  '  const cb=$("cmpBtn");',
  '  if(cb)cb.setAttribute("aria-pressed","true");',
  "  renderCompare();",
  "  /* v31（中）：手动进入对比时把对比卡带进视野——页眉非吸顶，用户点「⚖ 对比模式」选场景时",
  "     必在页首，而对比卡渲染在英雄区之下约 730px，720p / 768p 视口首屏外，此前除按钮变蓝、",
  "     待选提示消失外无任何可见反馈（生成报告 / 风险速览 / 卡点跳转皆有滚动，同一张卡的巡览",
  "     版第八幕也 smoothScroll 到对比卡，唯独手动版不滚——本页「操作→结果」反馈模式唯一破例）。",
  "     巡览期间由第八幕自行滚动，此处 !tourActive 守卫不重复滚动 */",
  '  if(!tourActive){const card=$("cmpCard");if(card)smoothScroll(card,"center");}',
  "}",
  "function exitCmp(){"
].join("\n");
console.log("v30 contains anchor:", a.includes(old));
console.log("reconstruct(v30+edit) === v31:", a.replace(old, nw) === b);
console.log("v31 size bytes:", Buffer.byteLength(b, "utf8"));
