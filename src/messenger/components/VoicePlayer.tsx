import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import {BRAND} from '../config';
import {clock} from '../format';
import {Waveform, shapeFor} from './Waveform';

// One voice note plays at a time, as in WhatsApp.
let current: {id: string; player: AudioPlayer; stop: () => void} | null = null;
const RATES = [1, 1.5, 2];

export function VoicePlayer({id, url}: {id: string; url: string}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [width, setWidth] = useState(1);
  const player = useRef<AudioPlayer | null>(null);
  const bars = useMemo(() => shapeFor(id, 32), [id]);

  useEffect(
    () => () => {
      if (current?.id === id) current = null;
      player.current?.remove();
      player.current = null;
    },
    [id],
  );
  function ensure() {
    if (player.current) return player.current;
    const p = createAudioPlayer({uri: url}, {updateInterval: 250});
    p.addListener('playbackStatusUpdate', status => {
      setPosition(status.currentTime || 0);
      if (status.duration && Number.isFinite(status.duration))
        setDuration(status.duration);
      setPlaying(!!status.playing);
      if (status.didJustFinish) {
        p.pause();
        p.seekTo(0);
        setPosition(0);
        setPlaying(false);
      }
    });
    player.current = p;
    return p;
  }
  async function toggle() {
    const p = ensure();
    if (p.playing || playing) {
      setPlaying(false); // react at once; the player confirms a moment later
      return p.pause();
    }
    setPlaying(true);
    if (current && current.id !== id) current.stop();
    current = {
      id,
      player: p,
      stop: () => {
        p.pause();
        setPlaying(false);
      },
    };
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
    }).catch(() => {});
    p.setPlaybackRate(rate);
    p.play();
  }
  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    player.current?.setPlaybackRate(next);
  }
  function seek(x: number) {
    const p = ensure();
    if (duration) p.seekTo(Math.max(0, Math.min(1, x / width)) * duration);
  }
  const progress = duration ? Math.min(1, position / duration) : 0;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        style={({pressed}) => [styles.play, pressed && {opacity: 0.7}]}
        hitSlop={8}
        accessibilityLabel={playing ? 'Pause' : 'Play voice message'}>
        <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#fff" />
      </Pressable>
      <Pressable
        style={styles.track}
        hitSlop={{top: 10, bottom: 10}}
        onLayout={e => setWidth(e.nativeEvent.layout.width)}
        onPress={e => seek(e.nativeEvent.locationX)}>
        <Waveform levels={bars} progress={progress} height={26} />
      </Pressable>
      <Text style={styles.time}>
        {clock(position > 0 ? position : duration)}
      </Text>
      <Pressable
        onPress={cycleRate}
        hitSlop={8}
        style={styles.rate}
        accessibilityLabel="Playback speed">
        <Text style={styles.rateText}>{rate}×</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 260,
    gap: 8,
    paddingVertical: 2,
  },
  play: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {flex: 1, height: 28, justifyContent: 'center'},
  time: {
    minWidth: 34,
    color: BRAND.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  rate: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#e3e8eb',
  },
  rateText: {fontSize: 11.5, fontWeight: '600', color: BRAND.sub},
});
