import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useFocusEffect} from '@react-navigation/native';
import type {StackScreenProps} from '@react-navigation/stack';
import {relay} from '../api';
import {ASSISTANT, BRAND} from '../config';
import {convTitle, lastSeen, muted, personOf} from '../format';
import {useMessenger} from '../store';
import type {MessengerStack} from '../navigation';
import type {Person} from '../types';
import {Avatar} from '../components/Avatar';
import {Sheet, type SheetItem} from '../components/Sheet';

type Member = {user: string; role: 'admin' | 'member'};

// Contact info for a direct chat; group info, members and admin settings for a group.
export function InfoScreen({
  route,
  navigation,
}: StackScreenProps<MessengerStack, 'Info'>) {
  const {id} = route.params;
  const {messenger} = useMessenger();
  const me = messenger.me;
  const c = messenger.convs.get(id);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [title, setTitle] = useState(c?.title || '');
  const [description, setDescription] = useState(c?.description || '');
  const [memberMenu, setMemberMenu] = useState<Member | null>(null);

  const load = useCallback(() => {
    if (c?.kind !== 'group') return;
    relay<{members: Member[]; people: Record<string, Person>}>(
      'conversations.members',
      {conversationId: id},
    )
      .then(result => {
        for (const [user, p] of Object.entries(result.people || {}))
          if (!messenger.people.get(user)?.employee)
            messenger.people.set(user, {...messenger.people.get(user), ...p});
        setMembers(result.members);
      })
      .catch(error => Alert.alert('Messenger', error.message));
  }, [c?.kind, id, messenger]);
  useFocusEffect(load); // again after "Add members"
  useEffect(() => {
    setTitle(c?.title || '');
    setDescription(c?.description || '');
  }, [c?.title, c?.description]);
  if (!c) return null;

  const admin = c.kind === 'group' && c.role === 'admin' && !c.left;
  const peer = c.peer ? personOf(messenger.people, c.peer) : undefined;
  const act = (operation: string, data: Record<string, unknown>) =>
    messenger
      .groupAction(operation, {conversationId: id, ...data})
      .then(load)
      .catch(error => Alert.alert('Messenger', error.message));
  const change = (data: Record<string, unknown>) =>
    messenger
      .settings(id, data)
      .catch(error => Alert.alert('Messenger', error.message));

  function memberItems(m: Member): SheetItem[] {
    const name = personOf(messenger.people, m.user).name;
    return [
      {
        label: `Message ${name}`,
        icon: 'chatbubble-outline',
        onPress: () =>
          messenger
            .openDirect(m.user)
            .then(cid => navigation.push('Chat', {id: cid})),
      },
      m.role === 'admin'
        ? {
            label: 'Dismiss as admin',
            icon: 'shield-outline',
            onPress: () => act('groups.admin', {user: m.user, admin: false}),
          }
        : {
            label: 'Make group admin',
            icon: 'shield-checkmark-outline',
            onPress: () => act('groups.admin', {user: m.user, admin: true}),
          },
      {
        label: `Remove ${name}`,
        icon: 'person-remove-outline',
        danger: true,
        onPress: () =>
          Alert.alert(`Remove ${name}?`, undefined, [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => act('groups.remove', {user: m.user}),
            },
          ]),
      },
    ];
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{padding: 8}}
          accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </Pressable>
        <Text style={styles.heading}>
          {c.kind === 'group' ? 'Group info' : 'Contact info'}
        </Text>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={{paddingBottom: 40}}
        keyboardShouldPersistTaps="handled">
        <View style={styles.profile}>
          <Avatar
            person={peer}
            group={c.kind === 'group'}
            groupId={c.id}
            size={96}
          />
          {admin ? (
            <TextInput
              style={styles.titleEdit}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              onEndEditing={() =>
                title.trim() &&
                title.trim() !== c.title &&
                act('groups.update', {title: title.trim()})
              }
            />
          ) : (
            <Text style={styles.title}>{convTitle(c, messenger.people)}</Text>
          )}
          <Text style={styles.sub}>
            {c.kind === 'group'
              ? `Group · ${members?.length ?? c.memberCount} members`
              : peer?.user === ASSISTANT
              ? 'CEO assistant'
              : [peer?.designation, peer?.department]
                  .filter(Boolean)
                  .join(' · ')}
          </Text>
          {peer && peer.user !== ASSISTANT ? (
            <Text style={styles.sub}>{lastSeen(peer)}</Text>
          ) : null}
        </View>

        {admin ? (
          <View style={styles.card}>
            <TextInput
              style={styles.desc}
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              placeholder="Add a group description"
              placeholderTextColor={BRAND.muted}
              onEndEditing={() =>
                description !== (c.description || '') &&
                act('groups.update', {description})
              }
            />
            <View style={styles.toggle}>
              <Text style={styles.rowText}>Only admins can send messages</Text>
              <Switch
                value={!!c.onlyAdminsSend}
                onValueChange={v => act('groups.update', {onlyAdminsSend: v})}
                trackColor={{true: BRAND.accent}}
              />
            </View>
          </View>
        ) : c.description ? (
          <View style={styles.card}>
            <Text style={styles.rowText}>{c.description}</Text>
          </View>
        ) : null}

        {c.kind === 'group' ? (
          <View style={styles.card}>
            <Text style={styles.section}>
              {members ? `${members.length} members` : 'Members'}
            </Text>
            {admin ? (
              <Pressable
                style={styles.member}
                onPress={() => navigation.navigate('NewChat', {addTo: id})}>
                <View style={styles.add}>
                  <Ionicons name="person-add" size={20} color="#fff" />
                </View>
                <Text style={[styles.rowText, {fontWeight: '600'}]}>
                  Add members
                </Text>
              </Pressable>
            ) : null}
            {!members ? (
              <ActivityIndicator style={{margin: 16}} color={BRAND.navy} />
            ) : null}
            {members?.map(m => {
              const p = personOf(messenger.people, m.user);
              return (
                <Pressable
                  key={m.user}
                  style={styles.member}
                  disabled={m.user === me}
                  onPress={() =>
                    admin
                      ? setMemberMenu(m)
                      : messenger
                          .openDirect(m.user)
                          .then(cid => navigation.push('Chat', {id: cid}))
                  }>
                  <Avatar person={p} size={42} />
                  <View style={{flex: 1}}>
                    <Text style={styles.rowText} numberOfLines={1}>
                      {m.user === me ? 'You' : p.name}
                    </Text>
                    {p.designation ? (
                      <Text style={styles.small}>{p.designation}</Text>
                    ) : null}
                  </View>
                  {m.role === 'admin' ? (
                    <Text style={styles.tag}>Admin</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Pressable
            style={styles.action}
            onPress={() =>
              change({
                mutedUntil: muted(c)
                  ? null
                  : new Date(
                      Date.now() + 100 * 365 * 24 * 3_600_000,
                    ).toISOString(),
              })
            }>
            <Ionicons
              name={
                muted(c) ? 'notifications-outline' : 'notifications-off-outline'
              }
              size={21}
              color={BRAND.sub}
            />
            <Text style={styles.rowText}>
              {muted(c) ? 'Unmute notifications' : 'Mute notifications'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() =>
              Alert.alert(
                'Clear messages?',
                'Messages are removed for you only.',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => change({clear: true}),
                  },
                ],
              )
            }>
            <Ionicons name="trash-outline" size={21} color={BRAND.danger} />
            <Text style={[styles.rowText, {color: BRAND.danger}]}>
              Clear messages
            </Text>
          </Pressable>
          {c.kind === 'group' && !c.left ? (
            <Pressable
              style={styles.action}
              onPress={() =>
                Alert.alert('Exit group?', undefined, [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Exit',
                    style: 'destructive',
                    onPress: () => act('groups.leave', {}),
                  },
                ])
              }>
              <Ionicons name="exit-outline" size={21} color={BRAND.danger} />
              <Text style={[styles.rowText, {color: BRAND.danger}]}>
                Exit group
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <Sheet
        visible={!!memberMenu}
        onClose={() => setMemberMenu(null)}
        items={memberMenu ? memberItems(memberMenu) : []}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: BRAND.navy},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  heading: {color: '#fff', fontSize: 18, fontWeight: '700'},
  body: {flex: 1, backgroundColor: BRAND.bg},
  profile: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 22,
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND.text,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  titleEdit: {
    fontSize: 22,
    fontWeight: '700',
    color: BRAND.text,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: BRAND.accent,
    minWidth: 200,
    paddingVertical: 4,
  },
  sub: {color: BRAND.muted, fontSize: 14},
  card: {backgroundColor: '#fff', marginTop: 10, paddingVertical: 6},
  desc: {
    fontSize: 15,
    color: BRAND.text,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  section: {
    color: BRAND.accent,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  add: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {fontSize: 15.5, color: BRAND.text, flexShrink: 1},
  small: {fontSize: 13, color: BRAND.muted},
  tag: {
    fontSize: 11.5,
    color: BRAND.accent,
    borderWidth: 1,
    borderColor: BRAND.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
