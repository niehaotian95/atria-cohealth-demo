/* 第 12 轮挑刺 机械验证探针：复用 .tmp_validate.js 的 DOM 桩思路，聚焦四个疑似问题
 * 1) 选中主体后，主体快捷按钮（.qorg）是否同步 aria-current="true"
 * 2) selectLink 是否像 selectNode 一样清掉卡点搜索（v24 对称性）
 * 3) 收起卡点后右侧详情面板是否残留上一次诊断
 * 4) 编辑框打开并有改动时切场景，编辑内容是否被静默丢弃
 */
const fs = require("fs");
const html = fs.readFileSync("Atria-协同体检中心-v24.html", "utf8");
const blocks = [];
{
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) blocks.push(m[2]);
}
const mainCode = blocks[1];

const createdEls = [];
const ctxStub = new Proxy({}, { get(t, k) { if (k in t) return t[k]; return () => { }; }, set(t, k, v) { t[k] = v; return true; } });
function mkEl(tag) {
  const el = {
    tagName: tag, style: {}, _attrs: {}, _ds: null, _tc: "", children: [], _ls: [], onclick: null,
    classList: {
      _s: new Set(),
      add(...a) { a.forEach(x => this._s.add(x)); },
      remove(...a) { a.forEach(x => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) { const v = force === undefined ? !this._s.has(c) : !!force; if (v) this._s.add(c); else this._s.delete(c); return v; }
    },
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return (k in this._attrs) ? this._attrs[k] : null; },
    get dataset() {
      if (!this._ds) {
        const o = {};
        for (const k in this._attrs) o[k.replace(/^data-/, "").replace(/-(.)/g, (_, c) => c.toUpperCase())] = this._attrs[k];
        this._ds = o;
      }
      return this._ds;
    },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener(t, fn) { this._ls.push([t, fn]); },
    removeEventListener() { },
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    insertBefore(newNode, refNode) {
      if (!refNode) return this.appendChild(newNode);
      const i = this.children.indexOf(refNode);
      if (i < 0) return this.appendChild(newNode);
      newNode.parentElement = this; this.children.splice(i, 0, newNode); return newNode;
    },
    remove() { if (this.parentElement) { const i = this.parentElement.children.indexOf(this); if (i >= 0) this.parentElement.children.splice(i, 1); } },
    click() { if (this.onclick) this.onclick(); this._ls.filter(x => x[0] === "click").forEach(x => x[1]()); },
    focus() { }, blur() { },
    querySelector() { return mkEl("div"); },
    querySelectorAll(sel) {
      const desc = new Set();
      const walk = e => { (e.children || []).forEach(c => { desc.add(c); walk(c); }); };
      walk(this);
      return createdEls.filter(e => desc.has(e) && qsMatch(e, sel));
    },
    scrollIntoView() { },
    get textContent() { return this._tc; },
    set textContent(v) { this._tc = String(v); },
    get innerHTML() { return this._html || ""; },
    set innerHTML(v) { this._html = String(v); this.children = []; },
    get className() { return [...this.classList._s].join(" "); },
    set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    getBoundingClientRect() { return { width: 1200, height: 430, left: 0, top: 0 }; },
    width: 0, height: 0, getContext() { return ctxStub; }
  };
  return el;
}
function qsMatch(e, sel) {
  return sel.split(",").some(tok => {
    const attrRe = /\[([\w-]+)(?:="([^"]*)")?\]/g;
    const attrs = []; let base = tok, m;
    while ((m = attrRe.exec(tok))) { attrs.push([m[1], m[2]]); base = base.replace(m[0], ""); }
    const parts = base.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    let ok = true;
    if (last.startsWith(".")) ok = (e.className || "").split(/\s+/).includes(last.slice(1));
    else if (last.startsWith("#")) ok = (e.id === last.slice(1));
    else if (last) ok = (e.tagName || "").toLowerCase() === last.toLowerCase();
    if (!ok) return false;
    return attrs.every(([k, v]) => v == null ? ((e._attrs || {})[k] != null) : (String((e._attrs || {})[k]) === v));
  });
}
const registry = {};
const doc = {
  _ls: {},
  addEventListener(t, fn) { (this._ls[t] = this._ls[t] || []).push(fn); },
  removeEventListener() { },
  createElement(tag) { const e = mkEl(tag); createdEls.push(e); return e; },
  getElementById(id) {
    if (!registry[id]) {
      const hit = createdEls.find(e => e && (e.id === id || (e._attrs || {}).id === id));
      registry[id] = hit || (id === "net"
        ? Object.assign(mkEl("canvas"), { getContext() { return ctxStub; }, getBoundingClientRect() { return { width: 1200, height: 430, left: 0, top: 0 }; } })
        : mkEl("div"));
    }
    return registry[id];
  },
  querySelector(sel) { const list = createdEls.filter(e => qsMatch(e, sel)); return list.length ? list[0] : mkEl("div"); },
  querySelectorAll(sel) { return createdEls.filter(e => qsMatch(e, sel)); },
  documentElement: mkEl("html"), body: mkEl("body")
};
const winListeners = {};
const win = {
  matchMedia() { return { matches: false }; },
  devicePixelRatio: 1, innerWidth: 1400,
  addEventListener(t, fn) { (winListeners[t] = winListeners[t] || []).push(fn); },
  removeEventListener() { },
};
const storage = { _d: {}, getItem(k) { return (k in this._d) ? this._d[k] : null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
const r = {};
try {
  const fn = new Function("window", "document", "navigator", "localStorage", "matchMedia",
    "requestAnimationFrame", "cancelAnimationFrame", "setInterval", "clearInterval",
    "setTimeout", "clearTimeout", "URL", "Blob", "FileReader", "console",
    mainCode + `
;return {
  DATA:DATA, ALL_SCENES:ALL_SCENES,
  getN:()=>N, getL:()=>L,
  switchScene:switchScene, pickPhase:pickPhase, selectNode:selectNode, selectLink:selectLink,
  jumpToBlocker:jumpToBlocker, pickDim:pickDim,
  runBlkSearch:runBlkSearch, runNode:()=>{},
  doc:document, win:window, createdEls:()=>createdEls,
  getActiveDim:()=>activeDim, getActiveBlocker:()=>activeBlocker, getSelNode:()=>selNode,
  tourActive:()=>tourActive, stopTour:stopTour
};`);
  Object.assign(r, fn(win, doc, { clipboard: undefined }, storage, win.matchMedia,
    () => 0, () => { }, (() => { let n = 0; return () => ++n; })(), () => { },
    (f) => { try { f(); } catch (e) { } return 1; }, () => { },
    { createObjectURL: () => "blob:x", revokeObjectURL: () => { } },
    function Blob() { }, function FileReader() { }, { log() { }, error() { }, warn() { } }));
} catch (e) { console.log("执行失败: " + e.message); process.exit(1); }
if (r.tourActive()) r.stopTour();
for (let i = 0; i < 20; i++) { /* flush */ }

const q = s => doc.querySelectorAll(s);
const out = [];
function probe(name, cond, detail) { out.push((cond ? "证伪(无问题) " : "确认(有问题) ") + name + (detail ? " —— " + detail : "")); }

/* ===== 1) 主体快捷按钮的选中态 ===== */
{
  const qorgs = q("#qorgs .qorg");
  probe("初始：所有快捷按钮 aria-current=false", qorgs.every(b => b.getAttribute("aria-current") === "false"), qorgs.map(b => b.textContent + "=" + b.getAttribute("aria-current")).join(","));
  // 点第一个快捷按钮（同真实用户点击：走 addEventListener 的 click）
  qorgs[0].click();
  const selNode = r.getSelNode();
  const after = q("#qorgs .qorg").map(b => b.textContent + "=" + b.getAttribute("aria-current")).join(",");
  probe("点击快捷按钮后：被点按钮应亮（aria-current=true）",
    q("#qorgs .qorg").some(b => b.getAttribute("aria-current") === "true"),
    "selNode=" + (selNode && selNode.id) + " ｜ " + after);
  // 画布点击另一节点（selectNode 路径）
  r.selectNode(r.getN()[3]);
  const after2 = q("#qorgs .qorg").map(b => b.textContent + "=" + b.getAttribute("aria-current")).join(",");
  probe("画布点选第 4 个主体后：对应快捷按钮应亮",
    q("#qorgs .qorg").some(b => b.getAttribute("aria-current") === "true"),
    "selNode=" + (r.getSelNode() && r.getSelNode().id) + " ｜ " + after2);
  // 选关系后快捷按钮选中态应清空
  r.selectLink(r.getL()[0]);
  const after3 = q("#qorgs .qorg").every(b => b.getAttribute("aria-current") === "false");
  probe("选关系后：快捷按钮选中态应收空", after3, q("#qorgs .qorg").map(b => b.getAttribute("aria-current")).join(","));
}

/* ===== 2) selectLink 是否清搜索（v24 对称性） ===== */
{
  // 搜索「信息」（医院场景命中「信息不对称」1 项）
  const si = doc.getElementById("blkSearch");
  si.value = "信息";
  r.runBlkSearch();
  const shownBefore = q("#blks .blk").filter(el => el.style.display !== "none").length;
  // 对照组：selectNode 清搜索
  r.selectNode(r.getN()[0]);
  const clearedByNode = si.value === "" && doc.getElementById("blkCount").textContent === "";
  // 复原搜索，再走 selectLink
  si.value = "信息"; r.runBlkSearch();
  r.selectLink(r.getL()[0]);
  const keptByLink = si.value === "信息" && doc.getElementById("blkCount").textContent.includes("命中");
  probe("对照：选主体时搜索被清（v24 修复生效）", clearedByNode, "value=" + JSON.stringify(si.value));
  probe("疑点：选关系时搜索残留（与选主体不对称）", !keptByLink,
    "value=" + JSON.stringify(si.value) + " count=" + doc.getElementById("blkCount").textContent + " 可见卡点=" + q("#blks .blk").filter(el => el.style.display !== "none").length + "/" + q("#blks .blk").length);
}

/* ===== 3) 收起卡点后详情面板残留（同一张卡：开→再点收起） ===== */
{
  const card = q('#blks .blk[data-bi="0"]')[0];   // 按 data-bi 精确取同一张卡
  card.click();                                    // 展开
  const detailOpen = doc.getElementById("detail").innerHTML.includes("卡点归因");
  const hintOpen = doc.getElementById("netHint").classList.contains("show");
  card.click();                                    // 再次点击 = 收起
  const afterClose = doc.getElementById("detail").innerHTML;
  const hintClose = doc.getElementById("netHint").classList.contains("show");
  probe("疑点：收起卡点后详情面板仍残留该卡点诊断（同屏提示条已退）",
    !(afterClose.includes("卡点归因") && hintOpen && !hintClose),
    "展开时 detail 含卡点归因=" + detailOpen + " netHint=" + hintOpen + "→" + hintClose + " 收起后 detail 含卡点归因=" + afterClose.includes("卡点归因") + " activeBlocker=" + r.getActiveBlocker());
}

/* ===== 4) 编辑框改动后切场景，编辑内容被静默丢弃 ===== */
{
  const eb = doc.getElementById("editBtn");
  const ed = doc.getElementById("ioEdit");
  eb.click();                                            // 打开编辑框
  ed.value = ed.value + "\n// 我的批注：待核对";           // 用户做了改动
  const edited = ed.value.includes("待核对");
  r.switchScene(1);                                      // 切到轨道场景
  const discarded = !ed.value.includes("待核对");
  const snapSynced = ed._snap === ed.value;
  // 再点按钮 = 收起：因为快照已被重置，走「未改动」分支
  eb.click();
  const msg = doc.getElementById("ioMsg").textContent;
  probe("疑点：编辑未应用就切场景，改动被静默丢弃并报「未改动」",
    !(edited && discarded),
    "edited=" + edited + " discarded=" + discarded + " snapSynced=" + snapSynced + " 关闭反馈=" + JSON.stringify(msg));
}

console.log("".padEnd(78, "="));
out.forEach(s => console.log(s));
console.log("".padEnd(78, "="));
