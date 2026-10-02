/* CDP 无头 Edge 录像机：30fps 抓 JPEG 帧，按真实时间轴对齐落盘 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const DIR = __dirname;
const FRAMES = path.join(DIR, "frames");
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9223;
const TOUR_URL = "file:///D:/360MoveData/Users/46273/Desktop/DEMO/.tmp_video/tour.html?tour=1";
const FPS = 30;
const DUR_SEC = parseInt(process.env.TOUR_DUR || "68", 10);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on("error", rej);
  });
}
async function waitEndpoint(maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try { const v = await getJson(`http://127.0.0.1:${PORT}/json/version`); if (v && v.webSocketDebuggerUrl) return v; }
    catch (e) {}
    await sleep(400);
  }
  throw new Error("edge endpoint timeout");
}

(async () => {
  const child = spawn(EDGE, [
    "--headless=new", `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + path.join(DIR, "profile"),
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1280,720",
    "--autoplay-policy=no-user-gesture-required", TOUR_URL,
  ], { stdio: "ignore" });

  await waitEndpoint(20000);
  let page = null;
  for (let i = 0; i < 30; i++) {
    const list = await getJson(`http://127.0.0.1:${PORT}/json/list`);
    page = list.find(t => t.type === "page");
    if (page) break;
    await sleep(400);
  }
  if (!page) throw new Error("no page target");
  console.log("target:", page.url.slice(0, 80));

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0; const pending = new Map(); let doneFlag = false;
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const f = pending.get(m.id); pending.delete(m.id); f(m); }
    else if (m.method === "Runtime.consoleAPICalled") {
      const txt = (m.params.args || []).map(a => a.value || a.description || "").join(" ");
      if (txt.indexOf("TOUR_DONE") >= 0) doneFlag = true;
      if (txt.indexOf("TOUR_ERR") >= 0) { console.log("tour error:", txt); doneFlag = true; }
    }
  };
  function send(method, params) {
    return new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await sleep(1200);
  console.log("recording", DUR_SEC, "s @", FPS, "fps ...");
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
    } catch (e) { console.log("shot fail:", e.message); }
    if (!buf) { await sleep(60); continue; }
    const nowMs = Date.now() - start;
    const due = Math.min(Math.floor(nowMs * FPS / 1000), DUR_SEC * FPS - 1);
    while (k <= due) { fs.writeFileSync(slot(k), buf); k++; }
    const sleepTo = (k + 1) * 1000 / FPS - (Date.now() - start);
    if (sleepTo > 0) await sleep(Math.min(sleepTo, 120));
  }
  console.log("frames written:", k, "captured:", captured, "duration:", ((Date.now() - start) / 1000).toFixed(1) + "s");
  try { child.kill(); } catch (e) {}
  try { ws.close(); } catch (e) {}
  process.exit(0);
})().catch(e => { console.error("FATAL", e.message); process.exit(1); });
