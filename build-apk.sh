#!/usr/bin/env bash
# ============================================================
# Farmers Connect — build-apk.sh
#
#   ./build-apk.sh           →  debug APK (fast, no keystore)
#   ./build-apk.sh release   →  signed release APK
#
# Prerequisites
#   • Node.js 18+     https://nodejs.org
#   • Java JDK 17+    https://adoptium.net
#   • Android Studio  https://developer.android.com/studio
#     (provides the Android SDK and adb)
# ============================================================
set -e
MODE="${1:-debug}"
cd "$(dirname "$0")"
mkdir -p output

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  🌾  Farmers Connect APK Builder     ║"
echo "║  Mode      : $MODE"
echo "║  Backend   : jembebackend.onrender.com"
echo "║  Offline   : Full IndexedDB sync     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Pre-flight checks ────────────────────────────────────────
need() { command -v "$1" >/dev/null 2>&1 || { echo "❌  $1 not found. $2"; exit 1; }; }
need node  "Install from https://nodejs.org"
need java  "Install JDK 17 from https://adoptium.net"

JAVA_MAJOR=$(java -version 2>&1 | grep -oP '(?<=version ")\d+' | head -1)
[ "${JAVA_MAJOR:-0}" -ge 17 ] || { echo "❌  Java 17+ required (found ${JAVA_MAJOR})"; exit 1; }
echo "✅  Java $JAVA_MAJOR"

# Locate Android SDK
for p in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" \
          "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" \
          "/usr/local/lib/android/sdk" "/opt/android-sdk"; do
  [ -d "$p" ] && { export ANDROID_HOME="$p"; export ANDROID_SDK_ROOT="$p"; break; }
done
[ -d "${ANDROID_HOME:-}" ] || {
  echo "❌  Android SDK not found."
  echo "   Install Android Studio: https://developer.android.com/studio"
  echo "   Then open it once so it downloads the SDK."
  echo "   If already installed, set: export ANDROID_HOME=~/Library/Android/sdk"
  exit 1
}
echo "✅  Android SDK: $ANDROID_HOME"

# ── npm install ──────────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo ""
  echo "📦  Installing Capacitor and plugins..."
  npm install --silent
fi
echo "✅  npm dependencies ready"

# ── Capacitor sync ───────────────────────────────────────────
echo ""
echo "🔄  Copying web files → android/app/src/main/assets/public/"
npx cap copy android --inline 2>/dev/null || npx cap copy android
echo "✅  Web files synced"

# ── Release keystore ─────────────────────────────────────────
if [ "$MODE" = "release" ]; then
  KS="android/app/release.keystore"
  if [ ! -f "$KS" ]; then
    echo ""
    echo "🔑  Generating release keystore (one-time setup)..."
    keytool -genkey -v -keystore "$KS" \
      -alias farmersconnect -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=Farmers Connect,O=FarmersConnect,L=Nairobi,C=KE" \
      -storepass farmersconnect2025 -keypass farmersconnect2025 2>/dev/null
    echo "⚠️   Keystore → $KS"
    echo "    BACK THIS UP — needed for all future Play Store updates."
  fi
  export KEYSTORE_PATH=release.keystore
  export KEYSTORE_PASSWORD=farmersconnect2025
  export KEY_ALIAS=farmersconnect
  export KEY_PASSWORD=farmersconnect2025
fi

# ── Gradle build ─────────────────────────────────────────────
echo ""
echo "🔨  Building ${MODE} APK..."
echo "   (First run downloads Gradle ~120 MB — may take 5–10 min)"
chmod +x android/gradlew

cd android
if [ "$MODE" = "release" ]; then
  ./gradlew assembleRelease --no-daemon 2>&1 | grep -E "BUILD|FAILED|error:|Error|APK|apk"
else
  ./gradlew assembleDebug   --no-daemon 2>&1 | grep -E "BUILD|FAILED|error:|Error|APK|apk"
fi
cd ..

# ── Locate and copy APK ──────────────────────────────────────
if [ "$MODE" = "release" ]; then
  SRC=$(find android/app/build/outputs/apk/release -name "*.apk" 2>/dev/null | head -1)
else
  SRC=$(find android/app/build/outputs/apk/debug   -name "*.apk" 2>/dev/null | head -1)
fi

[ -f "$SRC" ] || { echo "❌  APK not found — check build output above."; exit 1; }

TS=$(date +%Y%m%d_%H%M%S)
DEST="output/farmers-connect-${MODE}-${TS}.apk"
cp "$SRC" "$DEST"
SIZE=$(du -sh "$DEST" | cut -f1)

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅  BUILD COMPLETE                                       ║"
echo "║                                                           ║"
echo "║  APK :  $DEST"
echo "║  Size:  $SIZE"
echo "║                                                           ║"
echo "║  Install via USB:                                         ║"
echo "║    adb install '$DEST'                    ║"
echo "║                                                           ║"
echo "║  Install manually:                                        ║"
echo "║    Copy the .apk to your phone → open it                 ║"
echo "║    (Settings → Security → Install unknown apps)          ║"
echo "╚══════════════════════════════════════════════════════════╝"
