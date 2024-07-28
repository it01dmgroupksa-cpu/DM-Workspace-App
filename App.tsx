import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AppRegistry } from 'react-native';
import { EmployeeProvider } from './src/context/EmployeeContext';
import LoginScreen from './src/components/Login';
import AttendanceManagement from './src/components/AttendanceManagement';
import LeaveManagement from './src/components/LeaveManagement';
import RFQ from './src/components/RequestForQuotation';
import { name as appName } from './app.json';

const Stack = createStackNavigator();

const App = () => {
  return (
    <EmployeeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Login">
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="AttendanceManagement" 
            component={AttendanceManagement} 
          />
          <Stack.Screen 
            name="LeaveManagement" 
            component={LeaveManagement} 
            options={{ title: 'Leave Management' }} 
          />
          <Stack.Screen 
            name="RequestForQuotation" 
            component={RFQ} 
            options={{ title: 'Request For Quotation' }} 
          />
        </Stack.Navigator>
      </NavigationContainer>
    </EmployeeProvider>
  );
};

AppRegistry.registerComponent(appName, () => App);

export default App;
