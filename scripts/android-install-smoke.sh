#!/usr/bin/env bash
# TerminAI Android install smoke — Bash
#
# Build the debug APK, install it on a connected Android device,
# and verify that com.billybox.terminai/.MainActivity launches.
#
# Usage (from repo root):
#   ./scripts/android-install-smoke.sh
#
# Prerequisites:
#   - Android device connected with USB debugging enabled
#   - adb in PATH
#   - JDK 17, Android SDK (for building)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APK_PATH="${REPO_ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
LOGCAT_FILE="${REPO_ROOT}/android-install-smoke-logcat.txt"

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
        echo "ERROR: No connected Android device found." >&2
        echo "Enable USB debugging and connect a device." >&2
        exit 1
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

main() {
    build_apk
    check_adb
    install_apk
    launch_and_verify
}

main "$@"
