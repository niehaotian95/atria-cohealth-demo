
"use strict";
/* ================= 工具 ================= */
const detail=document.getElementById("detail");
const $=id=>document.getElementById(id);
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function gradeOf(v){return v>=85?"优（A）":v>=70?"良（B）":v>=60?"中（C）":"差（D）";}
/* v3：主题、持久化、无障碍动效 */
const KEY_THEME="atria_demo_theme", KEY_SCENE="atria_demo_scene";
const prefersReduced=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function isDark(){return document.documentElement.getAttribute("data-theme")==="dark";}
function smoothScroll(el,block){el.scrollIntoView({behavior:prefersReduced?"auto":"smooth",block:block||"nearest"});}

/* ================= 数据（示例 · 虚构；可经「导入 JSON」整体替换） ================= */
const DEFAULT_DATA={
  meta:{
    project:"示例项目：临江市第一人民医院新院区（一期）",
    mode:"建设模式：代建制 + EPC",
    date:"体检日期：2026-06",
    badge:"示例数据 · 虚构项目，仅作演示",
    progress:88
  },
  total:72,
  orgs:[
    {id:"agent", name:"代建单位", short:"代建办", type:"core", health:74,
     role:"代建方 · 项目统筹", power:"全过程组织、协调、报批、投资控制",
     act:"并联推进各主体、每周例会协调、月报报送", block:"权责边界模糊、协调成本高",
     tags:["代建制","项目统筹"], phases:[0,1,2,3,4,5]},
    {id:"owner", name:"业主单位(卫健委)", short:"卫健委", type:"gov", health:70,
     role:"项目业主", power:"投资决策、需求确认、监督考核",
     act:"需求提报、验收确认、资金拨付", block:"需求变更频繁、与代建目标错位",
     tags:["代建制","业主"], phases:[0,2,4,5]},
    {id:"hosp", name:"使用单位(院方)", short:"院方筹备组", type:"part", health:63,
     role:"使用单位", power:"使用需求、功能确认",
     act:"功能需求提报、医疗专项对接", block:"使用需求后置导致设计与施工返工",
     tags:["使用单位","医疗专项"], phases:[1,3,4,5]},
    {id:"gov", name:"政府审批部门", short:"审批部门", type:"gov", health:66,
     role:"发改 / 住建 / 财政 / 自然资源", power:"审批、资金、土地",
     act:"并联审批、图审、资金监管", block:"跨部门时序依赖、前置件等待",
     tags:["审批监管"], phases:[0,1,2,4]},
    {id:"design",name:"设计单位", short:"设计院", type:"part", health:77,
     role:"勘察设计", power:"设计质量与进度",
     act:"图纸交付、设计变更、专项设计", block:"医疗专项设计与施工界面不清",
     tags:["勘察设计"], phases:[1,3,4]},
    {id:"epc", name:"EPC 总承包", short:"EPC", type:"part", health:71,
     role:"施工总承包", power:"工期、造价、安全、质量",
     act:"现场实施、分包管理、进度汇报", block:"工期压力下的分包协同",
     tags:["EPC","施工总承包"], phases:[2,3,4]},
    {id:"super",name:"监理单位", short:"监理", type:"part", health:80,
     role:"工程监理", power:"质量、进度、安全监督",
     act:"旁站、验收签认、监理例会", block:"独立性与权责保障",
     tags:["监理"], phases:[3,4]},
    {id:"audit",name:"审计/纪检监督", short:"审计监督", type:"gov", health:85,
     role:"审计 / 纪检", power:"合规、绩效监督",
     act:"过程监督、专项审计、结算审计", block:"监督时点与效力",
     tags:["审计监督","合规"], phases:[3,4,5]}
  ],
  links:[
    ["agent","owner","报批/需求",72],["agent","hosp","需求对接",58],
    ["agent","gov","审批推进",64],["agent","design","设计协同",76],
    ["agent","epc","施工统筹",73],["agent","super","监理协同",82],
    ["agent","audit","监督报送",84],["owner","hosp","需求传递",55],
    ["owner","gov","立项/资金",70],["epc","design","施工图衔接",61],
    ["epc","super","验收签认",79],["design","gov","图审",60]
  ],
  phases:[
    {label:"前期立项", date:"2022-09", diag:"立项阶段协同整体顺畅，但使用单位介入较晚，需求表述粗放，为后期变更埋下隐患。"},
    {label:"勘察设计", date:"2023-02", diag:"医疗专项设计启动滞后于主体设计，净化、放疗等专项界面未在设计阶段闭合。"},
    {label:"招标采购", date:"2023-06", diag:"EPC 招标与专项采购界面划分不够清晰，合同条款对跨组织界面约定留白。"},
    {label:"施工实施", date:"2023-09", diag:"协同最繁重阶段：图纸衔接、需求变更、审批滞后三重压力叠加，例会机制发挥关键作用。"},
    {label:"竣工验收", date:"2026-03", diag:"专项验收与总体验收时序咬合紧密，资料归集口径不一拖累验收进度。"},
    {label:"移交使用", date:"2026-06", diag:"院方功能确认与代建移交组织有序，需求锁定机制在收尾阶段见效。"}
  ],
  blockers:[
    {t:"权责边界模糊", sev:"中", d:"代建与业主、使用单位之间权责交叉或留白",
     ev:"例会纪要中累计 12 次议题涉及“谁牵头”的职责争议（示例数据）",
     fix:"编制权责清单 + 协同流程图，在项目启动阶段前置确认并签认", orgs:["agent","owner","hosp"]},
    {t:"信息不对称", sev:"高", d:"现场进度与投资台账口径不一，数据割裂",
     ev:"周报与投资月报在形象进度上存在 3 个百分点的口径偏差（示例数据）",
     fix:"统一数据底座与报表口径，例会固定通报关键指标", orgs:["agent","epc","owner"]},
    {t:"时序依赖", sev:"高", d:"跨部门审批串联，前置件未出则后续停摆",
     ev:"图审滞后约 20 天，间接推迟开工准备（示例数据）",
     fix:"并联审批 + 容缺受理，关键审批事项设置预警机制", orgs:["gov","agent","design"]},
    {t:"目标错位", sev:"中", d:"工期 / 质量 / 成本三角下各主体优先级冲突",
     ev:"赶工要求与净化工程养护周期的冲突在第三季度集中显现（示例数据）",
     fix:"建立目标对齐机制，将协同指标纳入各主体考核", orgs:["owner","agent","epc"]},
    {t:"医疗专项协同", sev:"高", d:"净化、放疗等专项设计与施工、采购交叉",
     ev:"专项界面不清导致局部返工，涉及走廊与机房衔接区域（示例数据）",
     fix:"专项设计前置，编制界面清单并设界面责任人", orgs:["design","epc","hosp"]},
    {t:"需求变更", sev:"中", d:"使用需求后置或反复调整，引发返工",
     ev:"施工阶段院方提出功能调整，涉及科室布局优化（示例数据）",
     fix:"设计阶段锁定需求清单，变更走评审流程并评估影响", orgs:["hosp","agent","design"]}
  ],
  dims:[
    {n:"权责清晰度",v:68},{n:"信息通畅度",v:75},{n:"审批效率",v:61},
    {n:"目标一致性",v:78},{n:"需求稳定性",v:58}
  ],
  prev:{date:"2025-12",total:67,dims:[66,71,57,80,55],
    orgs:{agent:71,owner:68,hosp:60,gov:63,design:74,epc:67,super:78,audit:85}}
};

/* 场景预设：模板无需改版，切换数据即切换项目（均为虚构示例） */
const SCENARIOS=[
{
  meta:{project:"示例项目：临江市轨道交通4号线",mode:"建设模式：代建制 + 施工总承包",
    date:"体检日期：2026-05",badge:"示例数据 · 虚构项目，仅作演示",progress:42},
  total:69,
  orgs:[
    {id:"owner", name:"业主单位（市轨道集团）", short:"轨道集团", type:"gov", health:71,
     role:"项目业主", power:"投资决策、开通时点把控",
     act:"需求确认、里程碑考核、接口协调", block:"征地拆迁与管线迁改协调难度大",
     tags:["业主","市属国企"], phases:[0,1,2,3,4,5]},
    {id:"agent", name:"代建单位（城建代建中心）", short:"代建中心", type:"core", health:73,
     role:"代建方 · 项目统筹", power:"全过程组织、协调、报建",
     act:"总控计划、接口协调、例会督办", block:"多权属单位协调链路长",
     tags:["代建制"], phases:[0,1,2,3,4,5]},
    {id:"design", name:"设计总体院", short:"总体院", type:"part", health:66,
     role:"勘察设计", power:"设计质量与进度",
     act:"出图、工点接口、动态设计", block:"工点 interface 多，变更集中",
     tags:["勘察设计"], phases:[0,1,2,3]},
    {id:"build", name:"施工总承包（盾构分公司）", short:"总承包", type:"part", health:62,
     role:"施工", power:"履约资源投入",
     act:"盾构掘进、监测、应急演练", block:"下穿既有线沉降控制压力",
     tags:["施工"], phases:[2,3,4]},
    {id:"supervise", name:"监理单位", short:"监理", type:"part", health:76,
     role:"监理", power:"质量 / 安全监督",
     act:"旁站、巡检、验收把关", block:"夜间施工监管人手不足",
     tags:["监理"], phases:[1,2,3,4]},
    {id:"gov", name:"政府审批部门", short:"审批部门", type:"gov", health:64,
     role:"发改 / 住建 / 交通 / 管线权属", power:"审批、占道许可、管线协调",
     act:"并联审批、占道许可、管线迁改统筹", block:"占道许可与管线迁改串联",
     tags:["审批监管"], phases:[0,1,2]},
    {id:"depot", name:"车辆基地与运维单位", short:"运维基地", type:"part", health:68,
     role:"运维", power:"接管标准与运维需求",
     act:"接口确认、运维需求前置", block:"运维需求后置导致接口新增",
     tags:["运维"], phases:[3,4,5]},
    {id:"public", name:"交警与管线权属单位", short:"管线/交警", type:"gov", health:58,
     role:"外部条件", power:"占道许可、迁改时序",
     act:"报装对接、错峰迁改", block:"报装时序与始发节点冲突",
     tags:["外部条件"], phases:[2,3,4]}
  ],
  links:[
    ["owner","agent","统筹考核",82],
    ["owner","design","设计管理",74],
    ["owner","build","施工监管",70],
    ["agent","design","设计进度",78],
    ["agent","build","施工组织",76],
    ["agent","supervise","监理协同",80],
    ["build","supervise","质量安全",72],
    ["design","build","图纸交底",63],
    ["owner","depot","运维对接",61],
    ["build","depot","接口移交",58],
    ["agent","public","管线/占道",55],
    ["owner","gov","审批推进",60]
  ],
  phases:[
    {label:"规划立项",date:"2024-03 ~ 2024-09",diag:"线位与建设模式论证完成，代建单位提前介入；审批串联偏长"},
    {label:"勘察设计",date:"2024-10 ~ 2025-06",diag:"总体院出图总体受控，工点接口多、变更集中"},
    {label:"拆迁与管线迁改",date:"2025-07 ~ 2026-02",diag:"占用关键工期，管线权属协调链路长，交警占道审批为卡点"},
    {label:"土建施工（盾构）",date:"2026-03 ~ 2027-08",diag:"盾构下穿既有线风险高，监测与例会机制运行良好"},
    {label:"机电与轨道",date:"2027-09 ~ 2028-05",diag:"设备招采与土建界面需提前锁定，运维需求应前置确认"},
    {label:"通车试运行",date:"2028-06 ~ 2028-12",diag:"验收与开通时点受制于前序接口，需倒排计划"}
  ],
  blockers:[
    {t:"管线迁改协调",sev:"高",d:"给水 / 燃气 / 电力权属单位各自报装，时序与盾构始发冲突",
     ev:"某区间燃气迁改滞后约 35 天，压缩盾构始发窗口（示例数据）",
     fix:"建管线综合协调专班，权属单位并联报装、占比错峰",orgs:["public","owner","agent"]},
    {t:"盾构下穿既有线",sev:"高",d:"下穿运营中 2 号线，沉降控制要求严",
     ev:"自动化监测日报与应急预案演练已覆盖全部区间（示例数据）",
     fix:"自动化监测日报 + 预警阈值联动的应急体系",orgs:["build","supervise","design"]},
    {t:"征拆滞后",sev:"中",d:"局部站点征拆影响交通疏解方案落地",
     ev:"两处站点交通疏解方案调整 3 轮（示例数据）",
     fix:"征拆清单与疏解方案同步编排、前置公示",orgs:["owner","gov","agent"]},
    {t:"设计变更集中",sev:"中",d:"工点接口多，变更闭环周期偏长",
     ev:"季内变更单平均闭环 18 天（示例数据）",
     fix:"变更分级评审 + 线上闭环时限",orgs:["design","agent","owner"]},
    {t:"交警占道审批",sev:"低",d:"夜间占道许可证发放周期不稳定",
     ev:"夜间施工窗口获批率约 80%（示例数据）",
     fix:"审批前置沟通 + 月度占道计划报送",orgs:["public","gov"]},
    {t:"运维需求后置",sev:"中",d:"车辆基地与正线接口需求在施工后期才明确",
     ev:"接口清单在机电阶段新增 12 项（示例数据）",
     fix:"运维单位在设计阶段提前介入，接口清单冻结管理",orgs:["depot","design","owner"]}
  ],
  dims:[
    {n:"权责清晰度",v:71},{n:"信息通畅度",v:72},{n:"审批效率",v:58},
    {n:"目标一致性",v:76},{n:"需求稳定性",v:60}
  ],
  prev:{date:"2025-11",total:73,dims:[68,73,52,70,56],
    orgs:{owner:69,agent:74,gov:59,build:66,supervise:77,depot:58,public:64,design:68}}
},
{
  meta:{project:"示例项目：临江市老城区排水管网改造",mode:"建设模式：代建制 + EPC",
    date:"体检日期：2026-07",badge:"示例数据 · 虚构项目，仅作演示",progress:35},
  total:63,
  orgs:[
    {id:"owner", name:"业主单位（区水务局）", short:"区水务局", type:"gov", health:66,
     role:"项目业主", power:"投资决策、接管标准",
     act:"需求确认、接管标准对齐", block:"移交接管标准口径不一",
     tags:["业主"], phases:[0,1,2,3,4]},
    {id:"agent", name:"代建单位", short:"代建办", type:"core", health:70,
     role:"代建方 · 项目统筹", power:"全过程组织、协调、报建",
     act:"总控计划、占道协调、例会督办", block:"街道与商户协调链路长",
     tags:["代建制"], phases:[0,1,2,3,4]},
    {id:"epc", name:"EPC 总承包", short:"EPC 总包", type:"part", health:59,
     role:"设计施工一体化", power:"资源投入与进度",
     act:"分段施工、动态配合设计", block:"地下水高、老管线不明段风险集中",
     tags:["EPC"], phases:[1,2,3,4]},
    {id:"design", name:"设计单位", short:"设计院", type:"part", health:68,
     role:"勘察设计", power:"设计方案",
     act:"物探复核、动态设计", block:"既有管网资料缺失",
     tags:["勘察设计"], phases:[0,1]},
    {id:"supervise", name:"监理单位", short:"监理", type:"part", health:74,
     role:"监理", power:"质量 / 安全监督",
     act:"旁站、巡检、验收把关", block:"夜间与雨季施工监管强度大",
     tags:["监理"], phases:[2,3,4]},
    {id:"community", name:"街道与社区", short:"街道/社区", type:"part", health:61,
     role:"属地协调", power:"居民与商户协调",
     act:"施工告知、诉求响应、公示", block:"投诉响应需要更快闭环",
     tags:["属地协调"], phases:[2,3]},
    {id:"gov", name:"政府审批部门", short:"审批部门", type:"gov", health:63,
     role:"住建 / 交警 / 水务", power:"审批、占道许可",
     act:"占道许可、分段验收备案", block:"占道许可发放周期不稳定",
     tags:["审批监管"], phases:[0,1,2]}
  ],
  links:[
    ["owner","agent","代建委托",81],
    ["owner","epc","EPC 总包管理",67],
    ["agent","epc","进度协调",69],
    ["agent","design","设计管理",77],
    ["epc","design","设计施工融合",71],
    ["agent","supervise","监理协同",79],
    ["epc","supervise","质量安全",62],
    ["agent","community","居民协调",64],
    ["owner","gov","审批推进",58],
    ["epc","community","施工告知",57]
  ],
  phases:[
    {label:"方案立项",date:"2025-09 ~ 2025-12",diag:"雨污分流方案论证完成，EPC 招采落地；前期物探深度不足"},
    {label:"施工图设计",date:"2026-01 ~ 2026-03",diag:"物探盲区采用动态设计，设计施工一体化优势显现"},
    {label:"交通疏解与占道",date:"2026-04 ~ 2026-08",diag:"分段占道审批与居民告知是关键路径，需街道联动"},
    {label:"分段施工",date:"2026-09 ~ 2027-06",diag:"顶管与开槽交替，地下水高、老管线不明段风险集中"},
    {label:"竣工验收与移交",date:"2027-07 ~ 2027-10",diag:"移交标准需与水务局及养护单位提前对齐"}
  ],
  blockers:[
    {t:"占道与交通疏解",sev:"高",d:"老城区道路资源紧张，分段占道审批与居民出行矛盾突出",
     ev:"高峰期投诉单月 46 起，疏解方案调整 4 轮（示例数据）",
     fix:"分段错峰 + 街道前置公示，设立 24 小时响应群",orgs:["community","gov","epc"]},
    {t:"老管网资料缺失",sev:"中",d:"既有管网竣工资料不全，物探盲区导致设计变更",
     ev:"物探补测新增管线 27 处（示例数据）",
     fix:"动态设计 + 挖探复核，资料沉淀为管网一张图",orgs:["design","epc","owner"]},
    {t:"地下水高与管线不明",sev:"高",d:"顶管段遇流砂与不明管线，存在安全和返工风险",
     ev:"顶管段平均进度低于计划 22%（示例数据）",
     fix:"超前地质预报 + 管线探测先行，专项方案评审",orgs:["epc","supervise","design"]},
    {t:"居民协调",sev:"中",d:"施工噪音、停水告知与商户经营诉求需快速响应",
     ev:"停水告知提前 24 小时落实率约 90%（示例数据）",
     fix:"社区共建联络员机制，施工告知标准化",orgs:["community","agent"]},
    {t:"移交接管标准",sev:"低",d:"竣工资料与养护标准口径不一致，移交周期长",
     ev:"首批段移交比计划晚 20 天（示例数据）",
     fix:"建设期即按养护标准建档，分批验收移交",orgs:["owner","epc","supervise"]}
  ],
  dims:[
    {n:"权责清晰度",v:64},{n:"信息通畅度",v:70},{n:"审批效率",v:55},
    {n:"目标一致性",v:72},{n:"需求稳定性",v:51}
  ],
  prev:{date:"2025-10",total:66,dims:[67,68,52,70,57],
    orgs:{owner:62,agent:66,epc:55,design:64,supervise:72,community:66,gov:60}}
},
{
  meta:{project:"示例项目：临江市第九九年制学校",mode:"建设模式：代建制 + 施工总承包",
    date:"体检日期：2026-04",badge:"示例数据 · 虚构项目，仅作演示",progress:61},
  total:70,
  orgs:[
    {id:"agent", name:"代建单位", short:"代建办", type:"core", health:76,
     role:"代建方 · 项目统筹", power:"全过程组织、协调、报批、投资控制",
     act:"并联推进各主体、每周例会协调、月报报送", block:"开学节点倒排下的多专项统筹",
     tags:["代建制","项目统筹"], phases:[0,1,2,3,4,5]},
    {id:"owner", name:"业主单位（区教育局）", short:"教育局", type:"gov", health:72,
     role:"项目业主", power:"投资决策、学位测算、开学时点",
     act:"需求提报、验收确认、资金拨付", block:"学位测算与建设规模反复对齐",
     tags:["业主","教育"], phases:[0,2,4,5]},
    {id:"school", name:"使用单位（校方）", short:"校方筹建组", type:"part", health:64,
     role:"使用单位", power:"办学需求、功能确认",
     act:"功能需求提报、教育信息化与实验室专项对接", block:"教育专项需求后置、变更频繁",
     tags:["使用单位","教育专项"], phases:[1,3,4,5]},
    {id:"gov", name:"政府审批部门", short:"审批部门", type:"gov", health:67,
     role:"发改 / 住建 / 教育 / 消防", power:"审批、资金、土地",
     act:"并联审批、消防与教育专项验收", block:"消防与教育专项验收时序交叉",
     tags:["审批监管"], phases:[0,1,2,4]},
    {id:"design", name:"设计单位", short:"设计院", type:"part", health:74,
     role:"勘察设计", power:"设计质量与进度",
     act:"图纸交付、设计变更、校园专项设计", block:"声学/照明与教室布局的细节咬合",
     tags:["勘察设计"], phases:[1,3,4]},
    {id:"epc", name:"施工总承包", short:"总承包", type:"part", health:69,
     role:"施工总承包", power:"工期、造价、安全、质量",
     act:"现场实施、分包管理、进度汇报", block:"运动场与外墙界面交叉施工",
     tags:["施工总承包"], phases:[2,3,4]},
    {id:"super", name:"监理单位", short:"监理", type:"part", health:81,
     role:"工程监理", power:"质量、进度、安全监督",
     act:"旁站、验收签认、监理例会", block:"声学/安防等专项检测见证频次不足",
     tags:["监理"], phases:[3,4]},
    {id:"community", name:"周边社区与街道", short:"社区街道", type:"gov", health:78,
     role:"外部相关方", power:"施工扰民协调、入学政策配合",
     act:"施工协调、入学摸底对接", block:"施工噪声与渣土运输的投诉压力",
     tags:["外部相关方"], phases:[2,3,4]}
  ],
  links:[
    ["agent","owner","报批/需求",75],["agent","school","需求对接",59],
    ["agent","gov","审批推进",66],["agent","design","设计协同",77],
    ["agent","epc","施工统筹",72],["agent","super","监理协同",83],
    ["owner","school","学位测算",68],["owner","gov","立项/资金",71],
    ["epc","design","施工图衔接",63],["epc","super","验收签认",80],
    ["design","gov","图审",61],["epc","community","施工协调",54]
  ],
  phases:[
    {label:"前期立项", date:"2023-05", diag:"立项与学位测算同步推进，但校方尚未成立筹建组，办学需求只能由教育局代为转述。"},
    {label:"勘察设计", date:"2023-09", diag:"教室声学、照明与教育信息化专项在设计阶段未完全闭合，为施工期变更埋下隐患。"},
    {label:"招标采购", date:"2024-02", diag:"施工总承包与教育信息化采购界面划分清晰，但运动场基层由谁施工一度存在分歧。"},
    {label:"施工实施", date:"2024-06", diag:"开学节点倒排工期下，外墙、运动场、室内安装三线交叉，社区对施工噪声投诉集中。"},
    {label:"专项验收", date:"2026-01", diag:"消防与教育专项验收时序交叉，资料归集口径不一拖累总体进度。"},
    {label:"移交开学", date:"2026-04", diag:"校方功能确认与移交组织有序，学位摸底与建设规模最终对齐。"}
  ],
  blockers:[
    {t:"教育专项需求后置", sev:"高", d:"信息化、实验室等需求在施工阶段才细化，引发返工",
     ev:"信息化桥架与插座点位三度调整（示例数据）",
     fix:"设计阶段锁定办学需求清单，变更走评审并评估工期影响", orgs:["school","agent","design"]},
    {t:"审批时序依赖", sev:"高", d:"消防与教育专项验收串联，前置件未出则后续停摆",
     ev:"消防验收排队约 15 天，影响开学准备（示例数据）",
     fix:"并联报建 + 容缺受理，验收事项设置预警机制", orgs:["gov","agent"]},
    {t:"施工噪声与社区协调", sev:"中", d:"夜间渣土与噪声引发投诉，施工窗口被压缩",
     ev:"季度内社区投诉 8 起，2 次约谈（示例数据）",
     fix:"施工窗口与社区公示联动，渣土运输避开敏感时段", orgs:["epc","community","agent"]},
    {t:"权责边界模糊", sev:"中", d:"运动场基层、绿化等界面在合同中约定留白",
     ev:"界面争议导致工期延误约 10 天（示例数据）",
     fix:"编制界面清单并签认，明确各分项牵头主体", orgs:["agent","epc","design"]},
    {t:"目标错位", sev:"中", d:"教育局重开学时点、校方重功能完整性、总包重成本",
     ev:"开学时点与样板教室标准在第三季度冲突（示例数据）",
     fix:"建立三级目标对齐机制，协同指标纳入考核", orgs:["owner","school","epc"]},
    {t:"信息口径不一致", sev:"低", d:"现场进度与教育局台账口径不一",
     ev:"周报与台账形象进度偏差 2 个百分点（示例数据）",
     fix:"统一数据底座与报表口径，例会固定通报", orgs:["agent","owner"]}
  ],
  dims:[
    {n:"权责清晰度",v:73},{n:"信息通畅度",v:74},{n:"审批效率",v:62},
    {n:"目标一致性",v:75},{n:"需求稳定性",v:60}
  ],
  prev:{date:"2025-10",total:67,dims:[69,69,58,72,56],
    orgs:{agent:73,owner:70,school:58,gov:64,design:71,epc:66,super:80,community:80}}
},
{
  meta:{project:"示例项目：临江市第三水厂提标改造",mode:"建设模式：代建制 + EPC",
    date:"体检日期：2026-03",badge:"示例数据 · 虚构项目，仅作演示",progress:55},
  total:67,
  orgs:[
    {id:"agent", name:"代建单位", short:"代建办", type:"core", health:71,
     role:"代建方 · 项目统筹", power:"全过程组织、协调、报批、投资控制",
     act:"停水切换组织、节点协调、月报报送", block:"新旧系统接驳的多专业统筹",
     tags:["代建制","项目统筹"], phases:[0,1,2,3,4,5]},
    {id:"owner", name:"业主单位（水务集团）", short:"水务集团", type:"gov", health:73,
     role:"项目业主", power:"投资决策、供水安全、运行考核",
     act:"停水窗口审批、运行考核、资金拨付", block:"停电停水窗口与施工范围的反复博弈",
     tags:["业主","供水"], phases:[0,1,2,3,4,5]},
    {id:"operate", name:"运行单位（水厂）", short:"水厂运行部", type:"part", health:65,
     role:"运行单位", power:"运行安全、工艺确认",
     act:"运行人员提前介入、工艺参数确认", block:"运行规程与新建工艺的衔接培训不足",
     tags:["运行单位","工艺"], phases:[2,3,4,5]},
    {id:"gov", name:"政府审批部门", short:"审批部门", type:"gov", health:62,
     role:"水务 / 住建 / 环保", power:"审批、环保标准、资金",
     act:"并联审批、环保验收、取水许可", block:"提标标准与审批口径的更新滞后",
     tags:["审批监管","环保"], phases:[0,1,2,4]},
    {id:"design", name:"设计单位", short:"设计院", type:"part", health:70,
     role:"勘察设计", power:"工艺与结构设计",
     act:"图纸交付、老管线交底、设计变更", block:"老管线资料缺失导致交底不足",
     tags:["勘察设计"], phases:[1,3,4]},
    {id:"epc", name:"EPC 总承包", short:"EPC", type:"part", health:64,
     role:"施工总承包", power:"工期、造价、安全、质量",
     act:"深基坑施工、设备安装、调试配合", block:"设备到货滞后与安装交叉冲突",
     tags:["EPC","设备安装"], phases:[2,3,4]},
    {id:"super", name:"监理单位", short:"监理", type:"part", health:79,
     role:"工程监理", power:"质量、安全、停水见证",
     act:"深基坑旁站、停水切换见证", block:"夜间停水施工的见证力量不足",
     tags:["监理"], phases:[3,4]},
    {id:"community", name:"受影响居民与商户", short:"周边商户", type:"gov", health:76,
     role:"外部相关方", power:"停水与交通影响反馈",
     act:"停水通知确认、施工围挡协调", block:"停水时段与商户经营冲突",
     tags:["外部相关方"], phases:[2,3,4]}
  ],
  links:[
    ["agent","owner","报批/窗口",74],["agent","operate","运行衔接",60],
    ["agent","gov","审批推进",63],["agent","design","设计协同",75],
    ["agent","epc","施工统筹",70],["agent","super","监理协同",81],
    ["owner","operate","工艺考核",66],["owner","gov","标准/许可",64],
    ["epc","design","图纸交底",58],["epc","super","基坑见证",78],
    ["design","gov","环评论证",65],["epc","community","停水协调",52]
  ],
  phases:[
    {label:"前期立项", date:"2023-08", diag:"提标标准在立项后更新，设计规模随之调整，审批口径一度不一致。"},
    {label:"勘察设计", date:"2024-01", diag:"老管线资料缺失，交底深度不足，深基坑段设计变更集中。"},
    {label:"招标采购", date:"2024-07", diag:"设备采购与安装界面划分不清，膜组件等长周期设备到货滞后于计划。"},
    {label:"施工实施", date:"2024-11", diag:"深基坑与既有水厂运行毗邻，安全与保供压力叠加；夜间停水切换频繁。"},
    {label:"调试验收", date:"2026-02", diag:"调试与环保验收交叉，运行人员介入偏晚，工艺参数确认反复。"},
    {label:"通水移交", date:"2026-03", diag:"临时通水与正式移交界面清晰，运行规程在移交前补齐。"}
  ],
  blockers:[
    {t:"停水切换窗口紧张", sev:"高", d:"停水窗口与施工范围反复博弈，夜间施工风险高",
     ev:"一季度 6 次夜间停水切换，2 次超出窗口时长（示例数据）",
     fix:"窗口核定前置：施工量倒排 + 机动备用窗口，切换全程双见证", orgs:["owner","agent","epc"]},
    {t:"老管线交底不足", sev:"高", d:"既有管网资料缺失，深基坑与接驳风险叠加",
     ev:"开挖碰撞老管线 3 起，其中 1 起导致临时停水（示例数据）",
     fix:"开工前物探复核 + 管网一张图共享，接驳段人工探挖", orgs:["design","epc","agent"]},
    {t:"设备到货滞后", sev:"高", d:"膜组件等长周期设备到货晚于安装窗口",
     ev:"到货滞后约 25 天，安装与土建交叉返工（示例数据）",
     fix:"长周期设备采购前置，到货与安装计划联动预警", orgs:["epc","agent","design"]},
    {t:"审批标准更新滞后", sev:"中", d:"提标标准更新后报建口径未同步刷新",
     ev:"环评补充材料一次退回，延误约 12 天（示例数据）",
     fix:"标准更新即触发口径复核，报建清单版本化管理", orgs:["gov","agent"]},
    {t:"运行介入偏晚", sev:"中", d:"调试中后期运行人员才介入，工艺参数确认反复",
     ev:"调试记录显示 4 项参数由运行方二次确认（示例数据）",
     fix:"运行提前介入机制：施工图会签即驻场，调试全程参与", orgs:["operate","agent","epc"]},
    {t:"停水与商户经营冲突", sev:"低", d:"停水时段与周边商户经营时段冲突",
     ev:"停水通知后收到 5 起商户反馈（示例数据）",
     fix:"通知提前 72 小时 + 分区分时段停水，高峰避开经营时段", orgs:["community","owner","epc"]}
  ],
  dims:[
    {n:"权责清晰度",v:70},{n:"信息通畅度",v:72},{n:"审批效率",v:57},
    {n:"目标一致性",v:71},{n:"需求稳定性",v:63}
  ],
  prev:{date:"2025-09",total:64,dims:[66,66,54,68,60],
    orgs:{agent:68,owner:70,operate:60,gov:60,design:66,epc:60,super:76,community:72}}
}
];

/* ================= 数据层（导入 / 导出 / 重渲染） ================= */
let DATA=null;
function loadData(d){
  DATA=d;
  view.z=1;view.x=view.y=0;   // v12：复位画布视口
  kbNode=null;hoverNode=null;selNode=null;selLink=null;dragNode=null;panning=false;
  // header
  const m=d.meta||{};
  // v7：徽章声明并入信息条（原 header badge 已移除）
  $("metaChips").innerHTML=
    `<span class="chip">${esc(m.badge||"示例数据 · 虚构项目，仅作演示")}</span>`+
    `<span class="chip">${esc(m.project||"")}</span>`+
    `<span class="chip">${esc(m.mode||"")}</span>`+
    `<span class="chip">${esc(m.date||"")}</span>`;
  // v7：先算维度归因（总览维度列表 / 卡点角标 / 维度过滤都依赖它）
  attrMap=(d.blockers||[]).map(dimOfBlocker);
  activeDim=null;
  const pct=Math.max(0,Math.min(100,m.progress==null?88:m.progress));
  $("tlFill").style.width=pct+"%";
  const tlNow=$("tlNow");
  if(tlNow){
    tlNow.style.left=pct+"%";
    tlNow.querySelector("span").textContent="当前 "+pct+"%";
    tlNow.classList.toggle("tail",pct>=92); // v6：贴右边缘时翻转标签防溢出
  }
  // overview（v7 英雄区）
  buildOverview();
  // timeline
  buildTimeline();
  // net
  buildNet();
  // blockers
  buildBlockers();
  // 风险速览（v3）
  buildRisks();
  // 对比面板（v4，若处于对比模式则随数据刷新）
  if(typeof renderCompare==="function")renderCompare();
  // 重置详情与报告
  detail.innerHTML=`<h3>诊断详情</h3><div class="empty">点击总览五维、时间轴阶段、网络中的主体或关系、或下方卡点，在此查看结构化诊断。</div>`;
  activePhase=null;activeBlocker=null;
  const si=$("blkSearch");if(si)si.value="";
  const sc2=$("blkCount");if(sc2)sc2.textContent="";
  $("netHint").classList.remove("show");
  resetReport();
}
function clone(o){return JSON.parse(JSON.stringify(o));}

/* ================= 总览：环形图 + 维度条 ================= */
/* v11：五维签名色 —— 点击维度时该色贯穿角标 / 详情 / 网络高亮环 */
const DIM_COLORS_LIGHT=["#3b5bdb","#0891b2","#7c3aed","#059669","#db2777"];
const DIM_COLORS_DARK =["#818cf8","#22d3ee","#a78bfa","#34d399","#f472b6"];
function dimColorOf(i){
  const a=isDark()?DIM_COLORS_DARK:DIM_COLORS_LIGHT;
  return a[i%a.length];
}
/* v7：自动总检结论（结论先行） */
function buildConclusion(){
  const dims=(DATA.dims||[]).slice().sort((a,b)=>b.v-a.v);
  const highs=(DATA.blockers||[]).filter(b=>b.sev==="高").length;
  const parts=[];
  const weak=dims.filter(d=>d.v<70).map(d=>d.n);
  const strong=dims.slice(0,2).filter(d=>d.v>=75).map(d=>d.n);
  if(strong.length)parts.push("「"+strong.join("、")+"」保持优势");
  if(weak.length)parts.push("「"+weak.join("、")+"」为短板项，建议优先干预");
  if(highs>0)parts.push("识别出高风险协同卡点 "+highs+" 项，建议 30 天内启动分诊整改");
  if(!parts.length)parts.push("五维评分均在 70 分以上，无高风险卡点，协同体系总体可控");
  /* v12：复查同比 */
  const prev=DATA.prev;
  if(prev&&typeof prev.total==="number"&&prev.date){
    const dT=(DATA.total||0)-prev.total;
    const dimsNow=(DATA.dims||[]), dimsPrev=prev.dims||[];
    const worse=dimsNow.map((x,i)=>({n:x.n,d:(typeof dimsPrev[i]==="number")?x.v-dimsPrev[i]:null}))
      .filter(x=>x.d!==null&&x.d<0).map(x=>x.n);
    const better=dimsNow.map((x,i)=>({n:x.n,d:(typeof dimsPrev[i]==="number")?x.v-dimsPrev[i]:null}))
      .filter(x=>x.d!==null&&x.d>0).map(x=>x.n);
    const t=(dT>0?"+":dT<0?"":"持平")+dT;
    parts.push("较上次体检（"+prev.date+"）总分 "+t+
      (better.length?"，「"+better.join("、")+"」改善":"")+
      (worse.length?(!better.length?"":"，")+"「"+worse.join("、")+"」恶化":""));
  }
  return "总体协同框架"+((DATA.total||0)>=75?"运转成熟，可沉淀为标准动作":(DATA.total||0)>=65?"基本有效，仍有可观察的提升空间":"存在明显结构性缺口，需专题整改")+"。"+parts.join("；")+"。";
}
/* v7：五维雷达图 SVG */
function buildRadarSVG(){
  const dims=DATA.dims||[];
  const n=dims.length;
  if(n<3)return "";
  const cx=115, cy=115, R=80;
  const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  const pt=(i,r)=>[cx+Math.cos(ang(i))*r, cy+Math.sin(ang(i))*r];
  const ring=r=>dims.map((_,i)=>pt(i,r).map(v=>v.toFixed(1)).join(",")).join(" ");
  const pp=PAL();
  const ink=pp.nodeText, muted=pp.label, good=pp.good, bad=pp.bad, line=pp.track;
  let g="";
  [1,0.75,0.5,0.25].forEach((f,k)=>{
    g+=`<polygon points="${ring(R*f)}" fill="none" stroke="${line}" stroke-width="${k===0?1.4:0.8}"/>`;
  });
  dims.forEach((d,i)=>{
    const [x,y]=pt(i,R);
    g+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${line}" stroke-width="0.8"/>`;
    const [lx,ly]=pt(i,R+20);
    const val=Math.max(0,Math.min(100,d.v));
    const weak=val<70;
    g+=`<text x="${lx.toFixed(1)}" y="${(ly+4).toFixed(1)}" text-anchor="middle" font-size="10.5" fill="${weak?bad:muted}" font-weight="${weak?700:500}">${esc(d.n)} ${val}</text>`;
  });
  const pts=dims.map((d,i)=>pt(i,R*Math.max(0,Math.min(100,d.v))/100).map(v=>v.toFixed(1)).join(",")).join(" ");
  const verts=dims.map((d,i)=>{const [x,y]=pt(i,R*Math.max(0,Math.min(100,d.v))/100);return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${d.v<70?bad:good}"/>`;}).join("");
  g+=`<polygon points="${pts}" fill="${good}28" stroke="${good}" stroke-width="2"/>`+verts;
  g+=`<text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="13" font-family="Georgia,serif" fill="${ink}" font-weight="700">${DATA.total||0}</text>`;
  return `<svg width="230" height="230" viewBox="0 0 230 230" role="img" aria-label="五维协同评分雷达图">${g}</svg>`;
}
/* v7：维度↔卡点归因（关键词规则，取首个命中最多的维度） */
const DIM_RULES=[
  /权责|边界|职责|分工|牵头/,
  /信息|数据|口径|对称|资料|报表|告知|投诉/,
  /审批|时序|前置|许可|串联|报装|迁改|征拆|占道/,
  /目标|错位|考核|优先|冲突/,
  /需求|变更|反复|界面|专项/
];
function dimOfBlocker(b){
  const txt=(b.t||"")+" "+(b.d||"")+" "+(b.ev||"")+" "+(b.fix||"");
  const counts=(DATA.dims||[]).map(()=>0);
  DIM_RULES.forEach((re,di)=>{ if(re.test(txt)&&di<counts.length)counts[di]++; });
  let best=-1;
  counts.forEach((c,i)=>{ if(c>0&&(best<0||c>counts[best]))best=i; });
  return best;
}
function clearDimSel(){
  activeDim=null;
  document.querySelectorAll(".dim-row").forEach(r=>r.setAttribute("aria-pressed","false"));
  document.querySelectorAll(".blk").forEach(el=>el.classList.remove("dim-fade"));
}
/* v7：维度过滤（与阶段 / 卡点同为「单一过滤器」语义） */
function pickDim(i){
  const rows=document.querySelectorAll(".dim-row");
  const was=activeDim===i;
  activeDim=was?null:i;
  selNode=null;selLink=null;activeBlocker=null;activePhase=null;
  clearBlkSel();clearTlSel();updateQuickSel();
  rows.forEach((r,k)=>r.setAttribute("aria-pressed",k===i?"true":"false"));
  document.querySelectorAll(".blk").forEach((el,k)=>{
    el.classList.toggle("dim-fade",activeDim!==null&&attrMap[k]!==activeDim);
  });
  if(activeDim!==null){
    const d=DATA.dims[activeDim];
    const rel=(DATA.blockers||[]).map((b,k)=>({b,k})).filter(x=>attrMap[x.k]===activeDim);
    const weak=(d.v||0)<70?"<div class='row'><span class='k'>状态</span>低于 70 分，判定为短板项</div>":"";
    const chips=rel.length
      ? rel.map(x=>`<button class="tag gov" data-bi="${x.k}">⚑ ${esc(x.b.t)}</button>`).join("")
      : "<span class='empty'>该维度下暂无归因卡点</span>";
    detail.innerHTML=`<h3 style="color:${dimColorOf(activeDim)}">维度诊断 · ${esc(d.n)}</h3>
      <div class="row"><span class="k">评分</span><b style="font-family:var(--serif);font-size:20px;color:${dimColorOf(activeDim)}">${d.v}</b> / 100</div>
      ${weak}
      <div class="row"><span class="k">归因卡点（点击展开）</span>${chips}</div>`;
    detail.querySelectorAll("button.tag[data-bi]").forEach(btn=>{
      btn.addEventListener("click",()=>jumpToBlocker(parseInt(btn.dataset.bi,10)));
    });
    const names=(DATA.orgs||[]).filter(o=>rel.some(x=>(x.b.orgs||[]).includes(o.id))).map(o=>o.short);
    $("netHint").classList.add("show");
    $("netHint").textContent="维度归因：「"+d.n+"」高亮 "+names.length+" 个关联主体（"+(names.join("、")||"—")+"）";
  }else{
    $("netHint").classList.remove("show");
    detail.innerHTML=`<h3>诊断详情</h3><div class="empty">点击总览五维、时间轴阶段、网络中的主体或关系、或下方卡点，在此查看结构化诊断。</div>`;
  }
  wake();
}
function buildOverview(){
  const TOTAL=Math.max(0,Math.min(100,DATA.total||0));
  // v7：报告头编号与签发日期
  $("reportNo").textContent=buildReportNo();
  $("reportDate").textContent="签发："+((DATA.meta&&DATA.meta.date)||"—");
  // 大数字计数
  let n=0;const sv=$("scoreV");
  sv.textContent="0";
  clearInterval(sv._iv);
  sv._iv=setInterval(()=>{
    n++;sv.textContent=n;
    if(n>=TOTAL){sv.textContent=TOTAL;clearInterval(sv._iv);}
  },16);
  // 印章（v7：从等级「良（B）」拆出名称与字母）
  const gstr=gradeOf(TOTAL);
  const seal=$("gradeSeal");
  if(seal){
    const m=/^(.+?)（(.)）$/.exec(gstr);
    if(m){
      seal.innerHTML=esc(m[1])+"<b>"+esc(m[2])+"</b>";
      $("gradeNote").textContent="协同健康度 · "+m[1]+"（"+m[2]+"）";
    }
  }
  /* v12：复查快照 —— 总分较上次 */
  const chip=$("deltaChip");
  if(chip){
    const prev=DATA.prev;
    if(prev&&typeof prev.total==="number"&&prev.date){
      const d=TOTAL-prev.total;
      chip.hidden=false;
      chip.className="delta-chip "+(d>0?"up":d<0?"down":"eq");
      chip.textContent="较上次（"+esc(prev.date)+"）"+(d>0?"+"+d:d===0?"持平":d)+" 分";
    }else{
      chip.hidden=true;chip.textContent="";
    }
  }
  const hc=$("heroConcl");
  if(hc)hc.textContent=buildConclusion();
  const rb=$("radarBox");
  if(rb)rb.innerHTML=buildRadarSVG();
  const dimsEl=$("dims");
  dimsEl.innerHTML="";
  const sorted=(DATA.dims||[]).map((d,i)=>({d,i})).sort((a,b)=>b.d.v-a.d.v);
  const weakest=sorted.length?sorted[sorted.length-1].i:-1;
  sorted.forEach(({d,i},k)=>{
    const row=document.createElement("button");
    row.className="dim-row";row.type="button";
    row.setAttribute("aria-pressed","false");
    row.setAttribute("aria-label","维度 "+d.n+"，评分 "+d.v+(i===weakest?"，短板项":"")+"，点击按维度过滤关联卡点");
    const cnt=attrMap.filter(a=>a===i).length;
    row.setAttribute("style","--band-color:"+dimColorOf(i));   /* v11：维度签名色 */
    /* v12：复查 Δ —— ▲ 改善 / ▼ 恶化 */
    const pv=(DATA.prev&&DATA.prev.dims)?DATA.prev.dims[i]:null;
    const dd=(typeof pv==="number")?(d.v-pv):null;
    const ddHtml=dd===null?"":'<span class="ddelta '+(dd>0?"up":dd<0?"down":"eq")+'">'+
      (dd>0?"▲ +"+dd:dd<0?"▼ "+dd:"— 0")+"</span>";
    row.innerHTML=`<span>${esc(d.n)}${i===weakest?'<span class="weak">短板</span>':""}${cnt?'<span class="dcnt">归因 '+cnt+' 项</span>':""}${ddHtml}</span><span class="dv">${d.v}</span>`;
    row.addEventListener("click",()=>pickDim(i));
    dimsEl.appendChild(row);
  });
}

/* ================= 时间轴 ================= */
const tl=$("tl");
let activePhase=null;
function buildTimeline(){
  tl.querySelectorAll(".tl-m,.tl-label,.tl-date,.tl-dots").forEach(x=>x.remove());
  const P=DATA.phases||[];
  P.forEach((p,i)=>{
    const pos=P.length<2?50:i/(P.length-1)*100;
    const edge=i===0?"lead":i===P.length-1?"tail":"";
    const dot=document.createElement("button");
    dot.className="tl-m";dot.style.left=pos+"%";
    dot.setAttribute("aria-label","阶段："+p.label+"，"+p.date);
    dot.setAttribute("aria-pressed","false");
    dot.addEventListener("click",()=>pickPhase(i));
    tl.appendChild(dot);
    const lab=document.createElement("div");
    lab.className="tl-label "+edge;lab.style.left=pos+"%";
    lab.textContent=p.label;
    lab.setAttribute("role","button");
    lab.setAttribute("tabindex","0");
    lab.setAttribute("aria-label","阶段："+p.label+"，"+p.date);
    lab.addEventListener("click",()=>pickPhase(i));
    lab.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pickPhase(i);}});
    tl.appendChild(lab);
    const dt=document.createElement("div");
    dt.className="tl-date "+edge;dt.style.left=pos+"%";
    dt.textContent=p.date;tl.appendChild(dt);
    // v7：该阶段参与主体密度（装饰性）
    const cnt=(DATA.orgs||[]).filter(o=>(o.phases||[]).includes(i)).length;
    const dr=document.createElement("div");
    dr.className="tl-dots "+edge;dr.style.left=pos+"%";
    for(let k=0;k<cnt;k++)dr.appendChild(document.createElement("i"));
    tl.appendChild(dr);
  });
}
function pickPhase(i){
  const dots=tl.querySelectorAll(".tl-m");
  const was=activePhase===i;
  activePhase=was?null:i;
  // 统一为「单一过滤器」：清除主体 / 关系 / 卡点 / 维度选中态
  selNode=null;selLink=null;activeBlocker=null;
  clearBlkSel();updateQuickSel();clearDimSel();
  dots.forEach(d=>d.classList.remove("sel"));
  if(activePhase!==null){
    dots[i].classList.add("sel");
    dots.forEach((d,k)=>d.setAttribute("aria-pressed",k===i?"true":"false"));
    const p=DATA.phases[i];
    const names=(DATA.orgs||[]).filter(o=>(o.phases||[]).includes(i)).map(o=>o.short);
    detail.innerHTML=`<h3>阶段诊断 · ${esc(p.label)}</h3>
      <div class="row"><span class="k">时间</span>${esc(p.date)}</div>
      <div class="row"><span class="k">阶段诊断</span>${esc(p.diag)}</div>
      <div class="row"><span class="k">参与主体</span>${esc(names.join("、")||"—")}</div>`;
    $("netHint").classList.add("show");
    $("netHint").textContent="阶段过滤：「"+p.label+"」高亮参与主体，其余主体淡出";
  }else{
    dots.forEach(d=>d.setAttribute("aria-pressed","false"));
    $("netHint").classList.remove("show");
    detail.innerHTML=`<h3>诊断详情</h3><div class="empty">点击总览五维、时间轴阶段、网络中的主体或关系、或下方卡点，在此查看结构化诊断。</div>`;
  }
  wake();
}

/* ================= 关系网络（力导向） ================= */
const canvas=$("net"), ctx=canvas.getContext("2d");
let W=0,H=0,N=[],L=[];
function resize(){
  const r=canvas.getBoundingClientRect();
  const dpr=window.devicePixelRatio||1;
  W=Math.max(280,r.width);
  H=Math.max(300,r.height||430);
  canvas.width=W*dpr;canvas.height=H*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize",resize);

let selNode=null,selLink=null,hoverNode=null,dragNode=null,moved=false,mx0=0,my0=0;
let kbNode=null; // v4：键盘导航焦点节点
let activeBlocker=null;
/* v12：画布视口 —— 滚轮缩放（0.5–2.5）/ 背景拖拽平移 / 0 键复位 */
const view={z:1,x:0,y:0};
let panning=false,panMoved=false,lx=0,ly=0;
/* 健康度色带：v11 语义多色 —— 翠(≥75) / 靛(65–74) / 红(<65)；维度签名色用于过滤高亮 */
const PAL_LIGHT={good:"#059669",mid:"#3b5bdb",bad:"#dc2626",
  link:"59,91,219",linkBad:"220,38,38",label:"#5b6b80",nodeFill:"#ffffff",
  nodeText:"#182230",nodeTextOn:"#ffffff",track:"#e7ebf0",heavy:"#182230"};
const PAL_DARK={good:"#34d399",mid:"#818cf8",bad:"#f0524a",
  link:"129,140,248",linkBad:"240,82,74",label:"#8a96ab",nodeFill:"#141c2e",
  nodeText:"#e6eaf2",nodeTextOn:"#0b1120",track:"#1e2740",heavy:"#e6eaf2"};
function PAL(){return isDark()?PAL_DARK:PAL_LIGHT;}
function colorOf(o){
  const p=PAL();
  const h=o.health;
  if(h==null)return p.mid;
  if(h<65)return p.bad;
  if(h<75)return p.mid;
  return p.good;
}
function phaseOrgs(){
  if(activePhase===null)return null;
  return new Set((DATA.orgs||[]).filter(o=>(o.phases||[]).includes(activePhase)).map(o=>o.id));
}
function blockerOrgs(){
  if(activeBlocker===null)return null;
  return new Set(DATA.blockers[activeBlocker].orgs||[]);
}
/* v7：维度归因过滤 —— 某维度下被归因卡点涉及的主体集合 */
let activeDim=null, attrMap=[];
function dimOrgs(){
  if(activeDim===null)return null;
  const s=new Set();
  (DATA.blockers||[]).forEach((b,i)=>{
    if(attrMap[i]===activeDim)(b.orgs||[]).forEach(id=>s.add(id));
  });
  return s;
}
function dimOf(n,l){
  const inPhase=phaseOrgs(), inBlk=blockerOrgs(), inDim=dimOrgs();
  if(inPhase!==null){
    if(!inPhase.has(n.id))return 0.16;
    if(l!==undefined&&!(inPhase.has(N[l.a].id)&&inPhase.has(N[l.b].id)))return 0.16;
  }
  if(inBlk!==null){
    if(!inBlk.has(n.id))return 0.16;
    if(l!==undefined&&!(inBlk.has(N[l.a].id)&&inBlk.has(N[l.b].id)))return 0.16;
  }
  if(inDim!==null){
    if(!inDim.has(n.id))return 0.16;
    if(l!==undefined&&!(inDim.has(N[l.a].id)&&inDim.has(N[l.b].id)))return 0.16;
  }
  if(selNode){
    if(n!==selNode&&!L.some(x=>(x.a===selNode.i&&x.b===n.i)||(x.b===selNode.i&&x.a===n.i)))return 0.18;
    if(l!==undefined&&l.a!==selNode.i&&l.b!==selNode.i)return 0.18;
  }
  if(selLink){
    if(n!==N[selLink.a]&&n!==N[selLink.b])return 0.18;
    if(l!==undefined&&l!==selLink)return 0.18;
  }
  return 1;
}
function step(){
  const cx=W/2,cy=H/2;
  for(let i=0;i<N.length;i++){const a=N[i];
    for(let j=i+1;j<N.length;j++){const b=N[j];
      let dx=a.x-b.x,dy=a.y-b.y,d2=dx*dx+dy*dy||1,d=Math.sqrt(d2);
      const f=Math.min(2600/d2,3);
      dx/=d;dy/=d;a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;}
    a.vx+=(cx-a.x)*0.004;a.vy+=(cy-a.y)*0.004;}
  L.forEach(e=>{const a=N[e.a],b=N[e.b];
    let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,f=(d-150)*0.012;
    dx/=d;dy/=d;a.vx+=dx*f;a.vy+=dy*f;b.vx-=dx*f;b.vy-=dy*f;});
  N.forEach(n=>{if(n===dragNode)return;
    n.vx*=0.82;n.vy*=0.82;n.x+=n.vx;n.y+=n.vy;
    n.x=Math.max(60,Math.min(W-60,n.x));n.y=Math.max(45,Math.min(H-45,n.y));});
}
function draw(){
  const p=PAL();
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(view.x,view.y);ctx.scale(view.z,view.z);   /* v12：视口变换 */
  L.forEach(l=>{
    const a=N[l.a],b=N[l.b];
    const da=dimOf(a),db=dimOf(b),al=Math.min(da,db);
    // v10：薄弱关系改虚线（形态而非颜色）
    if(l.health<65)ctx.setLineDash([5,4]);else ctx.setLineDash([]);
    ctx.strokeStyle=l.health<65?("rgba("+p.linkBad+","+(0.8*al)+")"):("rgba("+p.link+","+(0.55*al)+")");
    ctx.lineWidth=selLink===l?3.5:(l.health<65?1.6:1.8);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    ctx.setLineDash([]);
    if(al>0.5){
      ctx.globalAlpha=al;ctx.fillStyle=p.label;ctx.font="10px sans-serif";ctx.textAlign="center";
      ctx.fillText(l.label,(a.x+b.x)/2,(a.y+b.y)/2-4);ctx.globalAlpha=1;
    }
  });
  // v11：当前过滤维度命中的主体集合（每帧重算，开销可忽略）
  const dimSet=activeDim===null?null:new Set();
  if(dimSet)(DATA.blockers||[]).forEach((b,k)=>{
    if(attrMap[k]===activeDim)(b.orgs||[]).forEach(id=>dimSet.add(id));
  });
  N.forEach((n,i)=>{
    n.i=i;const al=dimOf(n);
    ctx.globalAlpha=al;
    const c=colorOf(n);
    const isLow=(n.health||0)<65;
    const R=n.r||(n.type==="core"?26:n.type==="gov"?23:21);
    const isSel=selNode===n;
    // v11：维度过滤命中 → 该维度签名色外环（贯穿「点维度→网络跟着变色」的反馈）
    const dimHit=activeDim!==null&&dimSet!==null&&dimSet.has(n.id);
    if(n.type==="core"){
      // 核心：实心墨圆
      ctx.beginPath();ctx.arc(n.x,n.y,R,0,7);
      ctx.fillStyle=p.heavy;ctx.fill();
      ctx.lineWidth=isSel?4:3;ctx.strokeStyle=p.heavy;ctx.stroke();
    }else{
      ctx.beginPath();ctx.arc(n.x,n.y,R,0,7);
      ctx.fillStyle=p.nodeFill;ctx.fill();
      // v10：线宽随健康档递增（告警最重）
      ctx.lineWidth=isSel||hoverNode===n?3.5:(isLow?3.2:(n.type==="gov"?2.6:2.2));
      ctx.strokeStyle=c;ctx.stroke();
      if(n.type==="gov"){ // 监管审批：双环（印章质感）
        ctx.beginPath();ctx.arc(n.x,n.y,R-6,0,7);
        ctx.lineWidth=1.2;ctx.globalAlpha=al*.75;ctx.stroke();ctx.globalAlpha=al;
      }
    }
    // 健康度外环
    ctx.beginPath();ctx.arc(n.x,n.y,R+5,-Math.PI/2,-Math.PI/2+Math.PI*2*(n.health||0)/100);
    ctx.strokeStyle=c;ctx.lineWidth=isLow?3.4:2.2;ctx.globalAlpha=al*0.85;ctx.stroke();ctx.globalAlpha=al;
    ctx.fillStyle=n.type==="core"?p.nodeTextOn:p.nodeText;
    ctx.font="600 12px sans-serif";ctx.textAlign="center";
    ctx.fillText(n.short,n.x,n.y+4);
    ctx.globalAlpha=1;
    // v11：维度签名色外环（实线，位于焦点虚线环外侧）
    if(dimHit){
      ctx.beginPath();ctx.arc(n.x,n.y,kbNode===n?R+16:R+10,0,7);
      ctx.setLineDash([]);ctx.lineWidth=2.4;ctx.strokeStyle=dimColorOf(activeDim);
      ctx.globalAlpha=Math.min(al+.15,1);ctx.stroke();ctx.globalAlpha=1;
    }
    if(kbNode===n){ // v4：键盘焦点环（虚线）
      ctx.beginPath();ctx.arc(n.x,n.y,R+10,0,7);
      ctx.setLineDash([4,4]);ctx.lineWidth=2;ctx.strokeStyle=p.heavy;
      ctx.globalAlpha=Math.min(al+.2,1);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
    }
  });
  ctx.restore();
}
let rafId=null, stillFrames=0;
/* v6：是否需要继续动画 —— 拖拽中一律为真（v5 曾在拖拽途中误停渲染） */
function isAnimating(){
  return !!dragNode||N.some(n=>n!==dragNode&&(Math.abs(n.vx)>0.15||Math.abs(n.vy)>0.15));
}
function loop(){
  step();draw();
  // v5：节能——节点全部静止且无拖拽时，约 1.5s 后暂停 raf；任一交互 wake() 唤醒
  const moving=isAnimating();
  if(moving)stillFrames=0;else stillFrames++;
  if(!moving&&!dragNode&&stillFrames>90){rafId=null;return;}
  rafId=requestAnimationFrame(loop);
}
function wake(){if(rafId===null||rafId===undefined)rafId=requestAnimationFrame(loop);}
function buildNet(){
  cancelAnimationFrame(rafId);
  resize();
  N=(DATA.orgs||[]).map((o,i)=>{
    const a=i/(DATA.orgs.length||1)*Math.PI*2;
    return {...o,i,x:W/2+Math.cos(a)*130,y:H/2+Math.sin(a)*110,vx:0,vy:0,r:26};
  });
  const idx={};N.forEach((n,i)=>idx[n.id]=i);
  L=(DATA.links||[]).map(([a,b,l,h])=>{
    const ia=idx[a],ib=idx[b];
    return (ia!=null&&ib!=null)?{a:ia,b:ib,label:l,health:h}:null;
  }).filter(Boolean);
  selNode=null;selLink=null;hoverNode=null;dragNode=null;kbNode=null;
  // legend（v7：形状=主体类型 · 颜色=健康档；v9：色带三档明确）
  const legend=$("legend");
  const hasLow=(DATA.orgs||[]).some(o=>o.health<65);
  const hasMid=(DATA.orgs||[]).some(o=>o.health>=65&&o.health<75);
  const p=PAL();
  legend.innerHTML=
    `<span><i class="dot solid" style="background:${p.mid}"></i>实心圆＝核心代建</span>`+
    `<span><i class="dot ring"></i>双环＝监管审批</span>`+
    `<span><i class="dot thin"></i>细环＝参建主体</span>`+
    `<span style="opacity:.75">色带：<i class="dot" style="background:${p.good}"></i>优势≥75 `+
    (hasMid?`<i class="dot" style="background:${p.mid}"></i>常态65–74 `:"")+
    (hasLow?`<i class="dot" style="background:${p.bad}"></i>告警&lt;65`:"")+
    `</span>`;
  buildQuickOrgs();
  loop();
}
/* 主体快捷按钮（键盘 / 触屏直达网络节点，v3 无障碍增强） */
function buildQuickOrgs(){
  const qo=$("qorgs");
  if(!qo)return;
  qo.innerHTML="";
  (DATA.orgs||[]).forEach(o=>{
    const b=document.createElement("button");
    b.type="button";b.className="qorg";b.textContent=o.short;
    b.dataset.id=o.id;
    b.setAttribute("aria-label","查看主体详情："+o.name);
    b.addEventListener("click",()=>{
      const n=N.find(x=>x.id===o.id);
      if(n)selectNode(n);
    });
    qo.appendChild(b);
  });
  updateQuickSel();
}
function updateQuickSel(){
  document.querySelectorAll("#qorgs .qorg").forEach(b=>{
    b.setAttribute("aria-current",(selNode&&b.dataset.id===selNode.id)?"true":"false");
  });
}
function pos(e){
  const r=canvas.getBoundingClientRect();
  const t=(e.changedTouches&&e.changedTouches[0])||(e.touches&&e.touches[0])||e;
  return [t.clientX-r.left,t.clientY-r.top];
}
/* v12：屏幕坐标 → 世界坐标（视口变换） */
function toWorld(x,y){return [(x-view.x)/view.z,(y-view.y)/view.z];}
function nodeAt(x,y){return N.find(n=>Math.hypot(n.x-x,n.y-y)<n.r+4)||null;}
function linkAt(x,y){
  let hit=null;
  L.forEach(l=>{const a=N[l.a],b=N[l.b];
    const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy||1;
    let t=((x-a.x)*dx+(y-a.y)*dy)/len2;t=Math.max(0,Math.min(1,t));
    const px=a.x+t*dx,py=a.y+t*dy;
    if(Math.hypot(px-x,py-y)<8)hit=l;});
  return hit;
}
/* v5：hover 气泡 */
const tip=$("netTip");
function showTip(n,x,y){
  if(!tip)return;
  if(!n){
    tip.style.display="none";
    tip.setAttribute("aria-hidden","true");
    return;
  }
  tip.innerHTML=`<b>${esc(n.short)}</b> <span class="tv">${esc(n.name)}</span><br>`+
    `<span class="tv">健康度</span> <span class="th" style="color:${colorOf(n)}">${n.health}</span> <span class="tv">${esc(gradeOf(n.health))}</span><br>`+
    `<span class="tv">卡点</span> ${esc(n.block||"—")}`;
  tip.style.display="block";
  tip.setAttribute("aria-hidden","false");
  const tw=tip.offsetWidth||240, th=tip.offsetHeight||70;
  let lx=x+14, ly=y+14;
  if(lx+tw>W)lx=Math.max(4,x-tw-14);
  if(ly+th>H)ly=Math.max(4,y-th-14);
  tip.style.left=lx+"px";
  tip.style.top=ly+"px";
}
function pointerDown(e){
  const [x,y]=pos(e);mx0=x;my0=y;moved=false;panMoved=false;lx=x;ly=y;
  showTip(null); // 触屏开始时隐藏气泡
  const [wx,wy]=toWorld(x,y);
  dragNode=nodeAt(wx,wy);
  panning=!dragNode;  // v12：非节点处按下 = 平移
  wake();
  if(dragNode||panning)e.preventDefault();
}
function pointerMove(e){
  const [x,y]=pos(e);
  if(dragNode&&(Math.abs(x-mx0)>4||Math.abs(y-my0)>4))moved=true;
  if(dragNode&&moved){
    const [wx,wy]=toWorld(x,y);
    dragNode.x=Math.max(40,Math.min(W-40,wx));
    dragNode.y=Math.max(35,Math.min(H-35,wy));
    dragNode.vx=dragNode.vy=0;
    e.preventDefault();return;
  }
  if(panning){  // v12：跟手平移
    view.x+=x-lx;view.y+=y-ly;lx=x;ly=y;
    if(Math.abs(x-mx0)>4||Math.abs(y-my0)>4)panMoved=true;
    e.preventDefault();return;
  }
  if(!dragNode){
    const was=hoverNode;
    const [wx,wy]=toWorld(x,y);
    hoverNode=nodeAt(wx,wy);
    canvas.style.cursor=hoverNode?"pointer":"grab";
    if(hoverNode!==was||hoverNode)showTip(hoverNode,x,y);
    if(!hoverNode)showTip(null);
  }
}
function selectNode(n){
  selNode=n;selLink=null;activeBlocker=null;activePhase=null;
  clearBlkSel();clearTlSel();clearDimSel();
  showNode(n);
  wake();
}
function selectLink(l){
  selLink=l;selNode=null;activeBlocker=null;activePhase=null;
  clearBlkSel();clearTlSel();clearDimSel();
  showLink(l);
  wake();
}
function jumpToBlocker(i){
  const el=document.querySelector('.blk[data-bi="'+i+'"]');   /* v12：按数据下标精确定位 */
  if(!el)return;
  if(!el.classList.contains("open"))el.click();
  el.focus({preventScroll:true});
  smoothScroll(el,"center");
}
function pointerUp(e){
  const [x,y]=pos(e);
  if(dragNode&&!moved){
    selectNode(dragNode);
  }else if(!dragNode&&!panMoved){   // v12：未发生平移时才按「点空白」处理
    const [wx,wy]=toWorld(x,y);
    const hit=linkAt(wx,wy);
    if(hit)selectLink(hit);
    else{selNode=null;selLink=null;updateQuickSel();}
  }
  dragNode=null;panning=false;
  showTip(null);
}
canvas.addEventListener("mousedown",pointerDown);
canvas.addEventListener("mousemove",pointerMove);
canvas.addEventListener("mouseup",pointerUp);
canvas.addEventListener("mouseleave",()=>{hoverNode=null;showTip(null);panning=false;});
canvas.addEventListener("touchstart",pointerDown,{passive:false});
canvas.addEventListener("touchmove",pointerMove,{passive:false});
canvas.addEventListener("touchend",pointerUp,{passive:false});
canvas.addEventListener("touchcancel",()=>{dragNode=null;panning=false;});
/* v12：滚轮缩放（以光标为锚点） */
canvas.addEventListener("wheel",e=>{
  e.preventDefault();
  const [sx,sy]=pos(e);
  const [wx,wy]=toWorld(sx,sy);
  view.z=Math.max(0.5,Math.min(2.5,view.z*(e.deltaY<0?1.12:1/1.12)));
  view.x=sx-wx*view.z;view.y=sy-wy*view.z;
  wake();
},{passive:false});
/* v4：键盘导航 —— 方向键移动焦点、Enter/Space 选中、Esc 清空 */
canvas.addEventListener("keydown",e=>{
  const k=e.key;
  /* v12：+/- 缩放、0 复位视口 */
  if(k==="0"||k==="="||k==="+"||k==="-"){
    e.preventDefault();
    if(k==="0"){view.z=1;view.x=0;view.y=0;}
    else view.z=Math.max(0.5,Math.min(2.5,view.z*(k==="-"?1/1.15:1.15)));
    wake();return;
  }
  if(k==="Enter"||k===" "){
    if(kbNode){e.preventDefault();selectNode(kbNode);wake();}
    return;
  }
  if(k==="Escape"){
    e.preventDefault();
    kbNode=null;selNode=null;selLink=null;updateQuickSel();
    detail.innerHTML=`<h3>诊断详情</h3><div class="empty">点击总览五维、时间轴阶段、网络中的主体或关系、或下方卡点，在此查看结构化诊断。</div>`;
    $("netHint").classList.remove("show");
    wake();
    return;
  }
  const dirs={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  const d=dirs[k];
  if(!d)return;
  e.preventDefault();
  const pool=N.filter(n=>n!==kbNode);
  if(!pool.length)return;
  const [dx,dy]=d;
  const ox=kbNode?kbNode.x:W/2, oy=kbNode?kbNode.y:H/2;
  let best=null,bestScore=-Infinity;
  pool.forEach(n=>{
    const vx=n.x-ox, vy=n.y-oy;
    const along=vx*dx+vy*dy; // 沿方向投影
    if(along<=0)return;      // 只选该方向上的节点
    const perp=Math.abs(vx*dy-vy*dx); // 垂直距离
    const score=along-perp*1.2;
    if(score>bestScore){bestScore=score;best=n;}
  });
  if(best)kbNode=best;
  wake();
});

/* v5：卡点搜索（含命中主体时高亮快捷按钮） */
function bindBlkSearch(){
  const inp=$("blkSearch"), cnt=$("blkCount");
  if(!inp)return;
    inp.addEventListener("input",()=>{
    const q=inp.value.trim().toLowerCase();
    const blks=document.querySelectorAll(".blk");
    let shown=0;
    blks.forEach(el=>{
      const b=(DATA.blockers||[])[+el.dataset.bi];   /* v12：修复 DOM 分组序号 ≠ 数据下标 */
      if(!b){el.style.display="";return;}
      const orgNames=(b.orgs||[]).map(id=>{
        const o=(DATA.orgs||[]).find(x=>x.id===id);
        return o?(o.name+" "+o.short):id;
      }).join(" ");
      const hay=(b.t+" "+b.d+" "+b.ev+" "+b.fix+" "+(b.sev||"")+" "+orgNames).toLowerCase();
      const hit=!q||hay.includes(q);
      el.style.display=hit?"":"none";
      if(hit)shown++;
    });
    if(cnt)cnt.textContent=q?("命中 "+shown+" / "+blks.length+" 项"):"";
    /* v12：搜索空态 */
    const host=$("blks");
    let emptyEl=$("blkEmpty");
    if(q&&shown===0&&host){
      if(!emptyEl){emptyEl=document.createElement("div");emptyEl.id="blkEmpty";emptyEl.className="blk-empty";}
      emptyEl.textContent="未命中卡点「"+inp.value.trim()+"」。试试：审批 / 需求 / 权责 / 停水 / 施工";
      host.appendChild(emptyEl);
    }else if(emptyEl){emptyEl.remove();}
    document.querySelectorAll("#qorgs .qorg").forEach(qb=>{
      const o=(DATA.orgs||[]).find(x=>x.id===qb.dataset.id);
      const nameHit=!!(q&&o&&((o.name+" "+o.short+" "+(o.block||"")+" "+(o.role||"")).toLowerCase().includes(q)));
      qb.classList.toggle("match",nameHit);
    });
  });
}
function clearBlkSel(){
  document.querySelectorAll(".blk").forEach(x=>{
    x.classList.remove("sel","open");
    x.setAttribute("aria-expanded","false");
  });
}
function clearTlSel(){
  tl.querySelectorAll(".tl-m").forEach(d=>{d.classList.remove("sel");d.setAttribute("aria-pressed","false");});
}
function showNode(n){
  const tags=(n.tags||[]).map(t=>`<span class="tag ${n.type==="gov"?"gov":"mode"}">${esc(t)}</span>`).join("");
  const myPh=(DATA.phases||[]).map((p,i)=>({p,i})).filter(x=>(n.phases||[]).includes(x.i));
  const myBlk=(DATA.blockers||[]).map((b,i)=>({b,i})).filter(x=>(x.b.orgs||[]).includes(n.id));
  /* v12：复查快照 —— 该主体的健康度趋势 */
  const prevH=(DATA.prev&&DATA.prev.orgs&&DATA.prev.orgs[n.id]!=null)?DATA.prev.orgs[n.id]:null;
  const trend=(prevH!=null)?(n.health-prevH):null;
  const trendHtml=trend===null?"":' <span style="font-size:12px;color:'+
    (trend>0?"var(--band-good)":trend<0?"var(--alert)":"var(--muted)")+'">较上次 '+
    (trend>0?"+"+trend:trend===0?"持平":trend)+"</span>";
  /* v12：上下游（按 links 方向） */
  const relBtn=id=>{
    const o=(N||[]).find(q=>q.id===id);
    return o?`<button type="button" class="tag" data-org="${esc(id)}">${esc(o.short)}</button>`:null;
  };
  const upHtml=(DATA.links||[]).filter(l=>l[1]===n.id).map(l=>relBtn(l[0])).filter(Boolean).join("")||'<span class="tag">—</span>';
  const downHtml=(DATA.links||[]).filter(l=>l[0]===n.id).map(l=>relBtn(l[1])).filter(Boolean).join("")||'<span class="tag">—</span>';
  const phHtml=myPh.length
    ?myPh.map(x=>`<button type="button" class="tag" data-ph="${x.i}">${esc(x.p.label)}</button>`).join("")
    :'<span class="tag">—</span>';
  const blHtml=myBlk.length
    ?myBlk.map(x=>`<button type="button" class="tag" data-blk="${x.i}">${esc(x.b.t)}</button>`).join("")
    :'<span class="tag">—</span>';
  detail.innerHTML=`<h3>${esc(n.name)}</h3>
    <div class="row"><span class="k">协同健康度</span><b style="color:${colorOf(n)}">${n.health}</b>${trendHtml}</div>
    <div class="row"><span class="k">角色</span>${esc(n.role)}</div>
    <div class="row"><span class="k">权责边界</span>${esc(n.power)}</div>
    <div class="row"><span class="k">典型协同动作</span>${esc(n.act)}</div>
    <div class="row"><span class="k">主要卡点</span>${esc(n.block)}</div>
    <div class="row"><span class="k">上游（为其输入）</span>${upHtml}</div>
    <div class="row"><span class="k">下游（其输出到）</span>${downHtml}</div>
    <div class="row"><span class="k">参与阶段</span>${phHtml}</div>
    <div class="row"><span class="k">涉及卡点</span>${blHtml}</div>
    <div class="row"><span class="k">标签</span>${tags||'<span class="tag">—</span>'}</div>`;
  detail.querySelectorAll("button.tag[data-ph]").forEach(b=>{
    b.addEventListener("click",()=>pickPhase(+b.dataset.ph));
  });
  detail.querySelectorAll("button.tag[data-blk]").forEach(b=>{
    b.addEventListener("click",()=>jumpToBlocker(+b.dataset.blk));
  });
  detail.querySelectorAll("button.tag[data-org]").forEach(b=>{
    b.addEventListener("click",()=>{const o=(N||[]).find(q=>q.id===b.dataset.org);if(o)selectNode(o);});
  });
  $("netHint").classList.remove("show");
}
function showLink(l){
  const a=N[l.a],b=N[l.b];
  detail.innerHTML=`<h3>协同关系 · ${esc(a.short)} ↔ ${esc(b.short)}</h3>
    <div class="row"><span class="k">关系健康度</span><b style="color:${l.health<65?"var(--band-bad)":"var(--band-mid)"}">${l.health}</b></div>
    <div class="row"><span class="k">协同内容</span>${esc(l.label)}</div>
    <div class="row"><span class="k">诊断</span>${l.health<65?"该关系为当前协同薄弱环节，建议纳入近期整改清单。":"该关系运行平稳，可总结经验形成标准动作。"}</div>`;
  $("netHint").classList.remove("show");
}

/* ================= 卡点（v7：按风险分诊 + 维度归因角标） ================= */
const SEV_ORDER=["高","中","低"];
const SEV_LABEL={高:"重点干预",中:"观察跟进",低:"常规优化"};
function buildBlockers(){
  const blks=$("blks");
  blks.innerHTML="";
  SEV_ORDER.forEach(sev=>{
    const items=(DATA.blockers||[]).map((b,i)=>({b,i})).filter(x=>x.b.sev===sev);
    if(!items.length)return;
    const grp=document.createElement("div");
    grp.className="triage t-"+(sev==="高"?"hi":sev==="中"?"mid":"low");
    grp.innerHTML=`<div class="triage-h"><span class="tn">${sev==="高"?"!":sev==="中"?"2":"✓"}</span>${SEV_LABEL[sev]}<span class="cnt">${items.length} 项</span></div>`;
    items.forEach(({b,i})=>{
      grp.appendChild(buildBlockerEl(b,i));
    });
    blks.appendChild(grp);
  });
}
function buildBlockerEl(b,i){
    const d=document.createElement("div");d.className="blk";
    d.setAttribute("role","button");
    d.setAttribute("tabindex","0");
    d.setAttribute("aria-expanded","false");
    d.setAttribute("data-bi",String(i));   /* v12：数据下标（DOM 按严重度分组，序号与下标不一致） */
    const names=(b.orgs||[]).map(id=>{
      const o=(DATA.orgs||[]).find(x=>x.id===id);
      return o?o.short:id;
    });
    // v7：维度归因角标
    const dimIdx=attrMap[i];
    const chipHtml=(dimIdx!=null&&dimIdx>=0&&DATA.dims[dimIdx])
      ?`<button class="dim-chip" type="button" style="color:${dimColorOf(dimIdx)}" title="按「${esc(DATA.dims[dimIdx].n)}」过滤关联卡点" aria-label="归因维度：${esc(DATA.dims[dimIdx].n)}，点击过滤">${esc(DATA.dims[dimIdx].n)}</button>`:"";
    d.innerHTML=`<div class="bt"><span class="sev ${esc(b.sev)}">${esc(b.sev)}风险</span>${esc(b.t)}${chipHtml}</div>
      <div class="bd">${esc(b.d)}</div>
      <div class="more">
        <div><b>证据：</b>${esc(b.ev)}</div>
        <div style="margin-top:4px"><b>处方：</b>${esc(b.fix)}</div>
        <div style="margin-top:4px"><b>涉及主体：</b>${esc(names.join(" / ")||"—")}</div>
      </div>`;
    const toggle=()=>{
      const wasOpen=d.classList.contains("open");
      clearBlkSel(); // 手风琴：同时只展开一个，并清理其它选中态
      const open=!wasOpen;
      d.classList.toggle("open",open);
      d.setAttribute("aria-expanded",open?"true":"false");
      if(open){
        d.classList.add("sel");
        activeBlocker=i;activePhase=null;clearTlSel();
        selNode=null;selLink=null;updateQuickSel();clearDimSel();
        const hitIds=new Set(b.orgs||[]);
        const names2=(DATA.orgs||[]).filter(o=>hitIds.has(o.id)).map(o=>o.short);
        detail.innerHTML=`<h3>卡点归因 · ${esc(b.t)}</h3>
          <div class="row"><span class="k">严重程度</span><span class="sev ${esc(b.sev)}">${esc(b.sev)}风险</span></div>
          <div class="row"><span class="k">表现</span>${esc(b.d)}</div>
          <div class="row"><span class="k">证据</span>${esc(b.ev)}</div>
          <div class="row"><span class="k">处方</span>${esc(b.fix)}</div>
          <div class="row"><span class="k">涉及主体</span>${esc(names2.join("、")||"—")}</div>`;
        $("netHint").classList.add("show");
        $("netHint").textContent="卡点联动：「"+b.t+"」高亮涉及主体："+names2.join("、");
      }else{
        activeBlocker=null;
        $("netHint").classList.remove("show");
      }
      wake();
    };
    d.addEventListener("click",toggle);
    /* v12：Enter/Space 展开；上下方向键在卡点间移动焦点 */
    d.addEventListener("keydown",e=>{
      if(e.key==="Enter"||e.key===" "){e.preventDefault();toggle();return;}
      if(e.key==="ArrowDown"||e.key==="ArrowUp"){
        e.preventDefault();
        const all=[...document.querySelectorAll(".blk")].filter(x=>x.style.display!=="none");
        const idx=all.indexOf(d);
        const t=all[idx+(e.key==="ArrowDown"?1:-1)];
        if(t){
          t.focus({preventScroll:true});
          t.scrollIntoView({behavior:prefersReduced?"auto":"smooth",block:"nearest"});
        }
      }
    });
    // v7：维度角标触发维度过滤
    const chip=d.querySelector(".dim-chip");
    if(chip)chip.addEventListener("click",e=>{e.stopPropagation();pickDim(attrMap[i]);});
    return d;
}

/* ================= 数据导入 / 导出 ================= */
function buildDataPanel(){
  // 控制台注入到页脚上方（独立卡片）
  const wrap=document.querySelector(".wrap > div");
  const card=document.createElement("div");
  card.className="card data-card";
  card.innerHTML=`
    <details>
      <summary>数据导入 / 导出（模板无需改版，点击展开）</summary>
      <div class="hint">将脱敏案卷交给 Atria-Dawn 抽取为下列 JSON 后导入，模板自动重渲染；也可导出当前数据备份或二次编辑</div>
      <div class="io-row">
        <button class="io-btn alt" id="impBtn">导入 JSON</button>
        <button class="io-btn" id="expBtn">导出 JSON</button>
        <button class="io-btn alt" id="editBtn">查看 / 编辑当前数据</button>
        <button class="io-btn" id="resetBtn">恢复示例数据</button>
      </div>
      <input type="file" id="fileIn" accept="application/json,.json" style="display:none"/>
      <div class="io-msg" id="ioMsg"></div>
      <textarea class="io-edit" id="ioEdit" spellcheck="false" aria-label="数据 JSON 编辑区"></textarea>
    </details>`;
  wrap.appendChild(card);
  const msg=$("ioMsg"),edit=$("ioEdit");
  const say=(t,ok)=>{msg.textContent=t;msg.className="io-msg "+(ok?"ok":"err");};
  $("impBtn").onclick=()=>$("fileIn").click();
  $("fileIn").onchange=e=>{
    const f=e.target.files&&e.target.files[0];
    if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const d=JSON.parse(rd.result);
        const err=validateData(d);
        if(err){say("导入失败："+err,false);return;}
        showImportDiff(d); // v4：先预览与当前数据的差异，再确认应用
      }catch(err){
        say("导入失败：JSON 解析错误 — "+err.message,false);
      }
    };
    rd.onerror=()=>say("导入失败：文件读取错误",false);
    rd.readAsText(f,"UTF-8");
    e.target.value="";
  };
  $("expBtn").onclick=()=>{
    const blob=new Blob([JSON.stringify(DATA,null,2)],{type:"application/json;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="协同体检中心-数据.json";
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    say("已导出当前数据为 JSON",true);
  };
  $("editBtn").onclick=()=>{
    if(edit.classList.contains("show")){
      try{
        const d=JSON.parse(edit.value);
        const err=validateData(d);
        if(err){say("应用失败："+err,false);return;}
        loadData(d);
        edit.classList.remove("show");
        say("已应用编辑后的数据",true);
      }catch(err){say("应用失败：JSON 解析错误 — "+err.message,false);}
    }else{
      edit.value=JSON.stringify(DATA,null,2);
      edit.classList.add("show");
      say("编辑后点击同一按钮可应用；也可整体复制走",true);
    }
  };
  $("resetBtn").onclick=()=>{
    curScene=0;
    loadData(clone(DEFAULT_DATA));
    buildSceneBtns();
    edit.classList.remove("show");
    say("已恢复为示例数据",true);
  };
}
/* v4：导入 diff 预览 */
let pendingImport=null;
function showImportDiff(d){
  pendingImport=d;
  const msg=$("ioMsg");
  if(!msg)return;
  const cur=DATA;
  const num=x=>(x||[]).length;
  const hi=arr=>(arr||[]).filter(b=>b.sev==="高").length;
  const dt=clampScore(d.total)-clampScore(cur.total);
  const name=(d.meta&&d.meta.project)||"新数据";
  msg.className="io-msg ok";
  msg.textContent="";
  const box=document.createElement("div");
  box.className="diff-box";
  const list=document.createElement("div");
  list.className="diff-list";
  list.textContent=
    "主体 "+num(cur.orgs)+" → "+num(d.orgs)+" ｜ "+
    "关系 "+num(cur.links)+" → "+num(d.links)+" ｜ "+
    "卡点 "+num(cur.blockers)+" → "+num(d.blockers)+"（高风险 "+hi(cur.blockers)+" → "+hi(d.blockers)+"）｜ "+
    "总分 "+clampScore(cur.total)+" → "+clampScore(d.total)+"（"+(dt>0?"+":"")+dt+"）";
  box.innerHTML="<b>导入预览</b>："+esc(name);
  box.appendChild(list);
  const acts=document.createElement("div");
  acts.className="diff-acts";
  const ap=document.createElement("button");
  ap.type="button";ap.className="io-btn alt";ap.textContent="应用导入";
  const cx=document.createElement("button");
  cx.type="button";cx.className="io-btn";cx.textContent="放弃";
  ap.onclick=()=>{
    pendingImport=null;
    loadData(d);
    curScene=-1;buildSceneBtns(); // 导入的是自定义数据，不属于任何预设
    sayTo("已导入「"+(d.meta&&d.meta.project||"新数据")+"】，页面已重渲染",true);
  };
  cx.onclick=()=>{pendingImport=null;sayTo("已放弃导入",false);};
  acts.appendChild(ap);acts.appendChild(cx);
  box.appendChild(acts);
  msg.appendChild(box);
}
function validateData(d){
  if(!d||typeof d!=="object")return "根节点必须是对象";
  if(!Array.isArray(d.orgs)||!d.orgs.length)return "缺少 orgs 数组";
  if(!Array.isArray(d.links))return "缺少 links 数组";
  if(!Array.isArray(d.phases)||!d.phases.length)return "缺少 phases 数组";
  if(!Array.isArray(d.blockers))return "缺少 blockers 数组";
  if(!Array.isArray(d.dims))return "缺少 dims 数组";
  const ids=new Set(d.orgs.map(o=>o.id));
  for(const o of d.orgs){
    if(typeof o.id!=="string"||!o.id)return "主体缺少 id";
    if(typeof o.name!=="string"||!o.name)return "主体「"+o.id+"」缺少 name";
    if(typeof o.health!=="number")return "主体「"+o.id+"」health 必须为数值";
    if(!Array.isArray(o.phases))return "主体「"+o.id+"」phases 必须为数组";
    // v6：阶段下标必须在当前数据的阶段范围内
    for(const pi of o.phases){
      if(!Number.isInteger(pi)||pi<0||pi>=d.phases.length)
        return "主体「"+o.id+"」的阶段下标越界："+pi+"（合法范围 0–"+(d.phases.length-1)+"）";
    }
  }
  for(const l of d.links){
    if(!Array.isArray(l)||l.length<4)return "links 每项为 [a,b,label,health] 四元组";
    if(!ids.has(l[0])||!ids.has(l[1]))return "关系引用了不存在的主体："+l[0]+" / "+l[1];
    if(l[0]===l[1])return "关系两端不能是同一主体："+l[0];
    if(typeof l[3]!=="number")return "关系健康度必须为数值";
  }
  for(const p of d.phases){
    if(typeof p.label!=="string"||!p.label)return "阶段缺少 label";
  }
  for(const b of d.blockers){
    if(typeof b.t!=="string"||!b.t)return "卡点缺少标题 t";
    if(typeof b.sev!=="string"||!["高","中","低"].includes(b.sev))return "卡点「"+b.t+"」sev 只能为 高 / 中 / 低";
    if(!Array.isArray(b.orgs))return "卡点「"+b.t+"」orgs 必须为 id 数组";
    for(const id of b.orgs)if(!ids.has(id))return "卡点「"+b.t+"」引用了不存在的主体："+id;
  }
  for(const dm of d.dims){
    if(typeof dm.n!=="string"||typeof dm.v!=="number")return "维度需要 {n, v} 且 v 为数值";
  }
  return null;
}

/* ================= 复盘报告生成（Delivery 演示 · v7 报告单排版） ================= */
let reportTimer=null,reportText="",typingDone=false;
function buildReportLines(){
  const d=DATA;
  const dims=(d.dims||[]).map(x=>x.n+"（"+x.v+"）").join("、");
  const highs=(d.blockers||[]).filter(b=>b.sev==="高").map(b=>b.t);
  const lows=(d.orgs||[]).filter(o=>o.health<65).map(o=>o.name);
  const no=(typeof buildReportNo==="function")?buildReportNo():"ATRIA-"+((d.meta&&d.meta.date)||"2026");
  const lines=[
    "一、总检结论\n\n协同健康度 "+(d.total||0)+" 分（"+gradeOf(d.total||0)+"）。\n\n"+buildConclusion(),
    "二、五维评分\n\n"+dims+"。",
    "三、卡点分诊\n\n识别出 "+(d.blockers||[]).length+" 类协同卡点，其中高风险 "+highs.length+" 项："+(highs.join("、")||"无")+"。健康度偏低的主体："+(lows.join("、")||"无")+"。",
    "四、干预处方\n\n" + (d.blockers||[])
      .filter(b=>b.sev==="高")
      .map((b,i)=>"（"+(i+1)+"）"+b.t+"："+b.fix)
      .join("；") + "。",
    "五、协同亮点\n\n" + (d.links||[])
      .filter(l=>l.health>=79)
      .map(l=>{const a=(N[l.a]||{}).short||l.a,b2=(N[l.b]||{}).short||l.b;return a+" ↔ "+b2+"（"+l.health+"）";})
      .join("、") + " 等关系运行平稳，可作为标准动作沉淀复用。",
    "六、30 天干预时间线\n\n按严重度排期，高风险先行、低风险收尾，月末统一复查验收：\n" +
      (d.blockers||[]).slice().sort((a,b)=>SEV_ORDER.indexOf(a.sev)-SEV_ORDER.indexOf(b.sev))
        .map(b=>"· "+({高:"D1–D7",中:"D8–D21",低:"D22–D30"}[b.sev]||"D8–D21")+
          "（"+b.sev+"）"+b.t+"："+b.fix)
        .join("\n"),
    "七、按主体整改清单\n\n各主体认领本项目的协同整改事项：\n" + (()=>{
      const byOrg={};
      (d.blockers||[]).forEach(b=>(b.orgs||[]).forEach(id=>{(byOrg[id]=byOrg[id]||[]).push(b);}));
      return (d.orgs||[]).filter(o=>byOrg[o.id]&&byOrg[o.id].length).map(o=>
        "· "+o.short+"（"+o.name+"）：\n"+
        byOrg[o.id].sort((a,b)=>SEV_ORDER.indexOf(a.sev)-SEV_ORDER.indexOf(b.sev))
          .map(x=>"　– "+x.t+"（"+x.sev+"）："+x.fix).join("\n")
      ).join("\n");
    })(),
    "签发：Atria-Dawn 协同诊断中心 ｜ 报告编号 "+no+" ｜ "+((d.meta&&d.meta.date)||"—")+"（"+((d.meta&&d.meta.badge)||"示例数据")+"，自动生成）"
  ];
  return lines;
}
/* v7：报告编号（与页眉一致） */
function buildReportNo(){
  const raw=(DATA.meta&&DATA.meta.date)||"";
  const dt=raw.replace(/^[^0-9]*/,"").trim()||"2026"; // 去掉「体检日期：」之类的前缀
  const proj=(DATA.meta&&DATA.meta.project)||"";
  let code=0;
  for(const ch of proj)code=(code*31+ch.charCodeAt(0))%1000;
  return "ATRIA-"+dt+"-"+String(code).padStart(3,"0");
}
function resetReport(){
  if(reportTimer){clearInterval(reportTimer);reportTimer=null;}
  const report=$("report");
  report.classList.remove("show");report.innerHTML="";
  reportText="";typingDone=false;
  $("genBtn").disabled=false;$("genBtn").textContent="生成复盘报告";
  $("dlBtn").style.display="none";$("cpBtn").style.display="none";
}
function startTyping(){
  const report=$("report");
  resetReport();
  report.classList.add("show");
  if(!prefersReduced)smoothScroll(report,"start");
  // v4：五维评分 SVG 图（打字区上方）
  const chart=document.createElement("div");
  chart.className="report-chart";
  chart.innerHTML=buildDimChartSVG();
  report.appendChild(chart);
  const lines=buildReportLines();
  reportText=lines.join("\n\n");
  $("genBtn").disabled=true;$("genBtn").textContent="生成中…";
  let li=0,ci=0,cur=document.createElement("p");report.appendChild(cur);
  const caret=document.createElement("span");caret.className="caret";report.appendChild(caret);
  reportTimer=setInterval(()=>{
    if(li>=lines.length){
      caret.remove();clearInterval(reportTimer);reportTimer=null;typingDone=true;
      $("genBtn").disabled=false;$("genBtn").textContent="重新生成";
      $("dlBtn").style.display="";$("cpBtn").style.display="";
      return;
    }
    const line=lines[li];
    if(ci<=line.length){
      cur.textContent=line.slice(0,ci++);
    }else{
      cur=document.createElement("p");report.insertBefore(cur,caret);
      cur.textContent="";li++;ci=0;
    }
  },24);
}
$("genBtn").addEventListener("click",startTyping);

/* v4：五维评分 SVG 图（主题感知，随 PAL 变色） */
function buildDimChartSVG(){
  const dims=DATA.dims||[];
  if(!dims.length)return "";
  const p=PAL();
  const rowH=30, padL=112, padR=52, Wpx=520, Hpx=dims.length*rowH+16;
  const barW=Wpx-padL-padR;
  let s=`<svg viewBox="0 0 ${Wpx} ${Hpx}" role="img" aria-label="五维评分条形图">`;
  dims.forEach((d,i)=>{
    const y=8+i*rowH;
    const v=Math.max(0,Math.min(100,d.v));
    const col=v>=75?p.good:v>=65?p.mid:p.bad;
    s+=`<text x="${padL-8}" y="${y+15}" text-anchor="end" font-size="12" fill="${p.nodeText}">${esc(d.n)}</text>`;
    s+=`<rect x="${padL}" y="${y+4}" width="${barW}" height="14" rx="7" fill="${p.track}"/>`;
    s+=`<rect x="${padL}" y="${y+4}" width="${(barW*v/100).toFixed(1)}" height="14" rx="7" fill="${col}"/>`;
    s+=`<text x="${Wpx-8}" y="${y+15}" text-anchor="end" font-size="12" font-weight="700" fill="${col}">${v}</text>`;
  });
  s+="</svg>";
  return s;
}
function reportToMarkdown(){
  const d=DATA;
  const lines=buildReportLines();
  const mdCell=s=>String(s==null?"":s).replace(/\|/g,"\\|").replace(/\r?\n/g," ");
  const mdBar=v=>{const f=Math.max(0,Math.min(10,Math.round(v/10)));return "▓".repeat(f)+"░".repeat(10-f);};
  const md=[];
  md.push("# 跨组织协同体检报告单");
  md.push("");
  md.push("> 报告编号 "+buildReportNo()+" ｜ " + ((d.meta&&d.meta.project)||"") + " ｜ " + ((d.meta&&d.meta.mode)||"") + " ｜ " + ((d.meta&&d.meta.date)||""));
  md.push("");
  md.push("**协同健康度："+(d.total||0)+" 分（"+gradeOf(d.total||0)+"）**");
  md.push("");
  md.push("## 一、总检结论");
  md.push("");
  md.push(buildConclusion());
  md.push("");
  md.push("## 二、五维评分");
  md.push("");
  md.push("| 维度 | 评分 | 图形 | 归因卡点 |");
  md.push("|---|---|---|---|");
  (d.dims||[]).forEach((x,di)=>{
    const cnt=(attrMap||[]).filter(a=>a===di).length;
    md.push("| "+mdCell(x.n)+" | "+mdCell(x.v)+" | "+mdBar(x.v)+" | "+cnt+" 项 |");
  });
  md.push("");
  md.push("## 三、卡点分诊");
  md.push("");
  ["高","中","低"].forEach(sev=>{
    const items=(d.blockers||[]).map((b,i)=>({b,i})).filter(x=>x.b.sev===sev);
    if(!items.length)return;
    md.push("### "+({high:"重点干预（高风险）",mid:"观察跟进（中风险）",low:"常规优化（低风险）"}[sev]||sev)+" · "+sev);
    md.push("");
    items.forEach(({b,i})=>{
      const dimN=(attrMap[i]!=null&&attrMap[i]>=0&&d.dims[attrMap[i]])?d.dims[attrMap[i]].n:"未归因";
      md.push("- **"+b.t+"**（"+sev+"风险 · 归因："+dimN+"）");
      md.push("  - 表现："+b.d);
      md.push("  - 证据："+b.ev);
      md.push("  - 处方："+b.fix);
      const names=(b.orgs||[]).map(id=>{
        const o=(d.orgs||[]).find(x=>x.id===id);
        return o?o.name:id;
      });
      md.push("  - 涉及主体："+names.join(" / "));
    });
    md.push("");
  });
  md.push("## 四、主体健康度");
  md.push("");
  md.push("| 主体 | 角色 | 健康度 |");
  md.push("|---|---|---|");
  (d.orgs||[]).forEach(o=>md.push("| "+mdCell(o.name)+" | "+mdCell(o.role)+" | "+mdCell(o.health)+" |"));
  md.push("");
  md.push("## 五、自动复盘");
  md.push("");
  lines.forEach(l=>{if(!l.startsWith("签发")){md.push(l);md.push("");}});
  md.push("---");
  md.push("");
  md.push("签发：Atria-Dawn 协同诊断中心 ｜ 报告编号 "+buildReportNo()+" ｜ "+((d.meta&&d.meta.badge)||"示例数据")+" ｜ 单文件 HTML · 离线运行");
  return md.join("\n");
}
$("dlBtn").addEventListener("click",()=>{
  const md=reportToMarkdown();
  const blob=new Blob(["﻿"+md],{type:"text/markdown;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="跨组织协同体检报告.md";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
$("cpBtn").addEventListener("click",async()=>{
  const md=reportToMarkdown();
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(md);
    }else{
      const ta=document.createElement("textarea");
      ta.value=md;document.body.appendChild(ta);ta.select();
      document.execCommand("copy");ta.remove();
    }
    $("cpBtn").textContent="已复制 ✓";
    setTimeout(()=>$("cpBtn").textContent="复制全文",1500);
  }catch(err){
    $("cpBtn").textContent="复制失败，请手动选择复制";
    setTimeout(()=>$("cpBtn").textContent="复制全文",2000);
  }
});

/* ================= 场景预设：模板无需改版，切换数据即切换项目 ================= */
/* 统一映射：0=医院新院区（默认数据）、1=轨道交通4号线、2=老城区排水改造 */
const ALL_SCENES=[DEFAULT_DATA].concat(SCENARIOS);
let curScene=0;
/* 对比模式：cmpPending=等待选目标；cmpScene=已选中的对比场景 */
let cmpPending=false, cmpScene=null;
function clampScore(v){return Math.max(0,Math.min(100,v||0));}
function switchScene(i){
  curScene=i;
  exitCmp();
  loadData(clone(ALL_SCENES[i]));
  buildSceneBtns();
  try{localStorage.setItem(KEY_SCENE,String(i));}catch(e){}
  const ed=$("ioEdit");
  if(ed&&ed.classList.contains("show"))ed.value=JSON.stringify(DATA,null,2);
  sayTo("已切换到「"+((DATA.meta&&DATA.meta.project)||"示例场景")+"」，模板未改版，页面已重渲染",true);
}
function bindSceneBtns(){
  for(let i=0;i<ALL_SCENES.length;i++){
    const b=$("sceneBtn"+i);
    if(!b)continue;
    b.setAttribute("aria-pressed",i===curScene?"true":"false");
    b.onclick=()=>{
      if(cmpPending&&i!==curScene){enterCmp(i);return;}
      if(i!==curScene)switchScene(i);
    };
  }
}
function buildSceneBtns(){
  /* v12：场景按钮由数据动态生成 —— 新增场景只需加数据，模板零改版 */
  const wrap=$("sceneBtnsWrap");
  if(wrap&&wrap.getAttribute("data-built")!==String(ALL_SCENES.length)){
    wrap.setAttribute("data-built",String(ALL_SCENES.length));
    wrap.innerHTML="";
    for(let i=0;i<ALL_SCENES.length;i++){
      const d=ALL_SCENES[i];
      const b=document.createElement("button");
      b.type="button";b.className="scene-btn";b.id="sceneBtn"+i;
      b.textContent=((d.meta&&d.meta.project)||("场景"+(i+1))).replace(/^示例项目：/,"示例：");
      wrap.appendChild(b);
    }
  }
  for(let i=0;i<ALL_SCENES.length;i++){
    const b=$("sceneBtn"+i);
    if(!b)continue;
    b.setAttribute("aria-pressed",i===curScene?"true":"false");
  }
}
/* ===== 对比模式（v4） ===== */
function enterCmp(i){
  cmpPending=false;
  cmpScene=i;
  const row=$("sceneRow");
  if(row)row.classList.remove("cmp-pending");
  const lab=$("cmpLab");
  if(lab)lab.style.display="none";
  const cb=$("cmpBtn");
  if(cb)cb.setAttribute("aria-pressed","true");
  renderCompare();
}
function exitCmp(){
  cmpPending=false;
  cmpScene=null;
  const cb=$("cmpBtn");
  if(cb)cb.setAttribute("aria-pressed","false");
  const row=$("sceneRow");
  if(row)row.classList.remove("cmp-pending");
  const lab=$("cmpLab");
  if(lab)lab.style.display="none";
  const card=$("cmpCard");
  if(card)card.classList.remove("show");
}
function toggleCmp(){
  if(cmpPending||cmpScene!==null){exitCmp();return;}
  cmpPending=true;
  const row=$("sceneRow");
  if(row)row.classList.add("cmp-pending");
  const lab=$("cmpLab");
  if(lab)lab.style.display="";
  const cb=$("cmpBtn");
  if(cb)cb.setAttribute("aria-pressed","true");
}
function renderCompare(){
  const box=$("cmpBody"), card=$("cmpCard");
  if(!box||!card)return;
  if(cmpScene===null){card.classList.remove("show");return;}
  card.classList.add("show");
  const A=DATA, B=clone(ALL_SCENES[cmpScene]);
  const nameA=(A.meta&&A.meta.project)||"当前场景";
  const nameB=(B.meta&&B.meta.project)||"对比场景";
  const tA=clampScore(A.total), tB=clampScore(B.total);
  const dT=tB-tA;
  const cls=dT>0?"up":dT<0?"down":"eq";
  const dimsA=A.dims||[], dimsB=B.dims||[];
  const n=Math.max(dimsA.length,dimsB.length);
  let rows="";
  for(let i=0;i<n;i++){
    const a=dimsA[i], b=dimsB[i];
    const va=a?clampScore(a.v):null, vb=b?clampScore(b.v):null;
    const nm=(a&&a.n)||(b&&b.n)||"—";
    const dd=(va!=null&&vb!=null)?(vb-va):null;
    const dCls=dd==null?"eq":dd>0?"up":dd<0?"down":"eq";
    rows+=`<div class="cmp-row">
      <span>${esc(nm)}</span>
      <div class="cmp-bars">
        <div class="cmp-bar b-cur"><i style="width:${va==null?0:va}%"></i></div>
        <div class="cmp-bar b-cmp"><i style="width:${vb==null?0:vb}%"></i></div>
      </div>
      <span class="cmp-delta ${dCls}">${dd==null?"—":(dd>0?"+":"")+dd}</span>
    </div>`;
  }
  /* 主体健康度变化（按 id 匹配，取变化最大 5 个） */
  const mapA={};(A.orgs||[]).forEach(o=>mapA[o.id]=o);
  const movers=(B.orgs||[])
    .filter(o=>mapA[o.id]&&typeof o.health==="number"&&typeof mapA[o.id].health==="number")
    .map(o=>({name:o.name,from:mapA[o.id].health,to:o.health,d:o.health-mapA[o.id].health}))
    .sort((x,y)=>Math.abs(y.d)-Math.abs(x.d))
    .slice(0,5);
  const orgHtml=movers.length?movers.map(m=>{
    const c=m.d>0?"up":m.d<0?"down":"eq";
    return `<span style="white-space:nowrap"><b>${esc(m.name)}</b> ${m.from}→${m.to}（<span class="cmp-delta ${c}">${m.d>0?"+":""}${m.d}</span>）</span>`;
  }).join("　"):"两场景无相同主体";
  box.innerHTML=`<div class="cmp-head">
    <b>${esc(nameA)}</b><span class="cmp-delta ${cls}">${tA} 分（${gradeOf(tA)}）</span>
    <span style="color:var(--muted)">对比</span>
    <b>${esc(nameB)}</b><span class="cmp-delta ${cls}">${tB} 分（${gradeOf(tB)}）｜Δ ${dT>0?"+":""}${dT}</span>
  </div>
  ${rows}
  <div class="cmp-orgs">主体健康度变化：${orgHtml}</div>
  <div class="cmp-actions">
    <button type="button" class="io-btn alt" id="cmpGo">切换到「${esc(nameB)}」</button>
    <button type="button" class="io-btn" id="cmpExit">退出对比</button>
  </div>`;
  const go=$("cmpGo"), ex=$("cmpExit");
  if(go)go.onclick=()=>{if(cmpScene!==null)switchScene(cmpScene);};
  if(ex)ex.onclick=exitCmp;
}
function sayTo(t,ok){
  const m=$("ioMsg");
  if(!m)return;
  m.textContent=t;
  m.className="io-msg "+(ok?"ok":"err");
}

/* ================= v3 增强：风险速览 / PNG 导出 / 主题切换 / 打印 ================= */
function buildRisks(){
  const box=$("risks");
  if(!box)return;
  const d=DATA;
  const on=id=>(d.orgs||[]).find(x=>x.id===id);
  const hiBlk=(d.blockers||[]).map((b,i)=>({b,i})).filter(x=>x.b.sev==="高");
  const weak=(d.links||[]).slice().sort((p,q)=>p[3]-q[3]).slice(0,3);
  const lowOrg=(d.orgs||[]).filter(o=>o.health<65);
  const groups=[];
  groups.push(`<div class="risk-g"><div class="rg-t">高风险卡点（${hiBlk.length}）</div>`+
    (hiBlk.length
      ?`<div class="risk-items">${hiBlk.map(x =>
        `<button type="button" class="risk-item" data-blk="${x.i}"><span class="rv">${esc(x.b.sev)}</span>${esc(x.b.t)}</button>`
      ).join("")}</div>`
      :`<div class="risk-ok">✓ 当前无高风险卡点</div>`)+
    `</div>`);
  groups.push(`<div class="risk-g"><div class="rg-t">最薄弱关系（健康度最低 3 项）</div>`+
    `<div class="risk-items">${weak.map(w=>
      `<button type="button" class="risk-item ri-link" data-la="${esc(w[0])}" data-lb="${esc(w[1])}"><span class="rv">${w[3]}</span>${esc((on(w[0])||{}).short||w[0])} ↔ ${esc((on(w[1])||{}).short||w[1])} · ${esc(w[2])}</button>`
    ).join("")}</div></div>`);
  groups.push(`<div class="risk-g"><div class="rg-t">健康度偏低主体（&lt;65）</div>`+
    (lowOrg.length
      ?`<div class="risk-items">${lowOrg.map(o=>
        `<button type="button" class="risk-item ri-org" data-org="${esc(o.id)}"><span class="rv">${o.health}</span>${esc(o.name)}</button>`
      ).join("")}</div>`
      :`<div class="risk-ok">✓ 全部主体健康度 ≥65</div>`)+
    `</div>`);
  box.innerHTML=groups.join("");
  box.querySelectorAll("button.risk-item[data-blk]").forEach(b=>{
    b.addEventListener("click",()=>jumpToBlocker(+b.dataset.blk));
  });
  box.querySelectorAll("button.risk-item[data-la]").forEach(b=>{
    b.addEventListener("click",()=>{
      const la=b.dataset.la,lb=b.dataset.lb;
      const hit=L.find(l=>{
        const a=N[l.a],bb=N[l.b];
        return a&&bb&&((a.id===la&&bb.id===lb)||(a.id===lb&&bb.id===la));
      });
      if(hit){selectLink(hit);smoothScroll(canvas,"center");}
    });
  });
  box.querySelectorAll("button.risk-item[data-org]").forEach(b=>{
    b.addEventListener("click",()=>{
      const n=N.find(x=>x.id===b.dataset.org);
      if(n){selectNode(n);smoothScroll(detail,"nearest");}
    });
  });
}
function exportNetPNG(){
  try{
    const off=document.createElement("canvas");
    off.width=canvas.width;off.height=canvas.height;
    const c2=off.getContext("2d");
    c2.fillStyle=PAL().nodeFill;
    c2.fillRect(0,0,off.width,off.height);
    c2.drawImage(canvas,0,0);
    const a=document.createElement("a");
    a.download="跨组织协同关系网络.png";
    a.href=off.toDataURL("image/png");
    document.body.appendChild(a);a.click();a.remove();
    sayTo("已导出关系网络 PNG",true);
  }catch(err){
    sayTo("导出 PNG 失败："+err.message,false);
  }
}
function bindTheme(){
  const b=$("themeBtn");
  if(!b)return;
  const sync=()=>{
    const dark=isDark();
    b.setAttribute("aria-pressed",dark?"true":"false");
    b.textContent=dark?"☀️ 浅色模式":"🌙 深色模式";
    b.setAttribute("aria-label",dark?"切换到浅色模式":"切换到深色模式");
  };
  sync();
  b.onclick=()=>{
    const dark=isDark();
    if(dark)document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme","dark");
    try{localStorage.setItem(KEY_THEME,dark?"light":"dark");}catch(e){}
    sync();
    if(typeof wake==="function")wake(); // 主题切换后重绘画布
    // v6：已生成的报告五维图同步换色
    const chart=document.querySelector("#report .report-chart");
    if(chart)chart.innerHTML=buildDimChartSVG();
  };
}
/* 打印：未生成报告时自动填充全文，打印结束后还原 */
let autoPrint=false;
window.addEventListener("beforeprint",()=>{
  const rep=$("report");
  if(rep&&!rep.classList.contains("show")){
    autoPrint=true;
    rep.innerHTML="";
    // v7：打印按报告单排版渲染——首段结论块、末段签发条
    buildReportLines().forEach((l,idx,arr)=>{
      const p=document.createElement("p");
      if(idx===0)p.className="concl";
      if(idx===arr.length-1)p.className="sign";
      p.textContent=l;
      rep.appendChild(p);
    });
    rep.classList.add("show");
  }
});
window.addEventListener("afterprint",()=>{
  if(autoPrint){autoPrint=false;resetReport();}
});

/* ================= 启动 ================= */
(function init(){
  let s=0;
  try{
    const v=parseInt(localStorage.getItem(KEY_SCENE),10);
    if(!isNaN(v)&&v>=0&&v<ALL_SCENES.length)s=v;
  }catch(e){}
  curScene=s;
  loadData(clone(ALL_SCENES[s]));
  buildSceneBtns();   /* v12：按钮由数据生成 */
  bindSceneBtns();
  buildDataPanel();
  bindTheme();
  bindBlkSearch();
  $("pngBtn").addEventListener("click",exportNetPNG);
  const cb=$("cmpBtn");
  if(cb)cb.onclick=toggleCmp;
})();
