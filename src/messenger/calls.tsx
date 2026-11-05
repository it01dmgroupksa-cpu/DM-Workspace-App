import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {activateKeepAwakeAsync, deactivateKeepAwake} from 'expo-keep-awake';
import {requestRecordingPermissionsAsync} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import {
  AudioSession,
  LiveKitRoom,
  VideoTrack,
  isTrackReference,
  useLocalParticipant,
  useTracks,
} from '@livekit/react-native';
import {Track} from 'livekit-client';
import {relay} from './api';
import {BRAND, RING_SECONDS} from './config';
import {clock, convTitle, personOf} from './format';
import {useMessenger} from './store';
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
};
type CallsApi = {
  start: (conversationId: string, video: boolean) => void;
  join: (call: Call, video: boolean) => void;
  current: Session | null;
};
const Context = createContext<CallsApi | null>(null);
export const useCalls = () => useContext(Context)!;
let keys = 0;

async function permissions(video: boolean) {
  const mic = await requestRecordingPermissionsAsync();
  if (!mic.granted) throw new Error('Allow microphone access to make calls.');
  if (video) await ImagePicker.requestCameraPermissionsAsync(); // without it the call is voice only
}

// One call at a time, shown over the whole app; minimize it to keep chatting.
export function CallProvider({children}: {children: React.ReactNode}) {
  const {messenger} = useMessenger();
  const me = messenger.me;
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
    (note?: string, operation?: 'calls.leave' | 'calls.decline') => {
      const current = ref.current;
      if (!current) return;
      if (ringTimer.current) clearTimeout(ringTimer.current);
      Vibration.cancel();
      set(null);
      if (operation && current.call)
        relay(operation, {callId: current.call.id}).catch(() => {});
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
    async (call: Call, video: boolean) => {
      const current = ref.current?.call?.id === call.id ? ref.current : null;
      if (ref.current && !current)
        return Alert.alert('Call', "You're already in a call.");
      if (ringTimer.current) clearTimeout(ringTimer.current);
      Vibration.cancel();
      const key = current?.key ?? ++keys;
      set({
        key,
        call,
        conversationId: call.conversationId,
        mode: 'connecting',
        video,
      });
      try {
        await permissions(video);
        const result = await relay('calls.join', {callId: call.id});
        if (now()?.key !== key)
          return relay('calls.leave', {callId: call.id}).catch(() => {});
        patch(key, {call: result.call, url: result.url, token: result.token});
      } catch (error: any) {
        if (now()?.key === key)
          finish(error.message || "Couldn't join the call.");
      }
    },
    [set, patch, finish, now],
  );

  // Calls arrive on the live stream (or from the push that opened the app).
  useEffect(
    () =>
      messenger.onCalls(call => {
        const current = ref.current;
        const mine = call.members.find(m => m.user === me)?.state;
        if (current?.call?.id === call.id) {
          if (call.endedAt) return finish();
          // Answered or declined on the ERP desk: stop ringing here.
          if (current.mode === 'incoming' && mine !== 'ringing')
            return finish();
          const answered = call.members.some(
            m => m.user !== me && m.state === 'joined',
          );
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
        Vibration.vibrate([0, 600, 400, 600, 400], true);
        // The caller gives up after RING_SECONDS; stop ringing a little after that.
        ringTimer.current = setTimeout(
          () => now()?.key === key && now()?.mode === 'incoming' && finish(),
          (RING_SECONDS + 10) * 1000,
        );
      }),
    [messenger, me, set, patch, finish, now],
  );
  useEffect(() => {
    if (!s?.url) return;
    activateKeepAwakeAsync('call').catch(() => {});
    return () => {
      deactivateKeepAwake('call');
    };
  }, [s?.url]);

  const api = useMemo(() => ({start, join, current: s}), [start, join, s]);
  const c = s ? messenger.convs.get(s.conversationId) : null;
  const title = c
    ? convTitle(c, messenger.people)
    : s?.call
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
              : s.call
              ? personOf(messenger.people, s.call.startedBy)
              : undefined
          }
          onAccept={() => s.call && join(s.call, s.video)}
          onDecline={() => finish(undefined, 'calls.decline')}
          onHangUp={() => finish(undefined, 'calls.leave')}
          onConnected={() =>
            patch(
              s.key,
              s.mode === 'connecting'
                ? {mode: 'active', answeredAt: Date.now()}
                : {},
            )
          }
          onMinimize={minimized => patch(s.key, {minimized})}
          onError={text => finish(text, 'calls.leave')}
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
  onMinimize: (v: boolean) => void;
  onError: (text: string) => void;
};
function CallView(p: ViewProps) {
  const {s} = p;
  useEffect(() => {
    if (!s.url) return;
    let stopped = false;
    (async () => {
      // Voice calls start on the earpiece and video calls on the speaker, as on a phone.
      await AudioSession.configureAudio({
        android: {
          preferredOutputList: s.video
            ? ['speaker', 'headset', 'bluetooth']
            : ['earpiece', 'headset', 'bluetooth'],
          audioTypeOptions: {} as any,
        },
        ios: {defaultOutput: s.video ? 'speaker' : 'earpiece'},
      }).catch(() => {});
      if (!stopped) await AudioSession.startAudioSession().catch(() => {});
    })();
    return () => {
      stopped = true;
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [s.url, s.video]);
  const status =
    s.mode === 'incoming'
      ? s.video
        ? 'Incoming video call'
        : 'Incoming voice call'
      : s.mode === 'outgoing'
      ? 'Ringing…'
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
        connect
        audio
        video={s.video}
        options={{adaptiveStream: {pixelDensity: 'screen'}}}
        onConnected={p.onConnected}
        onError={() => p.onError('The call connection failed.')}>
        {inner}
      </LiveKitRoom>
    </Shell>
  );
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
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = s.answeredAt ? clock((now - s.answeredAt) / 1000) : status;
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
  return (
    <SafeAreaView style={styles.root}>
      {s.url ? <Videos /> : null}
      <View style={styles.top}>
        {s.mode !== 'incoming' ? (
          <Pressable
            onPress={() => onMinimize(true)}
            style={styles.round}
            accessibilityLabel="Minimize call">
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.who} pointerEvents="none">
        <Avatar
          person={group ? undefined : peer}
          group={group}
          groupId={s.conversationId}
          size={96}
        />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.status}>{elapsed}</Text>
      </View>
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
        <Controls video={s.video} onHangUp={onHangUp} />
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
    </SafeAreaView>
  );
}

// Everyone else's camera fills the screen (split for groups); mine sits in the corner.
function Videos() {
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
          style={{flex: 1}}
          objectFit="cover"
        />
      ))}
      {local ? (
        <VideoTrack
          trackRef={local}
          style={styles.self}
          objectFit="cover"
          mirror
          zOrder={1}
        />
      ) : null}
    </View>
  );
}

function Controls({video, onHangUp}: {video: boolean; onHangUp: () => void}) {
  const {localParticipant, isMicrophoneEnabled, isCameraEnabled, cameraTrack} =
    useLocalParticipant();
  const [speaker, setSpeaker] = useState(video);
  async function toggleSpeaker() {
    const next = !speaker;
    setSpeaker(next);
    const output =
      Platform.OS === 'ios'
        ? next
          ? 'force_speaker'
          : 'default'
        : next
        ? 'speaker'
        : 'earpiece';
    await AudioSession.selectAudioOutput(output).catch(() => {});
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
        ? button('camera-reverse', 'Switch camera', false, () =>
            (cameraTrack?.track?.mediaStreamTrack as any)?._switchCamera?.(),
          )
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
  ctl: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
});
