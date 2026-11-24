import React, {useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  OtpError,
  OTP_TEXT,
  TwoFactor,
  deviceLang,
  otpErrorText,
  secondsLeft,
} from '../twoFactor';

// The second sign-in step: the 6-digit code from the authenticator app. Used by the
// workspace sign-in (light) and Messenger's (dark). It never retries a code by itself:
// each wrong code counts against ERP's sign-in limits.
type Props = {
  challenge: TwoFactor;
  theme: 'light' | 'dark';
  // Resolves when signed in; rejects with an OtpError.
  onSubmit: (code: string) => Promise<void>;
  // Back to the password screen; `message` is shown there (the code step expired).
  onBack: (message?: string) => void;
};

const THEMES = {
  light: {
    title: '#103BA9',
    text: '#444',
    sub: '#777',
    field: '#F5F5F5',
    fieldText: '#000',
    button: '#103BA9',
    error: '#b91c1c',
    notice: '#92400e',
    noticeBg: '#fef3c7',
    link: '#103BA9',
  },
  dark: {
    title: '#fff',
    text: '#e2e8f0',
    sub: '#c7d2e0',
    field: '#fff',
    fieldText: '#111b21',
    button: '#0f766e',
    error: '#fecaca',
    notice: '#fde68a',
    noticeBg: 'rgba(253,230,138,0.12)',
    link: '#fff',
  },
};

export default function OtpPrompt({challenge, theme, onSubmit, onBack}: Props) {
  const [lang, setLang] = useState(deviceLang);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(secondsLeft);
  const sending = useRef(false);
  const t = OTP_TEXT[lang];
  const c = THEMES[theme];
  const ar = lang === 'ar';
  const textDir = ar ? styles.rtlText : null;

  useEffect(() => {
    const timer = setInterval(() => setLeft(secondsLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function submit(value: string) {
    if (value.length !== 6 || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await onSubmit(value);
    } catch (e) {
      if (e instanceof OtpError && e.kind === 'expired') {
        onBack(OTP_TEXT[lang].expired);
        return;
      }
      setCode(''); // a used or wrong code is never sent again
      setError(otpErrorText(e, lang));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  // Typing, pasting ("123 456") or autofill: digits only, submitted once at 6.
  function change(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (error) setError('');
    if (digits.length === 6) submit(digits);
  }

  return (
    <View style={[styles.root, ar ? styles.rtl : styles.ltr]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => onBack()}
          disabled={busy}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t.back}>
          <Text style={[styles.link, {color: c.link}]}>
            {ar ? `${t.back} →` : `← ${t.back}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setLang(ar ? 'en' : 'ar')}
          hitSlop={10}
          accessibilityRole="button">
          <Text style={[styles.link, {color: c.link}]}>{t.otherLang}</Text>
        </Pressable>
      </View>

      <Text style={[styles.title, {color: c.title}, textDir]}>{t.title}</Text>

      {!challenge.setup ? (
        <View style={[styles.notice, {backgroundColor: c.noticeBg}]}>
          <Text style={[styles.noticeTitle, {color: c.notice}, textDir]}>
            {t.setupTitle}
          </Text>
          <Text style={[styles.noticeText, {color: c.notice}, textDir]}>
            {t.setupDetail}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.enter, {color: c.text}, textDir]}>
        {challenge.method === 'OTP App' || !challenge.prompt
          ? t.enter
          : challenge.prompt}
      </Text>

      <TextInput
        style={[styles.field, {backgroundColor: c.field, color: c.fieldText}]}
        value={code}
        onChangeText={change}
        placeholder={t.placeholder}
        placeholderTextColor="#9AA3AE"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={12 /* room for a pasted "123 456"; trimmed to 6 digits */}
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        importantForAutofill="yes"
        autoFocus
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={() => submit(code)}
        accessibilityLabel={t.enter}
      />

      <Text style={[styles.countdown, {color: c.sub}, textDir]}>
        {t.countdown(left)}
      </Text>

      {error ? (
        <Text
          style={[styles.error, {color: c.error}, textDir]}
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Pressable
        style={[
          styles.button,
          {backgroundColor: c.button},
          (busy || code.length !== 6) && styles.dim,
        ]}
        onPress={() => submit(code)}
        disabled={busy || code.length !== 6}
        accessibilityRole="button">
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t.verify}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {width: '100%', gap: 14},
  ltr: {direction: 'ltr'},
  rtl: {direction: 'rtl'},
  rtlText: {writingDirection: 'rtl'},
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {fontSize: 15, fontWeight: '600'},
  title: {fontSize: 24, fontWeight: '700', textAlign: 'center'},
  notice: {borderRadius: 10, padding: 12, gap: 6},
  noticeTitle: {fontWeight: '700', textAlign: 'center'},
  noticeText: {textAlign: 'center', lineHeight: 20},
  enter: {fontSize: 16, textAlign: 'center', lineHeight: 22},
  field: {
    height: 58,
    borderRadius: 10,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: 'center',
    writingDirection: 'ltr', // digits read left to right in Arabic too
  },
  countdown: {fontSize: 13, textAlign: 'center'},
  error: {textAlign: 'center', fontSize: 15, fontWeight: '600'},
  button: {
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  dim: {opacity: 0.6},
  buttonText: {color: '#fff', fontSize: 18, fontWeight: 'bold'},
});
