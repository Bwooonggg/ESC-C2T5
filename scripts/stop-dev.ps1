$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $repositoryRoot '.dev\processes.json'
$composeDirectory = Join-Path $repositoryRoot 'DAS_3'

if (-not (Test-Path -LiteralPath $statePath)) {
    Write-Host 'No development processes are recorded as running.'
    exit 0
}

$state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json

foreach ($record in $state.processes) {
    $expectedStart = [DateTime]::new(
        [long]$record.startedAtUtcTicks,
        [DateTimeKind]::Utc
    )
    $launcher = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    $launcherMatches = $null -ne $launcher `
        -and [Math]::Abs(($launcher.StartTime.ToUniversalTime() - $expectedStart).TotalSeconds) -le 2

    $listenerProcessIds = @(
        Get-NetTCPConnection -LocalPort $record.port -State Listen -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    )
    foreach ($listenerProcessId in $listenerProcessIds) {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $listenerProcessId"
        $isRecordedLauncher = $listenerProcessId -eq $record.id -and $launcherMatches
        $isRepositoryProcess = $null -ne $processInfo `
            -and $processInfo.CommandLine -like "*$repositoryRoot*"
        if (-not $isRecordedLauncher -and -not $isRepositoryProcess) {
            Write-Warning "Port $($record.port) is owned by an unrecognized process; leaving it running."
            continue
        }

        Write-Host "Stopping $($record.name) on port $($record.port)..."
        & taskkill.exe /PID $listenerProcessId /T /F 2>$null | Out-Null
    }

    $launcher = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    if ($null -eq $launcher) {
        continue
    }

    $actualStart = $launcher.StartTime.ToUniversalTime()
    if ([Math]::Abs(($actualStart - $expectedStart).TotalSeconds) -gt 2) {
        Write-Warning "Skipping reused process ID $($record.id) for $($record.name)."
        continue
    }

    Write-Host "Stopping $($record.name) launcher..."
    & taskkill.exe /PID $record.id /T /F 2>$null | Out-Null
}

if ($state.dockerStartedByScript) {
    Write-Host 'Stopping DAS3 Docker services (volumes are preserved)...'
    & docker compose --project-directory $composeDirectory down
} else {
    Write-Host 'DAS3 was already running before start-dev.ps1 and was left running.'
}

Remove-Item -LiteralPath $statePath
Write-Host 'Development services stopped. Logs remain in .dev\logs.'
