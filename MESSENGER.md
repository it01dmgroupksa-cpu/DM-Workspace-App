# Durar Messenger in the DM Workspace App

The **Chat** tab now runs Durar Messenger, the same chat employees use on the ERP
desk, replacing the old Sendbird chat. ERP and the app share one chat history.
Old Sendbird messages are not carried over.

The code is in `src/messenger/`. The app talks to the `durar_messenger` ERP Server
Script using the ERP session it already signs in with, so ERP decides who can chat.
The Chat tab still only shows for employees with **Allow Chat Module**
(`custom_allow_chat_module`) ticked on their Employee record.

## What works

- Direct chats, groups (create, rename, description, admins, add and remove
  members, admins-only groups, leave), pin, mute, archive and clear
- Text, photos, videos, documents up to 100 MB, and voice notes (1×, 1.5×, 2×)
- Reply, forward (up to 5 chats), edit (15 minutes), delete for me or for
  everyone (48 hours), reactions, Arabic and English translation, message info
- Sent, delivered and read ticks, typing, online and last seen
- Search across all chats, and search inside a chat that jumps to the message
- The "Sent by Durar Assistant" mark and the assistant's chat
- Voice and video calls through the company's LiveKit server: ringing, answer,
  decline, mute, camera on and off, switch camera, speaker, minimize while chatting,
  and joining a group call already under way
- Push notifications for new messages and incoming calls while the app is closed
  (after the setup below)

## Before the first build

### 1. Install

```sh
npm ci
cd ios && pod install && cd ..
```

The Podfile pulls LiveKit's WebRTC pod from `https://github.com/livekit/podspecs.git`
as well as the CocoaPods CDN.

### 2. iOS project (Xcode)

Open `ios/DMWorkspaceApp.xcworkspace`, then in the **DMWorkspaceApp** target:

1. **Bundle identifier:** the project still has the React Native template id
   (`org.reactjs.native.example.DMWorkspaceApp`). Set the company's real id, the one
   registered in the Apple Developer account.
2. **Signing & Capabilities:** choose the team. Push Notifications is already set
   through `DMWorkspaceApp/DMWorkspaceApp.entitlements`. If Xcode reports the
   capability missing from the profile, enable Push Notifications on the App ID in
   the Apple Developer portal, or let Xcode manage signing.
3. Background Modes (Audio, Remote notifications) and the microphone, camera and
   photo permission texts are already in `Info.plist`.

### 3. Push notifications

Pushes go from the panel through Expo's push service to Firebase (Android) and Apple
(iOS). Until this is done the app works fully but notifies only while it's open.

1. Create a free project at https://expo.dev, or run `npx eas init`, and copy its
   **project ID** into `EXPO_PROJECT_ID` in `src/messenger/config.ts`.
2. **Android:** in the Firebase console, add an Android app with package
   `com.dmworkspaceapp` and download `google-services.json` to `android/app/`. The
   Gradle build picks it up automatically. Then, on expo.dev under
   Project → Credentials → Android, upload the Firebase **FCM V1 service account key**.
3. **iOS:** on expo.dev under Project → Credentials → iOS, add an **APNs key** (.p8)
   for the bundle id from step 2.1.
4. Optional: if "Enhanced push security" is turned on for the Expo project, set
   `EXPO_ACCESS_TOKEN` in the panel's `.env`.

### 4. Panel and ERP (done by IT, once)

The phone app needs the panel update that adds phone push (database migration 035)
and the updated `durar_messenger` Server Script pasted into ERP, which now allows
the `devices.register` and `devices.unregister` operations. Calls need the panel's
LiveKit settings (`COMPOSE_PROFILES=calls`, `LIVEKIT_*`).

## Build

```sh
npm run android        # debug build on a device
npm run ios            # macOS only
```

For release, Android uses the upload keystore described in `README.md`. iOS uses
Xcode → Product → Archive.

## Checks

```sh
npm run typecheck
npm test -- --runInBand
npm run lint
```

## Known limits

- **iOS incoming calls** arrive as a notification with Answer and Decline buttons,
  not the full-screen phone ring (CallKit). That would need Apple VoIP push, which
  Expo's push service doesn't send.
- **Android, mid-call:** if the employee leaves the app during a call, Android may
  stop the microphone after a short time, because the app runs no foreground
  "ongoing call" service yet. Coming back to the app restores it.
- Calls on an iPhone simulator have no camera. Test calls on real phones.

## Test on two real phones

1. Two employees sign in (both with Allow Chat Module ticked) and chat. Each message
   also appears on the ERP desk Messenger.
2. Send a photo, a document, a video and a voice note. Reply, forward, react, edit,
   then delete for everyone.
3. Close the app on phone B, then message it from phone A. B gets a notification,
   and tapping it opens that chat.
4. Voice call A → B with B's app open, then with it closed (B taps the notification
   and answers). Then a video call: switch camera, mute, speaker, minimize.
5. Sign out on B, then message B: no notification should arrive on that phone.
