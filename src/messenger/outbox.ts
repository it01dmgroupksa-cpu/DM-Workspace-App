import AsyncStorage from '@react-native-async-storage/async-storage';
import RNBlobUtil from 'react-native-blob-util';
import type {Conversation, Message, Person} from './types';

// What survives on the phone between app starts, per employee:
// - the outgoing queue: every message sent but not yet accepted by the server
// - drafts, one per chat
// - a cache of the chat list and recent messages, so chats open offline
// The server stays the source of truth: the cache is replaced as soon as it answers.

export type OutItem = {
  clientId: string; // permanent: every retry uses it, and the server answers a repeat with the original message
  conversationId: string;
  createdAt: string;
  body: string;
  mentions?: string[];
  mentionAll?: boolean;
  replyTo?: {id: string; sender: string; body?: string; file?: string} | null;
  file?: {
    uri: string;
    name: string;
    mime: string;
    size: number;
    voice: boolean;
  };
  fileId?: string; // uploaded already: a retry only sends the message
  uploadId?: string; // a resumable upload in progress: a retry or restart continues it
  state: 'queued' | 'failed';
  error?: string;
  attempts: number;
};

const prefix = (user: string) => `messenger.${user}.`;
const OUTBOX = 'outbox';
const DRAFTS = 'drafts';
const CHATS = 'chats';
const THREAD = 'thread.';

// Writes to one key never overlap, so a slow write can't overwrite a newer one.
const chains = new Map<string, Promise<unknown>>();
function write(key: string, value: string | null) {
  const next = (chains.get(key) || Promise.resolve())
    .catch(() => {})
    .then(() =>
      value === null
        ? AsyncStorage.removeItem(key)
        : AsyncStorage.setItem(key, value),
    );
  chains.set(key, next);
  return next.catch(() =>
    console.warn('Messenger could not save to the phone.'),
  );
}
async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback; // unreadable (an older app version): start from the server
  }
}

export const loadOutbox = (user: string) =>
  read<OutItem[]>(prefix(user) + OUTBOX, []).then(list =>
    Array.isArray(list)
      ? list.filter(i => i?.clientId && i.conversationId)
      : [],
  );
export const saveOutbox = (user: string, items: OutItem[]) =>
  write(prefix(user) + OUTBOX, JSON.stringify(items));

export const loadDrafts = (user: string) =>
  read<Record<string, string>>(prefix(user) + DRAFTS, {});
export const saveDrafts = (user: string, drafts: Map<string, string>) =>
  write(prefix(user) + DRAFTS, JSON.stringify(Object.fromEntries(drafts)));

type Cached = {
  conversations: Conversation[];
  people: Person[];
  threads: string[];
};
export async function loadCache(user: string) {
  const chats = await read<Cached | null>(prefix(user) + CHATS, null);
  if (!chats?.conversations) return null;
  const threads = new Map<string, Message[]>();
  for (const id of chats.threads || []) {
    const list = await read<Message[]>(prefix(user) + THREAD + id, []);
    if (list.length) threads.set(id, list);
  }
  return {
    conversations: chats.conversations,
    people: chats.people || [],
    threads,
  };
}
// The 25 busiest chats keep their latest 40 messages; that's enough to read and reply
// offline without filling the phone.
export async function saveCache(
  user: string,
  conversations: Conversation[],
  people: Person[],
  threads: Map<string, Message[]>,
) {
  const recent = [...threads.keys()]
    .sort(
      (a, b) =>
        +new Date(conversations.find(c => c.id === b)?.last?.at || 0) -
        +new Date(conversations.find(c => c.id === a)?.last?.at || 0),
    )
    .slice(0, 25);
  await write(
    prefix(user) + CHATS,
    JSON.stringify({conversations, people, threads: recent}),
  );
  for (const id of recent)
    await write(
      prefix(user) + THREAD + id,
      JSON.stringify(
        threads
          .get(id)!
          .filter(m => !m.pending && !m.failed)
          .slice(-40),
      ),
    );
}
// Signing out of Messenger on purpose removes the employee's chats from the phone.
export async function wipe(user: string) {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(k =>
      k.startsWith(prefix(user)),
    );
    await AsyncStorage.multiRemove(keys);
  } catch {
    /* best effort */
  }
  await RNBlobUtil.fs.unlink(outboxDir()).catch(() => {});
}

// A picked file lives in a cache folder the phone may clear; queued files are copied
// to the app's own documents until they're sent.
const outboxDir = () => `${RNBlobUtil.fs.dirs.DocumentDir}/messenger-outbox`;
const plain = (uri: string) =>
  decodeURIComponent(uri.replace(/^file:\/\//, ''));
export async function keepFile(
  clientId: string,
  file: NonNullable<OutItem['file']>,
) {
  try {
    const dir = outboxDir();
    if (!(await RNBlobUtil.fs.isDir(dir))) await RNBlobUtil.fs.mkdir(dir);
    const target = `${dir}/${clientId}-${file.name
      .replace(/[^\w.\-]+/g, '_')
      .slice(-80)}`;
    await RNBlobUtil.fs.cp(plain(file.uri), target);
    return {...file, uri: 'file://' + target};
  } catch {
    return file; // send from where it is
  }
}
export function dropFile(item: OutItem) {
  if (item.file?.uri.includes('/messenger-outbox/'))
    RNBlobUtil.fs.unlink(plain(item.file.uri)).catch(() => {});
}

// Worth retrying by itself: no network, a timeout, the server busy or restarting.
// Not worth it: the server refused this message (too long, not a member, too big).
export function transient(error: any) {
  const status = Number(error?.status ?? 0);
  if (status === 0 || status === 408 || status === 429 || status >= 500)
    return true;
  return /unavailable|try again|timed out|no connection|network|connection/i.test(
    String(error?.message || ''),
  );
}
// Exponential backoff with jitter: 1, 2, 4… up to 60 seconds, each 50–100% of that,
// so phones coming back together don't all retry at the same moment.
export const backoff = (attempt: number) =>
  Math.min(60_000, 1000 * 2 ** Math.min(attempt, 6)) *
  (0.5 + Math.random() * 0.5);
