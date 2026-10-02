@echo off
chcp 65001 >nul
title 协同体检中心 · 演示视频录制
pushd "%~dp0"
echo ================================================
echo   协同体检中心 - 演示视频一键录制
echo   约 90 秒自动巡览 + 1280x720 MP4/WebM 输出
echo ================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo 【错误】未找到 node。请先安装 Node.js 22+：https://nodejs.org/
  echo.
  pause
  exit /b 1
)
node record.js
echo.
if errorlevel 1 ( echo 录制失败，请把上方报错反馈。& pause )
popd
