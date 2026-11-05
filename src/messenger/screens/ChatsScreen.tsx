import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import type {StackScreenProps} from '@react-navigation/stack';
import {relay} from '../api';
import {BRAND} from '../config';
import {
  convTitle,
  dayLabel,
  listTime,
  muted,
  online,
  personOf,
  preview,
  time,
} from '../format';
import {useMessenger} from '../store';
import type {MessengerStack} from '../navigation';
import type {Conversation} from '../types';
import {Avatar} from '../components/Avatar';
import {Sheet, type SheetItem} from '../components/Sheet';

type Hit = {
  id: string;
  conversationId: string;
  sender: string;
  body: string;
  createdAt: string;
};

export function ChatsScreen({
  navigation,
}: StackScreenProps<MessengerStack, 'Chats'>) {
  const {messenger, version} = useMessenger();
  const me = messenger.me;
  const [archived, setArchived] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [menuFor, setMenuFor] = useState<Conversation | null>(null);
  const [newMenu, setNewMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Messages matching the search, from the panel, a moment after typing stops.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return setHits([]);
    const t = setTimeout(() => {
      relay<{results: Hit[]}>('messages.search', {query})
        .then(({results}) => setHits(results))
        .catch(() => setHits([]));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const chats = useMemo(() => {
    const query = q.trim().toLowerCase();
    return [...messenger.convs.values()]
      .filter(c =>
        query
          ? convTitle(c, messenger.people).toLowerCase().includes(query)
          : c.archived === archived,
      )
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          +new Date(b.last?.at || b.createdAt) -
            +new Date(a.last?.at || a.createdAt),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, q, archived]);
  const archivedCount = useMemo(
    () => [...messenger.convs.values()].filter(c => c.archived).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  const {ready, error} = messenger.state;
  if (!ready)
    return (
      <SafeAreaView style={styles.center}>
        {error ? (
          <>
            <Ionicons
              name="cloud-offline-outline"
              size={40}
              color={BRAND.muted}
            />
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => messenger.start()}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator size="large" color={BRAND.navy} />
        )}
      </SafeAreaView>
    );

  function convMenu(c: Conversation): SheetItem[] {
    const change = (data: Record<string, unknown>) =>
      messenger
        .settings(c.id, data)
        .catch(e => Alert.alert('Messenger', e.message));
    const until = (hours: number) =>
      hours === 0
        ? null
        : new Date(
            Date.now() + (hours < 0 ? 100 * 365 * 24 : hours) * 3_600_000,
          ).toISOString();
    return [
      {
        label: c.pinned ? 'Unpin chat' : 'Pin chat',
        icon: 'pin-outline',
        onPress: () => change({pinned: !c.pinned}),
      },
      ...(muted(c)
        ? [
            {
              label: 'Unmute',
              icon: 'notifications-outline',
              onPress: () => change({mutedUntil: until(0)}),
            } as SheetItem,
          ]
        : ([
            {
              label: 'Mute for 8 hours',
              icon: 'notifications-off-outline',
              onPress: () => change({mutedUntil: until(8)}),
            },
            {
              label: 'Mute for 1 week',
              icon: 'notifications-off-outline',
              onPress: () => change({mutedUntil: until(168)}),
            },
            {
              label: 'Mute always',
              icon: 'notifications-off-outline',
              onPress: () => change({mutedUntil: until(-1)}),
            },
          ] as SheetItem[])),
      {
        label: c.archived ? 'Unarchive chat' : 'Archive chat',
        icon: 'archive-outline',
        onPress: () => change({archived: !c.archived}),
      },
      {
        label: 'Clear messages',
        icon: 'trash-outline',
        danger: true,
        onPress: () =>
          Alert.alert('Clear messages?', 'Messages are removed for you only.', [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Clear',
              style: 'destructive',
              onPress: () => change({clear: true}),
            },
          ]),
      },
    ];
  }

  const renderChat = ({item: c}: {item: Conversation}) => {
    const peer = c.peer ? personOf(messenger.people, c.peer) : undefined;
    const typing = [...(messenger.typing.get(c.id)?.keys() || [])].some(
      u => u !== me,
    );
    const quiet = muted(c);
    return (
      <Pressable
        style={({pressed}) => [
          styles.row,
          pressed && {backgroundColor: BRAND.bg},
        ]}
        onPress={() => navigation.navigate('Chat', {id: c.id})}
        onLongPress={() => setMenuFor(c)}>
        <View>
          <Avatar person={peer} group={c.kind === 'group'} groupId={c.id} />
          {c.kind === 'direct' && online(peer) ? (
            <View style={styles.dot} />
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={styles.line}>
            <Text style={styles.name} numberOfLines={1}>
              {convTitle(c, messenger.people)}
            </Text>
            <Text
              style={[
                styles.when,
                c.unread && !quiet ? {color: BRAND.accent} : null,
              ]}>
              {c.last ? listTime(c.last.at) : ''}
            </Text>
          </View>
          <View style={styles.line}>
            <Text
              style={[styles.preview, typing && {color: BRAND.accent}]}
              numberOfLines={1}>
              {typing ? 'typing…' : preview(c, me, messenger.people)}
            </Text>
            {messenger.liveCalls.has(c.id) ? (
              <Ionicons name="call" size={14} color="#16a34a" />
            ) : null}
            {quiet ? (
              <Ionicons
                name="notifications-off"
                size={14}
                color={BRAND.muted}
              />
            ) : null}
            {c.pinned ? (
              <Ionicons name="pin" size={14} color={BRAND.muted} />
            ) : null}
            {c.unread ? (
              <Text
                style={[styles.badge, quiet && {backgroundColor: BRAND.muted}]}>
                {c.unread > 99 ? '99+' : c.unread}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {archived ? (
          <Pressable
            onPress={() => setArchived(false)}
            style={{padding: 6}}
            accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={23} color="#fff" />
          </Pressable>
        ) : null}
        <Text style={styles.heading}>
          {archived ? 'Archived' : 'Messenger'}
        </Text>
      </View>
      <View style={styles.list}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={BRAND.muted} />
          <TextInput
            style={styles.input}
            value={q}
            onChangeText={setQ}
            placeholder="Search chats and messages"
            placeholderTextColor={BRAND.muted}
          />
          {q ? (
            <Pressable
              onPress={() => setQ('')}
              accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={BRAND.muted} />
            </Pressable>
          ) : null}
        </View>
        <FlatList
          data={chats}
          keyExtractor={c => c.id}
          renderItem={renderChat}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await messenger.resync();
                setRefreshing(false);
              }}
            />
          }
          ListHeaderComponent={
            !archived && !q && archivedCount ? (
              <Pressable
                style={styles.archivedRow}
                onPress={() => setArchived(true)}>
                <Ionicons name="archive-outline" size={20} color={BRAND.sub} />
                <Text style={styles.archivedText}>Archived</Text>
                <Text style={styles.when}>{archivedCount}</Text>
              </Pressable>
            ) : null
          }
          ListFooterComponent={
            hits.length ? (
              <View>
                <Text style={styles.section}>Messages</Text>
                {hits.map(h => {
                  const c = messenger.convs.get(h.conversationId);
                  return (
                    <Pressable
                      key={h.id}
                      style={styles.hit}
                      onPress={() =>
                        navigation.navigate('Chat', {
                          id: h.conversationId,
                          focus: h.id,
                        })
                      }>
                      <Text style={styles.hitWho} numberOfLines={1}>
                        {c ? convTitle(c, messenger.people) : ''} ·{' '}
                        {h.sender === me
                          ? 'You'
                          : personOf(messenger.people, h.sender).name}
                      </Text>
                      <Text style={styles.preview} numberOfLines={2}>
                        {h.body}
                      </Text>
                      <Text style={styles.when}>
                        {dayLabel(h.createdAt)} {time(h.createdAt)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null
          }
          ListEmptyComponent={
            !hits.length ? (
              <Text style={styles.empty}>
                {q
                  ? 'No chats found.'
                  : archived
                  ? 'No archived chats.'
                  : 'No chats yet. Tap the button below to start one.'}
              </Text>
            ) : null
          }
        />
        {!archived ? (
          <Pressable
            style={styles.fab}
            onPress={() => setNewMenu(true)}
            accessibilityLabel="New chat">
            <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Sheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        items={menuFor ? convMenu(menuFor) : []}
      />
      <Sheet
        visible={newMenu}
        onClose={() => setNewMenu(false)}
        items={[
          {
            label: 'New chat',
            icon: 'person-add-outline',
            onPress: () => navigation.navigate('NewChat', {}),
          },
          {
            label: 'New group',
            icon: 'people-outline',
            onPress: () => navigation.navigate('NewChat', {group: true}),
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: BRAND.navy},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: BRAND.bg,
  },
  error: {color: BRAND.sub, textAlign: 'center'},
  retry: {
    backgroundColor: BRAND.navy,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {color: '#fff', fontWeight: '600'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heading: {color: '#fff', fontSize: 21, fontWeight: '700'},
  list: {flex: 1, backgroundColor: '#fff'},
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: BRAND.bg,
  },
  input: {flex: 1, paddingVertical: 10, fontSize: 15, color: BRAND.text},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  body: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND.line,
    paddingBottom: 10,
    gap: 3,
  },
  line: {flexDirection: 'row', alignItems: 'center', gap: 6},
  name: {flex: 1, fontSize: 16.5, fontWeight: '600', color: BRAND.text},
  when: {fontSize: 12, color: BRAND.muted},
  preview: {flex: 1, fontSize: 14, color: BRAND.sub},
  badge: {
    minWidth: 20,
    textAlign: 'center',
    backgroundColor: BRAND.accent,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 26,
    paddingVertical: 12,
  },
  archivedText: {flex: 1, fontSize: 15.5, color: BRAND.text, fontWeight: '600'},
  section: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    color: BRAND.accent,
    fontWeight: '700',
  },
  hit: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BRAND.line,
    gap: 2,
  },
  hitWho: {fontWeight: '600', color: BRAND.text},
  empty: {
    textAlign: 'center',
    color: BRAND.muted,
    marginTop: 40,
    paddingHorizontal: 30,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BRAND.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
