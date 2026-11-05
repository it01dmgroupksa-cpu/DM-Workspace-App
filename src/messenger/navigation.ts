import {createNavigationContainerRef} from '@react-navigation/native';

export type MessengerStack = {
  Chats: undefined;
  Chat: {id: string; focus?: string};
  Info: {id: string};
  NewChat: {group?: boolean; addTo?: string};
};

// The app's NavigationContainer uses this, so a tapped notification can open a chat.
export const navigationRef = createNavigationContainerRef<any>();

export function openChat(id: string, focus?: string) {
  if (!navigationRef.isReady()) return false;
  navigationRef.navigate('Home', {
    screen: 'Chat',
    params: {screen: 'Chat', params: {id, focus}, initial: false},
  });
  return true;
}
