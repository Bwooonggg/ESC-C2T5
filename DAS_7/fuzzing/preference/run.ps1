param(
    [double]$DurationHours = 12,
    [int]$DurationSeconds = 0,
    [long]$Seed = 0,
    [int]$Port = 4107
)

$ErrorActionPreference = 'Stop'
$backendPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$sourcePath = Join-Path $PSScriptRoot 'PreferenceFuzzer.java'
$buildPath = Join-Path $PSScriptRoot 'build'
$baseUrl = "http://127.0.0.1:$Port"

if ($DurationSeconds -gt 0) {
    $durationMs = [long]$DurationSeconds * 1000
} elseif ($DurationHours -gt 0) {
    $durationMs = [long]($DurationHours * 60 * 60 * 1000)
} else {
    throw 'DurationHours or DurationSeconds must be positive.'
}

$javaCommand = Get-Command java -ErrorAction SilentlyContinue
$javacCommand = Get-Command javac -ErrorAction SilentlyContinue
if (-not $javacCommand) {
    $installedCompiler = Get-ChildItem 'C:\Program Files\Eclipse Adoptium' `
        -Recurse -Filter javac.exe -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending |
        Select-Object -First 1
    if ($installedCompiler) {
        $javacPath = $installedCompiler.FullName
        $javaPath = Join-Path $installedCompiler.DirectoryName 'java.exe'
    }
} else {
    $javacPath = $javacCommand.Source
    $javaPath = if ($javaCommand) { $javaCommand.Source } else { Join-Path $javacCommand.Path 'java.exe' }
}
if (-not $javacPath -or -not (Test-Path -LiteralPath $javacPath)) {
    throw 'A JDK is required but javac was not found.'
}
if (-not $javaPath -or -not (Test-Path -LiteralPath $javaPath)) {
    throw 'A Java runtime was not found next to javac or on PATH.'
}

New-Item -ItemType Directory -Force -Path $buildPath | Out-Null
& $javacPath -encoding UTF-8 -source 8 -target 8 -d $buildPath $sourcePath
if ($LASTEXITCODE -ne 0) { throw "javac failed with exit code $LASTEXITCODE" }

$env:FUZZ_HARNESS_PORT = [string]$Port
$nodeCommand = (Get-Command node.exe -ErrorAction Stop).Source
$tsxEntry = Join-Path $backendPath 'node_modules\tsx\dist\cli.mjs'
$harnessScript = Join-Path $backendPath 'scripts\preference-fuzz-harness.ts'
$harness = Start-Process -FilePath $nodeCommand `
    -ArgumentList @($tsxEntry, $harnessScript) `
    -WorkingDirectory $backendPath -WindowStyle Hidden -PassThru

try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 100; $attempt++) {
        if ($harness.HasExited) {
            throw "The fuzz harness exited early with code $($harness.ExitCode)."
        }
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri "$baseUrl/__fuzz/health" -TimeoutSec 1
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 100
        }
    }
    if (-not $ready) { throw "Timed out waiting for the fuzz harness at $baseUrl." }

    $env:FUZZ_BASE_URL = $baseUrl
    $env:FUZZ_DURATION_MS = [string]$durationMs
    if ($Seed -ne 0) { $env:FUZZ_SEED = [string]$Seed } else { Remove-Item Env:FUZZ_SEED -ErrorAction SilentlyContinue }

    Push-Location $backendPath
    try {
        & $javaPath -cp $buildPath PreferenceFuzzer
        if ($LASTEXITCODE -ne 0) { throw "Fuzzer failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
} finally {
    if (-not $harness.HasExited) {
        Stop-Process -Id $harness.Id -Force
        $harness.WaitForExit()
    }
}
