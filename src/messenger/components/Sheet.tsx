import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {BRAND} from '../config';

export type SheetItem = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  danger?: boolean;
  onPress: () => void;
};

// A bottom sheet of actions; the long-press menu and the chat menus all use it.
export function Sheet({
  visible,
  onClose,
  header,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  header?: React.ReactNode;
  items: SheetItem[];
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {header}
          <ScrollView bounces={false} style={{maxHeight: 480}}>
            {items.map(item => (
              <Pressable
                key={item.label}
                style={({pressed}) => [
                  styles.row,
                  pressed && {backgroundColor: BRAND.bg},
                ]}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}>
                <Ionicons
                  name={item.icon}
                  size={21}
                  color={item.danger ? BRAND.danger : BRAND.sub}
                />
                <Text
                  style={[styles.text, item.danger && {color: BRAND.danger}]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{height: 24}} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  text: {fontSize: 16, color: BRAND.text},
});
