
/* ===== 演示录像脚本：自动巡览 + 步骤字幕（?off=1 关闭；?loop=1 循环） ===== */
(function(){
  if(/[?&]off=1/.test(location.search))return;
  const LOOP=/[?&]loop=1/.test(location.search);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const q=(s,el)=>(el||document).querySelector(s);
  const qq=(s,el)=>[...(el||document).querySelectorAll(s)];
  /* 字幕条 */
  const sty=document.createElement("style");
  sty.textContent=
    "#tourOv{position:fixed;left:50%;bottom:22px;transform:translate(-50%,8px);z-index:9999;"+
    "background:rgba(15,20,28,.88);color:#fff;font:600 14px/1.5 -apple-system,'Segoe UI','Microsoft YaHei',sans-serif;"+
    "padding:9px 20px;border-radius:999px;letter-spacing:.5px;opacity:0;transition:opacity .45s,transform .45s;"+
    "box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:none;max-width:86vw;text-align:center;}";
  document.head.appendChild(sty);
  const ov=document.createElement("div");
  ov.id="tourOv";document.body.appendChild(ov);
  function say(t){ov.textContent=t;ov.style.opacity=1;ov.style.transform="translate(-50%,0)";}
  function pulse(el){
    if(!el)return;
    const r=el.getBoundingClientRect();
    const ring=document.createElement("div");
    ring.className="tour-ring";
    ring.style.cssText="position:fixed;left:"+(r.left+r.width/2-26)+"px;top:"+(r.top+r.height/2-26)+
      "px;width:52px;height:52px;border-radius:50%;border:3px solid #3b5bdb;pointer-events:none;z-index:9998;"+
      "animation:tourRing 1.1s ease-out forwards;";
    document.body.appendChild(ring);
    setTimeout(()=>ring.remove(),1300);
  }
  const ringSty=document.createElement("style");
  ringSty.textContent="@keyframes tourRing{0%{opacity:.9;transform:scale(.55);}100%{opacity:0;transform:scale(1.7);}}";
  document.head.appendChild(ringSty);

  (async()=>{
    await sleep(500);
    say("① 体检报告单式总览：72 分 · 良 B —— 结论先行，右上角可见「较上次复查」趋势");
    await sleep(6500);
    /* 维度归因 */
    say("② 维度归因：点「信息通畅度」→ 签名色贯穿列表 / 角标 / 网络高亮");
    const dimRow=qq(".dim-row")[1];
    pulse(dimRow);dimRow.click();
    await sleep(7500);
    const chip=q("#detail .tag.gov");
    if(chip){pulse(chip);chip.click();await sleep(6500);}
    /* 主体诊断 */
    say("③ 主体诊断：点击网络主体，查看健康度与协同关系");
    const qo=qq(".qorg")[3]||qq(".qorg")[0];
    pulse(qo);qo.click();
    await sleep(6500);
    /* 阶段聚焦 */
    say("④ 阶段聚焦：时间轴定位到设计阶段卡点");
    const dot=qq(".tl-m")[2]||qq(".tl-m")[0];
    pulse(dot);dot.click();
    await sleep(6500);
    /* 卡点分诊 */
    say("⑤ 卡点分诊：高 / 中 / 低三档，重点干预置顶，点击展开处方");
    const blkCard=q("#blkSearch")?q("#blkSearch").closest(".card"):null;
    if(blkCard)blkCard.scrollIntoView({behavior:"smooth",block:"start"});
    await sleep(1100);
    const blk=q(".blk");
    if(blk){pulse(blk);blk.click();}
    await sleep(7000);
    /* 换场景 */
    say("⑥ 一键切换场景：模板不改版，全套数据刷新");
    window.scrollTo({top:0,behavior:"smooth"});
    await sleep(1300);
    const sb=document.getElementById("sceneBtn1");
    pulse(sb);sb.click();
    await sleep(7500);
    /* 对比 */
    say("⑦ 跨场景对比：五维评分与主体健康度并排");
    const cb=document.getElementById("cmpBtn");
    pulse(cb);cb.click();
    await sleep(1400);
    const cmpCard=q(".cmp-card");
    const target=[...document.querySelectorAll(".scene-btn")].find(b=>b.id==="sceneBtn0");
    if(target){pulse(target);target.click();}
    if(cmpCard)cmpCard.scrollIntoView({behavior:"smooth",block:"center"});
    await sleep(7500);
    /* 报告 */
    say("⑧ 生成复盘报告：报告单排版 · 一键打印 / Markdown 复制");
    window.scrollTo({top:0,behavior:"smooth"});
    await sleep(1000);
    const gb=document.getElementById("genBtn");
    pulse(gb);gb.click();
    await sleep(2600);
    const rep=document.getElementById("report");
    rep.scrollIntoView({behavior:"smooth",block:"start"});
    await sleep(20000);
    say("演示结束 —— Atria-Dawn · 代建制公共工程跨组织协同体检沙盘");
    await sleep(4500);
    ov.style.opacity=0;
    console.log("TOUR_DONE");
    if(LOOP)setTimeout(()=>location.reload(),5000);
  })().catch(e=>console.log("TOUR_ERR",e.message));
})();
