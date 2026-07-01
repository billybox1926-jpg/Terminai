# TerminAI Android install smoke — PowerShell

# Download the debug APK artifact from a GitHub Actions run, then install
# and launch TerminAI on a connected Android device via ADB.
#
# Usage (from repo root):
#   .\scripts\android-install-smoke.ps1
#
# Prerequisites:
#   - Android device connected with USB debugging enabled
#   - adb in PATH
#   - Debug APK at android\app\build\outputs\apk\debug\app-debug.apk
#     (or downloaded from a workflow artifact)

$ErrorActionPreference = "Stop"

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
$logcatFile = "android-install-smoke-logcat.txt"

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
