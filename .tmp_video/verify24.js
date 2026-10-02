const fs = require("fs");
const v = fs.readFileSync("Atria-协同体检中心-v24.html", "utf8");
const t = fs.readFileSync("演示视频工具/tour.html", "utf8");
const anchor = 'try{if(/[?&]tour=1/.test((location||{}).search||""))startTour();}catch(e){}';
const force = 'startTour();   /* 巡览版：双击即自动播放（?loop=1 循环） */';
const vNorm = v.replace(anchor, "@@@");
const tNorm = t.replace(force, "@@@");
console.log("v24 anchor present:", v.includes(anchor));
console.log("tour force line present:", t.includes(force));
console.log("identical after normalization:", vNorm === tNorm);
if (vNorm !== tNorm) {
  // 找第一处差异
  const n = Math.min(vNorm.length, tNorm.length);
  let i = 0;
  for (; i < n; i++) if (vNorm[i] !== tNorm[i]) break;
  console.log("first diff at", i, "context:", JSON.stringify(vNorm.slice(Math.max(0, i - 60), i + 60)));
}
console.log("使用说明 v24 refs:", fs.readFileSync("演示视频工具/使用说明.md", "utf8").includes("v24.html"));
console.log("make-tour SRC v24:", fs.readFileSync(".tmp_video/make-tour.js", "utf8").includes("v24.html"));
