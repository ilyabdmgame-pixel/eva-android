#!/usr/bin/env bash
# Runs only on a disposable emulator. The install under test is the candidate
# APK with a throwaway CI signature; its assets and native libraries are unchanged.
set -euo pipefail
api=${1:?Android API}
apk=${2:?unsigned candidate APK}
sdk=${ANDROID_HOME:?Missing Android SDK}
out=${RUNNER_TEMP:?}/stock-${api}
export ANDROID_USER_HOME="$out/.android"
export ANDROID_EMULATOR_HOME="$ANDROID_USER_HOME"
export ANDROID_AVD_HOME="$ANDROID_USER_HOME/avd"
mkdir -p "$ANDROID_AVD_HOME"
image="system-images;android-${api};google_apis;x86_64"
"$sdk/cmdline-tools/latest/bin/sdkmanager" "$image" 'emulator' 'platform-tools'
sudo chmod a+rw /dev/kvm
"$sdk/emulator/emulator" -accel-check
printf 'no\n' | "$sdk/cmdline-tools/latest/bin/avdmanager" create avd -f -n eva-stock -k "$image" --device pixel_5 --path "$ANDROID_AVD_HOME/eva-stock.avd"
test -f "$ANDROID_AVD_HOME/eva-stock.avd/config.ini"
printf 'avd.ini.encoding=UTF-8\npath=%s\ntarget=android-%s\n' "$ANDROID_AVD_HOME/eva-stock.avd" "$api" > "$ANDROID_AVD_HOME/eva-stock.ini"
"$sdk/emulator/emulator" -list-avds | grep -Fx eva-stock
sed -i -E '/^hw.lcd.(width|height|density)[[:space:]]*=/d' "$ANDROID_AVD_HOME/eva-stock.avd/config.ini"
printf 'hw.lcd.width=540\nhw.lcd.height=1080\nhw.lcd.density=220\n' >> "$ANDROID_AVD_HOME/eva-stock.avd/config.ini"
"$sdk/emulator/emulator" -avd eva-stock -no-window -no-audio -no-boot-anim -no-snapshot -gpu software -feature -Vulkan -cores 2 -memory 2304 >"$out/emulator.log" 2>&1 &
emulator_pid=$!
adb="$sdk/platform-tools/adb"
trap '"$adb" -e emu kill >/dev/null 2>&1 || true; kill "$emulator_pid" 2>/dev/null || true' EXIT
keytool -genkeypair -storetype PKCS12 -keystore "$out/smoke.p12" -storepass disposable -alias smoke -dname CN=Emulator -keyalg RSA -validity 2
build="$sdk/build-tools/35.0.0"
platform="$sdk/platforms/android-35/android.jar"
sign=("$build/apksigner" sign --ks "$out/smoke.p12" --ks-pass pass:disposable)
"${sign[@]}" --out "$out/candidate.apk" "$apk"
mkdir "$out/classes" "$out/dex"
javac --release 11 -cp "$platform" -d "$out/classes" tools/distribution/stock/HomeSmoke.java
jar cf "$out/tests.jar" -C "$out/classes" .
"$build/d8" --min-api 26 --lib "$platform" --output "$out/dex" "$out/tests.jar"
"$build/aapt2" link -I "$platform" --manifest tools/distribution/stock/AndroidManifest.xml -o "$out/tests-unsigned.apk"
(cd "$out/dex" && zip -q -0 "$out/tests-unsigned.apk" classes.dex)
"${sign[@]}" --out "$out/tests.apk" "$out/tests-unsigned.apk"
for _ in $(seq 1 100); do
  if ! kill -0 "$emulator_pid" 2>/dev/null; then tail -n 45 "$out/emulator.log"; exit 1; fi
  if "$adb" devices | grep -Eq '^emulator-[0-9]+[[:space:]]+device$'; then break; fi
  sleep 2
done
for _ in $(seq 1 150); do
  if [[ $("$adb" -e shell getprop sys.boot_completed 2>/dev/null | tr -d '\r') == 1 ]]; then break; fi
  sleep 2
done
export ANDROID_SERIAL=$("$adb" -e get-serialno)
export PATH="$sdk/platform-tools:$PATH"
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = "$api"
adb shell getprop ro.product.cpu.abilist
adb shell settings put system screen_off_timeout 1800000
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb install -r "$out/candidate.apk"
adb install -r "$out/tests.apk"
adb shell cmd package set-home-activity org.evaassistant.app/ru.eva.life.Home
# Start outside Home so the first system HOME action also tests Android's default handler.
adb shell am start -W -a android.settings.SETTINGS
adb logcat -v brief -s EvaHomeSmoke:I AndroidRuntime:E chromium:E ActivityManager:W WindowManager:W '*:S' >"$out/android.log" &
log_pid=$!
adb shell am instrument -w org.evaassistant.smoke/.HomeSmoke | tee "$out/result.txt"
kill "$log_pid" 2>/dev/null || true
if ! grep -q 'INSTRUMENTATION_RESULT: eva=PASSED' "$out/result.txt"; then
  adb shell dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp' || true
  adb exec-out screencap -p >"$out/last-screen.png" || true
  tail -n 65 "$out/android.log"
  exit 1
fi
echo "Android API $api passed HOME, device metrics, services, Settings, return, and app drawer."
