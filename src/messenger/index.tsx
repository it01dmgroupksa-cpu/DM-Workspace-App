import React from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {createStackNavigator} from '@react-navigation/stack';
import {BRAND} from './config';
import {MessengerProvider, useMaybeMessenger} from './store';
import {CallProvider} from './calls';
import {PushBridge} from './push';
import {ChatSessionProvider, useChatSession} from './session';
import {StandaloneContext, type MessengerStack} from './navigation';
import {ChatsScreen} from './screens/ChatsScreen';
import {ChatScreen} from './screens/ChatScreen';
import {InfoScreen} from './screens/InfoScreen';
import {NewChatScreen} from './screens/NewChatScreen';
import {SignInScreen} from './screens/SignInScreen';

export {navigationRef} from './navigation';
export {useUnread} from './store';
export {useChatSession} from './session';

function Signed({children}: {children: React.ReactNode}) {
  const {session} = useChatSession();
  return (
    <MessengerProvider user={session?.user ?? null}>
      <View style={styles.fill}>
        <CallProvider>
          {children}
          <Push />
        </CallProvider>
      </View>
    </MessengerProvider>
  );
}
function Push() {
  return useMaybeMessenger() ? <PushBridge /> : null;
}

// Wraps the whole app. Messenger follows its own sign-in (session.tsx), not the
// other tabs', so messages and calls arrive whichever screen is open, signed in to
// the rest of the app or not.
export function MessengerRoot({children}: {children: React.ReactNode}) {
  return (
    <SafeAreaProvider>
      <ChatSessionProvider>
        <Signed>{children}</Signed>
      </ChatSessionProvider>
    </SafeAreaProvider>
  );
}

const Stack = createStackNavigator<MessengerStack>();

function Chats({standalone}: {standalone?: boolean}) {
  const {status} = useChatSession();
  if (status === 'loading')
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator color={BRAND.navy} />
      </View>
    );
  if (status === 'signedOut') return <SignInScreen standalone={standalone} />;
  return (
    <StandaloneContext.Provider value={!!standalone}>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        <Stack.Screen name="Chats" component={ChatsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Info" component={InfoScreen} />
        <Stack.Screen name="NewChat" component={NewChatScreen} />
      </Stack.Navigator>
    </StandaloneContext.Provider>
  );
}
// The Chat tab, for employees signed in to the app.
export function MessengerTab() {
  return <Chats />;
}
// Messenger on its own, from the sign-in page or a notification.
export function MessengerScreen() {
  return <Chats standalone />;
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  center: {alignItems: 'center', justifyContent: 'center'},
});
