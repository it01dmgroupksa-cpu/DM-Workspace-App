import React, { useState, useContext } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { login, getEmployeeDetailsByUsername } from '../../api';
import { EmployeeContext } from '../context/EmployeeContext';
import { EyeIcon, EyeOffIcon, UserAppIcon } from './icons';

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setEmployeeDetails } = useContext(EmployeeContext);

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
          setEmployeeDetails(employeeDetails);
          navigation.navigate('Home', { screen: 'Attendance' });
        }
      } else {
        Alert.alert('Login Failed', 'Invalid username or password. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response && error.response.data) {
        const errorData = error.response.data;
        if (errorData.exception === 'frappe.exceptions.AuthenticationError' ||
            (errorData.exc && errorData.exc.includes('Invalid login credentials'))) {
          Alert.alert('Login Failed', 'Invalid username or password. Please try again.');
        } else {
          Alert.alert('Login Error', 'An unexpected error occurred. Please try again later.');
        }
      } else {
        Alert.alert('Login Error', 'An unexpected error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContactSupport = () => {
    const email = 'rihal@dmgroupksa.com';
    const subject = 'Issue Signing Into DM Workspace App';
    const mailtoURL = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    Linking.openURL(mailtoURL).catch(err =>
      Alert.alert('Error', 'Failed to open email client. Please manually send an email to rihal@dmgroupksa.com'),
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Image source={require('./images/dmlogo.png')} style={styles.logo} />
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.subText}>Please sign in to continue</Text>

        <View style={styles.inputContainer}>
          <UserAppIcon width={24} height={24} stroke="#153156" />
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
            <EyeIcon width={24} height={24} stroke="#153156" />
          ) : (
            <EyeOffIcon width={24} height={24} stroke="#153156" />
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
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={isLoading}>
            <Text style={[styles.showHideText, isLoading && styles.disabledText]}>
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

        <View style={styles.spacer} />

        <TouchableOpacity onPress={handleContactSupport} disabled={isLoading}>
          <Text style={[styles.contactSupportText, isLoading && styles.disabledText]}>
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
    color: '#153156',
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
    color: '#153156',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#153156',
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
    color: '#153156',
    marginTop: 20,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  spacer: {
    flex: 1,
  },
  disabledText: {
    color: '#B0B0B0',
  },
});

export default LoginScreen;