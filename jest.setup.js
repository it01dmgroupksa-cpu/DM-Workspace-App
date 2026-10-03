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

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
