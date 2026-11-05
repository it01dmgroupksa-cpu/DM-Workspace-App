import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import RNBlobUtil from 'react-native-blob-util';
import {BRAND} from '../config';
import {clock, personOf} from '../format';
import type {Message, Person} from '../types';

export type PickedFile = {
  uri: string;
  name: string;
  mime: string;
  size: number;
};
type Props = {
  conversationId: string;
  disabled?: string;
  replyTo: Message | null;
  editing: Message | null;
  me: string;
  people: Map<string, Person>;
  inCall: boolean;
  onCancel: () => void;
  onSend: (text: string) => void;
  onFiles: (
    files: PickedFile[],
    voice: boolean,
    conversationId: string,
  ) => void;
  onTyping: () => void;
};

async function sizeOf(uri: string) {
  try {
    return (
      Number(
        (
          await RNBlobUtil.fs.stat(
            decodeURIComponent(uri.replace(/^file:\/\//, '')),
          )
        ).size,
      ) || 0
    );
  } catch {
    return 0;
  }
}

export type ComposerHandle = {
  recording: () => boolean;
  finish: () => Promise<void>;
};

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  {
    conversationId,
    disabled,
    replyTo,
    editing,
    me,
    people,
    inCall,
    onCancel,
    onSend,
    onFiles,
    onTyping,
  },
  ref,
) {
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [recording, setRecording] = useState<{
    started: number;
    conversationId: string;
  } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const starting = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    if (editing) setText(editing.body);
  }, [editing]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const secs = (Date.now() - recording.started) / 1000;
      setElapsed(secs);
      if (secs >= 300) stopRecording(false);
    }, 250);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);
  useEffect(
    () => () => {
      live.current = false;
    },
    [],
  );
  // The chat screen calls finish() before leaving, so a voice note in progress is sent
  // to the chat it was recorded in rather than lost.
  const recordingRef = useRef(recording);
  recordingRef.current = recording;
  useImperativeHandle(ref, () => ({
    recording: () => !!recordingRef.current,
    finish: () => stopRecording(false),
  }));

  async function startRecording() {
    if (starting.current || recording) return; // a double tap starts one recording
    if (inCall)
      return Alert.alert(
        'In a call',
        "You can't record a voice message during a call.",
      );
    const target = conversationId; // fixed before the permission prompt
    starting.current = true;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted)
        return Alert.alert(
          'Microphone',
          'Allow microphone access to record a voice message.',
        );
      if (!live.current) return;
      await setAudioModeAsync({allowsRecording: true, playsInSilentMode: true});
      await recorder.prepareToRecordAsync();
      recorder.record();
      setElapsed(0);
      setRecording({started: Date.now(), conversationId: target});
    } catch {
      Alert.alert('Microphone', 'Recording could not start.');
    } finally {
      starting.current = false;
    }
  }
  async function stopRecording(cancel: boolean) {
    const current = recordingRef.current;
    if (!current) return;
    setRecording(null);
    try {
      await recorder.stop();
    } catch {
      /* already stopped */
    }
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    }).catch(() => {});
    const uri = recorder.uri;
    if (cancel || !uri || Date.now() - current.started < 800) return;
    const name = `voice-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.m4a`;
    onFiles(
      [{uri, name, mime: 'audio/mp4', size: await sizeOf(uri)}],
      true,
      current.conversationId,
    );
  }

  async function pick(kind: 'gallery' | 'camera' | 'document') {
    setMenu(false);
    const target = conversationId;
    try {
      if (kind === 'document') {
        const result = await DocumentPicker.getDocumentAsync({
          multiple: true,
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        onFiles(
          result.assets.map(a => ({
            uri: a.uri,
            name: a.name,
            mime: a.mimeType || 'application/octet-stream',
            size: a.size || 0,
          })),
          false,
          target,
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        allowsMultipleSelection: kind === 'gallery',
      };
      if (kind === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          return Alert.alert('Camera', 'Allow camera access to take a photo.');
      }
      const result =
        kind === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const files = await Promise.all(
        result.assets.map(async a => ({
          uri: a.uri,
          name:
            a.fileName ||
            `${a.type === 'video' ? 'video' : 'photo'}-${Date.now()}.${
              a.type === 'video' ? 'mp4' : 'jpg'
            }`,
          mime: a.mimeType || (a.type === 'video' ? 'video/mp4' : 'image/jpeg'),
          size: a.fileSize || (await sizeOf(a.uri)),
        })),
      );
      onFiles(files, false, target);
    } catch {
      Alert.alert('Attach', 'That file could not be opened.');
    }
  }

  function submit() {
    const body = text.replace(/\s+$/, '');
    if (!body.trim()) return;
    setText('');
    onSend(body);
  }

  if (disabled)
    return (
      <View style={styles.readonly}>
        <Text style={styles.readonlyText}>{disabled}</Text>
      </View>
    );
  const target = editing || replyTo;
  return (
    <View style={styles.wrap}>
      {target ? (
        <View style={styles.replying}>
          <View style={{flex: 1}}>
            <Text style={styles.replyWho}>
              {editing
                ? 'Edit message'
                : target.sender === me
                ? 'You'
                : personOf(people, target.sender).name}
            </Text>
            <Text numberOfLines={1} style={styles.replyText}>
              {target.body || target.file?.name || 'Attachment'}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (editing) setText('');
              onCancel();
            }}
            accessibilityLabel="Cancel">
            <Ionicons name="close" size={22} color={BRAND.sub} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.row}>
        {recording ? (
          <View style={styles.recording}>
            <View style={styles.dot} />
            <Text style={styles.recTime}>{clock(elapsed)}</Text>
            <Text style={styles.recHint}>Recording…</Text>
            <Pressable
              onPress={() => stopRecording(true)}
              accessibilityLabel="Discard voice message"
              style={styles.icon}>
              <Ionicons name="trash-outline" size={22} color={BRAND.danger} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.box}>
            {!editing ? (
              <Pressable
                onPress={() => setMenu(true)}
                style={styles.icon}
                accessibilityLabel="Attach">
                <Ionicons name="attach" size={24} color={BRAND.sub} />
              </Pressable>
            ) : null}
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={value => {
                setText(value);
                if (value.trim()) onTyping();
              }}
              placeholder="Message"
              placeholderTextColor={BRAND.muted}
              multiline
              maxLength={4000}
            />
            {!editing ? (
              <Pressable
                onPress={() => pick('camera')}
                style={styles.icon}
                accessibilityLabel="Camera">
                <Ionicons name="camera-outline" size={23} color={BRAND.sub} />
              </Pressable>
            ) : null}
          </View>
        )}
        <Pressable
          style={styles.send}
          onPress={() =>
            recording
              ? stopRecording(false)
              : text.trim() || editing
              ? submit()
              : startRecording()
          }
          accessibilityLabel={
            recording || text.trim() || editing
              ? 'Send'
              : 'Record voice message'
          }>
          <Ionicons
            name={recording || text.trim() || editing ? 'send' : 'mic'}
            size={21}
            color="#fff"
          />
        </Pressable>
      </View>
      <Modal
        visible={menu}
        transparent
        animationType="fade"
        onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(false)}>
          <View style={styles.sheet}>
            {(
              [
                ['gallery', 'images', 'Photos & videos'],
                ['camera', 'camera', 'Camera'],
                ['document', 'document', 'Document'],
              ] as const
            ).map(([kind, icon, label]) => (
              <Pressable
                key={kind}
                style={styles.sheetRow}
                onPress={() => pick(kind)}>
                <Ionicons name={icon} size={22} color={BRAND.accent} />
                <Text style={styles.sheetText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
});
const styles = StyleSheet.create({
  wrap: {backgroundColor: '#f0f2f5', paddingBottom: 6},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 6,
    paddingTop: 6,
    gap: 6,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 4,
    minHeight: 46,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: BRAND.text,
    maxHeight: 130,
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 12,
  },
  icon: {padding: 10},
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: BRAND.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recording: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingLeft: 16,
    minHeight: 46,
    gap: 10,
  },
  dot: {width: 10, height: 10, borderRadius: 5, backgroundColor: BRAND.danger},
  recTime: {fontVariant: ['tabular-nums'], color: BRAND.text, fontSize: 16},
  recHint: {flex: 1, color: BRAND.muted},
  replying: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginTop: 6,
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.accent,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  replyWho: {color: BRAND.accent, fontWeight: '700', fontSize: 13},
  replyText: {color: BRAND.sub, fontSize: 13},
  readonly: {padding: 16, backgroundColor: '#f0f2f5', alignItems: 'center'},
  readonlyText: {color: BRAND.sub},
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingVertical: 10,
    paddingBottom: 30,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  sheetText: {fontSize: 16, color: BRAND.text},
});
