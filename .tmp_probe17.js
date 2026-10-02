/* 第 17 轮挑刺探针：提取 v29 源码数据与规则做机械验证 */
const fs=require("fs");
const src=fs.readFileSync(process.argv[2]||"Atria-协同体检中心-v29.html","utf8");

/* 提取 DEFAULT_DATA 与 SCENARIOS */
function extract(startMark,endMark){
  const i=src.indexOf(startMark);
  const j=src.indexOf(endMark,i+startMark.length);
  return src.slice(i,j);
}
const defSrc=extract("const DEFAULT_DATA=","/* 场景预设");
const scnSrc=extract("const SCENARIOS=","/* ================= 数据层");
const DEFAULT_DATA=eval("("+defSrc.slice("const DEFAULT_DATA=".length).trim().replace(/;$/,"")+")");
const SCENARIOS=eval("("+scnSrc.slice("const SCENARIOS=".length).trim().replace(/;$/,"")+")");
const ALL_SCENES=[DEFAULT_DATA].concat(SCENARIOS);

const DIM_RULES=[
  /权责|边界|职责|分工|牵头/,
  /信息|数据|口径|对称|资料|报表|告知|投诉/,
  /审批|时序|前置|许可|串联|报装|迁改|征拆|占道/,
  /目标|错位|考核|优先|冲突/,
  /需求|变更|反复|界面|专项/
];
const DIM_NAMES=["权责清晰度","信息通畅度","审批效率","目标一致性","需求稳定性"];
function dimOfBlocker(b,dims){
  const clean=s=>(s||"").replace(/（示例[^）]*）/g,"");
  const txt=clean(b.t||"")+" "+clean(b.d||"")+" "+clean(b.ev||"")+" "+clean(b.fix||"");
  const counts=dims.map(()=>0), firstPos=dims.map(()=>-1);
  DIM_RULES.forEach((re,di)=>{
    if(di>=counts.length)return;
    const hits=txt.match(new RegExp(re.source,"g"));
    if(hits){counts[di]=hits.length;firstPos[di]=txt.search(re);}
  });
  let best=-1;
  counts.forEach((c,i)=>{if(c<=0)return;
    if(best<0||c>counts[best]||(c===counts[best]&&firstPos[i]<firstPos[best]))best=i;});
  return best;
}
function gradeOf(v){return v>=85?"优（A）":v>=70?"良（B）":v>=60?"中（C）":"差（D）";}
function gradePlain(v){const m=/^(.+?)（(.)）$/.exec(gradeOf(v));return m?m[1]+" "+m[2]:gradeOf(v);}

ALL_SCENES.forEach((D,si)=>{
  const dims=D.dims;
  const attrMap=D.blockers.map(b=>dimOfBlocker(b,dims));
  // 旅程 ②：按分排序的行中第一个归因数>0
  const sorted=dims.map((d,i)=>({d,i})).sort((a,b)=>b.d.v-a.d.v);
  const pick=sorted.find(x=>attrMap.filter(a=>a===x.i).length>0)||sorted[1];
  const cnt=attrMap.filter(a=>a===pick.i).length;
  console.log("=== 场景 "+si+"："+D.meta.project.replace(/^示例项目：/,""));
  console.log("  归因分布: "+DIM_NAMES.map((n,i)=>n+"="+attrMap.filter(a=>a===i).length).join(" ")+"  未归因="+attrMap.filter(a=>a===-1).length);
  console.log("  旅程②选行: "+pick.d.n+"（第 "+(sorted.indexOf(pick)+1)+" 行 / 分 "+pick.d.v+" / 归因 "+cnt+" 项）");
  // 复查 chip
  const prev=D.prev;
  if(prev){
    const dT=D.total-prev.total;
    console.log("  复查 chip: 较上次（"+prev.date+"）"+(dT>0?"+"+dT+" 分":dT<0?dT+" 分":"与上次持平"));
    console.log("  字幕①提到「较上次复查」—— chip 实际文案是否含「复查」: "+(("较上次（"+prev.date+"）").includes("复查")?"含":"不含"));
  }
  // 报告五节
  const good=(D.links||[]).filter(l=>l[3]>=79).map(l=>{
    const on=id=>(D.orgs||[]).find(x=>x.id===id);
    const a=(on(l[0])||{}).short||l[0],b2=(on(l[1])||{}).short||l[1];
    return a+" ↔ "+b2+"（"+l[3]+"）";
  });
  console.log("  报告五节标杆关系 "+good.length+" 条: "+(good.join("、")||"—"));
  console.log("  等级写法 gradePlain(total="+D.total+") = "+gradePlain(D.total));
});
