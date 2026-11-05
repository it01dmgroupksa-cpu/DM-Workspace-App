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
import NetInfo from '@react-native-community/netinfo';
import {relay, uploadFile, withStatus} from './api';
import {uid} from './format';
import {
  backoff,
  dropFile,
  keepFile,
  loadCache,
  loadDrafts,
  loadOutbox,
  saveCache,
  saveDrafts,
  saveOutbox,
  transient,
  wipe,
  type OutItem,
} from './outbox';
import {onBeforeSignOut} from './session';
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

// What the connection bar shows. "online" only once the panel's live stream answered,
// never just because the phone has a network.
export type Connection = 'offline' | 'connecting' | 'online';

export function createMessenger(me: string, render: () => void) {
  const people = new Map<string, Person>();
  const convs = new Map<string, Conversation>();
  const threads = new Map<string, Thread>();
  const typing = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();
  const liveCalls = new Map<string, Call>();
  const hidden = new Set<string>();
  const callListeners = new Set<CallListener>();
  const callEvents = new Map<string, number>(); // call id -> when its last live event came
  const state = {
    ready: false,
    error: '',
    me: null as Person | null,
    limits: DEFAULT_LIMITS,
    active: null as string | null,
    foreground: AppState.currentState === 'active',
    nearBottom: true,
    connection: 'connecting' as Connection,
    syncing: false,
    // Showing the phone's saved copy; the server hasn't answered yet.
    cached: false,
    // The live connection dropped; the next catch-up shows "Syncing messages".
    recovering: false,
  };
  // Every change re-renders and, a moment later, saves the chats to the phone.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function bump() {
    render();
    if (!saveTimer && state.ready)
      saveTimer = setTimeout(() => {
        saveTimer = null;
        if (closed) return;
        const lists = new Map<string, Message[]>();
        for (const [id, th] of threads)
          if (th.loaded && !th.newer) lists.set(id, th.list);
        const known = new Set<string>([me]);
        for (const c of convs.values()) {
          if (c.peer) known.add(c.peer);
          if (c.last) known.add(c.last.sender);
        }
        for (const list of lists.values())
          for (const m of list) known.add(m.sender);
        saveCache(
          me,
          [...convs.values()],
          [...known].map(u => people.get(u)).filter(Boolean) as Person[],
          lists,
        );
      }, 2500);
  }
  // ---------- outgoing queue ----------
  let outbox: OutItem[] = [];
  let sendingNow = false;
  let outboxTimer: ReturnType<typeof setTimeout> | null = null;
  const progress = new Map<string, number>(); // clientId -> 0..1 while uploading
  const cancels = new Map<string, () => void>();
  const drafts = new Map<string, string>();
  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  let network = true;
  let streamUp = false;
  function setConnection() {
    const next: Connection = !network
      ? 'offline'
      : streamUp
      ? 'online'
      : 'connecting';
    if (next !== state.connection) {
      state.connection = next;
      render();
    }
  }
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
      streamUp = true;
      setConnection();
      stopPolling();
      resync();
      kick(true); // the server is reachable: send what's waiting
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
    source.addEventListener('call', e => {
      const call = data(e).call;
      if (!call) return;
      callEvents.set(call.id, Date.now());
      onCall(call);
    });
    const drop = () => {
      if (stream !== source) return;
      source.removeAllEventListeners();
      source.close();
      stream = null;
      streamUp = false;
      state.recovering = true;
      setConnection();
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
    // With jitter, so many phones coming back at once don't reconnect in lockstep.
    retry = setTimeout(
      connect,
      Math.min(30_000, 1000 * 2 ** Math.min(failures, 5)) *
        (0.5 + Math.random() * 0.5),
    );
  }
  function startPolling() {
    if (!poll) poll = setInterval(resync, 5000);
  }
  function stopPolling() {
    if (poll) clearInterval(poll);
    poll = null;
  }
  let resyncing: Promise<void> | null = null;
  function resync() {
    // One catch-up at a time; a second request joins the one running.
    if (!resyncing)
      resyncing = catchUp().finally(() => {
        resyncing = null;
        state.syncing = false;
        state.recovering = false;
        bump();
      });
    return resyncing;
  }
  async function catchUp() {
    state.syncing = true;
    render();
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
        const asked = Date.now();
        const {calls} = await relay<{calls: Call[]}>('calls.live');
        // Live events that arrived while this was on its way are newer: keep them.
        const newer = (id: string) => (callEvents.get(id) || 0) >= asked;
        const now = new Set(calls.map(c => c.conversationId));
        for (const [conversationId, call] of [...liveCalls])
          if (!now.has(conversationId) && !newer(call.id))
            onCall({...call, endedAt: new Date().toISOString()});
        calls.filter(c => !newer(c.id)).forEach(onCall);
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
      streamUp = false;
      setConnection();
      stopPolling();
      if (retry) clearTimeout(retry);
    }
  });
  // The phone's network went away or came back (Wi-Fi to mobile data, airplane mode).
  const netinfo = NetInfo.addEventListener(info => {
    const up = info.isConnected !== false && info.isInternetReachable !== false;
    if (up === network) return;
    network = up;
    setConnection();
    if (up && state.foreground) {
      failures = 0;
      if (!state.ready || state.cached) start();
      else if (!stream) connect();
      kick(true);
    }
  });
  // Now and then, compare everything with the server in case an event was missed.
  const reconcile = setInterval(() => {
    if (state.foreground && streamUp) resync();
  }, 5 * 60_000);

  // ---------- actions ----------
  let restored = false;
  let bootTry = 0;
  let booting = false;
  let bootTimer: ReturnType<typeof setTimeout> | null = null;
  async function restore() {
    if (restored) return;
    restored = true;
    const [cache, saved, queued] = await Promise.all([
      loadCache(me),
      loadDrafts(me),
      loadOutbox(me),
    ]);
    if (closed) return;
    for (const [id, text] of Object.entries(saved))
      if (text) drafts.set(id, text);
    if (cache && !state.ready) {
      for (const p of cache.people)
        if (!people.has(p.user)) people.set(p.user, p);
      for (const c of cache.conversations) mergeConv(c);
      for (const [id, list] of cache.threads) {
        const th = thread(id);
        if (!th.loaded) {
          th.list = list;
          th.loaded = true;
          th.stale = true;
          th.more = true;
        }
      }
      state.cached = true;
      state.ready = true;
    }
    outbox = queued;
    for (const item of outbox) upsert(localOf(item));
    render();
  }
  async function start() {
    if (booting) return;
    booting = true;
    if (bootTimer) clearTimeout(bootTimer);
    try {
      await boot();
    } finally {
      booting = false;
    }
  }
  async function boot() {
    await restore();
    if (closed) return;
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
      const seen = new Set<string>();
      for (const c of boot.conversations) {
        seen.add(c.id);
        mergeConv(c);
      }
      // Chats the phone remembered that are gone (left, removed) leave the list.
      for (const id of [...convs.keys()]) if (!seen.has(id)) convs.delete(id);
      for (const [id, th] of threads) if (id !== state.active) th.stale = true;
      if (state.active) loadMessages(state.active);
      for (const call of boot.calls || []) onCall(call);
      state.ready = true;
      state.cached = false;
      state.error = '';
      bootTry = 0;
      bump();
    } catch (error: any) {
      state.error = error.message;
      bump();
      // Keep trying by itself; the saved chats stay on screen meanwhile.
      if (!closed && transient(error))
        bootTimer = setTimeout(start, backoff(bootTry++));
      return;
    }
    loadDirectory();
    connect();
    kick(true);
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
  // Sending: the message shows at once and is saved in the outgoing queue before any
  // network attempt. The queue sends in order, one at a time, with the same clientId on
  // every attempt; the server answers a repeat with the original message, so a lost
  // reply never makes a duplicate. Only a refusal from the server marks it failed.
  function localOf(item: OutItem): Message {
    const f = item.file;
    return {
      id: 'local-' + item.clientId,
      clientId: item.clientId,
      conversationId: item.conversationId,
      sender: me,
      kind: f
        ? f.voice
          ? 'voice'
          : /^image\//.test(f.mime)
          ? 'image'
          : 'file'
        : 'text',
      body: item.body,
      createdAt: item.createdAt,
      reply: item.replyTo || null,
      file: f ? {name: f.name, size: f.size, mime: f.mime} : null,
      reactions: [],
      pending: item.state === 'queued',
      failed: item.state === 'failed',
      error: item.error,
      upload: f ? {...f} : undefined,
    };
  }
  const saveQueue = () => saveOutbox(me, outbox);
  function enqueue(item: OutItem) {
    outbox.push(item);
    saveQueue();
    upsert(localOf(item));
    bump();
    kick(true);
  }
  function kick(now = false) {
    if (now && outboxTimer) {
      clearTimeout(outboxTimer);
      outboxTimer = null;
    }
    if (!outboxTimer && !sendingNow) processQueue();
  }
  async function processQueue() {
    if (sendingNow || closed) return;
    sendingNow = true;
    try {
      for (;;) {
        const item = outbox.find(i => i.state === 'queued');
        if (!item || closed) return;
        try {
          const message = await deliver(item);
          outbox = outbox.filter(i => i.clientId !== item.clientId);
          saveQueue();
          dropFile(item);
          progress.delete(item.clientId);
          onMessage(message, true);
        } catch (error: any) {
          progress.delete(item.clientId);
          if (!outbox.includes(item)) continue; // cancelled meanwhile
          if (transient(error)) {
            item.attempts += 1;
            saveQueue();
            bump();
            // Wait, then try again; reconnecting or reopening the app retries sooner.
            outboxTimer = setTimeout(() => {
              outboxTimer = null;
              kick();
            }, backoff(item.attempts));
            return;
          }
          item.state = 'failed';
          item.error = error.message;
          saveQueue();
          upsert(localOf(item));
          bump();
        }
      }
    } finally {
      sendingNow = false;
    }
  }
  async function deliver(item: OutItem): Promise<Message> {
    if (item.file && !item.fileId) {
      progress.set(item.clientId, 0);
      bump();
      let last = 0;
      const uploaded = await uploadFile(
        item.conversationId,
        item.file,
        fraction => {
          progress.set(item.clientId, fraction);
          if (fraction - last >= 0.05 || fraction === 1) {
            last = fraction;
            render();
          }
        },
        cancel => cancels.set(item.clientId, cancel),
      ).finally(() => cancels.delete(item.clientId));
      item.fileId = uploaded.id; // a later retry only sends the message
      saveQueue();
    }
    const {message} = await relay('messages.send', {
      conversationId: item.conversationId,
      clientId: item.clientId,
      body: item.body,
      ...(item.replyTo ? {replyTo: item.replyTo.id} : {}),
      ...(item.fileId ? {fileId: item.fileId, voice: !!item.file?.voice} : {}),
    });
    return message;
  }
  async function send(
    conversationId: string,
    body: string,
    replyTo?: Message | null,
  ) {
    if (body.length > state.limits.body)
      throw withStatus(
        `Messages can be up to ${state.limits.body} characters.`,
        400,
      );
    enqueue({
      clientId: uid(),
      conversationId,
      createdAt: new Date().toISOString(),
      body,
      replyTo: replyTo
        ? {
            id: replyTo.id,
            sender: replyTo.sender,
            body: replyTo.body,
            file: replyTo.file?.name,
          }
        : null,
      state: 'queued',
      attempts: 0,
    });
  }
  // The chat is fixed when the file is chosen.
  async function sendFile(
    conversationId: string,
    file: {uri: string; name: string; mime: string; size: number},
    voice = false,
  ) {
    if (file.size > state.limits.fileBytes)
      throw new Error(
        `${file.name} is larger than ${Math.floor(
          state.limits.fileBytes / 1048576,
        )} MB.`,
      );
    const clientId = uid();
    enqueue({
      clientId,
      conversationId,
      createdAt: new Date().toISOString(),
      body: '',
      file: await keepFile(clientId, {...file, voice}),
      state: 'queued',
      attempts: 0,
    });
  }
  function retryMessage(m: Message) {
    const item = outbox.find(i => i.clientId === m.clientId);
    if (!item) return Promise.resolve();
    item.state = 'queued';
    item.error = undefined;
    item.attempts = 0;
    saveQueue();
    upsert(localOf(item));
    bump();
    kick(true);
    return Promise.resolve();
  }
  // Cancel a message not sent yet (stops its upload).
  function discard(m: Message) {
    const item = outbox.find(i => i.clientId === m.clientId);
    if (item) {
      outbox = outbox.filter(i => i !== item);
      cancels.get(item.clientId)?.();
      saveQueue();
      dropFile(item);
    }
    const th = thread(m.conversationId);
    th.list = th.list.filter(x => x.clientId !== m.clientId || x.sender !== me);
    progress.delete(m.clientId || '');
    bump();
  }
  const pendingCount = () => outbox.filter(i => i.state === 'queued').length;
  const draftOf = (id: string) => drafts.get(id) || '';
  function setDraft(id: string, text: string) {
    if ((drafts.get(id) || '') === text) return;
    if (text.trim()) drafts.set(id, text);
    else drafts.delete(id);
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => saveDrafts(me, drafts), 600);
    render();
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
  // Signing out on purpose wipes the employee's chats, drafts and queue from the
  // phone; an automatic sign-out (30 days, password changed) keeps them for next time.
  const offSignOut = onBeforeSignOut(async wipeAll => {
    if (wipeAll) await wipe(me);
  });
  function stop() {
    closed = true;
    netinfo();
    clearInterval(reconcile);
    offSignOut();
    if (bootTimer) clearTimeout(bootTimer);
    if (outboxTimer) clearTimeout(outboxTimer);
    if (saveTimer) clearTimeout(saveTimer);
    if (draftTimer) {
      clearTimeout(draftTimer);
      saveDrafts(me, drafts);
    }
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
    discard,
    pendingCount,
    progress,
    draftOf,
    setDraft,
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

const Context = createContext<{
  messenger: Messenger | null;
  version: number;
} | null>(null);

// One Messenger per signed-in employee; none while Messenger is signed out.
export function MessengerProvider({
  user,
  children,
}: {
  user: string | null;
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
  const messenger = useMemo(
    () => (user ? createMessenger(user, bump) : null),
    [user, bump],
  );
  useEffect(() => {
    if (!messenger) return;
    messenger.start();
    return () => messenger.stop();
  }, [messenger]);
  const value = useMemo(() => ({messenger, version}), [messenger, version]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
// For screens shown only while signed in.
export function useMessenger() {
  const value = useContext(Context);
  if (!value?.messenger)
    throw new Error('useMessenger needs a signed-in Messenger');
  return value as {messenger: Messenger; version: number};
}
export function useMaybeMessenger() {
  return useContext(Context)?.messenger || null;
}
export function totalUnread(m: Messenger) {
  let n = 0;
  for (const c of m.convs.values())
    if (!(c.mutedUntil && new Date(c.mutedUntil) > new Date()) && !c.archived)
      n += c.unread || 0;
  return n;
}
// The Chat tab's badge; 0 while Messenger is signed out.
export function useUnread() {
  const value = useContext(Context);
  return value?.messenger ? totalUnread(value.messenger) : 0;
}
