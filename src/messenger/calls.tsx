import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useParticipants,
  useRemoteParticipants,
  useRoomContext,
  useSpeakingParticipants,
  useTracks,
} from '@livekit/react-native';
import {
  Track,
  TrackEvent,
  VideoPresets,
  type LocalVideoTrack,
  type RoomOptions,
} from 'livekit-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {relay} from './api';
import {BRAND, RING_SECONDS} from './config';
import {clock, convTitle, personOf} from './format';
import {useMaybeMessenger} from './store';
import {dismissCallNotifications} from './notify';
import {nativeCalls, onNativeHangUp, usePictureInPicture} from './nativeCalls';
import {callKit} from './callKit';
import {thisDevice} from './device';
import {reportEvent} from './telemetry';
import type {Call} from './types';
import {Avatar} from './components/Avatar';

type Mode = 'outgoing' | 'incoming' | 'connecting' | 'active';
type Session = {
  key: number;
  call: Call | null;
  conversationId: string;
  mode: Mode;
  video: boolean;
  url?: string;
  token?: string;
  answeredAt?: number;
  minimized?: boolean;
  // Someone else started it (Android's Telecom needs the direction).
  incoming?: boolean;
  // Who is calling, from the call alert: shown until Messenger has the conversation.
  title?: string;
};
type CallsApi = {
  start: (conversationId: string, video: boolean) => void;
  // answer: pressed Answer on a ringing call (refused if answered on another device).
  join: (call: Call, video: boolean, answer?: boolean, title?: string) => void;
  current: Session | null;
};
const Context = createContext<CallsApi | null>(null);
export const useCalls = () => useContext(Context)!;
let keys = 0;

// Video at the best the camera and the connection allow: the camera at up to 1080p and
// 30 fps, sent with 720p and 360p copies so a weak connection or a small window gets a
// smaller one instead of a frozen picture (LiveKit picks per viewer).
const CAMERA = {resolution: VideoPresets.h1080.resolution};
const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: {pixelDensity: 'screen'},
  dynacast: true,
  videoCaptureDefaults: CAMERA,
  publishDefaults: {
    videoEncoding: {maxBitrate: 3_500_000, maxFramerate: 30},
    videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h720],
  },
};

// "Touch up" (skin smoothing) on video calls: on unless the person switched it off; the
// choice is kept for the next call.
const TOUCH_UP_KEY = 'dm.call.touchUp';
let touchUpChoice = true;
AsyncStorage.getItem(TOUCH_UP_KEY)
  .then(v => {
    if (v != null) touchUpChoice = v === '1';
  })
  .catch(() => {});

// LiveKit's DisconnectReason values (livekit/protocol).
const CLIENT_INITIATED = 1;
const DUPLICATE_IDENTITY = 2;
const PARTICIPANT_REMOVED = 4;
const ROOM_DELETED = 5;
// How long the other side may vanish (switching device, a network blip) before a
// one-to-one call is treated as over without the server saying so.
const GONE_MS = 8000;

// The ringtone. On Android it has one owner, the native ringer (RingService, Ringer.kt):
// JavaScript only says when a call stops ringing here. Elsewhere (iPhone without
// CallKit) the app plays its own ringtone while open, following the silent switch.
let ringer: AudioPlayer | null = null;
function ring(on: boolean, callId?: string) {
  if (nativeCalls.nativeIncoming) {
    if (!on && callId) nativeCalls.stopRinging(callId);
    return;
  }
  try {
    if (!on) {
      ringer?.pause();
      ringer?.remove();
      ringer = null;
      return;
    }
    if (ringer) return;
    setAudioModeAsync({playsInSilentMode: false}).catch(() => {});
    ringer = createAudioPlayer(require('./sounds/ring.wav'));
    ringer.loop = true;
    ringer.play();
  } catch {
    ringer = null; // vibration still rings
  }
}

// The id this phone rings a call under: its own, or, rung again in a group call, the id
// that ring went out under (Android rings each id once).
function ringIdOf(call: Call | null | undefined, me: string | undefined) {
  return call?.members.find(m => m.user === me)?.ringId || call?.id;
}
// Stop this phone ringing a call, under both ids.
function stopRings(call: Call | null | undefined, me: string | undefined) {
  if (!call) return;
  ring(false, call.id);
  const other = ringIdOf(call, me);
  if (other && other !== call.id) {
    nativeCalls.stopRinging(other);
    nativeCalls.ended(other);
  }
}

// "Calling…" until one of the other side's phones confirms it is ringing, then
// "Ringing…", like WhatsApp. A panel that doesn't report ringingAt yet: "Ringing…".
function outgoingStatus(call: Call | null) {
  const others = call?.members.filter(m => m.user !== call.startedBy) ?? [];
  if (!others.some(m => 'ringingAt' in m)) return 'Ringing…';
  return others.some(m => m.ringingAt) ? 'Ringing…' : 'Calling…';
}

// Which camera is in use. restartTrack re-opens the capture on the other camera, which
// works on every phone (the old private _switchCamera did nothing through LiveKit).
type Facing = 'user' | 'environment';
let facing: Facing = 'user';
const facingListeners = new Set<() => void>();
function setFacing(next: Facing) {
  facing = next;
  facingListeners.forEach(l => l());
}
function useFacing() {
  return useSyncExternalStore(
    l => {
      facingListeners.add(l);
      return () => void facingListeners.delete(l);
    },
    () => facing,
  );
}

async function permissions(video: boolean) {
  const mic = await requestRecordingPermissionsAsync();
  if (!mic.granted) throw new Error('Allow microphone access to make calls.');
  if (video) await ImagePicker.requestCameraPermissionsAsync(); // without it the call is voice only
}

// One call at a time, shown over the whole app; minimize it to keep chatting.
export function CallProvider({children}: {children: React.ReactNode}) {
  const messenger = useMaybeMessenger();
  const me = messenger?.me;
  const meRef = useRef(me);
  meRef.current = me;
  const [s, setS] = useState<Session | null>(null);
  const ref = useRef<Session | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read through a function, so TypeScript doesn't narrow the ref across awaits.
  const now = useCallback(() => ref.current, []);
  const set = useCallback((next: Session | null) => {
    ref.current = next;
    setS(next);
  }, []);
  const patch = useCallback(
    (key: number, change: Partial<Session>) => {
      const current = ref.current;
      if (current?.key !== key) return;
      set({...current, ...change});
    },
    [set],
  );

  const finish = useCallback(
    (
      note?: string,
      operation?: 'calls.leave' | 'calls.decline',
      dropped = false,
    ) => {
      const current = ref.current;
      if (!current) return;
      if (ringTimer.current) clearTimeout(ringTimer.current);
      Vibration.cancel();
      ring(false, current.call?.id);
      stopRings(current.call, meRef.current);
      set(null);
      if (current.call) {
        dismissCallNotifications(current.call.id);
        nativeCalls.ended(current.call.id);
      }
      if (operation && current.call)
        relay(operation, {
          callId: current.call.id,
          // The server checks whether the employee carries on from another device.
          ...(dropped ? {dropped: true} : {}),
          devices: thisDevice.tokens(),
        }).catch(() => {});
      if (note) Alert.alert('Call', note);
    },
    [set],
  );

  const start = useCallback(
    async (conversationId: string, video: boolean) => {
      if (ref.current) return Alert.alert('Call', "You're already in a call.");
      const key = ++keys;
      set({key, call: null, conversationId, mode: 'outgoing', video});
      try {
        await permissions(video);
        const result = await relay('calls.start', {conversationId, video});
        if (now()?.key !== key)
          return relay('calls.leave', {callId: result.call.id}).catch(() => {});
        // Joining a group call already under way connects straight away.
        patch(key, {
          call: result.call,
          url: result.url,
          token: result.token,
          mode: result.call.answeredAt ? 'connecting' : 'outgoing',
        });
        // Something happened to the call before its id came back (a quick decline).
        const early = earlyEvents.current.get(result.call.id);
        earlyEvents.current.clear();
        if (early) onEvent.current(early);
        if (!result.call.answeredAt)
          ringTimer.current = setTimeout(
            () =>
              now()?.key === key &&
              now()?.mode === 'outgoing' &&
              finish('No answer', 'calls.leave'),
            RING_SECONDS * 1000,
          );
      } catch (error: any) {
        if (now()?.key === key)
          finish(error.message || "The call couldn't start.");
      }
    },
    [set, patch, finish, now],
  );

  const join = useCallback(
    async (given: Call, video: boolean, answer = false, title?: string) => {
      // The call already on screen: the same id, or (Answer on a ring that went out under
      // its Ring again id) the call ringing in that chat.
      const current =
        ref.current?.call?.id === given.id ||
        (ref.current?.mode === 'incoming' &&
          ref.current.call &&
          ref.current.conversationId === given.conversationId)
          ? ref.current
          : null;
      if (ref.current && !current)
        return Alert.alert('Call', "You're already in a call.");
      // Already showing this call (it arrived on the live stream): keep what we know of it
      // rather than the call alert's sketch.
      const call = current?.call ?? given;
      if (ringTimer.current) clearTimeout(ringTimer.current);
      Vibration.cancel();
      ring(false, call.id);
      stopRings(call, me);
      if (given.id !== call.id) {
        nativeCalls.stopRinging(given.id);
        nativeCalls.ended(given.id);
      }
      dismissCallNotifications(call.id);
      const key = current?.key ?? ++keys;
      set({
        key,
        call,
        conversationId: call.conversationId,
        mode: 'connecting',
        video,
        incoming: call.startedBy !== me,
        title: title ?? current?.title,
      });
      const request = () =>
        relay('calls.join', {
          callId: call.id,
          ...(answer ? {answer: true} : {}),
          devices: thisDevice.tokens(),
        });
      try {
        await permissions(video);
        let result;
        try {
          result = await request();
        } catch (error: any) {
          // Answered from the lock screen, the app only just started: the network may not
          // be up yet. The server's own refusals (ended, answered elsewhere) aren't retried.
          if (!answer || error?.status) throw error;
          await new Promise(resolve => setTimeout(resolve, 1500));
          if (now()?.key !== key) return;
          result = await request().catch((again: any) => {
            throw again?.status
              ? again
              : new Error(
                  "Couldn't reach the server to answer. Check your connection.",
                );
          });
        }
        if (now()?.key !== key)
          return relay('calls.leave', {callId: call.id}).catch(() => {});
        reportEvent(`call_joined ${call.id}`);
        // Answered under a Ring again id: the panel answers with the real call.
        if (result.call.id !== call.id) {
          nativeCalls.stopRinging(call.id);
          nativeCalls.ended(call.id);
        }
        patch(key, {call: result.call, url: result.url, token: result.token});
      } catch (error: any) {
        reportEvent(`call_join_refused ${call.id}: ${error?.message ?? 'error'}`);
        if (now()?.key === key)
          finish(error.message || "Couldn't join the call.");
      }
    },
    [set, patch, finish, now, me],
  );

  // Signing out of Messenger ends a call in progress.
  useEffect(
    () => () => {
      if (ref.current) finish(undefined, 'calls.leave');
    },
    [messenger, finish],
  );

  // Calls arrive on the live stream (or from the push that opened the app).
  const earlyEvents = useRef(new Map<string, Call>());
  const blockedDeclined = useRef(new Set<string>());
  const onEvent = useRef<(call: Call) => void>(() => {});
  useEffect(() => {
    if (!messenger) return;
    const handle = (call: Call) => {
      const current = ref.current;
      const mine = call.members.find(m => m.user === me)?.state;
      // A call from someone I blocked: decline it without ringing (once per call).
      if (
        !call.endedAt &&
        call.startedBy !== me &&
        mine === 'ringing' &&
        messenger.isBlocked(call.startedBy)
      ) {
        if (current?.call?.id === call.id) finish(undefined, 'calls.decline');
        else if (!blockedDeclined.current.has(call.id)) {
          blockedDeclined.current.add(call.id);
          callKit.endCall(call.id);
          void relay('calls.decline', {
            callId: call.id,
            devices: thisDevice.tokens(),
          }).catch(() => {});
        }
        return;
      }
      // Our own call starting, before calls.start answered with its id.
      if (
        current &&
        !current.call &&
        call.conversationId === current.conversationId
      ) {
        earlyEvents.current.set(call.id, call);
        return;
      }
      if (current?.call?.id === call.id) {
        if (call.endedAt)
          return finish(
            current.mode === 'outgoing' && call.endReason === 'declined'
              ? 'Declined'
              : undefined,
          );
        // Answered or declined on the ERP desk: stop ringing here.
        if (current.mode === 'incoming' && mine !== 'ringing') return finish();
        const answered = call.members.some(
          m => m.user !== me && m.state === 'joined',
        );
        if (current.mode === 'outgoing' && call.endReason === 'declined')
          return finish('Declined');
        if (current.mode === 'outgoing' && answered) {
          if (ringTimer.current) clearTimeout(ringTimer.current);
          return patch(current.key, {
            call,
            mode: 'active',
            answeredAt: Date.now(),
          });
        }
        return patch(current.key, {call});
      }
      // Call waiting: someone calls while I'm on another call. Offer the choice once
      // instead of ignoring it (the caller would hear it ring out).
      if (
        current &&
        !call.endedAt &&
        call.startedBy !== me &&
        mine === 'ringing' &&
        !waitingAsked.current.has(call.id)
      ) {
        waitingAsked.current.add(call.id);
        Vibration.vibrate([0, 300, 200, 300]);
        Alert.alert(
          `${personOf(messenger.people, call.startedBy).name} is calling`,
          call.video ? 'Incoming video call' : 'Incoming voice call',
          [
            {
              text: 'Decline',
              style: 'cancel',
              onPress: () =>
                void relay('calls.decline', {
                  callId: call.id,
                  devices: thisDevice.tokens(),
                }).catch(() => {}),
            },
            {
              text: 'End call & answer',
              onPress: () => {
                finish(undefined, 'calls.leave');
                setTimeout(() => join(call, call.video, true), 300);
              },
            },
          ],
        );
        return;
      }
      if (
        current ||
        call.endedAt ||
        call.startedBy === me ||
        mine !== 'ringing'
      )
        return;
      const key = ++keys;
      set({
        key,
        call,
        conversationId: call.conversationId,
        mode: 'incoming',
        video: call.video,
      });
      if (nativeCalls.nativeIncoming) {
        // Android: ring and show it natively, exactly as the push does (the push may be
        // late, or already have rung it: one ring per call either way). The panel already
        // counts a phone with the live stream open as ringing.
        const conv = messenger.convs.get(call.conversationId);
        nativeCalls.presentIncoming(
          ringIdOf(call, me)!,
          call.conversationId,
          conv
            ? convTitle(conv, messenger.people)
            : personOf(messenger.people, call.startedBy).name,
          call.video,
        );
      } else {
        Vibration.vibrate([0, 600, 400, 600, 400], true);
        ring(true);
      }
      reportEvent(`incoming call on the live stream ${call.id}`);
      // iPhone: CallKit's own ring is already on screen (the VoIP push usually beats the
      // live stream), so the app's ringtone steps aside rather than ringing twice.
      if (callKit.available)
        setTimeout(() => {
          if (now()?.key === key && callKit.has(call.id)) {
            ring(false);
            Vibration.cancel();
          }
        }, 1500);
      // The caller gives up after RING_SECONDS; stop ringing a little after that.
      ringTimer.current = setTimeout(
        () => now()?.key === key && now()?.mode === 'incoming' && finish(),
        (RING_SECONDS + 10) * 1000,
      );
    };
    onEvent.current = handle;
    return messenger.onCalls(handle);
  }, [messenger, me, set, patch, finish, now, join]);
  const waitingAsked = useRef(new Set<string>());

  // Android: once connecting, the call keeps its microphone and camera with the screen
  // locked (an ongoing-call service) and is registered with Telecom for headset, car and
  // watch buttons. Registered once per call.
  const registered = useRef<string | null>(null);
  const callId = s?.url && s.call ? s.call.id : null;
  useEffect(() => {
    const current = ref.current;
    if (!callId || !current || registered.current === callId) return;
    registered.current = callId;
    const conv = messenger?.convs.get(current.conversationId);
    const name = conv
      ? convTitle(conv, messenger!.people)
      : current.call && messenger
      ? personOf(messenger.people, current.call.startedBy).name
      : 'Call';
    nativeCalls.started(
      callId,
      current.conversationId,
      name,
      current.video,
      !!current.incoming,
    );
  }, [callId, messenger]);
  const active = s?.mode === 'active' ? s.call?.id : null;
  useEffect(() => {
    if (active) nativeCalls.connected(active);
  }, [active]);
  // Hung up from the ongoing-call notification, a headset, a car or a watch.
  useEffect(
    () =>
      onNativeHangUp(id => {
        const current = ref.current;
        if (!current || (id && current.call && current.call.id !== id)) return;
        finish(
          undefined,
          current.mode === 'incoming' ? 'calls.decline' : 'calls.leave',
        );
      }),
    [finish],
  );
  // A voice call on the earpiece darkens the screen at the ear; a video call shrinks
  // into a floating window when the person leaves the app.
  const voiceCall = !!s?.url && !s.video;
  const videoCall = !!s?.url && !!s?.video && !s.minimized;
  useEffect(() => {
    if (!voiceCall) return;
    nativeCalls.setProximity(true);
    return () => nativeCalls.setProximity(false);
  }, [voiceCall]);
  useEffect(() => {
    if (!videoCall) return;
    nativeCalls.setPip(true);
    return () => nativeCalls.setPip(false);
  }, [videoCall]);
  useEffect(() => {
    if (!s?.url) return;
    activateKeepAwakeAsync('call').catch(() => {});
    return () => {
      deactivateKeepAwake('call');
    };
  }, [s?.url]);

  const api = useMemo(() => ({start, join, current: s}), [start, join, s]);
  // Always the same Provider, signed in or not, so signing in or out of Messenger never
  // remounts the app below it.
  if (!messenger)
    return <Context.Provider value={api}>{children}</Context.Provider>;
  const c = s ? messenger.convs.get(s.conversationId) : null;
  const title = c
    ? convTitle(c, messenger.people)
    : s?.title
    ? s.title
    : s?.call?.startedBy
    ? personOf(messenger.people, s.call.startedBy).name
    : 'Call';
  return (
    <Context.Provider value={api}>
      {children}
      {s ? (
        <CallView
          s={s}
          title={title}
          group={c?.kind === 'group'}
          peer={
            c?.peer
              ? personOf(messenger.people, c.peer)
              : s.call?.startedBy
              ? personOf(messenger.people, s.call.startedBy)
              : undefined
          }
          onAccept={() => s.call && join(s.call, s.video, true)}
          onDecline={() => finish(undefined, 'calls.decline')}
          onHangUp={() => finish(undefined, 'calls.leave')}
          onConnected={() =>
            patch(
              s.key,
              s.mode === 'connecting'
                ? {
                    mode: 'active',
                    // Joining a call under way (or moving it here) keeps its real length.
                    answeredAt: s.call?.answeredAt
                      ? Math.min(Date.now(), Date.parse(s.call.answeredAt))
                      : Date.now(),
                  }
                : {},
            )
          }
          onAnswered={() => {
            if (s.mode !== 'outgoing') return;
            if (ringTimer.current) clearTimeout(ringTimer.current);
            patch(s.key, {mode: 'active', answeredAt: Date.now()});
          }}
          onMinimize={minimized => patch(s.key, {minimized})}
          onError={text => finish(text, 'calls.leave')}
          onEnded={(note, tellServer, dropped) =>
            finish(note, tellServer ? 'calls.leave' : undefined, dropped)
          }
        />
      ) : null}
    </Context.Provider>
  );
}

type ViewProps = {
  s: Session;
  title: string;
  group: boolean;
  peer?: ReturnType<typeof personOf>;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  onConnected: () => void;
  onAnswered: () => void;
  onMinimize: (v: boolean) => void;
  onError: (text: string) => void;
  onEnded: (
    note: string | undefined,
    tellServer: boolean,
    dropped?: boolean,
  ) => void;
};
function CallView(p: ViewProps) {
  const {s} = p;
  // The audio session is configured and started before the room connects (LiveKit's
  // order), so the first words are never lost to an unready audio route.
  const [audioReady, setAudioReady] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  useEffect(() => {
    if (!s.url) return;
    let stopped = false;
    setAudioReady(false);
    (async () => {
      try {
        // Voice calls start on the earpiece and video calls on the speaker, as on a phone.
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: s.video
              ? ['speaker', 'headset', 'bluetooth']
              : ['earpiece', 'headset', 'bluetooth'],
            audioTypeOptions: {} as any,
          },
          ios: {defaultOutput: s.video ? 'speaker' : 'earpiece'},
        });
        if (!stopped) await AudioSession.startAudioSession();
      } catch (error: any) {
        // Connect anyway: the system's default route still carries the call.
        reportEvent(`livekit audio session failed: ${error?.message ?? error}`);
      }
      if (!stopped) {
        reportEvent(`livekit_connection_started ${s.call?.id ?? ''}`);
        setAudioReady(true);
      }
    })();
    return () => {
      stopped = true;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [s.url, s.video, s.call?.id]);
  const status =
    s.mode === 'incoming'
      ? s.video
        ? 'Incoming video call'
        : 'Incoming voice call'
      : reconnecting
      ? 'Reconnecting…'
      : s.mode === 'outgoing'
      ? outgoingStatus(s.call)
      : s.mode === 'connecting'
      ? 'Connecting…'
      : '';
  const inner = <Stage {...p} status={status} />;
  if (!s.url) return <Shell {...p}>{inner}</Shell>;
  return (
    <Shell {...p}>
      <LiveKitRoom
        serverUrl={s.url}
        token={s.token}
        connect={audioReady}
        audio
        video={s.video ? {facingMode: 'user', ...CAMERA} : false}
        options={ROOM_OPTIONS}
        onConnected={() => {
          reportEvent(`livekit_connected ${s.call?.id ?? ''}`);
          p.onConnected();
        }}
        onError={error => {
          reportEvent(`livekit connection failed: ${error?.message ?? error}`);
          p.onError('The call connection failed.');
        }}>
        <RoomWatcher {...p} onReconnecting={setReconnecting} />
        {inner}
      </LiveKitRoom>
    </Shell>
  );
}
// Why the connection ended decides what to tell the person and the server.
function RoomWatcher({
  s,
  group,
  onEnded,
  onAnswered,
  onReconnecting,
}: ViewProps & {onReconnecting: (on: boolean) => void}) {
  const room = useRoomContext();
  const remote = useRemoteParticipants();
  const latest = useRef({s, onEnded, onAnswered});
  latest.current = {s, onEnded, onAnswered};
  // A network change (Wi-Fi to mobile data, a tunnel): LiveKit reconnects by itself; the
  // screen says so instead of looking frozen.
  useEffect(() => {
    const lost = () => {
      reportEvent(`livekit_reconnecting ${latest.current.s.call?.id ?? ''}`);
      onReconnecting(true);
    };
    const back = () => {
      reportEvent(`livekit_reconnected ${latest.current.s.call?.id ?? ''}`);
      onReconnecting(false);
    };
    room.on('reconnecting', lost);
    room.on('reconnected', back);
    return () => {
      room.off('reconnecting', lost);
      room.off('reconnected', back);
    };
  }, [room, onReconnecting]);
  useEffect(() => {
    const onDisconnected = (reason?: number) => {
      const end = latest.current.onEnded;
      if (reason === CLIENT_INITIATED) return; // we hung up
      // The same employee picked the call up on another device: it carries on there.
      if (reason === DUPLICATE_IDENTITY)
        return end('The call continued on your other device.', false);
      if (reason === ROOM_DELETED || reason === PARTICIPANT_REMOVED)
        return end(undefined, false); // the server ended the call
      end('The call dropped. Check your connection.', true, true);
    };
    room.on('disconnected', onDisconnected);
    return () => {
      room.off('disconnected', onDisconnected);
    };
  }, [room]);
  // Someone answered: start the call timer here even before the server's event.
  useEffect(() => {
    if (remote.length && latest.current.s.mode === 'outgoing')
      latest.current.onAnswered();
  }, [remote.length]);
  // Everyone else gone for a while (their app was killed, or this phone missed the
  // server's "ended" while in the background): end it rather than sit in an empty room.
  const answered = !!s.answeredAt;
  useEffect(() => {
    if (!answered || remote.length) return;
    const t = setTimeout(
      () =>
        latest.current.onEnded(
          group ? 'Everyone else left the call.' : 'Call ended',
          true,
        ),
      group ? GONE_MS * 4 : GONE_MS,
    );
    return () => clearTimeout(t);
  }, [answered, remote.length, group]);
  return null;
}

function Shell({s, children}: ViewProps & {children: React.ReactNode}) {
  return (
    <View
      style={s.minimized ? styles.barWrap : StyleSheet.absoluteFill}
      pointerEvents="box-none">
      {children}
    </View>
  );
}

function Stage({
  s,
  title,
  group,
  peer,
  status,
  onAccept,
  onDecline,
  onHangUp,
  onMinimize,
}: ViewProps & {status: string}) {
  const pip = usePictureInPicture();
  const [people, setPeople] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed =
    status === 'Reconnecting…'
      ? status
      : s.answeredAt
      ? clock((now - s.answeredAt) / 1000)
      : status;
  // Android shows an incoming call on its own native screen (IncomingCallActivity).
  if (s.mode === 'incoming' && nativeCalls.nativeIncoming) return null;
  // The floating window is too small for buttons: just the video.
  if (pip && s.url)
    return (
      <View style={styles.root}>
        <Videos />
      </View>
    );
  if (s.minimized)
    return (
      <Pressable style={styles.bar} onPress={() => onMinimize(false)}>
        <Ionicons name={s.video ? 'videocam' : 'call'} size={16} color="#fff" />
        <Text style={styles.barText} numberOfLines={1}>
          {title} · {elapsed}
        </Text>
        <Text style={styles.barText}>Tap to return</Text>
      </Pressable>
    );
  // A group video call shows everyone in a grid; the group's name moves to the top.
  const grid = group && !!s.url && s.video;
  const members = s.call?.members ?? [];
  const joined = members.filter(m => m.state === 'joined').length;
  const showPeople = group && !!s.call && s.mode !== 'incoming';
  return (
    <SafeAreaView style={styles.root}>
      {grid ? <GroupGrid /> : s.url ? <Videos /> : null}
      <View style={styles.top}>
        {s.mode !== 'incoming' ? (
          <Pressable
            onPress={() => onMinimize(true)}
            style={styles.round}
            accessibilityLabel="Minimize call">
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
        ) : null}
        <View style={styles.topTitle} pointerEvents="none">
          {grid ? (
            <>
              <Text style={styles.gridTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.status}>{elapsed}</Text>
            </>
          ) : null}
        </View>
        {showPeople ? (
          <Pressable
            onPress={() => setPeople(true)}
            style={styles.peopleButton}
            accessibilityLabel={`People: ${joined} of ${members.length} joined`}>
            <Ionicons name="people" size={18} color="#fff" />
            <Text style={styles.peopleCount}>
              {joined}/{members.length}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {grid ? null : (
        <View style={styles.who} pointerEvents="none">
          <Avatar
            person={group ? undefined : peer}
            group={group}
            groupId={s.conversationId}
            size={96}
          />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.status}>{elapsed}</Text>
          {showPeople ? (
            <Text style={styles.status}>
              {joined} joined · {members.length - joined} not joined
            </Text>
          ) : null}
        </View>
      )}
      {s.mode === 'incoming' ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.big, {backgroundColor: BRAND.danger}]}
            onPress={onDecline}
            accessibilityLabel="Decline">
            <Ionicons
              name="call"
              size={30}
              color="#fff"
              style={{transform: [{rotate: '135deg'}]}}
            />
          </Pressable>
          <Pressable
            style={[styles.big, {backgroundColor: '#16a34a'}]}
            onPress={onAccept}
            accessibilityLabel="Answer">
            <Ionicons
              name={s.video ? 'videocam' : 'call'}
              size={30}
              color="#fff"
            />
          </Pressable>
        </View>
      ) : s.url ? (
        <Controls
          video={s.video}
          active={s.mode === 'active'}
          onHangUp={onHangUp}
        />
      ) : (
        <View style={styles.actions}>
          <Pressable
            style={[styles.big, {backgroundColor: BRAND.danger}]}
            onPress={onHangUp}
            accessibilityLabel="End call">
            <Ionicons
              name="call"
              size={30}
              color="#fff"
              style={{transform: [{rotate: '135deg'}]}}
            />
          </Pressable>
        </View>
      )}
      {people && s.call ? (
        <Participants
          call={s.call}
          video={s.video}
          onClose={() => setPeople(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

// A group video call: everyone (me included) in a grid sized to how many are in it. One
// column for two, two up to six, three after that; past what fits, the grid scrolls.
// Someone without their camera on shows as their photo and name.
function GroupGrid() {
  const messenger = useMaybeMessenger();
  const side = useFacing();
  const participants = useParticipants();
  const speaking = new Set(useSpeakingParticipants().map(p => p.identity));
  const cameras = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  }).filter(isTrackReference);
  const [area, setArea] = useState({width: 0, height: 0});
  const n = Math.max(participants.length, 1);
  const cols = n <= 2 ? 1 : n <= 6 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const width = area.width / cols;
  const fits = area.height / rows;
  const height = Math.max(fits, width * 0.9);
  return (
    <View
      style={styles.grid}
      onLayout={e =>
        setArea({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }>
      {area.width ? (
        <ScrollView
          contentContainerStyle={styles.gridInner}
          scrollEnabled={height > fits}>
          {participants.map(p => {
            const camera = cameras.find(
              t =>
                t.participant.identity === p.identity && !t.publication.isMuted,
            );
            const person = messenger
              ? personOf(messenger.people, p.identity)
              : undefined;
            const name = p.isLocal
              ? 'You'
              : person?.name || p.name || p.identity;
            return (
              <View
                key={p.identity}
                style={[
                  styles.tile,
                  {width, height},
                  speaking.has(p.identity) && styles.tileSpeaking,
                ]}>
                {camera ? (
                  <VideoTrack
                    trackRef={camera}
                    style={StyleSheet.absoluteFill}
                    objectFit="cover"
                    mirror={p.isLocal && side === 'user'}
                  />
                ) : (
                  <View style={styles.tileEmpty}>
                    <Avatar person={person} size={Math.min(72, width / 2.5)} />
                  </View>
                )}
                <Text style={styles.tileName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

// Everyone the group call rang: who is in it, who isn't and why, with Ring again for
// anyone not in it. The list follows the call live.
function Participants({
  call,
  video,
  onClose,
}: {
  call: Call;
  video: boolean;
  onClose: () => void;
}) {
  const messenger = useMaybeMessenger();
  const me = messenger?.me;
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const order = {joined: 0, ringing: 1, missed: 2, declined: 3, left: 4};
  const rows = [...call.members].sort(
    (a, b) =>
      order[a.state] - order[b.state] ||
      (a.user === me ? -1 : b.user === me ? 1 : 0) ||
      (messenger ? personOf(messenger.people, a.user).name : a.user).localeCompare(
        messenger ? personOf(messenger.people, b.user).name : b.user,
      ),
  );
  const joined = rows.filter(m => m.state === 'joined').length;
  const ringable = rows.filter(
    m => m.user !== me && m.state !== 'joined' && m.state !== 'ringing',
  );
  async function ringAgain(users: string[]) {
    if (!users.length) return;
    setBusy(prev => new Set([...prev, ...users]));
    try {
      const result = await relay<{rung?: string[]}>('calls.start', {
        conversationId: call.conversationId,
        video,
        invite: users,
      });
      if (result?.rung && !result.rung.length)
        Alert.alert('Ring again', 'They are already ringing or in the call.');
    } catch (error: any) {
      Alert.alert('Ring again', error?.message || "Couldn't ring them.");
    } finally {
      setBusy(prev => {
        const next = new Set(prev);
        users.forEach(u => next.delete(u));
        return next;
      });
    }
  }
  const label = {
    joined: 'In the call',
    ringing: 'Ringing…',
    missed: "Didn't answer",
    declined: 'Declined',
    left: 'Left',
  };
  return (
    <View style={styles.sheetWrap}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <View style={{flex: 1}}>
            <Text style={styles.sheetTitle}>People in this call</Text>
            <Text style={styles.sheetSub}>
              {joined} joined · {rows.length - joined} not joined ·{' '}
              {rows.length} called
            </Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#111" />
          </Pressable>
        </View>
        {ringable.length ? (
          <Pressable
            style={styles.ringAll}
            onPress={() =>
              Alert.alert(
                'Ring everyone again?',
                `${ringable.length} ${
                  ringable.length === 1 ? 'person' : 'people'
                } who didn't join will ring again.`,
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Ring',
                    onPress: () => ringAgain(ringable.map(m => m.user)),
                  },
                ],
              )
            }>
            <Ionicons name="notifications" size={16} color="#fff" />
            <Text style={styles.ringAllText}>
              Ring everyone who didn't join ({ringable.length})
            </Text>
          </Pressable>
        ) : null}
        <FlatList
          data={rows}
          keyExtractor={m => m.user}
          renderItem={({item: m}) => {
            const person = messenger
              ? personOf(messenger.people, m.user)
              : {user: m.user, name: m.user};
            const canRing =
              m.user !== me && m.state !== 'joined' && m.state !== 'ringing';
            return (
              <View style={styles.personRow}>
                <Avatar person={person} size={38} />
                <View style={{flex: 1}}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {person.name}
                    {m.user === me ? ' (you)' : ''}
                  </Text>
                  <Text
                    style={[
                      styles.personState,
                      m.state === 'joined' && {color: '#16a34a'},
                    ]}>
                    {label[m.state]}
                  </Text>
                </View>
                {canRing ? (
                  <Pressable
                    style={[styles.ringOne, busy.has(m.user) && {opacity: 0.5}]}
                    disabled={busy.has(m.user)}
                    onPress={() => ringAgain([m.user])}
                    accessibilityLabel={`Ring ${person.name} again`}>
                    {busy.has(m.user) ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="call" size={14} color="#fff" />
                    )}
                    <Text style={styles.ringOneText}>Ring</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }}
        />
      </View>
    </View>
  );
}

// Everyone else's camera fills the screen (split for groups); mine sits in the corner.
function Videos() {
  const side = useFacing();
  const tracks = useTracks([Track.Source.Camera], {
    onlySubscribed: false,
  }).filter(isTrackReference);
  const remote = tracks.filter(
    t => !t.participant.isLocal && !t.publication.isMuted,
  );
  const local = tracks.find(
    t => t.participant.isLocal && !t.publication.isMuted,
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {remote.map(t => (
        <VideoTrack
          key={t.participant.identity}
          trackRef={t}
          style={{flex: 1, backgroundColor: '#000'}}
          // The whole picture, with bars: a laptop's wide picture filling an upright
          // phone cut off most of it and looked zoomed in.
          objectFit="contain"
        />
      ))}
      {local ? (
        <VideoTrack
          trackRef={local}
          style={styles.self}
          objectFit="cover"
          mirror={side === 'user'}
          zOrder={1}
        />
      ) : null}
    </View>
  );
}

function Controls({
  video,
  active,
  onHangUp,
}: {
  video: boolean;
  active: boolean;
  onHangUp: () => void;
}) {
  const {localParticipant, isMicrophoneEnabled, isCameraEnabled, cameraTrack} =
    useLocalParticipant();
  const remoteCount = useRemoteParticipants().length;
  const [speaker, setSpeaker] = useState(video);
  const [flipping, setFlipping] = useState(false);
  const [touchUp, setTouchUp] = useState(touchUpChoice);
  const side = useFacing();
  const camera = cameraTrack?.track as LocalVideoTrack | undefined;
  useEffect(() => {
    setFacing('user');
  }, []); // each call starts on the front camera
  async function flip() {
    if (!camera || flipping) return;
    const next: Facing = side === 'user' ? 'environment' : 'user';
    setFlipping(true);
    try {
      await camera.restartTrack({facingMode: next, ...CAMERA});
      setFacing(next);
    } catch {
      Alert.alert('Camera', "Couldn't switch the camera.");
    } finally {
      setFlipping(false);
    }
  }

  // Speaker or earpiece. The phone's own call handling (Telecom on Android, CallKit on
  // iPhone) resets the route when the call is answered and when someone joins, so a
  // choice made while it was still ringing is put back then.
  const chosen = useRef<boolean | null>(null);
  const route = useCallback(
    async (on: boolean) => {
      const output =
        Platform.OS === 'ios'
          ? on
            ? 'force_speaker'
            : 'default'
          : on
          ? 'speaker'
          : 'earpiece';
      await AudioSession.selectAudioOutput(output).catch(error =>
        reportEvent(`speaker switch failed: ${error?.message ?? error}`),
      );
      nativeCalls.setSpeaker(on);
      // On the speaker the phone isn't at the ear: keep the screen on.
      if (!video) nativeCalls.setProximity(!on);
    },
    [video],
  );
  async function toggleSpeaker() {
    const next = !speaker;
    chosen.current = next;
    setSpeaker(next);
    await route(next);
  }
  useEffect(() => {
    if (chosen.current === null || (!active && !remoteCount)) return;
    const on = chosen.current;
    const t = setTimeout(() => route(on), 500);
    return () => clearTimeout(t);
  }, [active, remoteCount, route]);

  // Touch up: the camera carries the "dm-beauty" effect, switched on and off natively;
  // a new camera track (switched camera, camera back on) gets it again.
  useEffect(() => {
    nativeCalls.setBeauty(touchUp);
  }, [touchUp]);
  useEffect(() => {
    if (!nativeCalls.beautyAvailable || !camera) return;
    const apply = () => {
      try {
        (camera.mediaStreamTrack as any)?._setVideoEffects?.(['dm-beauty']);
      } catch (error: any) {
        reportEvent(`touch up failed: ${error?.message ?? error}`);
      }
    };
    apply();
    camera.on(TrackEvent.Restarted, apply);
    camera.on(TrackEvent.Unmuted, apply);
    return () => {
      camera.off(TrackEvent.Restarted, apply);
      camera.off(TrackEvent.Unmuted, apply);
    };
  }, [camera]);
  function toggleTouchUp() {
    const next = !touchUp;
    touchUpChoice = next;
    setTouchUp(next);
    AsyncStorage.setItem(TOUCH_UP_KEY, next ? '1' : '0').catch(() => {});
  }
  const button = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    label: string,
    on: boolean,
    press: () => void,
  ) => (
    <Pressable
      style={[styles.ctl, on && styles.ctlOn]}
      onPress={press}
      accessibilityLabel={label}>
      <Ionicons name={icon} size={24} color={on ? BRAND.navy : '#fff'} />
    </Pressable>
  );
  return (
    <View style={styles.controls}>
      {button(
        isMicrophoneEnabled ? 'mic' : 'mic-off',
        'Microphone',
        !isMicrophoneEnabled,
        () =>
          localParticipant
            .setMicrophoneEnabled(!isMicrophoneEnabled)
            .catch(() => {}),
      )}
      {button(
        isCameraEnabled ? 'videocam' : 'videocam-off',
        'Camera',
        isCameraEnabled,
        () =>
          localParticipant
            .setCameraEnabled(!isCameraEnabled)
            .catch(() =>
              Alert.alert('Camera', 'Allow the camera to share video.'),
            ),
      )}
      {isCameraEnabled
        ? button('camera-reverse', 'Switch camera', flipping, flip)
        : null}
      {isCameraEnabled && nativeCalls.beautyAvailable
        ? button('sparkles', 'Touch up', touchUp, toggleTouchUp)
        : null}
      {button('volume-high', 'Speaker', speaker, toggleSpeaker)}
      <Pressable
        style={[styles.ctl, {backgroundColor: BRAND.danger}]}
        onPress={onHangUp}
        accessibilityLabel="End call">
        <Ionicons
          name="call"
          size={24}
          color="#fff"
          style={{transform: [{rotate: '135deg'}]}}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0b141a'},
  top: {flexDirection: 'row', padding: 12, minHeight: 64},
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: {alignItems: 'center', gap: 10, marginTop: 30},
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  status: {color: '#aebac1', fontSize: 15},
  actions: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  big: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 40,
    paddingVertical: 12,
  },
  // Six buttons on a video call (with Touch up) still fit a 360-wide phone.
  ctl: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctlOn: {backgroundColor: '#fff'},
  self: {
    position: 'absolute',
    right: 14,
    top: 90,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
  },
  barWrap: {position: 'absolute', top: 0, left: 0, right: 0},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingHorizontal: 14,
    paddingTop: 44,
    paddingBottom: 8,
  },
  barText: {color: '#fff', fontWeight: '600', flexShrink: 1},
  topTitle: {flex: 1, alignItems: 'center', paddingHorizontal: 8},
  gridTitle: {color: '#fff', fontSize: 17, fontWeight: '700'},
  peopleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  peopleCount: {color: '#fff', fontWeight: '700'},
  grid: {
    position: 'absolute',
    top: 72,
    bottom: 116,
    left: 0,
    right: 0,
  },
  gridInner: {flexDirection: 'row', flexWrap: 'wrap'},
  tile: {
    borderWidth: 2,
    borderColor: '#0b141a',
    backgroundColor: '#1f2c33',
    overflow: 'hidden',
  },
  tileSpeaking: {borderColor: '#16a34a'},
  tileEmpty: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  tileName: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    right: 6,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
  },
  sheetWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  sheetTitle: {fontSize: 17, fontWeight: '700', color: '#111'},
  sheetSub: {fontSize: 13, color: '#6b7280', marginTop: 2},
  ringAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: BRAND.navy,
  },
  ringAllText: {color: '#fff', fontWeight: '700'},
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  personName: {fontSize: 15, fontWeight: '600', color: '#111'},
  personState: {fontSize: 12, color: '#6b7280', marginTop: 1},
  ringOne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#16a34a',
  },
  ringOneText: {color: '#fff', fontWeight: '700', fontSize: 13},
});
