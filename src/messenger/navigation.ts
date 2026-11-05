import {createContext} from 'react';
import {createNavigationContainerRef} from '@react-navigation/native';

export type MessengerStack = {
  Chats: undefined;
  Chat: {id: string; focus?: string};
  Info: {id: string};
  NewChat: {group?: boolean; addTo?: string};
};

// The app's NavigationContainer uses this, so a tapped notification can open a chat.
export const navigationRef = createNavigationContainerRef<any>();

// Messenger is also a screen of its own over the app, reachable whether or not the
// other tabs are signed in; notifications open chats there.
export function openChat(id: string, focus?: string) {
  if (!navigationRef.isReady()) return false;
  if (!navigationRef.getRootState()?.routeNames?.includes('Messenger'))
    return false;
  navigationRef.navigate('Messenger', {
    screen: 'Chat',
    params: {id, focus},
    initial: false,
  });
  return true;
}

// True for the standalone Messenger screen, which gets a back arrow to the app.
export const StandaloneContext = createContext(false);
