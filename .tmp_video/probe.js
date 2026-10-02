const https = require("https");
function sp(u, red) {
  if (red >= 5) return Promise.resolve("redirects");
  return new Promise(res => {
    const t = Date.now();
    https.get(u, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) return res(sp(r.headers.location, red + 1));
      let n = 0;
      r.on("data", c => { n += c.length; if (n > 3 * 1048576) { r.destroy(); res((n / (Date.now() - t) * 1000 / 1024 / 1024).toFixed(1) + " MB/s"); } });
      r.on("end", () => res(n + "B ended HTTP" + r.statusCode));
    }).on("error", e => res("ERR " + e.message));
  });
}
(async () => {
  console.log("choco:", await sp("https://community.chocolatey.org/api/v2/package/ffmpeg/"));
  console.log("ffbinaries-api:", await sp("https://ffbinaries.com/api/v1/version/5.1.2"));
})();
