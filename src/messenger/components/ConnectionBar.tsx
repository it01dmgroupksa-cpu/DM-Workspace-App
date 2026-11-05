import React from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {BRAND} from '../config';
import type {Messenger} from '../store';

// Says what's happening when it isn't simply "up to date": no network, the server not
// reachable yet, catching up, or messages waiting to send. Nothing shows when all is well.
export function ConnectionBar({messenger}: {messenger: Messenger}) {
  const {connection, syncing, cached, recovering, error} = messenger.state;
  const waiting = messenger.pendingCount();
  const queued = waiting
    ? ` ${waiting} message${
        waiting === 1 ? '' : 's'
      } will send when you're back.`
    : '';
  let text = '';
  let icon: React.ComponentProps<typeof Ionicons>['name'] | null = null;
  let spin = false;
  if (connection === 'offline') {
    text = `No internet connection.${queued || ' Showing saved messages.'}`;
    icon = 'cloud-offline-outline';
  } else if (connection === 'connecting') {
    text =
      cached && error
        ? 'Messenger is unreachable. Retrying… Showing saved messages.'
        : 'Connecting…';
    spin = true;
  } else if (waiting) {
    text = `Sending ${waiting} message${waiting === 1 ? '' : 's'}…`;
    spin = true;
  } else if (syncing && (cached || recovering)) {
    text = 'Syncing messages…';
    spin = true;
  }
  if (!text) return null;
  return (
    <View
      style={[styles.bar, connection === 'offline' && styles.offline]}
      accessibilityRole="alert">
      {spin ? (
        <ActivityIndicator size="small" color={BRAND.sub} />
      ) : icon ? (
        <Ionicons name={icon} size={16} color="#92400e" />
      ) : null}
      <Text
        style={[styles.text, connection === 'offline' && styles.offlineText]}
        numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#eef2f7',
  },
  offline: {backgroundColor: '#fef3c7'},
  text: {flex: 1, color: BRAND.sub, fontSize: 13},
  offlineText: {color: '#92400e'},
});
