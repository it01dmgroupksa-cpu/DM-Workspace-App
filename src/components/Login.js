import React, {useState, useContext} from 'react';
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
import {login, getEmployeeDetailsByUsername, getEmployeeShiftDetails} from '../../api';
import {EmployeeContext} from '../context/EmployeeContext';
import {EyeIcon, EyeOffIcon, UserAppIcon} from './icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useChatSession, useUnread} from '../messenger';

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {setEmployeeDetails} = useContext(EmployeeContext);
  const chat = useChatSession();
  const unread = useUnread();

const handleLogin = async () => {
  if (!email || !password) {
    Alert.alert('Invalid Input', 'Please enter both username and password.');
    return;
  }

  setIsLoading(true);
  try {
    const response = await login(email, password);

    if (response.message === 'Logged In') {
      const employeeDetails = await getEmployeeDetailsByUsername(email);

      if (!employeeDetails.custom_allow_app) {
        Alert.alert(
          'Access Denied',
          'You are not authorized to use this app. Please contact support for assistance.',
        );
      } else {
        const shiftDetailsResponse = await getEmployeeShiftDetails(email);

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
        if (employeeDetails.custom_allow_chat_module && chat.status === 'signedOut') {
          chat.signIn(email, password).catch(() => {});
        }
        setEmployeeDetails(employeeDetails);
        navigation.navigate('Home', { screen: 'Attendance' });
      }
    } else {
      Alert.alert(
        'Login Failed',
        'Invalid username or password. Please try again.',
      );
    }
  } catch (error) {
    console.error("Login request failed.");
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      if (
        errorData.exception === 'frappe.exceptions.AuthenticationError' ||
        (errorData.exc && errorData.exc.includes('Invalid login credentials'))
      ) {
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
  } finally {
    setIsLoading(false);
  }
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
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Image source={require('./images/dmlogo.png')} style={styles.logo} />
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.subText}>Please sign in to continue</Text>

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
          onPress={handleLogin}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

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
    marginBottom: 30,
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
