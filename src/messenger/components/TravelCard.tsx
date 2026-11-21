import React, {useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {BRAND} from '../config';
import {decideTravel, PENDING, travelActions, travelLines, type TravelApproval} from '../travel';
import type {Message} from '../types';

// An air ticket sent for the CEO's approval. Everyone in the chat sees the details and the
// state; only the approver gets Approve / Reject, and only while it waits for him. The card
// updates by itself when ERP saves the decision (the panel republishes the message).
export function TravelCard({m, isApprover}: {m: Message; isApprover: boolean}) {
  const a = m.approval as TravelApproval;
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const actions = travelActions(a, isApprover);

  async function decide(action: 'Approve' | 'Reject') {
    setBusy(true);
    try {
      await decideTravel(a.name, action, reason);
      setRejecting(false);
    } catch (e: any) {
      Alert.alert('Not done', e.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }
  function approve() {
    Alert.alert('Approve this air ticket?', `${a.name}\nERP records the approval under your name.`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Approve', onPress: () => decide('Approve')},
    ]);
  }
  const state =
    a.state === PENDING ? 'Waiting for the CEO' : a.state === 'Approved' ? 'Approved' : a.state === 'Rejected' ? 'Rejected' : a.state;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="airplane" size={16} color={BRAND.accent} />
        <Text style={styles.title}>Air ticket for approval</Text>
        <Text style={[styles.badge, a.state === 'Approved' && styles.ok, a.state === 'Rejected' && styles.no]}>{state}</Text>
      </View>
      <Text style={styles.ref}>{a.name}</Text>
      {travelLines(a).map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
      {busy ? (
        <ActivityIndicator color={BRAND.accent} style={styles.busy} />
      ) : rejecting ? (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Reason (optional)"
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
          />
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.reject]} onPress={() => decide('Reject')}>
              <Text style={[styles.buttonText, styles.rejectText]}>Reject</Text>
            </Pressable>
            <Pressable style={styles.plain} onPress={() => setRejecting(false)}>
              <Text style={styles.plainText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        !!actions.length && (
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={approve} accessibilityLabel="Approve air ticket">
              <Text style={styles.buttonText}>Approve</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.reject]} onPress={() => setRejecting(true)} accessibilityLabel="Reject air ticket">
              <Text style={[styles.buttonText, styles.rejectText]}>Reject</Text>
            </Pressable>
          </View>
        )
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
    maxWidth: '90%',
    alignSelf: 'center',
    width: '90%',
  },
  head: {flexDirection: 'row', alignItems: 'center', gap: 6},
  title: {flex: 1, fontWeight: '700', color: BRAND.text, fontSize: 15},
  badge: {fontSize: 11, color: BRAND.sub, backgroundColor: BRAND.bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden'},
  ok: {color: '#067647', backgroundColor: '#dcfae6'},
  no: {color: BRAND.danger, backgroundColor: '#fee4e2'},
  ref: {color: BRAND.muted, fontSize: 12, marginTop: 2, marginBottom: 4},
  row: {flexDirection: 'row', gap: 8, marginTop: 4},
  label: {color: BRAND.muted, width: 84, fontSize: 13},
  value: {flex: 1, color: BRAND.text, fontSize: 13},
  actions: {flexDirection: 'row', gap: 8, marginTop: 10},
  button: {backgroundColor: BRAND.accent, borderRadius: 18, paddingHorizontal: 18, paddingVertical: 8},
  buttonText: {color: '#fff', fontWeight: '600'},
  reject: {backgroundColor: 'transparent', borderWidth: 1, borderColor: BRAND.danger},
  rejectText: {color: BRAND.danger},
  plain: {paddingHorizontal: 12, paddingVertical: 8},
  plainText: {color: BRAND.sub},
  input: {borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, padding: 8, marginTop: 10, minHeight: 60, color: BRAND.text},
  busy: {marginTop: 10, alignSelf: 'flex-start'},
});
