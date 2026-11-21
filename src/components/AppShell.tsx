import React, {createContext, useContext, useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Line} from 'react-native-svg';
import {ChatIcon} from './icons';

// The app's sidebar (☰) and the round Chat button, which replace the bottom bar.
// Built from plain React Native views and Animated only, so it ships as a silent
// update on every installed build (no new native code).

export const BRAND_BLUE = '#103BA9';

export type MenuItem = {
  name: string; // the screen's route name
  label: string;
  Icon: React.ComponentType<any>;
  section?: string; // a heading shown above the first item of a section
};

type Menu = {open: () => void};
const MenuContext = createContext<Menu>({open: () => {}});
export const useMenu = () => useContext(MenuContext);

export function MenuButton() {
  const {open} = useMenu();
  return (
    <TouchableOpacity
      onPress={open}
      style={styles.menuButton}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
      <Svg width={24} height={24} viewBox="0 0 24 24" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round">
        <Line x1="4" y1="6" x2="20" y2="6" />
        <Line x1="4" y1="12" x2="20" y2="12" />
        <Line x1="4" y1="18" x2="20" y2="18" />
      </Svg>
    </TouchableOpacity>
  );
}

export function AppShell({
  items,
  active,
  onSelect,
  name,
  subtitle,
  chat,
  children,
}: {
  items: MenuItem[];
  active: string;
  onSelect: (name: string) => void;
  name?: string;
  subtitle?: string;
  chat?: {unread: number; onPress: () => void} | null;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const {width} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panel = Math.min(320, Math.round(width * 0.82));

  const animate = (to: number, done?: () => void) =>
    Animated.timing(progress, {
      toValue: to,
      duration: to ? 220 : 180,
      easing: to ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => done?.());

  const open = () => setVisible(true);
  const close = (then?: () => void) =>
    animate(0, () => {
      setVisible(false);
      then?.();
    });

  useEffect(() => {
    if (visible) animate(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const translateX = progress.interpolate({inputRange: [0, 1], outputRange: [-panel, 0]});
  const initials = (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('');

  return (
    <MenuContext.Provider value={{open}}>
      <View style={styles.fill}>
        {children}
        {chat ? (
          <TouchableOpacity
            onPress={chat.onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={chat.unread ? `Chat, ${chat.unread} unread` : 'Chat'}
            style={[styles.fab, {bottom: 22 + insets.bottom}]}>
            <ChatIcon color="#FFFFFF" width={26} height={26} />
            {chat.unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{chat.unread > 99 ? '99+' : chat.unread}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
        <Animated.View style={[styles.backdrop, {opacity: progress}]}>
          <Pressable style={styles.fill} onPress={() => close()} accessibilityLabel="Close menu" />
        </Animated.View>
        <Animated.View style={[styles.panel, {width: panel, transform: [{translateX}]}]}>
          <View style={[styles.head, {paddingTop: insets.top + 20}]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'DM'}</Text>
            </View>
            <Text style={styles.headName} numberOfLines={1}>
              {name || 'DM Workspace'}
            </Text>
            {subtitle ? (
              <Text style={styles.headSub} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={[styles.list, {paddingBottom: insets.bottom + 16}]}>
            {items.map((item, i) => {
              const on = item.name === active;
              const heading = item.section && item.section !== items[i - 1]?.section ? item.section : null;
              return (
                <View key={item.name}>
                  {heading ? <Text style={styles.section}>{heading}</Text> : null}
                  <TouchableOpacity
                    onPress={() => close(() => onSelect(item.name))}
                    style={[styles.item, on && styles.itemOn]}
                    accessibilityRole="menuitem"
                    accessibilityState={{selected: on}}>
                    <item.Icon color={on ? BRAND_BLUE : '#5B6475'} width={22} height={22} />
                    <Text style={[styles.itemText, on && styles.itemTextOn]}>{item.label}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </Animated.View>
      </Modal>
    </MenuContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  menuButton: {paddingHorizontal: 16, paddingVertical: 8},
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: BRAND_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: '#E5383B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {color: '#FFFFFF', fontSize: 11, fontWeight: '700'},
  backdrop: {...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 16, 40, 0.45)'},
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: {width: 4, height: 0},
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  head: {backgroundColor: BRAND_BLUE, paddingHorizontal: 20, paddingBottom: 20},
  list: {paddingTop: 8},
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {color: '#FFFFFF', fontSize: 20, fontWeight: '700'},
  headName: {color: '#FFFFFF', fontSize: 18, fontWeight: '700'},
  headSub: {color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2},
  section: {
    marginTop: 14,
    marginBottom: 4,
    marginHorizontal: 20,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#8A93A6',
    textTransform: 'uppercase',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  itemOn: {backgroundColor: '#E8EEFC'},
  itemText: {marginLeft: 14, fontSize: 15, color: '#26303F', fontWeight: '500'},
  itemTextOn: {color: BRAND_BLUE, fontWeight: '700'},
});
