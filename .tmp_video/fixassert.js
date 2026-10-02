const fs = require("fs");
const P = "D:\\360MoveData\\Users\\46273\\Desktop\\DEMO\\.tmp_validate.js";
let c = fs.readFileSync(P, "utf8");
const rep = [
  // L928 v14 Esc：改为钉 clearSelection（行为由不变量网与下方 Esc 行为检查覆盖）
  ['check("v14：Esc 连维度过滤一起清", mainCode.includes("if(activeDim!==null)pickDim(activeDim)"));',
   'check("v14/v32：Esc 走 clearSelection()（canvas 段与 window 段同一出口，不再逐态手写、不留半亮态）",\n    mainCode.includes("kbNode=null;\\nclearSelection();") && !mainCode.includes("if(activeDim!==null)pickDim(activeDim);"));'],
  // L992 v15 Esc 卡点：同上合并
  ['check("v15：Esc 同时清卡点选中/展开态", mainCode.includes("activeBlocker=null;clearBlkSel();"));',
   'check("v15/v32：Esc 清卡点收进 applySelection（clearBlkSel 由核心调用，Esc 处理器不再直写）",\n    mainCode.includes("clearBlkSel();") && !mainCode.includes("activeBlocker=null;clearBlkSel();"));'],
  // L1123 v17 pointerUp 空白分支源码：改钉委托
  ['check("v17：pointerUp 空白分支源码（复位详情面板，与 Esc 路径统一；v22：有过滤/联动时保留其说明）",',
   'check("v17/v32：pointerUp 空白分支委托 setSelection（清 node/link，其余过滤器与说明由核心保留）",'],
  // L1163 v18 pickDim 按下态源码：换为钉 applySelection 的按下态表
  ['check("v18：pickDim 按下态源码带 activeDim 保护",',
   'check("v18/v32：applySelection 按下态带 activeDim 保护（取消过滤连按下态一起清）",'],
  // L1652 v22 selectNode 收尾 clearDimSel（误报核实）：换为钉委托
  ['check("v22：selectNode 收尾含 clearDimSel（与 selectLink 同口径——本轮挑刺条目核实为误报）",',
   'check("v22/v32：selectNode / selectLink 均为 setSelection 委托（「误报核实」的口径差由核心根除）",'],
  // L1676 v22 pointerUp 空白保留 netHint：行为由不变量网覆盖，改为钉核心 else 分支
  ['check("v22：pointerUp 空白分支有过滤器时保留 netHint（源码）",',
   'check("v22/v32：applySelection 按当前态渲染 netHint（空白点击有过滤时保留说明）",'],
  // L1923 v24 四入口 clearBlkSearch
  ['check("v24：pickDim / pickPhase / selectNode / 卡点点击四个入口都调 clearBlkSearch",',
   'check("v24/v32：清搜索收进 setSelection（非空选择才清），五个入口共享同一规则",'],
  // L1928 v24 清搜索助手 + fromBlkSearch
  ['check("v24：清搜索助手 + 输入路径反清保护（clearBlkSearch / fromBlkSearch）",',
   'check("v24/v32：fromBlkSearch 护卫已删（null 转换从不清搜索，搜索互斥清场走 null 路径）",'],
  // L1972 v25 selectNode updateQuickSel
  ['check("v25：selectNode 收尾补 updateQuickSel（快捷按钮随选中态亮起 / 随取消熄灭）",',
   'check("v25/v32：updateQuickSel 唯一调用点在 applySelection（快捷按钮选中态不再散落各入口）",'],
  // L1976 v25 selectLink
  ['check("v25：selectLink 收尾补 updateQuickSel + clearBlkSearch（第五个选择入口同口径）",',
   'check("v25/v32：selectLink 同为 setSelection 委托（第五入口与四个入口同口径成为结构保证）",'],
  // L2100 v26 runBlkSearch 反向
  ['check("v26：runBlkSearch 输入时清阶段 / 卡点 / 主体（与 v24 反向口径对称）",',
   'check("v26/v32：runBlkSearch 互斥清场走 setSelection(*,null)（与 v24 反向对称成为结构保证）",'],
  // L2204 v27 wake
  ['check("v27：搜索清选分支补 wake()（暂停画布按清空状态重绘一帧，消除位图残留选中圈）",',
   'check("v27/v32：wake() 唯一出口在 applySelection（手写分支漏 wake 成为本结构的不可能事件）",'],
  // L2215 v27 五入口 scrollDetailNarrow
  ['check("v27：五个选中入口均调 scrollDetailNarrow（窄屏详情随选中入镜，与风险速览同款）",',
   'check("v27/v32：五个选中入口向 setSelection 传 scroll（核心内按当前态决定是否窄屏入镜）",'],
];
let n = 0;
for (const [a, b] of rep) {
  if (!c.includes(a)) { console.log("MISS:", a.slice(0, 50)); continue; }
  c = c.replace(a, b);
  n++;
}
fs.writeFileSync(P, c);
console.log("replaced", n, "/", rep.length);
