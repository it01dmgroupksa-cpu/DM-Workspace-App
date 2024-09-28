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
  ScrollView, // Import ScrollView to handle overflow
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { login, getEmployeeDetailsByUsername } from '../../api';
import { EmployeeContext } from '../context/EmployeeContext';
import { EyeIcon, EyeOffIcon, UserAppIcon } from './icons'; // Import the icons

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { employeeDetails, setEmployeeDetails } = useContext(EmployeeContext);

  const handleLogin = async () => {
    try {
      console.log('Attempting to login with email:', email);
      const response = await login(email, password);
      console.log('Login response:', response);

      if (response.message === 'Logged In') {
        const employeeDetails = await getEmployeeDetailsByUsername(email);
        console.log('Fetched employee details:', employeeDetails);

        if (!employeeDetails.custom_allow_app) {
          setEmail('');
          setPassword('');
          setEmployeeDetails(null);
          Alert.alert(
            'Access Denied',
            'You are not authorized to use this app.',
          );
          return;
        }

        setEmployeeDetails(employeeDetails);
        console.log('Context employeeDetails:', employeeDetails);
        console.log('Navigating to Attendance');
        navigation.navigate('Home', { screen: 'Attendance' });
      } else {
        Alert.alert('Login Failed', 'Invalid email or password');
      }
    } catch (error) {
      if (error.response) {
        console.error('Login error response:', error.response.data);
      } else {
        console.error('Login error:', error.message);
      }
      Alert.alert('Login Failed', 'An error occurred during login');
    }
  };

  const handleContactSupport = () => {
    const email = 'its@dmgroupksa.com';
    const subject = 'Issue Signing Into DM Workspace App';
    const mailtoURL = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

    Linking.openURL(mailtoURL).catch(err =>
      Alert.alert('Error', 'Failed to open email client.'),
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        {/* DM Logo */}
        <Image source={require('./images/dmlogo.png')} style={styles.logo} />
        
        <Text style={styles.welcomeText}>Login</Text>

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#B0B0B0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <UserAppIcon width={24} height={24} stroke="#153156" />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#B0B0B0"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? (
              <EyeIcon width={24} height={24} stroke="#153156" />
            ) : (
              <EyeOffIcon width={24} height={24} stroke="#153156" />
            )}
          </TouchableOpacity>
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>

        {/* Spacer to push the contact support to the bottom */}
        <View style={styles.spacer} />

        {/* Contact Support Section */}
        <TouchableOpacity onPress={handleContactSupport}>
          <Text style={styles.contactSupportText}>
            Having trouble signing in? Contact{'\n'}
            <Text style={styles.emailText}>rihal@dmgroupksa.com</Text>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  container: {
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#153156',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 10,
    marginBottom: 20,
    width: '100%',
    elevation: 2,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#000',
  },
  loginButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    elevation: 2,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactSupportText: {
    color: '#B0B0B0',
    marginTop: 20,
    fontSize: 14,
    textAlign: 'center',
  },
  emailText: {
    color: '#153156',
    textDecorationLine: 'underline',
  },
  spacer: {
    flex: 1, // This will push the contact support section to the bottom
  },
});

export default LoginScreen;
