import React, {useState, useContext, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  login,
  getEmployeeDetailsByUsername,
  getEmployeeShiftDetails,
  sameUserSignedIn,
  verifyLoginOtp,
} from '../../api';
import OtpPrompt from './OtpPrompt';
import {
  OTP_TEXT,
  OtpError,
  TwoFactorNeeded,
  deviceLang,
  totpStep,
} from '../twoFactor';
import {EmployeeContext} from '../context/EmployeeContext';
import {EyeIcon, EyeOffIcon, UserAppIcon} from './icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useChatSession, useUnread} from '../messenger';
import {
  forgetCredentials,
  loadCredentials,
  offerBiometric,
  useBiometric,
} from '../biometric';

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {setEmployeeDetails} = useContext(EmployeeContext);
  const chat = useChatSession();
  const unread = useUnread();
  const biometric = useBiometric();
  // Two-factor step: what ERP needs for the code (tmp_id), and, in memory only, the
  // username and password to finish signing in with. Both dropped on success, Back,
  // expiry or leaving the screen.
  const [challenge, setChallenge] = useState(null);
  const pending = useRef(null);
  useEffect(() => () => {
    pending.current = null;
  }, []);
  // ERP forgets a pending sign-in after a few minutes; don't keep the password longer.
  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(() => {
      pending.current = null;
      setChallenge(null);
      Alert.alert(OTP_TEXT[deviceLang()].expired);
    }, 15 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [challenge]);

// viaBiometric: the username and password came from Face ID, not the fields.
const handleLogin = async (
  username = email,
  pass = password,
  viaBiometric = false,
) => {
  if (!username || !pass) {
    Alert.alert('Invalid Input', 'Please enter both username and password.');
    return;
  }

  setIsLoading(true);
  try {
    const response = await login(username, pass);

    if (response.message === 'Logged In') {
      await finishLogin(username, pass, viaBiometric);
    } else if (response.twoFactor) {
      // The password is right; this employee also needs the authenticator code,
      // unless their session from an earlier code is still alive on this phone.
      if (await sameUserSignedIn(username)) {
        await finishLogin(username, pass, viaBiometric);
      } else {
        pending.current = {username, pass, viaBiometric};
        setChallenge(response.twoFactor);
      }
    } else {
      Alert.alert(
        'Login Failed',
        'Invalid username or password. Please try again.',
      );
    }
  } catch (error) {
    console.error("Login request failed.");
    await loginFailed(error, viaBiometric);
  } finally {
    setIsLoading(false);
  }
};

// Second step: the code. Rejects with an OtpError, which OtpPrompt shows.
const submitOtp = async code => {
  const waiting = pending.current;
  if (!waiting || !challenge) throw new OtpError('expired');
  const step = totpStep();
  await verifyLoginOtp(challenge.tmpId, code);
  pending.current = null;
  setChallenge(null);
  try {
    await finishLogin(waiting.username, waiting.pass, waiting.viaBiometric, {
      code,
      step,
    });
  } catch (error) {
    await loginFailed(error, false);
  }
};

// Back to the password screen: the pending sign-in and password are dropped.
const leaveOtp = message => {
  pending.current = null;
  setChallenge(null);
  if (message) Alert.alert(message);
};

// Signed in to ERP: check the employee may use the app, then open it. `otp`: the code
// just used, so Messenger's own sign-in can reuse it while it's still current.
const finishLogin = async (username, pass, viaBiometric, otp = null) => {
      const employeeDetails = await getEmployeeDetailsByUsername(username);

      if (!employeeDetails.custom_allow_app) {
        Alert.alert(
          'Access Denied',
          'You are not authorized to use this app. Please contact support for assistance.',
        );
      } else {
        const shiftDetailsResponse = await getEmployeeShiftDetails(username);

        if (shiftDetailsResponse && shiftDetailsResponse.custom_shift_details) {
          const shiftDetails = shiftDetailsResponse.custom_shift_details.map(
            ({ break_hrs, shift_type, shift_start, shift_end }) => ({
              break_hrs,
              shift_type,
              shift_start,
              shift_end,
            }),
          );

          await AsyncStorage.setItem(
            'shiftDetails',
            JSON.stringify(shiftDetails),
          );
        }

        // One password entry also signs Messenger in (it then stays signed in for 30 days).
        // Messenger has its own ERP session, so a two-factor user's code is needed
        // there too: the one just entered is reused only while it's still the current
        // code, so it can't count as a wrong attempt.
        if (employeeDetails.custom_allow_chat_module && chat.status === 'signedOut') {
          chat
            .signIn(username, pass)
            .catch(error => {
              if (
                otp &&
                error instanceof TwoFactorNeeded &&
                totpStep() === otp.step
              ) {
                return chat.verifyOtp(error.challenge.tmpId, otp.code, username);
              }
            })
            .catch(() => {});
        }
        if (!viaBiometric) offerBiometric(username, pass);
        setEmployeeDetails(employeeDetails);
        navigation.navigate('Home', { screen: 'Attendance' });
      }
};

const loginFailed = async (error, viaBiometric) => {
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      if (
        errorData.exception === 'frappe.exceptions.AuthenticationError' ||
        (errorData.exc && errorData.exc.includes('Invalid login credentials'))
      ) {
        if (viaBiometric) {
          // The password was changed since Face ID saved it.
          await forgetCredentials();
          biometric.refresh();
          Alert.alert(
            'Sign in with your password',
            `Your password has changed since you turned on ${biometric.label}. Sign in with your new password to turn it on again.`,
          );
          return;
        }
        Alert.alert(
          'Login Failed',
          'Invalid username or password. Please try again.',
        );
      } else {
        Alert.alert(
          'Login Error',
          'An unexpected error occurred. Please try again later.',
        );
      }
    } else {
      Alert.alert(
        'Login Error',
        'An unexpected error occurred. Please try again later.',
      );
    }
};


  const handleBiometricLogin = async () => {
    const saved = await loadCredentials();
    if (!saved) return; // cancelled
    setEmail(saved.username);
    handleLogin(saved.username, saved.password, true);
  };

  const handleContactSupport = () => {
    const email = 'itadmin@dmgroupksa.com';
    const subject = 'Issue Signing Into DM Workspace App';
    const mailtoURL = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    Linking.openURL(mailtoURL).catch(err =>
      Alert.alert(
        'Error',
        'Failed to open email client. Please manually send an email to itadmin@dmgroupksa.com',
      ),
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Image source={require('./images/dmlogo.png')} style={styles.logo} />
        {challenge ? (
          <OtpPrompt
            challenge={challenge}
            theme="light"
            onSubmit={submitOtp}
            onBack={leaveOtp}
          />
        ) : (
        <>
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.subText}>Please sign in to continue</Text>
        <Text style={styles.audienceText}>
          For DM Group employees. Accounts are provided by HR.
        </Text>

        <View style={styles.inputContainer}>
          <UserAppIcon width={24} height={24} stroke="#103BA9" />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#B0B0B0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          {showPassword ? (
            <EyeIcon width={24} height={24} stroke="#103BA9" />
          ) : (
            <EyeOffIcon width={24} height={24} stroke="#103BA9" />
          )}
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#B0B0B0"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            disabled={isLoading}>
            <Text
              style={[styles.showHideText, isLoading && styles.disabledText]}>
              {showPassword ? 'Hide' : 'Show'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
          onPress={() => handleLogin()}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {biometric.label && biometric.user ? (
          <TouchableOpacity
            style={styles.biometricButton}
            onPress={handleBiometricLogin}
            disabled={isLoading}
            accessibilityLabel={`Sign in with ${biometric.label}`}>
            <Text
              style={[styles.biometricText, isLoading && styles.disabledText]}>
              Sign in with {biometric.label}
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[
            styles.messengerButton,
            chat.status === 'signedIn' && styles.messengerButtonOn,
          ]}
          onPress={() => navigation.navigate('Messenger')}
          disabled={isLoading}>
          <Text
            style={[
              styles.messengerButtonText,
              chat.status === 'signedIn' && styles.messengerButtonTextOn,
            ]}>
            {chat.status === 'signedIn' ? '● Open Messenger' : 'Sign in to Messenger only'}
            {unread ? ` (${unread > 99 ? '99+' : unread})` : ''}
          </Text>
        </TouchableOpacity>
        </>
        )}

        <View style={styles.spacer} />

        <TouchableOpacity onPress={handleContactSupport} disabled={isLoading}>
          <Text
            style={[
              styles.contactSupportText,
              isLoading && styles.disabledText,
            ]}>
            Having trouble signing in? Contact support
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  container: {
    padding: 20,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#103BA9',
    marginBottom: 10,
  },
  subText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  audienceText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    width: '100%',
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#000',
    marginLeft: 10,
  },
  showHideText: {
    color: '#103BA9',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#103BA9',
    paddingVertical: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  biometricButton: {
    backgroundColor: '#E8EEFB',
    paddingVertical: 13,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  biometricText: {
    color: '#103BA9',
    fontSize: 16,
    fontWeight: '600',
  },
  contactSupportText: {
    color: '#103BA9',
    marginTop: 20,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  messengerButton: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#103BA9',
  },
  messengerButtonOn: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  messengerButtonTextOn: {
    color: '#FFFFFF',
  },
  messengerButtonText: {
    color: '#103BA9',
    fontSize: 15,
    fontWeight: '600',
  },
  spacer: {
    flex: 1,
  },
  disabledText: {
    color: '#B0B0B0',
  },
});

export default LoginScreen;
