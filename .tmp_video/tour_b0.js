
/* 主题预置：样式绘制前应用，避免刷新闪烁（localStorage 优先，其次系统偏好） */
(function(){
  try{
    var t=localStorage.getItem("atria_demo_theme");
    var dark=t==="dark"||(t===null&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
    if(dark)document.documentElement.setAttribute("data-theme","dark");
  }catch(e){}
})();
