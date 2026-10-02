const fs = require("fs");
const html = fs.readFileSync("D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\Atria-协同体检中心-v32.html", "utf8");
const blocks = [];
{ const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m; while ((m = re.exec(html)) !== null) blocks.push(m[2]); }
const mainCode = blocks[1];
try { new Function(mainCode); console.log("compile OK"); } catch (e) { console.log("COMPILE FAIL:", e.message); process.exit(1); }
/* 最小桩：只跑 pickDim */
const ctxStub = new Proxy({}, { get(t, k) { if (k in t) return t[k]; return () => { }; }, set(t, k, v) { t[k] = v; return true; } });
function mkEl(tag) {
  return {
    tagName: tag, style: {}, _attrs: {}, _ds: null, _tc: "", children: [], _ls: [], onclick: null,
    classList: { _s: new Set(), add(...a) { a.forEach(x => this._s.add(x)); }, remove(...a) { a.forEach(x => this._s.delete(x)); }, contains(c) { return this._s.has(c); }, toggle(c, f) { const v = f === undefined ? !this._s.has(c) : !!f; if (v) this._s.add(c); else this._s.delete(c); return v; } },
    setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return (k in this._attrs) ? this._attrs[k] : null; },
    get dataset() { if (!this._ds) { const o = {}; for (const k in this._attrs) o[k.replace(/^data-/, "").replace(/-(.)/g, (_, c) => c.toUpperCase())] = this._attrs[k]; this._ds = o; } return this._ds; },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener() { }, removeEventListener() { },
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    insertBefore(n, r) { if (!r) return this.appendChild(n); const i = this.children.indexOf(r); if (i < 0) return this.appendChild(n); n.parentElement = this; this.children.splice(i, 0, n); return n; },
    removeChild(c) { return c; }, remove() { },
    click() { }, focus() { }, blur() { },
    querySelector() { return mkEl("div"); },
    querySelectorAll() { return []; },
    scrollIntoView() { },
    get textContent() { return this._tc; }, set textContent(v) { this._tc = String(v); },
    get innerHTML() { return this._html || ""; }, set innerHTML(v) { this._html = String(v); this.children = []; },
    get className() { return [...this.classList._s].join(" "); }, set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    getBoundingClientRect() { return { width: 1200, height: 430, left: 0, top: 0 }; },
    width: 0, height: 0, getContext() { return ctxStub; }
  };
}
const createdEls = [];
const registry = {};
const doc = {
  _ls: {}, addEventListener() { }, removeEventListener() { },
  createElement(t) { const e = mkEl(t); createdEls.push(e); return e; },
  getElementById(id) { if (!registry[id]) { const hit = createdEls.find(e => e && (e.id === id || (e._attrs || {}).id === id)); registry[id] = hit || (id === "net" ? Object.assign(mkEl("canvas"), { getContext() { return ctxStub; } }) : mkEl("div")); } return registry[id]; },
  querySelector() { const e = mkEl("div"); createdEls.push(e); return e; },
  querySelectorAll() { return []; },
  documentElement: mkEl("html"), body: mkEl("body")
};
const win = { matchMedia: () => ({ matches: false, addEventListener() { } }), devicePixelRatio: 1, addEventListener() { }, removeEventListener() { }, _ls: {} };
const storage = { _d: {}, getItem(k) { return (k in this._d) ? this._d[k] : null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };
const fn = new Function("window", "document", "navigator", "localStorage", "matchMedia",
  "requestAnimationFrame", "cancelAnimationFrame", "setInterval", "clearInterval",
  "setTimeout", "clearTimeout", "URL", "Blob", "FileReader", "console",
  mainCode + `;return {pickDim:pickDim,getActiveDim:()=>activeDim};`);
const R = fn(win, doc, { clipboard: undefined }, storage, win.matchMedia,
  () => 0, () => { }, (() => { let n = 0; return () => ++n; })(), () => { },
  (f) => { try { f(); } catch (e) { } return 1; }, () => { },
  { createObjectURL: () => "blob:x", revokeObjectURL: () => { } },
  function Blob() { }, function FileReader() { }, { log() { }, error() { }, warn() { } });
try { R.pickDim(1); console.log("pickDim OK, activeDim=", R.getActiveDim()); }
catch (e) { console.log("pickDim THROWS:", e.message); console.log(e.stack.split("\n").slice(0, 4).join("\n")); }
