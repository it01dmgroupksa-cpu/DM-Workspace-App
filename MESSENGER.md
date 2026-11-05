# Durar Messenger in the DM Workspace App

The **Chat** tab now runs Durar Messenger, the same chat employees use on the ERP
desk, replacing the old Sendbird chat. ERP and the app share one chat history.
Old Sendbird messages are not carried over.

The code is in `src/messenger/`. Messenger talks to the `durar_messenger` ERP Server
Script, so ERP decides who is an active employee on every request.

## Sign-in

The app has two separate sign-ins.

| | Other tabs (attendance, leave, tasks…) | Messenger |
| --- | --- | --- |
| Asks for the password | Every time the app opens (unchanged) | Once, then every 30 days |
| ERP session | The app's normal login (shared cookie jar) | Its own Frappe "mobile" session |
| Signing out of one | Doesn't affect Messenger | Doesn't affect the other tabs |

- Signing in on the app's sign-in page also signs in Messenger, so employees enter
  the password once. The sign-in page also has **Open Messenger** (or **Sign in to
  Messenger only**), so chat works without signing in to the rest of the app.
- Messenger signs out by itself:
  - 30 days after sign-in, or if the phone's clock was turned back
  - when ERP rejects its session: password changed, user disabled, session deleted
    in ERP, or no longer an active employee
  - when **Allow Chat Module** or **Allow App** is unticked on the Employee
    (checked at every app start)
- **Sign out of Messenger** is the icon at the top right of the chat list.
- The password is never stored. The phone keeps only the ERP session id, in the
  iOS Keychain or Android Keystore (`expo-secure-store`, this device only, not in
  backups). Messenger's requests never use the shared cookie jar
  (`credentials: 'omit'`), so whoever signs in to the other tabs can't change who
  Messenger is signed in as.
- Signing out of Messenger unregisters the phone from push notifications.

ERP settings this relies on (Frappe defaults, so nothing to change unless someone
changed them):

- **System Settings → Session Expiry Mobile** must be at least `720:00` (30 days).
  If it's shorter, Messenger signs out after that much inactivity.
- **System Settings → Deny Multiple Sessions** must stay off. With it on, signing in
  anywhere else signs Messenger out.

## Offline and unreliable networks

- **Sending:** a message shows at once and is saved on the phone before any network
  attempt. It shows a clock while waiting, then ticks once the server has stored it.
  Messages go out in the order written.
- **No network:** messages stay in the queue and send by themselves when the network
  or the server comes back. Retries back off from 1 second to a minute, with random
  jitter. Returning to the app, regaining the network or reconnecting retries at once.
- **No duplicates:** every message has a permanent ID made on the phone. If the server
  stored a message but the reply never arrived, the retry gets the same message back
  instead of a second copy.
- **Failed:** only when the server refuses a message (too long, no longer a member).
  It shows the reason, with **Retry** and **Delete**, and is never dropped silently.
- **Files:** they upload with a progress bar and can be cancelled. A queued file is
  copied into the app's own storage, so it survives an app restart. A file that
  uploaded but whose message didn't send isn't uploaded again.
- **Resumable uploads:** a file over 2 MB goes in 4 MB chunks (`src/messenger/upload.ts`).
  After a dropped connection, or even an app restart, the phone asks the server how far
  it got and sends only the rest, so a 90 MB video that lost signal at 80 MB sends 10 MB.
  The server checks the whole file's SHA-256 and each chunk's, and a damaged chunk is
  simply sent again. The upload's id is kept in the outgoing queue. Cancelling a message
  also cancels the upload on the server. Files up to 2 MB still go in one request.
- **Restarts:** unsent messages, drafts (one per chat, shown as "Draft:" in the list),
  the chat list and the latest 40 messages of the 25 busiest chats are saved on the
  phone. Chats open offline from that copy, which the server replaces as soon as it
  answers.
- **Connection bar:** "No internet connection", "Connecting…", "Sending 2 messages…"
  or "Syncing messages…". Nothing shows when up to date. "Online" means the live
  connection to the panel answered, not just that the phone has a network.
- **Catching up:** after reconnecting, and every 5 minutes, Messenger compares the chat
  list with the server (unread counts, previews, membership, mute, pin, archive) and
  reloads the open chat. Other chats reload when opened.
- **Sign-out:** signing out on purpose deletes the chats, drafts and queue from the
  phone (it warns if messages are unsent). An automatic sign-out (30 days, password
  changed) keeps them for the next sign-in.

## Calls on several devices

An employee may have Messenger open on the ERP desktop and on the phone at once.

- An incoming call rings on every device, including a closed phone (by push).
- Whichever device answers takes the call. The others stop ringing at once, and a
  leftover phone notification only opens the chat, never takes the call.
- Declining on one device declines everywhere.
- During a call, the other device shows "On this call on another device" with
  **Move here**. Moving the call hands it over without ending it for the other person.
- When a call ends, the panel closes its media room, so every device hangs up, even
  a phone left in the background.

## What works

- Direct chats, groups (create, rename, description, admins, add and remove
  members, admins-only groups, leave), pin, mute, archive and clear
- Text, photos, videos, documents up to 100 MB, and voice notes (1×, 1.5×, 2×)
- Reply, forward (up to 5 chats), edit (15 minutes), delete for me or for
  everyone (48 hours), reactions, Arabic and English translation, message info
- Sent, delivered and read ticks, typing, online and last seen
- Search across all chats, and search inside a chat that jumps to the message
- **@mentions** in groups: type `@` to pick a member (admins can pick **all**). A mention
  shows in bold, a message that mentions you is tinted, and the chat list shows an **@**
  until you read it. A mentioned person is notified even if they muted the chat.
- **Pinned messages:** long-press a message → **Pin message** (5 per chat, shared by
  everyone, admins only in a read-only group). A bar under the chat header shows the
  pinned message; tap it to jump there, and again for the next pin.
- The "Sent by Durar Assistant" mark and the assistant's chat
- Voice and video calls: ringtone, answer, decline, mute, camera, switch camera,
  speaker, minimize while chatting, joining a group call under way
- Push notifications for new messages and incoming calls while the app is closed,
  with Answer and Decline on call notifications

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
4. Raise the version and build number above the one in the App Store.

### 3. Android

Raise `versionCode` and `versionName` in `android/app/build.gradle` above the
version on Google Play. Release signing is described in `README.md`.

### 4. Push notifications

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

**Ringing on a closed or locked phone (Android).** The `calls` channel plays a 30 second
ringtone (`android/app/src/main/res/raw/ring.wav`) at ringtone volume with strong
vibration. For it to apply, the panel's push for a call must carry
`"channelId": "calls"` and `"priority": "high"`. With no `EXPO_PROJECT_ID` and no
`google-services.json` no push is delivered at all, so nothing can ring while the app
is closed. Channels cannot be changed once created: after updating from a build that
ran with the old `calls` channel, uninstall and reinstall (or clear app data) once.

### 5. Panel and ERP (done by IT, once, before the app ships)

- Deploy the panel release (migrations 035 and 036: phone push, resumable uploads,
  mentions and pins).
- Paste the updated `durar_messenger` Server Script into ERP (it allows the device,
  pin and pinned-list operations).
- Paste the updated Messenger Custom HTML Block (`agent_blocks/messenger/`) into ERP.
- Calls need the panel's LiveKit settings (`COMPOSE_PROFILES=calls`, `LIVEKIT_*`).
- The panel's `docs/MESSENGER-ROLLOUT.md` lists every step and command.

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
- **A call notification on a closed phone** can't be withdrawn remotely. If the
  call is answered elsewhere, the notification stays until it expires (45 seconds)
  or is tapped, which then only opens the chat.
- **Android, mid-call:** if the employee leaves the app during a call, Android may
  stop the microphone after a short time, because the app runs no foreground
  "ongoing call" service yet. Coming back to the app restores it.
- **Password changed, app not opened:** the phone keeps getting notifications until
  Messenger is next opened, where it signs out and unregisters.
- **Call waiting:** a second call while already in a call doesn't ring on that
  phone. It still rings on the employee's other devices.

## Test plan (two employees, A and B; B has a phone and the ERP desktop)

### Sign-in

1. B signs in on the app's sign-in page. Open Chat: no second password.
2. Close and reopen the app. The other tabs ask for the password. **Open Messenger**
   on the sign-in page goes straight to the chats.
3. Sign out of the other tabs (Attendance → Logout). Messenger stays signed in, and
   messages and calls still arrive.
4. Sign out of Messenger. No notifications reach the phone; the other tabs are
   unaffected.
5. Change B's password in ERP, then open Messenger: it asks to sign in again.
6. Untick **Allow Chat Module** on B's Employee and reopen the app: Messenger signs
   out with a message.
7. Wrong password on the Messenger sign-in: "Wrong username or password."

### Messages (B has Messenger open on desktop and phone)

8. A sends a message: it appears on both of B's devices. B reads it on the desktop,
   and the phone's unread count clears.
9. B sends from the phone: it appears on B's desktop as sent by B, with ticks.
10. Photo, document, video and voice note from the phone open on the desktop, and
    the reverse.
11. With B's phone app closed and the desktop closed, A messages B: notification on
    the phone, and tapping it opens the chat.

### Offline

A. Turn on airplane mode and send three messages and a photo. Each shows a clock, and
   the bar says "No internet connection". Close and reopen the app: they're still there.
   Turn airplane mode off: they send in order, with no duplicates on the other side.
B. Start typing in a chat, leave it, and kill the app. Reopen: the draft is back, and
   the chat list shows "Draft:".
C. Airplane mode, then open the app: the chat list and recent messages show from the
   saved copy.
D. Send a 50 MB video and cancel it halfway: nothing arrives on the other side.
E. Send a 60 MB video, turn airplane mode on when the bar is about halfway, wait 10
   seconds, then turn it off: the upload continues from where it stopped (the server's
   progress doesn't go back to 0), and the video arrives intact.
F. Start a 60 MB video upload, force-quit the app at about 40%, and reopen it: the message
   is still waiting and continues the upload instead of starting again.

### Mentions and pins (a group of A, B and C; A is an admin)

M1. In the group, A types `@` and picks B: the name appears in the text. After sending, B's
    phone shows the message tinted with the name in bold, and B's chat list shows **@**.
M2. B and C both mute the group. A sends a message that mentions B: B still gets a
    notification, C gets none. A plain message notifies neither.
M3. A deletes the name from the text before sending: B is not notified.
M4. A types `@` and picks **all**: B and C are both notified. B (not an admin) doesn't
    see **all** in the list.
M5. Edit a sent message to name C instead of B: C is now marked, B isn't.
P1. B long-presses a message → **Pin message**. Everyone sees the pinned bar and a
    "B pinned a message" line. Tapping the bar jumps to the message.
P2. Pin five messages; the sixth says to unpin one first.
P3. Delete a pinned message for everyone: it leaves the bar on every device.
P4. Make the group admins-only: B can no longer pin, A can.

### Calls

12. Phone and desktop open: A calls B and both ring. B answers on the phone and the
    desktop stops ringing. Repeat answering on the desktop: the phone stops ringing.
13. Same, B declines on the phone: the desktop stops ringing, and A sees "Declined".
14. B answers on the desktop. The phone's chat shows "On this call on another
    device". B taps it: the call moves to the phone, A hears no drop beyond a moment,
    and the desktop shows "The call continued on your other device".
15. B's phone app closed: A calls. The phone rings by notification. B answers on the
    desktop, then taps **Answer** on the phone notification: the chat opens, and the
    call stays on the desktop.
16. B's phone app closed: A calls, and B taps **Answer** on the notification: the call
    connects on the phone.
17. During a phone call, B puts the app in the background, then A hangs up: B's
    phone call ends too.
18. A calls and nobody answers for 45 seconds: "No answer" for A, and "Missed voice
    call" in the chat for B.
19. Turn on airplane mode on one side during a call: the other side's call ends
    within about 30 seconds (LiveKit waits that long for a reconnect).
20. Group call with three people: one leaves and the call continues. When the last
    other person leaves, the call ends.
