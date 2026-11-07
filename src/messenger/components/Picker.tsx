import React, {useMemo, useState} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ASSISTANT, BRAND} from '../config';
import {convTitle} from '../format';
import type {Conversation, Person} from '../types';
import {Avatar} from './Avatar';

export type Target = {conversationId?: string; user?: string};
type Row = {
  key: string;
  target: Target;
  title: string;
  sub: string;
  person?: Person;
  conv?: Conversation;
};

// Chats first (when given), then people from the ERP directory who have no chat yet.
export function Picker({
  people,
  me,
  chats,
  exclude,
  multiple,
  selected,
  onToggle,
}: {
  people: Map<string, Person>;
  me: string;
  chats?: Conversation[];
  exclude?: Set<string>;
  multiple: boolean;
  selected: Target[];
  onToggle: (t: Target) => void;
}) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list: Row[] = [];
    const direct = new Set<string>();
    for (const c of chats || []) {
      if (c.kind === 'direct' && c.peer) direct.add(c.peer);
      const title = convTitle(c, people);
      if (query && !title.toLowerCase().includes(query)) continue;
      list.push({
        key: 'c' + c.id,
        target: {conversationId: c.id},
        title,
        sub:
          c.kind === 'group'
            ? `${c.memberCount} members`
            : people.get(c.peer || '')?.designation || '',
        conv: c,
        person: c.peer ? people.get(c.peer) : undefined,
      });
    }
    const persons = [...people.values()]
      .filter(
        p =>
          p.user !== me &&
          p.user !== ASSISTANT &&
          !direct.has(p.user) &&
          !exclude?.has(p.user),
      )
      .filter(
        p =>
          !query ||
          `${p.name} ${p.department || ''} ${p.designation || ''}`
            .toLowerCase()
            .includes(query),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const p of persons)
      list.push({
        key: 'p' + p.user,
        target: {user: p.user},
        title: p.name,
        sub: [p.designation, p.department].filter(Boolean).join(' · '),
        person: p,
      });
    return list;
  }, [q, people, chats, me, exclude]);
  const isOn = (t: Target) =>
    selected.some(s =>
      t.user ? s.user === t.user : s.conversationId === t.conversationId,
    );
  return (
    <View style={{flex: 1}}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={BRAND.muted} />
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Search name or department"
          placeholderTextColor={BRAND.muted}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={r => r.key}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        ListEmptyComponent={<Text style={styles.empty}>No one found.</Text>}
        renderItem={({item}) => (
          <Pressable style={styles.row} onPress={() => onToggle(item.target)}>
            <Avatar
              person={item.person}
              group={item.conv?.kind === 'group'}
              groupId={item.conv?.id}
              image={item.conv?.image}
              size={42}
            />
            <View style={{flex: 1}}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              {item.sub ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {item.sub}
                </Text>
              ) : null}
            </View>
            {multiple ? (
              <Ionicons
                name={
                  isOn(item.target) ? 'checkmark-circle' : 'ellipse-outline'
                }
                size={24}
                color={isOn(item.target) ? BRAND.accent : BRAND.line}
              />
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
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
    paddingVertical: 9,
  },
  title: {fontSize: 16, color: BRAND.text, fontWeight: '600'},
  sub: {fontSize: 13, color: BRAND.muted},
  empty: {textAlign: 'center', color: BRAND.muted, marginTop: 30},
});
