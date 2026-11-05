import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import {useMessenger} from '../store';
import type {MessengerStack} from '../navigation';
import {Picker, type Target} from '../components/Picker';

// One screen for a new direct chat, a new group, and adding people to a group.
export function NewChatScreen({
  route,
  navigation,
}: StackScreenProps<MessengerStack, 'NewChat'>) {
  const {group, addTo} = route.params || {};
  const {messenger} = useMessenger();
  const multiple = !!group || !!addTo;
  const [selected, setSelected] = useState<Target[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<Set<string> | undefined>();
  // People already in the group are left out of the list.
  useEffect(() => {
    if (!addTo) return;
    relay<{members: {user: string}[]}>('conversations.members', {
      conversationId: addTo,
    })
      .then(({members: list}) => setMembers(new Set(list.map(m => m.user))))
      .catch(() => setMembers(new Set()));
  }, [addTo]);

  async function toggle(t: Target) {
    if (!multiple) {
      setBusy(true);
      try {
        const id = await messenger.openDirect(t.user!);
        navigation.replace('Chat', {id});
      } catch (error: any) {
        Alert.alert('Messenger', error.message);
        setBusy(false);
      }
      return;
    }
    setSelected(s =>
      s.some(x => x.user === t.user)
        ? s.filter(x => x.user !== t.user)
        : [...s, t],
    );
  }
  async function done() {
    const users = selected.map(t => t.user!);
    if (!users.length) return;
    if (group && !title.trim())
      return Alert.alert('New group', 'Give the group a name.');
    setBusy(true);
    try {
      if (addTo) {
        await messenger.groupAction('groups.add', {
          conversationId: addTo,
          users,
        });
        navigation.goBack();
      } else {
        const id = await messenger.createGroup(title.trim(), users);
        navigation.replace('Chat', {id});
      }
    } catch (error: any) {
      Alert.alert('Messenger', error.message);
      setBusy(false);
    }
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
        <View style={{flex: 1}}>
          <Text style={styles.heading}>
            {addTo ? 'Add members' : group ? 'New group' : 'New chat'}
          </Text>
          {multiple ? (
            <Text style={styles.sub}>{selected.length} selected</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.body}>
        {group ? (
          <TextInput
            style={styles.title}
            value={title}
            onChangeText={setTitle}
            placeholder="Group name"
            placeholderTextColor={BRAND.muted}
            maxLength={80}
          />
        ) : null}
        {busy && !multiple ? (
          <ActivityIndicator style={{margin: 20}} color={BRAND.navy} />
        ) : null}
        {addTo && !members ? (
          <ActivityIndicator style={{margin: 20}} color={BRAND.navy} />
        ) : (
          <Picker
            people={messenger.people}
            me={messenger.me}
            exclude={members}
            multiple={multiple}
            selected={selected}
            onToggle={toggle}
          />
        )}
        {multiple && selected.length ? (
          <Pressable
            style={styles.fab}
            onPress={done}
            disabled={busy}
            accessibilityLabel="Done">
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Ionicons name="checkmark" size={26} color="#fff" />
            )}
          </Pressable>
        ) : null}
      </View>
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
  sub: {color: '#c7d2e0', fontSize: 12.5},
  body: {flex: 1, backgroundColor: '#fff'},
  title: {
    margin: 12,
    marginBottom: 0,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.accent,
    fontSize: 17,
    paddingVertical: 8,
    color: BRAND.text,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: BRAND.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});
