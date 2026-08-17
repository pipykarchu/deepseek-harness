# ensure-skin.ps1 — 把 maid-atelier 皮肤安装进 dsh web profile（幂等）
# 用法:
#   powershell -ExecutionPolicy Bypass -File scripts\ensure-skin.ps1 -SkinDir "C:\...\maid-atelier"
#   powershell -ExecutionPolicy Bypass -File scripts\ensure-skin.ps1 -SkinDir "..." -CreateShortcut
# 环境变量覆盖:
#   DSH_HOME     默认 %USERPROFILE%\.dsh
#   DSH_HARNESS  harness checkout 根目录（缺省自动探测常用路径）

param(
  [Parameter(Mandatory = $true)][string]$SkinDir,
  [string]$HarnessDir = $env:DSH_HARNESS,
  [switch]$CreateShortcut
)

$ErrorActionPreference = 'Stop'
$SkinPackage = '@dsh-external/dsh-client-ui-skin-maid-atelier'

if (-not (Test-Path (Join-Path $SkinDir 'package.json'))) {
  Write-Host "[ensure-skin] 错误: 未找到皮肤包: $SkinDir" -ForegroundColor Red
  exit 1
}

# ---- 自动探测 harness 根目录 ----
$candidates = @()
if ($HarnessDir) { $candidates += $HarnessDir }
$candidates += 'D:\DEEPSEEK harness\deepseek-harness'
$candidates += 'D:\AI\deepseek\deepseek-harness'
$candidates += (Join-Path (Split-Path $PSScriptRoot -Parent) '..\deepseek-harness')
$CliJs = $null
foreach ($c in $candidates) {
  $p = Join-Path $c 'apps\cli\lib\bin.js'
  if (Test-Path $p) { $CliJs = $p; $HarnessDir = $c; break }
}
if (-not $CliJs) {
  Write-Host "[ensure-skin] 错误: 未找到 dsh CLI，请设置 DSH_HARNESS 环境变量指向 harness 目录。" -ForegroundColor Red
  Write-Host "  已尝试: $($candidates -join ' ; ')" -ForegroundColor Red
  exit 1
}
Write-Host "[ensure-skin] harness: $HarnessDir" -ForegroundColor DarkGray

# ---- DSH_HOME ----
$DshHome = $env:DSH_HOME
if (-not $DshHome) { $DshHome = Join-Path $env:USERPROFILE '.dsh' }
$ProfileDir = Join-Path $DshHome 'profiles\web'
$Manifest = Join-Path $ProfileDir 'package.json'
Write-Host "[ensure-skin] DSH_HOME: $DshHome" -ForegroundColor DarkGray

# ---- 幂等检查：已安装且 link 指向当前包则跳过 ----
$SkinDirFull = [System.IO.Path]::GetFullPath($SkinDir).TrimEnd('\')
$ResolvedSkin = $null
if (Test-Path $Manifest) {
  $m = Get-Content $Manifest -Raw | ConvertFrom-Json
  if ($m.dependencies.$SkinPackage) {
    $dep = [string]$m.dependencies.$SkinPackage
    if ($dep -match '^link:(.+)$') {
      $linkTarget = [System.IO.Path]::GetFullPath($Matches[1]).TrimEnd('\')
      if ($linkTarget -eq $SkinDirFull) { $ResolvedSkin = $linkTarget }
    }
  }
}

if ($ResolvedSkin) {
  Write-Host "[ensure-skin] 皮肤已安装且指向当前包，跳过: $ResolvedSkin" -ForegroundColor Green
} else {
  Write-Host "[ensure-skin] 安装皮肤到 web profile: $SkinDir" -ForegroundColor Cyan
  & node $CliJs plugin --profile web add $SkinDir
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ensure-skin] 安装失败 (exit $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
  }
  Write-Host "[ensure-skin] 皮肤安装完成" -ForegroundColor Green
}

if ($CreateShortcut) {
  $script = Join-Path $PSScriptRoot 'make-desktop-shortcut.ps1'
  if (Test-Path $script) { & $script -SkinDir $SkinDir }
}

exit 0
