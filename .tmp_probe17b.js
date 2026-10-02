/* 提取 buildReportLines 输出，检查各节文本 */
const fs=require("fs");
const src=fs.readFileSync(process.argv[2]||"Atria-协同体检中心-v29.html","utf8");
function extract(startMark,endMark){
  const i=src.indexOf(startMark);
  const j=src.indexOf(endMark,i+startMark.length);
  return src.slice(i,j);
}
const DEFAULT_DATA=eval("("+extract("const DEFAULT_DATA=","/* 场景预设").slice("const DEFAULT_DATA=".length).trim().replace(/;$/,"")+")");
const SCENARIOS=eval("("+extract("const SCENARIOS=","/* ================= 数据层").slice("const SCENARIOS=".length).trim().replace(/;$/,"")+")");
const ALL_SCENES=[DEFAULT_DATA].concat(SCENARIOS);
const DIM_RULES=[/权责|边界|职责|分工|牵头/,/信息|数据|口径|对称|资料|报表|告知|投诉/,/审批|时序|前置|许可|串联|报装|迁改|征拆|占道/,/目标|错位|考核|优先|冲突/,/需求|变更|反复|界面|专项/];
function dimOfBlocker(b,dims){
  const clean=s=>(s||"").replace(/（示例[^）]*）/g,"");
  const txt=clean(b.t)+" "+clean(b.d)+" "+clean(b.ev)+" "+clean(b.fix);
  const counts=dims.map(()=>0),firstPos=dims.map(()=>-1);
  DIM_RULES.forEach((re,di)=>{if(di>=counts.length)return;
    const hits=txt.match(new RegExp(re.source,"g"));
    if(hits){counts[di]=hits.length;firstPos[di]=txt.search(re);}});
  let best=-1;
  counts.forEach((c,i)=>{if(c<=0)return;
    if(best<0||c>counts[best]||(c===counts[best]&&firstPos[i]<firstPos[best]))best=i;});
  return best;
}
function gradeOf(v){return v>=85?"优（A）":v>=70?"良（B）":v>=60?"中（C）":"差（D）";}
function gradePlain(v){const m=/^(.+?)（(.)）$/.exec(gradeOf(v));return m?m[1]+" "+m[2]:gradeOf(v);}
function cleanIssueDate(d){const raw=((d||{}).meta&&d.meta.date)||"";return raw.replace(/^[^0-9]*/,"").trim()||"2026年";}
function buildReportNo(D){const dt=cleanIssueDate(D);const proj=(D.meta&&D.meta.project)||"";let code=0;
  for(const ch of proj)code=(code*31+ch.charCodeAt(0))%1000;
  return "ATRIA-"+dt+"-"+String(code).padStart(3,"0");}
function buildConclusion(D){
  const dims=(D.dims||[]).slice().sort((a,b)=>b.v-a.v);
  const highs=(D.blockers||[]).filter(b=>b.sev==="高").length;
  const parts=[];
  const weak=dims.filter(d=>d.v<70).map(d=>d.n);
  const strong=dims.slice(0,2).filter(d=>d.v>=75).map(d=>d.n);
  if(strong.length)parts.push("「"+strong.join("、")+"」保持优势");
  if(weak.length)parts.push("「"+weak.join("、")+"」为短板项，建议优先干预");
  if(highs>0)parts.push("识别出高风险协同卡点 "+highs+" 项，建议 30 天内启动分诊整改");
  if(!parts.length)parts.push("五维评分均在 70 分以上，无高风险卡点，协同体系总体可控");
  const prev=D.prev;
  if(prev&&typeof prev.total==="number"&&prev.date){
    const dT=(D.total||0)-prev.total;
    const dimsNow=(D.dims||[]),dimsPrev=prev.dims||[];
    const worse=dimsNow.map((x,i)=>({n:x.n,d:(typeof dimsPrev[i]==="number")?x.v-dimsPrev[i]:null})).filter(x=>x.d!==null&&x.d<0).map(x=>x.n);
    const better=dimsNow.map((x,i)=>({n:x.n,d:(typeof dimsPrev[i]==="number")?x.v-dimsPrev[i]:null})).filter(x=>x.d!==null&&x.d>0).map(x=>x.n);
    const t=dT>0?"+"+dT+" 分":dT<0?String(dT)+" 分":"与上次持平";
    parts.push("较上次体检（"+prev.date+"）总分 "+(dT===0?"与上次持平":t)+
      (better.length?"，「"+better.join("、")+"」改善":"")+
      (worse.length?(!better.length?"":"，")+"「"+worse.join("、")+"」恶化":""));
  }
  return "总体协同框架"+((D.total||0)>=75?"运转成熟，可沉淀为标准动作":(D.total||0)>=65?"基本有效，仍有可观察的提升空间":"存在明显结构性缺口，需专题整改")+"。"+parts.join("；")+"。";
}
function buildReportLines(d){
  const dims=(d.dims||[]).map(x=>x.n+"（"+x.v+"）").join("、");
  const highs=(d.blockers||[]).filter(b=>b.sev==="高").map(b=>b.t);
  const lows=(d.orgs||[]).filter(o=>o.health<65).map(o=>o.name);
  const no=buildReportNo(d);
  const lines=[
    "一、总检结论\n\n协同健康度 "+(d.total||0)+" 分（"+gradePlain(d.total||0)+"）。\n\n"+buildConclusion(d),
    "二、五维评分\n\n"+dims+"。",
    "三、卡点分诊\n\n识别出 "+(d.blockers||[]).length+" 类协同卡点，其中高风险 "+highs.length+" 项："+(highs.join("、")||"无")+"。健康度偏低的主体："+(lows.join("、")||"无")+"。",
    "四、干预处方\n\n"+(()=>{const hs=(d.blockers||[]).filter(b=>b.sev==="高");
      return hs.length?hs.map((b,i)=>"（"+(i+1)+"）"+b.t+"："+b.fix).join("；"):"当前无高风险卡点，维持既有协同机制即可";})()+"。",
    "五、协同亮点\n\n"+(()=>{
      const on=id=>(d.orgs||[]).find(x=>x.id===id);
      const good=(d.links||[]).filter(l=>l[3]>=79).map(l=>{const a=(on(l[0])||{}).short||l[0],b2=(on(l[1])||{}).short||l[1];return a+" ↔ "+b2+"（"+l[3]+"）";});
      return good.length?(good.length===1?good[0]+" 该关系运行平稳，可总结经验形成标准动作":good.join("、")+" 等关系运行平稳，可作为标准动作沉淀复用"):"当前无运行平稳的标杆关系（健康度 ≥79），四节处方里的高频薄弱环节应优先专项整改";})()+"。",
    "六、30 天干预时间线\n\n"+(()=>{
      const list=(d.blockers||[]).slice().sort((a,b)=>["高","中","低"].indexOf(a.sev)-["高","中","低"].indexOf(b.sev))
        .map(b=>"· "+({高:"D1–D7",中:"D8–D21",低:"D22–D30"}[b.sev]||"D8–D21")+"（"+b.sev+"）"+b.t+"："+b.fix).join("\n");
      return list?"按严重度排期，高风险先行、低风险收尾，月末统一复查验收：\n"+list:"当前无卡点需要排期，本月无干预事项，保持既有协同节奏并按月复查即可";})()+"。",
    "七、按主体整改清单\n\n"+(()=>{
      const byOrg={};(d.blockers||[]).forEach(b=>(b.orgs||[]).forEach(id=>{(byOrg[id]=byOrg[id]||[]).push(b);}));
      const rows=(d.orgs||[]).filter(o=>byOrg[o.id]&&byOrg[o.id].length).map(o=>
        "· "+o.short+"（"+o.name+"）：\n"+byOrg[o.id].sort((a,b)=>["高","中","低"].indexOf(a.sev)-["高","中","低"].indexOf(b.sev)).map(x=>"　– "+x.t+"（"+x.sev+"）："+x.fix).join("\n")).join("\n");
      return rows?"各主体认领本项目的协同整改事项：\n"+rows:"当前无卡点需主体认领整改，各主体维持既有协同职责即可";})()+"。",
    "签发：Atria-Dawn 协同诊断中心 ｜ "+((d.meta&&d.meta.project)?d.meta.project+" ｜ ":"")+"报告编号 "+no+" ｜ "+cleanIssueDate(d)+"（"+((d.meta&&d.meta.badge)||"示例数据")+"，自动生成）"
  ];
  return lines;
}
ALL_SCENES.forEach((D,si)=>{
  console.log("\n########## 场景 "+si+"："+D.meta.project+"  total="+D.total+" "+gradePlain(D.total));
  const lines=buildReportLines(D);
  lines.forEach((l,i)=>{
    // 检查每节以「。」收尾 & 首行格式
    const nl=l.indexOf("\n");
    const head=l.slice(0,nl>0?nl:l.length);
    const tail=l.slice(-1);
    const check=(i>=3&&i<=6)?(tail==="。"?"OK":"!! NOT 以。结尾"):("—");
    console.log("  ["+i+"] "+check+" | "+head.replace(/\n/g,"\\n")+" | len="+l.length);
  });
  // 五节单数复数检查
  const s5=lines[4];
  const n5=(s5.match(/（\d+）/g)||[]).length;
  console.log("  五节标杆关系条数="+n5+"  含「等关系」="+(s5.includes("等关系"))+"  含单数句="+(s5.includes("该关系运行平稳")));
});
