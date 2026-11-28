#!/usr/bin/env bash
# Runs only on a disposable emulator. The install under test is the candidate
# APK with a throwaway CI signature; its assets and native libraries are unchanged.
set -euo pipefail
api=${1:?Android API}
apk=${2:?unsigned candidate APK}
sdk=${ANDROID_HOME:?Missing Android SDK}
out=${RUNNER_TEMP:?}/stock-${api}
mkdir -p "$out"
image="system-images;android-${api};google_apis;x86_64"
"$sdk/cmdline-tools/latest/bin/sdkmanager" "$image" 'emulator' 'platform-tools'
sudo chmod a+rw /dev/kvm
"$sdk/emulator/emulator" -accel-check
printf 'no\n' | "$sdk/cmdline-tools/latest/bin/avdmanager" create avd -f -n eva-stock -k "$image" --device pixel_5
"$sdk/emulator/emulator" -avd eva-stock -no-window -no-audio -no-boot-anim -no-snapshot -gpu swiftshader_indirect -cores 2 -memory 3072 >"$out/emulator.log" 2>&1 &
emulator_pid=$!
adb="$sdk/platform-tools/adb"
trap '"$adb" -e emu kill >/dev/null 2>&1 || true; kill "$emulator_pid" 2>/dev/null || true' EXIT
keytool -genkeypair -storetype PKCS12 -keystore "$out/smoke.p12" -storepass disposable -alias smoke -dname CN=Emulator -keyalg RSA -validity 2
"$sdk/build-tools/35.0.0/apksigner" sign --ks "$out/smoke.p12" --ks-pass pass:disposable --out "$out/candidate.apk" "$apk"
timeout 200 "$adb" -e wait-for-device
for _ in $(seq 1 150); do
  if [[ $("$adb" -e shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') == 1 ]]; then break; fi
  sleep 2
done
export ANDROID_SERIAL=$("$adb" -e get-serialno)
export PATH="$sdk/platform-tools:$PATH"
adb shell getprop ro.product.cpu.abilist
adb shell input keyevent 82
adb install -r "$out/candidate.apk"
python3 tools/distribution/stock_home.py "$api" "$out"
