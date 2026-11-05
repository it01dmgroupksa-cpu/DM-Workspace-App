import React, {memo} from 'react';
import {Image, Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ASSISTANT, BRAND} from '../config';
import {
  callEntry,
  fileSize,
  hue,
  personOf,
  systemText,
  ticks,
  time,
} from '../format';
import type {Conversation, Message, Person} from '../types';
import {VoicePlayer} from './VoicePlayer';

type Props = {
  m: Message;
  me: string;
  conv: Conversation;
  people: Map<string, Person>;
  first: boolean;
  highlight?: boolean;
  onMenu: (m: Message) => void;
  onView: (m: Message) => void;
  onQuote: (id: string) => void;
  onRetry: (m: Message) => void;
  onCallBack: (video: boolean) => void;
  onOriginal: (m: Message) => void;
};

function Ticks({state}: {state: ReturnType<typeof ticks>}) {
  if (!state) return null;
  if (state === 'pending')
    return <Ionicons name="time-outline" size={13} color={BRAND.muted} />;
  if (state === 'failed')
    return <Ionicons name="alert-circle" size={15} color={BRAND.danger} />;
  return (
    <Ionicons
      name={state === 'sent' ? 'checkmark' : 'checkmark-done'}
      size={15}
      color={state === 'read' ? BRAND.read : BRAND.muted}
    />
  );
}

export const Bubble = memo(function Bubble({
  m,
  me,
  conv,
  people,
  first,
  highlight,
  onMenu,
  onView,
  onQuote,
  onRetry,
  onCallBack,
  onOriginal,
}: Props) {
  if (m.kind === 'system') {
    const call = callEntry(m);
    const text = systemText(m, me, people);
    if (call)
      return (
        <Pressable
          style={styles.sysWrap}
          onPress={() => onCallBack(!!call.video)}>
          <View style={styles.sys}>
            <Ionicons
              name={call.video ? 'videocam' : 'call'}
              size={14}
              color={
                call.reason !== 'completed' && m.sender !== me
                  ? BRAND.danger
                  : BRAND.sub
              }
            />
            <Text
              style={[
                styles.sysText,
                call.reason !== 'completed' &&
                  m.sender !== me && {color: BRAND.danger},
              ]}>
              {text}
            </Text>
            <Text style={styles.sysTime}>{time(m.createdAt)}</Text>
          </View>
        </Pressable>
      );
    return (
      <View style={styles.sysWrap}>
        <View style={styles.sys}>
          <Text style={styles.sysText}>{text}</Text>
        </View>
      </View>
    );
  }
  const mine = m.sender === me;
  const sender = personOf(people, m.sender);
  const f = m.file;
  const shown = m.translation?.body || m.body;
  const state = mine ? ticks(m, conv) : null;
  return (
    <View
      style={[
        styles.row,
        mine ? styles.right : styles.left,
        first && {marginTop: 8},
      ]}>
      <Pressable
        onLongPress={() => !m.deleted && !m.pending && onMenu(m)}
        onPress={() => m.failed && onRetry(m)}
        delayLongPress={300}
        style={[
          styles.bubble,
          mine ? styles.mine : styles.theirs,
          highlight && styles.flash,
        ]}>
        {conv.kind === 'group' && !mine && first ? (
          <Text
            style={[styles.who, {color: `hsl(${hue(m.sender)}, 55%, 38%)`}]}>
            {sender.name}
          </Text>
        ) : null}
        {m.deleted ? (
          <Text style={styles.deleted}>
            <Ionicons name="ban-outline" size={13} /> This message was deleted
          </Text>
        ) : (
          <>
            {m.byAssistant && m.sender !== ASSISTANT ? (
              <View style={styles.tag}>
                <Ionicons name="sparkles" size={12} color={BRAND.accent} />
                <Text style={styles.tagText}>Sent by Durar Assistant</Text>
              </View>
            ) : null}
            {m.forwarded ? (
              <View style={styles.tag}>
                <Ionicons
                  name="arrow-redo-outline"
                  size={12}
                  color={BRAND.muted}
                />
                <Text
                  style={[
                    styles.tagText,
                    {color: BRAND.muted, fontStyle: 'italic'},
                  ]}>
                  Forwarded
                </Text>
              </View>
            ) : null}
            {m.reply ? (
              <Pressable
                style={styles.quote}
                onPress={() => onQuote(m.reply!.id)}>
                <Text style={styles.quoteWho}>
                  {m.reply.sender === me
                    ? 'You'
                    : personOf(people, m.reply.sender).name}
                </Text>
                <Text numberOfLines={2} style={styles.quoteText}>
                  {m.reply.deleted
                    ? 'Deleted message'
                    : m.reply.body || m.reply.file || 'Attachment'}
                </Text>
              </Pressable>
            ) : null}
            {f && !f.url ? (
              <View style={styles.file}>
                <Ionicons
                  name={m.failed ? 'alert-circle' : 'cloud-upload-outline'}
                  size={20}
                  color={m.failed ? BRAND.danger : BRAND.sub}
                />
                <Text numberOfLines={1} style={styles.fileName}>
                  {m.kind === 'voice' ? 'Voice message' : f.name}
                </Text>
              </View>
            ) : f && m.kind === 'image' ? (
              <Pressable onPress={() => onView(m)}>
                <Image
                  source={{uri: f.url}}
                  style={[
                    styles.image,
                    {
                      aspectRatio:
                        f.width && f.height
                          ? Math.max(0.6, Math.min(1.8, f.width / f.height))
                          : 1.33,
                    },
                  ]}
                />
              </Pressable>
            ) : f && m.kind === 'voice' ? (
              <VoicePlayer id={m.id} url={f.url!} />
            ) : f && /^video\//.test(f.mime || '') ? (
              <Pressable onPress={() => onView(m)} style={styles.video}>
                <Ionicons name="play-circle" size={54} color="#fff" />
                <Text style={styles.videoName} numberOfLines={1}>
                  {f.name} · {fileSize(f.size)}
                </Text>
              </Pressable>
            ) : f ? (
              <Pressable
                style={styles.file}
                onPress={() => Linking.openURL(f.url + '&download=1')}>
                <Ionicons name="document-text" size={26} color={BRAND.accent} />
                <View style={{flex: 1}}>
                  <Text numberOfLines={1} style={styles.fileName}>
                    {f.name}
                  </Text>
                  <Text style={styles.fileSize}>{fileSize(f.size)}</Text>
                </View>
                <Ionicons name="download-outline" size={20} color={BRAND.sub} />
              </Pressable>
            ) : null}
            {shown ? <Text style={styles.text}>{shown}</Text> : null}
            {m.translation ? (
              <Pressable style={styles.tag} onPress={() => onOriginal(m)}>
                <Ionicons name="language" size={12} color={BRAND.muted} />
                <Text style={[styles.tagText, {color: BRAND.muted}]}>
                  Translated to{' '}
                  {m.translation.lang === 'ar' ? 'Arabic' : 'English'} ·{' '}
                  <Text style={{color: BRAND.accent}}>Show original</Text>
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
        <View style={styles.meta}>
          {m.editedAt && !m.deleted ? (
            <Text style={styles.metaText}>edited</Text>
          ) : null}
          <Text style={styles.metaText}>{time(m.createdAt)}</Text>
          {mine ? <Ticks state={state} /> : null}
        </View>
        {m.failed ? (
          <Text style={styles.failed}>Not sent. Tap to retry.</Text>
        ) : null}
      </Pressable>
      {m.reactions?.length ? (
        <View
          style={[
            styles.reactions,
            mine ? {alignSelf: 'flex-end'} : {alignSelf: 'flex-start'},
          ]}>
          <Text style={{fontSize: 13}}>
            {[...new Set(m.reactions.map(r => r.emoji))].join(' ')}
            {m.reactions.length > 1 ? ` ${m.reactions.length}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {paddingHorizontal: 10, marginTop: 2},
  left: {alignItems: 'flex-start'},
  right: {alignItems: 'flex-end'},
  bubble: {
    maxWidth: '82%',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 1,
    shadowOffset: {width: 0, height: 1},
    elevation: 1,
  },
  mine: {backgroundColor: BRAND.mine},
  theirs: {backgroundColor: BRAND.theirs},
  flash: {borderWidth: 2, borderColor: '#f59e0b'},
  who: {fontSize: 13, fontWeight: '700', marginBottom: 2},
  text: {fontSize: 15.5, color: BRAND.text, lineHeight: 21},
  deleted: {fontStyle: 'italic', color: BRAND.muted},
  tag: {flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2},
  tagText: {fontSize: 11.5, fontWeight: '600', color: BRAND.accent},
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND.accent,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
  },
  quoteWho: {fontWeight: '700', color: BRAND.accent, fontSize: 12.5},
  quoteText: {color: BRAND.sub, fontSize: 13},
  image: {
    width: 240,
    borderRadius: 8,
    marginBottom: 3,
    backgroundColor: '#dde3e6',
  },
  video: {
    width: 240,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#1f2c33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  videoName: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    right: 8,
    color: '#fff',
    fontSize: 12,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    width: 240,
    marginBottom: 3,
  },
  fileName: {color: BRAND.text, fontWeight: '600', flexShrink: 1},
  fileSize: {color: BRAND.muted, fontSize: 12},
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 1,
  },
  metaText: {fontSize: 11, color: BRAND.muted},
  failed: {color: BRAND.danger, fontSize: 11.5, marginTop: 2},
  reactions: {
    marginTop: -4,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: BRAND.line,
  },
  sysWrap: {alignItems: 'center', marginVertical: 6},
  sys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '86%',
  },
  sysText: {
    color: BRAND.sub,
    fontSize: 12.5,
    textAlign: 'center',
    flexShrink: 1,
  },
  sysTime: {color: BRAND.muted, fontSize: 11},
});
