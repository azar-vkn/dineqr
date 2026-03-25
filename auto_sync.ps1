# DineQR - GitHub Auto Sync (Smart Continuous)
# Detects latest changes from both GitHub and local, syncs intelligently.
# Press Ctrl+C to stop.

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
    $cycle++
    $now = Get-Date -Format "HH:mm:ss"

    # --- Detect local changes ---
    $localChanges = git status --porcelain 2>$null
    $hasLocalChanges = [bool]$localChanges

    # --- Detect remote changes (fetch without merging) ---
    git fetch origin main --quiet 2>$null

    $localHead = git rev-parse HEAD 2>$null
    $remoteHead = git rev-parse origin/main 2>$null
    $mergeBase = git merge-base HEAD origin/main 2>$null

    $remoteAhead = ($localHead -ne $remoteHead) -and ($mergeBase -eq $localHead)
    $localAhead = ($localHead -ne $remoteHead) -and ($mergeBase -eq $remoteHead)
    $diverged = ($localHead -ne $remoteHead) -and ($mergeBase -ne $localHead) -and ($mergeBase -ne $remoteHead)
    $inSync = ($localHead -eq $remoteHead)

    # --- CASE 1: No changes anywhere ---
    if ($inSync -and -not $hasLocalChanges) {
        Write-Host "[$now] #$cycle - Everything in sync" -ForegroundColor DarkGray
    }

    # --- CASE 2: Only remote has new changes (pull first) ---
    elseif (($remoteAhead -or $diverged) -and -not $hasLocalChanges) {
        Write-Host "[$now] #$cycle - Remote has updates, pulling..." -ForegroundColor Magenta
        git pull origin main --rebase --quiet 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$now]   Pulled latest from GitHub." -ForegroundColor Green
        } else {
            Write-Host "[$now]   Pull failed! Check manually." -ForegroundColor Red
        }
    }

    # --- CASE 3: Only local has new changes (commit & push) ---
    elseif (($inSync -or $localAhead) -and $hasLocalChanges) {
        Write-Host "[$now] #$cycle - Local changes detected, pushing..." -ForegroundColor Yellow
        git add -A
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "Auto sync: $timestamp" --quiet 2>$null
        if ($LASTEXITCODE -eq 0) {
            git push origin main --quiet 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[$now]   Pushed to GitHub." -ForegroundColor Green
            } else {
                Write-Host "[$now]   Push failed! Will retry." -ForegroundColor Red
            }
        } else {
            Write-Host "[$now]   Nothing new to commit." -ForegroundColor DarkGray
        }
    }

    # --- CASE 4: Both local AND remote have changes (pull remote first, then push local) ---
    elseif (($remoteAhead -or $diverged) -and $hasLocalChanges) {
        Write-Host "[$now] #$cycle - Both sides changed! Syncing smart..." -ForegroundColor Cyan

        # Stash local changes
        git stash push -m "auto-sync-stash" --quiet 2>$null
        $stashed = $LASTEXITCODE -eq 0

        # Pull remote changes first
        Write-Host "[$now]   Pulling remote first..." -ForegroundColor Magenta
        git pull origin main --rebase --quiet 2>&1
        $pullOk = $LASTEXITCODE -eq 0

        if (-not $pullOk) {
            Write-Host "[$now]   Pull failed during merge. Resolve manually." -ForegroundColor Red
            if ($stashed) { git stash pop --quiet 2>$null }
            Start-Sleep -Seconds $syncInterval
            continue
        }

        # Restore local changes on top
        if ($stashed) {
            git stash pop --quiet 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "[$now]   CONFLICT! Your changes clash with remote." -ForegroundColor Red
                Write-Host "[$now]   Run 'git stash pop' and resolve manually." -ForegroundColor Red
                Start-Sleep -Seconds $syncInterval
                continue
            }
        }

        # Commit and push local changes
        git add -A
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "Auto sync: $timestamp" --quiet 2>$null
        if ($LASTEXITCODE -eq 0) {
            git push origin main --quiet 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[$now]   Synced both directions!" -ForegroundColor Green
            } else {
                Write-Host "[$now]   Push failed after pull. Will retry." -ForegroundColor Red
            }
        }
    }

    # --- CASE 5: Local is ahead (committed but not pushed) ---
    elseif ($localAhead -and -not $hasLocalChanges) {
        Write-Host "[$now] #$cycle - Unpushed commits, pushing..." -ForegroundColor Yellow
        git push origin main --quiet 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$now]   Pushed to GitHub." -ForegroundColor Green
        } else {
            Write-Host "[$now]   Push failed! Will retry." -ForegroundColor Red
        }
    }

    Start-Sleep -Seconds $syncInterval
}
