const fs = require("fs");
const P = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\.tmp_validate.js";
let c = fs.readFileSync(P, "utf8");
const rep = [
  // v17 pointerUp：去掉遗留的旧字符串条件
  ['      mainCode.includes("setSelection(\\"node\\",null);") && mainCode.includes("setSelection(\\"link\\",null);") && /* 空白分支委托核心 */\n      mainCode.slice(mainCode.indexOf("function pointerUp"), mainCode.indexOf("canvas.addEventListener(\\"mousedown\\"")).includes("点击总览五维"));',
   '      mainCode.slice(mainCode.indexOf("function pointerUp"), mainCode.indexOf("canvas.addEventListener(\\"mousedown\\"")).includes(\'setSelection("node",null);\') &&\n      mainCode.includes("DETAIL_GUIDE=") && !mainCode.includes("activeDim===null&&activePhase===null&&activeBlocker===null){"));'],
  // v24 清搜索：删掉两行遗留旧条件
  ['      /setSelection\\(kind,val,opts\\){[\\s\\S]{0,400}if\\(si&&si\\.value\\)/.test(mainCode) &&\n      mainCode.includes("clearBlkSel();updateQuickSel();clearDimSel();if(!fromBlkSearch)clearBlkSearch();") &&   /* v26：pickPhase 补 fromBlkSearch 保护（输入路径的互斥清阶段不反清搜索框），子串随实现漂移 */\n      mainCode.includes("clearBlkSel();clearTlSel();clearDimSel();clearBlkSearch();") &&',
   '      /setSelection\\(kind,val,opts\\){[\\s\\S]{0,700}if\\(si&&si\\.value\\)/.test(mainCode) &&'],
  // v24 fromBlkSearch：删掉遗留的反向条件
  ['      !mainCode.includes("fromBlkSearch") && !mainCode.includes("function clearBlkSearch(){") &&\n      mainCode.includes("fromBlkSearch=true;try{pickDim(activeDim);}finally{fromBlkSearch=false;}"));',
   '      !mainCode.includes("fromBlkSearch") && !mainCode.includes("function clearBlkSearch(){") &&\n      !mainCode.includes("let fromBlkSearch="));'],
  // v26：删掉两行遗留旧条件
  ['      /if\\(activeDim!==null\\)setSelection\\(\\"dim\\",null\\)/.test(mainCode) &&\n      mainCode.includes("activeBlocker=null;selNode=null;selLink=null;") &&\n      mainCode.includes("clearBlkSel();updateQuickSel();"));',
   '      /if\\(activeDim!==null\\)setSelection\\(\\"dim\\",null\\)/.test(mainCode) &&\n      /if\\(activeBlocker!==null\\|\\|selNode\\|\\|selLink\\)/.test(mainCode) && /* v26 互斥清场仍在，但分支体是 setSelection 调用 */\n      !mainCode.includes("activeBlocker=null;selNode=null;selLink=null;"));'],
  // v27 scroll：删掉遗留旧条件
  ['      (()=>{const i=mainCode.indexOf("function applySelection(");const j=mainCode.indexOf("function clearSelection(");const body=mainCode.slice(i,j);return (body.match(/scrollDetailNarrow\\(\\);/g)||[]).length===5;})() &&\n      mainCode.includes("showNode(n);\\n  wake();\\n  scrollDetailNarrow();"));',
   '      (()=>{const i=mainCode.indexOf("function applySelection(");const j=mainCode.indexOf("function clearSelection(");const body=mainCode.slice(i,j);return (body.match(/scrollDetailNarrow\\(\\);/g)||[]).length===5;})() &&\n      mainCode.includes(\'setSelection("dim",was?null:i,{scroll:true});\') && !mainCode.includes("scrollDetailNarrow();\\n  wake();"));'],
  // wake 作用域：setSelection 不含 wake（它在 applySelection 里）——清单只留 applySelection
  ['for (const fn of ["setSelection", "applySelection"]) {',
   'for (const fn of ["applySelection"]) {'],
];
let n = 0;
for (const [a, b] of rep) {
  if (!c.includes(a)) { console.log("MISS:", JSON.stringify(a.slice(0, 70))); continue; }
  c = c.replace(a, b);
  n++;
}
fs.writeFileSync(P, c);
console.log("replaced", n, "/", rep.length);
