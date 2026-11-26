import React, {useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {BRAND} from '../config';
import {
  canChooseOption,
  chosenOption,
  decideTravel,
  decideTravelOption,
  optionView,
  PENDING,
  travelActions,
  travelLines,
  travelOptions,
  travelText,
  type TravelApproval,
} from '../travel';
import {deviceLang} from '../../twoFactor';
import type {Message} from '../types';

// An air ticket sent for the CEO's approval. Everyone in the chat sees the details and the
// state; only the approver gets the buttons, and only while it waits for him. With a
// shortlist he approves one option ("Approve this"); Reject is for the whole request. The
// card updates by itself when ERP saves the decision (the panel republishes the message).
// Wording follows the phone's language (English / Arabic).
export function TravelCard({m, isApprover}: {m: Message; isApprover: boolean}) {
  const a = m.approval as TravelApproval;
  const [lang] = useState(deviceLang);
  const t = travelText(lang);
  const ar = lang === 'ar';
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const options = travelOptions(a);
  const chosen = chosenOption(a);
  const choosing = canChooseOption(a, isApprover);
  const actions = travelActions(a, isApprover);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
      setRejecting(false);
    } catch (e: any) {
      Alert.alert(t.notDone, e.message || t.tryAgain);
    } finally {
      setBusy(false);
    }
  }
  const decide = (action: 'Approve' | 'Reject') => run(() => decideTravel(a.name, action, reason));
  function approve() {
    Alert.alert(t.confirmOne, t.confirmOneBody(a.name), [
      {text: t.cancel, style: 'cancel'},
      {text: t.approve, onPress: () => decide('Approve')},
    ]);
  }
  function approveOption(index: number) {
    const view = optionView(options[index], lang);
    Alert.alert(t.confirmTitle(index + 1), t.confirmBody(a.name, view.airline, view.amount), [
      {text: t.cancel, style: 'cancel'},
      {text: t.approve, onPress: () => run(() => decideTravelOption(a.name, index))},
    ]);
  }
  const state =
    a.state === PENDING ? t.waiting : a.state === 'Approved' ? t.approvedState : a.state === 'Rejected' ? t.rejectedState : a.state;
  const dir = ar ? styles.rtlText : null;
  return (
    <View style={[styles.card, ar ? styles.rtl : styles.ltr]}>
      <View style={styles.head}>
        <Ionicons name="airplane" size={16} color={BRAND.accent} />
        <Text style={[styles.title, dir]}>{t.title}</Text>
        <Text style={[styles.badge, a.state === 'Approved' && styles.ok, a.state === 'Rejected' && styles.no]}>{state}</Text>
      </View>
      <Text style={[styles.ref, dir]}>{a.name}</Text>
      {travelLines(a, lang).map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.label, dir]}>{label}</Text>
          <Text style={[styles.value, dir]}>{value}</Text>
        </View>
      ))}

      {options.map((o, i) => {
        const v = optionView(o, lang);
        const isChosen = chosen === i;
        const notChosen = chosen != null && !isChosen;
        return (
          <View key={i} style={[styles.option, isChosen && styles.optionChosen, notChosen && styles.optionOut]}>
            <View style={styles.head}>
              <Text style={[styles.optionTitle, dir]}>
                {t.option(i + 1)}
                {v.airline ? ` · ${v.airline}` : ''}
              </Text>
              {isChosen ? <Text style={[styles.badge, styles.ok]}>{t.chosen}</Text> : null}
              {notChosen ? <Text style={styles.badge}>{t.notChosen}</Text> : null}
            </View>
            {v.legs.map((leg, j) => (
              <Text key={j} style={[styles.leg, dir]}>
                {leg}
              </Text>
            ))}
            {v.price ? <Text style={[styles.price, dir]}>{v.price}</Text> : null}
            {choosing && !busy && !rejecting ? (
              <Pressable
                style={[styles.button, styles.optionButton]}
                onPress={() => approveOption(i)}
                accessibilityLabel={`${t.approveThis}: ${t.option(i + 1)}`}>
                <Text style={styles.buttonText}>{t.approveThis}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      {busy ? (
        <ActivityIndicator color={BRAND.accent} style={styles.busy} />
      ) : rejecting ? (
        <View>
          <TextInput
            style={[styles.input, dir]}
            placeholder={t.reasonPlaceholder}
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={1000}
          />
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.reject]} onPress={() => decide('Reject')}>
              <Text style={[styles.buttonText, styles.rejectText]}>{t.reject}</Text>
            </Pressable>
            <Pressable style={styles.plain} onPress={() => setRejecting(false)}>
              <Text style={styles.plainText}>{t.cancel}</Text>
            </Pressable>
          </View>
        </View>
      ) : options.length ? (
        // A shortlist: one Reject for the whole request, while options can still be chosen.
        choosing && (
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.reject]} onPress={() => setRejecting(true)} accessibilityLabel={t.reject}>
              <Text style={[styles.buttonText, styles.rejectText]}>{t.reject}</Text>
            </Pressable>
          </View>
        )
      ) : (
        !!actions.length && (
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={approve} accessibilityLabel={t.approve}>
              <Text style={styles.buttonText}>{t.approve}</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.reject]} onPress={() => setRejecting(true)} accessibilityLabel={t.reject}>
              <Text style={[styles.buttonText, styles.rejectText]}>{t.reject}</Text>
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
  ltr: {direction: 'ltr'},
  rtl: {direction: 'rtl'},
  rtlText: {writingDirection: 'rtl', textAlign: 'right'},
  head: {flexDirection: 'row', alignItems: 'center', gap: 6},
  title: {flex: 1, fontWeight: '700', color: BRAND.text, fontSize: 15},
  badge: {fontSize: 11, color: BRAND.sub, backgroundColor: BRAND.bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden'},
  ok: {color: '#067647', backgroundColor: '#dcfae6'},
  no: {color: BRAND.danger, backgroundColor: '#fee4e2'},
  ref: {color: BRAND.muted, fontSize: 12, marginTop: 2, marginBottom: 4},
  row: {flexDirection: 'row', gap: 8, marginTop: 4},
  label: {color: BRAND.muted, width: 84, fontSize: 13},
  value: {flex: 1, color: BRAND.text, fontSize: 13},
  option: {borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 10, marginTop: 10, gap: 3},
  optionChosen: {borderColor: '#067647', backgroundColor: '#f0fdf4'},
  optionOut: {opacity: 0.6},
  optionTitle: {flex: 1, fontWeight: '700', color: BRAND.text, fontSize: 14},
  leg: {color: BRAND.text, fontSize: 13},
  price: {color: BRAND.sub, fontSize: 13, fontWeight: '600'},
  optionButton: {alignSelf: 'flex-start', marginTop: 6},
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
