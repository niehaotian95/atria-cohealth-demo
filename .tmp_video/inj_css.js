/* 注入 v13 CSS（theme-btn 起始锚点后追加，保留原声明起点） */
const fs = require("fs");
const PATH = "../Atria-协同体检中心-v13.html";
let h = fs.readFileSync(PATH, "utf8");
const anchor = "  .theme-btn{position:absolute;top:18px;right:26px;z-index:3;background:var(--paper);";
if (!h.includes(anchor)) throw new Error("theme-btn anchor missing");
if (h.includes(".tour-btn{")) throw new Error("already injected");
const css = fs.readFileSync("css_v13.css", "utf8");
h = h.replace(anchor, anchor + "\n" + css);
fs.writeFileSync(PATH, h, "utf8");
console.log("css injected, size:", fs.statSync(PATH).size);
