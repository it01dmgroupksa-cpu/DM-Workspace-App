# Building the production Android APK (Android Studio)

## One-time setup
1. Install **Android Studio** (SDK + build tools install from its SDK Manager), **JDK 17**
   (Android Studio's bundled JBR 17 works) and **Node 20+**.
2. Clone and install JS dependencies from the project root:
   ```
   git clone https://github.com/it01dmgroupksa-cpu/DM-Workspace-App
   cd DM-Workspace-App
   git checkout fix/calls-voice-camera   # or main after the PR is merged
   npm ci
   ```
3. **Create the signing key** (once; back it up, losing it means no more updates under the
   same app). Keep it OUT of the repo:
   ```
   keytool -genkeypair -v -storetype PKCS12 -keystore C:\secure\dm-upload.keystore -alias dmupload -keyalg RSA -keysize 2048 -validity 10000
   ```
4. Put the key details in `C:\Users\<you>\.gradle\gradle.properties` (not the project):
   ```
   MYAPP_UPLOAD_STORE_FILE=C:/secure/dm-upload.keystore
   MYAPP_UPLOAD_KEY_ALIAS=dmupload
   MYAPP_UPLOAD_STORE_PASSWORD=****
   MYAPP_UPLOAD_KEY_PASSWORD=****
   ```
5. (Push notifications) put `google-services.json` in `android/app/` and set
   `EXPO_PROJECT_ID` in `src/messenger/config.ts`. See MESSENGER.md.

## Every release
1. Raise `versionCode` (a whole number, +1 each release) and `versionName` in
   `android/app/build.gradle`.
2. In Android Studio: **File > Open** the `android` folder, wait for Gradle sync.
3. **Build > Generate Signed App Bundle / APK > APK**, choose the keystore from step 3, pick
   **release**, Finish. Or from a terminal in `android/`: `.\gradlew assembleRelease`
4. Output: `android/app/build/outputs/apk/release/app-release.apk`
   (Play Store: choose "Android App Bundle" / `.\gradlew bundleRelease` instead).

Always install the **release** build to test; debug builds are large and load JS from a dev server.

## Why an installer may block an APK
- Not signed with your release key (debug-signed or unsigned): use the signed release build.
- `versionCode` not higher than the installed version: update refused.
- Different signing key from the installed app: uninstall first.
- "Install unknown apps" must be allowed for the app used to open the APK. Play Protect
  shows an "unknown developer" warning for any APK outside Google Play; it is not a defect.
  Publishing to Play (internal testing track) removes it.
