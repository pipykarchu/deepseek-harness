@echo off
chcp 65001 >nul
title DeepSeek Harness 鲸鱼娘皮肤启动器
setlocal EnableExtensions

set "ROOT=%~dp0"
set "SKIN_DIR=%ROOT%maid-atelier"
set "SCRIPT_DIR=%ROOT%scripts"

echo ============================================
echo   DeepSeek Harness  鲸鱼娘皮肤一键启动
echo   maid-atelier (深海女仆工坊)
echo ============================================

REM ---- 定位 node 目录（多候选）----
if not defined DSH_NODE_DIR if exist "D:\DEEPSEEK harness\node\node.exe" set "DSH_NODE_DIR=D:\DEEPSEEK harness\node"
if not defined DSH_NODE_DIR if exist "D:\chajian\node.exe" set "DSH_NODE_DIR=D:\chajian"
if defined DSH_NODE_DIR set "PATH=%DSH_NODE_DIR%;%PATH%"

REM ---- 定位 harness 根目录（多候选）----
if not defined DSH_HARNESS if exist "D:\DEEPSEEK harness\deepseek-harness\apps\cli\lib\bin.js" set "DSH_HARNESS=D:\DEEPSEEK harness\deepseek-harness"
if not defined DSH_HARNESS if exist "D:\AI\deepseek\deepseek-harness\apps\cli\lib\bin.js" set "DSH_HARNESS=D:\AI\deepseek\deepseek-harness"
if not defined DSH_HARNESS (
  echo [错误] 未找到 dsh harness，请设置 DSH_HARNESS 环境变量指向 harness 目录后重试。
  pause
  exit /b 1
)

REM ---- 定位 pnpm（node 目录已入 PATH，找不到再兜底）----
if not defined DSH_PNPM where pnpm >nul 2>nul && set "DSH_PNPM=pnpm"
if not defined DSH_PNPM if exist "%APPDATA%\npm\pnpm.cmd" set "DSH_PNPM=%APPDATA%\npm\pnpm.cmd"
if not defined DSH_PNPM (
  echo [错误] 未找到 pnpm，请安装 pnpm 或设置 DSH_PNPM 环境变量。
  pause
  exit /b 1
)

REM ---- 安装/更新皮肤到 web profile（幂等：已安装且指向本包则跳过）----
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\ensure-skin.ps1" -SkinDir "%SKIN_DIR%"
if errorlevel 1 echo [警告] 皮肤安装步骤未成功，将直接启动（皮肤可能不生效）。

REM ---- 启动 dsh web ----
echo 启动中…… 关闭本窗口即停止服务
echo   页面地址: http://127.0.0.1:3080
cd /d "%DSH_HARNESS%"
%DSH_PNPM% dsh web
pause
