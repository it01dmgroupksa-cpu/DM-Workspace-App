import {useCallback, useEffect, useState} from 'react';
import {Alert, AppState, Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Face ID / Touch ID / fingerprint sign-in for the workspace and Messenger: both use the
// same ERP username and password. After a password sign-in the person is offered it; the
// password is then kept in the keychain (Android: keystore) behind the biometric check,
// so reading it is what shows the Face ID prompt. An app built before this (an update
// reached an older install) has no native side: then it's simply not offered.
type LocalAuth = typeof import('expo-local-authentication');
let localAuth: LocalAuth | null = null;
try {
  localAuth = require('expo-local-authentication');
} catch {
  localAuth = null;
}

const KEY = 'biometric.credentials';
// Who is saved (not secret), so the button shows without a Face ID prompt.
const USER = 'biometric.user';
// Who said "Not now", so they aren't asked after every sign-in.
const DECLINED = 'biometric.declined';

const secure = (prompt: string): SecureStore.SecureStoreOptions => ({
  requireAuthentication: true,
  authenticationPrompt: prompt,
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
});

export type Credentials = {username: string; password: string};

// "Face ID", "Touch ID", "Fingerprint"…, or null when the phone can't or isn't set up.
export async function biometricLabel(): Promise<string | null> {
  const la = localAuth;
  if (!la) return null;
  try {
    if (!(await la.hasHardwareAsync()) || !(await la.isEnrolledAsync()))
      return null;
    const types = await la.supportedAuthenticationTypesAsync();
    const ios = Platform.OS === 'ios';
    if (types.includes(la.AuthenticationType.FACIAL_RECOGNITION))
      return ios ? 'Face ID' : 'Face unlock';
    if (types.includes(la.AuthenticationType.FINGERPRINT))
      return ios ? 'Touch ID' : 'Fingerprint';
    return null;
  } catch {
    return null;
  }
}

// The label and saved username for a sign-in screen; checked again on return to the app
// (Face ID may have been turned off in Settings meanwhile).
export function useBiometric() {
  const [label, setLabel] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const found = await biometricLabel();
    setLabel(found);
    setUser(found ? await AsyncStorage.getItem(USER).catch(() => null) : null);
  }, []);
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  return {label, user, refresh};
}

// Shows the Face ID prompt and returns the saved username and password; null when the
// person cancels or Face ID changed since (the keychain then drops the item).
export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await SecureStore.getItemAsync(
      KEY,
      secure('Sign in to DM Workspace'),
    );
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function forgetCredentials() {
  await SecureStore.deleteItemAsync(KEY).catch(() => {});
  await AsyncStorage.multiRemove([USER, DECLINED]).catch(() => {});
}

async function save(credentials: Credentials, prompt: string) {
  await SecureStore.setItemAsync(
    KEY,
    JSON.stringify(credentials),
    secure(prompt),
  );
  await AsyncStorage.setItem(USER, credentials.username);
}

// After a password sign-in: offer Face ID once per person; if it's already on for this
// person, keep the saved password current (it may have just been changed).
export async function offerBiometric(username: string, password: string) {
  const label = await biometricLabel();
  if (!label) return;
  const [[, saved], [, declined]] = await AsyncStorage.multiGet([
    USER,
    DECLINED,
  ]).catch(() => [
    [USER, null],
    [DECLINED, null],
  ]);
  if (saved === username)
    return save({username, password}, `Update ${label} sign-in`).catch(
      () => {},
    );
  if (declined === username) return;
  Alert.alert(
    `Use ${label} to sign in?`,
    `Next time, sign in to DM Workspace and Messenger with ${label} instead of typing your password.`,
    [
      {
        text: 'Not now',
        style: 'cancel',
        onPress: () => {
          AsyncStorage.setItem(DECLINED, username).catch(() => {});
        },
      },
      {
        text: `Use ${label}`,
        onPress: () => {
          save({username, password}, `Turn on ${label}`).catch(() => {});
        },
      },
    ],
  );
}
