# DineQR - GitHub Auto Sync (Continuous)
# Syncs every 10 seconds. Only commits/pushes when there are actual changes.
# Uses rebase to avoid merge commits and stash to prevent conflicts.
# Press Ctrl+C to stop.

Set-Location $PSScriptRoot

$syncInterval = 10  # seconds

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DineQR - GitHub Auto Sync" -ForegroundColor Cyan
Write-Host "   Syncing every ${syncInterval}s | Ctrl+C to stop" -ForegroundColor DarkCyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$cycle = 0

while ($true) {
    $cycle++
    $now = Get-Date -Format "HH:mm:ss"

    # Check if there are local changes
    $changes = git status --porcelain 2>$null
    $hasChanges = [bool]$changes

    if (-not $hasChanges) {
        # No local changes — do a quiet pull only
        $pullOutput = git pull origin main --rebase --quiet 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$now] #$cycle - In sync (no local changes)" -ForegroundColor DarkGray
        } else {
            Write-Host "[$now] #$cycle - Pull issue: $pullOutput" -ForegroundColor Red
        }
    } else {
        Write-Host "[$now] #$cycle - Changes detected, syncing..." -ForegroundColor Yellow

        # Stash local changes to safely pull
        git stash push -m "auto-sync-stash" --quiet 2>$null
        $stashed = $LASTEXITCODE -eq 0

        # Pull latest with rebase (avoids messy merge commits)
        git pull origin main --rebase --quiet 2>&1
        $pullOk = $LASTEXITCODE -eq 0

        # Restore stashed changes
        if ($stashed) {
            $popOutput = git stash pop --quiet 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[$now]   CONFLICT detected! Aborting this cycle." -ForegroundColor Red
                Write-Host "[$now]   Run 'git stash pop' and resolve manually." -ForegroundColor Red
                git stash drop --quiet 2>$null
                Start-Sleep -Seconds $syncInterval
                continue
            }
        }

        # Stage, commit, and push
        git add -A
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "Auto sync: $timestamp" --quiet 2>$null

        if ($LASTEXITCODE -eq 0) {
            git push origin main --quiet 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[$now]   Pushed successfully." -ForegroundColor Green
            } else {
                Write-Host "[$now]   Push failed. Will retry next cycle." -ForegroundColor Red
            }
        } else {
            Write-Host "[$now]   Nothing new to commit." -ForegroundColor DarkGray
        }
    }

    Start-Sleep -Seconds $syncInterval
}
