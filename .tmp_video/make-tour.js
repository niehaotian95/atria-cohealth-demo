/* 用 v13 生成演示录像用的 tour.html
 * v13 起巡览脚本已内置主文件：此处只做复制 + 强制自动播放（双击即播）+ 可选 ?loop=1 */
const fs = require("fs");
const path = require("path");
const SRC = path.join(__dirname, "..", "Atria-协同体检中心-v31.html");
const DST = path.join(__dirname, "tour.html");

let html = fs.readFileSync(SRC, "utf8");
if (!html.includes("</body>")) throw new Error("no body close");
const anchor = 'try{if(/[?&]tour=1/.test((location||{}).search||""))startTour();}catch(e){}';
if (!html.includes(anchor)) throw new Error("tour autostart anchor missing");
html = html.replace(anchor, 'startTour();   /* 巡览版：双击即自动播放（?loop=1 循环） */');
fs.writeFileSync(DST, html, "utf8");
console.log("tour.html written:", fs.statSync(DST).size, "bytes");
