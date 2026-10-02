const fs = require("fs");
const P = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\.tmp_validate.js";
let c = fs.readFileSync(P, "utf8");
const rep = [
  ['mainCode.includes("kbNode=null;\\nclearSelection();") && !mainCode.includes("if(activeDim!==null)pickDim(activeDim);"));',
   '/kbNode=null;\\s*clearSelection\\(\\);/.test(mainCode) && !mainCode.includes("if(activeDim!==null)pickDim(activeDim);"));'],
  ['mainCode.includes("clearBlkSel();") && !mainCode.includes("activeBlocker=null;clearBlkSel();"));',
   '!mainCode.includes("activeBlocker=null;clearBlkSel();") && !mainCode.includes("activeBlocker=null;clearBlkSel()"));'],
  ['mainCode.includes("if(activeDim===null&&activePhase===null&&activeBlocker===null){") &&',
   'mainCode.includes("setSelection(\\"node\\",null);") && mainCode.includes("setSelection(\\"link\\",null);") && /* 空白分支委托核心 */'],
  ['mainCode.includes(\'(activeDim!==null&&di===i)?"true":"false"\'));',
   'mainCode.includes(\'(activeDim!==null&&di===activeDim)?"true":"false"\'));'],
  ['nodeSrc.includes("clearBlkSel();clearTlSel();clearDimSel();"));',
   'nodeSrc.includes(\'setSelection("node",n,{scroll:true});\') && mainCode.slice(mainCode.indexOf("function selectLink"), mainCode.indexOf("function jumpToBlocker")).includes(\'setSelection("link",l,{scroll:true});\'));'],
  ['mainCode.includes("if(activeDim===null&&activePhase===null&&activeBlocker===null){"));',
   'mainCode.includes("function showGuide(){detail.innerHTML=DETAIL_GUIDE;}") && mainCode.includes("DETAIL_GUIDE="));'],
  ['mainCode.includes("clearBlkSel();clearTlSel();updateQuickSel();if(!fromBlkSearch)clearBlkSearch();") &&',
   '/* v32：清搜索规则收进 setSelection（非空选择才清）——对应当年前四个入口的手写行 */\n      /setSelection\\(kind,val,opts\\){[\\s\\S]{0,400}if\\(si&&si\\.value\\)/.test(mainCode) &&'],
  ['mainCode.includes("clearBlkSel();clearBlkSearch();"));',
   '/* 旧卡点 toggle 的手风琴清场行已删（委托核心） */\n      !mainCode.includes("clearBlkSel();clearBlkSearch();") && !mainCode.includes("clearBlkSel();clearTlSel();clearDimSel();")),'],
  ['mainCode.includes("function clearBlkSearch(){") &&',
   '!mainCode.includes("fromBlkSearch") && !mainCode.includes("function clearBlkSearch(){") &&'],
  ['sn.includes("clearBlkSearch();updateQuickSel();") && sn.includes("showNode(n);"));',
   'sn.includes(\'setSelection("node",n,{scroll:true});\') && !sn.includes("updateQuickSel();"));'],
  ['sl.includes("clearBlkSearch();updateQuickSel();") && sl.includes("showLink(l);"));',
   'sl.includes(\'setSelection("link",l,{scroll:true});\') && !sl.includes("updateQuickSel();"));'],
  ['mainCode.includes("if(activePhase!==null){fromBlkSearch=true;try{pickPhase(activePhase);}finally{fromBlkSearch=false;}}") &&',
   '!mainCode.includes("fromBlkSearch") && /* v32：互斥清场走 setSelection(*,null) */\n      /if\\(activeDim!==null\\)setSelection\\(\\"dim\\",null\\)/.test(mainCode) &&'],
  ['mainCode.includes("if(activeBlocker!==null||selNode||selLink){\\n        activeBlocker=null;selNode=null;selLink=null;\\n        clearBlkSel();updateQuickSel();\\n        $(\\"netHint\\").classList.remove(\\"show\\");\\n        detail.innerHTML=`<h3>诊断详情</h3><div class=\\"empty\\">点击总览五维、时间轴阶段、网络中的主体或关系、或下方卡点，在此查看结构化诊断。</div>`;\\n        wake();"));',
   '/* v32：wake 唯一出口在 applySelection——手写分支漏 wake 成为结构上的不可能事件 */\n      (()=>{const i=mainCode.indexOf("function applySelection(");const j=mainCode.indexOf("function clearSelection(");const body=mainCode.slice(i,j);return body.includes("wake();")&&body.includes("showGuide();")&&body.includes("updateQuickSel();")&&body.includes("renderDimDetail(");})());'],
  ['(mainCode.match(/scrollDetailNarrow\\(\\);/g) || []).length === 5 &&',
   '/* v32：五个选中入口向核心传 scroll，核心内按当前态决定是否窄屏入镜 */\n      (()=>{const i=mainCode.indexOf("function applySelection(");const j=mainCode.indexOf("function clearSelection(");const body=mainCode.slice(i,j);return (body.match(/scrollDetailNarrow\\(\\);/g)||[]).length===5;})() &&'],
  ['for (const fn of ["pickDim", "pickPhase", "selectNode", "selectLink", "runBlkSearch", "buildBlockerEl"]) {',
   'for (const fn of ["setSelection", "applySelection"]) {'],
];
let n = 0;
for (const [a, b] of rep) {
  if (!c.includes(a)) { console.log("MISS:", a.slice(0, 60).replace(/\n/g, "\\n")); continue; }
  c = c.replace(a, b);
  n++;
}
fs.writeFileSync(P, c);
console.log("replaced", n, "/", rep.length);
