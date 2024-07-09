import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    console.log('Logging in...');
  };

  return (
    <View style={styles.container}>
      <View style={styles.blueElementLayer1} />
      <View style={styles.blueElementLayer2} />
      <Image source={require('./dmlogo.png')} style={styles.logo} />
      <Text style={styles.welcomeText}>Welcome Back</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#1E3A8A"
          keyboardType="phone-pad"
        />
        <Image source={require('./user-icon.png')} style={styles.icon} />
      </View>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#1E3A8A"
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.icon}>
          <Image source={showPassword ? require('./eye-icon.png') : require('./eye-off-icon.png')} style={styles.icon} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
        <Text style={styles.loginButtonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
  },
  blueElementLayer1: {
    position: 'absolute',
    top: -60,
    right: -20,
    width: 200,
    height: 200,
    backgroundColor: '#153156',
    borderBottomLeftRadius: 200,
  },
  blueElementLayer2: {
    position: 'absolute',
    top: -60,
    right: -70,
    width: 180,
    height: 180,
    backgroundColor: '#616a9b',
    borderBottomLeftRadius: 180,
  },
  logo: {
    width: 120, // increased size
    height: 120, // increased size
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
    borderColor: '#153156',
    borderWidth: 1,
    borderRadius: 25,
    paddingHorizontal: 10,
    marginBottom: 20,
    width: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    flex: 1,
    height: 50, // adjusted height
    fontSize: 16,
    color: '#1E3A8A',
  },
  icon: {
    width: 24,
    height: 24,
    
  },
  loginButton: {
    backgroundColor: '#153156',
    paddingVertical: 15,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    marginTop:40,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Login;
