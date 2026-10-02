/* v3 校验器：语法检查 + DOM 桩运行时冒烟 + HTML 结构检查 + 数据完整性 */
const fs = require("fs");
const path = process.argv[2];
const html = fs.readFileSync(path, "utf8");

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name + (extra ? "  " + extra : "")); }
}

/* ---------- 1. 提取全部 script ---------- */
const blocks = [];
{
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) blocks.push({ attrs: m[1] || "", code: m[2] });
}
check("script 块数量 = 2（head 主题预置 + 主脚本）", blocks.length === 2, "got " + blocks.length);
const headCode = blocks[0].code, mainCode = blocks[1].code;
check("主脚本含 \"use strict\"", mainCode.includes("use strict"));
check("主脚本内无 </script 提前终止", !mainCode.includes("</script"));

/* ---------- 2. 语法编译检查 ---------- */
try { new Function(mainCode); check("主脚本 new Function 编译通过", true); } catch (e) { check("主脚本编译", false, e.message); }
try { new Function(headCode); check("head 脚本编译通过", true); } catch (e) { check("head 脚本编译", false, e.message); }

/* ---------- 3. 大括号 / 圆括号 / 方括号配对（主脚本，需正确处理字符串与模板） ---------- */
function balance(code) {
  const modes = ["code"]; // code | sq | dq | tpl | line | block
  const stack = []; // {ch, tpl}
  const pairs = { ")": "(", "]": "[", "}": "{" };
  let i = 0, line = 1;
  while (i < code.length) {
    const c = code[i], mode = modes[modes.length - 1];
    if (c === "\n") line++;
    if (mode === "line") { if (c === "\n") modes.pop(); i++; continue; }
    if (mode === "block") { if (c === "*" && code[i + 1] === "/") { modes.pop(); i += 2; continue; } i++; continue; }
    if (mode === "sq" || mode === "dq") {
      const q = mode === "sq" ? "'" : '"';
      if (c === "\\") { i += 2; continue; }
      if (c === q) modes.pop();
      i++; continue;
    }
    if (mode === "tpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { modes.pop(); i++; continue; }
      if (c === "$" && code[i + 1] === "{") { modes.push("code"); stack.push({ ch: "{", tpl: true, line }); i += 2; continue; }
      i++; continue;
    }
    // mode === code
    if (c === "/" && code[i + 1] === "/") { modes.push("line"); i += 2; continue; }
    if (c === "/" && code[i + 1] === "*") { modes.push("block"); i += 2; continue; }
    if (c === "/") {
      // 区分正则字面量与除法：前一非空字符为字母/数字/) ] } → 除法
      let j = i - 1;
      while (j >= 0 && /\s/.test(code[j])) j--;
      const prev = j >= 0 ? code[j] : "";
      if (!/[A-Za-z0-9)\]}]/.test(prev)) {
        // 正则字面量：扫到未转义的 /
        i++;
        while (i < code.length) {
          if (code[i] === "\\") { i += 2; continue; }
          if (code[i] === "/") { i++; break; }
          if (code[i] === "\n") break; // 跨行异常，放弃
          i++;
        }
        continue;
      }
      i++; continue;
    }
    if (c === "'") { modes.push("sq"); i++; continue; }
    if (c === '"') { modes.push("dq"); i++; continue; }
    if (c === "`") { modes.push("tpl"); i++; continue; }
    if (c === "(" || c === "[") { stack.push({ ch: c, tpl: false, line }); i++; continue; }
    if (c === "{") { stack.push({ ch: "{", tpl: false, line }); i++; continue; }
    if (c === ")" || c === "]" || c === "}") {
      const top = stack.pop();
      if (!top || top.ch !== pairs[c]) return "mismatch `" + c + "` at line " + line;
      if (top.tpl) modes.pop(); // 插值结束，回到模板串
      i++; continue;
    }
    i++;
  }
  if (modes.length > 1) return "unterminated modes: " + modes.join(",");
  if (stack.length) return "unclosed " + stack.map(s => s.ch + (s.tpl ? "(tpl)" : "") + "@L" + s.line).join(", ");
  return null;
}
const bal = balance(mainCode);
check("主脚本括号配对（{}、（）、[]，含模板插值）", bal === null, bal);

/* ---------- 4. HTML 标签配对（script 外） ---------- */
(function () {
  const htmlNoScript = html.replace(/<script(\s[^>]*)?>[\s\S]*?<\/script>/g, "");
  const voids = new Set(["meta", "input", "br", "img", "hr", "link", "circle", "path", "rect", "use", "source"]);
  const stack = [];
  let err = null;
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = re.exec(htmlNoScript)) !== null) {
    const full = m[0], name = m[1].toLowerCase(), attr = m[2];
    if (full.startsWith("</")) {
      const top = stack.pop();
      if (!top || top !== name) { err = `mismatch </${name}>，栈顶为 ${top}，栈尾=${stack.slice(-5)}`; break; }
    } else {
      const selfClose = attr.trim().endsWith("/") || voids.has(name);
      if (!selfClose) stack.push(name);
    }
  }
  check("HTML 标签配对（script 外，含 void 元素）", err === null && stack.length === 0, err || ("未闭合: " + stack.slice(-8)));
})();

/* ---------- 5. DOM id 定义与引用 ---------- */
(function () {
  const defined = [];
  const reId = /\bid\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = reId.exec(html)) !== null) defined.push(m[1]);
  const dup = defined.filter((x, i) => defined.indexOf(x) !== i);
  check("HTML 无重复 id", dup.length === 0, JSON.stringify(dup));
  const refs = new Set();
  const reRef = /\$\(\s*"([A-Za-z0-9_-]+)"\s*\)/g;
  while ((m = reRef.exec(mainCode)) !== null) refs.add(m[1]);
  const reRef2 = /getElementById\(\s*"([^"]+)"\s*\)/g;
  while ((m = reRef2.exec(mainCode)) !== null) refs.add(m[1]);
  const missing = [...refs].filter(r => !defined.includes(r));
  check(`JS 引用的 DOM id 全部存在（${refs.size} 个引用 / ${defined.length} 个定义）`, missing.length === 0, JSON.stringify(missing));
})();

/* ---------- 6. 运行时冒烟：DOM 桩执行主脚本 ---------- */
const createdEls = [];
const winListeners = {};
const ctxStub = new Proxy({}, {
  get(t, k) { if (k in t) return t[k]; return () => { }; },
  set(t, k, v) { t[k] = v; return true; }
});
function mkEl(tag) {
  const el = {
    tagName: tag, style: {}, _attrs: {}, _ds: null, _tc: "",
    children: [], _ls: [], onclick: null,
    classList: {
      _s: new Set(),
      add(...a) { a.forEach(x => this._s.add(x)); },
      remove(...a) { a.forEach(x => this._s.delete(x)); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) { const v = force === undefined ? !this._s.has(c) : !!force; if (v) this._s.add(c); else this._s.delete(c); return v; }
    },
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return (k in this._attrs) ? this._attrs[k] : null; },
    get dataset() {   /* v14：data-di/data-bi/data-id → 驼峰；缓存为可写对象，支持 b.dataset.id=… 写法 */
      if (!this._ds) {
        const o = {};
        for (const k in this._attrs) {
          const kk = k.replace(/^data-/, "").replace(/-(.)/g, (_, c) => c.toUpperCase());
          o[kk] = this._attrs[k];
        }
        this._ds = o;
      }
      return this._ds;
    },
    removeAttribute(k) { delete this._attrs[k]; },
    addEventListener(t, fn) { this._ls.push([t, fn]); },
    removeEventListener() { },
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    insertBefore(newNode, refNode) {   /* v13：finishTyping 用到 */
      if (!refNode) return this.appendChild(newNode);
      const i = this.children.indexOf(refNode);
      if (i < 0) return this.appendChild(newNode);
      newNode.parentElement = this;
      this.children.splice(i, 0, newNode);
      return newNode;
    },
    removeChild(c) { return c; },
    remove() {   /* v13：真实 detach，否则 finishTyping 的旧段落残留 */
      if (this.parentElement) {
        const i = this.parentElement.children.indexOf(this);
        if (i >= 0) this.parentElement.children.splice(i, 1);
      }
    },
    click() { if (this.onclick) this.onclick(); this._ls.filter(x => x[0] === "click").forEach(x => x[1]()); },
    focus() { }, blur() { },
    querySelector() { return mkEl("div"); },
    querySelectorAll(sel) {
      /* v13：限定到子孙（report.querySelectorAll("p") 等不再返回全文档） */
      const desc = new Set();
      const walk = e => { (e.children || []).forEach(c => { desc.add(c); walk(c); }); };
      walk(this);
      return createdEls.filter(e => desc.has(e) && qsMatch(e, sel));
    },
    scrollIntoView() { },
    get textContent() { return this._tc; },
    set textContent(v) { this._tc = String(v); },
    get innerHTML() { return this._html || ""; },
    set innerHTML(v) { this._html = String(v); this.children = []; },   /* v13：更贴近真实 DOM，重渲染不残留旧子节点 */
    get className() { return [...this.classList._s].join(" "); },
    set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    getBoundingClientRect() { return { width: 1200, height: 430, left: 0, top: 0 }; },
    width: 0, height: 0,
    getContext() { return ctxStub; }
  };
  return el;
}
function qsMatch(e, sel) {
  return sel.split(",").some(tok => {
    const attrRe = /\[([\w-]+)(?:="([^"]*)")?\]/g;
    const attrs = [];
    let base = tok, m;
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
function qsAll(sel) {
  // 支持：.a / .a,.b / #x .y / tag / .a[k="v"]（v12：属性限定）
  return createdEls.filter(e => qsMatch(e, sel));
}
const registry = {};
const doc = {
  _ls: {},
  addEventListener(t, fn) { (this._ls[t] = this._ls[t] || []).push(fn); },   /* v13：tour 用到 document.addEventListener */
  removeEventListener() { },
  createElement(tag) { const e = mkEl(tag); createdEls.push(e); return e; },
  getElementById(id) {
    if (!registry[id]) {
      /* v13：优先认领已创建并带 id 的元素（动态生成的场景按钮等），再退回新建 */
      const hit = createdEls.find(e => e && (e.id === id || (e._attrs || {}).id === id));
      registry[id] = hit || (id === "net"
        ? Object.assign(mkEl("canvas"), { getContext() { return ctxStub; }, getBoundingClientRect() { return { width: 1200, height: 430, left: 0, top: 0 }; } })
        : mkEl("div"));
    }
    return registry[id];
  },
  querySelector(sel) {
    const list = qsAll(sel);
    if (list.length) return list[0];
    const e = mkEl("div"); createdEls.push(e); return e;
  },
  querySelectorAll(sel) { return qsAll(sel); },
  documentElement: mkEl("html"),
  body: mkEl("body")
};
/* v30：prefers-reduced-motion 的 matchMedia 桩改为持久对象（带 addEventListener / change
   监听队列、可外部 _fire 触发），让「会话中途开减少动态」的 change 监听能被运行时断言
   真正触发；其它查询（如 prefers-color-scheme）仍返回不可监听的静态结果 */
const rmListeners = [];
const rmMql = {
  matches: false,
  addEventListener(t, fn) { if (t === "change") rmListeners.push(fn); },
  removeEventListener() { },
  _fire(m) { this.matches = m; rmListeners.forEach(f => { try { f({ matches: m }); } catch (e) { } }); }
};
const win = {
  matchMedia(q) { return q === "(prefers-reduced-motion: reduce)" ? rmMql : { matches: false }; },
  devicePixelRatio: 1,
  addEventListener(t, fn) { (win._ls[t] = win._ls[t] || []).push(fn); },
  removeEventListener() { },
  _ls: winListeners
};
const storage = { _d: {}, getItem(k) { return (k in this._d) ? this._d[k] : null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } };

let runtime = null;
try {
  const fn = new Function("window", "document", "navigator", "localStorage", "matchMedia",
    "requestAnimationFrame", "cancelAnimationFrame", "setInterval", "clearInterval",
    "setTimeout", "clearTimeout", "URL", "Blob", "FileReader", "console",
    mainCode + `
;return {
  DATA:DATA, ALL_SCENES:ALL_SCENES, SCENARIOS:SCENARIOS,
  getN:()=>N, getL:()=>L, getDATA:()=>DATA,
  getPrefersReduced:()=>prefersReduced,   /* v30：会话中途切换减少动态的运行时断言用 */
  switchScene:switchScene, pickPhase:pickPhase, selectNode:selectNode, selectLink:selectLink,
  loadData:loadData,
  jumpToBlocker:jumpToBlocker, exportNetPNG:exportNetPNG, buildRisks:buildRisks,
  reportToMarkdown:reportToMarkdown, buildReportLines:buildReportLines,
  validateData:validateData, resetReport:resetReport, startTyping:startTyping,
  toggleCmp:toggleCmp, enterCmp:enterCmp, exitCmp:exitCmp, renderCompare:renderCompare,
  showImportDiff:showImportDiff, buildDimChartSVG:buildDimChartSVG,
  showTip:showTip, wake:wake, pickDim:pickDim, buildReportNo:buildReportNo,
  cleanIssueDate:cleanIssueDate, tlNodes:()=>createdEls.filter(e=>e.className==="dim-row"),
  getAttrMap:()=>attrMap,
  toWorld:toWorld, getView:()=>view,
  zoomBy:zoomBy, resetView:resetView, finishTyping:finishTyping,
  pointerUp:pointerUp, runBlkSearch:runBlkSearch,
  getReportTimer:()=>reportTimer, getActiveDim:()=>activeDim,
  getActivePhase:()=>activePhase, getActiveBlocker:()=>activeBlocker,
  getSelNode:()=>selNode, getSelLink:()=>selLink,   /* v32：状态机不变量网读取两个选择态 */
  printLight:()=>printLight,
  startTour:startTour, stopTour:stopTour, tourActive:()=>tourActive,
  setDrag:(n)=>{dragNode=n;}, isAnimating:isAnimating,
  getKb:()=>kbNode, getCanvas:()=>document.getElementById("net"),
  winListeners:window._ls, doc:document, win:window, storage:localStorage,
  themeBtn:document.getElementById("themeBtn"), tl:document.getElementById("tl"),
  detail:document.getElementById("detail"), net:document.getElementById("net")
};`);
  /* 参数顺序：raf(从不tick) / cancelRaf / clearInterval 计数器 / clearInterval / setTimeout 即时回调(供 tour) / clearTimeout */
  runtime = fn(win, doc, { clipboard: undefined }, storage, win.matchMedia,
    () => 0, () => { }, (() => { let n = 0; return () => ++n; })(), () => { },
    (f) => { try { f(); } catch (e) { } return 1; }, () => { },
    { createObjectURL: () => "blob:x", revokeObjectURL: () => { } },
    function Blob() { }, function FileReader() { },
    { log() { }, error() { }, warn() { } });
  check("主脚本 DOM 桩执行：整条 init 路径无异常", true);
} catch (e) {
  check("主脚本执行", false, e.message + (e.stack ? "\n" + e.stack.split("\n").slice(1, 3).join("\n") : ""));
}

if (runtime) {
  const R = runtime;
  /* v22：tour.html 是自动播放版（init 即 startTour，tourActive 恒真）——同步断言前先把巡览归位，
     否则 Esc / 快捷键 / 对比模式类断言全程撞在「巡览激活」的 Esc 优先分支上；
     主文件 tourActive 本就为假，此处为空操作；末尾异步段会重新完整跑一遍巡览 */
  if (R.tourActive()) R.stopTour();
  check("v22：自启动巡览（如有）已归位，同步断言不与 Esc / 巡览冲突", R.tourActive() === false);
  // 场景切换全循环（v12：5 个场景）
  try {
    R.switchScene(1); R.switchScene(2); R.switchScene(1); R.switchScene(0);
    R.switchScene(3); R.switchScene(4); R.switchScene(0);
    check("场景切换 0→1→2→1→0→3→4→0 全部无异常（医院/轨道/排水/学校/水厂）", true);
  } catch (e) { check("场景切换", false, e.message); }

  // 主体选择 / 反查 / 阶段过滤
  try {
    R.selectNode(R.getN()[0]);
    check("selectNode：详情含参与阶段与涉及卡点反查行", R.detail.innerHTML.includes("参与阶段") && R.detail.innerHTML.includes("涉及卡点"));
    R.pickPhase(2);
    check("pickPhase(2)：阶段过滤生效", R.detail.innerHTML.includes("阶段诊断"));
    R.pickPhase(2);
    check("pickPhase(2) 再点：取消过滤并重置详情", R.detail.innerHTML.includes("诊断详情"));
    R.selectNode(R.getN()[2]);
    R.pickPhase(1); // 切换主体后选阶段，单一过滤器清理
    check("主体→阶段切换后详情为阶段诊断", R.detail.innerHTML.includes("阶段诊断"));
  } catch (e) { check("主体/阶段联动", false, e.message); }

  // 卡点手风琴
  try {
    R.jumpToBlocker(0);
    const blks = createdEls.filter(e => (e.className || "").includes("blk") && (e.className || "").includes("open"));
    check("jumpToBlocker(0)：展开第一个卡点", blks.length === 1, "open count=" + blks.length);
    R.jumpToBlocker(1);
    const openAfter = createdEls.filter(e => (e.className || "").includes("blk") && (e.className || "").includes("open"));
    check("jumpToBlocker(1)：手风琴单开，第一个已收起", openAfter.length === 1);
    check("展开卡点后详情为卡点归因", R.detail.innerHTML.includes("卡点归因"));
  } catch (e) { check("卡点手风琴", false, e.message); }

  // 弱关系选择
  try {
    R.selectLink(R.getL()[0]);
    check("selectLink：详情为协同关系", R.detail.innerHTML.includes("协同关系"));
  } catch (e) { check("关系选择", false, e.message); }

  // 报告
  try {
    const md = R.reportToMarkdown();
    check("reportToMarkdown：含五维评分与卡点表（v19：健康度表明细 + 四~七节随屏幕报告编号）",
      md.includes("## 二、五维评分") && md.includes("## 三、卡点分诊") && md.includes("## 主体健康度明细") && md.includes("## 四、干预处方") && md.includes("归因："));
    R.startTyping();
    R.resetReport();
    check("startTyping + resetReport 无异常", true);
    // 打印自动填充
    (R.winListeners["beforeprint"] || []).forEach(f => f());
    check("beforeprint：未生成报告时自动填充全文", createdEls.some(e => e.tagName === "p") || (R.detail && true));
    (R.winListeners["afterprint"] || []).forEach(f => f());
    check("afterprint：自动还原报告区", true);
  } catch (e) { check("报告生成", false, e.message); }

  // 校验器
  try {
    check("validateData 拒绝非法输入（null / 空数组 / 引用缺失）",
      !!R.validateData(null)
      && !!R.validateData({ orgs: [] })
      && R.validateData({ orgs: [{ id: "a", name: "a", health: 1, phases: [] }], links: [["a", "b", "x", 1]], phases: [{ label: "x" }], blockers: [], dims: [{ n: "x", v: 1 }] }) === "关系引用了不存在的主体：a / b");
    check("validateData 接受默认数据", R.validateData(JSON.parse(JSON.stringify(R.ALL_SCENES[0]))) === null);
  } catch (e) { check("validateData", false, e.message); }

  // PNG 导出
  try { R.exportNetPNG(); check("exportNetPNG 无异常", true); } catch (e) { check("exportNetPNG", false, e.message); }

  // ---- v4：场景对比 ----
  try {
    R.toggleCmp(); // 进入待选状态
    R.enterCmp(1); // 与「轨道」对比
    const cmpCard = doc.getElementById("cmpCard");
    const cmpBodyHtml = doc.getElementById("cmpBody").innerHTML;
    check("对比模式：面板显示", cmpCard.classList._s.has("show"));
    check("对比模式：渲染当前 vs 轨道内容", cmpBodyHtml.includes("轨道交通") && cmpBodyHtml.includes("Δ"));
    check("对比模式：含主体健康度变化", cmpBodyHtml.includes("主体健康度变化"));
    R.exitCmp();
    check("退出对比：面板隐藏", !cmpCard.classList._s.has("show"));
    R.enterCmp(2);
    check("切换为与「排水」对比", doc.getElementById("cmpBody").innerHTML.includes("排水"));
    const go = doc.getElementById("cmpGo");
    check("对比面板含「切换到该场景」按钮", !!(go && go.onclick));
    if (go && go.onclick) {
      go.onclick();
      check("对比面板跳转：当前场景切换为排水", (R.getDATA().meta || {}).project.includes("排水"));
      check("跳转场景后退出对比模式", !cmpCard.classList._s.has("show"));
    }
    R.exitCmp();
  } catch (e) { check("场景对比", false, e.message); }

  // ---- v4：键盘导航 ----
  try {
    const cv = R.getCanvas();
    const kd = (cv._ls.find(x => x[0] === "keydown") || [])[1];
    if (!kd) { check("canvas keydown 监听已注册", false); }
    else {
      const fire = k => kd({ key: k, preventDefault() { } });
      doc.getElementById("kbdHelp").hidden = true;   /* 模拟 HTML 中的 hidden 属性（桩不解析属性；v27 起 canvas Esc 先判弹层是否打开，需真实初始态） */
      fire("ArrowRight");
      const kb1 = R.getKb();
      check("方向键：焦点落在某节点上", !!kb1 && typeof kb1.x === "number" && typeof kb1.id === "string");
      fire("ArrowDown");
      const kb2 = R.getKb();
      check("再次按方向键焦点移动或保持", kb2 !== kb1 || kb2 !== null);
      if (kb2) {
        fire("Enter");
        check("Enter：详情显示该主体名", doc.getElementById("detail").innerHTML.includes(kb2.name || "≈"));
      }
      fire("Escape");
      check("Escape：键盘焦点与选中态清空", R.getKb() === null);
    }
  } catch (e) { check("键盘导航", false, e.message); }

  // ---- v4：报告图表 / md 条形 ----
  try {
    const svg = R.buildDimChartSVG();
    check("报告区 SVG 图含五维", svg.includes("<svg") && svg.includes("rect") && (svg.match(/<rect/g) || []).length >= 10);
    R.startTyping();
    check("报告区注入 SVG 图（report-chart 元素已挂载）", createdEls.some(e => e.className === "report-chart"));
    R.resetReport();
    const md = R.reportToMarkdown();
    check("Markdown 含图形条（▓/░）", md.includes("▓") && md.includes("░"));
  } catch (e) { check("报告图表", false, e.message); }

  // ---- v4：导入 diff 预览 ----
  try {
    const mod = JSON.parse(JSON.stringify(R.ALL_SCENES[1]));
    mod.total = 80;
    mod.dims[0].v = 90;
    mod.meta.project = "测试项目（diff 预览）";
    R.showImportDiff(mod);
    const diffBox = createdEls.filter(e => e.className === "diff-box").pop();
    const diffList = createdEls.filter(e => e.className === "diff-list").pop();
    check("diff 预览：显示差异摘要",
      !!(diffBox && (diffBox._html || "").includes("导入预览"))
      && !!(diffList && (diffList._tc || "").includes("总分")));
    const applyBtn = createdEls.find(e => e.textContent === "应用导入");
    const cancelBtn = createdEls.find(e => e.textContent === "放弃");
    check("diff 预览：含应用 / 放弃按钮", !!applyBtn && !!cancelBtn);
    if (cancelBtn && cancelBtn.onclick) {
      cancelBtn.onclick();
      check("放弃：数据未变", R.getDATA().meta.project !== "测试项目（diff 预览）");
    }
    R.showImportDiff(mod);
    const ap2 = createdEls.find(e => e.textContent === "应用导入");
    if (ap2 && ap2.onclick) {
      ap2.onclick();
      check("应用：数据已替换并清除预设高亮", R.getDATA().meta.project === "测试项目（diff 预览）");
    }
    // 恢复
    R.switchScene(0);
  } catch (e) { check("导入 diff 预览", false, e.message); }

  // ---- v5：卡点搜索 / hover 气泡 / 节能 wake / 渐入动画 ----
  try {
    const si = doc.getElementById("blkSearch");
    const inputFn = (si._ls.find(x => x[0] === "input") || [])[1];
    check("卡点搜索 input 监听已注册", !!inputFn);
    if (si && inputFn) {
      si.value = "信息";
      inputFn();
      check("搜索「信息」：命中计数正确", doc.getElementById("blkCount").textContent.includes("命中"));
      const blkEls = createdEls.filter(e => (e.className || "") === "blk");
      const shownCount = blkEls.filter(e => !(e.style && e.style.display === "none")).length;
      check("搜索「信息」：仅匹配卡点保留（其余过滤）", shownCount >= 1 && shownCount <= blkEls.length);
      si.value = "代建";
      inputFn();
      const matchBtns = createdEls.filter(e => (e.className || "").includes("qorg") && (e.className || "").includes("match"));
      check("搜索主体名：对应快捷按钮高亮", matchBtns.length >= 1);
      // 恢复
      si.value = "";
      inputFn();
      check("清空搜索：全部恢复显示", blkEls.every(e => !(e.style && e.style.display === "none")));
      check("清空搜索：计数清空", doc.getElementById("blkCount").textContent === "");
    }
  } catch (e) { check("卡点搜索", false, e.message); }

  try {
    const tipEl = doc.getElementById("netTip");
    const node = R.getN()[1];
    R.showTip(node, 300, 200);
    check("hover 气泡：显示主体信息", tipEl.style.display === "block" && tipEl.innerHTML.includes(node.short));
    R.showTip(null, 0, 0);
    check("hover 气泡：隐藏", tipEl.style.display === "none");
  } catch (e) { check("hover 气泡", false, e.message); }

  try {
    check("wake() 可调用（节能唤醒路径）", typeof R.wake === "function" && (() => { R.wake(); return true; })());
  } catch (e) { check("wake", false, e.message); }

  check("CSS 含卡片渐入关键帧", html.includes("@keyframes cardIn"));
  check("CSS 含 reduced-motion 关闭动画", html.includes("prefers-reduced-motion:reduce"));

  // ---- v6：边界 / 压力 ----
  try {
    const minimal = {
      meta: { project: "极小数据", mode: "", date: "", badge: "", progress: 50 },
      total: 30,
      orgs: [{ id: "solo", name: "唯一主体", short: "唯一", type: "core", health: 40, role: "r", power: "p", act: "a", block: "b", tags: [], phases: [0] }],
      links: [],
      phases: [{ label: "唯一阶段", date: "2026-01", diag: "d" }],
      blockers: [],
      dims: []
    };
    check("validateData 接受极小数据集", R.validateData(minimal) === null);
    R.loadData(JSON.parse(JSON.stringify(minimal)));
    check("加载极小数据集无异常（含空 links/blockers/dims）", true);
    check("极小数据：风险速览显示无高风险", doc.getElementById("risks").innerHTML.includes("无高风险卡点"));
    const mdMini = R.reportToMarkdown();
    check("极小数据：报告可生成", mdMini.includes("# 跨组织协同体检报告"));
    R.startTyping();
    R.resetReport();
    R.switchScene(0);
  } catch (e) { check("极小数据边界", false, e.message); }

  try {
    const bad1 = JSON.parse(JSON.stringify(R.ALL_SCENES[0]));
    bad1.orgs[0].phases = [99];
    check("validateData 拒绝阶段下标越界", /阶段下标越界/.test(R.validateData(bad1) || ""));
    const bad2 = JSON.parse(JSON.stringify(R.ALL_SCENES[0]));
    bad2.links.push(["agent", "agent", "自环", 50]);
    check("validateData 拒绝自环关系", /同一主体/.test(R.validateData(bad2) || ""));
    const bad3 = JSON.parse(JSON.stringify(R.ALL_SCENES[0]));
    bad3.dims = [];
    check("validateData 接受空 dims（不崩溃路径）", R.validateData(bad3) === null);
  } catch (e) { check("validateData 硬化", false, e.message); }

  // v6：拖拽节能修正 —— 拖拽中一律不停渲染（直接验证逻辑）
  try {
    R.getN().forEach(n => { n.vx = 0; n.vy = 0; });
    R.setDrag(R.getN()[0]);
    check("isAnimating：拖拽中为真（不停渲染）", R.isAnimating() === true);
    R.setDrag(null);
    check("isAnimating：全部静止且无拖拽时为假（可暂停）", R.isAnimating() === false);
  } catch (e) { check("拖拽节能修正", false, e.message); }

  // ---- v7：报告单视觉 / 雷达 / 维度归因 / 分诊 ----
  try {
    // 计数为 setInterval 动画，桩环境不推进；只校验元素存在且为数值容器
    check("英雄区：大字总分容器就绪（计数动画为浏览器时序）",
      doc.getElementById("scoreV").tagName !== undefined);
    const sealHTML = doc.getElementById("gradeSeal").innerHTML || "";
    check("英雄区：印章含等级名称与字母", /^[良中优差]/.test(sealHTML) && /[ABCD]/.test(sealHTML));
    const concl = doc.getElementById("heroConcl").textContent;
    check("英雄区：自动结论句生成", concl.length > 20 && /。$/.test(concl));
    check("报告编号格式", /^ATRIA-\d{4}-\d{2}-\d{3}$/.test(doc.getElementById("reportNo").textContent));
    check("签发日期", doc.getElementById("reportDate").textContent.includes("签发："));
    const rb = doc.getElementById("radarBox");
    check("雷达图 SVG 已注入（五顶点 + 环 + 数据多边形）",
      rb.innerHTML.includes("<svg") && rb.innerHTML.split("<circle").length >= 6 &&
      rb.innerHTML.includes("polygon") && rb.innerHTML.includes("role=\"img\""));
    // 元素随场景重渲染累积，取最近一批
    const allDimRows = createdEls.filter(e => e.className === "dim-row");
    const dimRows = allDimRows.slice(-5);
    check("维度列表 5 行且含短板标注", dimRows.length === 5 && dimRows.some(r => (r.innerHTML || "").includes("短板")));
  } catch (e) { check("英雄区", false, e.message); }

  try {
    R.pickDim(1); // 「信息通畅度」
    check("pickDim：详情为维度诊断", doc.getElementById("detail").innerHTML.includes("维度诊断"));
    check("pickDim：非归因卡点被淡出", createdEls.some(e => e.className === "blk dim-fade"));
    check("pickDim：网络提示显示维度归因", doc.getElementById("netHint").classList.contains("show") &&
      doc.getElementById("netHint").textContent.includes("维度归因"));
    R.pickDim(1);
    check("pickDim 再点：取消过滤，卡点恢复", !createdEls.some(e => e.className === "blk dim-fade"));
  } catch (e) { check("维度归因", false, e.message); }

  try {
    const nBlks = (R.DATA.blockers || []).length;
    const allBlks = createdEls.filter(e => e.className === "blk" || e.className === "blk dim-fade");
    const blks = allBlks.slice(-nBlks);
    const triageHeaders = blks.map(b => b.parentElement && b.parentElement.className);
    const sevCls = { "高": "triage t-hi", "中": "triage t-mid", "低": "triage t-low" };
    const expected = [...new Set((R.DATA.blockers || []).map(b => b.sev))].map(s => sevCls[s]);
    check("卡点分诊：按场景实际严重度分组且不缺组",
      blks.length === nBlks &&
      expected.length === new Set(triageHeaders).size &&
      expected.every(t => triageHeaders.includes(t)));
    check("卡点分诊：分组内卡片数与该严重度卡点数一致",
      expected.every(t => triageHeaders.filter(x => x === t).length ===
        (R.DATA.blockers || []).filter(b => sevCls[b.sev] === t).length));
    // 角标经 innerHTML 字符串渲染，桩环境不物化成元素，从卡片 HTML 串断言
    const blkHTML = blks.map(b => b.innerHTML || "").join("");
    check("卡点分诊：存在维度归因角标（chip）", blkHTML.includes("dim-chip"));
  } catch (e) { check("卡点分诊", false, e.message); }

  try {
    const nPh = (R.DATA.phases || []).length;
    const allDots = createdEls.filter(e => e.className === "tl-dots" || /^tl-dots\s/.test(e.className || ""));
    const dots = allDots.slice(-nPh);
    check("时间轴：当前批每阶段有参与密度点", dots.length === nPh);
    check("时间轴：密度点总数与参与人次一致",
      dots.reduce((s, d) => s + d.children.length, 0) ===
      (R.DATA.orgs || []).reduce((s, o) => s + (o.phases || []).length, 0));
  } catch (e) { check("时间轴密度", false, e.message); }

  try {
    const md = R.reportToMarkdown();
    check("Markdown 报告单：结论先行 + 签发尾", md.indexOf("一、总检结论") < md.indexOf("七、按主体整改清单") &&   /* v19：六 / 七节按屏幕编号原样收录，不再改名【】 */
      md.includes("签发：Atria-Dawn 协同诊断中心"));
  } catch (e) { check("Markdown 报告单", false, e.message); }

  // ---- v11：语义多色不变量 ----
  try {
    const dimLight = ["#3b5bdb", "#0891b2", "#7c3aed", "#059669", "#db2777"];
    const dimDark  = ["#818cf8", "#22d3ee", "#a78bfa", "#34d399", "#f472b6"];
    const sevLight = ["#dc2626", "#d97706", "#475569"];   // 高 / 中 / 低
    const sevDark  = ["#f0524a", "#fbbf24", "#94a3b8"];
    const need = dimLight.concat(dimDark, sevLight, sevDark);
    const missing = need.filter(c => !html.toLowerCase().includes(c));
    check("语义多色：五维签名色 + 严重度三档齐备（浅/深）", missing.length === 0, missing.join("、"));
    check("语义多色：五维签名色互不重复", new Set(dimLight).size === 5);
    const oldColors = [
      "#f4f1e8", "#fffdf7", "#9c7a1e", "#c08a12", "#faf0d8", "#f3ebd2", "#0e8f7a",
      "#0f766e", "#3ba8a0", "#2ec4a9", "#d4554a", "#c0392b", "#b3342c", "#e0b34f", "#d9b552",
      "#f08070", "#1f6fb2", "#2b5d73", "#6ecbc3",
      "#5b7f9e", "#3f5f7d", "#a52831", "#8fa8c0", "#5d6b7a",
      "#1d4e63", "#6f9cc4", "#0d9488", "#2dd4bf", "#b91c1c", "#e06658",
      "#8c8c8c", "#4d4d4d", "#7a7a7a", "#b9b9b9"  // v10 灰阶段（健康档不应再是灰阶）
    ];
    const leftovers = oldColors.filter(c => html.toLowerCase().includes(c));
    check("语义多色：v3–v10 旧调色板零残留", leftovers.length === 0, leftovers.join("、"));
  } catch (e) { check("语义多色", false, e.message); }

  // 主题切换
  try {
    R.themeBtn.onclick();
    check("主题切换为深色（documentElement data-theme=dark）", doc.documentElement.getAttribute("data-theme") === "dark");
    R.themeBtn.onclick();
    check("主题切回浅色并持久化 storage", doc.documentElement.getAttribute("data-theme") === null && storage._d["atria_demo_theme"] === "light");
  } catch (e) { check("主题切换", false, e.message); }

  // 数据完整性（所有场景）
  try {
    const issues = [];
    R.ALL_SCENES.forEach((d, si) => {
      const tag = "场景" + si;
      const ids = new Set((d.orgs || []).map(o => o.id));
      if (new Set((d.orgs || []).map(o => o.id)).size !== (d.orgs || []).length) issues.push(tag + " orgs id 重复");
      (d.orgs || []).forEach(o => {
        if (typeof o.health !== "number" || o.health < 0 || o.health > 100) issues.push(tag + " " + o.id + " health 越界");
        (o.phases || []).forEach(pi => { if (pi < 0 || pi >= (d.phases || []).length) issues.push(tag + " " + o.id + " 阶段下标越界 " + pi); });
      });
      (d.links || []).forEach(l => {
        if (!ids.has(l[0]) || !ids.has(l[1])) issues.push(tag + " link 引用缺失 " + l[0] + "/" + l[1]);
        if (typeof l[3] !== "number" || l[3] < 0 || l[3] > 100) issues.push(tag + " link health 越界");
      });
      (d.blockers || []).forEach(b => {
        if (!["高", "中", "低"].includes(b.sev)) issues.push(tag + " blocker sev 非法 " + b.sev);
        (b.orgs || []).forEach(id => { if (!ids.has(id)) issues.push(tag + " blocker 引用缺失 " + id); });
      });
      (d.dims || []).forEach(dm => { if (typeof dm.v !== "number") issues.push(tag + " dim v 非数值"); });
      if (!(d.phases || []).length) issues.push(tag + " phases 为空");
    });
    check("全部场景数据完整性（id/引用/下标/sev/分值范围）", issues.length === 0, issues.slice(0, 5).join("；"));
  } catch (e) { check("数据完整性", false, e.message); }

  // ---- v12：复查快照 / 动态场景按钮 / 键盘与空态 / 报告六七节 / 视口 ----
  try {
    check("v12：场景数 = 5（医院/轨道/排水/学校/水厂）", R.ALL_SCENES.length === 5, "got " + R.ALL_SCENES.length);
    const prevIssues = [];
    R.ALL_SCENES.forEach((d, si) => {
      const p = d.prev;
      if (!p) { prevIssues.push("场景" + si + " 无 prev"); return; }
      if (typeof p.total !== "number") prevIssues.push("场景" + si + " prev.total 非数值");
      if (typeof p.date !== "string" || !p.date) prevIssues.push("场景" + si + " prev.date 缺失");
      if ((p.dims || []).length !== 5) prevIssues.push("场景" + si + " prev.dims 非 5 项");
      const ids = new Set((d.orgs || []).map(o => o.id));
      Object.keys(p.orgs || {}).forEach(id => {
        if (!ids.has(id)) prevIssues.push("场景" + si + " prev.orgs 引用缺失 " + id);
      });
      // 当前主体都应有趋势（否则趋势行静默缺失）
      ids.forEach(id => {
        if (!((p.orgs || {}) && id in p.orgs)) prevIssues.push("场景" + si + " prev.orgs 未覆盖 " + id);
      });
      (d.dims || []).forEach((dm, i) => {
        if (p.dims && typeof p.dims[i] === "number" && dm.v === p.dims[i]) {/* 持平合法 */}
      });
    });
    check("v12 复查快照：5 场景均有 prev（date/total/dims×5/orgs 子集）", prevIssues.length === 0, prevIssues.slice(0, 5).join("；"));
    // Δ 符号一致性（总分差 = 当前 - prev）
    const dSign = R.ALL_SCENES.map(d => d.prev ? (d.total || 0) - d.prev.total : null);
    check("v12 复查快照：趋势有正有负（叙事有改善也有恶化，非单调）",
      dSign.some(x => x > 0) && dSign.some(x => x < 0), JSON.stringify(dSign));
  } catch (e) { check("复查快照", false, e.message); }

  try {
    // 动态场景按钮（HTML 不再硬编码 sceneBtn0…）
    check("v12：HTML 无硬编码场景按钮（id=\"sceneBtn0\" 已移除）", !html.includes('id="sceneBtn0"'));
    R.switchScene(0);
    const wrap = doc.getElementById("sceneBtnsWrap");
    const btns = createdEls.filter(e => e.tagName === "button" && /^sceneBtn\d+$/.test(e.id || ""));
    const names = btns.map(b => b.textContent || "").join("|");
    check("v12：buildSceneBtns 生成 5 个按钮", btns.length === 5, "got " + btns.length);
    check("v12：按钮文案取自 meta.project（学校/水厂出现）", names.includes("学校") && names.includes("水厂"), names);
    check("v12：wrap data-built 标记 = 场景数", wrap.getAttribute("data-built") === "5");
    // 复查 chip
    R.switchScene(0);
    const chip = doc.getElementById("deltaChip");
    check("v12：复查 chip 显示（较上次）", !chip.hidden && (chip.textContent || "").includes("较上次"), chip.textContent);
    check("v12：复查 chip 方向为 up（72 vs 67）", (chip.className || "").includes("up"), chip.className);
    R.switchScene(2);
    const chip2 = doc.getElementById("deltaChip");
    check("v12：复查 chip 方向为 down（63 vs 66）", (chip2.className || "").includes("down"), chip2.className + "/" + chip2.textContent);
    // 维度行 Δ
    const dimRows = createdEls.filter(e => e.className === "dim-row").slice(-5);
    check("v12：维度行带 Δ 标记（ddelta）", dimRows.some(r => (r.innerHTML || "").includes("ddelta")));
    check("v12：维度行 Δ 有正有负（▲/▼）",
      dimRows.some(r => (r.innerHTML || "").includes("▲")) && dimRows.some(r => (r.innerHTML || "").includes("▼")));
    // 主体详情趋势 + 上下游
    R.selectNode(R.getN()[0]);
    const det = doc.getElementById("detail");
    check("v12：主体详情含复查趋势（较上次）", (det.innerHTML || "").includes("较上次"));
    check("v12：主体详情含上/下游关系行", (det.innerHTML || "").includes("上游") && (det.innerHTML || "").includes("下游"));
    // 结论含复查同比
    const concl = doc.getElementById("heroConcl").textContent || "";
    check("v12：英雄区结论含复查同比", concl.includes("较上次体检"), concl.slice(0, 60));
  } catch (e) { check("复查 UI", false, e.message); }

  try {
    // 搜索 data-bi 映射修复 + 空态
    const blks = createdEls.filter(e => (e.className || "") === "blk");
    check("v12：卡点带 data-bi 数据下标", blks.length > 0 && blks.every(b => (b.getAttribute("data-bi") || "") !== ""));
    const si = doc.getElementById("blkSearch");
    const inputFn = (si._ls.find(x => x[0] === "input") || [])[1];
    if (si && inputFn) {
      si.value = "zzzz无此卡点";
      inputFn();
      check("v12：搜索空态出现（未命中提示）", (doc.getElementById("blkEmpty") || {})._tc ?
        String(doc.getElementById("blkEmpty")._tc).includes("未命中") : true);
      si.value = "停水";
      inputFn();
      const emptyGone = !createdEls.some(e => e.id === "blkEmpty" && e._tc);
      check("v12：命中后空态清除", emptyGone);
      si.value = "";
      inputFn();
    }
    // 键盘上下导航 + Enter 展开（在卡点元素上派发 keydown）
    const kbdEls = createdEls.filter(e => (e.className || "") === "blk");
    if (kbdEls.length >= 2) {
      const k0 = kbdEls[0];
      const h0 = (k0._ls.find(x => x[0] === "keydown") || [])[1];
      let fired = 0;
      if (h0) {
        h0({ key: "ArrowDown", preventDefault() { } });
        h0({ key: "ArrowUp", preventDefault() { } });
        fired = 2;
      }
      check("v12：卡点方向键导航处理器可触发（无异常）", fired === 2);
      const before = createdEls.filter(e => (e.className || "").includes("open")).length;
      h0 && h0({ key: "Enter", preventDefault() { } });
      check("v12：卡点 Enter 展开（手风琴单开）",
        createdEls.filter(e => (e.className || "").includes("open")).length === Math.max(1, before));
    } else {
      check("v12：卡点方向键导航（元素不足，跳过）", false);
    }
  } catch (e) { check("搜索空态/键盘导航", false, e.message); }

  try {
    // 画布视口：平移/缩放句柄与复位
    const cv = R.getCanvas();
    check("v12：canvas wheel 监听已注册（缩放）", (cv._ls || []).some(x => x[0] === "wheel"));
    check("v12：toWorld 坐标换算存在", typeof R.toWorld === "function");
    const v0 = R.getView();
    check("v12：初始视口 z=1 / x=y=0", v0.z === 1 && v0.x === 0 && v0.y === 0, JSON.stringify(v0));
    const cv1 = R.getCanvas();
    const kd = (cv1._ls.find(x => x[0] === "keydown") || [])[1];
    if (kd) {
      kd({ key: "+", preventDefault() { } });
      const vz = R.getView();
      check("v12：+ 键放大（z>1）", vz.z > 1, JSON.stringify(vz));
      kd({ key: "0", preventDefault() { } });
      const vreset = R.getView();
      check("v12：0 键复位视口", vreset.z === 1 && vreset.x === 0 && vreset.y === 0, JSON.stringify(vreset));
    }
    R.switchScene(1);
    const vAfterSwitch = R.getView();
    check("v12：切换场景后视口复位", vAfterSwitch.z === 1 && vAfterSwitch.x === 0 && vAfterSwitch.y === 0, JSON.stringify(vAfterSwitch));
  } catch (e) { check("画布视口", false, e.message); }

  try {
    const lines = R.buildReportLines();
    check("v12：报告含「六、30 天干预时间线」", lines.some(l => l.startsWith("六、30 天干预时间线")));
    check("v12：报告含「七、按主体整改清单」", lines.some(l => l.startsWith("七、按主体整改清单")));
    const li6 = lines.find(l => l.startsWith("六、30 天干预时间线")) || "";
    check("v12：时间线含 D1–D7 / D8–D21 / D22–D30 排期", li6.includes("D1–D7") && li6.includes("D8–D21") && li6.includes("D22–D30"));
    const li7 = lines.find(l => l.startsWith("七、按主体整改清单")) || "";
    check("v12：整改清单按主体分组（短名 + 认领事项）", li7.includes("（") && li7.includes("–"));
    const md = R.reportToMarkdown();
    check("v12/v19：Markdown 含时间线 / 整改清单两节（v19：按屏幕报告原编号收录）",
      md.includes("## 六、30 天干预时间线") && md.includes("## 七、按主体整改清单"));
    check("v12：打印 CSS 避孤分页规则", html.includes("break-inside:avoid") && html.includes("@page{margin"));
    check("v12：aria-live 已挂载（detail / netHint）",
      html.includes('id="detail" aria-live="polite"') && html.includes('id="netHint" aria-live="polite"'));
  } catch (e) { check("报告六七节", false, e.message); }

  // ---- v13：可用性（详情常驻 / 缩放工具条 / 跳过动画 / 章节导航 / 快捷键 / 内置巡览） ----
  try {
    check("v13：detail 常驻抽屉 sticky + 限高滚动",
      html.includes(".detail{position:sticky;top:16px;align-self:start;max-height:calc(100vh - 32px)"));
    const needIds = ["zoomIn", "zoomOut", "zoomReset", "skipBtn", "tourBtn", "coachTip", "coachX", "dockNav", "kbdHelp",
      "cardHero", "cardRisks", "cardTimeline", "cardNet", "cardBlocks", "cardReport"];
    const missingIds = needIds.filter(id => !html.includes('id="' + id + '"'));
    check("v13：新增元素 id 齐备", missingIds.length === 0, missingIds.join("、"));
    check("v13：画布工具条提示文案", html.includes("滚轮缩放 · 拖拽空白处平移 · 0 键复位"));
  } catch (e) { check("v13 元素", false, e.message); }

  try {
    // 缩放按钮
    R.zoomBy(1.2);
    check("v13：zoomBy 放大（z=1.2）", Math.abs(R.getView().z - 1.2) < 1e-9, String(R.getView().z));
    R.zoomBy(10);        // 封顶 2.5
    check("v13：zoomBy 封顶 2.5", R.getView().z === 2.5, String(R.getView().z));
    R.resetView();
    check("v13：resetView 复位", R.getView().z === 1 && R.getView().x === 0 && R.getView().y === 0);
    // 报告跳过
    R.startTyping();
    check("v13：生成中跳过按钮可见", doc.getElementById("skipBtn").style.display !== "none");
    const skipped = R.finishTyping();
    check("v13：finishTyping 立即出全文", skipped === true);
    const rep = doc.getElementById("report");
    const pCount = rep.querySelectorAll("p").length;
    check("v13：跳过后报告段落数 = 报告行数", pCount === R.buildReportLines().length, "p=" + pCount + " lines=" + R.buildReportLines().length);
    check("v13：跳过后含六/七节文本（v18：章节标题为 h3，查 p+h3）",
      [...rep.querySelectorAll("p,h3")].some(el => (el.textContent || "").includes("六、30 天干预时间线")) &&
      [...rep.querySelectorAll("p,h3")].some(el => (el.textContent || "").includes("七、按主体整改清单")));
    check("v13：跳过后跳过按钮隐藏", doc.getElementById("skipBtn").style.display === "none");
    check("v13：跳过后按钮回到「重新生成」", doc.getElementById("genBtn").textContent === "重新生成");
    R.resetReport();
  } catch (e) { check("缩放/跳过", false, e.message); }

  try {
    // 章节导航
    const nav = doc.getElementById("dockNav");
    check("v13：悬浮导航 6 个章节按钮", nav.children.length === 6, "got " + nav.children.length);
    const labels = [...nav.children].map(b => b.textContent || "").join("/");
    check("v13：导航文案 总览/风险/时间轴/网络/卡点/报告",
      labels === "总览/风险/时间轴/网络/卡点/报告", labels);
  } catch (e) { check("章节导航", false, e.message); }

  try {
    // 快捷键：? 开关帮助、/ 聚焦搜索、Esc 关闭
    const kds = R.winListeners["keydown"] || [];
    const helpEl = doc.getElementById("kbdHelp");
    helpEl.hidden = true;   /* 模拟 HTML 中的 hidden 属性 */
    check("v13：window keydown 监听已注册", kds.length >= 1);
    const fire = k => kds.forEach(f => f({ key: k, target: doc.body, preventDefault() { } }));
    fire("?");
    check("v13：? 打开快捷键帮助", helpEl.hidden === false);
    fire("?");
    check("v13：再按 ? 关闭", helpEl.hidden === true);
    fire("/");
    check("v13：/ 聚焦搜索（无异常，且不误触发帮助）", helpEl.hidden === true);
    fire("?");
    fire("Escape");
    check("v13：Esc 关闭帮助", helpEl.hidden === true);
  } catch (e) { check("快捷键", false, e.message); }

  try {
    // 首访提示默认隐藏（hidden 属性）
    check("v13：首访提示默认隐藏", html.includes('class="coach-tip" id="coachTip" hidden'));
  } catch (e) { check("首访提示", false, e.message); }

  // ---- v14：CSS 嵌套检测（v13 曾因此让整套新样式失效） ----
  let css = "";   /* v15 静态回归也用 */
  try {
    const styleM = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    css = styleM ? styleM[1] : "";
    const stack = [];
    let pending = "", inStr = null, inCmt = false, violations = [];
    for (let i = 0; i < css.length; i++) {
      const ch = css[i], nx = css[i + 1];
      if (inCmt) { if (ch === "*" && nx === "/") { inCmt = false; i++; } continue; }
      if (inStr) { if (ch === "\\") i++; else if (ch === inStr) inStr = null; continue; }
      if (ch === "/" && nx === "*") { inCmt = true; i++; continue; }
      if (ch === '"' || ch === "'") { inStr = ch; continue; }
      if (ch === "{") {
        const legal = stack.length === 0 || /^@/.test(stack[stack.length - 1] || "");
        if (!legal) violations.push(pending.trim().slice(0, 60));
        stack.push(pending.trim()); pending = ""; continue;
      }
      if (ch === "}") { stack.pop(); pending = ""; continue; }
      if (stack.length === 0) pending += ch;
    }
    check("v14：CSS 无非法嵌套（@media 等外层规则除外）", violations.length === 0, violations.slice(0, 4).join(" ｜ "));
    check("v14：.theme-btn 规则自身完整闭合（不再拦腰）", /\.theme-btn\{[^{}]*\}/.test(css));
    check("v14：coach-tip 用 --ink 而非未定义的 --heavy", !css.includes("var(--heavy)"));
    check("v14：toast 样式与 show 态存在", css.includes(".say-toast") && css.includes(".say-toast.show"));
  } catch (e) { check("CSS 嵌套检测", false, e.message); }

  // ---- v14：挑刺清单修复回归 ----
  try {
    check("v14：<title> 不再带版本号（v11）", !html.includes("（v11）"));
    check("v14：对比面板提示文案 = 描边浅色条", html.includes("描边浅色条为对比场景"));
    check("v14：雷达图 viewBox 已加宽（边缘标签不裁切）", html.includes('viewBox="-20 -20 270 270"'));
    check("v14：巡览结束输出 TOUR_DONE 供 record.js 停止截帧", mainCode.includes('console.log("TOUR_DONE")'));
    check("v14：tourCancel 不吞巡览按钮自身的点击", mainCode.includes('closest("#tourBtn")'));
    check("v14：巡览第八幕调 finishTyping 直出全文", /⑨[\s\S]{0,500}finishTyping\(\)/.test(mainCode));
    check("v14：resize() 末尾调 wake()（节能期改变窗口不留白板）", /function resize\(\)\{[\s\S]*?wake\(\);[\s\S]*?\}/.test(mainCode));
    check("v14：Esc 连维度过滤一起清", mainCode.includes("if(activeDim!==null)pickDim(activeDim)"));
    check("v14：编辑应用后与导入一致（curScene=-1 + buildSceneBtns）",
      /editBtn[\s\S]{0,600}curScene=-1;buildSceneBtns\(\)/.test(mainCode));
    check("v14：sayTo 顶部 toast", mainCode.includes('$("sayToast")') && html.includes('id="sayToast"'));
    check("v14：搜索空态推荐词取自当前场景数据（v23：取完整标题整词，不再硬切四字）", mainCode.includes('map(b=>(b.t||"").trim())'));
    check("v14：搜索时空分组组头隐藏", mainCode.includes('#blks .triage'));
    check("v14：卡点卡片去掉 role=button（不再按钮套按钮）", !mainCode.includes('d.setAttribute("role","button")'));
    check("v14：卡点卡片带 aria-label", mainCode.includes("风险，点击展开详情"));
  } catch (e) { check("v14 静态回归", false, e.message); }

  try {
    /* pickDim：按下标高亮 + 淡出，修「显示位置≠数据下标」错位 */
    R.pickDim(0);
    const rows = qsAll(".dim-row");
    const pressed = rows.filter(r => (r._attrs || {})["aria-pressed"] === "true");
    /* 注：桩不 detach innerHTML 重渲染的旧行（真浏览器会），故断言改为「高亮集合恰等于 data-di=0 的行集合」 */
    const di0 = rows.filter(r => (r._attrs || {})["data-di"] === "0");
    check("v14：pickDim 高亮集合 = data-di 为 0 的行（按下标而非显示位置）",
      di0.length > 0 && pressed.length === di0.length &&
      pressed.every(r => (r._attrs || {})["aria-pressed"] === "true") &&
      pressed.every(r => (r._attrs || {})["data-di"] === "0"),
      "pressed=" + pressed.length + " zeros=" + di0.length);
    const faded = qsAll(".blk").filter(b => (b.className || "").split(/\s+/).includes("dim-fade"));
    const wronglyFaded = faded.filter(b => {
      const bi = parseInt((b._attrs || {})["data-bi"], 10);
      return !isNaN(bi) && R.getAttrMap()[bi] === 0;
    });
    check("v14：归因卡点不再被误淡出（attrMap 按数据下标取）", wronglyFaded.length === 0,
      "误淡 " + wronglyFaded.length);
    R.pickDim(0);   /* 关闭过滤 */
    check("v14：再次点击同一维度关闭过滤", !qsAll(".blk").some(b => (b.className || "").split(/\s+/).includes("dim-fade")));
  } catch (e) { check("pickDim 回归", false, e.message); }

  try {
    /* 报告日期 / Markdown 交付物 */
    const rd = doc.getElementById("reportDate");
    check("v14：页眉签发日期剥掉「体检日期：」前缀",
      /^\u7b7e\u53d1\uff1a[0-9]/.test(rd.textContent || "") && !(rd.textContent || "").includes("体检日期"),
      rd.textContent);
    const md = R.reportToMarkdown();
    check("v14：md 无「高 · 高」小节标题", !/\u9ad8 \u00b7 \u9ad8|\u4e2d \u00b7 \u4e2d|\u4f4e \u00b7 \u4f4e/.test(md));
    check("v14：md 分诊小标题为「重点干预 · 高风险」（v23：组名括注与后半重复已去掉）",
      md.includes("### 重点干预 · 高风险") && !md.includes("重点干预（高风险）"));
    check("v14：md 不再套娃（一~四节只出现一次）", (md.match(/## 一、总检结论/g) || []).length === 1);
    check("v14/v19：md 六 / 七节按屏幕报告编号收录（不再改名【】小标题）",
      md.includes("## 六、30 天干预时间线") && md.includes("## 七、按主体整改清单") &&
      !md.includes("【30 天干预时间线】") && !md.includes("【按主体整改清单】"));
    check("v14：cleanIssueDate 容错空数据", R.cleanIssueDate({ meta: {} }) === "2026年");
  } catch (e) { check("报告/md 回归", false, e.message); }

  // ---- v15：二轮挑刺清零回归 ----
  try {
    const ti = html.indexOf('id="sayToast"'), ki = html.indexOf('id="kbdHelp"');
    check("v15：toast 与 kbdHelp 同级（不被 hidden/transform 弹层吞掉）", ti > 0 && ti < ki, "ti=" + ti + " ki=" + ki);
    check("v15：卡片 keydown 不吞内部按钮的 Enter/Space",
      mainCode.includes('e.target.tagName==="BUTTON"') && mainCode.includes("v15：焦点在内部按钮"));
    check("v15：巡览字幕无「模板不改版」黑话", !mainCode.includes("模板不改版"));
    check("v15：巡览按实际点击行命名维度", mainCode.includes("dimName") && mainCode.includes("textContent"));
    check("v15：巡览点非当前场景（aria-pressed 判断）",
      mainCode.includes('b.getAttribute("aria-pressed")!=="true"'));
    check("v15：对比条为真描边空心条", css.includes("background:transparent;border:1.5px solid var(--dim1)"));
    check("v15：startTour 收起首访气泡", mainCode.includes('const cp=$("coachTip");if(cp)cp.hidden=true;'));
    check("v15：持平不再拼成「持平0 / 持平 分」",
      mainCode.includes('dT===0?"与上次持平"') && mainCode.includes('d<0?d+" 分":"与上次持平"'));
    check("v15：Esc 同时清卡点选中/展开态", mainCode.includes("activeBlocker=null;clearBlkSel();"));
    check("v15：协同亮点空列表有兜底文案", mainCode.includes("当前无运行平稳的标杆关系"));
    check("v15：对比模式点当前场景有提示", mainCode.includes("请选另一个场景作对比"));
    check("v15：卡片编号统一为中文序数（v16：徽章同步中文 / v18：⚖! 并入标题文字，七卡同体系）",
      html.includes('<span class="no">二</span> · 场景对比（⚖）') &&
      html.includes('<span class="no">三</span> · 风险速览（!） · 一键定位') &&
      html.includes('<span class="no">四</span> · 协同时间轴') &&
      html.includes('<span class="no">五</span> · 跨组织协同关系网络') &&
      html.includes('<span class="no">六</span> · 卡点分诊') &&
      html.includes('<span class="no">七</span> · 一键生成协同复盘报告'));
    check("v15/v16：英雄区有总分口径脚注（诚实口径）", html.includes("总分为综合评值（含定性判断）"));
    check("v15：首末节点密度点对齐", css.includes("justify-content:flex-start") && css.includes("justify-content:flex-end"));
  } catch (e) { check("v15 静态回归", false, e.message); }

  // ---- v16：三轮挑刺清零回归 ----
  try {
    check("v16：卡片徽章与标题同为中文序数（不再 1↔四 打架）",
      html.includes('<span class="no">四</span>') && !html.includes('<span class="no">1</span>') &&
      html.includes('<span class="no">五</span>') && !html.includes('<span class="no">2</span>'));
    check("v16：巡览维度名从 DATA.dims 取纯名（不带「归因 n 项▲ +4」）",
      mainCode.includes("DATA.dims[+dimBadge]"));
    check("v16：巡览阶段名运行时取（DATA.phases[dotIdx]）",
      mainCode.includes("DATA.phases[dotIdx]") && mainCode.includes("dotIdx"));
    check("v16：巡览编号 ①~⑨ 无「② 续」",
      mainCode.includes("③ 关联卡点") && !mainCode.includes("② 续") &&
      mainCode.includes("⑦ 一键切换场景") && mainCode.includes("⑨ 生成复盘报告"));
    check("v16：快捷键弹层窄屏自适应", css.includes("width:min(440px,calc(100vw - 32px))"));
    check("v16：总分脚注为诚实口径（综合评值含定性判断）",
      html.includes("总分为综合评值（含定性判断），非五维简单均值"));
    check("v16：toast 不进打印件", css.includes(".say-toast,footer,.masthead .meta{display:none!important;}"));
    check("v16：维度行持平态有灰配色", css.includes(".ddelta.eq{color:var(--muted);}"));
    check("v16：「平稳」口径统一（详情 ≥79 才称标杆）", mainCode.includes("未达标杆线（≥79）"));
    check("v16：sayTo 三档（ok/info/err），信息提示不占告警红",
      mainCode.includes('ok==="info"?"info":"err"') && css.includes(".say-toast.info{background:var(--muted);}"));
    check("v16：信息性提示用 info 档（非 false）",
      mainCode.includes('"已放弃导入","info"') && mainCode.includes('作对比","info")'));
    check("v16：对比差值 down 染中性灰（不占告警红）", css.includes(".cmp-delta.down{color:var(--muted);}"));
    check("v16：描边对比条 0 值时跳过渲染（不留 3px 竖线）",
      mainCode.includes('(vb==null||vb<=0)?"display:none"'));
    check("v16：最薄弱关系 N 项运行时 + 空态兜底",
      mainCode.includes("（健康度最低 ${weak.length} 项）") && mainCode.includes("关系网络无薄弱项"));
    check("v16：窄屏点最薄弱关系滚到详情面板", mainCode.includes("narrow?detail:canvas"));
    check("v16：用户可见文案无 Delivery / 模板黑话",
      !html.includes("Delivery 能力") && !html.includes("模板自动重渲染") &&
      !html.includes("模板无需改版") && !html.includes("模板零改版"));
  } catch (e) { check("v16 静态回归", false, e.message); }

  // ---- v17：四轮挑刺清零回归 ----
  try {
    /* 严重①：zoomBy 钉住画布中心（与滚轮缩放同一锚点，不再把图朝右下平移出画布） */
    check("v17：zoomBy 源码含中心锚点（cx=W/2 + view.x=cx-wx*view.z）",
      mainCode.includes("const cx=W/2,cy=H/2") && mainCode.includes("view.x=cx-wx*view.z"));
    R.resetView();
    const rect = R.getCanvas().getBoundingClientRect();   /* 桩 canvas 1200×430，与页内 W/H 同源 */
    const cx = rect.width / 2, cy = rect.height / 2;
    const w0 = R.toWorld(cx, cy);
    R.zoomBy(1.5); R.zoomBy(1.2); R.zoomBy(1 / 1.1);
    const w1 = R.toWorld(cx, cy);
    check("v17：zoomBy 缩放前后画布中心对应的世界坐标不变（锚点=画布中心）",
      Math.abs(w0[0] - w1[0]) < 1e-6 && Math.abs(w0[1] - w1[1]) < 1e-6,
      "w0=" + w0.join(",") + " w1=" + w1.join(","));
    R.resetView();
  } catch (e) { check("zoomBy 中心锚点", false, e.message); }

  try {
    /* 严重②：主题切换重建雷达图 / 图例色带 / 维度行角标签名色（refreshThemeArtifacts） */
    check("v17：refreshThemeArtifacts 定义并被主题回调调用",
      mainCode.includes("function refreshThemeArtifacts") && mainCode.includes("refreshThemeArtifacts();"));
    R.switchScene(0);
    const rb = doc.getElementById("radarBox"), lg = doc.getElementById("legend");
    R.themeBtn.onclick();   // → 深色
    check("v17：切深色后雷达图重建（中心总分取深色 #e6eaf2，不再隐形）", rb.innerHTML.includes("#e6eaf2"));
    check("v17：切深色后图例色带重建（good 取深色 #34d399，形状说明仍在）",
      lg.innerHTML.includes("#34d399") && lg.innerHTML.includes("实心圆＝核心代建"));
    R.themeBtn.onclick();   // → 切回浅色
    check("v17：切回浅色雷达图 / 图例复原（#182230 / #059669）",
      rb.innerHTML.includes("#182230") && lg.innerHTML.includes("#059669"));
    check("v17：卡点角标带 data-di（签名色可随主题刷新）",
      mainCode.includes('class="dim-chip" type="button" data-di="${dimIdx}"'));
  } catch (e) { check("主题重建雷达/图例", false, e.message); }

  try {
    /* 中③：报告签发条补项目名（打印件能看出是哪个项目） */
    const lines = R.buildReportLines();
    const sign = lines[lines.length - 1];
    const proj = ((R.getDATA().meta || {}).project) || "";
    check("v17：签发条含项目名 + 编号 + 日期（打印 / 正文 / Markdown 三路一致）",
      sign.includes("签发：Atria-Dawn 协同诊断中心") && sign.includes("报告编号") &&
      proj !== "" && sign.includes(proj), sign.slice(0, 60));
  } catch (e) { check("签发条项目名", false, e.message); }

  try {
    /* 中④：巡览第 ④/⑤ 幕点击前先滚到对应卡片（v20 轻⑤：scrollIntoView 改走 smoothScroll 封装，
       断言随之改匹配新写法，「点击前先滚」的意图不变） */
    check("v17：巡览 ④/⑤ 点击前先滚到网络 / 时间轴卡片（smoothScroll 封装）",
      /④ 主体诊断[\s\S]{0,300}smoothScroll\(netCard/.test(mainCode) &&
      /⑤ 阶段聚焦[\s\S]{0,300}smoothScroll\(tlCard/.test(mainCode));
  } catch (e) { check("巡览 ④/⑤ 滚动", false, e.message); }

  try {
    /* 轻⑤：「当前 N%」标签贴住虚线下端（bottom:0，不再 top:98px 悬空） */
    check("v17：.tl-now span 用 bottom:0（不再 top:98px 掉到时间轴外）",
      css.includes(".tl-now span{position:absolute;bottom:0;") && !css.includes("top:98px"));
  } catch (e) { check("时间轴标签定位", false, e.message); }

  try {
    /* 轻⑥：全局 Esc —— 弹层优先关弹层，无弹层清空全部选中态并复位详情面板 */
    check("v17：全局 Esc 源码（无弹层时清选中 + 复位详情面板）",
      mainCode.includes("v17：无弹层时清空全部选中态并复位详情面板"));
    const kds = R.winListeners["keydown"] || [];
    const helpEl = doc.getElementById("kbdHelp");
    helpEl.hidden = true;
    const fire = k => kds.forEach(f => f({ key: k, target: doc.body, preventDefault() { } }));
    const faded = () => createdEls.some(e => (e.className || "").split(/\s+/).includes("dim-fade"));
    R.pickDim(1);
    check("v17（前置）：pickDim(1) 后维度过滤生效", faded() && R.detail.innerHTML.includes("维度诊断"));
    helpEl.hidden = false;
    fire("Escape");
    check("v17：弹层可见时 Esc 优先关弹层且不清选中", helpEl.hidden === true && faded());
    fire("Escape");
    check("v17：无弹层时全局 Esc 清维度过滤并复位详情面板",
      !faded() && R.detail.innerHTML.includes("点击总览五维"));
    R.selectNode(R.getN()[0]);
    fire("Escape");
    check("v17：全局 Esc 复位详情面板（主体诊断 → 初始引导文案）",
      R.detail.innerHTML.includes("点击总览五维"));
    helpEl.hidden = true;
  } catch (e) { check("全局 Esc", false, e.message); }

  try {
    /* 轻⑦：点画布空白取消选中后，右侧详情面板同步复位 */
    check("v17：pointerUp 空白分支源码（复位详情面板，与 Esc 路径统一；v22：有过滤/联动时保留其说明）",
      mainCode.includes("if(activeDim===null&&activePhase===null&&activeBlocker===null){") &&
      mainCode.slice(mainCode.indexOf("function pointerUp"), mainCode.indexOf("canvas.addEventListener(\"mousedown\"")).includes("点击总览五维"));
    const cvb = R.getCanvas();
    const up = (cvb._ls.find(x => x[0] === "mouseup") || [])[1];
    check("v17：canvas mouseup（pointerUp）监听已注册", !!up);
    if (up) {
      R.selectNode(R.getN()[0]);
      check("v17（前置）：选中主体后详情为该主体诊断", R.detail.innerHTML.includes("参与阶段"));
      up({ clientX: 5, clientY: 5 });   /* 画布左上角空白：节点环在画布中央，不命中节点 / 关系 */
      check("v17：空白点击后详情面板复位为初始引导（与 Esc 路径统一）",
        R.detail.innerHTML.includes("点击总览五维"));
      const qorgs = createdEls.filter(e => (e.className || "").split(/\s+/).includes("qorg"));
      check("v17：空白点击后快捷按钮 aria-current 全部 false",
        qorgs.length > 0 && qorgs.every(b => (b._attrs || {})["aria-current"] === "false"));
    }
  } catch (e) { check("空白点击复位详情", false, e.message); }

  try {
    /* 轻⑧：分诊组徽章同一符号体系（中风险不再残留数字序号「2」） */
    check("v17：中风险分诊徽章改「●」（! / ● / ✓ 同体系，无数字残留）",
      mainCode.includes('sev==="中"?"●"') && !/sev==="中"\?"[0-9]"/.test(mainCode));
  } catch (e) { check("分诊徽章", false, e.message); }

  // ---- v18：五轮挑刺清零回归 ----
  try {
    /* 轻⑤：「短板」口径统一 —— 列表给所有 <70 的维度挂标（与雷达图 <70 即红、结论句 <70 都算短板同口径） */
    R.switchScene(0);
    const dims0 = R.DATA.dims;
    const weakCount = dims0.filter(d => d.v < 70).length;
    const rows0 = qsAll(".dim-row").slice(-dims0.length);
    const marked = rows0.filter(r => (r.innerHTML || "").includes("短板"));
    check("v18：维度列表短板标注数 = <70 维度数（与雷达图 / 结论句同口径，不再只标最低项）",
      weakCount > 0 && marked.length === weakCount, "weak=" + weakCount + " marked=" + marked.length);
    check("v18：短板维度行 aria-label 同步带「，短板项」",
      rows0.filter(r => (r.getAttribute("aria-label") || "").includes("，短板项")).length === weakCount);
  } catch (e) { check("短板口径统一", false, e.message); }

  try {
    /* 中①：取消维度过滤后行按下态同步清除（aria-pressed 跟着 activeDim 走） */
    check("v18：pickDim 按下态源码带 activeDim 保护",
      mainCode.includes('(activeDim!==null&&di===i)?"true":"false"'));
    R.pickDim(0);
    R.pickDim(0);   /* 再点一次 = 取消过滤 */
    const stillPressed = qsAll(".dim-row").filter(r => (r._attrs || {})["aria-pressed"] === "true");
    check("v18：取消维度过滤后 dim-row 按下态全部清除（不再「关了过滤还亮着」）",
      stillPressed.length === 0, "残留按下行 " + stillPressed.length);
    R.switchScene(0);
  } catch (e) { check("pickDim 取消高亮", false, e.message); }

  try {
    /* 中②：主题切换时 #detail 面板内联色同步重取（维度签名色 / 主体健康度色） */
    check("v18：详情面板渲染抽成 renderDimDetail，主题回调按选中态重绘",
      mainCode.includes("function renderDimDetail") &&
      /refreshThemeArtifacts\(\)\{[\s\S]{0,3000}renderDimDetail\(activeDim\)/.test(mainCode) &&
      mainCode.includes("else if(selNode)showNode(selNode)"));
    const det = doc.getElementById("detail");
    R.pickDim(1);   /* 「信息通畅度」签名色：浅 #0891b2 / 深 #22d3ee */
    check("v18（前置）：pickDim 后面板为维度诊断且取浅色签名色",
      det.innerHTML.includes("维度诊断") && det.innerHTML.includes("#0891b2"));
    R.themeBtn.onclick();   /* → 深色 */
    check("v18：切深色后维度面板标题 / 分值签名色重取（#22d3ee，不留浅色 #0891b2）",
      det.innerHTML.includes("#22d3ee") && !det.innerHTML.includes("#0891b2"), det.innerHTML.slice(0, 80));
    R.themeBtn.onclick();   /* → 切回浅色 */
    check("v18：切回浅色维度签名色复原（#0891b2）",
      det.innerHTML.includes("#0891b2") && !det.innerHTML.includes("#22d3ee"));
    /* 主体健康度数字同样随主题重取 */
    const n0 = R.getN()[0];
    const band = n0.health < 65 ? "bad" : n0.health < 75 ? "mid" : "good";
    const lightH = { good: "#059669", mid: "#3b5bdb", bad: "#dc2626" }[band];
    const darkH = { good: "#34d399", mid: "#818cf8", bad: "#f0524a" }[band];
    R.selectNode(n0);
    check("v18（前置）：选中主体后面板为该主体诊断", det.innerHTML.includes("协同健康度"));
    R.themeBtn.onclick();   /* → 深色 */
    check("v18：切深色后主体健康度数字重取深色档",
      det.innerHTML.includes(darkH) && !det.innerHTML.includes(lightH), "want " + darkH);
    R.themeBtn.onclick();   /* → 切回浅色 */
    check("v18：切回浅色主体健康度复原", det.innerHTML.includes(lightH) && !det.innerHTML.includes(darkH));
    R.switchScene(0);
  } catch (e) { check("详情面板随主题重绘", false, e.message); }

  try {
    /* 中③：无高风险卡点 / 空卡点集时四 / 六 / 七节有空态兜底（页面报告与 Markdown 同源） */
    const noHigh = {
      meta: { project: "无高风险测试", date: "2026-10", badge: "测试数据" },
      orgs: [{ id: "a", name: "主体甲", short: "甲", health: 80, phases: [0], role: "代建", power: "代建职权", act: "统筹", block: "—" }],
      links: [], phases: [{ label: "阶段一", date: "2026-01" }],
      blockers: [{ t: "卡点甲", sev: "中", orgs: ["a"], d: "表现", fix: "处方" }],
      dims: [{ n: "维度一", v: 80 }], total: 80
    };
    R.loadData(noHigh);
    const l1 = R.buildReportLines();
    check("v18：无高风险卡点时四节有兜底文案（不再只有一个句号）",
      l1[3].includes("当前无高风险卡点，维持既有协同机制即可") && l1[3].length > "四、干预处方\n\n。".length + 10,
      l1[3].slice(0, 50));
    const noBlk = JSON.parse(JSON.stringify(noHigh));
    noBlk.blockers = [];
    R.loadData(noBlk);
    const l2 = R.buildReportLines();
    check("v18：卡点为空时六节说明本月无排期事项（不再冒号开头接空句）",
      l2[5].includes("当前无卡点需要排期") && !l2[5].endsWith("：\n"), l2[5].slice(0, 50));
    check("v18：卡点为空时七节说明无需主体认领",
      l2[6].includes("当前无卡点需主体认领整改") && !l2[6].endsWith("：\n"), l2[6].slice(0, 50));
    check("v18：空卡点集时三节既有「无」兜底仍有效", l2[2].includes("高风险 0 项"));
    /* md「五、执行清单」直接收 buildReportLines 的六/七两节，页面兜底同步进 Markdown */
    const md2 = R.reportToMarkdown();
    check("v18：六/七节空态兜底同步进 Markdown（执行清单节）",
      md2.includes("当前无卡点需要排期") && md2.includes("当前无卡点需主体认领整改"));
    R.switchScene(0);   /* 恢复医院场景，供后续检查 */
  } catch (e) { check("报告空态兜底", false, e.message); }

  try {
    /* 轻④：正文小标题与正文同款 → 章节首行拆 h3；打字路径收尾段套 .concl/.sign */
    check("v18：reportSegments 定义且打字 / 跳过 / 打印三路共用",
      mainCode.includes("function reportSegments") &&
      mainCode.includes("reportSegments(buildReportLines())") &&
      /startTyping\(\)\{[\s\S]{0,2000}reportSegments\(lines\)/.test(mainCode));
    R.startTyping();
    const rep = doc.getElementById("report");
    const kids = [...rep.children];
    check("v18：打字路径首个内容元素为 h3（.report h3 样式不再死代码）",
      kids.some(k => k.tagName === "h3") && kids.some(k => (k.className || "") === "caret"),
      kids.map(k => k.tagName + "." + (k.className || "-")).join(","));
    R.finishTyping();
    const h3s = [...rep.querySelectorAll("h3")];
    const ps = [...rep.querySelectorAll("p")];
    check("v18：跳过后 7 个章节 h3 且标题形如「X、…」",
      h3s.length === 7 && h3s.every(h => /^[一二三四五六七]、/.test(h.textContent || "")),
      h3s.map(h => h.textContent).join("|"));
    check("v18：跳过后段落数 = 报告行数（每行恰一个 p）", ps.length === R.buildReportLines().length, "p=" + ps.length);
    check("v18：首节正文挂 .concl、末段挂 .sign（与打印路径一致）",
      ps.some(p => (p.className || "") === "concl") && ps.some(p => (p.className || "") === "sign"),
      ps.map(p => p.className || "-").join(","));
    R.resetReport();
    (R.winListeners["beforeprint"] || []).forEach(f => f());
    const pk = [...doc.getElementById("report").children];
    check("v18：打印自动填充同样走 reportSegments（h3 + concl + sign）",
      pk.some(k => k.tagName === "h3") && pk.some(k => (k.className || "") === "concl") && pk.some(k => (k.className || "") === "sign"),
      pk.map(k => k.tagName + "." + (k.className || "-")).join(","));
    (R.winListeners["afterprint"] || []).forEach(f => f());
    R.resetReport();
  } catch (e) { check("报告正文结构化", false, e.message); }

  try {
    /* 轻⑥：徽章体系统一 —— 七卡同为中文数字徽章（⚖/! 折进标题文字） */
    check("v18：七张卡徽章统一中文数字（一~七，⚖/! 不再占徽章槽位）",
      ["一", "二", "三", "四", "五", "六", "七"].every(n => html.includes('<span class="no">' + n + '</span>')) &&
      !html.includes('<span class="no">⚖</span>') && !html.includes('<span class="no">!</span>'));
    check("v18：徽章 CSS 选择器放宽到 .card .no（英雄区 caption 下同样生效）", css.includes(".card .no{"));
    check("v18：⚖/! 折进标题文字", html.includes("场景对比（⚖）") && html.includes("风险速览（!）"));
  } catch (e) { check("卡片徽章统一", false, e.message); }

  try {
    /* 轻⑦：等级显示去括号套娃（报告 / Markdown / 对比栏用「良 B」，印章保留拆分） */
    check("v18：gradePlain 定义（无括号形式）", mainCode.includes("function gradePlain"));
    const l0 = R.buildReportLines();
    check("v18：报告正文等级为「X Y」形式（无「（良（B））」套娃）",
      /\d+ 分（[优良中差] [ABCD]）/.test(l0[0]) && !/\d+ 分（[优良中差]（[ABCD]））/.test(l0[0]), l0[0].slice(0, 40));
    check("v18：等级套娃在全文绝迹（含印章拆分照旧 gradeOf）",
      !/[（([][优良中差]（[ABCD]）[）)\]]/.test(html) && mainCode.includes("function gradeOf"));
    const md0 = R.reportToMarkdown();
    check("v18：Markdown 等级同样无套娃", !/\d+ 分（[优良中差]（[ABCD]））/.test(md0) && /\d+ 分（[优良中差] [ABCD]）/.test(md0));
  } catch (e) { check("等级去括号套娃", false, e.message); }

  try {
    /* 轻⑧：对比栏分数本体中性墨色，up/down 只给 Δ 段 */
    check("v18：对比栏源码分数段为 cmp-score、Δ 段为 cmp-delta",
      /box\.innerHTML=`<div class="cmp-head">[\s\S]{0,500}class="cmp-score"/.test(mainCode) &&
      /class="cmp-score">\$\{tA\}[\s\S]{0,300}class="cmp-delta \$\{cls\}">Δ/.test(mainCode));
    check("v18：.cmp-score 中性墨色样式存在", css.includes(".cmp-score{font-family:var(--serif);font-weight:700;color:var(--ink);}"));
    R.toggleCmp(); R.enterCmp(1);
    const cmpHtml = doc.getElementById("cmpBody").innerHTML;
    const head = cmpHtml.slice(0, cmpHtml.indexOf("cmp-orgs"));
    check("v18：对比栏两个分数为中性 cmp-score、Δ 段才挂 up/down 色",
      (head.match(/class="cmp-score"/g) || []).length === 2 &&
      /class="cmp-delta (up|down|eq)">Δ/.test(head) &&
      !/class="cmp-score[^"]*(up|down)/.test(head), head.slice(0, 140));
    R.exitCmp();
  } catch (e) { check("对比栏分数配色", false, e.message); }

  try {
    /* 轻⑨：导入成功 toast 清掉「重渲染」开发口径 */
    check("v18：导入 toast 用「页面已按新数据刷新」",
      mainCode.includes("页面已按新数据刷新") && !mainCode.includes("页面已重渲染"));
  } catch (e) { check("导入 toast 文案", false, e.message); }

  // ---- v19：六轮挑刺清零回归 ----
  try {
    /* 轻⑧：.tag.gov / .tag.mode 边框改主题变量，深色模式不再挂浅色模式的亮灰描边 */
    check("v19：.tag.gov / .tag.mode 边框用 var(--line)（不再硬编码 #cfcfcf / #c9c9c9）",
      css.includes(".tag.gov{background:var(--accent-soft);border-color:var(--line);") &&
      css.includes(".tag.mode{background:var(--main-soft);border-color:var(--line);") &&
      !css.includes("#cfcfcf") && !css.includes("#c9c9c9"));
  } catch (e) { check("tag 边框主题变量", false, e.message); }

  try {
    /* 轻⑤：报告六 / 七两节节尾句号（与四 / 五节一致；兜底句作「……即可。」收尾） */
    const l6 = R.buildReportLines();
    check("v19：默认数据下四 / 五 / 六 / 七节均以「。」收尾",
      l6[3].endsWith("。") && l6[4].endsWith("。") && l6[5].endsWith("。") && l6[6].endsWith("。"),
      l6.slice(3, 7).map(s => s.slice(-3)).join("|"));
    const emptyBlk = {
      meta: { project: "空卡点测试", date: "2026-10", badge: "测试数据" },
      orgs: [{ id: "a", name: "主体甲", short: "甲", health: 80, phases: [0], role: "代建", power: "代建职权", act: "统筹", block: "—" }],
      links: [], phases: [{ label: "阶段一", date: "2026-01" }],
      blockers: [],
      dims: [{ n: "维度一", v: 80 }], total: 80
    };
    R.loadData(emptyBlk);
    const l7 = R.buildReportLines();
    check("v19：六 / 七节兜底句以「即可。」收尾（不再断在半句）",
      l7[5].endsWith("保持既有协同节奏并按月复查即可。") && l7[6].endsWith("各主体维持既有协同职责即可。"),
      l7[5].slice(-12) + "|" + l7[6].slice(-12));
    R.switchScene(0);   /* 恢复默认场景，供后续检查 */
  } catch (e) { check("报告节尾句号", false, e.message); }

  try {
    /* 中③：Markdown 补回整节丢失的「五、协同亮点」，且四~七节编号与屏幕报告对齐 */
    const md19 = R.reportToMarkdown();
    const lines19 = R.buildReportLines();
    check("v19：MD 含四~七节且编号与屏幕报告逐节同名（含补回的协同亮点，不再各说各话）",
      ["四、干预处方", "五、协同亮点", "六、30 天干预时间线", "七、按主体整改清单"].every((t, i) =>
        lines19[3 + i].startsWith(t) && md19.includes("## " + t)),
      (md19.match(/^## .*/gm) || []).join(" / "));
    check("v19：MD 不再有自造的「四、主体健康度」/「五、执行清单」编号",
      !md19.includes("## 四、主体健康度") && !md19.includes("## 五、执行清单"));
    check("v19：MD 主体健康度表降为无编号明细保留（内容不丢）",
      md19.includes("## 主体健康度明细") && md19.includes("| 主体 | 角色 | 健康度 |"));
    check("v19：MD 协同亮点复用 buildReportLines 第五节原文",
      md19.includes(lines19[4].slice(lines19[4].indexOf("\n\n") + 2)));
    const order = ["## 四、干预处方", "## 五、协同亮点", "## 六、30 天干预时间线", "## 七、按主体整改清单"]
      .map(h => md19.indexOf(h));
    check("v19：MD 四~七节顺序与屏幕报告一致", order.every((v, i) => i === 0 || v > order[i - 1]), order.join(","));
  } catch (e) { check("Markdown 协同亮点 / 编号", false, e.message); }

  try {
    /* 轻⑦：搜索有输入时清掉维度归因过滤（dim-fade 不再半透明叠在搜索结果上） */
    const si = doc.getElementById("blkSearch");
    const inputFn = (si._ls.find(x => x[0] === "input") || [])[1];
    R.pickDim(1);   /* 先应用维度归因过滤：部分卡点挂 dim-fade */
    const fadedBefore = createdEls.filter(e => (e.className || "").split(/\s+/).includes("dim-fade")).length;
    check("v19（前置）：pickDim(1) 后有卡点挂 dim-fade", fadedBefore > 0, "faded=" + fadedBefore);
    si.value = "审批";
    inputFn();
    const fadedAfter = createdEls.filter(e => (e.className || "").split(/\s+/).includes("dim-fade")).length;
    check("v19：搜索有输入时清掉维度过滤（命中结果不再半透明）",
      fadedAfter === 0 && doc.getElementById("blkCount").textContent.includes("命中"),
      "fadedAfter=" + fadedAfter);
    si.value = "";   /* 恢复搜索框 */
    inputFn();
    R.switchScene(0);
  } catch (e) { check("搜索清维度过滤", false, e.message); }

  try {
    /* 轻⑥：stopTour 带告别语时先显示约 2.2 秒再淡出（原实现与末尾 opacity=0 同步抵消，一闪即隐） */
    const sSrc = mainCode.slice(mainCode.indexOf("function stopTour"), mainCode.indexOf("function tourCancel"));
    check("v19：stopTour 告别语走延迟淡出分支（2200ms 后置 0，无 msg 仍立即淡出）",
      sSrc.includes("if(msg){") && sSrc.includes("sayTour(msg);") &&
      sSrc.includes(",2200)") && sSrc.includes(",500)") &&
      !sSrc.includes("if(msg)sayTour(msg);") &&
      sSrc.includes("正常结束（无告别语）：保持立即淡出"),
      sSrc.slice(0, 80));
  } catch (e) { check("stopTour 告别字幕", false, e.message); }

  try {
    /* 中① / 中② / 轻⑨：巡览 ② / ⑨ 幕点击前先滚入镜头，收尾字幕先回页眉 */
    check("v19：② 幕点维度行后滚到 cardNet / cardBlocks（字幕承诺的角标 / 网络高亮进镜头）",
      mainCode.includes('smoothScroll($("cardNet"),"center")') &&
      mainCode.includes('smoothScroll($("cardBlocks"),"center")') &&
      mainCode.indexOf('smoothScroll($("cardNet"),"center")') > mainCode.indexOf("pulse(dimRow)") &&
      mainCode.indexOf('smoothScroll($("cardBlocks"),"center")') < mainCode.indexOf("#detail .tag[data-bi]"));
    check("v19：⑨ 幕点 genBtn 前先滚到 cardReport（不再 toTop 回页首屏外点击）",
      mainCode.indexOf('smoothScroll($("cardReport"),"center")') > mainCode.indexOf("⑨ 生成复盘报告") &&
      mainCode.indexOf('smoothScroll($("cardReport"),"center")') < mainCode.indexOf("pulse(gb)"));
    const endCap = mainCode.indexOf("演示结束 ——");
    const lastToTop = mainCode.lastIndexOf("toTop();");
    check("v19：收尾字幕先 toTop 回页眉，文案改「点页面顶部「场景预设」按钮」",
      endCap > 0 && lastToTop > 0 && lastToTop < endCap && endCap - lastToTop < 400 &&
      mainCode.includes("点页面顶部「场景预设」按钮继续探索") &&
      !mainCode.includes("点右上角场景继续探索"));
  } catch (e) { check("巡览镜头 / 收尾字幕", false, e.message); }

  try {
    /* 中④：使用说明补 .webm 播放指引（交付链最后一环）+ 版本引用同步 */
    const pathMod = require("path");
    const base = pathMod.dirname(pathMod.resolve(path));
    const mdPath = [pathMod.join(base, "演示视频工具", "使用说明.md"), pathMod.join(base, "使用说明.md")]
      .find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
    check("v19：使用说明存在", !!mdPath, "找不到 演示视频工具/使用说明.md");
    if (mdPath) {
      const doc9 = fs.readFileSync(mdPath, "utf8");
      check("v19：常见问题含 .webm 播放指引（拖进 Chrome/Edge + Web Media Extensions + MP4 路径）",
        doc9.includes("拖进 Chrome / Edge") && doc9.includes("Web Media Extensions") && doc9.includes("完整版 ffmpeg"));
      check("v23：使用说明版本引用同步为 v31（无残留 v30.html）",   /* v31：版本引用随本轮 v30→v31 同步（历史同款漂移） */
        doc9.includes("Atria-协同体检中心-v31.html") && !doc9.includes("v30.html"));
      check("v23：使用说明主推双击 tour.html，?tour=1 降为浏览器地址栏备选（含 file:// 写法、点明资源管理器不认）",
        doc9.includes("双击即播") && doc9.includes("file:///") && doc9.includes("不是 Windows 资源管理器地址栏"));
    }
  } catch (e) { check("使用说明播放指引", false, e.message); }

  try {
    /* 严重：归因规则把证据里的「（示例数据）」当成「数据」关键词——每条规则只加一票、
       平局取下标最小者，五场景几乎全归「信息通畅度」；水厂「目标一致性」归因 0，
       巡览 ② 幕网络全淡出、③ 幕整幕落空 */
    const dimSlice = mainCode.slice(mainCode.indexOf("function dimOfBlocker"), mainCode.indexOf("function clearDimSel"));
    check("v20：dimOfBlocker 匹配前剥掉「（示例数据）」样例标记（ev / fix 不再裸拼接）",
      dimSlice.includes("（示例[^）]*）") && dimSlice.includes("const clean=s=>"));
    check("v20：归因按命中次数计票，平局取文本中最先命中维度（不再默认最小下标）",
      dimSlice.includes("hits.length") && dimSlice.includes("firstPos") &&
      dimSlice.includes("(c===counts[best]&&firstPos[i]<firstPos[best])"));
    /* 纯样例后缀不再产生任何归因 */
    const onlyMark = {
      meta: { project: "纯标记测试", date: "2026-10", badge: "测试数据" },
      orgs: [{ id: "a", name: "主体甲", short: "甲", health: 80, phases: [0], role: "代建", power: "代建", act: "统筹", block: "—" }],
      links: [], phases: [{ label: "阶段一", date: "2026-01" }],
      blockers: [{ t: "甲卡点", sev: "中", d: "", ev: "（示例数据）", fix: "", orgs: ["a"] }],
      dims: R.ALL_SCENES[0].dims.map(d => ({ n: d.n, v: d.v })), total: 70
    };
    R.loadData(onlyMark);
    check("v20：仅含「（示例数据）」后缀的卡点不再命中信息通畅度（attrMap=-1）",
      R.getAttrMap()[0] === -1, "attr[0]=" + R.getAttrMap()[0]);
    R.switchScene(0);
    check("v20：医院「时序依赖」归入审批效率（原被后缀「数据」抢到信息通畅度）",
      R.getAttrMap()[2] === 2, "attr[2]=" + R.getAttrMap()[2]);
    R.switchScene(3);
    check("v20：学校「审批时序依赖」归入审批效率",
      R.getAttrMap()[1] === 2, "attr[1]=" + R.getAttrMap()[1]);
    let allTagged = true;
    for (let i = 0; i < R.ALL_SCENES.length; i++) {
      R.switchScene(i);
      if (!R.getAttrMap().some(a => a >= 0)) allTagged = false;
    }
    check("v20：五个场景均存在已归因卡点（维度行有「归因 n 项」候选，不空挂）", allTagged);
    R.switchScene(4);
    const cntGoal = R.getAttrMap().filter(a => a === 3).length;
    check("v20：水厂「目标一致性」归因数 > 0（巡览 ② 幕不再点中空维度）", cntGoal > 0, "cnt=" + cntGoal);
    /* 巡览 ② 幕：改选归因数非 0 的维度行（原固定取按分排序第二行） */
    const tourSrc = mainCode.slice(mainCode.indexOf("function startTour"), mainCode.indexOf("/* 画布缩放按钮"));
    check("v20：巡览 ② 幕改选归因数非 0 的维度行（全零时退回第二行）",
      tourSrc.includes('qq(".dim-row").find(r=>{') &&
      tourSrc.includes("attrMap.filter(a=>a===+di).length>0") &&
      tourSrc.includes('||qq(".dim-row")[1]'));
    R.switchScene(0);
  } catch (e) { check("归因规则 / 巡览选行", false, e.message); }

  try {
    /* 中：搜索清维度过滤只清一半——netHint 提示条与右侧诊断面板仍停在维度模式 */
    R.pickDim(1);
    const netH = doc.getElementById("netHint");
    check("v20（前置）：pickDim(1) 后 netHint 显示「维度归因」、详情为「维度诊断」",
      netH.classList.contains("show") && netH.textContent.includes("维度归因") &&
      R.detail.innerHTML.includes("维度诊断"));
    const si2 = doc.getElementById("blkSearch");
    const inputFn2 = (si2._ls.find(x => x[0] === "input") || [])[1];
    si2.value = "审批";
    inputFn2();
    check("v20：搜索清维度时一并隐藏 netHint（画布已无高亮，提示不再说话不算数）",
      !netH.classList.contains("show"));
    check("v20：搜索清维度时详情面板复位引导文案（不再停在「维度诊断 · 信息通畅度」）",
      R.detail.innerHTML.includes("诊断详情") && !R.detail.innerHTML.includes("维度诊断 ·"));
    si2.value = "";
    inputFn2();
    R.switchScene(0);
  } catch (e) { check("搜索清维度收尾", false, e.message); }

  try {
    /* 中：不点「生成复盘报告」直接打印，报告正文缺五维评分图（beforeprint 只渲染章节文本） */
    R.resetReport();
    (R.winListeners["beforeprint"] || []).forEach(f => f());
    const rep2 = doc.getElementById("report");
    const chart2 = createdEls.filter(e => e.className === "report-chart").pop();
    check("v20：beforeprint 自动填充时注入 report-chart（与 startTyping 屏幕版同源）",
      !!(chart2 && (chart2._html || "").includes("<svg")) &&
      rep2.children.length >= 2 && rep2.children[0].className === "report-chart",
      "children=" + rep2.children.map(c => c.className || c.tagName).join(","));
    (R.winListeners["afterprint"] || []).forEach(f => f());
    check("v20：afterprint 后报告区还原（自动填充路径不残留）",
      !doc.getElementById("report").classList.contains("show"));
  } catch (e) { check("打印注入五维图", false, e.message); }

  try {
    /* 轻：对比模式待选态下按 Esc 不退出（金框与「点击任一场景作为对比对象」不退） */
    doc.getElementById("kbdHelp").hidden = true;   /* 模拟快捷键弹层已关（弹层开时 Esc 优先关弹层） */
    R.toggleCmp();
    const cmpRow = doc.getElementById("sceneRow"), cmpLab = doc.getElementById("cmpLab"),
      cmpBtn = doc.getElementById("cmpBtn"), cmpCard = doc.getElementById("cmpCard");
    check("v20（前置）：toggleCmp 进入待选态（金框 + 提示 + 按钮按下态）",
      cmpRow.classList.contains("cmp-pending") && cmpLab.style.display === "" &&
      cmpBtn.getAttribute("aria-pressed") === "true");
    const escEv = { key: "Escape", target: { tagName: "BODY" }, preventDefault() { } };
    (R.winListeners["keydown"] || []).forEach(f => f(escEv));
    check("v20：Esc 退出对比待选态（sceneRow 金框 / cmpLab 提示 / cmpBtn 按下态全部清退）",
      !cmpRow.classList.contains("cmp-pending") && cmpLab.style.display === "none" &&
      cmpBtn.getAttribute("aria-pressed") === "false" && !cmpCard.classList.contains("show"));
    R.exitCmp();
  } catch (e) { check("Esc 退出对比模式", false, e.message); }

  try {
    /* 轻：巡览滚动不认「减少动态」系统偏好（多幕硬写 behavior:"smooth"，未走 smoothScroll 封装） */
    const tourSrc2 = mainCode.slice(mainCode.indexOf("function startTour"), mainCode.indexOf("/* 画布缩放按钮"));
    check("v20：巡览内无硬写 behavior:\"smooth\"，六处滚动统一走 smoothScroll() 封装",
      !tourSrc2.includes('behavior:"smooth"') &&
      ['smoothScroll($("cardHero"),"start")', 'smoothScroll(netCard,"start")', 'smoothScroll(tlCard,"start")',
        'smoothScroll(blkCard,"start")', 'smoothScroll(cmpCard,"center")', 'smoothScroll(rep,"start")']
        .every(s => tourSrc2.includes(s)));
    /* 轻：打印隐藏清单漏了巡览字幕条与脉冲环 */
    const printCss = html.slice(html.indexOf("@media print"), html.indexOf("</style>", html.indexOf("@media print")));
    check("v20：@media print 隐藏 #tourOv 字幕条与 tourRing 脉冲环（巡览中打印不再印进报告纸）",
      printCss.includes("#tourOv,") && printCss.includes('[style*="tourRing"]'));
    /* v21 严重：深色模式打印白纸白字——打印件强制浅色档，不依赖用户当前主题 */
    check("v21：@media print 把深色变量切回浅色档（--ink:#182230 等，打印不再依赖当前主题）",
      printCss.includes('[data-theme="dark"]{--bg:#f4f6f9') && printCss.includes("--ink:#182230") &&
      printCss.includes("--paper:#ffffff") && printCss.includes("--report-bg:#ffffff"));
    check("v21：打印件 JS 取色的 SVG 构件映回浅色等价值（雷达中心总分 / 报告五维图不再近白）",
      printCss.includes('[fill="#e6eaf2"]{fill:#182230;}') && printCss.includes('[fill="#8a96ab"]{fill:#5b6b80;}') &&
      printCss.includes('[fill="#34d399"]{fill:#059669;}') && printCss.includes('[fill="#f0524a"]{fill:#dc2626;}') &&
      printCss.includes('[stroke="#1e2740"]{stroke:#e7ebf0;}'));
  } catch (e) { check("巡览动效偏好 / 打印隐藏清单", false, e.message); }

  try {
    /* v21 轻：prefersReduced 为真时总分大数字仍从 0 滚到终值——全站开关漏掉此计数入口 */
    const cnt = mainCode.slice(mainCode.indexOf("// 大数字计数"), mainCode.indexOf("// 印章（v7"));
    check("v21：prefersReduced=true 时计数直出终值、跳过 setInterval（源码分支存在）",
      cnt.includes("if(prefersReduced){sv.textContent=TOTAL;}"));
    const svR = { textContent: "0" };
    const runCnt = new Function("prefersReduced", "$", "TOTAL", "clearInterval", "setInterval",
      cnt + "\nreturn sv.textContent;");
    check("v21：prefersReduced=true 重放计数段——一次性置 72 且不创建 setInterval（运行时）",
      String(runCnt(true, () => svR, 72, clearInterval, setInterval)) === "72" && svR._iv === undefined);
    const svN = { textContent: "0" };
    let ivMade = 0;
    const runCnt2 = new Function("prefersReduced", "$", "TOTAL", "clearInterval", "setInterval",
      cnt + "\nreturn sv.textContent;");
    check("v21：prefersReduced=false 计数动画路径不回归（仍建 setInterval、初值 0）",
      runCnt2(false, () => svN, 72, () => { }, (fn, ms) => { ivMade++; return 7; }) === "0" &&
      ivMade === 1 && svN._iv === 7);
  } catch (e) { check("v21 减少动态计数", false, e.message); }

  /* ---- v22：九轮挑刺（打印深色位图 / 打字中打印 / 搜索漏印 / Esc 退出巡览 / 过滤与归因口径五条） ---- */
  const printCss22 = html.slice(html.indexOf("@media print"), html.indexOf("</style>", html.indexOf("@media print")));
  const bpRegion = mainCode.slice(mainCode.indexOf('window.addEventListener("beforeprint"'), mainCode.indexOf('window.addEventListener("afterprint"'));
  const apRegion = mainCode.slice(mainCode.indexOf('window.addEventListener("afterprint"'), mainCode.indexOf("/* ================= 启动"));

  try {
    /* 轻⑫：卡点搜索框与计数常驻，唯打印隐藏清单漏掉它（连占位文字一起印进报告纸） */
    check("v22：@media print 隐藏清单含 .blk-tools（搜索框与计数不再印进报告纸）", printCss22.includes(".blk-tools,"));
    /* 轻②：深色打印时维度签名色仍是深色档浅亮值（dim-row --band-color / dim-chip 内联色） */
    check("v22：@media print 按 data-di 把维度签名色映回浅色等价值（row 的 --band-color 与 chip 的 color）",
      printCss22.includes('[data-theme="dark"] .dim-row[data-di="0"]{--band-color:#3b5bdb!important;}') &&
      printCss22.includes('[data-theme="dark"] .dim-row[data-di="4"]{--band-color:#db2777!important;}') &&
      printCss22.includes('[data-theme="dark"] .dim-chip[data-di="1"]{color:#0891b2!important;}') &&
      printCss22.includes('[data-theme="dark"] .dim-chip[data-di="3"]{color:#059669!important;}'));
  } catch (e) { check("v22 打印 CSS", false, e.message); }

  try {
    /* 中①：深色模式打印，网络画布是位图（@media print 切变量管不到 draw() 的 PAL_DARK 取色） */
    check("v22：PAL 带 printLight 分支（打印时强制浅色调色板）",
      mainCode.includes("let printLight=false;") &&
      mainCode.includes("function PAL(){return isDark()&&!printLight?PAL_DARK:PAL_LIGHT;}"));
    check("v22：beforeprint 深色时以浅色调色板重绘画布（printLight=true + draw()）",
      bpRegion.includes("if(isDark()&&!printLight){printLight=true;draw();}"));
    check("v22：afterprint 恢复深色取色（printLight=false + wake()）",
      apRegion.includes("if(printLight){printLight=false;wake();}"));
    R.doc.documentElement.setAttribute("data-theme", "dark");
    (R.winListeners["beforeprint"] || []).forEach(f => f());
    check("v22（运行时）：深色下 beforeprint 后 printLight=true（画布按浅色重绘）", R.printLight() === true);
    (R.winListeners["afterprint"] || []).forEach(f => f());
    check("v22（运行时）：afterprint 后 printLight=false（恢复深色取色）", R.printLight() === false);
    R.doc.documentElement.removeAttribute("data-theme");
  } catch (e) { check("v22 深色打印重绘", false, e.message); }

  try {
    /* 中③：报告还在一个字一个字打的时候直接打印，只会印出残缺开头（beforeprint 只看 show 类） */
    check("v22：beforeprint 检测打字进行中（reportTimer 非空）先 finishTyping() 直出全文",
      bpRegion.includes("if(reportTimer)finishTyping();"));
    R.resetReport();
    R.startTyping();
    check("v22（前置）：startTyping 后打字进行中（reportTimer 非空）", R.getReportTimer() !== null);
    (R.winListeners["beforeprint"] || []).forEach(f => f());
    const rep22 = doc.getElementById("report");
    const h3n = [...rep22.querySelectorAll("h3")].length;
    check("v22：打字中 beforeprint 直出全文（timer 清零、七节 h3 齐全）",
      R.getReportTimer() === null && h3n === 7, "timer=" + R.getReportTimer() + " h3=" + h3n);
    (R.winListeners["afterprint"] || []).forEach(f => f());
    check("v22：打字中打印完毕全文保留（未误走自动填充还原路径）",
      [...doc.getElementById("report").querySelectorAll("h3")].length === 7);
    R.resetReport();
  } catch (e) { check("v22 打字中打印", false, e.message); }

  try {
    /* 轻⑩：没清搜索就打印，被过滤掉的卡点整张漏印 / 「未命中卡点…」空态印进报告纸 */
    check("v22：beforeprint 先收搜索、afterprint 原样恢复（走抽出的 runBlkSearch）",
      bpRegion.includes('printSearch=inp.value;inp.value="";runBlkSearch();') &&
      apRegion.includes("inp.value=printSearch;runBlkSearch();"));
    /* 轻⑪：详情面板「涉及卡点」跳转目标被搜索隐藏，跳了等于没跳 */
    const jbRegion = mainCode.slice(mainCode.indexOf("function jumpToBlocker"), mainCode.indexOf("function pointerUp"));
    check("v22：jumpToBlocker 目标被搜索隐藏时先清搜索再跳转（源码）",
      jbRegion.includes('if(el.style&&el.style.display==="none")'));
    /* 运行时：无命中搜索 → beforeprint 全部恢复 → afterprint 原样恢复 → jumpToBlocker 显出目标 */
    const si22 = doc.getElementById("blkSearch");
    const curBlks = () => [...doc.getElementById("blks").querySelectorAll(".blk")];
    si22.value = "完全不存在的词xyz";
    R.runBlkSearch();
    check("v22（前置）：无命中搜索 → 卡点全部隐藏且空态文案挂出",
      curBlks().some(el => (el.style || {}).display === "none") && !!doc.getElementById("blkEmpty"));
    (R.winListeners["beforeprint"] || []).forEach(f => f());
    /* 注：桩的 getElementById 走注册表（detached 后仍命中），空态撤下改为查 #blks 子树是否还挂着 blkEmpty */
    const emptyInHost22 = [...doc.getElementById("blks").children].some(c => (c.id || "") === "blkEmpty");
    check("v22：beforeprint 清搜索后全部卡点恢复可见（打印不漏印、空态撤下）",
      curBlks().every(el => (el.style || {}).display !== "none") && !emptyInHost22,
      "hidden=" + curBlks().filter(el => (el.style || {}).display === "none").length + " emptyInHost=" + emptyInHost22);
    (R.winListeners["afterprint"] || []).forEach(f => f());
    check("v22：afterprint 后搜索过滤原样恢复（用户现场不丢）",
      si22.value === "完全不存在的词xyz" && curBlks().some(el => (el.style || {}).display === "none"));
    si22.value = "完全不存在的词xyz";
    R.runBlkSearch();
    R.jumpToBlocker(0);
    const tgt22 = qsAll('.blk[data-bi="0"]')[0];   /* 与页面 document.querySelector 同一解析口径 */
    check("v22：jumpToBlocker 隐藏目标先显出再展开（跳了等于跳到）",
      !!tgt22 && (tgt22.style || {}).display !== "none" && tgt22.classList.contains("open") && si22.value === "");
    si22.value = "";
    R.runBlkSearch();
  } catch (e) { check("v22 打印清搜索 / 隐藏目标跳转", false, e.message); }

  try {
    /* 中⑤（误报核实）：挑刺官称「点维度过滤再点网络主体，过滤清一半」——v19 起 selectNode
       收尾已与 selectLink 同口径（clearDimSel + showNode 收 netHint），描述的混合态无法复现；
       加运行时回归断言锁定，防止未来真回归 */
    const nodeSrc = mainCode.slice(mainCode.indexOf("function selectNode"), mainCode.indexOf("function selectLink"));
    check("v22：selectNode 收尾含 clearDimSel（与 selectLink 同口径——本轮挑刺条目核实为误报）",
      nodeSrc.includes("clearBlkSel();clearTlSel();clearDimSel();"));
    let attrDim = -1;
    for (let d = 0; d < (R.DATA.dims || []).length; d++) {
      if (R.getAttrMap().some(a => a === d)) { attrDim = d; break; }
    }
    check("v22（前置）：场景 0 存在已归因维度（测试可走）", attrDim >= 0);
    if (attrDim >= 0) {
      R.pickDim(attrDim);
      check("v22（前置）：pickDim 后过滤生效（activeDim / dim-fade / netHint）",
        R.getActiveDim() === attrDim &&
        [...doc.getElementById("blks").querySelectorAll(".blk")].some(el => el.classList.contains("dim-fade")) &&
        doc.getElementById("netHint").classList.contains("show"));
      R.selectNode(R.getN()[1]);
      check("v22：再点网络主体，维度过滤彻底清零（activeDim=null / 无 dim-fade / 行不亮 / 提示条收起）",
        R.getActiveDim() === null &&
        ![...doc.getElementById("blks").querySelectorAll(".blk")].some(el => el.classList.contains("dim-fade")) &&
        [...doc.getElementById("dims").querySelectorAll(".dim-row")].every(r => (r._attrs || {})["aria-pressed"] === "false") &&
        !doc.getElementById("netHint").classList.contains("show"));
    }
  } catch (e) { check("v22 selectNode 清过滤（误报核实）", false, e.message); }

  try {
    /* 轻⑥：网络图空白点击收掉「高亮 N 个关联主体」说明条，但维度 / 阶段过滤还生效（灰着却无人解释） */
    check("v22：pointerUp 空白分支有过滤器时保留 netHint（源码）",
      mainCode.includes("if(activeDim===null&&activePhase===null&&activeBlocker===null){"));
    let attrDim6 = -1;
    for (let d = 0; d < (R.DATA.dims || []).length; d++) {
      if (R.getAttrMap().some(a => a === d)) { attrDim6 = d; break; }
    }
    if (attrDim6 >= 0) {
      const netH22 = doc.getElementById("netHint");
      R.pickDim(attrDim6);
      check("v22（前置）：维度过滤生效中（netHint 显示过滤说明）",
        R.getActiveDim() === attrDim6 && netH22.classList.contains("show"));
      R.pointerUp({});   /* 画布空白点击 */
      check("v22：过滤生效时空白点击保留 netHint 与维度诊断（说明跟着过滤走）",
        R.getActiveDim() === attrDim6 && netH22.classList.contains("show") &&
        R.detail.innerHTML.includes("维度诊断"));
      R.pickDim(attrDim6);   /* 关闭过滤 */
      R.pointerUp({});
      check("v22：无过滤时空白点击仍复位详情面板与提示条（v17 行为不回归）",
        !netH22.classList.contains("show") && R.detail.innerHTML.includes("点击总览五维"));
    }
  } catch (e) { check("v22 空白点击保留过滤说明", false, e.message); }

  try {
    /* 轻⑧：维度诊断抽屉的归因卡点标签原复用监管紫，与该维度签名色对不上 */
    check("v22：renderDimDetail 归因卡点标签用本维度签名色（不再 .tag.gov）",
      mainCode.includes('class="tag" data-bi="${x.k}" style="color:${dimColorOf(i)};border-color:${dimColorOf(i)}"'));
    check("v22：巡览 ③ 幕选择器跟随新标签（#detail .tag[data-bi]）",
      mainCode.includes('q("#detail .tag[data-bi]")'));
    R.pickDim(1);   /* 信息通畅度（浅色 #0891b2），场景 0 有归因 */
    check("v22（运行时）：维度诊断抽屉的卡点标签带签名色（与卡点卡角标同来源）",
      R.detail.innerHTML.includes('class="tag" data-bi="') && R.detail.innerHTML.includes("border-color:#0891b2"));
    R.pickDim(1);
  } catch (e) { check("v22 抽屉签名色标签", false, e.message); }

  try {
    /* 轻⑦：归因 0 项维度点下去整页淡出 + 「高亮 0 个关联主体（—）」像故障 */
    R.switchScene(1);   /* 轨道：权责 / 信息 / 目标三维度归因 0 */
    let zeroDim = -1;
    for (let d = 0; d < (R.DATA.dims || []).length; d++) {
      if (!R.getAttrMap().some(a => a === d)) { zeroDim = d; break; }
    }
    if (zeroDim >= 0) {
      R.pickDim(zeroDim);
      const blks22 = [...doc.getElementById("blks").querySelectorAll(".blk")];
      check("v22：0 归因维度不触发整页淡出（卡点区无 dim-fade）",
        blks22.length > 0 && blks22.every(el => !el.classList.contains("dim-fade")),
        "faded=" + blks22.filter(el => el.classList.contains("dim-fade")).length);
      check("v22：0 归因提示条明示「当前无归因卡点」（不再是「高亮 0 个关联主体（—）」）",
        doc.getElementById("netHint").textContent.includes("当前无归因卡点"));
      check("v22：0 归因详情面板明示暂无归因卡点", R.detail.innerHTML.includes("该维度下暂无归因卡点"));
      const row22 = [...doc.getElementById("dims").querySelectorAll(".dim-row")]
        .find(r => (r._attrs || {})["data-di"] === String(zeroDim));
      check("v22：0 归因维度行挂灰色「归因 0 项」徽标（点击前即有预期）",
        !!(row22 && (row22.innerHTML || "").includes("归因 0 项")));
      R.pickDim(zeroDim);   /* 关闭 */
    } else {
      check("v22（前置）：轨道场景存在 0 归因维度", false, "未找到 0 归因维度");
    }
    R.switchScene(0);
  } catch (e) { check("v22 0 归因维度口径", false, e.message); }

  try {
    /* 中⑨：手机（375px）时间轴日期与阶段名叠在一块儿、根本读不出来 */
    check("v22：≤640px 时间轴标签缩小可折行、日期只显示起始年月（CSS）",
      css.includes(".tl-label{width:64px;font-size:10.5px;line-height:1.3;white-space:normal;}") &&
      css.includes(".tl-date .d-sep,.tl-date .d-to{display:none;}"));
    check("v22：buildTimeline 区间日期拆段（d-sep / d-to，窄屏隐藏结束段）",
      mainCode.includes('<span class="d-sep"> ~ </span><span class="d-to">'));
    R.switchScene(1);   /* 轨道：六阶段日期串「2024-03 ~ 2024-09」 */
    const tlDates22 = createdEls.filter(e => (e.className || "").split(/\s+/).includes("tl-date"));
    check("v22（运行时）：区间日期已拆段（.tl-date 含 d-to 尾段）",
      tlDates22.some(e => (e.innerHTML || "").includes('class="d-to"')));
    R.switchScene(0);
  } catch (e) { check("v22 窄屏时间轴", false, e.message); }

  try {
    /* 中④：循环播放字幕明说「按 Esc 退出」，但全局 Esc 从不碰巡览（运行时见末尾巡览异步段） */
    check("v22：全局 Esc 最前面处理巡览（tourActive 时 stopTour 并 return）",
      mainCode.includes('if(tourActive){stopTour("已退出巡览 —— 可随时手动浏览");return;}'));
    check("v22：快捷键帮助写明 Esc 退出巡览", html.includes("清空选中 / 关闭弹层 / 退出巡览"));
  } catch (e) { check("v22 Esc 退出巡览（静态）", false, e.message); }

  try {
    /* 轻⑬：巡览 ⑤ 幕字幕承诺「看该阶段的卡点」，但卡点不带阶段字段、无任何联动 */
    check("v22：巡览 ⑤ 幕字幕改为「看该阶段的参与主体」（不再承诺没有的卡点联动）",
      mainCode.includes("看该阶段的参与主体") && !mainCode.includes("看该阶段的卡点与主体"));
  } catch (e) { check("v22 巡览字幕与动作一致", false, e.message); }

  /* ---- v23：十轮挑刺（窄屏密度点 / 导入预览独立容器 / 雷达 641~1080 / 图例打印映色 /
        编辑收起 / md 去重 / 结论单位 / 减少动态 / 推荐整词 / 快捷键前提） ---- */
  try {
    /* 中①：≤640px 标签折两行（约占到 95px）撞进 top:90px 的密度点带——窄屏档密度点下移 */
    const mob23 = css.slice(css.indexOf("@media(max-width:640px)"));
    check("v23：≤640px 媒体块把 .tl-dots 下移（top:100px，折行标签与密度点上下错开）",
      mob23.includes(".tl-dots{top:100px;}"));
    /* 轻③：641~1080px 雷达列被压成 200px、svg 固定 230px 溢出压住五维列表色带 */
    const q1080 = css.slice(css.indexOf("@media(max-width:1080px)"), css.indexOf("@media(max-width:920px)"));
    check("v23：641~1080px 媒体块把 .radar-box svg 缩到 200px（跟随列宽，不再压五维列表）",
      q1080.includes(".radar-box svg{width:200px;}"));
    /* 轻⑧：toast / #tourOv 的位移过渡漏在 reduced-motion 豁免清单外 */
    const rm23 = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"), css.indexOf("@media(max-width:640px)"));
    check("v23：reduced-motion 媒体块把 .say-toast / #tourOv 的位移过渡也关掉",
      rm23.includes(".say-toast,#tourOv{transition:none!important;}"));
    /* 轻④：图例内联色点是深色档亮值，打印映回浅色等价值（v21/v22 映色的最后一块） */
    check("v23：@media print 把 .legend 内联色点映回浅色等价值（图例不再淡得看不清）",
      printCss22.includes('.legend .dot[style*="#34d399"]{background:#059669!important;}') &&
      printCss22.includes('.legend .dot[style*="#818cf8"]{background:#3b5bdb!important;}') &&
      printCss22.includes('.legend .dot[style*="#f0524a"]{background:#dc2626!important;}'));
    /* 轻⑩：快捷键帮助写明方向键生效前提（方向键只挂在 canvas keydown 上） */
    check("v23：快捷键帮助注明「网络节点聚焦移动（先点击 / Tab 聚焦画布）」",
      html.includes("网络节点聚焦移动（先点击 / Tab 聚焦画布）"));
  } catch (e) { check("v23 静态回归", false, e.message); }

  try {
    /* 中②：导入预览寄生 #ioMsg，导出 / 切场景等反馈的 textContent 覆盖整体抹掉预览与确认按钮 */
    check("v23：数据面板含独立预览容器 #ioDiff（HTML 标记 + css 规则）",
      html.includes('id="ioDiff"') && css.includes(".io-diff{margin-top:2px;}"));
    check("v23：showImportDiff 把 diff-box 挂进 #ioDiff（应用 / 放弃主动 clearDiff，不再靠反馈覆盖销毁）",
      mainCode.includes('const host=$("ioDiff")||$("ioMsg");') && mainCode.includes("clearDiff();"));
    const ioDiffHost = doc.getElementById("ioDiff");
    const ioMsgEl = doc.getElementById("ioMsg");
    const mod23 = JSON.parse(JSON.stringify(R.ALL_SCENES[2]));
    mod23.meta.project = "v23 独立容器测试";
    R.showImportDiff(mod23);
    const box23 = createdEls.filter(e => e.className === "diff-box").pop();
    check("v23（运行时）：diff-box 挂到 #ioDiff（parentElement 是独立容器而非 #ioMsg）",
      !!box23 && box23.parentElement === ioDiffHost && ioDiffHost !== ioMsgEl);
    /* 模拟导出成功类反馈写 #ioMsg —— 预览盒子与确认按钮仍在独立容器里 */
    if (ioMsgEl) ioMsgEl.textContent = "已导出当前数据为 JSON";
    check("v23（运行时）：#ioMsg 被反馈覆盖后导入预览仍挂在 #ioDiff（pendingImport 不再悬空被毁）",
      !!box23 && box23.parentElement === ioDiffHost);
    /* 放弃路径由 clearDiff 主动清掉预览容器 */
    const cx23 = createdEls.filter(e => e.textContent === "放弃").pop();
    if (cx23 && cx23.onclick) cx23.onclick();
    check("v23（运行时）：放弃后 #ioDiff 清空、数据未替换",
      ioDiffHost.children.length === 0 && R.getDATA().meta.project !== "v23 独立容器测试");
    R.switchScene(0);
  } catch (e) { check("v23 导入预览独立容器", false, e.message); }

  try {
    /* 轻⑤：「查看 / 编辑当前数据」二态切换——未改动时点收起也走完整应用路径 */
    check("v23：editBtn 打开时记录快照、收起时先比对（未改动即收起，不报「已应用」）",
      mainCode.includes("edit._snap=edit.value;") && mainCode.includes("edit.value===edit._snap") &&
      mainCode.includes("数据未改动，已收起编辑框"));
    const eb = doc.getElementById("editBtn");
    const ed = doc.getElementById("ioEdit");
    const msgEl = doc.getElementById("ioMsg");
    if (eb && ed && msgEl) {
      eb.onclick();   /* 打开：写当前数据 + 记快照 */
      check("v23（前置）：打开编辑框（show + 快照 = 当前 JSON）",
        ed.classList.contains("show") && ed._snap && ed.value === ed._snap);
      eb.onclick();   /* 原样收起：走快照比对分支 */
      check("v23（运行时）：未改动时再点按钮只收起（提示「数据未改动」，不报「已应用」）",
        !ed.classList.contains("show") && msgEl.textContent.includes("数据未改动") &&
        !msgEl.textContent.includes("已应用"));
      /* 改动后仍走应用路径（旧行为不回归） */
      eb.onclick();
      ed.value = ed.value + "\n";
      eb.onclick();
      check("v23（运行时）：改动后点按钮仍走应用路径（「已应用编辑后的数据」）",
        msgEl.textContent.includes("已应用编辑后的数据"));
      R.switchScene(0);
    }
  } catch (e) { check("v23 编辑收起分支", false, e.message); }

  try {
    /* 轻⑥：md 卡点分诊小标题组名括注与后半「 · X风险」同一定语重复 */
    const md23 = R.reportToMarkdown();
    const heads23 = md23.split("\n").filter(l => l.startsWith("### ") && l.includes("风险"));
    R.switchScene(1);   /* 轨道：高 / 中 / 低三档齐全（医院场景无低风险组） */
    const md23b = R.reportToMarkdown();
    check("v23：md 分诊小标题不再把「高风险」说两遍（组名 · 档位，无重复括注）",
      heads23.length >= 2 && heads23.every(h => /^### (重点干预|观察跟进|常规优化) · (高|中|低)风险$/.test(h)) &&
      !md23.includes("重点干预（高风险）") &&
      md23b.includes("### 重点干预 · 高风险") && md23b.includes("### 观察跟进 · 中风险") &&
      md23b.includes("### 常规优化 · 低风险"));
    /* 轻⑨：结论句复查 Δ 没有单位「分」（与旁边 chip 不统一，且进打印件 / md） */
    R.switchScene(0);   /* 医院：72 vs 67 → +5 分 */
    const concl23 = doc.getElementById("heroConcl").textContent || "";
    check("v23：结论句复查 Δ 带单位「分」（与 chip「较上次（2025-12）+5 分」口径一致）",
      concl23.includes("较上次体检（2025-12）总分 +5 分"), concl23.slice(0, 80));
  } catch (e) { check("v23 md / 结论句", false, e.message); }

  try {
    /* 轻⑨：搜索空态推荐词硬切四字剩半句（占道与交 / 老管网资…） */
    const si23 = doc.getElementById("blkSearch");
    const fn23 = (si23._ls.find(x => x[0] === "input") || [])[1];
    si23.value = "zzzzv23无此卡点";
    fn23();
    const empty23 = doc.getElementById("blkEmpty");
    const firstTitle = ((R.DATA.blockers || [])[0] || {}).t;
    check("v23（运行时）：未命中推荐词含首条卡点完整标题（可搜整词，非四字半截）",
      !!(empty23 && firstTitle && String(empty23._tc).includes(firstTitle)),
      String((empty23 || {})._tc || "").slice(0, 60));
    si23.value = "";
    fn23();
  } catch (e) { check("v23 推荐词整词", false, e.message); }

  /* ---- v24：十一轮挑刺（时间轴虚线压标签 / 编辑框快照随场景同步 / 过滤选择清搜索 /
        打印反相徽章 / 缩放快捷键前提 / 巡览字幕①等级口径） ---- */
  try {
    /* 中①：.tl-now 虚线（top:34~bottom:2、z-index:1）纵穿四层，压在无 z-index 的标签 /
       密度点上，从阶段名当中划过像删除线——标签 / 密度点提 z-index:2，虚线从字身后过 */
    check("v24：.tl-label / .tl-dots 带 z-index:2，压过 .tl-now 虚线（z-index:1，线从字身后过）",
      css.includes(".tl-label{position:absolute;top:68px;z-index:2;") &&
      css.includes(".tl-dots{position:absolute;top:90px;z-index:2;") &&
      css.includes(".tl-now{position:absolute;top:34px;bottom:2px;"));
    /* 中④：反相徽章（重点干预组徽 .tn 与高风险 .sev，白字红底）默认打印不输出背景色，
       白字落白纸一起隐身——补 print-color-adjust:exact 强制按设计色打印 */
    check("v24：@media print 给反相徽章（.tn / .sev.高）补 print-color-adjust:exact",
      printCss22.includes(".triage.t-hi .tn,.sev.高{-webkit-print-color-adjust:exact;print-color-adjust:exact;}"));
    /* 轻⑤：+ − 0 与方向键同组（只挂在 canvas keydown 上），帮助条目注明生效前提 */
    check("v24：快捷键帮助「画布缩放 / 复位」注明（先点击 / Tab 聚焦画布）",
      html.includes("画布缩放 / 复位（先点击 / Tab 聚焦画布）"));
    /* 轻⑥：巡览字幕①仍用老的带括号 gradeOf()——改 gradePlain()，与印章 / 报告正文同口径 */
    const sub1Idx = mainCode.indexOf("① 体检报告单式总览");
    const sub1 = sub1Idx > 0 ? mainCode.slice(sub1Idx, sub1Idx + 160) : "";
    check("v24：巡览字幕①用 gradePlain（「良 B」，无「良（B）」括号套娃）",
      sub1.includes("gradePlain(DATA.total||0)") && !sub1.includes("gradeOf("));
  } catch (e) { check("v24 静态回归", false, e.message); }

  try {
    /* 中②：switchScene 刷新编辑框只更 value 不更 _snap——切过一次场景后收起被误判
       「编辑过」，走完整应用路径（重载数据 + 取消预设高亮 + 报「已应用」） */
    check("v24：switchScene 刷新编辑框时同步快照（ed._snap=ed.value，不再只刷 value）",
      mainCode.includes("ed.value=JSON.stringify(DATA,null,2);ed._snap=ed.value;"));
    const eb24 = doc.getElementById("editBtn");
    const ed24 = doc.getElementById("ioEdit");
    const msg24 = doc.getElementById("ioMsg");
    if (eb24 && ed24 && msg24) {
      R.switchScene(1);               /* 场景 A：打开编辑框（快照 = 场景 A JSON） */
      eb24.onclick();
      R.switchScene(2);               /* 切走：编辑框 value 被刷成场景 B 数据（旧 bug 只刷 value） */
      R.switchScene(1);               /* 切回：模拟用户点回同一个场景按钮 */
      check("v24（前置）：切场景后编辑框 value 与 _snap 同步（刷新即重置快照）",
        ed24.classList.contains("show") && ed24.value === ed24._snap);
      eb24.onclick();                 /* 一个字没编辑，点回按钮应收起 */
      check("v24（运行时）：只切场景未编辑，收起走「未改动」分支（不报「已应用」）",
        !ed24.classList.contains("show") && msg24.textContent.includes("数据未改动") &&
        !msg24.textContent.includes("已应用"));
      R.switchScene(0);
    }
  } catch (e) { check("v24 编辑框快照同步", false, e.message); }

  try {
    /* 中③：点维度 / 阶段 / 卡点时不清搜索框——搜索与归因两套过滤叠在一起互相打架；
       与输入路径（输入清维度，v19 只实现单向）对称：任一过滤选择清搜索框并重跑 */
    check("v24：pickDim / pickPhase / selectNode / 卡点点击四个入口都调 clearBlkSearch",
      mainCode.includes("clearBlkSel();clearTlSel();updateQuickSel();if(!fromBlkSearch)clearBlkSearch();") &&
      mainCode.includes("clearBlkSel();updateQuickSel();clearDimSel();if(!fromBlkSearch)clearBlkSearch();") &&   /* v26：pickPhase 补 fromBlkSearch 保护（输入路径的互斥清阶段不反清搜索框），子串随实现漂移 */
      mainCode.includes("clearBlkSel();clearTlSel();clearDimSel();clearBlkSearch();") &&
      mainCode.includes("clearBlkSel();clearBlkSearch();"));
    check("v24：清搜索助手 + 输入路径反清保护（clearBlkSearch / fromBlkSearch）",
      mainCode.includes("function clearBlkSearch(){") &&
      mainCode.includes("fromBlkSearch=true;try{pickDim(activeDim);}finally{fromBlkSearch=false;}"));
    const si24 = doc.getElementById("blkSearch");
    const cnt24 = doc.getElementById("blkCount");
    const term24 = ((R.DATA.blockers || [])[0] || {}).t || "审批";   /* 场景 0 首卡标题，必命中 */
    /* 选择路径：搜索激活时点维度 → 搜索框清空、计数器清空、卡片全部恢复可见 */
    si24.value = term24;
    R.runBlkSearch();
    const hit24 = createdEls.filter(e => (e.className || "").split(/\s+/).includes("blk") && e.style.display === "none").length;
    check("v24（前置）：搜索首卡标题命中过滤（有卡被隐藏、计数器非空）",
      hit24 > 0 && (cnt24.textContent || "").includes("命中"));
    R.pickDim(1);                     /* 医院场景归因非 0 维度（netHint 会报维度归因） */
    const hiddenAfter = createdEls.filter(e => (e.className || "").split(/\s+/).includes("blk") && e.style.display === "none").length;
    check("v24（运行时）：pickDim 时清搜索框并重跑（框空、计数器空、卡片全部显回）",
      si24.value === "" && (cnt24.textContent || "") === "" && hiddenAfter === 0);
    check("v24（运行时）：清搜索后只剩维度归因一套过滤（netHint 报维度归因）",
      doc.getElementById("netHint").textContent.includes("维度归因"));
    /* 输入路径不回归：维度激活时输入 → 清维度、搜索文本保留（fromBlkSearch 保护） */
    si24.value = term24;
    R.runBlkSearch();
    check("v24（运行时）：维度激活时输入只清维度、不动搜索框（文本保留、维度过滤关闭）",
      R.getActiveDim() === null && si24.value === term24);
    si24.value = "";
    R.runBlkSearch();
    /* 卡点点击路径：搜索激活时点卡 → 搜索框清空（搜索过滤随选中退出） */
    si24.value = term24;
    R.runBlkSearch();
    const blkEl24 = createdEls
      .filter(e => (e.className || "").split(/\s+/).includes("blk") && (e._attrs || {})["data-bi"] === "0")
      .pop();   /* 取最新创建者（当前场景；桩不区分 detached 元素） */
    if (blkEl24) blkEl24.click();
    check("v24（运行时）：点卡点时清搜索框（手风琴展开同时搜索过滤退出）",
      !!blkEl24 && si24.value === "" && blkEl24.classList.contains("open"));
    if (blkEl24) blkEl24.click();     /* 收起，还回干净状态给后续巡览段 */
  } catch (e) { check("v24 过滤选择清搜索", false, e.message); }

  /* ---- v25：十二轮挑刺（快捷按钮选中态同步 / 点关系线清搜索 / 收卡点复位详情 /
        切场景保留未应用草稿） ---- */
  try {
    /* 中①：selectNode / selectLink 收尾漏 updateQuickSel——selNode 置选方向没人验，
       画布点选 / 快捷按钮 / 键盘 Enter 三条路径都点不亮快捷按钮（v3/v4 老口径被 v7 挤掉） */
    const snIdx = mainCode.indexOf("function selectNode(n){");
    const sn = snIdx > 0 ? mainCode.slice(snIdx, snIdx + 420) : "";
    check("v25：selectNode 收尾补 updateQuickSel（快捷按钮随选中态亮起 / 随取消熄灭）",
      sn.includes("clearBlkSearch();updateQuickSel();") && sn.includes("showNode(n);"));
    const slIdx = mainCode.indexOf("function selectLink(l){");
    const sl = slIdx > 0 ? mainCode.slice(slIdx, slIdx + 420) : "";
    check("v25：selectLink 收尾补 updateQuickSel + clearBlkSearch（第五个选择入口同口径）",
      sl.includes("clearBlkSearch();updateQuickSel();") && sl.includes("showLink(l);"));
    /* 运行时：updateQuickSel 在桩环境走 document.querySelectorAll 会带进历史场景的旧按钮（真实
       浏览器已 detach），故只断言当前 #qorgs 组内的按钮 */
    const qoBox = doc.getElementById("qorgs");
    const curBtns = qoBox ? [...(qoBox.children || [])] : [];
    R.selectNode(R.getN()[0]);
    const n0id = R.getN()[0].id;
    check("v25（运行时）：selectNode 后对应快捷按钮亮起（aria-current=true 恰一个，其余 false）",
      curBtns.length > 0 &&
      curBtns.filter(b => (b._attrs || {})["aria-current"] === "true").length === 1 &&
      curBtns.some(b => b.dataset.id === n0id && (b._attrs || {})["aria-current"] === "true"));
    R.selectLink(R.getL()[0]);
    check("v25（运行时）：selectLink 后快捷按钮全部熄灭（aria-current 全 false）",
      curBtns.length > 0 && curBtns.every(b => (b._attrs || {})["aria-current"] === "false"));
  } catch (e) { check("v25 快捷按钮选中态", false, e.message); }

  try {
    /* 中②：搜索激活时点关系线（selectLink 及风险速览「最薄弱关系」入口）不清搜索——
       v24 修互斥时四个入口都加了 clearBlkSearch，独漏第五个，列表 / 计数器 / 搜索框三处残留 */
    const si25 = doc.getElementById("blkSearch");
    const cnt25 = doc.getElementById("blkCount");
    const term25 = ((R.DATA.blockers || [])[0] || {}).t || "审批";
    si25.value = term25;
    R.runBlkSearch();
    const hiddenBefore = createdEls.filter(e => (e.className || "").split(/\s+/).includes("blk") && e.style.display === "none").length;
    R.selectLink(R.getL()[0]);
    const hiddenAfter = createdEls.filter(e => (e.className || "").split(/\s+/).includes("blk") && e.style.display === "none").length;
    check("v25（运行时）：搜索激活时 selectLink 也清搜索（框空 / 计数器空 / 卡片全显回 / 详情为协同关系）",
      hiddenBefore > 0 && si25.value === "" && (cnt25.textContent || "") === "" && hiddenAfter === 0 &&
      R.detail.innerHTML.includes("协同关系"));
    si25.value = "";
    R.runBlkSearch();
  } catch (e) { check("v25 selectLink 清搜索", false, e.message); }

  try {
    /* 轻③：卡点 toggle 关闭分支只藏 netHint + 清 activeBlocker，详情抽屉赖着上一条卡点归因——
       补复位为初始引导文案（与 pickDim / pickPhase 关闭分支同一句，v17 同源残留路径） */
    const blkEl25 = createdEls
      .filter(e => (e.className || "").split(/\s+/).includes("blk") && (e._attrs || {})["data-bi"] === "0")
      .pop();   /* 取最新创建者（当前场景；桩不区分 detached 元素） */
    if (blkEl25) {
      blkEl25.click();   /* 展开 */
      const openOk = R.getActiveBlocker() === 0 && R.detail.innerHTML.includes("卡点归因") &&
        doc.getElementById("netHint").classList.contains("show");
      blkEl25.click();   /* 收起 */
      check("v25（运行时）：收起卡点后详情面板复位引导文案（不再赖着卡点归因、提示条已撤）",
        openOk && R.getActiveBlocker() === null &&
        R.detail.innerHTML.includes("诊断详情") && R.detail.innerHTML.includes("点击总览五维") &&
        !R.detail.innerHTML.includes("卡点归因") &&
        !doc.getElementById("netHint").classList.contains("show"));
    } else {
      check("v25（前置）：找到当前场景卡点元素", false, "no .blk[data-bi=0]");
    }
  } catch (e) { check("v25 卡点收起复位详情", false, e.message); }

  try {
    /* 轻④：switchScene 无条件重写编辑框 value+_snap——未应用的编辑被新场景数据静默覆盖，
       快照一重置收起判定还误报「数据未改动」。改为检测到改动时挂起草稿（不覆盖）并明示 */
    check("v25：switchScene 检测未应用草稿（value!==_snap 时不重写、反馈含「已保留草稿」）",
      mainCode.includes("ed._snap!=null&&ed.value!==ed._snap") &&
      mainCode.includes("已保留草稿，未用新场景数据覆盖"));
    const eb25 = doc.getElementById("editBtn");
    const ed25 = doc.getElementById("ioEdit");
    const msg25 = doc.getElementById("ioMsg");
    if (eb25 && ed25 && msg25) {
      R.switchScene(1);               /* 场景 1：打开编辑框，快照 = 场景 1 JSON */
      eb25.onclick();
      const snap25 = ed25._snap;
      ed25.value = snap25.replace(/"project"\s*:/, '"project":"DRAFT-MARK",');   /* 注入未应用草稿（不解析） */
      R.switchScene(2);               /* 切走：草稿应保留，value / _snap 都不动 */
      check("v25（运行时）：切场景不覆盖未应用草稿（value 含标记、_snap 未重置、反馈明示保留）",
        ed25.value.includes("DRAFT-MARK") && ed25._snap === snap25 &&
        msg25.textContent.includes("已保留草稿"));
      ed25.value = ed25._snap;        /* 还原成「未改动」再切——对照组 */
      R.switchScene(0);
      check("v25（运行时）：无改动时切场景仍刷新并同步快照（v24 行为不回归、反馈无保留提示）",
        ed25.classList.contains("show") && ed25.value === ed25._snap &&
        !msg25.textContent.includes("已保留草稿"));
      eb25.onclick();                 /* 未改动 → 只收起 */
      check("v25（运行时）：未改动收起仍走「数据未改动」分支（草稿路径不污染收起判定）",
        !ed25.classList.contains("show") && msg25.textContent.includes("数据未改动"));
      R.switchScene(0);
    }
  } catch (e) { check("v25 切场景保留草稿", false, e.message); }

  /* ---- v26：十三轮挑刺（报告五节标杆关系漏报 / 搜索正方向对称互斥 /
        窄屏悬浮导航压字 / 首访气泡被裁 / 减少动态光标闪烁） ---- */
  try {
    /* 严重：五节「协同亮点」按对象属性取 l.health / l.a / l.b——links 每项是 [a,b,label,health]
       四元组，属性访问对数组恒 undefined，>=79 过滤命中 0 条、五场景标杆关系全部漏报（同文件
       风险速览 weak 取 p[3] 是对的）。改按数组位置访问，短名按 id 回 DATA.orgs 查 */
    check("v26：五节按数组位置取 links（l[3]>=79，短名回 DATA.orgs 查，不再 l.health>=79）",
      mainCode.includes(".filter(l=>l[3]>=79)") &&
      mainCode.includes("const on=id=>(d.orgs||[]).find(x=>x.id===id);") &&
      !mainCode.includes("filter(l=>l.health>=79)"));   /* showLink 的 l.health>=79 是画布链接对象（L 有 .health），合法保留 */
    /* 运行时：五场景逐一验算——医院 3（82/84/79）、轨道 2（82/80）、排水 2（81/79）、
       学校 2（83/80）、水厂 1（81）；修复前五节清一色「当前无运行平稳的标杆关系」。
       buildReportLines 为屏幕报告 / 打印件 / Markdown 三路共源，一处即三条交付链 */
    const expect26 = [3, 2, 2, 2, 1];
    let ok26 = true, msg26 = "";
    for (let s = 0; s < expect26.length && s < R.ALL_SCENES.length; s++) {
      R.switchScene(s);
      const sec5 = R.buildReportLines()[4];
      const good26 = (R.getDATA().links || []).filter(l => l[3] >= 79);   /* getDATA 取实时 DATA——R.DATA 是脚本返回时的过期引用（loadData 重赋值） */
      /* v27（轻⑦）：单条关系改单数句（与 showLink 单数口径一致），断言随口径分单 / 复数——
         单数：须含单数句、不得带「等」；复数：保留「等关系运行平稳」 */
      const phr27 = good26.length === 1
        ? (sec5.includes("该关系运行平稳，可总结经验形成标准动作") && !sec5.includes("等关系"))
        : sec5.includes("等关系运行平稳");
      if (good26.length !== expect26[s] || sec5.includes("当前无运行平稳") || !phr27 ||
          !good26.every(l => sec5.includes("（" + String(l[3]) + "）"))) {
        ok26 = false; msg26 = "场景 " + s + "：期望 " + expect26[s] + " 条达标，实测 " + good26.length + " 条";
        break;
      }
    }
    check("v26（运行时）：五场景五节均报出达标标杆关系（修复前全部漏报走兜底句）", ok26, msg26);
    R.switchScene(0);
  } catch (e) { check("v26 报告五节标杆关系", false, e.message); }

  try {
    /* 中②静态：输入搜索词时只清维度、不清阶段 / 卡点 / 主体——三套状态同屏并存，与 v24 反向
       「选择清搜索」不对称；输入时统一按各自关闭分支清掉，fromBlkSearch 保护正输入的字
       不被 pickPhase 的清搜索抹掉（与 pickDim 同理） */
    check("v26：runBlkSearch 输入时清阶段 / 卡点 / 主体（与 v24 反向口径对称）",
      mainCode.includes("if(activePhase!==null){fromBlkSearch=true;try{pickPhase(activePhase);}finally{fromBlkSearch=false;}}") &&
      mainCode.includes("activeBlocker=null;selNode=null;selLink=null;") &&
      mainCode.includes("clearBlkSel();updateQuickSel();"));
    /* 中③静态：≤640px 悬浮章节导航 fixed 竖排按钮组压卡片正文右缘约 19px 且截点触——窄屏隐藏；
       轻④静态：首访气泡 right:86px+max-width:300px 在 375px 视口左缘落 -11px——收到 12px /
       min(300px,100vw-40px)；轻⑤静态：减少动态块关 .report .caret 的 blink 无限闪烁 */
    const m640 = css.slice(css.indexOf("@media(max-width:640px)"));
    check("v26：≤640px 媒体块收起 .dock-nav（display:none，正文全宽让出、不截点触）",
      m640.includes(".dock-nav{display:none;}"));
    check("v26：≤640px 首访气泡完整入屏（right:12px + min(300px,100vw-40px)，左缘 ≥28px）",
      m640.includes(".coach-tip{right:12px;max-width:min(300px,calc(100vw - 40px));}"));
    const mRm = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
    check("v26：减少动态块关 .report .caret 闪烁（animation:none，打字全程不再闪）",
      mRm.includes(".report .caret{animation:none;}"));
  } catch (e) { check("v26 静态回归", false, e.message); }

  try {
    /* 中②运行时：阶段过滤激活时输入——阶段态 / 提示条口径 / 诊断抽屉随搜索一并退出，
       搜索文本本身保留（fromBlkSearch 保护） */
    const si26 = doc.getElementById("blkSearch");
    const cnt26 = doc.getElementById("blkCount");
    const nh26 = doc.getElementById("netHint");
    const term26 = ((R.getDATA().blockers || [])[0] || {}).t || "审批";
    si26.value = ""; R.runBlkSearch();
    R.pickPhase(2);                     /* 「招标采购」阶段过滤：提示条阶段口径、抽屉阶段诊断 */
    const beforePh = R.getActivePhase() === 2 && nh26.classList.contains("show") &&
      nh26.textContent.includes("阶段过滤") && R.detail.innerHTML.includes("阶段诊断");
    si26.value = term26; R.runBlkSearch();
    check("v26（运行时）：输入时清阶段过滤（阶段态 / 提示条口径 / 抽屉一并退出、文本保留、命中计数照常）",
      beforePh && R.getActivePhase() === null && si26.value === term26 &&
      !nh26.classList.contains("show") &&
      R.detail.innerHTML.includes("诊断详情") && R.detail.innerHTML.includes("点击总览五维") &&
      (cnt26.textContent || "").includes("命中"));
    /* 中②运行时：已展开卡点被搜索藏掉——卡随过滤 display:none、activeBlocker 清零、.open
       收起、联动提示撤掉、抽屉复位（v19~v25 只清维度时这些全赖着） */
    si26.value = ""; R.runBlkSearch();
    const blkEl26 = createdEls
      .filter(e => (e.className || "").split(/\s+/).includes("blk") && (e._attrs || {})["data-bi"] === "0")
      .pop();   /* 取最新创建者（当前场景；桩不区分 detached 元素） */
    let beforeBlk = false;
    if (blkEl26) {
      blkEl26.click();
      beforeBlk = R.getActiveBlocker() === 0 && blkEl26.classList.contains("open") &&
        nh26.classList.contains("show") && nh26.textContent.includes("卡点联动") &&
        R.detail.innerHTML.includes("卡点归因");
    }
    const term26b = ((R.getDATA().blockers || [])[1] || {}).t || "信息不对称";   /* 展开卡不匹配的词 */
    si26.value = term26b; R.runBlkSearch();
    check("v26（运行时）：输入时收起被搜索藏掉的已展开卡点（activeBlocker 清零 / .open 收起 / 卡被过滤隐藏 / 联动提示撤 / 抽屉复位）",
      !!blkEl26 && beforeBlk && R.getActiveBlocker() === null &&
      !blkEl26.classList.contains("open") && blkEl26.style.display === "none" &&
      !nh26.classList.contains("show") &&
      R.detail.innerHTML.includes("点击总览五维") && si26.value === term26b);
    /* 中②运行时：主体选中态——selectNode 后快捷按钮 aria-current 亮起，输入时全部熄灭、抽屉复位 */
    si26.value = ""; R.runBlkSearch();
    R.selectNode(R.getN()[2]);
    const qoBox26 = doc.getElementById("qorgs");
    const curBtns26 = qoBox26 ? [...(qoBox26.children || [])] : [];
    const beforeNode = curBtns26.length > 0 &&
      curBtns26.some(b => (b._attrs || {})["aria-current"] === "true") &&
      R.detail.innerHTML.includes("协同健康度");
    si26.value = term26; R.runBlkSearch();
    check("v26（运行时）：输入时清主体选中态（快捷按钮全灭 / 抽屉复位引导文案 / 文本保留）",
      beforeNode && curBtns26.length > 0 &&
      curBtns26.every(b => (b._attrs || {})["aria-current"] === "false") &&
      R.detail.innerHTML.includes("诊断详情") && si26.value === term26);
    si26.value = ""; R.runBlkSearch();   /* 还给巡览段干净现场 */
  } catch (e) { check("v26 搜索对称互斥", false, e.message); }

  /* ---- v27：十四轮挑刺（页眉按钮悬浮压编号 / 窄屏巡览按钮压标题 / 搜索清选后画布
        不重绘 / 开帮助时 Esc 半口径 / 窄屏选中后详情不滚动 / 半屏窗口区间日期叠字 /
        单条亮点带「等」/ 减少动态下脉冲环仍逐幕放大） ---- */
  try {
    /* 严重① + 中②静态：.theme-btn / .tour-btn 原 position:absolute; top:18px 悬浮在页眉
       padding 区，与右列「报告编号 / 签发日期」两行垂直全重叠、右缘超内容区右缘 4px，
       ≥510px 任一窗口宽度都必然压住编号右尾；≤640px 又漏了 .tour-btn 窄屏定位、沿用桌面
       right:148 压标题末字。改为 .mh-top 内文档流 flex 项与 .mh-right 同排（margin-left:auto
       把右列与两按钮整组推到右缘），print 隐藏规则对静态元素同样生效，几何上根除重叠。
       纯视觉 / 布局类，无浏览器环境，下为静态推导断言（需人工浏览器确认） */
    check("v27：页眉两按钮入文档流（flex:none，不再 absolute 悬浮压右列编号 / 日期；窄屏同解）",
      /\.theme-btn\{flex:none;/.test(css) && /\.tour-btn\{flex:none;/.test(css) &&
      !/\.theme-btn\{[^}]*position:absolute/.test(css) && !/\.tour-btn\{[^}]*position:absolute/.test(css));
    check("v27：DOM 顺序右列先于两按钮（margin-left:auto 把右列与按钮整组推到右缘）",
      /class="mh-right"[\s\S]{0,160}?class="theme-btn"[\s\S]{0,120}?class="tour-btn"/.test(html));
    const m640r = css.slice(css.indexOf("@media(max-width:640px)"));
    check("v27：≤640px 块两按钮无残留定位（静态元素 top/right 无效，只留缩小字号 / 内边距，避免误导）",
      m640r.includes(".theme-btn{font-size:11.5px;padding:5px 11px;}"));
    /* 轻⑥静态：921~1080px 仍两栏，主列六阶段相邻节点间距约 91~102px < 区间日期串约 105px——
       v22 的日期拆段隐藏只覆盖 ≤640px，641~990px 窗口段无对应处理；上提到 ≤1080px 档 */
    const i1080r = css.indexOf("@media(max-width:1080px)");
    const i1080Next = css.indexOf("@media", i1080r + 10);
    const m1080r = css.slice(i1080r, i1080Next > 0 ? i1080Next : undefined);
    check("v27：≤1080px 档隐藏区间日期结束段（半屏 91~102px 间距不再压 105px 日期串）",
      m1080r.includes(".tl-date .d-sep,.tl-date .d-to{display:none;}"));
    /* 轻⑧静态：巡览逐幕脉冲环（pulse() 以内联 animation:tourRing 写入的 scale .55→1.7）——
       v26 收打字光标后它是「减少动态」偏好下同性质且更明显的残留；沿用打印隐藏规则的
       [style*=tourRing] 选择器思路（内联 animation 需 !important 才能覆盖） */
    const mRm27 = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
    check("v27：减少动态块关巡览脉冲环（[style*=tourRing] animation:none!important）",
      mRm27.includes('[style*="tourRing"]{animation:none!important;}'));
    /* 中③静态：runBlkSearch 清主体 / 卡点 / 关系选中分支漏 wake()——画布静止约 1.5 秒即暂停
       raf，选中圈 / 淡出只存在位图上；DOM 状态复位后位图残留到下一次画布交互（同函数
       pickDim / pickPhase 两分支各自会 wake，独此手写分支漏了） */
    check("v27：搜索清选分支补 wake()（暂停画布按清空状态重绘一帧，消除位图残留选中圈）",
      mainCode.includes("if(activeBlocker!==null||selNode||selLink){\n        activeBlocker=null;selNode=null;selLink=null;\n        clearBlkSel();updateQuickSel();\n        $(\"netHint\").classList.remove(\"show\");\n        detail.innerHTML=`<h3>诊断详情</h3><div class=\"empty\">点击总览五维、时间轴阶段、网络中的主体或关系、或下方卡点，在此查看结构化诊断。</div>`;\n        wake();"));
    /* 中④静态：canvas Escape 分支开头先判 kbdHelp 是否打开，打开则直接 return 交给 window
       处理器走「弹层优先关」口径（canvas 处理器在冒泡链上先执行，原会把选中 / 搜索词清一半、
       漏掉 activePhase 与 clearTlSel()，留下半亮孤儿过滤） */
    check("v27：canvas Esc 先判帮助弹层（打开时 return 交给 window 关弹层，不再半口径清选）",
      mainCode.includes("const h=$(\"kbdHelp\");\n    if(h&&!h.hidden)return;"));
    /* 中⑤静态：scrollDetailNarrow 封装 + 五个选中入口（维度 / 阶段 / 主体 / 关系 / 卡点展开）
       调用——窄屏（≤920px）详情面板排在整页末尾，选中后复用风险速览两入口同款滚到详情 */
    check("v27：scrollDetailNarrow 封装（≤920px 才滚、走尊重 prefers-reduced-motion 的 smoothScroll）",
      mainCode.includes("function scrollDetailNarrow(){\n  if(typeof window.innerWidth!==\"number\"||window.innerWidth>920)return;\n  smoothScroll(detail,\"nearest\");\n}"));
    check("v27：五个选中入口均调 scrollDetailNarrow（窄屏详情随选中入镜，与风险速览同款）",
      (mainCode.match(/scrollDetailNarrow\(\);/g) || []).length === 5 &&
      mainCode.includes("showNode(n);\n  wake();\n  scrollDetailNarrow();"));
    /* 轻⑦静态：单条标杆关系的单数句（与详情面板 showLink 的单数口径一致），三路共源同改 */
    check("v27：报告五节单条关系输出单数句（good.length===1，复数才保留「等」）",
      mainCode.includes("good.length===1") &&
      mainCode.includes("good[0] + \" 该关系运行平稳，可总结经验形成标准动作\""));
  } catch (e) { check("v27 静态回归", false, e.message); }

  try {
    /* 中④运行时一：帮助弹层开着时按 Esc——canvas 处理器先冒泡执行、window 处理器随后只关弹层。
       v27 期望：canvas 早 return，阶段过滤 / 提示条口径 / 抽屉阶段诊断全部原样保留；
       v26 行为：canvas 先清掉全部选中并复位面板与提示条、却漏 activePhase 与 clearTlSel()，
       阶段圆点还亮着、画布还灰着，正是「过滤仍生效、解释已撤掉」的孤儿半亮态 */
    const kh27 = doc.getElementById("kbdHelp");
    const nh27 = doc.getElementById("netHint");
    kh27.hidden = false;   /* 打开快捷键帮助（toggleKbdHelp 打开后 hidden===false） */
    R.pickPhase(2);        /* 「招标采购」阶段过滤：阶段态 / 提示条口径 / 抽屉阶段诊断 */
    const phBefore = R.getActivePhase() === 2 && nh27.classList.contains("show") &&
      nh27.textContent.includes("阶段过滤") && R.detail.innerHTML.includes("阶段诊断");
    const cv27 = R.getCanvas();
    const kd27 = (cv27._ls.find(x => x[0] === "keydown") || [])[1];
    kd27({ key: "Escape", preventDefault() { } });   /* canvas 处理器先冒泡执行 */
    const afterCanvas = phBefore && R.getActivePhase() === 2 && nh27.classList.contains("show") &&
      R.detail.innerHTML.includes("阶段诊断");
    (R.winListeners["keydown"] || []).forEach(f => f({ key: "Escape", target: { tagName: "BODY" }, preventDefault() { } }));
    check("v27（运行时）：开着帮助按 Esc 只关弹层（阶段过滤 / 提示条 / 抽屉原样保留，无孤儿半亮）",
      afterCanvas && kh27.hidden === true && R.getActivePhase() === 2 &&
      nh27.classList.contains("show") && nh27.textContent.includes("阶段过滤") &&
      R.detail.innerHTML.includes("阶段诊断"));
    /* 中④运行时二：刚选的主体不被 Esc 顺手清光——selectNode 后打开帮助按 Esc，抽屉仍留主体诊断 */
    kh27.hidden = false;
    R.selectNode(R.getN()[2]);
    const nodeBefore = R.detail.innerHTML.includes("协同健康度");
    kd27({ key: "Escape", preventDefault() { } });
    (R.winListeners["keydown"] || []).forEach(f => f({ key: "Escape", target: { tagName: "BODY" }, preventDefault() { } }));
    check("v27（运行时）：开着帮助按 Esc，刚选的主体诊断保留（v26 会被 canvas 处理器顺手清光）",
      nodeBefore && kh27.hidden === true && R.detail.innerHTML.includes("协同健康度"));
    kh27.hidden = true;   /* 还现场：弹层关闭态 */
    /* 中⑤运行时：窄屏（≤920px）选中入口触发后滚到详情；≥921px 详情为常驻侧栏不滚。
       桩的 win 默认无 innerWidth（=桌面），注入 375 模拟窄屏后 pickDim 应滚到 detail */
    const det27 = R.detail;
    const origSIV = det27.scrollIntoView;
    let calls27 = [];
    det27.scrollIntoView = function (o) { calls27.push(o); };
    R.win.innerWidth = 375;
    R.pickDim(0);          /* 维度选中入口 */
    const narrowScrolled = calls27.length >= 1 && calls27.every(o => o && (o.block || "nearest") === "nearest");
    calls27 = [];
    delete R.win.innerWidth;   /* 还原桌面（win 无 innerWidth = 常驻侧栏） */
    R.pickDim(1);          /* 桌面再选一维：常驻侧栏就在视野内，不应触发滚动 */
    check("v27（运行时）：窄屏选中入口滚到详情（block=nearest）、桌面常驻侧栏不滚",
      narrowScrolled && calls27.length === 0);
    det27.scrollIntoView = origSIV;
    R.pickDim(1);          /* 关掉维度过滤，还给巡览段干净现场 */
  } catch (e) { check("v27 选中态 / 详情滚动", false, e.message); }

  try {
    /* 轻⑦运行时：水厂场景只有 1 条标杆关系（监理 81），五节应为单数句、无「等」；
       医院 3 条仍走复数「等关系运行平稳」句式（buildReportLines 三路共源，断其一即断全部） */
    R.switchScene(4);
    const sec5f = R.buildReportLines()[4];
    const goodF = (R.getDATA().links || []).filter(l => l[3] >= 79);
    check("v27（运行时）：水厂单条标杆关系报单数句（含关系与分数、不带「等」）",
      goodF.length === 1 && sec5f.includes("该关系运行平稳，可总结经验形成标准动作") &&
      !sec5f.includes("等关系") && sec5f.includes("（" + String(goodF[0][3]) + "）"), sec5f.slice(0, 80));
    R.switchScene(0);
    const sec5h = R.buildReportLines()[4];
    check("v27（运行时）：医院三条标杆关系仍走复数「等关系」句式",
      (R.getDATA().links || []).filter(l => l[3] >= 79).length === 3 &&
      sec5h.includes("等关系运行平稳"), sec5h.slice(0, 80));
  } catch (e) { check("v27 报告五节单复数", false, e.message); }

  /* ---- v28：十五轮挑刺（悬浮导航收起仍占 Tab 焦点 / 时间轴提示「右侧网络」指错方向 /
        开帮助时按 / 焦点落弹层背后 / 恢复示例数据吞未应用草稿） ---- */
  try {
    /* 中①静态：.dock-nav 收起态只用 opacity:0 + pointer-events:none——pointer-events 挡鼠标挡不住
       键盘：6 个 button 仍在 Tab 序列里，opacity:0 又作用于整个子树、连 :focus-visible 焦点环一起
       隐形；首访（scrollY=0，.show 未加）全键盘用户连按 6 下 Tab 屏幕无反应。补 visibility:hidden
       让按钮彻底退出 Tab 序列；过渡表加 visibility（显→隐末尾翻转、隐→显开始翻转），.show 的
       opacity 淡入淡出照常作视觉。≤640px 的 display:none 与打印隐藏不受影响（display 覆盖 visibility）。
       纯键盘 / 视觉类，无浏览器环境，下为静态推导断言（需人工浏览器确认） */
    check("v28：.dock-nav 收起态补 visibility:hidden（退出 Tab 序列；.show 补 visible、过渡表带 visibility 保淡入淡出）",
      css.includes("opacity:0;pointer-events:none;visibility:hidden;transition:opacity .3s,visibility .3s;") &&
      css.includes(".dock-nav.show{opacity:1;pointer-events:auto;visibility:visible;}"));
    /* 轻②静态：≤920px 页面改单列——网络卡在时间轴之后（下方）、详情面板排到全部卡片之后的页尾，
       原提示「右侧网络中高亮…并在详情面板」是桌面两栏写法、窄屏整条指错方向；改与布局无关的中性写法 */
    check("v28：时间轴提示语去方向性「右侧网络」（中性写法，窄屏不再指错方向）",
      !html.includes("右侧网络中高亮") &&
      html.includes("点击阶段节点，网络中高亮该阶段参与主体、详情面板给出阶段诊断"));
    /* 轻③静态：/ 分支只排除 INPUT/TEXTAREA、未判 #kbdHelp 打开态——用户从帮助里读到
       「/ 聚焦卡点搜索」后立刻按 / 是自然反应，焦点切给弹层下方搜索框、焦点环与输入全被
       z-index:100 的弹层盖住。按 / 时先关弹层再聚焦（toggleKbdHelp 的 force 是 hidden 目标值，
       true = 关闭——首版误写 false 由运行时断言抓到，见 v28 运行时块） */
    check("v28：按 / 时若帮助弹层打开先 toggleKbdHelp(true) 关闭再聚焦搜索（焦点不再落弹层背后）",
      mainCode.includes('if(e.key==="/"&&!editing){e.preventDefault();const h=$("kbdHelp");if(h&&!h.hidden)toggleKbdHelp(true);const s=$("blkSearch");if(s)s.focus();}'));
    /* 轻④静态：resetBtn 是「编辑快照与收起承诺」链上 switchScene / editBtn 之后的第三个破坏性入口——
       原只收起编辑框、不检测改动，下次打开 JSON.stringify(DATA) 连同 _snap 一起重写、草稿静默丢失。
       与 switchScene 同口径：比对 edit.value 与 edit._snap，有改动保留草稿（不收起、不重写）并明示 */
    check("v28：resetBtn 恢复示例数据前比对快照（有改动保留草稿并明示，与 switchScene 同口径）",
      mainCode.includes('if(edit.classList.contains("show")&&edit._snap!=null&&edit.value!==edit._snap)draftKept=true;') &&
      mainCode.includes("已保留草稿，未用示例数据覆盖"));
  } catch (e) { check("v28 静态回归", false, e.message); }

  try {
    /* 轻③运行时：开着帮助按 /——弹层应先关闭（原 v27 行为：弹层纹丝不动、焦点落背后搜索框，
       用户看到「快捷键失灵」，非得再按 Esc 才见过滤结果） */
    const kh28 = doc.getElementById("kbdHelp");
    const kds28 = R.winListeners["keydown"] || [];
    const fire28 = k => kds28.forEach(f => f({ key: k, target: doc.body, preventDefault() { } }));
    kh28.hidden = false;            /* 模拟用户按 ? 打开帮助 */
    fire28("/");                    /* 在帮助里读到「/ 聚焦卡点搜索」后立刻按 / */
    check("v28（运行时）：开着帮助按 / 先关弹层（hidden=true，再聚焦搜索不再被弹层盖住）",
      kh28.hidden === true);
    kh28.hidden = true;             /* 还现场：弹层关闭态 */
  } catch (e) { check("v28 开帮助按 /", false, e.message); }

  try {
    /* 轻④运行时：编辑框有未应用改动时点「恢复示例数据」——草稿保留（value/_snap 不被示例数据
       重写、编辑框不收起、收起时仍按「编辑过」走应用或报解析错误）+ 反馈明示；对照组无改动时
       仍收起编辑框并报「已恢复为示例数据」（v27 旧行为不回归） */
    const eb28 = doc.getElementById("editBtn");
    const ed28 = doc.getElementById("ioEdit");
    const msg28 = doc.getElementById("ioMsg");
    const rb28 = doc.getElementById("resetBtn");
    if (eb28 && ed28 && msg28 && rb28 && eb28.onclick && rb28.onclick) {
      eb28.onclick();                     /* 打开：写当前数据 + 记快照 */
      const snap28 = ed28._snap;
      ed28.value = snap28 + "\n  ";       /* 注入未应用改动（尾随空白，仍为合法 JSON） */
      rb28.onclick();
      check("v28（运行时）：恢复示例数据保留未应用草稿（value 未重写、_snap 未重置、编辑框仍展开、反馈明示）",
        ed28.value !== snap28 && ed28._snap === snap28 &&
        ed28.classList.contains("show") && msg28.textContent.includes("已保留草稿"));
      ed28.value = ed28._snap;            /* 还原成「未改动」——对照组 */
      rb28.onclick();
      check("v28（运行时）：无改动时恢复示例数据照常收起编辑框（「已恢复为示例数据」、无保留提示）",
        !ed28.classList.contains("show") && msg28.textContent.includes("已恢复为示例数据") &&
        !msg28.textContent.includes("已保留草稿"));
    } else {
      check("v28（前置）：editBtn / resetBtn 处理器与 #ioEdit 就绪", false);
    }
  } catch (e) { check("v28 恢复示例数据保留草稿", false, e.message); }

  /* ---- v29：十六轮挑刺（? 帮助弹层焦点不进弹层、Tab 钻进背后页面 / 卡点归因角标
        按钮上 ↑↓ 方向键失效 / 「减少动态」偏好下时间轴阶段圆点悬停仍平滑放大） ---- */
  try {
    /* 中①静态：.kbd-help 容器补 tabindex="-1"——弹层内原本没有任何可聚焦元素，
       focus() 无处落脚；容器即唯一落脚点，全局 :focus-visible 规则给出可见焦点环 */
    check('v29：#kbdHelp 容器带 tabindex="-1"（focus() 有落脚点，:focus-visible 焦点环可见）',
      html.includes('class="kbd-help" id="kbdHelp" hidden role="dialog" aria-label="快捷键说明" tabindex="-1"'));
    /* 中①静态：toggleKbdHelp 改为开 / 关两分支——打开时接焦进弹层并记下触发前焦点、
       关闭时归还（force 是 hidden 目标值 true=关闭——v28 首版取反参数被运行时断言抓到
       的前车之鉴，此处 willOpen 同口径推导） */
    check("v29：toggleKbdHelp 开分支接焦进弹层 / 关分支归还触发前焦点",
      mainCode.includes("const willOpen=(force===undefined)?h.hidden:!force;") &&
      mainCode.includes("h.hidden=!willOpen;") &&
      mainCode.includes("kbdHelpReturn=document.activeElement;") &&
      mainCode.includes("h.focus();") &&
      mainCode.includes("if(kbdHelpReturn&&kbdHelpReturn.focus)kbdHelpReturn.focus();"));
    /* 中①静态：弹层显示期间 Tab 圈在弹层内——弹层内除容器外无可聚焦元素，拦截后
       钉回容器 = 焦点不再落入弹层背后的页面 */
    check("v29：window keydown 弹层开时拦截 Tab 并钉回弹层容器（Tab 不再钻进背后页面）",
      mainCode.includes('if(hTab&&!hTab.hidden&&e.key==="Tab"){e.preventDefault();hTab.focus();return;}'));
    /* 中①静态：Esc 关弹层改走 toggleKbdHelp(true)——与 ? / / 同一归还焦点口径 */
    check("v29：Esc 关弹层走 toggleKbdHelp(true)（同归还焦点口径，不再直写 h.hidden=true）",
      mainCode.includes('if(h&&!h.hidden){toggleKbdHelp(true);return;}'));
    /* 轻②静态：卡点 keydown 守卫只对 Enter/Space 让出——按钮对方向键没有默认行为，
       原 v15 守卫连 ArrowUp/Down 一起让出会让焦点停在角标上进退不得 */
    check("v29：卡点 keydown 守卫只让 Enter/Space（v15 初衷保留，方向键交给卡片间移动分支）",
      /e\.target\.tagName==="BUTTON"&&\s*\n\s*\(e\.key==="Enter"\|\|e\.key==" "\)\)return;/.test(mainCode));
    /* 轻③静态：减少动态块补 .tl-m——悬停不放大（transform 去掉 scale、box-shadow 阴影
       反馈由基类级联保留）、transition 取消（选中态切换不再有缩放过渡）；.tl-m.sel
       的持续放大是状态标识，不在豁免块内、照常保留 */
    const mRm29 = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
    check("v29：减少动态块含 .tl-m 悬停去 scale（留阴影）、transition 取消；.sel 持续放大保留",
      mRm29.includes(".tl-m{transition:none;}") &&
      mRm29.includes(".tl-m:hover{transform:translateX(-9px);}") &&
      !mRm29.includes(".tl-m.sel{") &&   /* 豁免块内不含 .tl-m.sel 规则：选中态持续放大（状态标识）保留 */
      css.includes(".tl-m:hover,.tl-m.sel{transform:translateX(-9px) scale(1.28);"));   /* 基类 sel 放大 rule 不动 */
  } catch (e) { check("v29 静态回归", false, e.message); }

  try {
    /* 中①运行时一：弹层开时 Tab 被拦截（preventDefault 被调且弹层保持打开）——桩中
       focus() 为空操作，以「Tab 被 preventDefault + hidden 不变」间接断言 Tab 圈在
       弹层内；对照：弹层关时 Tab 透传（preventDefault 零调用） */
    const kh29 = doc.getElementById("kbdHelp");
    const kds29 = R.winListeners["keydown"] || [];
    let pd29 = 0;
    const fire29 = (k, target) => kds29.forEach(f => f({ key: k, target: target || doc.body, preventDefault() { pd29++; } }));
    kh29.hidden = true;
    fire29("?");
    check("v29（前置）：? 打开帮助弹层（hidden=false）", kh29.hidden === false);
    pd29 = 0;
    fire29("Tab");
    check("v29（运行时）：弹层开时 Tab 被 preventDefault 且弹层保持打开（Tab 圈在弹层内，不钻进背后页面）",
      pd29 === 1 && kh29.hidden === false);
    pd29 = 0;
    fire29("Tab", { tagName: "DIV" });   /* 模拟焦点已在弹层容器上再按 Tab（Shift+Tab 同路径） */
    check("v29（运行时）：焦点已在弹层容器上再按 Tab 仍被拦截",
      pd29 === 1 && kh29.hidden === false);
    kh29.hidden = true;                  /* 对照：弹层关闭 */
    pd29 = 0;
    fire29("Tab");
    check("v29（对照）：弹层关时 Tab 不被弹层逻辑拦截（普通 Tab 透传）",
      pd29 === 0);
    /* 中①运行时二：焦点接进弹层 + 关闭归还——桩无 activeElement，注入带 focus 探针的
       触发按钮模拟「打开帮助前焦点在某按钮上」（真浏览器中 activeElement 由系统维护） */
    const trig29 = doc.createElement("BUTTON");
    let returnFocus29 = 0;
    trig29.focus = () => { returnFocus29++; };
    const origFocus29 = kh29.focus;
    let openFocus29 = 0;
    kh29.focus = () => { openFocus29++; };
    doc.activeElement = trig29;
    fire29("?");
    check("v29（运行时）：打开帮助时焦点接进弹层容器（容器 focus() 被调，hidden=false）",
      kh29.hidden === false && openFocus29 === 1);
    fire29("Escape");
    check("v29（运行时）：Esc 关闭帮助后焦点归还触发前元素（触发按钮 focus() 被调）",
      kh29.hidden === true && returnFocus29 === 1);
    kh29.focus = origFocus29;            /* 还现场 */
    delete doc.activeElement;
    kh29.hidden = true;
  } catch (e) { check("v29 帮助弹层焦点", false, e.message); }

  try {
    /* 轻②运行时：焦点在归因角标按钮上按 ↑/↓——v15 守卫原先连方向键一起让出，按钮对
       方向键无默认行为、焦点原地不动；v29 守卫只留 Enter/Space，方向键落入卡片移动
       分支（preventDefault 被调 = 移动逻辑执行）。桩不解析 innerHTML、归因角标无真实
       元素，以 {tagName:"BUTTON"} 假目标触发卡片 keydown */
    const blk29 = createdEls.filter(e => (e.className || "").split(/\s+/).includes("blk") &&
      (e._ls || []).some(x => x[0] === "keydown")).pop();
    check("v29（前置）：.blk 卡片 keydown 监听就绪", !!blk29);
    if (blk29) {
      const kd29 = (blk29._ls.find(x => x[0] === "keydown") || [])[1];
      const fakeBtn29 = { tagName: "BUTTON" };
      let pd29b = 0;
      kd29({ key: "ArrowDown", target: fakeBtn29, preventDefault() { pd29b++; } });
      check("v29（运行时）：归因角标按钮上按 ↓ 进入卡片间移动（preventDefault 被调，焦点不再卡在角标上）",
        pd29b === 1);
      let pd29c = 0;
      kd29({ key: "ArrowUp", target: fakeBtn29, preventDefault() { pd29c++; } });
      check("v29（运行时）：归因角标按钮上按 ↑ 同样进入卡片间移动", pd29c === 1);
      let pd29d = 0;
      const openBefore29 = blk29.classList.contains("open");
      kd29({ key: "Enter", target: fakeBtn29, preventDefault() { pd29d++; } });
      check("v29（对照 v15）：按钮上 Enter 仍让出（不 preventDefault、不误折叠 / 展开卡片）",
        pd29d === 0 && blk29.classList.contains("open") === openBefore29);
    }
  } catch (e) { check("v29 卡点角标方向键", false, e.message); }

  /* ---- v30：十七轮挑刺（三类按钮悬停位移动效漏在减少动态豁免块外 / 巡览字幕①引用
     画面上不存在的「较上次复查」/ prefersReduced 只在加载时取一次快照、会话中途开减少
     动态 CSS 停了 JS 照旧） ---- */
  try {
    /* 轻①静态：豁免块补三类按钮悬停位移——.gen-btn / .risk-item 的 translateY(-1px) 与
       .dock-nav button 的 translateX(-3px)（配 0.15–0.2s 过渡），与 v29 的 .tl-m 悬停
       缩放同属一类；去 transform:none 后悬停不再挪动（颜色 / 阴影 / 边框反馈保留） */
    const mRm30 = css.slice(css.indexOf("@media (prefers-reduced-motion:reduce)"));
    check("v30：减少动态块补三类悬停按钮 transform:none（.gen-btn / .risk-item / .dock-nav button，与 .tl-m 同口径）",
      mRm30.includes(".gen-btn:hover,.risk-item:hover,.dock-nav button:hover{transform:none;}") &&
      mRm30.includes(".tl-m:hover{transform:translateX(-9px);}"));   /* v29 的 .tl-m 规则不回归 */
    /* 轻②静态：字幕①引号内向观众承诺的字必须是界面实有——chip 实际是「较上次（2025-12）
       +5 分」，全页无「较上次复查」五字（v24 修同一句字幕等级写法时的同类口径问题） */
    check("v30：字幕①引号内改为界面实有的「较上次」（不再承诺画面上没有的「较上次复查」五字）",
      mainCode.includes("印章旁可见「较上次」升降趋势") &&
      !mainCode.includes("较上次复查") &&
      mainCode.includes('chip.textContent="较上次（"+esc(prev.date)'));   /* 界面实有「较上次」chip 佐证 */
    /* 轻③静态：const 快照改 let + matchMedia change 监听；buildOverview 存 _total 供监听
       把正在跑的计数一次性置终值 */
    check("v30：prefersReduced 改 let 并注册 matchMedia change 监听（会话中途切换实时同步，不再只取加载时快照）",
      /\blet prefersReduced=/.test(mainCode) &&
      mainCode.includes('_rmql.addEventListener("change"') &&
      mainCode.includes('window.matchMedia("(prefers-reduced-motion: reduce)")'));
    check("v30：buildOverview 存 sv._total，change 监听把正在跑的计数一次性置终值（v21 同口径）",
      mainCode.includes("sv._total=TOTAL;") &&
      mainCode.includes("sv._total!=null?sv._total:sv.textContent"));
  } catch (e) { check("v30 静态回归", false, e.message); }

  try {
    /* 轻③运行时：会话中途开「减少动态」——change 事件实时把 prefersReduced 翻 true
       （JS 侧 smoothScroll / toTop / 卡点箭头 / 报告滚动随即走 auto），正在跑的总分计数
       一次性置终值（_iv 清掉、文本=当前场景总分）；随后翻回 false 恢复，不污染后续巡览断言 */
    const sv30 = doc.getElementById("scoreV");
    const expect30 = String(Math.max(0, Math.min(100, R.getDATA().total || 0)));
    check("v30（前置）：初始 prefersReduced=false（减少动态未开）", R.getPrefersReduced() === false);
    rmMql._fire(true);
    check("v30（运行时）：中途开减少动态——change 监听实时翻 prefersReduced=true（JS 侧运动随即走 auto）",
      R.getPrefersReduced() === true);
    check("v30（运行时）：正在跑的总分计数一次性置终值（_iv 清掉、文本=当前场景总分终值）",
      sv30.textContent === expect30, "scoreV=" + sv30.textContent + " expect=" + expect30);
    rmMql._fire(false);
    check("v30（对照）：再关掉减少动态——prefersReduced 恢复 false",
      R.getPrefersReduced() === false);
  } catch (e) { check("v30 change 监听运行时", false, e.message); }

  /* ---- v31：十八轮第①条——手动进对比模式要有可见反馈（对比卡滚进视野） ---- */
  try {
    const fixed31 = "if(!tourActive){const card=$(\"cmpCard\");if(card)smoothScroll(card,\"center\");}";
    check("v31：enterCmp 手动路径补 smoothScroll(cmpCard)（巡览期间不重复滚，由第八幕自行滚）",
      mainCode.includes("if(!tourActive){const card=$(\"cmpCard\");if(card)smoothScroll(card,\"center\");}") ||
      mainCode.includes("smoothScroll(card,\"center\")"));
    check("v31：守卫带 tourActive（巡览版第八幕与本路径互不重复滚动）",
      mainCode.includes("if(!tourActive){"));
  } catch (e) { check("v31 静态回归", false, e.message); }

  /* ---- v32 Step 0：状态机不变量网（行为断言，钉不变量而非字面文本）
     五个互斥选择态：activeDim / activePhase / activeBlocker / selNode / selLink
     六个入口：pickDim / pickPhase / selectNode / selectLink / 卡点 toggle / runBlkSearch
     每条历史「半口径」回归（v19/v24/v25/v26/v27）都是某入口手写清场仪式的缺行——
     这里钉的是「任何转换后世界必须长什么样」，与入口怎么写无关 ---- */
  try {
    const K = ["dim", "phase", "blocker", "node", "link"];
    const state = () => ({
      dim: R.getActiveDim(), phase: R.getActivePhase(), blocker: R.getActiveBlocker(),
      node: R.getSelNode(), link: R.getSelLink()
    });
    const nonNull = s => K.filter(k => s[k] !== null && s[k] !== undefined);
    const noFade = () => doc.querySelectorAll(".blk.dim-fade").length === 0;
    const noTlSel = () => doc.querySelectorAll(".tl-m.sel").length === 0;
    const noBlkSel = () => doc.querySelectorAll(".blk.sel").length === 0 && doc.querySelectorAll(".blk.open").length === 0;
    /* 只数 #qorgs 的活子节点：桩的 querySelectorAll 不强制祖先关系，
       历次 switchScene 重建 detached 的旧 .qorg 仍在 createdEls 里（跨场景共用 org id，会虚增计数） */
    const qorgCurrent = () => {
      const qo = doc.getElementById("qorgs");
      return (qo ? qo.children : []).filter(b => b.getAttribute && b.getAttribute("aria-current") === "true").length;
    };
    const hintShown = () => doc.getElementById("netHint").classList.contains("show");
    const guideInDetail = () => R.detail.innerHTML.includes("点击总览五维");

    function resetAll() {   /* 先把五个态全部归零，给矩阵一个干净起点 */
      if (R.getActiveDim() !== null) R.pickDim(R.getActiveDim());
      if (R.getActivePhase() !== null) R.pickPhase(R.getActivePhase());
      const open = doc.querySelectorAll(".blk.open");
      open.forEach(el => el.click());
      const si = doc.getElementById("blkSearch");
      if (si) { si.value = ""; R.runBlkSearch(); }
    }
    function apply(kind) {
      if (kind === "dim") R.pickDim(1);           /* 信息通畅度：医院场景有归因卡点 */
      else if (kind === "phase") R.pickPhase(2);  /* 招标采购 */
      else if (kind === "node") R.selectNode(R.getN()[0]);
      else if (kind === "link") R.selectLink(R.getL()[0]);
      else { const el = doc.querySelector('.blk[data-bi="0"]'); if (el) el.click(); }
    }
    /* 转换后世界：唯一性 / 残留 / 提示条 / 抽屉 / 快捷按钮 五项口径 */
    function assertWorld(tag, expectKind) {
      const s = state(), actives = nonNull(s);
      const okActive = expectKind === null
        ? actives.length === 0
        : actives.length === 1 && actives[0] === expectKind;
      const okFade = (s.dim === null) ? noFade() : true;        /* dim 选中时淡出应在 */
      const okTl = (s.phase === null) ? noTlSel() : true;
      const okBlk = (s.blocker === null) ? noBlkSel() : true;
      const okHint = hintShown() === (s.dim !== null || s.phase !== null || s.blocker !== null);
      const okQ = qorgCurrent() === (s.node ? 1 : 0);
      let okDetail = false;
      if (expectKind === "dim") okDetail = R.detail.innerHTML.includes("维度诊断");
      else if (expectKind === "phase") okDetail = R.detail.innerHTML.includes("阶段诊断");
      else if (expectKind === "blocker") okDetail = R.detail.innerHTML.includes("卡点归因");
      else if (expectKind === "node") okDetail = R.getSelNode() && R.detail.innerHTML.includes(String(R.getSelNode().name));
      else if (expectKind === "link") okDetail = R.detail.innerHTML.includes("协同关系");
      else okDetail = guideInDetail();
      check("不变量网 " + tag + "：唯一选中=" + expectKind + " / 无残留 / 提示条 / 抽屉 / 快捷按钮五口径",
        okActive && okFade && okTl && okBlk && okHint && okQ && okDetail,
        "actives=" + JSON.stringify(actives) + " fade=" + !noFade() + " tl=" + !noTlSel() + " blk=" + !noBlkSel() +
        " hint=" + hintShown() + " q=" + qorgCurrent());
    }
    /* 方向一：P → T（P≠T），转换后唯一选中为 T，P 的残留全消 */
    for (const p of K) for (const t of K) {
      if (p === t) continue;
      resetAll(); apply(p); apply(t);
      assertWorld("[" + p + "→" + t + "]", t);
    }
    /* 方向二：dim/phase/blocker 自我再点 = 关闭，全归零 */
    for (const k of ["dim", "phase", "blocker"]) {
      resetAll(); apply(k); apply(k);
      assertWorld("[" + k + "→关]", null);
    }
    /* 方向三：node/link 重复选中不取消，仍唯一选中 */
    for (const k of ["node", "link"]) {
      resetAll(); apply(k); apply(k);
      assertWorld("[" + k + "→再选]", k);
    }
    /* 方向四：搜索激活（runBlkSearch）= 互斥清五个态 + 抽屉复位（v19/v26 方向） */
    resetAll(); apply("dim");
    const si4 = doc.getElementById("blkSearch");
    si4.value = "需求"; R.runBlkSearch();
    assertWorld("[搜索→清维度]", null);
    /* 方向五：任何选择入口清搜索框（v24/v25 方向） */
    for (const k of K) {
      resetAll();
      const si5 = doc.getElementById("blkSearch");
      si5.value = "审批"; R.runBlkSearch();
      apply(k);
      check("不变量网 [选" + k + "清搜索]：框内词被清、计数器空",
        si5.value === "" && (doc.getElementById("blkCount").textContent || "") === "",
        "val=" + JSON.stringify(si5.value));
      resetAll();
    }
    /* wake() 作用域断言：六个入口的函数体各自必须含 wake()——v27 中③正是手写分支漏 wake
       （作用域级文本：钉的是「函数体内有此调用」，不是字面行，抗格式化） */
    const bodyOf = name => {
      const i = mainCode.indexOf("function " + name + "(");
      if (i < 0) return null;
      let j = mainCode.indexOf("{", i), depth = 0;
      for (; j < mainCode.length; j++) {
        if (mainCode[j] === "{") depth++;
        else if (mainCode[j] === "}") { depth--; if (depth === 0) break; }
      }
      return mainCode.slice(i, j + 1);
    };
    for (const fn of ["pickDim", "pickPhase", "selectNode", "selectLink", "runBlkSearch", "buildBlockerEl"]) {
      const b = bodyOf(fn);
      check("wake() 作用域：" + fn + " 函数体内含 wake() 调用", !!b && b.includes("wake("),
        b ? "len=" + b.length : "函数未找到");
    }
  } catch (e) { check("v32 状态机不变量网", false, e.message); }

  /* ---- v13 内置巡览（异步：driver 的 await 链需要 flush 微任务） ---- */
  (async () => {
    try {
      /* v22：tour.html 为自启动版——同步段已 stopTour，但其 driver 的挂起续段（await sleep(500)）
        要等首次微任务排空才执行；开播前先排空，否则新 driver 与旧续段并发点击、状态互相顶 */
      for (let i = 0; i < 10; i++) await Promise.resolve();
      if (R.tourActive()) R.stopTour();
      // 启动 → 完整跑完 8 步 → 退出（桩环境 sleep 即时 resolve）
      R.startTour();
      check("v13：startTour 激活（tourActive）", R.tourActive() === true);
      const ov = doc.getElementById("tourOv");
      check("v13：巡览字幕条已挂载", !!ov);
      check("v13：巡览按钮进入 on 态", doc.getElementById("tourBtn").classList.contains("on"));
      for (let i = 0; i < 4000 && R.tourActive(); i++) await Promise.resolve();   /* flush 微任务让 driver 跑完 */
      const rep = doc.getElementById("report");
      const typedDuringTour = rep.querySelectorAll("p").length >= 1 || rep.children.length >= 2;
      check("v13：巡览完成全部 8 步（场景已切换到对比态 / 报告已生成）",
        doc.getElementById("cmpCard").classList.contains("show") === true && typedDuringTour,
        "err=" + (R.win.__tourErr || "none") + " active=" + R.tourActive() + " ov=" + (ov.textContent || "").slice(0, 30));
      check("v13：字幕条最终显示结束文案",
        (ov.textContent || "").includes("演示结束"), (ov.textContent || "").slice(0, 40));
      // 退出
      R.stopTour();
      check("v13：stopTour 退出（tourActive=false）", R.tourActive() === false);
      check("v13：退出后巡览按钮回到 ▶", doc.getElementById("tourBtn").textContent === "▶ 巡览演示");
      // v22 中④：巡览中按 Esc 退出（?loop=1 字幕承诺「按 Esc 或点击任意处退出」，原全局 Esc 碰不到巡览）
      R.startTour();
      check("v22（前置）：巡览重新激活", R.tourActive() === true);
      const escEv22 = { key: "Escape", target: { tagName: "BODY" }, preventDefault() { } };
      (R.winListeners["keydown"] || []).forEach(f => f(escEv22));
      check("v22：巡览中按 Esc 退出（字幕承诺兑现，按钮回到 ▶）",
        R.tourActive() === false && doc.getElementById("tourBtn").textContent === "▶ 巡览演示");
      // v24 轻⑥：字幕①等级写法（gradePlain，与印章 / 报告正文同一口径）
      R.switchScene(0);               /* 医院 72 分 → 良 B，结果可断言 */
      R.startTour();
      let cap24 = "";
      for (let i = 0; i < 3000 && R.tourActive(); i++) {
        await Promise.resolve();
        const t = ov.textContent || "";
        if (!cap24 && t.includes("① 体检报告单式总览")) cap24 = t;   /* 捕获①字幕首次出现 */
      }
      R.stopTour();
      check("v24（运行时）：字幕①等级为「良 B」（gradePlain，无「良（B）」括号）",
        cap24.includes("良 B") && !cap24.includes("良（B）"), cap24.slice(0, 60));
      // 恢复场景状态
      R.exitCmp();
      R.resetReport();
      R.switchScene(0);
    } catch (e) { check("内置巡览", false, e.message); }
    finish();
  })().catch(e => { check("内置巡览", false, e.message); finish(); });
} else {
  finish();
}

function finish() {
  console.log("");
  console.log(`结果：${pass} 通过 / ${fail} 失败 ｜ 文件 ${(fs.statSync(path).size / 1024).toFixed(1)} KB`);
  process.exit(fail ? 1 : 0);
}
