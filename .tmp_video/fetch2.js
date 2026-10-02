/* 从 BtbN github 下载 ffmpeg zip */
const https = require("https");
const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "gh.zip");

function get(url, redirects) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode)) {
        if (redirects >= 5) return rej(new Error("too many redirects"));
        return res(get(r.headers.location, redirects + 1));
      }
      if (r.statusCode !== 200) return rej(new Error("HTTP " + r.statusCode));
      const total = parseInt(r.headers["content-length"] || "0", 10);
      let got = 0, last = 0;
      const f = fs.createWriteStream(out);
      r.on("data", c => {
        got += c.length;
        if (total && got - last > 16 * 1024 * 1024) { last = got; console.log(`  ${Math.round(got / 1048576)} / ${Math.round(total / 1048576)} MB`); }
      });
      r.pipe(f);
      f.on("finish", () => { f.close(); console.log("done " + got); res(); });
      f.on("error", rej);
    }).on("error", rej);
  });
}

get("https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip", 0)
  .catch(e => { console.error("fail:", e.message); process.exit(1); });
