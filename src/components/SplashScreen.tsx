import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Text, Animated } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native'; // Import CommonActions for reset

const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const logoOpacity = useRef(new Animated.Value(0)).current; // Initial opacity for logo
  const textOpacity = useRef(new Animated.Value(0)).current; // Initial opacity for text

  // Simulate a loading process
  useEffect(() => {
    // Fade-in animation for logo
    const logoAnimation = Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    });
    logoAnimation.start();

    // Delay the text fade-in by 1 second, after the logo starts appearing
    let textAnimation: Animated.CompositeAnimation | undefined;
    const textTimer = setTimeout(() => {
      textAnimation = Animated.timing(textOpacity, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      });
      textAnimation.start();
    }, 1000);

    const navigationTimer = setTimeout(() => {
      // Use reset to clear the stack and navigate to the main app
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AppContent' }], // Navigate to AppContent after splash
        })
      );
    }, 4000); // 4 seconds delay for the splash screen

    return () => {
      clearTimeout(textTimer);
      clearTimeout(navigationTimer);
      logoAnimation.stop();
      textAnimation?.stop();
    };
  }, [logoOpacity, textOpacity, navigation]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity }]}>
        <Image
          source={require('./images/dmlogo.png')}
          style={styles.logo}
        />
      </Animated.View>
      
      <Animated.View style={[styles.textContainer, { opacity: textOpacity }]}>
        <Text style={styles.appName}>DM GROUP KSA</Text>
        <Text style={styles.subTitle}>Workspace App</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#153156', // Background color, matching the brand theme
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 150, // Set your desired logo size
    height: 150,
    resizeMode: 'contain',
  },
  textContainer: {
    marginTop: 20, // Add some spacing between logo and text
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF', // White color text
    textAlign: 'center',
    letterSpacing: 2, // Slight spacing for a professional look
  },
  subTitle: {
    fontSize: 18,
    fontWeight: '300',
    color: '#FFFFFF', // White color text
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 8, // Spacing between app name and subtitle
  },
});

export default SplashScreen;
