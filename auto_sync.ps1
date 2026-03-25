# DineQR - Smart GitHub Auto Sync (Continuous)
# Detects latest changes from both GitHub and local, syncs intelligently.
# Runs every 10 seconds. Press Ctrl+C to stop.

Set-Location $PSScriptRoot
$syncInterval = 10  # seconds

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   DineQR - Smart GitHub Auto Sync" -ForegroundColor Cyan
Write-Host "   Syncing every ${syncInterval}s | Ctrl+C to stop" -ForegroundColor DarkCyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$cycle = 0

while ($true) {
    $cycleStart = Get-Date
    $cycle++
    $now = Get-Date -Format "HH:mm:ss"

    try {
        # --- Detect local changes ---
        $localChanges = git status --porcelain 2>$null
        $hasLocalChanges = [bool]$localChanges

        # --- Fetch remote (no merge) ---
        $fetchOutput = git fetch origin main 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[$now] #$cycle - Fetch failed. Network issue or credentials. Skipping." -ForegroundColor Red
            Write-Host "[$now]   Details: $fetchOutput" -ForegroundColor DarkGray
            
            # Wait remainder of the 10s interval
            $elapsed = ((Get-Date) - $cycleStart).TotalSeconds
            $wait = [Math]::Max(0, $syncInterval - $elapsed)
            Start-Sleep -Seconds $wait
            continue
        }

        # --- Compare local vs remote ---
        $localHead = (git rev-parse HEAD 2>$null).Trim()
        $remoteHead = (git rev-parse origin/main 2>$null).Trim()
        $mergeBase = (git merge-base HEAD origin/main 2>$null).Trim()

        $remoteAhead = ($localHead -ne $remoteHead) -and ($mergeBase -eq $localHead)
        $localAhead  = ($localHead -ne $remoteHead) -and ($mergeBase -eq $remoteHead)
        $diverged    = ($localHead -ne $remoteHead) -and ($mergeBase -ne $localHead) -and ($mergeBase -ne $remoteHead)
        $inSync      = ($localHead -eq $remoteHead)

        # --- CASE 1: No changes anywhere ---
        if ($inSync -and -not $hasLocalChanges) {
            Write-Host "[$now] #$cycle - Everything in sync" -ForegroundColor DarkGray
        }

        # --- CASE 2: Only remote has new changes ---
        elseif (($remoteAhead -or $diverged) -and -not $hasLocalChanges) {
            Write-Host "[$now] #$cycle - Remote updated, pulling..." -ForegroundColor Magenta
            git pull origin main --rebase --quiet 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[$now]   Pulled latest from GitHub." -ForegroundColor Green
            } else {
                Write-Host "[$now]   Pull failed. Skipping." -ForegroundColor Red
            }
        }

        # --- CASE 3: Only local has new changes ---
        elseif (($inSync -or $localAhead) -and $hasLocalChanges) {
            Write-Host "[$now] #$cycle - Local changes, pushing..." -ForegroundColor Yellow
            git add -A 2>&1 | Out-Null
            $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "Auto sync: $ts" --quiet 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                git push origin main --quiet 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[$now]   Pushed to GitHub." -ForegroundColor Green
                } else {
                    Write-Host "[$now]   Push failed. Retry next cycle." -ForegroundColor Red
                }
            }
        }

        # --- CASE 4: Both sides changed ---
        elseif (($remoteAhead -or $diverged) -and $hasLocalChanges) {
            Write-Host "[$now] #$cycle - Both changed! Smart sync..." -ForegroundColor Cyan

            git stash push -m "auto-sync-stash" --quiet 2>&1 | Out-Null
            $stashed = $LASTEXITCODE -eq 0

            Write-Host "[$now]   Pulling remote first..." -ForegroundColor Magenta
            git pull origin main --rebase --quiet 2>&1 | Out-Null

            if ($LASTEXITCODE -ne 0) {
                Write-Host "[$now]   Pull failed. Restoring your changes." -ForegroundColor Red
                if ($stashed) { git stash pop --quiet 2>&1 | Out-Null }
                
                $elapsed = ((Get-Date) - $cycleStart).TotalSeconds
                $wait = [Math]::Max(0, $syncInterval - $elapsed)
                Start-Sleep -Seconds $wait
                continue
            }

            if ($stashed) {
                git stash pop --quiet 2>&1 | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "[$now]   CONFLICT! Resolve with 'git stash pop'." -ForegroundColor Red
                    $elapsed = ((Get-Date) - $cycleStart).TotalSeconds
                    $wait = [Math]::Max(0, $syncInterval - $elapsed)
                    Start-Sleep -Seconds $wait
                    continue
                }
            }

            git add -A 2>&1 | Out-Null
            $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            git commit -m "Auto sync: $ts" --quiet 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                git push origin main --quiet 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "[$now]   Synced both directions!" -ForegroundColor Green
                } else {
                    Write-Host "[$now]   Push failed after pull. Retry next." -ForegroundColor Red
                }
            }
        }

        # --- CASE 5: Local ahead (unpushed commits) ---
        elseif ($localAhead -and -not $hasLocalChanges) {
            Write-Host "[$now] #$cycle - Unpushed commits, pushing..." -ForegroundColor Yellow
            git push origin main --quiet 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[$now]   Pushed to GitHub." -ForegroundColor Green
            } else {
                Write-Host "[$now]   Push failed. Retry next." -ForegroundColor Red
            }
        }
    }
    catch {
        Write-Host "[$now] #$cycle - Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    # --- Wait exactly the remaining time to keep a perfect 10s cycle ---
    $elapsed = ((Get-Date) - $cycleStart).TotalSeconds
    $wait = [Math]::Max(0, $syncInterval - $elapsed)
    Start-Sleep -Seconds $wait
}
