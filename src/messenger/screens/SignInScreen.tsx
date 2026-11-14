import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useNavigation} from '@react-navigation/native';
import {BRAND} from '../config';
import {SESSION_DAYS, useChatSession} from '../session';
import {
  forgetCredentials,
  loadCredentials,
  offerBiometric,
  useBiometric,
} from '../../biometric';

// Messenger's own sign-in, with the same ERP username and password as the app. It stays
// signed in for SESSION_DAYS, unlike the other tabs.
export function SignInScreen({standalone}: {standalone?: boolean}) {
  const {signIn, notice, lastUser} = useChatSession();
  const navigation = useNavigation();
  const [username, setUsername] = useState(lastUser);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const biometric = useBiometric();
  useEffect(() => {
    if (lastUser) setUsername(u => u || lastUser);
  }, [lastUser]);

  // viaBiometric: the username and password came from Face ID, not the fields.
  async function submit(
    user = username,
    pass = password,
    viaBiometric = false,
  ) {
    if (!user.trim() || !pass)
      return setError('Enter your username and password.');
    setBusy(true);
    setError('');
    try {
      await signIn(user, pass);
      if (!viaBiometric) offerBiometric(user.trim(), pass);
    } catch (e: any) {
      if (viaBiometric && e.message === 'Wrong username or password.') {
        // The password was changed since Face ID saved it.
        await forgetCredentials();
        biometric.refresh();
        setError(
          `Your password has changed since you turned on ${biometric.label}. Sign in with your new password to turn it on again.`,
        );
      } else setError(e.message || 'Sign-in failed. Try again.');
      setBusy(false);
    }
  }

  async function submitWithBiometric() {
    const saved = await loadCredentials();
    if (!saved) return; // cancelled
    setUsername(saved.username);
    submit(saved.username, saved.password, true);
  }
  return (
    <SafeAreaView
      style={styles.root}
      edges={['top', 'left', 'right', 'bottom']}>
      {standalone && navigation.canGoBack() ? (
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </Pressable>
      ) : null}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled">
          <View style={styles.icon}>
            <Ionicons name="chatbubbles" size={40} color="#fff" />
          </View>
          <Text style={styles.title}>Messenger</Text>
          <Text style={styles.sub}>
            Sign in with your ERP username and password. Messenger stays signed
            in for {SESSION_DAYS} days, even when you sign out of the other
            tabs.
          </Text>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username or email"
            placeholderTextColor={BRAND.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
          />
          <View style={styles.passRow}>
            <TextInput
              style={[styles.input, styles.flex, styles.noMargin]}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={BRAND.muted}
              secureTextEntry={!show}
              textContentType="password"
              onSubmitEditing={() => submit()}
              returnKeyType="go"
            />
            <Pressable
              onPress={() => setShow(!show)}
              style={styles.eye}
              accessibilityLabel={show ? 'Hide password' : 'Show password'}>
              <Ionicons
                name={show ? 'eye-off' : 'eye'}
                size={22}
                color={BRAND.sub}
              />
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.button, busy && styles.busy]}
            onPress={() => submit()}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in to Messenger</Text>
            )}
          </Pressable>
          {biometric.label && biometric.user ? (
            <Pressable
              style={[styles.bioButton, busy && styles.busy]}
              onPress={submitWithBiometric}
              disabled={busy}
              accessibilityLabel={`Sign in with ${biometric.label}`}>
              <Text style={styles.bioText}>Sign in with {biometric.label}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: BRAND.navy},
  flex: {flex: 1},
  back: {padding: 12, alignSelf: 'flex-start'},
  body: {flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12},
  icon: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: BRAND.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center'},
  sub: {color: '#c7d2e0', textAlign: 'center', lineHeight: 20, marginBottom: 8},
  notice: {
    color: '#fde68a',
    textAlign: 'center',
    backgroundColor: 'rgba(253,230,138,0.12)',
    padding: 10,
    borderRadius: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: BRAND.text,
  },
  noMargin: {margin: 0},
  passRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  eye: {padding: 12},
  error: {color: '#fecaca', textAlign: 'center'},
  button: {
    backgroundColor: BRAND.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  busy: {opacity: 0.7},
  bioButton: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  bioText: {color: '#fff', fontSize: 16, fontWeight: '600'},
  buttonText: {color: '#fff', fontSize: 16, fontWeight: '700'},
});
