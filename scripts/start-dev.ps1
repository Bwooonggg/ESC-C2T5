param(
    [int]$TimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $repositoryRoot '.dev'
$logDirectory = Join-Path $runtimeDirectory 'logs'
$statePath = Join-Path $runtimeDirectory 'processes.json'
$stopScript = Join-Path $PSScriptRoot 'stop-dev.ps1'
$composeDirectory = Join-Path $repositoryRoot 'DAS_3'

function Test-TcpPort {
    param([int]$Port)

    foreach ($address in @('127.0.0.1', '::1')) {
        $client = [System.Net.Sockets.TcpClient]::new()
        $cancellation = [System.Threading.CancellationTokenSource]::new(500)
        try {
            $client.ConnectAsync($address, $Port, $cancellation.Token).AsTask().GetAwaiter().GetResult()
            if ($client.Connected) {
                return $true
            }
        } catch {
            # Try the other loopback address.
        } finally {
            $cancellation.Dispose()
            $client.Dispose()
        }
    }

    return $false
}

function Save-State {
    param([System.Collections.IDictionary]$State)

    $State | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath
}

function Start-NodeService {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$NodeCommand,
        [string]$ScriptPath,
        [string[]]$Arguments,
        [int]$Port,
        [System.Collections.IDictionary]$State
    )

    $stdoutPath = Join-Path $logDirectory "$Name.out.log"
    $stderrPath = Join-Path $logDirectory "$Name.err.log"
    $argumentList = @($ScriptPath) + $Arguments
    $process = Start-Process `
        -FilePath $NodeCommand `
        -ArgumentList $argumentList `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -WindowStyle Hidden `
        -PassThru

    $State.processes += [ordered]@{
        name = $Name
        id = $process.Id
        port = $Port
        startedAtUtcTicks = $process.StartTime.ToUniversalTime().Ticks
    }
    Save-State $State
}

foreach ($command in @('docker', 'node.exe')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command '$command' was not found on PATH."
    }
}

$requiredEnvironmentFiles = @(
    'frontend\.env',
    'DAS_1\backend\.env',
    'DAS_3\.env',
    'DAS_7\.env'
)
$missingEnvironmentFiles = @(
    $requiredEnvironmentFiles | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $repositoryRoot $_))
    }
)
if ($missingEnvironmentFiles.Count -gt 0) {
    throw "Missing environment file(s): $($missingEnvironmentFiles -join ', ')"
}

if (Test-Path -LiteralPath $statePath) {
    $previousState = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
    $liveProcesses = @(
        $previousState.processes | Where-Object {
            Get-Process -Id $_.id -ErrorAction SilentlyContinue
        }
    )
    if ($liveProcesses.Count -gt 0) {
        throw 'Development services are already recorded as running. Run scripts\stop-dev.ps1 first.'
    }
    Remove-Item -LiteralPath $statePath
}

foreach ($port in @(4173, 4000, 5173)) {
    if (Test-TcpPort -Port $port) {
        throw "Port $port is already in use. Stop the existing service before continuing."
    }
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$nodeCommand = (Get-Command node.exe).Source
$serviceDefinitions = @(
    [ordered]@{
        name = 'das1'
        port = 4173
        directory = Join-Path $repositoryRoot 'DAS_1\backend'
        script = 'node_modules\tsx\dist\cli.mjs'
        arguments = @('main.ts')
    },
    [ordered]@{
        name = 'das7'
        port = 4000
        directory = Join-Path $repositoryRoot 'DAS_7'
        script = 'node_modules\tsx\dist\cli.mjs'
        arguments = @('watch', 'src\index.ts')
    },
    [ordered]@{
        name = 'frontend'
        port = 5173
        directory = Join-Path $repositoryRoot 'frontend'
        script = 'node_modules\vite\bin\vite.js'
        arguments = @()
    }
)
foreach ($definition in $serviceDefinitions) {
    if (-not (Test-Path -LiteralPath (Join-Path $definition.directory $definition.script))) {
        throw "Dependencies for $($definition.name) are missing. Run npm install in $($definition.directory)."
    }
}

$runningComposeServices = @(
    & docker compose --project-directory $composeDirectory ps --status running --services 2>$null
)
$dockerWasRunning = $runningComposeServices -contains 'langgraph-dev'

$state = [ordered]@{
    startedAtUtc = [DateTime]::UtcNow.ToString('o')
    dockerStartedByScript = -not $dockerWasRunning
    processes = @()
}
Save-State $state

try {
    Write-Host 'Starting DAS3 Docker services...'
    & docker compose --project-directory $composeDirectory up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed with exit code $LASTEXITCODE."
    }

    Write-Host 'Starting DAS1, DAS7, and the centralized frontend...'
    foreach ($definition in $serviceDefinitions) {
        Start-NodeService `
            -Name $definition.name `
            -WorkingDirectory $definition.directory `
            -NodeCommand $nodeCommand `
            -ScriptPath $definition.script `
            -Arguments $definition.arguments `
            -Port $definition.port `
            -State $state
    }

    $services = @(
        [ordered]@{ name = 'DAS3'; port = 2024 },
        [ordered]@{ name = 'DAS1'; port = 4173 },
        [ordered]@{ name = 'DAS7'; port = 4000 },
        [ordered]@{ name = 'Frontend'; port = 5173 }
    )
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $pending = @($services)

    while ($pending.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline) {
        $pending = @(
            $pending | Where-Object {
                -not (Test-TcpPort -Port $_.port)
            }
        )
        if ($pending.Count -gt 0) {
            Start-Sleep -Seconds 2
        }
    }

    if ($pending.Count -gt 0) {
        throw "Timed out waiting for: $(($pending.name) -join ', '). Check .dev\logs."
    }

    Write-Host ''
    Write-Host 'All development services are ready:'
    Write-Host '  Frontend  http://localhost:5173'
    Write-Host '  DAS1      http://localhost:4173'
    Write-Host '  DAS3      http://localhost:2024'
    Write-Host '  DAS7      http://localhost:4000'
    Write-Host ''
    Write-Host 'Stop them with: .\scripts\stop-dev.ps1'
    Write-Host 'Logs are in: .dev\logs'
} catch {
    Write-Error $_ -ErrorAction Continue
    & $stopScript
    exit 1
}
