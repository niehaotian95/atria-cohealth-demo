const fs = require("fs");
const a = fs.readFileSync("Atria-协同体检中心-v31.html", "utf8");
const b = fs.readFileSync("演示视频工具/tour.html", "utf8");
const an = 'try{if(/[?&]tour=1/.test((location||{}).search||""))startTour();}catch(e){}';
const fo = 'startTour();   /* 巡览版：双击即自动播放（?loop=1 循环） */';
console.log("anchor in v31:", a.includes(an));
console.log("force in tour:", b.includes(fo));
console.log("normalized identical:", a.replace(an, "@@@") === b.replace(fo, "@@@"));
