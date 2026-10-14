#!/usr/bin/env bash
set -euo pipefail
# Requires the official Android SDK platform 35 and build-tools 35.0.0.
# The SDK paths and optional private signing key are explicit; no account keys enter the app.
watch_root=$(cd "$(dirname "$0")" && pwd)
watch_platform=${CAMS_ANDROID_PLATFORM:?Set CAMS_ANDROID_PLATFORM to the Android 35 platform directory}
watch_tools=${CAMS_ANDROID_BUILD_TOOLS:?Set CAMS_ANDROID_BUILD_TOOLS to Android build-tools 35.0.0}
watch_output=${CAMS_WATCH_BUILD_DIR:-/tmp/cams-life-watch-build}
mkdir -p "$watch_output/classes" "$watch_output/dex"
java --module jdk.compiler/com.sun.tools.javac.Main -source 17 -target 17 -classpath "$watch_platform/android.jar" -d "$watch_output/classes" "$watch_root"/src/com/camslife/healthbridge/*.java
python3 - "$watch_output" <<'PY'
import pathlib,sys,zipfile
base=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(base/'classes.jar','w',zipfile.ZIP_DEFLATED) as out:
    for path in sorted((base/'classes').rglob('*.class')):out.write(path,path.relative_to(base/'classes'))
PY
"$watch_tools/d8" --lib "$watch_platform/android.jar" --min-api 34 --output "$watch_output/dex" "$watch_output/classes.jar"
"$watch_tools/aapt2" compile --dir "$watch_root/res" -o "$watch_output/resources.zip"
"$watch_tools/aapt2" link -o "$watch_output/unsigned.apk" --manifest "$watch_root/AndroidManifest.xml" --min-sdk-version 34 --target-sdk-version 35 -I "$watch_platform/android.jar" "$watch_output/resources.zip"
python3 - "$watch_output" <<'PY'
import pathlib,sys,zipfile
base=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(base/'unsigned.apk','a',zipfile.ZIP_DEFLATED) as out:out.write(base/'dex/classes.dex','classes.dex')
PY
"$watch_tools/zipalign" -f -p 4 "$watch_output/unsigned.apk" "$watch_output/aligned.apk"
if [[ -n ${CAMS_WATCH_SIGNING_KEY:-} ]]; then
  : "${CAMS_WATCH_SIGNING_PASSWORD_FILE:?Set a private signing password file}"
  "$watch_tools/apksigner" sign --ks "$CAMS_WATCH_SIGNING_KEY" --ks-pass "file:$CAMS_WATCH_SIGNING_PASSWORD_FILE" --out "$watch_output/cams-life-watch-companion.apk" "$watch_output/aligned.apk"
  "$watch_tools/apksigner" verify "$watch_output/cams-life-watch-companion.apk"
  echo "Signed companion: $watch_output/cams-life-watch-companion.apk"
else
  echo "Unsigned companion: $watch_output/aligned.apk. Sign it with your own private development/release key before installing."
fi
