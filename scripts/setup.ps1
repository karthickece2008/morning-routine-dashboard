# Morning Routine Dashboard - Windows one-click setup
# ---------------------------------------------------------------------------
# This script:
#   1. Ensures Node.js / npm are installed (winget).
#   2. Installs n8n globally if missing.
#   3. Starts n8n on the default port (5678) in the background.
#   4. Imports a ready-made workflow and activates it so the webhook
#      responds on http://localhost:5678/webhook/morning-routine.
#   5. Clones the dashboard from GitHub into a sibling folder.
#   6. Pre-wires the n8n webhook URL into the dashboard's localStorage
#      defaults so the app connects on first launch without manual setup.
#   7. Runs `npm install` and `npm run dev` and opens the browser.
#
# Re-runnable: safe to execute multiple times. It skips steps that are
# already complete and refreshes the dashboard code via git pull.
#
# Usage:  double-click setup.bat   OR   powershell -File setup.ps1
# ---------------------------------------------------------------------------

[CmdletBinding()]
param(
    [string]$RepoUrl = "https://github.com/karthickece2008/morning-routine-dashboard.git",
    [string]$ProjectDir = "$PSScriptRoot\..\morning-routine-dashboard",
    [int]$N8nPort = 5678,
    [string]$WebhookPath = "morning-routine",
    [switch]$SkipN8n
)

$ErrorActionPreference = "Stop"
$WebhookUrl = "http://localhost:$N8nPort/webhook/$WebhookPath"

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    X $msg" -ForegroundColor Red }

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Wait-For-Url($url, $timeoutSec = 60) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($resp.StatusCode -lt 500) { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Get-N8nCommand() {
    $cmd = Get-Command "n8n.cmd" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $plain = Get-Command "n8n" -ErrorAction SilentlyContinue
    if ($plain) {
        if ($plain.Source -match '\.(cmd|bat)$') { return $plain.Source }
        return $plain.Source
    }

    return $null
}

# ===========================================================================
# 1. Ensure Node.js / npm
# ===========================================================================
Write-Step "Checking Node.js and npm"
if ((Test-Command "node") -and (Test-Command "npm")) {
    $nodeVer = (node -v)
    $npmVer = (npm -v)
    Write-Ok "Node $nodeVer, npm $npmVer already installed."
} else {
    Write-Warn "Node.js not found. Installing via winget..."
    if (-not (Test-Command "winget")) {
        Write-Err "winget is not available. Please install Node.js LTS manually from https://nodejs.org and re-run this script."
        exit 1
    }
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Test-Command "node")) {
        Write-Err "Node.js install finished but node is not on PATH. Open a new terminal and re-run this script."
        exit 1
    }
    Write-Ok "Node $(node -v) installed."
}

# ===========================================================================
# 2. Ensure n8n is installed
# ===========================================================================
if (-not $SkipN8n) {
    Write-Step "Checking n8n"
    if (Test-Command "n8n") {
        Write-Ok "n8n already installed: $(n8n --version 2>$null)"
    } else {
        Write-Warn "n8n not found. Installing globally via npm..."
        npm install -g n8n
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to install n8n. Try manually: npm install -g n8n"
            exit 1
        }
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-Ok "n8n installed."
    }

    # =========================================================================
    # 3. Start n8n in the background (default port 5678)
    # =========================================================================
    Write-Step "Starting n8n on port $N8nPort"
    $n8nHome = Join-Path $env:USERPROFILE ".n8n"
    if (-not (Test-Path $n8nHome)) { New-Item -ItemType Directory -Path $n8nHome | Out-Null }

    $existing = Get-NetTCPConnection -LocalPort $N8nPort -State Listen -ErrorAction SilentlyContinue
    if ($existing) {
        $pidList = $existing.OwningProcess | Sort-Object -Unique
        foreach ($p in $pidList) {
            try {
                Stop-Process -Id $p -Force -ErrorAction Stop
                Write-Warn "Killed stale process on port $N8nPort (PID $p)."
            } catch { }
        }
        Start-Sleep -Seconds 1
    }

    $n8nLog = Join-Path $PSScriptRoot "n8n-setup.log"
    $n8nErrLog = Join-Path $PSScriptRoot "n8n-setup.err.log"
    $env:N8N_PORT = "$N8nPort"
    $env:N8N_HOST = "localhost"
    $env:N8N_USER_FOLDER = $n8nHome
    $env:N8N_SECURE_COOKIE = "false"

    $n8nCommand = Get-N8nCommand
    if (-not $n8nCommand) {
        Write-Err "n8n was installed but no runnable command was found on PATH. Open a new terminal and run: n8n --version"
        exit 1
    }

    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "\"$n8nCommand\"", "start" -WindowStyle Hidden -PassThru -RedirectStandardOutput $n8nLog -RedirectStandardError $n8nErrLog
    Write-Warn "n8n starting (PID $($proc.Id)). Waiting for http://localhost:$N8nPort ..."
    if (-not (Wait-For-Url "http://localhost:$N8nPort/healthz" 60)) {
        Write-Warn "Health endpoint did not respond within 60s; continuing anyway (n8n may still be starting)."
        if (Test-Path $n8nErrLog) {
            Write-Warn "Check $n8nErrLog if n8n does not come up."
        }
    } else {
        Write-Ok "n8n is up at http://localhost:$N8nPort"
    }

    # =========================================================================
    # 4. Import and activate the workflow
    # =========================================================================
    Write-Step "Importing webhook workflow into n8n"
    $workflowJson = Join-Path $PSScriptRoot "morning-routine-workflow.json"

    & cmd.exe /c "\"$n8nCommand\" import:workflow --input \"$workflowJson\"" 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Warn "CLI import did not report success. The workflow may already exist; continuing."
    }

    $apiBase = "http://localhost:$N8nPort/api/v1"
    try {
        $workflows = Invoke-RestMethod -Uri "$apiBase/workflows" -Method Get -ErrorAction Stop
        $target = $workflows.data | Where-Object { $_.name -eq "Morning Routine Dashboard" } | Select-Object -First 1
        if ($target) {
            if ($target.active -ne $true) {
                $body = @{ active = $true } | ConvertTo-Json
                Invoke-RestMethod -Uri "$apiBase/workflows/$($target.id)" -Method Patch -Body $body -ContentType "application/json" -ErrorAction Stop | Out-Null
                Write-Ok "Workflow activated: id=$($target.id)."
            } else {
                Write-Ok "Workflow already active: id=$($target.id)."
            }
        } else {
            Write-Warn "Workflow not found via API yet. It may still be importing - the dashboard will retry on connect."
        }
    } catch {
        Write-Warn "Could not activate via REST API (first-run owner account may be required). The webhook will work once you activate it in the n8n UI at http://localhost:$N8nPort."
    }

    if (Wait-For-Url $WebhookUrl 15) {
        Write-Ok "Webhook reachable at $WebhookUrl"
    } else {
        Write-Warn "Webhook not reachable yet. Open http://localhost:$N8nPort in a browser, finish the owner setup if prompted, and toggle the workflow active. The URL $WebhookUrl is still wired into the dashboard."
    }
}

# ===========================================================================
# 5. Clone (or update) the dashboard from GitHub
# ===========================================================================
Write-Step "Fetching dashboard from $RepoUrl"
$repoParent = Split-Path $PSScriptRoot -Parent
$ProjectDir = Join-Path $repoParent "morning-routine-dashboard"

if (Test-Path (Join-Path $ProjectDir ".git")) {
    Write-Warn "Project folder exists - pulling latest."
    Push-Location $ProjectDir
    git pull --ff-only
    Pop-Location
} else {
    git clone $RepoUrl $ProjectDir
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git clone failed. Check the repo URL and your network, then re-run."
        exit 1
    }
}
Write-Ok "Dashboard code is at $ProjectDir"

# ===========================================================================
# 6. Pre-wire the n8n webhook URL into the dashboard defaults
# ===========================================================================
Write-Step "Pre-wiring webhook URL into dashboard defaults"
$typesFile = Join-Path $ProjectDir "src\lib\types.ts"
if (Test-Path $typesFile) {
    $content = Get-Content $typesFile -Raw
    $replacementUrl = $WebhookUrl -replace '\$', '$$'

    if ($content -match "webhookUrl:\s*'[^']*'") {
        $newContent = $content -replace "(webhookUrl:\s*)'[^']*'", "`$1'$replacementUrl'"
        Set-Content -Path $typesFile -Value $newContent -NoNewline
        Write-Ok "DEFAULT_SETTINGS.webhookUrl set to $WebhookUrl"
    } else {
        Write-Warn "Could not find webhookUrl default in types.ts - leaving file unchanged. You can paste the URL manually in the App Settings panel."
    }
} else {
    Write-Warn "types.ts not found at expected path. The dashboard will still run; paste $WebhookUrl into Settings manually."
}

# ===========================================================================
# 7. Install deps and launch the dev server in a new window
# ===========================================================================
Write-Step "Installing dashboard dependencies"
Push-Location $ProjectDir
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed."
    Pop-Location
    exit 1
}
Pop-Location

Write-Step "Launching dashboard"
$devCmd = "cd `"$ProjectDir`"; npm run dev"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", $devCmd -WindowStyle Normal

Start-Sleep -Seconds 5
$dashboardUrl = "http://localhost:5173"
try { Start-Process $dashboardUrl } catch { Write-Warn "Could not auto-open browser. Visit $dashboardUrl manually." }

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " All set!" -ForegroundColor Green
Write-Host "   n8n:        http://localhost:$N8nPort" -ForegroundColor White
Write-Host "   webhook:    $WebhookUrl" -ForegroundColor White
Write-Host "   dashboard:  $dashboardUrl" -ForegroundColor White
Write-Host "============================================================`n" -ForegroundColor Cyan
Write-Host "If the dashboard shows 'Disconnected', open http://localhost:$N8nPort in a browser,"
Write-Host "finish the one-time n8n owner setup, then toggle the 'Morning Routine Dashboard'"
Write-Host "workflow to Active. Click 'Test' in the dashboard's App Settings panel."
