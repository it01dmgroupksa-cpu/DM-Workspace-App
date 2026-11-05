import React from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {useVideoPlayer, VideoView} from 'expo-video';
import type {Message} from '../types';

function Video({url}: {url: string}) {
  const player = useVideoPlayer({uri: url}, p => p.play());
  return (
    <VideoView
      player={player}
      style={styles.media}
      nativeControls
      contentFit="contain"
    />
  );
}

// Full-screen photo or video with a Back button; Android's back button closes it too.
export function MediaViewer({
  message,
  from,
  onClose,
}: {
  message: Message | null;
  from: string;
  onClose: () => void;
}) {
  const f = message?.file;
  return (
    <Modal
      visible={!!f?.url}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaView style={styles.root}>
        <View style={styles.bar}>
          <Pressable
            onPress={onClose}
            style={styles.back}
            accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={{flex: 1}}>
            <Text style={styles.from} numberOfLines={1}>
              {from}
            </Text>
            <Text style={styles.name} numberOfLines={1}>
              {f?.name}
            </Text>
          </View>
          {f?.url ? (
            <Pressable
              onPress={() => Linking.openURL(f.url + '&download=1')}
              accessibilityLabel="Download"
              style={{padding: 8}}>
              <Ionicons name="download-outline" size={22} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.stage}>
          {f?.url && /^video\//.test(f.mime || '') ? (
            <Video url={f.url} />
          ) : f?.url ? (
            <Image
              source={{uri: f.url}}
              style={styles.media}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0b141a'},
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 12,
    paddingLeft: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  backText: {color: '#fff', fontWeight: '600'},
  from: {color: '#fff', fontWeight: '600'},
  name: {color: '#aebac1', fontSize: 12},
  stage: {flex: 1},
  media: {flex: 1, width: '100%'},
});
