/* 一键演示视频录制（在正常 Windows 环境运行，请勿在沙箱里跑）
 * 1. 启动 Chrome/Edge（headless）打开 tour.html 自动巡览
 * 2. CDP 30fps 截帧（按真实时间轴对齐）
 * 3. 调用同目录 ffmpeg.exe 编码为视频
 */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, execFileSync } = require("child_process");

const DIR = __dirname;
const FPS = 30;
const DUR_SEC = 96;                      // 巡览约 75s（v14 含 finishTyping 直出全文）+ 收尾余量
const OUT_MP4 = path.join(DIR, "Atria-协同体检中心-演示视频.mp4");
const OUT_WEBM = path.join(DIR, "Atria-协同体检中心-演示视频.webm");
const TOUR = path.join(DIR, "tour.html");
const FF = path.join(DIR, "ffmpeg.exe");
const FRAMES = path.join(DIR, "frames");
const PROFILE = path.join(DIR, "profile");

function log(...a) { console.log(...a); }
function fail(m) { console.error("【错误】" + m); process.exit(1); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }
function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on("error", rej);
  });
}

/* 浏览器候选（顺序：Chrome 用户安装 > Edge） */
const CANDIDATES = [
  path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const BROWSER = CANDIDATES.find(p => fs.existsSync(p));
if (!BROWSER) fail("未找到 Chrome 或 Edge，请先安装其一。");
if (!fs.existsSync(FF)) fail("缺少同目录 ffmpeg.exe。");
if (!fs.existsSync(TOUR)) fail("缺少同目录 tour.html。");
if (typeof WebSocket === "undefined") fail("Node 版本过低（需要 22+，内置 WebSocket）。");

log("浏览器：" + BROWSER);

(async () => {
  /* 清理上次产物 */
  rmrf(FRAMES); rmrf(PROFILE);
  fs.mkdirSync(FRAMES, { recursive: true });

  /* 选一个能用的调试端口 */
  let child = null, page = null, port = 0;
  for (const p of [9922, 9933, 9944, 9955, 9966, 9977]) {
    port = p;
    const url = "file:///" + TOUR.replace(/\\/g, "/") + "?tour=1";
    child = spawn(BROWSER, [
      "--headless=new", `--remote-debugging-port=${port}`,
      "--user-data-dir=" + PROFILE,
      "--no-first-run", "--no-default-browser-check", "--disable-extensions",
      "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1280,720",
      "--autoplay-policy=no-user-gesture-required", url,
    ], { stdio: "ignore" });
    try {
      await Promise.race([
        (async () => { while (true) { try { const v = await getJson(`http://127.0.0.1:${port}/json/version`); if (v) return; } catch (e) {} await sleep(400); } })(),
        sleep(15000).then(() => { throw new Error("port timeout"); }),
      ]);
      for (let i = 0; i < 40; i++) {
        const list = await getJson(`http://127.0.0.1:${port}/json/list`);
        page = (list || []).find(t => t.type === "page");
        if (page) break;
        await sleep(400);
      }
    } catch (e) { /* 端口不可用，杀掉试下一个 */ }
    if (page) break;
    try { child.kill(); } catch (e) {}
    rmrf(PROFILE);
    child = null; page = null;
  }
  if (!page) fail("无法启动浏览器的 CDP 调试端口（约 30s）。请确认没有安全软件拦截。");

  log("CDP 端口就绪：" + port);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0; const pending = new Map(); let doneFlag = false;
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const f = pending.get(m.id); pending.delete(m.id); f(m); }
    else if (m.method === "Runtime.consoleAPICalled") {
      const txt = (m.params.args || []).map(a => a.value || a.description || "").join(" ");
      if (txt.indexOf("TOUR_DONE") >= 0) doneFlag = true;
      if (txt.indexOf("TOUR_ERR") >= 0) { log("巡览脚本报错：" + txt); doneFlag = true; }
    }
  };
  function send(method, params) {
    return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await sleep(1500);
  log("开始截帧（" + DUR_SEC + "s @ " + FPS + "fps）……");
  const start = Date.now();
  let k = 0, captured = 0;
  const slot = i => path.join(FRAMES, "f" + String(i + 1).padStart(7, "0") + ".jpg");

  while (true) {
    const elapsed = Date.now() - start;
    if (elapsed > DUR_SEC * 1000) break;
    if (doneFlag && elapsed > 2500) break;
    let buf = null;
    try {
      const r = await send("Page.captureScreenshot", { format: "jpeg", quality: 86 });
      buf = Buffer.from(r.result.data, "base64");
      captured++;
    } catch (e) {}
    if (!buf) { await sleep(60); continue; }
    const nowMs = Date.now() - start;
    const due = Math.min(Math.floor(nowMs * FPS / 1000), DUR_SEC * FPS - 1);
    while (k <= due) { fs.writeFileSync(slot(k), buf); k++; }
    const sleepTo = (k + 1) * 1000 / FPS - (Date.now() - start);
    if (sleepTo > 0) await sleep(Math.min(sleepTo, 120));
  }
  log("截帧完成：" + k + " 帧（截图 " + captured + " 次），耗时 " + ((Date.now() - start) / 1000).toFixed(1) + "s");
  try { ws.close(); } catch (e) {}
  try { child.kill(); } catch (e) {}
  await sleep(800);

  /* 探测编码能力：优先 H264/MP4，回退 VP8/WebM */
  let encInfo = "";
  try { encInfo = execFileSync(FF, ["-hide_banner", "-encoders"], { encoding: "utf8" }); } catch (e) {}
  const has264 = /libx264/.test(encInfo);
  const out = has264 ? OUT_MP4 : OUT_WEBM;
  const encArgs = has264
    ? ["-y", "-framerate", String(FPS), "-i", path.join(FRAMES, "f%07d.jpg"),
       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
       "-movflags", "+faststart", out]
    : ["-y", "-framerate", String(FPS), "-i", path.join(FRAMES, "f%07d.jpg"),
       "-c:v", "libvpx", "-b:v", "1.6M", "-pix_fmt", "yuv420p", out];
  log("编码中（" + (has264 ? "H264 → MP4" : "VP8 → WebM") + "）……");
  const enc = spawn(FF, encArgs, { stdio: "inherit" });
  await new Promise(res => { enc.on("exit", res); enc.on("error", () => { log("ffmpeg 启动失败"); res(); }); });
  rmrf(FRAMES);
  if (fs.existsSync(out)) {
    log("✅ 完成：" + out);
    log("   大小 " + Math.round(fs.statSync(out).size / 1048576) + " MB");
  } else {
    fail("编码失败。帧图保留在 " + FRAMES + "，可手动编码。");
  }
  process.exit(0);
})().catch(e => fail(e.message));
