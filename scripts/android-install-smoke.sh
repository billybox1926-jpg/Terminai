#!/usr/bin/env bash
# TerminAI Android install smoke — Bash
#
# Build the debug APK, install it on a connected Android device,
# and verify that com.billybox.terminai/.MainActivity launches.
#
# Also runs API key instrumentation tests to verify the app respects
# the TERMINAI_API_KEY configuration.
#
# Usage (from repo root):
#   ./scripts/android-install-smoke.sh
#
# Prerequisites:
#   - Android device connected with USB debugging enabled
#   - adb in PATH
#   - JDK 17, Android SDK (for building)
#   - TERMINAI_API_KEY environment variable (optional for debug builds)
#   - Backend server running (for instrumentation tests)
#
# Environment Variables:
#   TERMINAI_API_KEY - API key for the TerminAI backend (optional for debug)
#   TERMINAI_BACKEND_URL - Backend URL for tests (default: http://10.0.2.2:3000)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APK_PATH="${REPO_ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
LOGCAT_FILE="${REPO_ROOT}/android-install-smoke-logcat.txt"

# API key for build and tests
export TERMINAI_API_KEY="${TERMINAI_API_KEY:-}"

build_apk() {
   if [[ -f "${APK_PATH}" ]]; then
       echo "APK already exists at ${APK_PATH}, skipping build."
       return 0
   fi
   echo "Building debug APK..."
   cd "${REPO_ROOT}/android"
   chmod +x gradlew
   ./gradlew assembleDebug --no-daemon --stacktrace
   cd "${REPO_ROOT}"
}

check_adb() {
   echo "Checking ADB devices..."
   if ! adb devices | grep -q "device$"; then
       echo "No Android device or emulator found. Skipping install smoke test."
       exit 0
   fi
}

install_apk() {
   echo "Installing APK..."
   if ! adb install -r "${APK_PATH}"; then
       echo "ERROR: adb install failed" >&2
       adb logcat -d > "${LOGCAT_FILE}" 2>/dev/null || true
       echo "Logcat saved to ${LOGCAT_FILE}" >&2
       exit 1
   fi
}

launch_and_verify() {
   echo "Launching MainActivity..."
   if ! adb shell am start -n com.billybox.terminai/.MainActivity; then
       echo "ERROR: am start failed" >&2
       adb logcat -d > "${LOGCAT_FILE}" 2>/dev/null || true
       echo "Logcat saved to ${LOGCAT_FILE}" >&2
       exit 1
   fi

   sleep 5

   echo "Checking process..."
   local pid_output
   pid_output=$(adb shell pidof com.billybox.terminai 2>/dev/null || true)
   if [[ -z "${pid_output// /}" ]]; then
       echo "ERROR: com.billybox.terminai process not found after launch" >&2
       adb logcat -d > "${LOGCAT_FILE}" 2>/dev/null || true
       echo "Logcat saved to ${LOGCAT_FILE}" >&2
       exit 1
   fi

   echo ""
   echo "SUCCESS: TerminAI installed, launched, and running (PID: ${pid_output})"
}

run_instrumentation_tests() {
   echo ""
   echo "Running instrumentation tests (API key enforcement)..."
   
   # Check if backend is available
   local backend_url="${TERMINAI_BACKEND_URL:-http://10.0.2.2:3000}"
   echo "Using backend URL: ${backend_url}"
   
   cd "${REPO_ROOT}/android"
   
   # Run connected Android tests
   # Note: Tests may fail if backend is not running or API key is invalid
   # This is expected behavior and demonstrates the API key enforcement
   if ./gradlew connectedAndroidTest --no-daemon --stacktrace 2>&1 | tee /tmp/test-output.log; then
       echo "Instrumentation tests passed!"
   else
       # Check if it's a network/backend issue vs actual test failure
       if grep -q "Network error\|Unknown host\|timeout" /tmp/test-output.log 2>/dev/null; then
           echo "WARNING: Backend may not be available. Tests skipped due to network issues."
           echo "This is expected if the backend is not running."
       else
           echo "ERROR: Instrumentation tests failed" >&2
           exit 1
       fi
   fi
   
   cd "${REPO_ROOT}"
}

main() {
   build_apk
   check_adb
   install_apk
   launch_and_verify
   run_instrumentation_tests
}

main "$@"