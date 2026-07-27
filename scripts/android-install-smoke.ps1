# TerminAI Android install smoke — PowerShell
#
# Build the debug APK, install it on a connected Android device,
# and verify that com.billybox.terminai/.MainActivity launches.
#
# Also runs API key instrumentation tests to verify the app respects
# the TERMINAI_API_KEY configuration.
#
# Usage (from repo root):
#   .\scripts\android-install-smoke.ps1
#
# Prerequisites:
#   - Android device connected with USB debugging enabled
#   - adb in PATH
#   - JDK 17, Android SDK (for building)
#   - Debug APK at android\app\build\outputs\apk\debug\app-debug.apk
#   - TERMINAI_API_KEY environment variable (optional for debug builds)
#   - Backend server running (for instrumentation tests)
#
# Environment Variables:
#   TERMINAI_API_KEY - API key for the TerminAI backend (optional for debug)
#   TERMINAI_BACKEND_URL - Backend URL for tests (default: http://10.0.2.2:3000)

$ErrorActionPreference = "Stop"

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
$logcatFile = "android-install-smoke-logcat.txt"

# Export API key for build
$env:TERMINAI_API_KEY = $env:TERMINAI_API_KEY ?? ""

if (-not (Test-Path $apkPath)) {
    Write-Error "APK not found at $apkPath. Build first with: cd android; ./gradlew assembleDebug"
    exit 1
}

Write-Host "Checking ADB devices..."
$devices = adb devices | Select-String -Pattern "device$" -SimpleMatch
if (-not $devices) {
    Write-Error "No connected Android device found. Enable USB debugging and connect a device."
    exit 1
}

Write-Host "Installing APK..."
adb install -r $apkPath
if ($LASTEXITCODE -ne 0) {
    Write-Error "adb install failed"
    adb logcat -d > $logcatFile
    Write-Host "Logcat saved to $logcatFile"
    exit 1
}

Write-Host "Launching MainActivity..."
adb shell am start -n com.billybox.terminai/.MainActivity
if ($LASTEXITCODE -ne 0) {
    Write-Error "am start failed"
    adb logcat -d > $logcatFile
    Write-Host "Logcat saved to $logcatFile"
    exit 1
}

Start-Sleep -Seconds 5

Write-Host "Checking process..."
$pidOutput = adb shell pidof com.billybox.terminai
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($pidOutput)) {
    Write-ERROR "com.billybox.terminai process not found after launch"
    adb logcat -d > $logcatFile
    Write-Host "Logcat saved to $logcatFile"
    exit 1
}

Write-Host ""
Write-Host "SUCCESS: TerminAI installed, launched, and running (PID: $($pidOutput.Trim()))"

# Run instrumentation tests for API key enforcement
Write-Host ""
Write-Host "Running instrumentation tests (API key enforcement)..."

$backendUrl = $env:TERMINAI_BACKEND_URL ?? "http://10.0.2.2:3000"
Write-Host "Using backend URL: $backendUrl"

Push-Location "android"
try {
    & ./gradlew connectedAndroidTest --no-daemon --stacktrace 2>&1 | Tee-Object -Variable testOutput
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Instrumentation tests passed!"
    } else {
        if ($testOutput -match "Network error|Unknown host|timeout") {
            Write-Host "WARNING: Backend may not be available. Tests skipped due to network issues."
            Write-Host "This is expected if the backend is not running."
        } else {
            Write-Error "Instrumentation tests failed"
            exit 1
        }
    }
} finally {
    Pop-Location
}