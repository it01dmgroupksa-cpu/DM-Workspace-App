const {jest} = require('@jest/globals');

require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-blob-util', () => ({
  config: jest.fn(),
  fs: {
    dirs: {
      DocumentDir: '/tmp',
      DownloadDir: '/tmp',
    },
  },
}));

jest.mock('react-native-webview', () => ({
  WebView: require('react-native').View,
}));

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');

  return {
    ArrowLeft: View,
    ArrowRight: View,
    RefreshCw: View,
  };
});

jest.mock('expo-camera', () => ({
  CameraView: require('react-native').View,
  useCameraPermissions: () => [{granted: true}, jest.fn()],
}));

jest.mock('expo-location', () => ({
  Accuracy: {High: 6},
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({
    status: 'granted',
  }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {latitude: 0, longitude: 0},
  }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(),
  useNetInfo: jest.fn(),
}));

// Reanimated 4 runs on react-native-worklets, whose native module is absent in tests
// (the sidebar's drawer is the first screen to load Reanimated).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);

// Durar Messenger's native modules.
jest.mock('expo-audio', () => ({
  RecordingPresets: {HIGH_QUALITY: {}},
  useAudioRecorder: () => ({
    prepareToRecordAsync: jest.fn(),
    record: jest.fn(),
    stop: jest.fn(),
    uri: null,
  }),
  createAudioPlayer: jest.fn(() => ({play: jest.fn(), pause: jest.fn(), remove: jest.fn()})),
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  requestRecordingPermissionsAsync: jest
    .fn()
    .mockResolvedValue({granted: true}),
}));

jest.mock('expo-video', () => ({
  useVideoPlayer: jest.fn(),
  VideoView: require('react-native').View,
}));

jest.mock('expo-image-picker', () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({granted: true}),
}));

jest.mock('expo-clipboard', () => ({setStringAsync: jest.fn()}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('expo-device', () => ({isDevice: false}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: {HIGH: 4, MAX: 5},
  AndroidNotificationVisibility: {PUBLIC: 1},
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({granted: false}),
  requestPermissionsAsync: jest.fn().mockResolvedValue({granted: false}),
  getExpoPushTokenAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: jest.fn(() => ({remove: jest.fn()})),
  getPresentedNotificationsAsync: jest.fn().mockResolvedValue([]),
  dismissNotificationAsync: jest.fn(),
  dismissAllNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  unregisterForNotificationsAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-sse', () => jest.fn());

jest.mock('livekit-client', () => {
  const preset = (width, height) => ({resolution: {width, height}});
  return {
    Track: {Source: {Camera: 'camera'}},
    VideoPresets: {
      h360: preset(640, 360),
      h720: preset(1280, 720),
      h1080: preset(1920, 1080),
    },
  };
});

jest.mock('@livekit/react-native', () => ({
  registerGlobals: jest.fn(),
  AudioSession: {
    configureAudio: jest.fn(),
    startAudioSession: jest.fn(),
    stopAudioSession: jest.fn(),
    selectAudioOutput: jest.fn(),
  },
  LiveKitRoom: ({children}) => children,
  VideoTrack: require('react-native').View,
  isTrackReference: () => true,
  useLocalParticipant: jest.fn(),
  useTracks: () => [],
  useRemoteParticipants: () => [],
  useRoomContext: () => ({on: jest.fn(), off: jest.fn()}),
}));

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
    getItemAsync: jest.fn(async key => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async key => void store.delete(key)),
    __store: store,
  };
});
