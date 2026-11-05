/**
 * @format
 */

import {registerGlobals} from '@livekit/react-native';
import {registerRootComponent} from 'expo';
import App from './App';

// WebRTC for Messenger calls; must run before anything uses LiveKit.
registerGlobals();
registerRootComponent(App);
