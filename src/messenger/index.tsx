import React from 'react';
import {View} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {MessengerProvider} from './store';
import {CallProvider} from './calls';
import {PushBridge} from './push';
import type {MessengerStack} from './navigation';
import {ChatsScreen} from './screens/ChatsScreen';
import {ChatScreen} from './screens/ChatScreen';
import {InfoScreen} from './screens/InfoScreen';
import {NewChatScreen} from './screens/NewChatScreen';

export {navigationRef} from './navigation';
export {useUnread} from './store';

// Wraps the signed-in app, so messages and calls arrive whichever tab is open.
export function MessengerRoot({
  user,
  children,
}: {
  user: string;
  children: React.ReactNode;
}) {
  return (
    <MessengerProvider user={user}>
      <CallProvider>
        <View style={{flex: 1}}>{children}</View>
        <PushBridge />
      </CallProvider>
    </MessengerProvider>
  );
}

const Stack = createStackNavigator<MessengerStack>();

// The Chat tab.
export function MessengerTab() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Chats" component={ChatsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Info" component={InfoScreen} />
      <Stack.Screen name="NewChat" component={NewChatScreen} />
    </Stack.Navigator>
  );
}
