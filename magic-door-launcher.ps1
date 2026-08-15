# DeepSeek Harness — 魔法之门启动器（双模式版）
# 支持两种启动：
#   1. 标准启动（dsh）- 直接用 deepseek-harness
#   2. 安全启动（dsh-safe）- 用 dsh-home 配置 + 自动恢复兔子配置
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$port = 3080
$url = "http://127.0.0.1:$port/"
$dsh_repo = 'D:\\AI\\deepseek\\deepseek-harness'
$dsh_home = 'D:\\AI\\deepseek\\dsh-home'
$node = 'D:\\chajian\\node.exe'

# 环境变量（兔子 API 需代理）
$env:HTTP_PROXY = 'http://127.0.0.1:7897'
$env:HTTPS_PROXY = 'http://127.0.0.1:7897'
$env:NODE_USE_ENV_PROXY = '1'
$env:DSH_HOME = $dsh_home

# 启动模式选择（弹出选择框）
$choice = [System.Windows.Forms.MessageBox]::Show(
  "选择启动模式：`n`n[是] 安全启动（推荐）- 自动恢复兔子配置`n[否] 标准启动 - 直接用 deepseek-harness",
  '魔法之门启动选择',
  'YesNo',
  'Question'
)

if ($choice -eq 'Yes') {
  $mode = 'safe'
  # 安全模式：先恢复配置
  Write-Host '正在恢复兔子配置...' -ForegroundColor Cyan
  $restoreScript = 'D:\AI\deepseek\dsh-restore-config.ps1'
  if (Test-Path $restoreScript) {
    & $restoreScript
  } else {
    Write-Host "⚠️ 配置恢复脚本不存在: $restoreScript" -ForegroundColor Yellow
  }
  $serverArgs = @('apps/cli/lib/bin.js', 'web', '--port', "$port", '--host', '127.0.0.1')
  $repo = $dsh_home
} else {
  $mode = 'standard'
  Write-Host '使用标准启动模式' -ForegroundColor Yellow
  $serverArgs = @('apps/cli/lib/bin.js', 'web', '--port', "$port", '--host', '127.0.0.1')
  $repo = $dsh_repo
}

function Test-PortOpen([int]$p) {
  try {
    $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction Stop
    return $null -ne $c
  } catch {
    return $false
  }
}

if (-not (Test-PortOpen $port)) {
  Write-Host '魔法之门尚未开启，正在启动 DeepSeek Harness 服务…'
  Start-Process -FilePath $node -ArgumentList $serverArgs -WorkingDirectory $repo -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(45)
  while (-not (Test-PortOpen $port) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
  }
  if (-not (Test-PortOpen $port)) {
    [System.Windows.Forms.MessageBox]::Show('DeepSeek Harness 服务启动失败：3080 端口未能监听。', '魔法之门', 'OK', 'Error') | Out-Null
    exit 1
  }
  Write-Host '服务已就绪。'
} else {
  Write-Host '服务已在运行。'
}

Start-Process $url
