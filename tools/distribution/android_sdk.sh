#!/usr/bin/env bash
# Ubuntu release runners already provide these exact SDK packages.
set -euo pipefail
sdk=${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Missing Android SDK}}
if [[ ! -f "$sdk/platforms/android-35/android.jar" || ! -x "$sdk/build-tools/35.0.0/zipalign" || ! -f "$sdk/build-tools/35.0.0/lib/apksigner.jar" ]]; then
  manager="$sdk/cmdline-tools/latest/bin/sdkmanager"
  if [[ ! -x "$manager" ]]; then manager=$(command -v sdkmanager); fi
  "$manager" --sdk_root="$sdk" 'platforms;android-35' 'build-tools;35.0.0'
fi
if [[ -n ${GITHUB_ENV:-} ]]; then echo "ANDROID_HOME=$sdk" >> "$GITHUB_ENV"; fi
