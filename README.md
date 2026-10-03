# DM Workspace App

DM Workspace App is a cross-platform mobile application built with Expo SDK 57,
React Native 0.86, and React 19.

## Requirements

- Node.js `^20.19.4`, `^22.13.0`, `^24.3.0`, or `>=25`
- Android development: Android Studio, Android SDK, and a Java 17+ JDK
- iOS development: macOS, Xcode, and CocoaPods (iOS 16.4 or later)

## Install dependencies

```sh
npm ci
npx expo install --check
```

## Run the app

Start the Expo development-client server:

```sh
npm start
```

Build and run on a connected device or simulator:

```sh
npm run android
npm run ios
```

The iOS command must be run on macOS. Run `npm test -- --runInBand` for the Jest
suite and `npm run lint` for lint checks.

This is one way to run your app — you can also run it directly from within Android Studio and Xcode respectively.

## Development notes

Now that you have successfully run the app, let's modify it.

1. Open `App.tsx` in your text editor of choice and edit some lines.
2. For **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Developer Menu** (<kbd>Ctrl</kbd> + <kbd>M</kbd> (on Window and Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (on macOS)) to see your changes!

   For **iOS**: Hit <kbd>Cmd ⌘</kbd> + <kbd>R</kbd> in your iOS Simulator to reload the app and see your changes!

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [Introduction to React Native](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you can't get this to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.

## Android release signing

Release builds must use a private upload keystore. Do not commit the keystore or its passwords.
Set these properties in `~/.gradle/gradle.properties` or as environment variables:

```properties
MYAPP_UPLOAD_STORE_FILE=C:/secure/path/to/upload-key.keystore
MYAPP_UPLOAD_STORE_PASSWORD=your-store-password
MYAPP_UPLOAD_KEY_ALIAS=your-key-alias
MYAPP_UPLOAD_KEY_PASSWORD=your-key-password
```

Release builds fail with a clear error when signing is not configured. Debug builds continue
to use the standard Android debug key.
