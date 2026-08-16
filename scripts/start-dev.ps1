param(
    [int]$TimeoutSeconds = 180,
    [switch]$RebuildDas3
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

function Get-FilesFingerprint {
    param(
        [string]$BaseDirectory,
        [string[]]$RelativePaths
    )

    $entries = foreach ($relativePath in ($RelativePaths | Sort-Object -Unique)) {
        $absolutePath = Join-Path $BaseDirectory $relativePath
        if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
            throw "Fingerprint input is missing: $absolutePath"
        }

        $normalizedPath = $relativePath.Replace('\', '/')
        $fileHash = (Get-FileHash -LiteralPath $absolutePath -Algorithm SHA256).Hash.ToLowerInvariant()
        "${normalizedPath}:$fileHash"
    }

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($entries -join "`n")
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    } finally {
        $algorithm.Dispose()
    }
}

function Ensure-NodeDependencies {
    param(
        [System.Collections.IDictionary]$Definition,
        [string]$RuntimeDirectory
    )

    $fingerprint = Get-FilesFingerprint `
        -BaseDirectory $Definition.directory `
        -RelativePaths @('package.json', 'package-lock.json')
    $stampPath = Join-Path $RuntimeDirectory "npm-$($Definition.name).sha256"
    $entrypointPath = Join-Path $Definition.directory $Definition.script
    $entrypointExists = Test-Path -LiteralPath $entrypointPath -PathType Leaf
    $storedFingerprint = if (Test-Path -LiteralPath $stampPath -PathType Leaf) {
        (Get-Content -Raw -LiteralPath $stampPath).Trim()
    } else {
        ''
    }

    if ($entrypointExists -and $storedFingerprint -eq $fingerprint) {
        return
    }

    Write-Host "Installing $($Definition.name) dependencies..."
    & npm.cmd ci --prefix $Definition.directory
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed for $($Definition.name) with exit code $LASTEXITCODE."
    }
    if (-not (Test-Path -LiteralPath $entrypointPath -PathType Leaf)) {
        throw "npm ci completed, but the $($Definition.name) entrypoint is still missing."
    }

    Set-Content -LiteralPath $stampPath -Value $fingerprint -NoNewline
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

foreach ($command in @('docker', 'node.exe', 'npm.cmd')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Required command '$command' was not found on PATH."
    }
}

$dockerServerVersion = @(& docker info --format '{{.ServerVersion}}' 2>$null)
if ($LASTEXITCODE -ne 0 -or $dockerServerVersion.Count -eq 0) {
    throw 'Docker Desktop is not ready. Start Docker Desktop, wait for the engine, and try again.'
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
    Ensure-NodeDependencies -Definition $definition -RuntimeDirectory $runtimeDirectory
}

$das3BuildInputPaths = @(
    '.dockerignore',
    'Dockerfile',
    'docker-entrypoint.sh',
    'langgraph.json',
    'pyproject.toml',
    'requirements.txt'
)
foreach ($directoryName in @('src', 'scripts', 'data')) {
    $inputDirectory = Join-Path $composeDirectory $directoryName
    if (-not (Test-Path -LiteralPath $inputDirectory -PathType Container)) {
        continue
    }
    $das3BuildInputPaths += Get-ChildItem -LiteralPath $inputDirectory -Recurse -File |
        Where-Object {
            $_.FullName -notmatch '[\\/]__pycache__[\\/]' `
                -and $_.Extension -notin @('.pyc', '.pyo')
        } |
        ForEach-Object { $_.FullName.Substring($composeDirectory.Length + 1) }
}

$das3Fingerprint = Get-FilesFingerprint `
    -BaseDirectory $composeDirectory `
    -RelativePaths $das3BuildInputPaths
$das3BuildStatePath = Join-Path $runtimeDirectory 'das3-build.json'
$das3ImageOutput = @(& docker image inspect 'das-agent:dev' --format '{{.Id}}' 2>$null)
$das3ImageExists = $LASTEXITCODE -eq 0 -and $das3ImageOutput.Count -gt 0
$das3ImageId = if ($das3ImageExists) {
    ($das3ImageOutput -join '').Trim()
} else {
    ''
}
$das3BuildState = $null
if (Test-Path -LiteralPath $das3BuildStatePath -PathType Leaf) {
    try {
        $das3BuildState = Get-Content -Raw -LiteralPath $das3BuildStatePath | ConvertFrom-Json
    } catch {
        Write-Warning 'The DAS3 build state is invalid; DAS3 will be rebuilt.'
    }
}
$das3BuildIsCurrent = $das3ImageExists `
    -and $null -ne $das3BuildState `
    -and $das3BuildState.fingerprint -eq $das3Fingerprint `
    -and $das3BuildState.imageId -eq $das3ImageId

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
    if ($RebuildDas3 -or -not $das3BuildIsCurrent) {
        Write-Host 'Building DAS3 because its image is missing, stale, or explicitly requested...'
        & docker compose --project-directory $composeDirectory build langgraph-dev
        if ($LASTEXITCODE -ne 0) {
            throw "Docker Compose build failed with exit code $LASTEXITCODE."
        }

        $das3ImageOutput = @(& docker image inspect 'das-agent:dev' --format '{{.Id}}')
        if ($LASTEXITCODE -ne 0 -or $das3ImageOutput.Count -eq 0) {
            throw 'DAS3 built successfully, but its image could not be inspected.'
        }
        $das3ImageId = ($das3ImageOutput -join '').Trim()
        [ordered]@{
            fingerprint = $das3Fingerprint
            imageId = $das3ImageId
        } | ConvertTo-Json | Set-Content -LiteralPath $das3BuildStatePath
    } else {
        Write-Host 'Reusing the current DAS3 image.'
    }

    Write-Host 'Starting DAS3 Docker services...'
    & docker compose --project-directory $composeDirectory up -d --no-build
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
