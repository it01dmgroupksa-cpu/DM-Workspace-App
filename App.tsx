import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AttendanceIcon, SalesRFQIcon, RFQIcon, TaskManagementIcon, DirectoryIcon, LeaveIcon } from './src/components/icons';
import AttendanceManagement from './src/components/AttendanceManagement';
import LeaveManagement from './src/components/LeaveManagement';
import RFQ from './src/components/RequestForQuotation';
import SalesPersonRFQ from './src/components/SalesPersonRFQ';
import EmployeeDirectory from './src/components/EmployeeDirectory';
import TaskManagement from './src/components/TaskManagement';
import LoginScreen from './src/components/Login';
import { EmployeeProvider, EmployeeContext } from './src/context/EmployeeContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

interface Flags {
  showSalesRFQ: boolean;
  showPurchaseRFQ: boolean;
}

// Always present static tabs
const staticTabs = [
  { name: 'Attendance', component: AttendanceManagement, icon: AttendanceIcon },
  { name: 'Leave', component: LeaveManagement, icon: LeaveIcon },
  // { name: 'Tasks', component: TaskManagement, icon: TaskManagementIcon },
  { name: 'Directory', component: EmployeeDirectory, icon: DirectoryIcon },
];

// Conditional tabs
const conditionalTabs = [
  { name: 'Sales RFQ', component: SalesPersonRFQ, icon: SalesRFQIcon, condition: (flags: Flags) => flags.showSalesRFQ },
  { name: 'Purchase RFQ', component: RFQ, icon: RFQIcon, condition: (flags: Flags) => flags.showPurchaseRFQ },
];

function MainTabNavigator() {
  const { employeeDetails } = useContext(EmployeeContext);

  // Extract permissions directly from employeeDetails
  const flags: Flags = {
    showSalesRFQ: employeeDetails.custom_allow_sales_rfq,
    showPurchaseRFQ: employeeDetails.custom_allow_purchase_rfq,
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          const tab = [...staticTabs, ...conditionalTabs].find(t => t.name === route.name);
          return tab ? <tab.icon width={size} height={size} color={color} /> : null;
        },
        tabBarActiveTintColor: '#153156',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      {staticTabs.map(tab => (
        <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
      ))}
      {conditionalTabs
        .filter(tab => tab.condition(flags))
        .map(tab => (
          <Tab.Screen key={tab.name} name={tab.name} component={tab.component} />
        ))}
    </Tab.Navigator>
  );
}

const AppContent = () => {
  const { employeeDetails } = useContext(EmployeeContext);

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!employeeDetails ? (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <Stack.Screen
            name="Home"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  return (
    <EmployeeProvider>
      <AppContent />
    </EmployeeProvider>
  );
};

export default App;
