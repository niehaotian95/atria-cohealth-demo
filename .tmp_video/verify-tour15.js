const fs = require("fs");
const h = fs.readFileSync("演示视频工具/tour.html", "utf8");
console.log("force:", h.includes("startTour();   /* 巡览版"));
console.log("toast-outside-kbdhelp:", h.indexOf('id="sayToast"') < h.indexOf('id="kbdHelp"'));
console.log("hollow-cmp:", h.includes("border:1.5px solid var(--dim1)"));
console.log("coach-hidden-on-tour:", h.includes("cp.hidden=true"));
console.log("no-template-jargon:", !h.includes("模板不改版"));
console.log("kbd-guard:", h.includes('e.target.tagName==="BUTTON"'));
