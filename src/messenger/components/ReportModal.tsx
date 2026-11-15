import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {BRAND} from '../config';
import {REPORT_REASONS, sendReport} from '../blocks';
import type {Message} from '../types';

export type ReportTarget = {
  user: string;
  name: string;
  conversationId?: string;
  // Reporting one message; without it the person is reported.
  message?: Message;
};

// Report a message or a person to HR, with a reason. Afterwards it offers to block them.
export function ReportModal({
  target,
  blocked,
  onBlock,
  onClose,
}: {
  target: ReportTarget | null;
  blocked: boolean;
  onBlock: (user: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setReason(null);
    setDetails('');
    setBusy(false);
  }, [target]);
  if (!target) return null;
  const m = target.message;

  async function submit() {
    if (!target || !reason) return;
    setBusy(true);
    try {
      await sendReport({
        type: m ? 'Message' : 'User',
        reportedUser: target.user,
        conversationId: target.conversationId,
        messageId: m?.id,
        messageText: m ? m.body || m.file?.name || `[${m.kind}]` : undefined,
        reason,
        details: details.trim(),
      });
    } catch (error: any) {
      setBusy(false);
      return Alert.alert(
        'Report',
        error?.message || "The report couldn't be sent. Try again.",
      );
    }
    const {user, name} = target;
    onClose();
    Alert.alert(
      'Thanks for reporting',
      'HR reviews every report within 24 hours and takes action, which can include removing the content and the person’s access.',
      blocked
        ? [{text: 'OK'}]
        : [
            {text: 'Done', style: 'cancel'},
            {
              text: `Block ${name}`,
              style: 'destructive',
              onPress: () =>
                onBlock(user).catch(error =>
                  Alert.alert('Block', error.message),
                ),
            },
          ],
    );
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => !busy && onClose()}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <View style={styles.card}>
          <Text style={styles.title}>
            {m ? 'Report message' : `Report ${target.name}`}
          </Text>
          <Text style={styles.sub}>
            {m
              ? `The message from ${target.name} is sent to HR with your report. ${target.name} isn't told who reported it.`
              : `HR reviews your report. ${target.name} isn't told who reported them.`}
          </Text>
          <ScrollView style={{maxHeight: 300}} keyboardShouldPersistTaps="handled">
            {REPORT_REASONS.map(r => (
              <Pressable
                key={r}
                style={styles.reason}
                onPress={() => setReason(r)}
                accessibilityRole="radio"
                accessibilityState={{checked: reason === r}}>
                <Ionicons
                  name={reason === r ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={reason === r ? BRAND.accent : BRAND.muted}
                />
                <Text style={styles.reasonText}>{r}</Text>
              </Pressable>
            ))}
            <TextInput
              style={styles.details}
              value={details}
              onChangeText={setDetails}
              placeholder="Add details (optional)"
              placeholderTextColor={BRAND.muted}
              multiline
              maxLength={1000}
            />
          </ScrollView>
          <View style={styles.buttons}>
            <Pressable
              style={styles.button}
              onPress={onClose}
              disabled={busy}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.send, !reason && {opacity: 0.4}]}
              onPress={submit}
              disabled={!reason || busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.sendText}>Report</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 8},
  title: {fontSize: 18, fontWeight: '700', color: BRAND.text},
  sub: {fontSize: 13.5, color: BRAND.sub, lineHeight: 19, marginBottom: 4},
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
  },
  reasonText: {fontSize: 15.5, color: BRAND.text},
  details: {
    borderWidth: 1,
    borderColor: BRAND.line,
    borderRadius: 10,
    padding: 10,
    minHeight: 70,
    fontSize: 15,
    color: BRAND.text,
    textAlignVertical: 'top',
    marginTop: 6,
  },
  buttons: {flexDirection: 'row', justifyContent: 'flex-end', gap: 10},
  button: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  cancel: {color: BRAND.sub, fontSize: 15.5, fontWeight: '600'},
  send: {backgroundColor: BRAND.danger},
  sendText: {color: '#fff', fontSize: 15.5, fontWeight: '700'},
});
