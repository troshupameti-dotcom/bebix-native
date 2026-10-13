#!/usr/bin/env bash
# Prova e hapjes: instalon APK-në në emulator, hap app-in dhe pret. Dështon nëse app-i rrëzohet
# (FATAL EXCEPTION në Java, ose "Process com.bebix.app has died" kur gabimi JS në hapje e ndal
# procesin native, si leja DETECT_SCREEN_CAPTURE më 12 tetor) ose procesi s'është më gjallë.
# Përdoret nga .github/workflows/android.yml.  Nisja:  bash scripts/android-smoke.sh <apk>
set -uo pipefail

APK="$1"
PKG="com.bebix.app"
WAIT="${SMOKE_WAIT:-30}"
OUT="smoke"
mkdir -p "$OUT"

adb install -r "$APK" || { echo "::error::APK-ja s'u instalua"; exit 1; }
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null
sleep "$WAIT"

adb logcat -d > "$OUT/logcat.txt" || true
adb exec-out screencap -p > "$OUT/ekrani.png" || true

status=0
if grep -qE "FATAL EXCEPTION|Process: $PKG, PID|Process $PKG \(pid [0-9]+\) has died" "$OUT/logcat.txt"; then
  # Arsyeja e parë e lexueshme: gabimi JS, ose rreshtat e FATAL EXCEPTION.
  reason=$(grep -m1 -E "E ReactNativeJS|Abort message" "$OUT/logcat.txt" | sed -E 's/^.*(ReactNativeJS|Abort message)[: ]*//' | cut -c1-300)
  echo "::error::App-i u rrëzua në hapje: ${reason:-shih logcat.txt te artefaktet}"
  grep -A40 -m1 "FATAL EXCEPTION" "$OUT/logcat.txt" || true
  grep -m3 -E "E ReactNativeJS|Abort message|has died" "$OUT/logcat.txt" || true
  status=1
fi
if ! adb shell pidof "$PKG" > /dev/null; then
  echo "::error::Procesi i app-it s'është gjallë pas ${WAIT} sekondash"
  status=1
fi
[ "$status" -eq 0 ] && echo "OK  app-i u hap dhe mbeti gjallë ${WAIT} sekonda"
exit "$status"
