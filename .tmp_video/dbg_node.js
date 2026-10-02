/* debug: showNode 趋势输出 */
const fs = require("fs");
const html = fs.readFileSync("../Atria-协同体检中心-v12.html", "utf8");
const mainCode = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].pop()[1];
// 复用校验器桩：简单注入
const fn = new Function("window", "document", "navigator", "localStorage", "matchMedia",
  "requestAnimationFrame", "cancelAnimationFrame", "setInterval", "clearInterval",
  "setTimeout", "clearTimeout", "URL", "Blob", "FileReader",
  mainCode + `;return {getN:()=>N,selectNode:selectNode,getData:()=>DATA,detail:(typeof detail!=="undefined")?detail:null,switchScene:switchScene};`);
// 极简桩
const cer={};const ctx=new Proxy({},{get:(t,k)=>()=>{},set:(t,k,v)=>true});
const created=[];
function mkEl(t){const e={tagName:t,style:{},dataset:{},_attrs:{},_tc:"_tc_init",children:[],_ls:[],onclick:null,
  classList:{_s:new Set(),add(...a){a.forEach(x=>this._s.add(x));},remove(...a){a.forEach(x=>this._s.delete(x));},contains(c){return this._s.has(c);},toggle(c,f){const v=f===undefined?!this._s.has(c):!!f;if(v)this._s.add(c);else this._s.delete(c);return v;}},
  setAttribute(k,v){this._attrs[k]=v;},getAttribute(k){return(k in this._attrs)?this._attrs[k]:null;},removeAttribute(k){delete this._attrs[k];},
  addEventListener(t2,f){this._ls.push([t2,f]);},removeEventListener(){},
  appendChild(c){c.parentElement=this;this.children.push(c);return c;},removeChild(c){return c;},remove(){},
  click(){if(this.onclick)this.onclick();this._ls.filter(x=>x[0]==="click").forEach(x=>x[1]());},
  focus(){},blur(){},querySelector(){return mkEl("div");},querySelectorAll(s){return created.filter(e=>(e.className||"").split(/\s+/).includes(s.replace(/^\./,"")));},
  scrollIntoView(){},get textContent(){return this._tc;},set textContent(v){this._tc=String(v);},
  get innerHTML(){return this._html||"";},set innerHTML(v){this._html=String(v);},
  get className(){return[...this.classList._s].join(" ");},set className(v){this.classList._s=new Set(String(v).split(/\s+/).filter(Boolean));},
  getBoundingClientRect(){return{width:1200,height:430,left:0,top:0};},width:0,height:0,getContext(){return ctx;}};
  return e;}
const reg={};
const doc={createElement(t){const e=mkEl(t);created.push(e);return e;},
  getElementById(id){if(!reg[id])reg[id]=(id==="net")?Object.assign(mkEl("canvas"),{getContext(){return ctx;},getBoundingClientRect(){return{width:1200,height:430,left:0,top:0};}}):mkEl("div");return reg[id];},
  querySelector(s){if(s&&s.startsWith(".")&&!s.includes(">"))return mkEl("div");const e=mkEl("div");created.push(e);return e;},
  querySelectorAll(s){return created.filter(e=>(e.className||"").split(/\s+/).includes(s.replace(/^\./,"")));},
  documentElement:mkEl("html"),body:mkEl("body")};
const win={matchMedia(){return{matches:false};},devicePixelRatio:1,addEventListener(){},removeEventListener(){}};
const stor={_d:{},getItem(k){return(k in this._d)?this._d[k]:null;},setItem(k,v){this._d[k]=v;},removeItem(k){delete this._d[k];}};
const R=fn(win,doc,{clipboard:undefined},stor,win.matchMedia,()=>0,()=>{},()=>0,()=>{},()=>0,()=>{},
  {createObjectURL:()=>"blob:x",revokeObjectURL(){}},function Blob(){},function FileReader(){});
R.switchScene(2);
const n=R.getN()[0];
console.log("scene2 N[0]:", n.id, n.name, "health", n.health);
console.log("DATA.prev:", JSON.stringify(R.getData().prev));
R.selectNode(n);
console.log("detail._html snippet:", (doc.getElementById("detail")._html||"").replace(/\n/g," ").slice(0,400));
