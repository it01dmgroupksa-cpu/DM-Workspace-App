import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {BRAND} from '../config';
import {agentCards} from '../agent';
import {actionsFor, applyAgain, cardHeading, cardStatus, decide} from '../approvals';
import type {AgentCard as Card, Message} from '../types';

// An approval card the CEO agent posted in the Durar Assistant chat. The message body is a
// plain summary (what old app versions and the desk show); this card reads the live state
// from the panel and offers the same decisions as the ERP agent page.
export function AgentCard({m}: {m: Message}) {
  const ref = m.agent!;
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [found] = await agentCards([ref.requestId!]);
      setCard(found ?? null);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Could not load this request.');
    }
  }, [ref.requestId]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function run(action: 'approve' | 'reject' | 'apply') {
    setBusy(true);
    try {
      if (action === 'apply') await applyAgain(ref.chatId, ref.requestId!);
      else await decide(ref.chatId, ref.requestId!, action);
    } catch (e: any) {
      Alert.alert('Not done', e.message || 'Try again.');
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  function confirm(action: 'approve' | 'reject' | 'apply') {
    const applies = card?.execution === 'waiting' || action === 'apply';
    const body =
      action === 'reject'
        ? 'Nothing will be changed.'
        : applies
        ? 'Approving applies this change in ERP, using your own account and permissions. Review it first.'
        : 'Approving records your decision. This kind of change is not applied automatically, so nothing will be changed in ERP.';
    Alert.alert(cardHeading(card?.preview), body, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: action === 'reject' ? 'Reject request' : applies ? 'Approve and apply' : 'Approve',
        style: action === 'reject' ? 'destructive' : 'default',
        onPress: () => run(action),
      },
    ]);
  }

  const preview = card?.preview;
  const rows = [
    ...(preview?.changes || []).map(c => [c.field, c.new]),
    ...(preview?.details || []).map(d => [d.label, d.value]),
  ].slice(0, 12);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark" size={16} color={BRAND.accent} />
        <Text style={styles.title} numberOfLines={3}>
          {card ? cardHeading(preview) : m.body.split('\n')[0]}
        </Text>
      </View>
      {!!(preview?.company || preview?.reason) && (
        <Text style={styles.meta}>{[preview?.company, preview?.reason].filter(Boolean).join(' · ')}</Text>
      )}
      {rows.map(([label, value], i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.label} numberOfLines={2}>{label}</Text>
          <Text style={styles.value} numberOfLines={6}>{String(value ?? '')}</Text>
        </View>
      ))}
      {!!card?.coordination?.report && <Text style={styles.meta}>{card.coordination.report}</Text>}
      <Text style={styles.status}>{card ? cardStatus(card) : error || 'Loading…'}</Text>
      {busy ? (
        <ActivityIndicator color={BRAND.accent} style={styles.busy} />
      ) : (
        card && (
          <View style={styles.actions}>
            {actionsFor(card).map(action => (
              <Pressable
                key={action}
                onPress={() => confirm(action)}
                style={[styles.button, action === 'reject' && styles.reject]}>
                <Text style={[styles.buttonText, action === 'reject' && styles.rejectText]}>
                  {action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Apply again'}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      )}
      {!card && !!error && (
        <Pressable onPress={refresh}>
          <Text style={styles.retry}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.card,
    borderColor: BRAND.accent,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 10,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  head: {flexDirection: 'row', gap: 6, alignItems: 'flex-start'},
  title: {flex: 1, fontWeight: '600', color: BRAND.text, fontSize: 15},
  meta: {color: BRAND.sub, marginTop: 6, fontSize: 13},
  row: {flexDirection: 'row', gap: 8, marginTop: 6},
  label: {color: BRAND.muted, width: 96, fontSize: 13},
  value: {flex: 1, color: BRAND.text, fontSize: 13},
  status: {marginTop: 8, color: BRAND.sub, fontSize: 12},
  actions: {flexDirection: 'row', gap: 8, marginTop: 10},
  button: {backgroundColor: BRAND.accent, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8},
  buttonText: {color: '#fff', fontWeight: '600'},
  reject: {backgroundColor: 'transparent', borderWidth: 1, borderColor: BRAND.danger},
  rejectText: {color: BRAND.danger},
  busy: {marginTop: 10, alignSelf: 'flex-start'},
  retry: {color: BRAND.read, marginTop: 6},
});
