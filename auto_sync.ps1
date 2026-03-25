# DineQR - GitHub Auto Sync Script
# Usage: Right-click -> "Run with PowerShell" or run from terminal: .\auto_sync.ps1

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DineQR - GitHub Auto Sync" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Pull latest changes
Write-Host "[1/4] Pulling latest changes..." -ForegroundColor Yellow
git pull origin main --no-edit
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Pull failed. Resolve conflicts manually." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# 2. Stage all changes
Write-Host "[2/4] Staging changes..." -ForegroundColor Yellow
git add -A
Write-Host ""

# 3. Commit with timestamp
Write-Host "[3/4] Committing changes..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -m "Auto sync: $timestamp"
    Write-Host "Changes committed." -ForegroundColor Green
} else {
    Write-Host "No changes to commit." -ForegroundColor Gray
}
Write-Host ""

# 4. Push to remote
Write-Host "[4/4] Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Push failed. Check connection or credentials." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Sync complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Read-Host "Press Enter to exit"
