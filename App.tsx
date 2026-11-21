import React, { useContext, useState, useEffect, useMemo } from 'react';
import { Linking } from 'react-native';
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
  UserIcon,
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
import DeliveryTrip from './src/components/DeliveryTrip';
import DMWebView from './src/components/DMWebViewScreen';
import { EmployeeProvider, EmployeeContext } from './src/context/EmployeeContext';
import SplashScreen from './src/components/SplashScreen'; // Import SplashScreen
import { MessengerRoot, MessengerScreen, navigationRef, useUnread } from './src/messenger';
import { AppShell, BRAND_BLUE, MenuButton, type MenuItem } from './src/components/AppShell';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

interface Flags {
  showSales: boolean;
  showPurchaseRFQ: boolean;
  showChat: boolean;
  showDelivery: boolean;
}

type Page = MenuItem & { component: React.ComponentType<any> };

const menuButton = () => <MenuButton />;
const noTabBar = () => null;

// Every page of the app, in sidebar order. Delivery, Sales and Purchase RFQ only for
// the staff ERP allows them (the Employee record's custom_* flags).
function pagesFor(flags: Flags): Page[] {
  const pages: (Page | false)[] = [
    { name: 'Attendance', label: 'Attendance', Icon: AttendanceIcon, component: AttendanceManagement },
    { name: 'Directory', label: 'Directory', Icon: DirectoryIcon, component: EmployeeDirectory },
    flags.showDelivery && { name: 'Delivery', label: 'Delivery', Icon: TripIcon, component: DeliveryTrip, section: 'Work' },
    flags.showSales && { name: 'Sales RFQ', label: 'Sales RFQ', Icon: SalesRFQIcon, component: SalesPersonRFQ, section: 'Sales' },
    flags.showSales && { name: 'Items Stock', label: 'Items Stock', Icon: ItemStockIcon, component: ItemsStock, section: 'Sales' },
    flags.showSales && { name: 'Sales Outstanding', label: 'Sales Outstanding', Icon: OutstandingSalesIcon, component: SalesOutstanding, section: 'Sales' },
    flags.showPurchaseRFQ && { name: 'Purchase RFQ', label: 'Purchase RFQ', Icon: RFQIcon, component: RFQ, section: 'Purchase' },
    { name: 'Leave', label: 'Leave', Icon: LeaveIcon, component: LeaveManagement, section: 'My work' },
    { name: 'AssignedTasks', label: 'Assigned Tasks', Icon: TaskManagementIcon, component: AssignedTasks, section: 'My work' },
    { name: 'MaterialsServiceRequestForm', label: 'Request Form', Icon: RequestFormIcon, component: MaterialsServiceRequestForm, section: 'My work' },
    { name: 'DMOfficialMemo', label: 'Official Memo', Icon: AnnouncementIcon, component: DMOfficialMemo, section: 'Company' },
    { name: 'EmployeeProfile', label: 'Profile', Icon: UserIcon, component: EmployeeProfile, section: 'Company' },
    { name: 'DMWebView', label: 'Web View', Icon: WebviewIcon, component: DMWebView, section: 'Company' },
  ];
  return pages.filter(Boolean) as Page[];
}

// The signed-in app: the sidebar (☰) instead of a bottom bar, and Chat as a round
// button bottom right. The pages are still a tab navigator with its bar hidden, so each
// keeps its state while you move between them.
const Home: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { employeeDetails } = useContext(EmployeeContext);
  const unread = useUnread();
  const [active, setActive] = useState('Attendance');

  const flags: Flags = {
    showSales: employeeDetails?.custom_allow_sales_rfq || false,
    showPurchaseRFQ: employeeDetails?.custom_allow_purchase_rfq || false,
    showChat: employeeDetails?.custom_allow_chat_module || false,
    showDelivery: employeeDetails?.custom_delivery_trip || false,
  };
  const pages = useMemo(
    () => pagesFor(flags),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flags.showSales, flags.showPurchaseRFQ, flags.showDelivery],
  );

  return (
    <AppShell
      items={pages}
      active={active}
      onSelect={name => navigation.navigate('Home', { screen: name })}
      name={employeeDetails?.employee_name}
      subtitle={employeeDetails?.designation || employeeDetails?.department}
      chat={flags.showChat ? { unread: unread || 0, onPress: () => navigation.navigate('Messenger') } : null}>
      <Tab.Navigator
        tabBar={noTabBar}
        screenListeners={({ route }) => ({ focus: () => setActive(route.name) })}
        screenOptions={{
          headerShown: true,
          headerLeft: menuButton,
          headerStyle: { backgroundColor: BRAND_BLUE },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          headerTitleAlign: 'left',
        }}>
        {pages.map(p => (
          <Tab.Screen key={p.name} name={p.name} component={p.component} options={{ title: p.label }} />
        ))}
      </Tab.Navigator>
    </AppShell>
  );
};

const AppContent: React.FC = () => {
  const { employeeDetails } = useContext(EmployeeContext);
  const [isSplashLoading, setIsSplashLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashLoading(false);
    }, 3000); // Splash screen delay of 3 seconds
    // Opened from a call (Answer, Decline or the call alert): skip the splash, every
    // second counts while the caller waits.
    Linking.getInitialURL()
      .then(url => {
        if (url?.startsWith('dmworkspace://call')) setIsSplashLoading(false);
      })
      .catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isSplashLoading ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : !employeeDetails ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            {/* Messenger keeps its own 30-day sign-in, so it opens from here too. */}
            <Stack.Screen name="Messenger" component={MessengerScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="TaskManagement" component={TaskManagement} />
            <Stack.Screen name="Messenger" component={MessengerScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  return (
    <EmployeeProvider>
      <MessengerRoot>
        <AppContent />
      </MessengerRoot>
    </EmployeeProvider>
  );
};

export default App;
