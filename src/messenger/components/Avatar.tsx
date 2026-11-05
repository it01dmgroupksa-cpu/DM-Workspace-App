import React, {useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ASSISTANT, BRAND, ERP_ORIGIN} from '../config';
import {hue, initials} from '../format';
import type {Person} from '../types';

export function Avatar({
  person,
  group,
  size = 46,
  groupId,
}: {
  person?: Person;
  group?: boolean;
  size?: number;
  groupId?: string;
}) {
  const [broken, setBroken] = useState(false);
  const box = {width: size, height: size, borderRadius: size / 2};
  if (group)
    return (
      <View
        style={[
          styles.base,
          box,
          {backgroundColor: `hsl(${hue(groupId || '')}, 45%, 46%)`},
        ]}>
        <Ionicons name="people" size={size * 0.5} color="#fff" />
      </View>
    );
  if (person?.user === ASSISTANT)
    return (
      <View style={[styles.base, box, {backgroundColor: BRAND.accent}]}>
        <Ionicons name="sparkles" size={size * 0.46} color="#fff" />
      </View>
    );
  const image =
    person?.image && !broken
      ? person.image.startsWith('http')
        ? person.image
        : ERP_ORIGIN + person.image
      : null;
  return (
    <View
      style={[
        styles.base,
        box,
        {backgroundColor: `hsl(${hue(person?.user || '')}, 45%, 46%)`},
      ]}>
      <Text style={[styles.initials, {fontSize: size * 0.36}]}>
        {initials(person?.name || '?')}
      </Text>
      {image ? (
        <Image
          source={{uri: image}}
          style={[StyleSheet.absoluteFill, box]}
          onError={() => setBroken(true)}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  base: {alignItems: 'center', justifyContent: 'center', overflow: 'hidden'},
  initials: {color: '#fff', fontWeight: '700'},
});
