import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {AppState} from 'react-native';
import EventSource from 'react-native-sse';
import {relay, uploadFile} from './api';
import {uid} from './format';
import type {Call, Conversation, Limits, Message, Person} from './types';

type Thread = {
  list: Message[];
  more: boolean;
  newer: boolean;
  loading: boolean;
  loaded: boolean;
  stale?: boolean;
};
type Mode = 'latest' | 'older' | 'newer' | {around: string};
type CallListener = (call: Call) => void;

const DEFAULT_LIMITS: Limits = {
  body: 4000,
  fileBytes: 100 * 1048576,
  editMinutes: 15,
  deleteForAllHours: 48,
  translation: false,
  callsEnabled: false,
};

function createMessenger(me: string, bump: () => void) {
  const people = new Map<string, Person>();
  const convs = new Map<string, Conversation>();
  const threads = new Map<string, Thread>();
  const typing = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();
  const liveCalls = new Map<string, Call>();
  const hidden = new Set<string>();
  const callListeners = new Set<CallListener>();
  const state = {
    ready: false,
    error: '',
    me: null as Person | null,
    limits: DEFAULT_LIMITS,
    active: null as string | null,
    foreground: AppState.currentState === 'active',
    nearBottom: true,
  };
  let stream: EventSource<any> | null = null;
  let failures = 0;
  let poll: ReturnType<typeof setInterval> | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const thread = (id: string) => {
    if (!threads.has(id))
      threads.set(id, {
        list: [],
        more: false,
        newer: false,
        loading: false,
        loaded: false,
      });
    return threads.get(id)!;
  };
  function upsert(m: Message) {
    const th = thread(m.conversationId);
    const i = th.list.findIndex(
      x =>
        x.id === m.id ||
        (!!m.clientId && x.clientId === m.clientId && x.sender === m.sender),
    );
    if (i >= 0) {
      const next: Message = {
        ...th.list[i],
        ...m,
        pending: m.pending || false,
        failed: m.failed || false,
      };
      if (
        !('translation' in m) &&
        m.editedAt &&
        m.editedAt !== th.list[i].editedAt
      )
        delete next.translation;
      th.list[i] = next;
    } else {
      th.list.push(m);
      th.list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    }
  }
  function mergeConv(c: Conversation) {
    convs.set(c.id, {...convs.get(c.id), ...c});
  }
  function mergePeople(list?: Record<string, Person> | Person[]) {
    for (const p of Array.isArray(list) ? list : Object.values(list || {}))
      if (!people.has(p.user) || !people.get(p.user)!.employee)
        people.set(p.user, {...people.get(p.user), ...p});
  }

  // ---------- incoming ----------
  function onMessage(m: Message, fromSelf = false) {
    const c = convs.get(m.conversationId);
    if (!c) return refreshConv(m.conversationId);
    if (hidden.has(m.id)) return;
    const th = thread(m.conversationId);
    const known = th.list.some(x => x.id === m.id);
    const fresh =
      !known &&
      (!c.last ||
        (c.last.id !== m.id && new Date(m.createdAt) >= new Date(c.last.at)));
    // While older history is on screen, a new message waits for "jump to latest".
    if (known || !th.newer) upsert(m);
    if (
      !c.last ||
      new Date(m.createdAt) >= new Date(c.last.at) ||
      c.last.id === m.id
    )
      c.last = {
        id: m.id,
        sender: m.sender,
        kind: m.kind,
        body: m.body,
        file: m.file?.name,
        deleted: m.deleted,
        at: m.createdAt,
      };
    if (fresh && m.sender !== me && !m.deleted && m.kind !== 'system') {
      typing.get(c.id)?.delete(m.sender);
      const looking =
        state.active === c.id &&
        state.foreground &&
        state.nearBottom &&
        !th.newer;
      if (looking) markRead(c.id);
      else {
        c.unread = (c.unread || 0) + 1;
        delivered();
      }
      c.archived = false;
    }
    if (fromSelf && m.sender === me) c.archived = false;
    bump();
  }
  function onTyping({
    conversationId,
    user,
  }: {
    conversationId: string;
    user: string;
  }) {
    if (!convs.has(conversationId)) return;
    const map = typing.get(conversationId) || new Map();
    clearTimeout(map.get(user));
    map.set(
      user,
      setTimeout(() => {
        map.delete(user);
        bump();
      }, 5000),
    );
    typing.set(conversationId, map);
    bump();
  }
  function onRead({conversationId, user, readAt, deliveredAt}: any) {
    const c = convs.get(conversationId);
    if (!c) return;
    if (user === me) {
      if (new Date(readAt) >= new Date(c.last?.at || 0)) c.unread = 0;
    } else if (c.kind === 'direct') {
      c.othersReadAt = readAt;
      c.othersDeliveredAt = deliveredAt;
    } else return void refreshConv(conversationId);
    bump();
  }
  function onCall(call: Call) {
    if (call.endedAt) liveCalls.delete(call.conversationId);
    else liveCalls.set(call.conversationId, call);
    callListeners.forEach(fn => fn(call));
    bump();
  }
  async function refreshConv(id: string) {
    try {
      const {conversation} = await relay('conversations.get', {
        conversationId: id,
      });
      mergeConv(conversation);
      bump();
    } catch {
      /* the next refresh catches up */
    }
  }
  let deliveredTimer: ReturnType<typeof setTimeout> | null = null;
  function delivered() {
    if (deliveredTimer) return;
    deliveredTimer = setTimeout(() => {
      deliveredTimer = null;
      relay('messages.delivered').catch(() => {});
    }, 1500);
  }
  let readTimer: ReturnType<typeof setTimeout> | null = null;
  function markRead(id: string) {
    const c = convs.get(id);
    if (!c || !state.foreground || thread(id).newer) return;
    c.unread = 0;
    if (readTimer) clearTimeout(readTimer);
    readTimer = setTimeout(
      () => relay('messages.read', {conversationId: id}).catch(() => {}),
      400,
    );
    bump();
  }

  // ---------- live stream ----------
  async function connect() {
    if (closed || !state.foreground) return;
    stream?.close();
    stream = null;
    let url: string;
    try {
      url = (await relay<{url: string}>('stream.ticket')).url;
    } catch {
      return reconnectLater();
    }
    if (closed || !state.foreground) return;
    const source = new EventSource<
      | 'ready'
      | 'message'
      | 'typing'
      | 'read'
      | 'conversation'
      | 'call'
      | 'reconnect'
    >(url, {
      pollingInterval: 0, // tickets expire: reconnect with a fresh one instead
      timeoutBeforeConnection: 0,
    });
    stream = source;
    const data = (e: any) => {
      try {
        return JSON.parse(e.data || '{}');
      } catch {
        return {};
      }
    };
    source.addEventListener('ready', () => {
      failures = 0;
      stopPolling();
      resync();
    });
    source.addEventListener(
      'message',
      e => data(e).message && onMessage(data(e).message),
    );
    source.addEventListener('typing', e => onTyping(data(e)));
    source.addEventListener('read', e => onRead(data(e)));
    source.addEventListener('conversation', e =>
      refreshConv(data(e).conversationId),
    );
    source.addEventListener('call', e => data(e).call && onCall(data(e).call));
    const drop = () => {
      if (stream !== source) return;
      source.removeAllEventListeners();
      source.close();
      stream = null;
      reconnectLater();
    };
    source.addEventListener('reconnect', drop);
    source.addEventListener('error', drop);
    source.addEventListener('close', drop);
  }
  function reconnectLater() {
    failures += 1;
    if (failures >= 3) startPolling();
    if (retry) clearTimeout(retry);
    retry = setTimeout(
      connect,
      Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)),
    );
  }
  function startPolling() {
    if (!poll) poll = setInterval(resync, 5000);
  }
  function stopPolling() {
    if (poll) clearInterval(poll);
    poll = null;
  }
  async function resync() {
    try {
      const before = state.active ? convs.get(state.active)?.last?.id : null;
      const {conversations} = await relay<{conversations: Conversation[]}>(
        'conversations.list',
      );
      const seen = new Set<string>();
      for (const c of conversations) {
        seen.add(c.id);
        mergeConv(c);
      }
      for (const id of [...convs.keys()]) if (!seen.has(id)) convs.delete(id);
      for (const [id, th] of threads) if (id !== state.active) th.stale = true;
      if (state.active && convs.get(state.active)?.last?.id !== before)
        await loadMessages(state.active);
      if (state.limits.callsEnabled) {
        const {calls} = await relay<{calls: Call[]}>('calls.live');
        const now = new Set(calls.map(c => c.conversationId));
        for (const [conversationId, call] of [...liveCalls])
          if (!now.has(conversationId))
            onCall({...call, endedAt: new Date().toISOString()});
        calls.forEach(onCall);
      }
      bump();
    } catch {
      /* next tick */
    }
  }
  // In the background the stream closes, so the panel sends push notifications instead.
  const appState = AppState.addEventListener('change', next => {
    const foreground = next === 'active';
    if (foreground === state.foreground) return;
    state.foreground = foreground;
    if (foreground) {
      failures = 0;
      connect();
      delivered();
      if (state.active) markRead(state.active);
    } else {
      stream?.close();
      stream = null;
      stopPolling();
      if (retry) clearTimeout(retry);
    }
  });

  // ---------- actions ----------
  async function start() {
    try {
      const boot = await relay('bootstrap');
      state.me = boot.me;
      state.limits = {
        ...DEFAULT_LIMITS,
        ...boot.limits,
        translation: !!boot.translation,
        callsEnabled: !!boot.callsEnabled,
      };
      people.set(me, {...boot.me});
      for (const c of boot.conversations) mergeConv(c);
      for (const call of boot.calls || []) onCall(call);
      state.ready = true;
      state.error = '';
      bump();
    } catch (error: any) {
      state.error = error.message;
      bump();
      return;
    }
    loadDirectory();
    connect();
  }
  async function loadDirectory() {
    try {
      const {people: list} = await relay<{people: Person[]}>('directory');
      for (const p of list) people.set(p.user, p);
      bump();
    } catch {
      /* the list still works with the people already known */
    }
  }
  async function loadMessages(id: string, mode: Mode = 'latest') {
    const th = thread(id);
    if (th.loading) return false;
    th.loading = true;
    const settled = th.list.filter(m => !m.pending && !m.failed);
    const edge =
      mode === 'older'
        ? settled[0]
        : mode === 'newer'
        ? settled[settled.length - 1]
        : null;
    const cursor = edge && {
      at: edge.cursor || new Date(edge.createdAt).toISOString(),
      id: edge.id,
    };
    bump();
    try {
      const result = await relay('messages.list', {
        conversationId: id,
        ...(mode === 'older' && cursor ? {before: cursor} : {}),
        ...(mode === 'newer' && cursor ? {after: cursor} : {}),
        ...(typeof mode === 'object' ? {around: mode.around} : {}),
      });
      mergePeople(result.people);
      if (result.conversation) mergeConv(result.conversation);
      if (mode === 'older' || mode === 'newer') {
        result.messages.forEach(upsert);
        if (mode === 'older') th.more = result.more;
        else th.newer = result.newer;
      } else {
        const pending =
          mode === 'latest' ? th.list.filter(m => m.pending || m.failed) : [];
        th.list = result.messages;
        pending.forEach(upsert);
        th.more = result.more;
        th.newer = !!result.newer;
      }
      th.loaded = true;
      th.stale = false;
      return true;
    } catch (error: any) {
      state.error = error.message;
      return false;
    } finally {
      th.loading = false;
      bump();
    }
  }
  async function send(
    conversationId: string,
    body: string,
    replyTo?: Message | null,
    clientId = uid(),
  ) {
    const local: Message = {
      id: 'local-' + clientId,
      clientId,
      conversationId,
      sender: me,
      kind: 'text',
      body,
      createdAt: new Date().toISOString(),
      reply: replyTo
        ? {
            id: replyTo.id,
            sender: replyTo.sender,
            body: replyTo.body,
            file: replyTo.file?.name,
          }
        : null,
      reactions: [],
      pending: true,
    };
    upsert(local);
    bump();
    try {
      const {message} = await relay('messages.send', {
        conversationId,
        clientId,
        body,
        replyTo: replyTo?.id,
      });
      onMessage(message, true);
    } catch (error) {
      upsert({...local, pending: false, failed: true});
      bump();
      throw error;
    }
  }
  // The chat is fixed when the file is chosen; a failed upload keeps a retry.
  async function sendFile(
    conversationId: string,
    file: {uri: string; name: string; mime: string; size: number},
    voice = false,
    clientId = uid(),
  ) {
    if (file.size > state.limits.fileBytes)
      throw new Error(
        `${file.name} is larger than ${Math.floor(
          state.limits.fileBytes / 1048576,
        )} MB.`,
      );
    const kind: Message['kind'] = voice
      ? 'voice'
      : /^image\//.test(file.mime)
      ? 'image'
      : 'file';
    const local: Message = {
      id: 'local-' + clientId,
      clientId,
      conversationId,
      sender: me,
      kind,
      body: '',
      createdAt: new Date().toISOString(),
      file: {name: file.name, size: file.size, mime: file.mime},
      reactions: [],
      pending: true,
      upload: {...file, voice},
    };
    upsert(local);
    bump();
    try {
      const uploaded = await uploadFile(conversationId, file);
      const {message} = await relay('messages.send', {
        conversationId,
        clientId,
        body: '',
        fileId: uploaded.id,
        voice,
      });
      onMessage(message, true);
    } catch (error) {
      upsert({...local, pending: false, failed: true});
      bump();
      throw error;
    }
  }
  function retryMessage(m: Message) {
    if (m.upload)
      return sendFile(m.conversationId, m.upload, m.upload.voice, m.clientId);
    return send(m.conversationId, m.body, null, m.clientId);
  }
  async function edit(m: Message, body: string) {
    upsert({...m, body, editedAt: new Date().toISOString()});
    bump();
    try {
      await relay('messages.edit', {messageId: m.id, body});
    } catch (error) {
      loadMessages(m.conversationId);
      throw error;
    }
  }
  async function remove(m: Message, everyone: boolean) {
    await relay('messages.delete', {messageId: m.id, everyone});
    const th = thread(m.conversationId);
    if (everyone)
      upsert({...m, deleted: true, body: '', file: null, reactions: []});
    else {
      hidden.add(m.id);
      th.list = th.list.filter(x => x.id !== m.id);
    }
    bump();
  }
  async function react(m: Message, emoji: string) {
    const current = m.reactions.find(r => r.user === me)?.emoji;
    const next = current === emoji ? null : emoji;
    upsert({
      ...m,
      reactions: [
        ...m.reactions.filter(r => r.user !== me),
        ...(next ? [{user: me, emoji: next}] : []),
      ],
    });
    bump();
    try {
      await relay('messages.react', {messageId: m.id, emoji: next});
    } catch (error) {
      loadMessages(m.conversationId);
      throw error;
    }
  }
  async function translate(m: Message, lang: 'ar' | 'en' | null) {
    const {translation} = await relay('messages.translate', {
      messageId: m.id,
      lang,
    });
    const current = thread(m.conversationId).list.find(x => x.id === m.id);
    if (current) upsert({...current, translation});
    bump();
  }
  async function openDirect(user: string) {
    const existing = [...convs.values()].find(
      c => c.kind === 'direct' && c.peer === user,
    );
    if (existing) return existing.id;
    const {conversation} = await relay('conversations.direct', {user});
    mergeConv(conversation);
    bump();
    return conversation.id as string;
  }
  async function forward(
    m: Message,
    targets: {conversationId?: string; user?: string}[],
  ) {
    let sent = 0;
    for (const target of targets) {
      const conversationId =
        target.conversationId || (await openDirect(target.user!));
      const {message} = await relay('messages.send', {
        conversationId,
        clientId: uid(),
        forwardOf: m.id,
      });
      onMessage(message, true);
      sent++;
    }
    return sent;
  }
  async function createGroup(title: string, users: string[]) {
    const {conversation} = await relay('groups.create', {title, users});
    mergeConv(conversation);
    bump();
    return conversation.id as string;
  }
  async function groupAction(operation: string, data: Record<string, unknown>) {
    const result = await relay(operation, data);
    if (result?.conversation) mergeConv(result.conversation);
    bump();
    return result;
  }
  async function settings(id: string, change: Record<string, unknown>) {
    const {conversation} = await relay('conversations.settings', {
      conversationId: id,
      ...change,
    });
    mergeConv(conversation);
    if (change.clear) {
      threads.delete(id);
      await loadMessages(id);
    }
    bump();
  }
  let lastTyping = 0;
  function sendTyping(id: string) {
    if (Date.now() - lastTyping < 3000) return;
    lastTyping = Date.now();
    relay('typing', {conversationId: id}).catch(() => {});
  }
  async function refreshPresence(users: string[]) {
    try {
      const {lastSeen} = await relay('presence', {users});
      for (const [user, at] of Object.entries(lastSeen))
        if (people.has(user)) people.get(user)!.lastSeenAt = at as string;
      bump();
    } catch {
      /* best effort */
    }
  }
  function stop() {
    closed = true;
    stream?.close();
    stopPolling();
    if (retry) clearTimeout(retry);
    appState.remove();
    for (const map of typing.values())
      for (const timer of map.values()) clearTimeout(timer);
  }

  return {
    people,
    convs,
    threads,
    typing,
    liveCalls,
    state,
    thread,
    start,
    stop,
    resync,
    loadDirectory,
    loadMessages,
    send,
    sendFile,
    retryMessage,
    edit,
    remove,
    react,
    translate,
    forward,
    openDirect,
    createGroup,
    groupAction,
    settings,
    markRead,
    sendTyping,
    refreshPresence,
    setActive(id: string | null) {
      state.active = id;
      if (id) markRead(id);
    },
    setNearBottom(value: boolean) {
      state.nearBottom = value;
    },
    onCalls(fn: CallListener) {
      callListeners.add(fn);
      return () => {
        callListeners.delete(fn);
      };
    },
    onCall,
    me,
  };
}
export type Messenger = ReturnType<typeof createMessenger>;

const Context = createContext<{messenger: Messenger; version: number} | null>(
  null,
);

export function MessengerProvider({
  user,
  children,
}: {
  user: string;
  children: React.ReactNode;
}) {
  const [version, setVersion] = useState(0);
  const pending = useRef(false);
  // Many events can arrive at once; re-render once per frame.
  const bump = useCallback(() => {
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => {
      pending.current = false;
      setVersion(v => v + 1);
    });
  }, []);
  const messenger = useMemo(() => createMessenger(user, bump), [user, bump]);
  useEffect(() => {
    messenger.start();
    return () => messenger.stop();
  }, [messenger]);
  const value = useMemo(() => ({messenger, version}), [messenger, version]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useMessenger() {
  const value = useContext(Context);
  if (!value)
    throw new Error('useMessenger must be used inside MessengerProvider');
  return value;
}
export function totalUnread(m: Messenger) {
  let n = 0;
  for (const c of m.convs.values())
    if (!(c.mutedUntil && new Date(c.mutedUntil) > new Date()) && !c.archived)
      n += c.unread || 0;
  return n;
}
// The Chat tab's badge; 0 when Messenger isn't on (no chat access).
export function useUnread() {
  const value = useContext(Context);
  return value ? totalUnread(value.messenger) : 0;
}
