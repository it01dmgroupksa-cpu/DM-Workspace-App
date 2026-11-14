# Calls: how a call reaches this phone, and what the panel must run

The panel side is implemented in the Durar Panel repository (`apps/ceopanel`, migration
`041-messenger-call-delivery.sql`). Deploy steps: the panel's
`docs/MESSENGER-ROLLOUT.md`, section A4d. This file is the contract between the two.

## The pipeline

1. The caller presses call: `calls.start` (relay). The panel creates the call record
   (`status: ringing`) and starts its own clock.
2. The panel sends each called phone one push:
   - Android with a Firebase token (`android-fcm`): straight through FCM HTTP v1,
     data-only, `priority: HIGH`, `ttl: 45s`, `collapse_key: call-<id>`;
   - iPhone with a VoIP token: Apple VoIP push (CallKit);
   - anything else: Expo's push service, as before.
3. Android: `CallMessagingService` receives it (app closed, in the background or open),
   validates it, and `IncomingCalls` starts `RingService`: the call alert
   (`CallStyle.forIncomingCall`, full-screen intent), the one ringtone (`Ringer`), and the
   native call screen (`IncomingCallActivity`). No JavaScript, no network first.
4. The phone POSTs the push's `ackUrl`: the panel sets the member's `ringingAt`, and the
   caller's screen changes from "Calling…" to "Ringing…".
5. Not confirmed after 4 s and 10 s: the panel sends the Firebase push again (the phone
   rings once per call however many arrive).
6. **Answer** stops the ring and opens the app on `dmworkspace://call?action=answer`.
   JavaScript asks the panel (`calls.live`) whether the call still rings for this person,
   then `calls.join` (refused if already answered elsewhere), gets LiveKit credentials,
   configures the audio session, then connects.
7. **Decline** POSTs `declineUrl` (no app start), or opens the app to decline through the
   relay when the push had none.
8. Nobody answered in 50 s: the panel ends the call as missed and pushes `call-cancel`
   to every phone still ringing; a "Missed call" notification follows through Expo.

## Push contract (both routes)

```
data.title    caller's name
data.message  "📞 Incoming voice call"
data.body     JSON {
                type: "call" | "call-cancel" | "missed-call",
                callId, conversationId,           // UUIDs; a call push without them is ignored
                video: boolean,
                sentAt: epoch ms,                 // older than 45 s: not rung
                ackUrl, declineUrl                // https, signed, this call and phone, 2 minutes
              }
```

Duplicates, a cancel that overtakes its ring, and a push after the call was answered or
declined here are absorbed by `CallRegistry` (one ring per call id, kept 10 minutes).

## Token registration (`devices.register`)

| platform | token | used for |
|---|---|---|
| `android` | Expo push token | messages, missed calls, calls when FCM is not set up |
| `android-fcm` | the phone's own Firebase token | calls, straight through Firebase |
| `ios` | Expo push token | messages |
| `ios-voip` | PushKit token | calls through CallKit |

Each registration also sends `deviceId` (one per installation), so the panel rings a phone
once and replaces a rotated token. The app re-registers on every start and when Firebase
rotates the token; signing out unregisters all of them.

## Where to look when a phone didn't ring

- Panel: `/api/messenger/v1/monitor?view=calls` (monitor users): every send and its result
  per phone, `ringing_confirmed`, answered, declined, expired.
- Phone: Messenger → pulse icon → **Call check** → *Recent call steps* → **Share with IT**.
- Firebase console → Crashlytics: crashes and non-fatal call problems with the same steps.
