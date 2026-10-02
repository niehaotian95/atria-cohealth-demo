const fs = require("fs");
const a = fs.readFileSync("Atria-协同体检中心-v31.html", "utf8");
const b = fs.readFileSync("演示视频工具/tour.html", "utf8");
const an = 'try{if(/[?&]tour=1/.test((location||{}).search||""))startTour();}catch(e){}';
const fo = 'startTour();   /* 巡览版：双击即自动播放（?loop=1 循环） */';
const A = a.replace(an, "@@@");
const B = b.replace(fo, "@@@");
console.log("len A/B:", A.length, B.length);
for (let i = 0; i < Math.min(A.length, B.length); i++) {
  if (A[i] !== B[i]) {
    console.log("first diff at", i);
    console.log("A:", JSON.stringify(A.slice(Math.max(0, i - 80), i + 80)));
    console.log("B:", JSON.stringify(B.slice(Math.max(0, i - 80), i + 80)));
    break;
  }
}
