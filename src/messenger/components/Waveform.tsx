import React from 'react';
import {StyleSheet, View} from 'react-native';
import {BRAND} from '../config';

// Bars like WhatsApp's voice notes. `levels` are 0..1 heights; `progress` (0..1) colours
// the played part.
export function Waveform({
  levels,
  progress,
  height = 28,
  color = BRAND.accent,
  idle = '#c8d1d6',
}: {
  levels: number[];
  progress?: number;
  height?: number;
  color?: string;
  idle?: string;
}) {
  return (
    <View style={[styles.row, {height}]} pointerEvents="none">
      {levels.map((level, i) => {
        const played = progress !== undefined && (i + 0.5) / levels.length <= progress;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: Math.max(3, Math.min(1, level) * height),
                backgroundColor:
                  progress === undefined || played ? color : idle,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// A stable pseudo-random shape for a played voice note (the file carries no peaks).
export function shapeFor(id: string, count: number) {
  let seed = 7;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  return Array.from({length: count}, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return 0.25 + (seed / 4294967296) * 0.75;
  });
}

// Microphone level in decibels (about -60 quiet .. 0 loud) to a 0..1 bar height.
export function levelOf(db?: number) {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0.1;
  return Math.max(0.08, Math.min(1, (db + 55) / 50));
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1},
  bar: {flex: 1, minWidth: 2, maxWidth: 4, borderRadius: 2},
});
