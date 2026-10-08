import React, { useContext, useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import {
  AttendanceIcon,
  SalesRFQIcon,
  RFQIcon,
  TaskManagementIcon,
  DirectoryIcon,
  LeaveIcon,
  ItemStockIcon,
  OutstandingSalesIcon,
  RequestFormIcon,
  AnnouncementIcon,
  MoreIcon,
  UserIcon,
  ChatIcon,
  TripIcon,
  WebviewIcon
} from './src/components/icons';
import AttendanceManagement from './src/components/AttendanceManagement';
import LeaveManagement from './src/components/LeaveManagement';
import RFQ from './src/components/RequestForQuotation';
import SalesPersonRFQ from './src/components/SalesPersonRFQ';
import EmployeeDirectory from './src/components/EmployeeDirectory';
import SalesOutstanding from './src/components/SalesOutstandingReport';
import ItemsStock from './src/components/ItemsStock';
import AssignedTasks from './src/components/AssignedTasksView';
import TaskManagement from './src/components/TaskManagement';
import LoginScreen from './src/components/Login';
import DMOfficialMemo from './src/components/DMOfficialMemo';
import EmployeeProfile from './src/components/EmployeeProfile';
import MaterialsServiceRequestForm from './src/components/MaterialsServiceRequestForm';
import ChatComponent from './src/components/ChatComponent';
import DeliveryTrip from './src/components/DeliveryTrip';
import DMWebView from './src/components/DMWebViewScreen';
import { EmployeeProvider, EmployeeContext } from './src/context/EmployeeContext';
import SplashScreen from './src/components/SplashScreen'; // Import SplashScreen

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

interface Flags {
  showSales: boolean;
  showPurchaseRFQ: boolean;
  showChat: boolean;
  showDelivery: boolean;
}

const SalesNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#153156',
        tabBarInactiveTintColor: '#ccc',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Sales RFQ"
        component={SalesPersonRFQ}
        options={{
          tabBarIcon: SalesRFQIcon,
        }}
      />
      <Tab.Screen
        name="Items Stock"
        component={ItemsStock}
        options={{
          tabBarIcon: ItemStockIcon,
        }}
      />
      <Tab.Screen
        name="Sales Outstanding"
        component={SalesOutstanding}
        options={{
          tabBarIcon: OutstandingSalesIcon,
        }}
      />
    </Tab.Navigator>
  );
};

const MoreNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#153156',
        tabBarInactiveTintColor: '#ccc',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Leave"
        component={LeaveManagement}
        options={{
          tabBarIcon: LeaveIcon,
          tabBarLabel: 'Leave',
        }}
      />
      <Tab.Screen
        name="AssignedTasks"
        component={AssignedTasks}
        options={{
          tabBarIcon: TaskManagementIcon,
          tabBarLabel: 'Assigned Tasks',
        }}
      />
      <Tab.Screen
        name="MaterialsServiceRequestForm"
        component={MaterialsServiceRequestForm}
        options={{
          tabBarIcon: RequestFormIcon,
          tabBarLabel: 'Request Form',
        }}
      />
      <Tab.Screen
        name="DMOfficialMemo"
        component={DMOfficialMemo}
        options={{
          tabBarIcon: AnnouncementIcon,
          tabBarLabel: 'Official Memo',
        }}
      />
      <Tab.Screen
        name="EmployeeProfile"
        component={EmployeeProfile}
        options={{
          tabBarIcon: UserIcon,
          tabBarLabel: 'Profile',
        }}
      />
      <Tab.Screen
        name="DMWebView"
        component={DMWebView}
        options={{
          tabBarIcon: WebviewIcon,
          tabBarLabel: 'Web View',
        }}
      />
    </Tab.Navigator>
  );
};

const DynamicTabNavigator: React.FC = () => {
  const { employeeDetails } = useContext(EmployeeContext);

  const flags: Flags = {
    showSales: employeeDetails?.custom_allow_sales_rfq || false,
    showPurchaseRFQ: employeeDetails?.custom_allow_purchase_rfq || false,
    showChat: employeeDetails?.custom_allow_chat_module || false,
    showDelivery: employeeDetails?.custom_delivery_trip || false,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#153156',
        tabBarInactiveTintColor: '#ccc',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Attendance"
        component={AttendanceManagement}
        options={{ tabBarIcon: AttendanceIcon }}
      />
      <Tab.Screen
        name="Directory"
        component={EmployeeDirectory}
        options={{ tabBarIcon: DirectoryIcon }}
      />
      {flags.showDelivery && (
        <Tab.Screen
          name="Delivery"
          component={DeliveryTrip}
          options={{ tabBarIcon: TripIcon }}
        />
      )}
      {flags.showSales && (
        <Tab.Screen
          name="Sales"
          component={SalesNavigator}
          options={{
            tabBarIcon: SalesRFQIcon,
          }}
        />
      )}
      {flags.showPurchaseRFQ && (
        <Tab.Screen
          name="Purchase RFQ"
          component={RFQ}
          options={{ tabBarIcon: RFQIcon }}
        />
      )}
      {flags.showChat && (
        <Tab.Screen
          name="Chat"
          component={ChatComponent}
          options={{
            tabBarIcon: ChatIcon,
          }}
        />
      )}
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{
          tabBarIcon: MoreIcon,
        }}
      />
    </Tab.Navigator>
  );
};

const AppContent: React.FC = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [isSplashLoading, setIsSplashLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIsSplashLoading(false);
    }, 3000); // Splash screen delay of 3 seconds
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isSplashLoading ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : !employeeDetails ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={DynamicTabNavigator} />
            <Stack.Screen name="TaskManagement" component={TaskManagement} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  return (
    <EmployeeProvider>
      <AppContent />
    </EmployeeProvider>
  );
};

export default App;
