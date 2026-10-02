/* 下载 ffmpeg（支持 Range 断点续传 + 重试） */
const https = require("https");
const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "ffmpeg.zip");
const URLS = [
  "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
  "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
];

function get(url, start, redirects) {
  return new Promise((res, rej) => {
    const opts = new URL(url);
    const req = https.request(opts, { method: start ? "GET" : "GET", headers: start ? { Range: `bytes=${start}-` } : {} }, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
        if (redirects >= 5) return rej(new Error("too many redirects"));
        return res(get(r.headers.location, start, redirects + 1));
      }
      const ok = start ? r.statusCode === 206 : r.statusCode === 200;
      if (!ok) return rej(new Error("HTTP " + r.statusCode));
      const total = parseInt(r.headers["content-length"] || "0", 10) + start;
      let got = start, last = 0;
      const f = fs.createWriteStream(out, start ? { flags: "a" } : {});
      r.on("data", c => {
        got += c.length;
        if (total && got - last > 8 * 1024 * 1024) { last = got; process.stdout.write(`  ${Math.round(got / 1048576)} / ${Math.round(total / 1048576)} MB\n`); }
      });
      r.pipe(f);
      f.on("finish", () => { f.close(); res(got); });
      f.on("error", rej);
    });
    req.on("error", rej);
    req.end();
  });
}

(async () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    const start = fs.existsSync(out) ? fs.statSync(out).size : 0;
    const url = URLS[0];
    try {
      process.stdout.write(`attempt ${attempt + 1}, resume from ${Math.round(start / 1048576)}MB\n`);
      const got = await get(url, start, 0);
      console.log("done", got);
      return;
    } catch (e) {
      console.log("  fail:", e.message);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  throw new Error("download failed");
})();
