/* 从 chocolatey 下载 ffmpeg nupkg（断点续传 + 重试） */
const https = require("https");
const fs = require("fs");
const path = require("path");
const out = path.join(__dirname, "ffmpeg.nupkg");

function get(url, start, redirects) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const req = https.request(u, { headers: start ? { Range: `bytes=${start}-` } : {} }, r => {
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
        if (total && got - last > 20 * 1024 * 1024) { last = got; console.log(`  ${Math.round(got / 1048576)} / ${Math.round(total / 1048576)} MB`); }
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
  const URL0 = "https://community.chocolatey.org/api/v2/package/ffmpeg/";
  for (let a = 0; a < 40; a++) {
    const start = fs.existsSync(out) ? fs.statSync(out).size : 0;
    try {
      process.stdout.write(`attempt ${a + 1} from ${Math.round(start / 1048576)}MB\n`);
      const got = await get(URL0, start, 0);
      console.log("DONE", got);
      return;
    } catch (e) {
      console.log("  fail:", e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  process.exit(1);
})();
