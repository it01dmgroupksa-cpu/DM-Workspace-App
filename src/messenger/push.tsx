import {useEffect, useRef} from 'react';
import {AppState, Platform} from 'react-native';
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
      sound: 'default',
      vibrationPattern: [0, 800, 400, 800, 400, 800],
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
        const {calls: live} = await relay<{calls: Call[]}>('calls.live').catch(
          () => ({calls: [] as Call[]}),
        );
        const call = live.find(x => x.id === data.callId);
        const mine = call?.members.find(m => m.user === messenger.me)?.state;
        dismissCallNotifications(data.callId);
        // Still ringing for me: answer or decline it here. Already answered on another
        // device, or over: just open the chat, never take the call over by accident.
        if (call && mine === 'ringing') {
          if (response.actionIdentifier === 'decline')
            return void relay('calls.decline', {callId: call.id}).catch(
              () => {},
            );
          return callsRef.current.join(call, !!data.video, true);
        }
        if (response.actionIdentifier === 'decline') return;
      }
      // Opening the chat; a call still ringing shows its screen from the live calls.
      const tryOpen = (left: number) => {
        if (!openChat(data.conversationId) && left > 0)
          setTimeout(() => tryOpen(left - 1), 300);
      };
      tryOpen(20); // the splash screen shows for 3 seconds
      if (data.type === 'call') messenger.resync();
    }
    Notifications.getLastNotificationResponseAsync().then(handle);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [messenger]);
  return null;
}
