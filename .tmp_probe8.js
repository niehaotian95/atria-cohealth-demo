/* 第8轮 viewer-critic 机械验证探针 */
const fs=require("fs");
const src=fs.readFileSync("Atria-协同体检中心-v20.html","utf8");

// 提取 <script> 主块（最后一个）
const m=src.match(/<script>([\s\S]*?)<\/script>/g);
const main=m[m.length-1].replace(/^<script>|<\/script>$/g,"");

// 截取数据与规则段：从 "const DEFAULT_DATA=" 到 "function loadData" 之前
const d1=main.indexOf("const DEFAULT_DATA=");
const d2=main.indexOf("function loadData");
const dataSrc=main.slice(d1,d2);

// 模拟最小环境
const winStub={matchMedia:()=>({matches:false}),addEventListener:()=>{}};
global.window=winStub; global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({style:{},setAttribute(){},appendChild(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}}}),documentElement:{getAttribute:()=>null,setAttribute(){},removeAttribute(){}},addEventListener:()=>{}};
global.localStorage={getItem:()=>null,setItem(){}};
global.location={search:""};

eval(dataSrc.replace(/^const /gm,"var ")); // 定义 DEFAULT_DATA / SCENARIOS
// DIM_RULES 在 loadData 之后，单独提取
const r1=main.indexOf("const DIM_RULES=");
const r2=main.indexOf("function clearDimSel");
eval(main.slice(r1,r2).replace(/^const /gm,"var "));

const clean=s=>(s||"").replace(/（示例[^）]*）/g,"");
function dimOfBlocker(b,dims){
  const txt=clean(b.t||"")+" "+clean(b.d||"")+" "+clean(b.ev||"")+" "+clean(b.fix||"");
  const counts=dims.map(()=>0), firstPos=dims.map(()=>-1);
  DIM_RULES.forEach((re,di)=>{
    if(di>=counts.length)return;
    const hits=txt.match(new RegExp(re.source,"g"));
    if(hits){counts[di]=hits.length;firstPos[di]=txt.search(re);}
  });
  let best=-1;
  counts.forEach((c,i)=>{if(c<=0)return;if(best<0||c>counts[best]||(c===counts[best]&&firstPos[i]<firstPos[best]))best=i;});
  return best;
}

const ALL=[DEFAULT_DATA].concat(SCENARIOS);
const names=["医院","轨道","排水","学校","水厂"];
console.log("=== 五场景归因分布（v20 规则实跑）===");
ALL.forEach((D,si)=>{
  globalThis.DATA=D;
  const dims=D.dims.map(d=>d.n);
  const attr=D.blockers.map(b=>dimOfBlocker(b));
  const counts=dims.map((_,i)=>attr.filter(a=>a===i).length);
  const unattr=attr.filter(a=>a<0).length;
  console.log(`${names[si]}: 维度归因计数 ${JSON.stringify(counts.map((c,i)=>dims[i]+":"+c))} 未归因:${unattr}`);
  D.blockers.forEach((b,bi)=>{
    const a=attr[bi];
    const chip=a>=0?dims[a]:"无角标";
    console.log(`  [${b.sev}] ${b.t} -> ${chip}`);
  });
});

console.log("\n=== 巡览 ② 选行（按分排序后第一个归因非0行）===");
ALL.forEach((D,si)=>{
  const attr=D.blockers.map(b=>dimOfBlocker(b,D.dims));
  const sorted=D.dims.map((d,i)=>({d,i})).sort((a,b)=>b.d.v-a.d.v);
  const hit=sorted.find(x=>attr.filter(a=>a===x.i).length>0);
  console.log(`${names[si]}: 选中「${hit?hit.d.n+"（分"+hit.d.v+"，排第"+(sorted.indexOf(hit)+1)+"）":"无（退回第二行）"}"`);
});

console.log("\n=== buildReportLines 各节结尾（文本检查）===");
// 简化实现 buildReportLines 的纯文本部分，检查每节结尾句号
const SEV_ORDER=["高","中","低"];
function clone(o){return JSON.parse(JSON.stringify(o));}
// N/lables for section5
function buildReportLinesSim(D){
  const N=(D.orgs||[]).map((o,i)=>({...o,i}));
  const idx={};N.forEach((n,i)=>idx[n.id]=i);
  const L=(D.links||[]).map(([a,b,l,h])=>({a:idx[a],b:idx[b],label:l,health:h})).filter(x=>x.a!=null&&x.b!=null);
  const highs=(D.blockers||[]).filter(b=>b.sev==="高").map(b=>b.t);
  const lows=(D.orgs||[]).filter(o=>o.health<65).map(o=>o.name);
  const dims=(D.dims||[]).map(x=>x.n+"（"+x.v+"）").join("、");
  const lines=[
    "一、总检结论\n\n协同健康度 "+(D.total||0)+" 分。",
    "二、五维评分\n\n"+dims+"。",
    "三、卡点分诊\n\n识别出 "+(D.blockers||[]).length+" 类协同卡点："+highs.join("、")+"。",
    "四、干预处方\n\n"+(()=>{const hs=(D.blockers||[]).filter(b=>b.sev==="高");return hs.length?hs.map((b,i)=>"（"+(i+1)+"）"+b.t+"："+b.fix).join("；"):"当前无高风险卡点，维持既有协同机制即可";})()+"。",
    "五、协同亮点\n\n"+(()=>{const good=L.filter(l=>l.health>=79).map(l=>N[l.a].short+" ↔ "+N[l.b].short+"（"+l.health+"）");return good.length?good.join("、")+" 等关系运行平稳":"无标杆";} )()+"。",
    "六、30 天干预时间线\n\n"+(()=>{const list=(D.blockers||[]).slice().sort((a,b)=>SEV_ORDER.indexOf(a.sev)-SEV_ORDER.indexOf(b.sev)).map(b=>"· D（"+b.sev+"）"+b.t).join("\n");return list?"有:\n"+list:"当前无卡点需要排期，本月无干预事项，保持既有协同节奏并按月复查即可";})()+"。",
    "七、按主体整改清单\n\n"+(()=>{const byOrg={};(D.blockers||[]).forEach(b=>(b.orgs||[]).forEach(id=>{(byOrg[id]=byOrg[id]||[]).push(b);}));const rows=(D.orgs||[]).filter(o=>byOrg[o.id]&&byOrg[o.id].length).map(o=>"· "+o.short).join("\n");return rows?"有:\n"+rows:"当前无卡点需主体认领整改，各主体维持既有协同职责即可";})()+"。"
  ];
  return lines;
}
ALL.forEach((D,si)=>{
  const lines=buildReportLinesSim(D);
  lines.forEach((l,i)=>{
    const body=l.split("\n\n")[1];
    const lastChar=body[body.length-1];
    console.log(`${names[si]} 节${["一","二","三","四","五","六","七"][i]} 结尾字符: "${lastChar}"`);
  });
});

console.log("\n=== 深色打印变量检查 ===");
const css=src.match(/<style>([\s\S]*?)<\/style>/)[1];
const hasPrintForcedLight=/@media print[\s\S]*?data-theme/.test(css);
console.log("@media print 是否强制浅色变量:",hasPrintForcedLight);
const printBlock=css.match(/@media print\{([\s\S]*?)\n\s*\}/);
// 检查 print 块中是否有 color/print-color-adjust 覆盖
console.log("print 块是否含 print-color-adjust:", /print-color-adjust/.test(css));
console.log("print 块是否设置 body color:", /body\s*\{[^}]*color/.test(printBlock?printBlock[1]:""));
