# make-desktop-shortcut.ps1 — 在桌面创建「DeepSeek Harness 鲸鱼娘」快捷方式（大头图标）
# 用法:
#   powershell -ExecutionPolicy Bypass -File scripts\make-desktop-shortcut.ps1 [-SkinDir "C:\...\maid-atelier"]

param(
  [string]$SkinDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'maid-atelier')
)

$ErrorActionPreference = 'Stop'

# 启动器 bat：本脚本的上一级目录下的 启动鲸鱼娘皮肤.bat
$Launcher = Join-Path (Split-Path $PSScriptRoot -Parent) '启动鲸鱼娘皮肤.bat'
if (-not (Test-Path $Launcher)) {
  Write-Host "[shortcut] 错误: 未找到启动器: $Launcher" -ForegroundColor Red
  exit 1
}

$Icon = Join-Path (Split-Path $PSScriptRoot -Parent) 'maid-icon.ico'
if (-not (Test-Path $Icon)) {
  # 回退到皮肤包内图标
  $Icon = Join-Path $SkinDir 'assets\maid-atelier-maid-left-v5.webp'
}
$IconLocation = if (Test-Path $Icon) { "$Icon,0" } else { '' }

$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop 'DeepSeek Harness 鲸鱼娘.lnk'

$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut($ShortcutPath)
$lnk.TargetPath = $Launcher
$lnk.WorkingDirectory = Split-Path $Launcher -Parent
if ($IconLocation) { $lnk.IconLocation = $IconLocation }
$lnk.Description = 'DeepSeek Harness Web GUI (鲸鱼娘皮肤 maid-atelier)'
$lnk.WindowStyle = 1
$lnk.Save()

Write-Host "[shortcut] 已创建: $ShortcutPath" -ForegroundColor Green
if ($IconLocation) { Write-Host "[shortcut] 图标: $IconLocation" }
