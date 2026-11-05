import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {AppState} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {ERP_ORIGIN} from './config';

// Messenger has its own ERP session, separate from the rest of the app (which asks for
// the password every time it opens). It is a Frappe "mobile" session: ERP keeps it for
// 30 days of inactivity, and this app signs it out 30 days after sign-in so everyone
// enters their password at least once a month. A password change or a disabled
// account ends it in ERP at once. The password itself is never stored.
//
// Requests send the session id in the body and never use the shared cookie jar
// (credentials: 'omit'), so signing in or out of the other tabs, even as someone
// else, can't change who Messenger is signed in as.
export const SESSION_DAYS = 30;
const KEY = 'messenger.session';
const LAST_USER = 'messenger.lastUser';
const STORE = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export type Session = {sid: string; user: string; signedInAt: number};
type Status = 'loading' | 'signedOut' | 'signedIn';

let current: Session | null = null;
let onEnded: ((notice: string) => void) | null = null;
// Each gets `wipe`: true when the employee signed out on purpose.
const beforeSignOut = new Set<(wipe: boolean) => Promise<void>>();

export const currentSession = () => current;
export const expired = (s: Session, now = Date.now()) =>
  now - s.signedInAt > SESSION_DAYS * 86_400_000 ||
  now < s.signedInAt - 86_400_000;
// Push unregistering and the like, while the session can still make requests.
export function onBeforeSignOut(fn: (wipe: boolean) => Promise<void>) {
  beforeSignOut.add(fn);
  return () => {
    beforeSignOut.delete(fn);
  };
}

export class ErpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
// One ERP API call, as the given session (or none, for login).
export async function erpCall<T = any>(
  method: string,
  body: Record<string, unknown>,
  sid?: string | null,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  let json: any = {};
  try {
    response = await fetch(`${ERP_ORIGIN}/api/method/${method}`, {
      method: 'POST',
      credentials: 'omit',
      headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify(sid ? {...body, sid} : body),
      signal: controller.signal,
    });
    json = await response.json().catch(() => ({}));
  } catch {
    throw new ErpError('No connection. Check your network.', 0);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok || json.exc || json.exc_type)
    throw new ErpError(errorText(json, response.status), response.status);
  return {message: json.message as T, response};
}
export function errorText(body: any, status: number) {
  let detail = '';
  try {
    detail =
      JSON.parse(JSON.parse(body._server_messages || '[]')[0] || '{}')
        .message || '';
  } catch {
    /* no readable message */
  }
  if (
    !detail &&
    body.message &&
    typeof body.message === 'string' &&
    status >= 400
  )
    detail = body.message;
  if (!detail && (status === 401 || status === 403))
    detail = 'Your Messenger sign-in ended. Sign in again.';
  return String(detail || body.exception || 'Messenger request failed')
    .replace(/<[^>]+>/g, '')
    .slice(0, 300);
}
// The session cookie Frappe sets on login: on both platforms the header is readable
// even though cookies are off for this request.
export function sidFrom(setCookie: string | null) {
  const found = [
    ...String(setCookie || '').matchAll(/(?:^|[\s,;])sid=([^;,\s]+)/g),
  ]
    .map(m => m[1])
    .filter(v => v && v !== 'Guest');
  return found[found.length - 1] || null;
}

// Signing in checks the password, who it is and that the chat module is allowed.
export async function signIn(
  username: string,
  password: string,
): Promise<Session> {
  let login;
  try {
    login = await erpCall('login', {
      usr: username.trim(),
      pwd: password,
      device: 'mobile',
    });
  } catch (error: any) {
    if (
      error.status === 401 ||
      /invalid login|incorrect password|not allowed/i.test(error.message)
    )
      throw new Error('Wrong username or password.');
    throw error;
  }
  const sid = sidFrom(login.response.headers.get('set-cookie'));
  if (!sid) throw new Error("ERP didn't start a session. Try again.");
  try {
    const {message: user} = await erpCall<string>(
      'frappe.auth.get_logged_user',
      {},
      sid,
    );
    const {message: flags} = await erpCall<any>(
      'frappe.client.get_value',
      {
        doctype: 'Employee',
        filters: {user_id: user},
        fieldname: ['custom_allow_app', 'custom_allow_chat_module'],
      },
      sid,
    );
    if (!flags?.custom_allow_app || !flags?.custom_allow_chat_module)
      throw new Error(
        "Messenger isn't turned on for your account. Ask HR to allow the chat module.",
      );
    return {sid, user, signedInAt: Date.now()};
  } catch (error) {
    erpCall('logout', {}, sid).catch(() => {});
    throw error;
  }
}

const Context = createContext<{
  status: Status;
  session: Session | null;
  notice: string;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: (notice?: string) => Promise<void>;
  lastUser: string;
} | null>(null);

export function ChatSessionProvider({children}: {children: React.ReactNode}) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState('');
  const [lastUser, setLastUser] = useState('');

  const apply = useCallback((next: Session | null, message = '') => {
    current = next;
    setSession(next);
    setStatus(next ? 'signedIn' : 'signedOut');
    setNotice(message);
  }, []);
  const signOut = useCallback(
    // No message: the employee chose to sign out, so their chats leave the phone.
    async (message = '', wipe = !message) => {
      const s = current;
      if (!s) return apply(null, message);
      for (const fn of [...beforeSignOut]) await fn(wipe).catch(() => {});
      current = null; // no more requests as this session
      await SecureStore.deleteItemAsync(KEY, STORE).catch(() => {});
      erpCall('logout', {}, s.sid).catch(() => {});
      apply(null, message);
    },
    [apply],
  );
  // A request found the session over (password changed, account disabled, expired).
  useEffect(() => {
    onEnded = message => {
      if (current) signOut(message);
    };
    return () => {
      onEnded = null;
    };
  }, [signOut]);

  // Monthly sign-out, checked on start, on returning to the app and every hour.
  const check = useCallback(() => {
    if (current && expired(current))
      signOut(
        `For security, Messenger asks for your password every ${SESSION_DAYS} days. Sign in again.`,
      );
  }, [signOut]);
  useEffect(() => {
    (async () => {
      setLastUser(
        (await AsyncStorage.getItem(LAST_USER).catch(() => null)) || '',
      );
      let saved: Session | null = null;
      try {
        const raw = await SecureStore.getItemAsync(KEY, STORE);
        saved = raw ? JSON.parse(raw) : null;
      } catch {
        saved = null;
      }
      if (!saved?.sid || !saved.user || !saved.signedInAt) return apply(null);
      apply(saved);
      check();
      // Chat access can be withdrawn in ERP; recheck quietly on each start.
      if (current)
        erpCall<any>(
          'frappe.client.get_value',
          {
            doctype: 'Employee',
            filters: {user_id: saved.user},
            fieldname: ['custom_allow_app', 'custom_allow_chat_module'],
          },
          saved.sid,
        )
          .then(({message: flags}) => {
            if (!flags?.custom_allow_app || !flags?.custom_allow_chat_module)
              signOut("Messenger isn't turned on for your account anymore.");
          })
          .catch((error: ErpError) => {
            if (error.status === 401 || error.status === 403)
              signOut('Your Messenger sign-in ended. Sign in again.');
          });
    })();
    const sub = AppState.addEventListener(
      'change',
      state => state === 'active' && check(),
    );
    const timer = setInterval(check, 3_600_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSignIn = useCallback(
    async (username: string, password: string) => {
      const next = await signIn(username, password);
      if (current && current.sid !== next.sid) await signOut();
      await SecureStore.setItemAsync(KEY, JSON.stringify(next), STORE);
      await AsyncStorage.setItem(LAST_USER, username.trim()).catch(() => {});
      setLastUser(username.trim());
      apply(next);
    },
    [apply, signOut],
  );

  return (
    <Context.Provider
      value={{status, session, notice, signIn: doSignIn, signOut, lastUser}}>
      {children}
    </Context.Provider>
  );
}
export function useChatSession() {
  const value = useContext(Context);
  if (!value)
    throw new Error('useChatSession must be used inside ChatSessionProvider');
  return value;
}
// Called by the relay when ERP says the session is no longer valid.
export function sessionEnded(message: string) {
  onEnded?.(message);
}
