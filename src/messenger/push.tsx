import {useEffect, useRef} from 'react';
import {AppState, Linking, Platform} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {relay} from './api';
import {EXPO_PROJECT_ID} from './config';
import {useCalls} from './calls';
import {openChat} from './navigation';
import {dismissCallNotifications} from './notify';
import {onBeforeSignOut} from './session';
import {useMessenger, type Messenger} from './store';
import type {Call} from './types';

const TOKEN_KEY = 'messenger.pushToken';
let messengerRef: Messenger | null = null;
const handled = new Set<string>();

// While the app is open, the live stream already shows everything, so a push only
// appears for a chat other than the one on screen, and never for a call (the call
// screen rings instead).
Notifications.setNotificationHandler({
  handleNotification: async n => {
    const data: any = n.request.content.data || {};
    const looking =
      AppState.currentState === 'active' &&
      (data.type === 'call' ||
        messengerRef?.state.active === data.conversationId);
    return {
      shouldShowBanner: !looking,
      shouldShowList: !looking,
      shouldPlaySound: !looking,
      shouldSetBadge: false,
    };
  },
});

async function setup() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250],
    });
    await Notifications.setNotificationChannelAsync('calls', {
      name: 'Calls',
      importance: Notifications.AndroidImportance.MAX,
      // A 30 second ring (android/app/src/main/res/raw/ring.wav) played as a ringtone,
      // so a call rings on a locked or closed phone instead of a single beep.
      sound: 'ring.wav',
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
      vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800, 400, 800],
      enableVibrate: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationCategoryAsync('call', [
    {
      identifier: 'answer',
      buttonTitle: 'Answer',
      options: {opensAppToForeground: true},
    },
    {
      identifier: 'decline',
      buttonTitle: 'Decline',
      options: {opensAppToForeground: true, isDestructive: true},
    },
  ]);
}

// Push needs a real phone and the Expo project id (see MESSENGER.md); without them the
// app still works and notifies only while open.
async function register() {
  if (!Device.isDevice || !EXPO_PROJECT_ID) return;
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) return;
  const {data: token} = await Notifications.getExpoPushTokenAsync({
    projectId: EXPO_PROJECT_ID,
  });
  await relay('devices.register', {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
}
// Signing out of Messenger stops this phone getting the employee's messages. Even if
// the panel can't be told (the session already ended), dropping the phone's push
// registration makes the token invalid, and the panel forgets it on the next send.
export async function unregisterPush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  if (token) await relay('devices.unregister', {token}).catch(() => {});
  if (Device.isDevice)
    await Notifications.unregisterForNotificationsAsync().catch(() => {});
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
}

onBeforeSignOut(unregisterPush);

type JoinCall = (call: Call, video: boolean, answer: boolean) => unknown;

// Answer or decline a ringing call from a notification button. Returns true when that
// settled it; false means "just open the chat" (already answered elsewhere, or over).
async function respondToCall(
  me: string,
  join: JoinCall,
  data: any,
  action: 'answer' | 'decline',
): Promise<boolean> {
  const {calls: live} = await relay<{calls: Call[]}>('calls.live').catch(() => ({
    calls: [] as Call[],
  }));
  const call = live.find(x => x.id === data.callId);
  const mine = call?.members.find(m => m.user === me)?.state;
  dismissCallNotifications(data.callId);
  // Still ringing for me: answer or decline it here. Already answered on another
  // device, or over: just open the chat, never take the call over by accident.
  if (call && mine === 'ringing') {
    if (action === 'decline') {
      await relay('calls.decline', {callId: call.id}).catch(() => {});
      return true;
    }
    join(call, !!data.video, true);
    return true;
  }
  return action === 'decline';
}

// The Android call alert opens the app on dmworkspace://call?action=...&callId=...
function parseCallLink(url: string | null) {
  const m = url && /^dmworkspace:\/\/call\?(.*)$/.exec(url);
  if (!m) return null;
  const q: Record<string, string> = {};
  m[1].split('&').forEach(pair => {
    const [k, v = ''] = pair.split('=');
    try {
      q[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {}
  });
  if (!q.callId || !q.conversationId) return null;
  return {
    action: q.action,
    data: {
      type: 'call',
      callId: q.callId,
      conversationId: q.conversationId,
      video: q.video === '1',
    },
  };
}

// Opening the chat; a call still ringing shows its screen from the live calls.
function openCallChat(messenger: Messenger, data: any) {
  const tryOpen = (left: number) => {
    if (!openChat(data.conversationId) && left > 0)
      setTimeout(() => tryOpen(left - 1), 300);
  };
  tryOpen(20); // the splash screen shows for 3 seconds
  if (data.type === 'call') messenger.resync();
}

export function PushBridge() {
  const {messenger} = useMessenger();
  const calls = useCalls();
  const callsRef = useRef(calls);
  callsRef.current = calls;
  useEffect(() => {
    messengerRef = messenger;
    setup()
      .then(register)
      .catch(() => console.warn('Push notifications are not available.'));
    // Back in the app: clear call notifications for calls that are over.
    const clean = () =>
      dismissCallNotifications(
        undefined,
        new Set([...messenger.liveCalls.values()].map(c => c.id)),
      );
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') setTimeout(clean, 3000); // after the catch-up
    });
    setTimeout(clean, 5000);
    return () => {
      messengerRef = null;
      sub.remove();
    };
  }, [messenger]);

  useEffect(() => {
    async function handle(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const once = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handled.has(once)) return;
      handled.add(once);
      const data: any = response.notification.request.content.data || {};
      if (!data.conversationId) return;
      if (
        data.type === 'call' &&
        (response.actionIdentifier === 'answer' ||
          response.actionIdentifier === 'decline')
      ) {
        const settled = await respondToCall(
          messenger.me,
          (c, v, a) => callsRef.current.join(c, v, a),
          data,
          response.actionIdentifier,
        );
        if (settled) return;
      }
      openCallChat(messenger, data);
    }
    Notifications.getLastNotificationResponseAsync().then(handle);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [messenger]);

  // Android: the call alert's tap, Answer and Decline arrive as a dmworkspace://call link.
  useEffect(() => {
    async function onLink(url: string | null) {
      const link = parseCallLink(url);
      if (!link || !url || handled.has(url)) return;
      handled.add(url);
      if (link.action === 'answer' || link.action === 'decline') {
        const settled = await respondToCall(
          messenger.me,
          (c, v, a) => callsRef.current.join(c, v, a),
          link.data,
          link.action,
        );
        if (settled) return;
      }
      openCallChat(messenger, link.data);
    }
    Linking.getInitialURL().then(onLink, () => {});
    const sub = Linking.addEventListener('url', ({url}) => void onLink(url));
    return () => sub.remove();
  }, [messenger]);
  return null;
}
