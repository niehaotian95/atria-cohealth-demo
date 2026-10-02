/* 探针：canvas Esc 与 window Esc 的口径差 */
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync("D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\Atria-协同体检中心-v32.html", "utf8");
const html2 = html;
const blocks2 = [];
{ const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(html2)) !== null) blocks2.push(m[2]); }
const mainCode = blocks2[1];   /* 第 0 块是 head 主题预置 */

const createdEls = [];
const ctxStub = new Proxy({}, { get(t, k) { if (k in t) return t[k]; return () => { }; }, set(t, k, v) { t[k] = v; return true; } });
function mkEl(tag) {
  const el = {
    tagName: tag, style: {}, _attrs: {}, _ds: null, _tc: "", children: [], _ls: [], onclick: null,
    classList: { _s: new Set(), add(...a) { a.forEach(x => this._s.add(x)); }, remove(...a) { a.forEach(x => this._s.delete(x)); }, contains(c) { return this._s.has(c); }, toggle(c, f) { const v = f === undefined ? !this._s.has(c) : !!f; if (v) this._s.add(c); else this._s.delete(c); return v; } },
    setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return (k in this._attrs) ? this._attrs[k] : null; },
    get dataset() { if (!this._ds) { const o = {}; for (const k in this._attrs) { o[k.replace(/^data-/, "").replace(/-(.)/g, (_, c) => c.toUpperCase())] = this._attrs[k]; } this._ds = o; } return this._ds; },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener(t, fn) { this._ls.push([t, fn]); }, removeEventListener() { },
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    insertBefore(n, r) { if (!r) return this.appendChild(n); const i = this.children.indexOf(r); if (i < 0) return this.appendChild(n); n.parentElement = this; this.children.splice(i, 0, n); return n; },
    removeChild(c) { return c; }, remove() { if (this.parentElement) { const i = this.parentElement.children.indexOf(this); if (i >= 0) this.parentElement.children.splice(i, 1); } },
    click() { if (this.onclick) this.onclick(); this._ls.filter(x => x[0] === "click").forEach(x => x[1]()); },
    focus() { }, blur() { },
    querySelector() { return mkEl("div"); },
    querySelectorAll(sel) { const desc = new Set(); const walk = e => { (e.children || []).forEach(c => { desc.add(c); walk(c); }); }; walk(this); return createdEls.filter(e => desc.has(e) && qsMatch(e, sel)); },
    scrollIntoView() { },
    get textContent() { return this._tc; }, set textContent(v) { this._tc = String(v); },
    get innerHTML() { return this._html || ""; }, set innerHTML(v) { this._html = String(v); this.children = []; },
    get className() { return [...this.classList._s].join(" "); }, set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    getBoundingClientRect() { return { width: 1200, height: 430, left: 0, top: 0 }; },
    width: 0, height: 0, getContext() { return ctxStub; }
  };
  return el;
}
function qsMatch(e, sel) {
  return sel.split(",").some(tok => {
    const attrRe = /\[([\w-]+)(?:="([^"]*)")?\]/g; const attrs = []; let base = tok, m;
    while ((m = attrRe.exec(tok))) { attrs.push([m[1], m[2]]); base = base.replace(m[0], ""); }
    const parts = base.trim().split(/\s+/); const last = parts[parts.length - 1];
    let ok = true;
    if (last.startsWith(".")) ok = (e.className || "").split(/\s+/).includes(last.slice(1));
    else if (last.startsWith("#")) ok = (e.id === last.slice(1));
    else if (last) ok = (e.tagName || "").toLowerCase() === last.toLowerCase();
    if (!ok) return false;
    return attrs.every(([k, v]) => v == null ? ((e._attrs || {})[k] != null) : String((e._attrs || {})[k]) === v);
  });
}
function qsAll(sel) { return createdEls.filter(e => qsMatch(e, sel)); }
const registry = {};
const doc = {
  _ls: {}, addEventListener(t, fn) { (this._ls[t] = this._ls[t] || []).push(fn); }, removeEventListener() { },
  createElement(tag) { const e = mkEl(tag); createdEls.push(e); return e; },
  getElementById(id) { if (!registry[id]) { const hit = createdEls.find(e => e && (e.id === id || (e._attrs || {}).id === id)); registry[id] = hit || (id === "net" ? Object.assign(mkEl("canvas"), { getContext() { return ctxStub; }, getBoundingClientRect() { return { width: 1200, height: 430, left: 0, top: 0 }; } }) : mkEl("div")); } return registry[id]; },
  querySelector(sel) { const list = qsAll(sel); if (list.length) return list[0]; const e = mkEl("div"); createdEls.push(e); return e; },
  querySelectorAll(sel) { return qsAll(sel); },
  documentElement: mkEl("html"), body: mkEl("body")
};
const rmMql = { matches: false, addEventListener() { }, removeEventListener() { }, _fire() { } };
const win = { matchMedia(q) { return q === "(prefers-reduced-motion: reduce)" ? rmMql : { matches: false }; }, devicePixelRatio: 1, addEventListener(t, fn) { (this._ls[t] = this._ls[t] || []).push(fn); }, removeEventListener() { }, _ls: {} };
const storage = { _d: {}, getItem(k) { return (k in this._d) ? this._d[k] : null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };

const fn = new Function("window", "document", "navigator", "localStorage", "matchMedia",
  "requestAnimationFrame", "cancelAnimationFrame", "setInterval", "clearInterval",
  "setTimeout", "clearTimeout", "URL", "Blob", "FileReader", "console",
  mainCode + `
;return {
  DATA:DATA, getN:()=>N, getL:()=>L,
  pickDim:pickDim, pickPhase:pickPhase, selectNode:selectNode, selectLink:selectLink,
  getSelNode:()=>selNode, getSelLink:()=>selLink, getActiveDim:()=>activeDim,
  getActivePhase:()=>activePhase, getActiveBlocker:()=>activeBlocker,
  tourActive:()=>tourActive, stopTour:stopTour,
  canvasListeners:()=>document.getElementById("net")._ls, winListeners:window._ls,
  detail:document.getElementById("detail"), netHint:document.getElementById("netHint"),
  tl:document.getElementById("tl")
};`);
const R = fn(win, doc, { clipboard: undefined }, storage, win.matchMedia,
  () => 0, () => { }, (() => { let n = 0; return () => ++n; })(), () => { },
  (f) => { try { f(); } catch (e) { } return 1; }, () => { },
  { createObjectURL: () => "blob:x", revokeObjectURL: () => { } },
  function Blob() { }, function FileReader() { },
  { log() { }, error() { }, warn() { } });

if (R.tourActive()) R.stopTour();
const kh = doc.getElementById("kbdHelp");
if (kh) kh.hidden = true;   /* 桩里静态 HTML 元素不在 createdEls，hidden 为 undefined 会让 Esc 提前 return；手动置真=帮助关闭 */
console.log("--- 场景 A：阶段过滤激活，canvas Esc（帮助关、无巡览）---");
R.pickPhase(2);
console.log("before: phase=", R.getActivePhase(), "hint=", R.netHint.classList.contains("show"));
const canvasLs = R.canvasListeners() || [];
const esc = canvasLs.filter(x => x[0] === "keydown").map(x => x[1]);
esc.forEach(f => f({ key: "Escape", preventDefault() { }, target: R.canvasListeners ? doc.getElementById("net") : null }));
console.log("after canvas Esc: phase=", R.getActivePhase(),
  "hint=", R.netHint.classList.contains("show"),
  "tl-sel=", doc.querySelectorAll(".tl-m.sel").length,
  "detail-guide=", R.detail.innerHTML.includes("点击总览五维"));
console.log("→ 画布段没清 phase / clearTlSel，且藏了 netHint —— 若 window 段不跑（巡览激活）即为半亮态");

console.log("--- 场景 B：巡览激活 + 阶段过滤，canvas Esc ---");
R.pickPhase(2);
// 模拟巡览激活：直接改 tourActive 不可行，改测 window 段在 tourActive 时的行为路径省略；
// 改测：window Esc 监听存在且冒泡后最终一致
const wLs = R.winListeners["keydown"] || [];
console.log("window keydown 监听数:", wLs.length, "（冒泡后由它清 phase——canvas 段不清）");
