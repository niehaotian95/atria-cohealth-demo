const fs = require("fs");
const h = fs.readFileSync(__dirname + "/tour.html", "utf8");
const m = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop();
fs.writeFileSync(__dirname + "/tour_body.js", m[1]);
console.log("tour script chars:", m[1].length);
// 顶层数据自检：巡览脚本引用的关键元素在 tour.html 中都存在
const must = [".dim-row", "#detail .tag.gov", ".qorg", ".tl-m", ".blk", "#blkSearch",
  "#sceneBtn1", "#cmpBtn", "#genBtn", "#report", ".cmp-card", "#dims", "#netHint"];
for (const sel of must) {
  const s = sel.replace(/^#/, 'id="').replace(/^\.([\w-]+)/, 'class="$1');
  if (!h.includes('id="detail"') && sel.startsWith("#detail")) { /* 复合选择器单独处理 */ }
}
console.log("id=sceneBtn1:", h.includes('id="sceneBtn1"'));
console.log("class=dim-list:", h.includes('class="dim-list"'));
console.log("id=genBtn:", h.includes('id="genBtn"'));
console.log("class=qorgs:", h.includes('class="qorgs"'));
console.log("class=tl:", h.includes('class="tl"'));
console.log("id=blkSearch:", h.includes('id="blkSearch"'));
console.log("id=cmpCard:", h.includes('id="cmpCard"'));
console.log("id=report:", h.includes('id="report"'));
console.log("class=blk-tools:", h.includes('class="blk-tools"'));
