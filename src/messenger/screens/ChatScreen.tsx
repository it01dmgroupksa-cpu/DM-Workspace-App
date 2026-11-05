import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import type {StackScreenProps} from '@react-navigation/stack';
import {relay} from '../api';
import {ASSISTANT, BRAND} from '../config';
import {convTitle, dayLabel, lastSeen, personOf, time} from '../format';
import {useMessenger} from '../store';
import {useCalls} from '../calls';
import type {MessengerStack} from '../navigation';
import type {Message} from '../types';
import {Avatar} from '../components/Avatar';
import {Bubble} from '../components/Bubble';
import {
  Composer,
  type ComposerHandle,
  type PickedFile,
} from '../components/Composer';
import {MediaViewer} from '../components/MediaViewer';
import {Picker, type Target} from '../components/Picker';
import {Sheet, type SheetItem} from '../components/Sheet';
import {ConnectionBar} from '../components/ConnectionBar';

type Row = {
  key: string;
  day?: string;
  m?: Message;
  first?: boolean;
  unread?: number;
};
const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function ChatScreen({
  route,
  navigation,
}: StackScreenProps<MessengerStack, 'Chat'>) {
  const {id, focus} = route.params;
  const {messenger, version} = useMessenger();
  const calls = useCalls();
  const me = messenger.me;
  const c = messenger.convs.get(id);
  const th = messenger.thread(id);
  const limits = messenger.state.limits;
  const list = useRef<FlatList<Row>>(null);
  const composer = useRef<ComposerHandle>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [viewing, setViewing] = useState<Message | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [info, setInfo] = useState<{m: Message; members: any[]} | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    {id: string; sender: string; body: string; createdAt: string}[] | null
  >(null);
  const [atBottom, setAtBottom] = useState(true);
  const pendingJump = useRef<string | null>(null);
  const [pinIndex, setPinIndex] = useState(0);
  // The people a message here can @mention: the group's members besides me.
  const [memberIds, setMemberIds] = useState<string[]>([]);
  useEffect(() => {
    if (c?.kind !== 'group' || c.left) return setMemberIds([]);
    let current = true;
    messenger
      .membersOf(id)
      .then(list => current && setMemberIds(list))
      .catch(() => {});
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, c?.kind, c?.left, c?.memberCount]);
  const mentionable = memberIds
    .filter(u => u !== me)
    .map(u => personOf(messenger.people, u));
  // "N unread messages" stays above the first message that was unread on opening,
  // until the chat is closed.
  const openUnread = useRef(c?.unread || 0);
  const unreadFrom = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    messenger.setActive(id);
    if (focus) jumpTo(focus);
    else if (!th.loaded || th.stale) messenger.loadMessages(id);
    return () => messenger.setActive(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, focus]);
  // A voice note being recorded is sent, not lost, when leaving the chat.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (composer.current?.recording()) composer.current.finish();
      }),
    [navigation],
  );
  useEffect(() => {
    if (c?.kind !== 'direct' || !c.peer || c.peer === ASSISTANT) return;
    messenger.refreshPresence([c.peer]);
    const t = setInterval(() => messenger.refreshPresence([c.peer!]), 60_000);
    return () => clearInterval(t);
  }, [c?.kind, c?.peer, messenger]);

  // Oldest first with a day label before each day, then reversed for the inverted list.
  const rows = useMemo(() => {
    const out: Row[] = [];
    let day = '';
    let prev: Message | undefined;
    if (unreadFrom.current === undefined && th.loaded && openUnread.current) {
      const theirs = th.list.filter(
        x => x.sender !== me && x.kind !== 'system' && !x.deleted,
      );
      unreadFrom.current =
        theirs[Math.max(0, theirs.length - openUnread.current)]?.id || null;
    }
    for (const m of th.list) {
      const d = new Date(m.createdAt).toDateString();
      if (d !== day) {
        day = d;
        out.push({key: 'day' + d, day: dayLabel(m.createdAt)});
        prev = undefined;
      }
      const first =
        !prev ||
        prev.sender !== m.sender ||
        prev.kind === 'system' ||
        +new Date(m.createdAt) - +new Date(prev.createdAt) > 5 * 60_000;
      if (m.id === unreadFrom.current) {
        out.push({key: 'unread', unread: openUnread.current});
        prev = undefined;
      }
      out.push({
        key: m.clientId && m.sender === me ? 'c' + m.clientId : m.id,
        m,
        first,
      });
      prev = m;
    }
    return out.reverse();
    // The store changes in place and bumps `version` on every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, id, me]);

  useEffect(() => {
    const target = pendingJump.current;
    if (!target) return;
    const index = rows.findIndex(r => r.m?.id === target);
    if (index < 0) return;
    pendingJump.current = null;
    setTimeout(
      () =>
        list.current?.scrollToIndex({index, viewPosition: 0.5, animated: true}),
      60,
    );
  }, [rows]);

  const jumpTo = useCallback(
    async (messageId: string) => {
      setHighlight(messageId);
      setTimeout(() => setHighlight(h => (h === messageId ? null : h)), 2200);
      const index = rows.findIndex(r => r.m?.id === messageId);
      if (index >= 0)
        return list.current?.scrollToIndex({
          index,
          viewPosition: 0.5,
          animated: true,
        });
      pendingJump.current = messageId;
      if (!(await messenger.loadMessages(id, {around: messageId}))) {
        pendingJump.current = null;
        Alert.alert('Messenger', 'That message is no longer available.');
      }
    },
    [rows, messenger, id],
  );

  if (!c)
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={BRAND.navy} />
      </SafeAreaView>
    );

  const title = convTitle(c, messenger.people);
  const pinned5 = messenger.pins.get(id) || [];
  const typers = [...(messenger.typing.get(id)?.keys() || [])].filter(
    u => u !== me,
  );
  const peer = c.peer ? personOf(messenger.people, c.peer) : undefined;
  const status = typers.length
    ? c.kind === 'group'
      ? `${typers
          .map(u => personOf(messenger.people, u).name.split(' ')[0])
          .join(', ')} typing…`
      : 'typing…'
    : c.kind === 'group'
    ? `${c.memberCount} members`
    : c.peer === ASSISTANT
    ? 'Reports on the work it coordinates. Write here to instruct it.'
    : peer
    ? lastSeen(peer)
    : '';
  const blocked = c.left
    ? "You're no longer a member of this group."
    : c.onlyAdminsSend && c.role !== 'admin'
    ? 'Only admins can send messages.'
    : undefined;
  // Not in your own notes chat or with the assistant, as on the ERP desk.
  const callable =
    limits.callsEnabled &&
    !blocked &&
    c.peer !== ASSISTANT &&
    (c.kind === 'group' || !!c.peer);
  const live = messenger.liveCalls.get(id);
  const inThisCall = calls.current?.call?.id === live?.id;
  const myState = live?.members.find(x => x.user === me)?.state;

  function call(video: boolean) {
    const joining = !!live && !inThisCall;
    const name = title;
    Alert.alert(
      video ? 'Video call' : 'Voice call',
      joining
        ? `Join the ${video ? 'video' : 'voice'} call in ${name}?`
        : `${video ? 'Start a video call' : 'Call'} ${
            c?.kind === 'group' ? 'the group ' : ''
          }${name}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: joining ? 'Join' : video ? 'Video call' : 'Call',
          onPress: () =>
            joining ? calls.join(live!, video) : calls.start(id, video),
        },
      ],
    );
  }
  async function send(
    text: string,
    mention: {users: string[]; all: boolean} = {users: [], all: false},
  ) {
    try {
      if (editing) {
        const m = editing;
        setEditing(null);
        if (text !== m.body) await messenger.edit(m, text, mention.users);
        return;
      }
      const reply = replyTo;
      setReplyTo(null);
      list.current?.scrollToOffset({offset: 0, animated: true});
      await messenger.send(id, text, reply, mention);
    } catch (error: any) {
      Alert.alert('Messenger', error.message);
    }
  }
  function sendFiles(files: PickedFile[], voice: boolean, target: string) {
    for (const f of files)
      messenger
        .sendFile(target, f, voice)
        .catch(error => Alert.alert('Messenger', error.message));
  }
  async function runSearch() {
    if (query.trim().length < 2) return;
    try {
      const {results: found} = await relay('messages.find', {
        conversationId: id,
        query: query.trim(),
      });
      setResults(found);
    } catch (error: any) {
      Alert.alert('Search', error.message);
    }
  }

  function menuItems(m: Message): SheetItem[] {
    const mine = m.sender === me;
    const items: SheetItem[] = [];
    // Not on the server yet: it can be retried, copied or cancelled, nothing else.
    if (m.pending || m.failed) {
      if (m.failed)
        items.push({
          label: 'Retry',
          icon: 'refresh-outline',
          onPress: () => messenger.retryMessage(m),
        });
      if (m.body)
        items.push({
          label: 'Copy',
          icon: 'copy-outline',
          onPress: () => Clipboard.setStringAsync(m.body),
        });
      items.push({
        label: m.file ? 'Cancel sending' : 'Delete',
        icon: 'trash-outline',
        danger: true,
        onPress: () => messenger.discard(m),
      });
      return items;
    }
    const canEdit =
      mine &&
      m.kind === 'text' &&
      !m.deleted &&
      Date.now() - +new Date(m.createdAt) < limits.editMinutes * 60_000;
    const deletable =
      mine &&
      Date.now() - +new Date(m.createdAt) <
        limits.deleteForAllHours * 3_600_000;
    if (!c!.left)
      items.push({
        label: 'Reply',
        icon: 'arrow-undo-outline',
        onPress: () => {
          setEditing(null);
          setReplyTo(m);
        },
      });
    items.push({
      label: 'Forward',
      icon: 'arrow-redo-outline',
      onPress: () => setForwarding(m),
    });
    // Pins are shared by the whole chat (admins only in an admins-only group).
    if (
      m.kind !== 'system' &&
      !c!.left &&
      !(c!.onlyAdminsSend && c!.role !== 'admin')
    ) {
      const pinned = pinned5.some(p => p.id === m.id);
      items.push({
        label: pinned ? 'Unpin message' : 'Pin message',
        icon: pinned ? 'pin' : 'pin-outline',
        onPress: () =>
          messenger
            .pin(m, !pinned)
            .catch(error => Alert.alert('Pin', error.message)),
      });
    }
    if (limits.translation && m.body) {
      if (m.translation)
        items.push({
          label: 'Show original',
          icon: 'language-outline',
          onPress: () => translate(m, null),
        });
      if (m.translation?.lang !== 'ar')
        items.push({
          label: 'Translate to Arabic',
          icon: 'language-outline',
          onPress: () => translate(m, 'ar'),
        });
      if (m.translation?.lang !== 'en')
        items.push({
          label: 'Translate to English',
          icon: 'language-outline',
          onPress: () => translate(m, 'en'),
        });
    }
    if (m.body)
      items.push({
        label: 'Copy',
        icon: 'copy-outline',
        onPress: () => Clipboard.setStringAsync(m.body),
      });
    if (!c!.left && canEdit)
      items.push({
        label: 'Edit',
        icon: 'create-outline',
        onPress: () => {
          setReplyTo(null);
          setEditing(m);
        },
      });
    if (mine)
      items.push({
        label: 'Message info',
        icon: 'information-circle-outline',
        onPress: () => showInfo(m),
      });
    items.push({
      label: 'Delete for me',
      icon: 'trash-outline',
      danger: true,
      onPress: () => confirmDelete(m, false),
    });
    if (!c!.left && deletable)
      items.push({
        label: 'Delete for everyone',
        icon: 'trash',
        danger: true,
        onPress: () => confirmDelete(m, true),
      });
    return items;
  }
  function translate(m: Message, lang: 'ar' | 'en' | null) {
    messenger
      .translate(m, lang)
      .catch(error => Alert.alert('Translate', error.message));
  }
  function confirmDelete(m: Message, everyone: boolean) {
    Alert.alert(
      everyone ? 'Delete for everyone?' : 'Delete for me?',
      undefined,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            messenger
              .remove(m, everyone)
              .catch(error => Alert.alert('Messenger', error.message)),
        },
      ],
    );
  }
  async function showInfo(m: Message) {
    try {
      const {members} = await relay('messages.info', {messageId: m.id});
      setInfo({m, members});
    } catch (error: any) {
      Alert.alert('Message info', error.message);
    }
  }

  const reaction = menuFor?.reactions.find(r => r.user === me)?.emoji;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {searching ? (
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              setSearching(false);
              setResults(null);
              setQuery('');
            }}
            style={styles.hBtn}
            accessibilityLabel="Close search">
            <Ionicons name="arrow-back" size={23} color="#fff" />
          </Pressable>
          <TextInput
            autoFocus
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            returnKeyType="search"
            placeholder="Search this chat"
            placeholderTextColor="#c7d2e0"
          />
          <Pressable
            onPress={runSearch}
            style={styles.hBtn}
            accessibilityLabel="Search">
            <Ionicons name="search" size={21} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.hBtn}
            accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={23} color="#fff" />
          </Pressable>
          <Pressable
            style={styles.who}
            onPress={() => navigation.navigate('Info', {id})}>
            <Avatar
              person={peer}
              group={c.kind === 'group'}
              groupId={c.id}
              size={38}
            />
            <View style={{flex: 1}}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {status ? (
                <Text style={styles.status} numberOfLines={1}>
                  {status}
                </Text>
              ) : null}
            </View>
          </Pressable>
          {callable ? (
            <>
              <Pressable
                onPress={() => call(true)}
                style={styles.hBtn}
                accessibilityLabel="Video call">
                <Ionicons name="videocam" size={22} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => call(false)}
                style={styles.hBtn}
                accessibilityLabel="Voice call">
                <Ionicons name="call" size={20} color="#fff" />
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={() => setSearching(true)}
            style={styles.hBtn}
            accessibilityLabel="Search this chat">
            <Ionicons name="search" size={21} color="#fff" />
          </Pressable>
        </View>
      )}
      {live &&
      callable &&
      !inThisCall &&
      myState !== 'ringing' &&
      // Your own call still ringing can't be moved; it has nothing to move yet.
      !(myState === 'joined' && !live.answeredAt) ? (
        <Pressable
          style={styles.callbar}
          onPress={() =>
            calls.join(live, myState === 'joined' ? live.video : false)
          }>
          <Ionicons
            name={live.video ? 'videocam' : 'call'}
            size={16}
            color="#fff"
          />
          <Text style={styles.callbarText}>
            {/* Joining moves the call here; the other device drops out of it. */}
            {myState === 'joined'
              ? 'On this call on another device · Tap to move it here'
              : 'Call in progress · Tap to join'}
          </Text>
        </Pressable>
      ) : null}
      <ConnectionBar messenger={messenger} />
      {pinned5.length ? (
        <Pressable
          style={styles.pinBar}
          onPress={() => {
            const shown = pinned5[pinIndex % pinned5.length];
            setPinIndex(pinIndex + 1);
            jumpTo(shown.id);
          }}
          accessibilityLabel="Pinned message">
          <Ionicons name="pin" size={16} color={BRAND.accent} />
          <View style={styles.pinText}>
            <Text style={styles.pinTitle}>
              Pinned message
              {pinned5.length > 1
                ? ` · ${(pinIndex % pinned5.length) + 1} of ${pinned5.length}`
                : ''}
            </Text>
            <Text style={styles.pinBody} numberOfLines={1}>
              {pinPreview(pinned5[pinIndex % pinned5.length])}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chat}>
          {!th.loaded && th.loading ? (
            <ActivityIndicator style={{marginTop: 30}} color={BRAND.navy} />
          ) : null}
          <FlatList
            ref={list}
            inverted
            data={rows}
            keyExtractor={r => r.key}
            initialNumToRender={20}
            windowSize={11}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.4}
            onEndReached={() =>
              th.more && !th.loading && messenger.loadMessages(id, 'older')
            }
            onScroll={e => {
              const near = e.nativeEvent.contentOffset.y < 120;
              if (near !== atBottom) setAtBottom(near);
              messenger.setNearBottom(near);
              if (near && th.newer && !th.loading)
                messenger.loadMessages(id, 'newer');
              if (near && c.unread) messenger.markRead(id);
            }}
            scrollEventThrottle={100}
            onScrollToIndexFailed={e => {
              list.current?.scrollToOffset({
                offset: e.averageItemLength * e.index,
                animated: false,
              });
              setTimeout(
                () =>
                  list.current?.scrollToIndex({
                    index: e.index,
                    viewPosition: 0.5,
                  }),
                120,
              );
            }}
            ListFooterComponent={
              th.loading && th.loaded ? (
                <ActivityIndicator style={{margin: 12}} color={BRAND.navy} />
              ) : null
            }
            renderItem={({item}) =>
              item.day ? (
                <View style={styles.dayWrap}>
                  <Text style={styles.day}>{item.day}</Text>
                </View>
              ) : item.unread ? (
                <View style={styles.unreadWrap}>
                  <Text style={styles.unreadText}>
                    {item.unread} unread message{item.unread === 1 ? '' : 's'}
                  </Text>
                </View>
              ) : (
                <Bubble
                  m={item.m!}
                  me={me}
                  conv={c}
                  people={messenger.people}
                  first={!!item.first}
                  highlight={highlight === item.m!.id}
                  onMenu={setMenuFor}
                  onView={setViewing}
                  onQuote={jumpTo}
                  onRetry={m =>
                    messenger
                      .retryMessage(m)
                      .catch(error => Alert.alert('Messenger', error.message))
                  }
                  onCallBack={video => callable && call(video)}
                  onOriginal={m => translate(m, null)}
                  progress={
                    item.m!.clientId
                      ? messenger.progress.get(item.m!.clientId)
                      : undefined
                  }
                />
              )
            }
          />
          {!atBottom || th.newer ? (
            <Pressable
              style={styles.down}
              accessibilityLabel="Jump to latest"
              onPress={async () => {
                if (th.newer) await messenger.loadMessages(id);
                list.current?.scrollToOffset({offset: 0, animated: true});
              }}>
              <Ionicons name="chevron-down" size={22} color={BRAND.sub} />
              {c.unread ? (
                <Text style={styles.downBadge}>{c.unread}</Text>
              ) : null}
            </Pressable>
          ) : null}
        </View>
        <SafeAreaView edges={['bottom']} style={{backgroundColor: '#f0f2f5'}}>
          <Composer
            ref={composer}
            conversationId={id}
            disabled={blocked}
            replyTo={replyTo}
            editing={editing}
            me={me}
            people={messenger.people}
            inCall={!!calls.current}
            mentionable={mentionable}
            canMentionAll={c.kind === 'group' && c.role === 'admin' && !c.left}
            onCancel={() => {
              setReplyTo(null);
              setEditing(null);
            }}
            onSend={send}
            onFiles={sendFiles}
            onTyping={() => messenger.sendTyping(id)}
            draft={messenger.draftOf(id)}
            onDraft={text => messenger.setDraft(id, text)}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>

      <Sheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        items={menuFor ? menuItems(menuFor) : []}
        header={
          menuFor && !c.left ? (
            <View style={styles.quick}>
              {QUICK.map(e => (
                <Pressable
                  key={e}
                  style={[
                    styles.quickBtn,
                    reaction === e && {backgroundColor: BRAND.accentSoft},
                  ]}
                  onPress={() => {
                    const m = menuFor;
                    setMenuFor(null);
                    messenger
                      .react(m, e)
                      .catch(error => Alert.alert('Messenger', error.message));
                  }}>
                  <Text style={{fontSize: 26}}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
      />
      <MediaViewer
        message={viewing}
        from={
          viewing
            ? viewing.sender === me
              ? 'You'
              : personOf(messenger.people, viewing.sender).name
            : ''
        }
        onClose={() => setViewing(null)}
      />
      <ForwardModal message={forwarding} onClose={() => setForwarding(null)} />

      <Modal
        visible={!!results}
        transparent
        animationType="fade"
        onRequestClose={() => setResults(null)}>
        <Pressable style={styles.backdrop} onPress={() => setResults(null)}>
          <View style={styles.results}>
            <Text style={styles.resultsHead}>
              {results?.length
                ? `${results.length} found`
                : 'No messages found'}
            </Text>
            <FlatList
              data={results || []}
              keyExtractor={r => r.id}
              renderItem={({item}) => (
                <Pressable
                  style={styles.result}
                  onPress={() => {
                    setResults(null);
                    setSearching(false);
                    jumpTo(item.id);
                  }}>
                  <Text style={styles.resultWho}>
                    {item.sender === me
                      ? 'You'
                      : personOf(messenger.people, item.sender).name}{' '}
                    · {dayLabel(item.createdAt)} {time(item.createdAt)}
                  </Text>
                  <Text numberOfLines={2} style={styles.resultText}>
                    {item.body}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!info}
        transparent
        animationType="fade"
        onRequestClose={() => setInfo(null)}>
        <Pressable style={styles.backdrop} onPress={() => setInfo(null)}>
          <View style={styles.results}>
            <Text style={styles.resultsHead}>Message info</Text>
            <FlatList
              data={info?.members || []}
              keyExtractor={r => r.user}
              renderItem={({item}) => (
                <View style={styles.infoRow}>
                  <Avatar
                    person={personOf(messenger.people, item.user)}
                    size={34}
                  />
                  <View style={{flex: 1}}>
                    <Text style={styles.resultWho}>
                      {personOf(messenger.people, item.user).name}
                    </Text>
                    <Text style={styles.resultText}>
                      {item.readAt
                        ? `Read ${dayLabel(item.readAt)} ${time(item.readAt)}`
                        : item.deliveredAt
                        ? `Delivered ${dayLabel(item.deliveredAt)} ${time(
                            item.deliveredAt,
                          )}`
                        : 'Sent'}
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      item.readAt || item.deliveredAt
                        ? 'checkmark-done'
                        : 'checkmark'
                    }
                    size={18}
                    color={item.readAt ? BRAND.read : BRAND.muted}
                  />
                </View>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

export function ForwardModal({
  message,
  onClose,
}: {
  message: Message | null;
  onClose: () => void;
}) {
  const {messenger} = useMessenger();
  const [selected, setSelected] = useState<Target[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSelected([]), [message]);
  const chats = useMemo(
    () =>
      [...messenger.convs.values()]
        .filter(c => !c.left && !(c.onlyAdminsSend && c.role !== 'admin'))
        .sort(
          (a, b) =>
            +new Date(b.last?.at || b.createdAt) -
            +new Date(a.last?.at || a.createdAt),
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messenger.convs, message],
  );
  async function send() {
    if (!message || !selected.length) return;
    setBusy(true);
    try {
      const n = await messenger.forward(message, selected);
      onClose();
      Alert.alert('Forwarded', `Sent to ${n} chat${n === 1 ? '' : 's'}.`);
    } catch (error: any) {
      Alert.alert('Forward', error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={!!message} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.hBtn}
            accessibilityLabel="Close">
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={[styles.title, {flex: 1}]}>Forward to…</Text>
        </View>
        <Picker
          people={messenger.people}
          me={messenger.me}
          chats={chats}
          multiple
          selected={selected}
          onToggle={t =>
            setSelected(s =>
              s.some(x =>
                t.user
                  ? x.user === t.user
                  : x.conversationId === t.conversationId,
              )
                ? s.filter(x =>
                    t.user
                      ? x.user !== t.user
                      : x.conversationId !== t.conversationId,
                  )
                : s.length >= 5
                ? (Alert.alert(
                    'Forward',
                    'You can forward to up to 5 chats at once.',
                  ),
                  s)
                : [...s, t],
            )
          }
        />
        {selected.length ? (
          <Pressable
            style={styles.fab}
            onPress={send}
            disabled={busy}
            accessibilityLabel="Send">
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="send" size={22} color="#fff" />
            )}
          </Pressable>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const pinPreview = (m: Message) =>
  m.kind === 'voice'
    ? '🎤 Voice message'
    : m.kind === 'image'
    ? `📷 ${m.body || 'Photo'}`
    : m.kind === 'file'
    ? `📄 ${m.file?.name || 'File'}`
    : m.body.replace(/\s+/g, ' ');

const styles = StyleSheet.create({
  pinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  pinText: {flex: 1},
  pinTitle: {color: BRAND.accent, fontSize: 12, fontWeight: '700'},
  pinBody: {color: BRAND.text, fontSize: 14},
  root: {flex: 1, backgroundColor: BRAND.navy},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.navy,
    paddingHorizontal: 4,
    paddingVertical: 6,
    minHeight: 56,
  },
  hBtn: {padding: 10},
  who: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10},
  title: {color: '#fff', fontSize: 17, fontWeight: '700'},
  status: {color: '#c7d2e0', fontSize: 12.5},
  searchInput: {flex: 1, color: '#fff', fontSize: 16, paddingVertical: 8},
  callbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 8,
  },
  callbarText: {color: '#fff', fontWeight: '600'},
  chat: {flex: 1, backgroundColor: BRAND.chat},
  unreadWrap: {
    alignItems: 'center',
    marginVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingVertical: 4,
  },
  unreadText: {color: BRAND.accent, fontWeight: '700', fontSize: 12.5},
  dayWrap: {alignItems: 'center', marginVertical: 8},
  day: {
    backgroundColor: '#fff',
    color: BRAND.sub,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  down: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  downBadge: {
    position: 'absolute',
    top: -6,
    right: -2,
    backgroundColor: BRAND.accent,
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    borderRadius: 9,
    overflow: 'hidden',
  },
  quick: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.line,
  },
  quickBtn: {padding: 6, borderRadius: 22},
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    padding: 20,
  },
  results: {
    backgroundColor: '#fff',
    borderRadius: 14,
    maxHeight: '75%',
    paddingVertical: 8,
  },
  resultsHead: {
    fontWeight: '700',
    fontSize: 16,
    color: BRAND.text,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  result: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BRAND.line,
  },
  resultWho: {color: BRAND.text, fontWeight: '600', fontSize: 13.5},
  resultText: {color: BRAND.sub, fontSize: 13.5},
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: BRAND.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
