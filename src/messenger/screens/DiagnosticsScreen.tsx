import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import {requestRecordingPermissionsAsync} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import type {StackScreenProps} from '@react-navigation/stack';
import {BRAND} from '../config';
import {nativeCalls, type Diagnostics} from '../nativeCalls';
import {thisDevice} from '../device';
import type {MessengerStack} from '../navigation';

// "Call check" (the calling settings): everything on this phone that can stop a call
// ringing or connecting, each with a light, why it matters, and a button that fixes it.
// Permissions are asked in the app first; system settings open only when the person taps
// a button, never by themselves. Plus a test ringtone, a test call, and this phone's own
// trail of call steps to share with IT. Android only (DmCallsModule.diagnostics / fix).

type Level = 'ok' | 'warn' | 'bad';
type Check = {
  key: string;
  title: string;
  detail: string;
  level: Level;
  fixLabel?: string;
};

function checks(d: Diagnostics, registered: boolean): Check[] {
  const loud = d.ringVolumeMax ? d.ringVolume / d.ringVolumeMax : 1;
  return [
    {
      key: 'notifications',
      title: 'Notifications',
      level: d.notifications ? 'ok' : 'bad',
      detail: d.notifications
        ? 'Allowed.'
        : "Off: calls and messages can't alert you.",
      fixLabel: 'Turn on',
    },
    {
      key: 'callAlerts',
      title: 'Incoming call alerts',
      level: d.callAlerts ? 'ok' : 'bad',
      detail: d.callAlerts
        ? 'Calls pop up on the screen.'
        : 'The "Incoming calls" notifications are turned down, so calls don\'t pop up.',
      fixLabel: 'Open settings',
    },
    {
      key: 'push',
      title: 'Registered for calls',
      level: registered ? 'ok' : 'bad',
      detail: registered
        ? 'This phone is registered to receive calls.'
        : 'Not registered yet. Allow notifications, then close and reopen Messenger.',
    },
    {
      key: 'ringer',
      title: 'Ring mode',
      level: d.ringer === 'normal' ? 'ok' : 'bad',
      detail:
        d.ringer === 'normal'
          ? 'Ring: calls make a sound.'
          : d.ringer === 'vibrate'
          ? 'Vibrate: calls only vibrate, with no ringtone.'
          : 'Silent: calls make no sound.',
      fixLabel: 'Switch to Ring',
    },
    {
      key: 'volume',
      title: 'Ringtone volume',
      level:
        d.ringer !== 'normal' || loud === 0 ? 'bad' : loud < 0.5 ? 'warn' : 'ok',
      detail:
        `${d.ringVolume} of ${d.ringVolumeMax}.` +
        (loud < 0.5 ? ' Calls may be hard to hear.' : ''),
      fixLabel: 'Turn up',
    },
    {
      key: 'dnd',
      title: 'Do Not Disturb',
      level: d.dnd ? 'warn' : 'ok',
      detail: d.dnd ? 'On: calls may be silenced.' : 'Off.',
      fixLabel: 'Open settings',
    },
    {
      key: 'fullScreen',
      title: 'Full-screen calls',
      level: d.fullScreen ? 'ok' : 'bad',
      detail: d.fullScreen
        ? 'Calls show full screen on a locked phone.'
        : 'Off: on a locked phone a call shows only as a small alert.',
      fixLabel: 'Allow',
    },
    {
      key: 'battery',
      title: 'Running in the background',
      level: d.battery ? 'ok' : 'bad',
      detail: d.battery
        ? 'Unrestricted: calls reach this phone with the app closed.'
        : 'Restricted: the phone may hold calls back while the app is closed.',
      fixLabel: 'Allow',
    },
    {
      key: 'microphone',
      title: 'Microphone',
      level: d.microphone ? 'ok' : 'bad',
      detail: d.microphone
        ? 'Allowed: the other side can hear you.'
        : 'Not allowed: you can answer, but the other side will not hear you.',
      fixLabel: 'Allow',
    },
    {
      key: 'camera',
      title: 'Camera',
      level: d.camera ? 'ok' : 'warn',
      detail: d.camera
        ? 'Allowed for video calls.'
        : 'Not allowed: video calls work as voice only.',
      fixLabel: 'Allow',
    },
  ];
}

const COLORS: Record<Level, string> = {
  ok: '#16a34a',
  warn: '#d97706',
  bad: BRAND.danger,
};

export function DiagnosticsScreen({
  navigation,
}: StackScreenProps<MessengerStack, 'Diagnostics'>) {
  const [d, setD] = useState<Diagnostics | null | undefined>(undefined);
  const [ringing, setRinging] = useState(false);
  const [events, setEvents] = useState('');
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    nativeCalls.diagnostics().then(setD);
    nativeCalls.callEvents().then(setEvents);
  }, []);

  // Back from a settings page: check again.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const stopRingtone = useCallback(() => {
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
    nativeCalls.testRingtone(false);
    setRinging(false);
  }, []);
  useEffect(() => stopRingtone, [stopRingtone]);

  const toggleRingtone = () => {
    if (ringing) return stopRingtone();
    nativeCalls.testRingtone(true);
    setRinging(true);
    stopTimer.current = setTimeout(stopRingtone, 10000);
  };

  // Runtime permissions are asked in the app first; only a permission Android will no
  // longer ask for (refused twice) sends the person to the app's settings.
  const fix = async (key: string) => {
    const ask =
      key === 'notifications'
        ? () => Notifications.requestPermissionsAsync()
        : key === 'microphone'
        ? () => requestRecordingPermissionsAsync()
        : key === 'camera'
        ? () => ImagePicker.requestCameraPermissionsAsync()
        : null;
    if (ask) {
      const result = await ask().catch(() => null);
      if (result && !result.granted && result.canAskAgain === false)
        nativeCalls.fix(key);
    } else nativeCalls.fix(key);
    setTimeout(refresh, 700); // ring mode and volume change in place
  };

  const share = () =>
    Share.share({
      message: `DM Workspace call check\n${d?.device} · Android ${d?.android} · app ${d?.appVersion}\n\n${events}`,
    }).catch(() => {});

  const list = d ? checks(d, thisDevice.tokens().length > 0) : [];
  const problems = list.filter(c => c.level === 'bad').length;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>Call check</Text>
      </View>
      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        {d === undefined ? (
          <ActivityIndicator color={BRAND.navy} style={styles.loading} />
        ) : d === null ? (
          <Text style={styles.note}>
            The call check needs the latest version of the app on Android.
          </Text>
        ) : (
          <>
            <View
              style={[
                styles.summary,
                {backgroundColor: problems ? '#fdecea' : BRAND.accentSoft},
              ]}>
              <Ionicons
                name={problems ? 'alert-circle' : 'checkmark-circle'}
                size={26}
                color={problems ? BRAND.danger : '#16a34a'}
              />
              <Text style={styles.summaryText}>
                {problems
                  ? `${problems} thing${
                      problems === 1 ? '' : 's'
                    } can stop calls ringing on this phone.`
                  : 'This phone is ready to ring for calls.'}
              </Text>
            </View>

            {list.map(c => (
              <View key={c.key} style={styles.row}>
                <View style={[styles.dot, {backgroundColor: COLORS[c.level]}]} />
                <View style={styles.flex}>
                  <Text style={styles.title}>{c.title}</Text>
                  <Text style={styles.detail}>{c.detail}</Text>
                </View>
                {c.level !== 'ok' && c.fixLabel ? (
                  <Pressable
                    onPress={() => void fix(c.key)}
                    style={styles.fixBtn}
                    accessibilityLabel={`${c.fixLabel}: ${c.title}`}>
                    <Text style={styles.fixText}>{c.fixLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            <Text style={styles.section}>Try it</Text>
            <Pressable onPress={toggleRingtone} style={styles.action}>
              <Ionicons
                name={ringing ? 'stop-circle-outline' : 'musical-notes-outline'}
                size={22}
                color={BRAND.navy}
              />
              <Text style={styles.actionText}>
                {ringing ? 'Stop the ringtone' : 'Test ringtone'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => nativeCalls.testCallScreen()}
              style={styles.action}>
              <Ionicons name="call-outline" size={22} color={BRAND.navy} />
              <Text style={styles.actionText}>Test the call screen</Text>
            </Pressable>
            <Text style={styles.note}>
              The test call rings and shows exactly like a real one. Press Answer
              or Decline to end it. Last ring on this phone: {d.lastRing}.
            </Text>

            <Text style={styles.section}>This phone</Text>
            <Text style={styles.note}>
              {d.device} · Android {d.android} ·{' '}
              {d.is64bit ? '64-bit' : '32-bit'} · app {d.appVersion}
              {'\n'}
              Crashes and call problems are reported automatically, so they can
              be fixed.
            </Text>

            <Text style={styles.section}>Recent call steps</Text>
            <Text style={styles.note}>
              If a call didn't ring, share this with IT: it shows each step this
              phone saw (push received, ringing, answered…).
            </Text>
            <View style={styles.trail}>
              <Text style={styles.trailText} selectable>
                {events.split('\n').slice(-40).join('\n') ||
                  'Nothing yet. Make a test call above.'}
              </Text>
            </View>
            <Pressable onPress={share} style={styles.action}>
              <Ionicons name="share-outline" size={22} color={BRAND.navy} />
              <Text style={styles.actionText}>Share with IT</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: BRAND.navy},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerBtn: {padding: 6},
  heading: {color: '#fff', fontSize: 21, fontWeight: '700'},
  body: {flex: 1, backgroundColor: BRAND.bg},
  content: {padding: 14, paddingBottom: 40, gap: 10},
  loading: {marginTop: 40},
  flex: {flex: 1},
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
  },
  summaryText: {flex: 1, color: BRAND.text, fontSize: 15, fontWeight: '600'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: BRAND.card,
  },
  dot: {width: 12, height: 12, borderRadius: 6},
  title: {color: BRAND.text, fontSize: 15, fontWeight: '600'},
  detail: {color: BRAND.sub, fontSize: 13, marginTop: 2},
  fixBtn: {
    backgroundColor: BRAND.navy,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  fixText: {color: '#fff', fontWeight: '600', fontSize: 13},
  section: {
    color: BRAND.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    textTransform: 'uppercase',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: BRAND.card,
  },
  actionText: {color: BRAND.navy, fontSize: 15, fontWeight: '600'},
  note: {color: BRAND.sub, fontSize: 13, lineHeight: 19},
  trail: {padding: 12, borderRadius: 12, backgroundColor: '#0b1b33'},
  trailText: {
    color: '#d6e2f2',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
});
