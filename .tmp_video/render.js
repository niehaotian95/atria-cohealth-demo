/* 演示视频渲染器：8 幕 × 10 秒 @10fps，768x448，输出拼接 MJPEG 供 ffmpeg 编码 webm
 * 数据直接取自 v30 源码（真实演示数据，非手编） */
"use strict";
const fs = require("fs");
const { openFont, drawText, measure, pickFont } = require("./font.js");
const { encodeRGBA } = require("./jpeg.js");

const W = 768, H = 448, FPS = 10, SLIDE_SEC = 10;
const FONT = openFont(pickFont());
const FONT_B = openFont("C:\\Windows\\Fonts\\msyhbd.ttc");   /* 粗体 */

/* 从 v30 提取真实数据 */
const html = fs.readFileSync("../Atria-协同体检中心-v30.html", "utf8");
const m = html.match(/const\s+DEFAULT_DATA=\{[\s\S]*?\n\};/);
if (!m) throw new Error("DEFAULT_DATA not found");
const DATA = eval("(" + m[0].slice(m[0].indexOf("=") + 1, m[0].length - 1) + ")");
const S2M = html.match(/const\s+SCENARIOS=\[[\s\S]*?\n\];/);
let SCEN = [];
if (S2M) { SCEN = eval("(" + S2M[0].slice(S2M[0].indexOf("=") + 1, S2M[0].length - 1) + ")"); }
console.log("scenes:", 1 + SCEN.length, "total:", DATA.total);

const C = {
  navy: [28, 41, 64], navy2: [36, 53, 82], ink: [26, 32, 44], paper: [246, 244, 236],
  line: [214, 210, 198], blue: [43, 86, 184], blueD: [30, 58, 130],
  red: [198, 62, 55], amber: [212, 144, 32], green: [38, 130, 90],
  gray: [122, 128, 138], muted: [150, 156, 166], white: [255, 255, 255],
};
const DIM_COLORS = [[43, 86, 184], [38, 130, 90], [212, 144, 32], [122, 88, 168], [198, 62, 55]];

function Canvas() {
  this.buf = new Uint8ClampedArray(W * H * 4);
  this.clear = (c) => { for (let i = 0; i < W * H; i++) { const p = i * 4; this.buf[p] = c[0]; this.buf[p + 1] = c[1]; this.buf[p + 2] = c[2]; this.buf[p + 3] = 255; } };
  this.rect = (x, y, w, h, c) => {
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) {
        const p = (yy * W + xx) * 4;
        this.buf[p] = c[0]; this.buf[p + 1] = c[1]; this.buf[p + 2] = c[2]; this.buf[p + 3] = 255;
      }
  };
  this.frame = (x, y, w, h, c, lw) => {
    this.rect(x, y, w, lw, c); this.rect(x, y + h - lw, w, lw, c);
    this.rect(x, y, lw, h, c); this.rect(x + w - lw, y, lw, h, c);
  };
  this.text = (x, y, str, size, color, font) => drawText(font || FONT, this.buf, W, H, str, x, y, size, color);
  this.textc = (cx, y, str, size, color, font) => {
    const w = measure(font || FONT, str, size).width;
    return this.text(Math.round(cx - w / 2), y, str, size, color, font);
  };
  this.bar = (x, y, w, h, frac, c) => { this.rect(x, y, w, h, [232, 228, 218]); this.rect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h, c); };
  this.disc = (cx, cy, r, c) => {
    for (let yy = Math.max(0, cy - r); yy <= Math.min(H - 1, cy + r); yy++)
      for (let xx = Math.max(0, cx - r); xx <= Math.min(W - 1, cx + r); xx++) {
        const dx = xx - cx, dy = yy - cy;
        if (dx * dx + dy * dy <= r * r) { const p = (yy * W + xx) * 4; this.buf[p] = c[0]; this.buf[p + 1] = c[1]; this.buf[p + 2] = c[2]; this.buf[p + 3] = 255; }
      }
  };
  this.ring = (cx, cy, r, c, lw) => {
    for (let yy = Math.max(0, cy - r - lw); yy <= Math.min(H - 1, cy + r + lw); yy++)
      for (let xx = Math.max(0, cx - r - lw); xx <= Math.min(W - 1, cx + r + lw); xx++) {
        const dx = xx - cx, dy = yy - cy, d2 = dx * dx + dy * dy;
        if (d2 <= (r + lw) * (r + lw) && d2 >= (r - lw) * (r - lw)) { const p = (yy * W + xx) * 4; this.buf[p] = c[0]; this.buf[p + 1] = c[1]; this.buf[p + 2] = c[2]; this.buf[p + 3] = 255; }
      }
  };
  this.line = (x0, y0, x1, y1, c, thick) => {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
      this.rect(x - thick + 1, y - thick + 1, thick * 2 - 1, thick * 2 - 1, c);
    }
  };
}

/* ---------- 幕定义：draw(cv, t) t=0..1 ---------- */
const dimN = DATA.dims.length;
const seal = (cv, x, y, txt, sub) => {   /* 印章 */
  cv.frame(x, y, 74, 74, C.red, 3);
  cv.textc(x + 37, y + 12, txt, 30, C.red, FONT_B);
  cv.textc(x + 37, y + 48, sub, 13, C.red);
};
const subBar = (cv, txt) => {            /* 字幕条 */
  cv.rect(0, H - 46, W, 46, [17, 25, 40]);
  return txt;
};

const slides = [
  /* ① 封面 */
  {
    title: "封面",
    draw(cv, t) {
      cv.clear(C.navy);
      cv.rect(0, 0, W, 6, C.blue);
      cv.textc(W / 2, 74, "协同体检中心", 58, C.white, FONT_B);
      cv.textc(W / 2, 152, "代建制公共工程 · 跨组织协同诊断沙盘", 22, [196, 204, 220]);
      cv.textc(W / 2, 186, "单文件离线运行 · 五维体检 · 卡点分诊 · 一键复盘", 15, [140, 150, 168]);
      const cx = W / 2, cy = 296;
      cv.ring(cx, cy, 58, C.blue, 2);
      cv.disc(cx, cy, 55, C.navy2);
      cv.textc(cx, cy - 26, String(DATA.total), 62, C.white, FONT_B);
      cv.textc(cx, cy + 26, "综合评分 · 良 B", 16, [196, 204, 220]);
      /* 五维色带 */
      const bw = 80, gap = 14, x0 = (W - (bw * dimN + gap * (dimN - 1))) / 2;
      DATA.dims.forEach((d, i) => {
        const x = x0 + i * (bw + gap);
        cv.rect(x, 392, bw, 5, DIM_COLORS[i]);
        cv.textc(x + bw / 2, 374, d.n, 12, [196, 204, 220]);
      });
    },
    sub: "把「谁和谁卡在一起」这件事，变成一张可以打印、可以对比、可以复盘的体检报告。",
  },
  /* ② 报告单总览 */
  {
    title: "体检总览",
    draw(cv, t) {
      cv.clear(C.paper);
      cv.rect(0, 0, W, 54, C.navy);
      cv.text(24, 14, "协同体检报告单", 22, C.white, FONT_B);
      cv.text(24, 36, DATA.meta.project + " · " + DATA.meta.mode, 11, [196, 204, 220]);
      cv.text(W - 210, 18, "报告编号 HYB-2026-0601", 11, [196, 204, 220]);
      cv.text(W - 210, 36, "签发日期 2026-06", 11, [196, 204, 220]);
      /* 左侧大分 */
      cv.rect(20, 70, 200, 300, C.white);
      cv.frame(20, 70, 200, 300, C.line, 1);
      cv.textc(120, 92, "综合评分", 14, C.gray);
      cv.textc(120, 116, String(DATA.total), 88, C.navy, FONT_B);
      cv.textc(120, 212, "良 B 级", 22, C.blueD, FONT_B);
      cv.textc(120, 246, "上次 " + DATA.prev.date.slice(0, 7) + "：" + DATA.prev.total + " 分", 12, C.gray);
      cv.rect(70, 280, 100, 26, C.green);
      cv.textc(120, 287, "环比 +5 分", 14, C.white, FONT_B);
      seal(cv, 140, 318, "良", "B 级");
      /* 右侧五维 */
      const x = 240, w = 508, rh = 54;
      DATA.dims.forEach((d, i) => {
        const y = 70 + i * (rh + 8);
        cv.rect(x, y, w, rh, C.white);
        cv.frame(x, y, w, rh, C.line, 1);
        cv.rect(x, y, 5, rh, DIM_COLORS[i]);
        cv.text(x + 16, y + 8, d.n, 16, C.ink, FONT_B);
        const prev = DATA.prev.dims[i];
        const dlt = d.v - prev;
        const dcol = dlt > 0 ? C.green : dlt < 0 ? C.red : C.gray;
        const dstr = dlt > 0 ? "▲ +" + dlt : dlt < 0 ? "▼ " + dlt : "— 持平";
        cv.text(x + 430, y + 10, String(d.v), 26, d.v >= 75 ? DIM_COLORS[i] : d.v >= 65 ? C.amber : C.red, FONT_B);
        cv.text(x + 452, y + 12, dstr, 13, dcol);
        cv.bar(x + 118, y + 30, 300, 12, d.v / 100 * (0.25 + 0.75 * Math.min(1, t * 1.5)), DIM_COLORS[i]);
        cv.text(x + 16, y + 32, "上次 " + prev, 11, C.muted);
      });
    },
    sub: "五维评分对照上期复查：权责清晰度从 66 升到 68，审批效率仍在 61 分以下，是本期的干预重点。",
  },
  /* ③ 卡点分诊 */
  {
    title: "卡点分诊",
    draw(cv, t) {
      cv.clear(C.paper);
      cv.rect(0, 0, W, 50, C.navy);
      cv.text(24, 13, "卡点分诊 · " + DATA.blockers.length + " 项风险与责任主体", 20, C.white, FONT_B);
      const groups = [["高", C.red], ["中", C.amber]];
      let gx = 24;
      for (const [g, col] of groups) {
        const items = DATA.blockers.filter(b => b.sev === g);
        const cw = 358;
        cv.rect(gx, 64, cw, 40, col);
        cv.text(gx + 14, 76, g + " 风险 · " + items.length + " 项", 18, C.white, FONT_B);
        let y = 116;
        for (const b of items) {
          cv.rect(gx, y, cw, 132, C.white);
          cv.frame(gx, y, cw, 132, C.line, 1);
          cv.rect(gx, y, cw, 4, col);
          cv.text(gx + 14, y + 12, b.t, 18, C.ink, FONT_B);
          const orgs = b.orgs.map(id => (DATA.orgs.find(o => o.id === id) || {}).short || id).join(" · ");
          cv.text(gx + 14, y + 40, "责任主体：" + orgs, 12, C.gray);
          /* 证据按进度裁显 */
          const ev = b.ev.length > 34 ? b.ev.slice(0, 32) + "…" : b.ev;
          cv.text(gx + 14, y + 62, "证据：" + ev, 11, C.muted);
          /* 处方条 */
          cv.rect(gx + 14, y + 96, cw - 28, 26, [238, 240, 246]);
          cv.text(gx + 24, y + 101, "▶ " + b.fix.slice(0, 18) + (b.fix.length > 18 ? "…" : ""), 11, C.blueD);
          y += 148;
        }
        gx += 382;
      }
      /* 底部箭头提示 */
      cv.rect(24, H - 118, W - 48, 52, [235, 238, 244]);
      cv.text(40, H - 106, "▲ 每张卡可点击直达「归因维度」，定位是哪一维在拖后腿。", 14, C.blueD, FONT_B);
      cv.text(40, H - 84, "卡点不是清单，而是分诊台：先分级，再归因，最后给处方。", 13, C.gray);
    },
    sub: "点「信息不对称」归因到信息通畅度；点「时序依赖」归因到审批效率——卡点与维度一一对应。",
  },
  /* ④ 关系网络 */
  {
    title: "关系网络",
    draw(cv, t) {
      cv.clear([243, 245, 247]);
      cv.rect(0, 0, W, 46, C.navy);
      cv.text(24, 12, "跨组织协同关系网络 · 连线颜色=健康度", 18, C.white, FONT_B);
      const N = DATA.orgs;
      const R = 132, cx = W / 2 - 60, cy = 250;
      const pos = N.map((o, i) => {
        const ang = -Math.PI / 2 + i * 2 * Math.PI / N.length;
        return [cx + Math.cos(ang) * R, cy + Math.sin(ang) * R];
      });
      const byId = {}; N.forEach((o, i) => byId[o.id] = i);
      /* 连线 */
      const pulse = 0.5 + 0.5 * Math.sin(t * 6.28 * 2);
      for (const [a, b, lab, h] of DATA.links) {
        const ia = byId[a], ib = byId[b];
        const col = h >= 79 ? C.green : h >= 65 ? [120, 140, 170] : C.red;
        cv.line(pos[ia][0], pos[ia][1], pos[ib][0], pos[ib][1], col, h >= 79 ? 2 : 1);
      }
      /* 节点 */
      N.forEach((o, i) => {
        const [x, y] = pos[i];
        const isCore = o.type === "core";
        const col = o.health >= 79 ? C.green : o.health >= 65 ? C.blue : C.amber;
        cv.ring(x, y, 26, [120, 130, 146], 1);
        cv.disc(x, y, 24, isCore ? C.navy : [250, 251, 252]);
        cv.frame(x - 24, y - 24, 48, 48, col, isCore ? 2 : 1);
        const nm = o.short;
        const w = measure(FONT, nm, 13).width;
        cv.text(Math.round(x - w / 2), Math.round(y - 9), nm, 13, isCore ? C.white : C.ink, FONT_B);
        cv.textc(x, y + 30, String(o.health), 12, col);
        /* 签名色环 */
        cv.ring(x, y, 24, col, 2);
      });
      /* 选中态：中心主体高亮邻居 */
      const hi = pos[0];
      cv.ring(hi[0], hi[1], 30 + 4 * pulse, C.blue, 2);
      /* 图例 */
      const lx = W - 190;
      cv.rect(lx, 88, 176, 158, C.white);
      cv.frame(lx, 88, 176, 158, C.line, 1);
      cv.text(lx + 14, 98, "健康度图例", 14, C.ink, FONT_B);
      [["≥79 运行平稳", C.green], ["65-78 尚稳未达标", [120, 140, 170]], ["<65 薄弱", C.red]].forEach((r, i) => {
        cv.rect(lx + 14, 128 + i * 34, 18, 12, r[1]);
        cv.text(lx + 42, 126 + i * 34, r[0], 13, C.ink);
      });
      cv.text(lx + 14, 230, "实线圆环=本次选中主体", 11, C.muted);
      /* 详情面板 */
      cv.rect(W - 190, 258, 176, 124, [238, 242, 248]);
      cv.frame(W - 190, 258, 176, 124, [196, 208, 226], 1);
      cv.text(W - 176, 268, "代建办 · 项目统筹", 14, C.ink, FONT_B);
      cv.text(W - 176, 292, "健康度 74", 12, C.blue);
      cv.text(W - 176, 312, "高频动作：并联推进、", 11, C.gray);
      cv.text(W - 176, 328, "每周例会协调、月报报送", 11, C.gray);
      cv.text(W - 176, 348, "短板：权责边界模糊", 11, C.red);
    },
    sub: "连线越红越薄弱。点击任一主体，右侧面板给出它的角色、动作和短板；点击连线给出关系诊断。",
  },
  /* ⑤ 时间轴 */
  {
    title: "阶段时间轴",
    draw(cv, t) {
      cv.clear(C.paper);
      cv.rect(0, 0, W, 46, C.navy);
      cv.text(24, 12, "六阶段协同时间轴 · " + DATA.meta.progress + "% 进度", 18, C.white, FONT_B);
      const x0 = 60, x1 = W - 60, y = 210;
      cv.rect(x0, y - 2, x1 - x0, 4, [206, 200, 186]);
      const now = x0 + (x1 - x0) * DATA.meta.progress / 100;
      /* 当前虚线 */
      for (let yy = 84; yy < 350; yy += 8) cv.rect(Math.round(now), yy, 1, 5, C.red);
      cv.rect(Math.round(now) - 34, 60, 68, 22, C.red);
      cv.textc(Math.round(now), 64, "当前 " + DATA.meta.progress + "%", 12, C.white, FONT_B);
      DATA.phases.forEach((p, i) => {
        const x = x0 + (x1 - x0) * i / (DATA.phases.length - 1);
        const loud = x <= now;
        cv.disc(Math.round(x), y, 9, loud ? C.blue : [188, 184, 172]);
        const lab = p.label, w = measure(FONT, lab, 13).width;
        cv.text(Math.round(x - w / 2), y - 34, lab, 13, loud ? C.ink : C.muted, loud ? FONT_B : FONT);
        const dw = measure(FONT, p.date, 11).width;
        cv.text(Math.round(x - dw / 2), y + 18, p.date, 11, C.gray);
        /* 密度点 */
        const dots = [3, 4, 5, 6, 4, 3][i] || 3;
        for (let k = 0; k < dots; k++) cv.disc(Math.round(x - 16 + k * 11), y - 14, 2, C.muted);
      });
      /* 卡点角标 */
      const bp = [["时序依赖", 2], ["信息不对称", 3], ["医疗专项协同", 4]];
      bp.forEach((b, i) => {
        const x = x0 + (x1 - x0) * b[1] / (DATA.phases.length - 1);
        const yy = 300 + (i % 2) * 40;
        cv.rect(Math.round(x) - 56, yy, 112, 26, [252, 244, 240]);
        cv.frame(Math.round(x) - 56, yy, 112, 26, C.red, 1);
        cv.textc(x, yy + 6, "! " + b[0], 11, C.red, FONT_B);
        cv.line(Math.round(x), y + 9, Math.round(x), yy, [220, 180, 170], 1);
      });
      cv.text(60, 388, "点击阶段节点，网络中高亮该阶段参与主体、详情面板给出阶段诊断。", 13, C.gray);
    },
    sub: "当前 88% 位于竣工验收与移交使用之间；红色标签是分诊到阶段的卡点，与上一屏一一对应。",
  },
  /* ⑥ 对比模式 */
  {
    title: "场景对比",
    draw(cv, t) {
      cv.clear(C.paper);
      cv.rect(0, 0, W, 46, C.navy);
      cv.text(24, 12, "场景对比 · 医院新院区 × 轨道交通", 18, C.white, FONT_B);
      const A = DATA, B = SCEN[0] || DATA;
      const col2 = (x, D, name, hl) => {
        cv.rect(x, 60, 348, 34, [232, 236, 244]);
        cv.text(x + 12, 66, name, 15, C.navy, FONT_B);
        cv.text(x + 12, 336, "总分", 12, C.gray);
        cv.text(x + 60, 322, String(D.total), 36, hl ? C.blue : C.ink, FONT_B);
      };
      col2(24, A, "示例项目：临江市第一人民医院", true);
      col2(396, B, "示例项目：滨江轨道交通 3 号线", false);
      /* 五维对比条 */
      const names = A.dims.map(d => d.n);
      const bw = 348;
      names.forEach((n, i) => {
        const y = 108 + i * 42;
        const va = A.dims[i].v, vb = B.dims[i] ? B.dims[i].v : 0;
        const lbl = measure(FONT, n, 12).width;
        cv.text(24 + 90 - lbl, y, n, 12, C.ink);
        cv.text(396 + bw - 90, y, n, 12, C.ink);
        const xa = 24 + 100, xb = 396 + 100;
        const maxw = bw - 104 - 60;
        cv.bar(xa, y + 4, maxw, 12, va / 100, DIM_COLORS[i]);
        cv.bar(xb, y + 4, maxw, 12, vb / 100, [150, 156, 166]);
        cv.text(xa + maxw + 8, y + 2, String(va), 14, DIM_COLORS[i], FONT_B);
        const dlt = va - vb;
        cv.text(xb + maxw + 8, y + 2, String(vb), 14, [122, 128, 138], FONT_B);
      });
      /* 差值面板 */
      cv.rect(24, 348, 720, 44, [238, 242, 248]);
      const d0 = A.dims[0].v - (B.dims[0] ? B.dims[0].v : 0);
      cv.text(40, 358, "Δ 权责清晰度 " + (d0 >= 0 ? "+" : "") + d0 + " 分 · 轨道场景权责界面更清晰", 13, C.blueD, FONT_B);
      cv.text(40, 376, "对比模式可并排两个场景的五维与卡点，找出「能迁移的标准动作」。", 12, C.gray);
    },
    sub: "对比看的是差异从哪来：轨道场景的权责边界更清晰，医疗项目的需求稳定性更差，各有各的处方。",
  },
  /* ⑦ 交付物 */
  {
    title: "交付物",
    draw(cv, t) {
      cv.clear(C.paper);
      cv.rect(0, 0, W, 46, C.navy);
      cv.text(24, 12, "一份体检，四种交付", 18, C.white, FONT_B);
      const cards = [
        ["📄", "打印报告单", "五维评分图 + 印章 + 复查同比", "A4 友好 · Ctrl+P 直出"],
        ["🖥", "屏幕报告", "打字机逐行生成，可点击跳转", "Esc 中断 · 点击直达"],
        ["⬇", "Markdown", "七节结构，含干预时间线", "粘贴到文档系统"],
        ["🎬", "巡览演示", "9 幕自动巡览 + 循环模式", "?tour=1 ?loop=1"],
      ];
      cards.forEach((c, i) => {
        const x = 24 + (i % 2) * 372, y = 66 + Math.floor(i / 2) * 150;
        cv.rect(x, y, 348, 132, C.white);
        cv.frame(x, y, 348, 132, C.line, 1);
        cv.rect(x, y, 348, 4, C.blue);
        cv.text(x + 16, y + 14, c[0], 30, C.navy, FONT_B);
        cv.text(x + 62, y + 18, c[1], 19, C.ink, FONT_B);
        cv.text(x + 62, y + 48, c[2], 12, C.gray);
        cv.rect(x + 16, y + 92, 316, 26, [238, 240, 246]);
        cv.text(x + 28, y + 98, c[3], 12, C.blueD);
      });
      cv.text(24, 386, "另附工具箱：tour.html 双击即播、一键录制.cmd 录制 WebM。", 13, C.gray);
    },
    sub: "同一份数据，打印给领导、屏幕给同事、Markdown 给系统、巡览给大会——四种口径一个来源。",
  },
  /* ⑧ 收尾 */
  {
    title: "收尾",
    draw(cv, t) {
      cv.clear(C.navy);
      cv.rect(0, 0, W, 6, C.blue);
      cv.textc(W / 2, 96, "协同的问题，先体检，再开方。", 30, C.white, FONT_B);
      cv.textc(W / 2, 150, "Atria-协同体检中心 v30", 17, [196, 204, 220]);
      cv.textc(W / 2, 180, "单文件 · 离线 · 零依赖 · 可编辑数据", 14, [140, 150, 168]);
      const items = ["演示数据 5 场景（医院 / 轨道 / 排水 / 学校 / 水厂）", "五维评分 · 卡点分诊 · 关系网络 · 阶段时间轴 · 场景对比", "校验断言 437 项 · 挑刺闭环 15 轮 · 双指针审查"];
      items.forEach((s, i) => cv.textc(W / 2, 236 + i * 30, "· " + s, 14, [176, 184, 200]));
      cv.rect(W / 2 - 140, 350, 280, 44, C.blue);
      cv.textc(W / 2, 362, "双击 Atria-协同体检中心-v30.html", 15, C.white, FONT_B);
      cv.textc(W / 2, 414, "Atria Demo 共建 · 2026-10", 12, [110, 120, 140]);
    },
    sub: "感谢观看。体检中心的核心不是分数，而是分数背后的「谁和谁、卡在哪、下一步谁动」。",
  },
];

/* ---------- 主渲染 ---------- */
const out = fs.createWriteStream("frames.mj2");   /* 拼接 JPEG，交 ffmpeg 当 mjpeg 流 */
let nframe = 0;
const t0 = Date.now();
for (let s = 0; s < slides.length; s++) {
  const slide = slides[s];
  const total = SLIDE_SEC * FPS;
  const sub = slide.sub;
  for (let f = 0; f < total; f++) {
    const cv = new Canvas();
    const t = f / (total - 1);
    slide.draw(cv, t);
    /* 字幕条 + 打字机 */
    cv.rect(0, H - 46, W, 46, [17, 25, 40]);
    const chars = Math.max(0, Math.min(sub.length, Math.ceil((f + 1) / total * (sub.length + 4))));
    const shown = sub.slice(0, chars);
    cv.text(24, H - 36, shown, 15, [226, 232, 244]);
    if (chars < sub.length) {   /* 光标 */
      const w = measure(FONT, shown, 15).width;
      cv.rect(24 + w + 3, H - 33, 10, 20, [226, 232, 244]);
    }
    /* 幕序号 */
    cv.text(W - 130, H - 32, "第 " + (s + 1) + " / " + slides.length + " 幕", 11, [110, 120, 140]);
    const jpg = encodeRGBA(cv.buf, W, H, 62);
    out.write(Buffer.from(jpg));
    nframe++;
    if (nframe % 50 === 0) console.log("frames:", nframe, "ms/frame:", ((Date.now() - t0) / nframe).toFixed(1));
  }
}
out.end();
console.log("done:", nframe, "frames;", ((Date.now() - t0) / 1000).toFixed(1), "s");
