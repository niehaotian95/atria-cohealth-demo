const fs = require("fs");
const h = fs.readFileSync("../Atria-协同体检中心-v12.html", "utf8");
function extract(name, open) {
  open = open || "[";
  const close = open === "[" ? "]" : "}";
  const st = h.indexOf("const " + name + "=" + open);
  if (st < 0) throw new Error(name + " not found");
  let i = st + ("const " + name + "=" + open).length - 1, depth = 0;
  for (; i < h.length; i++) {
    if (h[i] === open) depth++;
    else if (h[i] === close) { depth--; if (depth === 0) break; }
  }
  const body = h.slice(st + ("const " + name + "=").length, i + 1);
  return eval("(" + body + ")");
}
const DEFAULT = extract("DEFAULT_DATA", "{");
const SC = extract("SCENARIOS");
const ALL = [DEFAULT].concat(SC);
console.log("scenes:", ALL.length);
ALL.forEach((x, i) => {
  console.log(i, ((x.meta || {}).project || "").slice(0, 24),
    "| total", x.total, "| prev", x.prev ? x.prev.total + " @ " + x.prev.date : "—",
    "| dims", (x.dims || []).length, "| orgs", (x.orgs || []).length,
    "| blockers", (x.blockers || []).length, "| links", (x.links || []).length,
    "| phases", (x.phases || []).length);
});
/* 一致性：prev.dims 长度 = 5；prev.orgs 的 id 都在当前 orgs 里（或缺失即提示） */
let bad = 0;
ALL.forEach((x, i) => {
  if (!x.prev) return;
  if (x.prev.dims.length !== 5) { console.log("scene", i, "prev.dims != 5"); bad++; }
  const ids = (x.orgs || []).map(o => o.id);
  Object.keys(x.prev.orgs).forEach(id => { if (!ids.includes(id)) { console.log("scene", i, "prev.orgs 超出:", id); bad++; } });
  (x.blockers || []).forEach((b, k) => {
    (b.orgs || []).forEach(id => { if (!ids.includes(id)) { console.log("scene", i, "blocker", k, "org 缺失:", id, "(兜底显示原始 id)"); } });
  });
});
console.log(bad === 0 ? "一致性 OK（blocker 兜底提示见上）" : "issues=" + bad);
