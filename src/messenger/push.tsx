import {useEffect, useRef} from 'react';
import {AppState, Platform} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {relay} from './api';
import {EXPO_PROJECT_ID} from './config';
import {useCalls} from './calls';
import {openChat} from './navigation';
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
// Signing out stops this phone getting the employee's messages.
export async function unregisterPush() {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
  await relay('devices.unregister', {token}).catch(() => {});
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
    return () => {
      messengerRef = null;
      unregisterPush();
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
        if (!call) return;
        if (response.actionIdentifier === 'decline')
          return void relay('calls.decline', {callId: call.id}).catch(() => {});
        return callsRef.current.join(call, !!data.video);
      }
      // Opening the chat; a call still ringing shows its screen from the live calls.
      const tryOpen = (left: number) => {
        if (!openChat(data.conversationId) && left > 0)
          setTimeout(() => tryOpen(left - 1), 300);
      };
      tryOpen(10);
      if (data.type === 'call') messenger.resync();
    }
    Notifications.getLastNotificationResponseAsync().then(handle);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [messenger]);
  return null;
}
