import React from 'react';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

// Attendance Icon
export const AttendanceIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <Rect width="20" height="14" x="2" y="6" rx="2" />
  </Svg>
);

// Sales RFQ Icon
export const SalesRFQIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Line x1="19" x2="5" y1="5" y2="19" />
    <Circle cx="6.5" cy="6.5" r="2.5" />
    <Circle cx="17.5" cy="17.5" r="2.5" />
  </Svg>
);


// RFQ Icon
export const RFQIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M2 9a3 3 0 1 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <Path d="M9 9h.01" />
    <Path d="m15 9-6 6" />
    <Path d="M15 15h.01" />
  </Svg>
);

// Task Management Icon
export const TaskManagementIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
    <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <Path d="M12 11h4" />
    <Path d="M12 16h4" />
    <Path d="M8 11h.01" />
    <Path d="M8 16h.01" />
  </Svg>
);

// Directory Icon
export const DirectoryIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M15 13a3 3 0 1 0-6 0" />
    <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    <Circle cx="12" cy="8" r="2" />
  </Svg>
);

// Leave Icon
export const LeaveIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Circle cx="18" cy="18" r="3" />
    <Circle cx="6" cy="6" r="3" />
    <Path d="M18 6V5" />
    <Path d="M18 11v-1" />
    <Line x1="6" x2="6" y1="9" y2="21" />
  </Svg>
);

// Log In Icon
export const LogInIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    <Polyline points="10 17 15 12 10 7"/>
    <Line x1="15" y1="12" x2="3" y2="12"/>
  </Svg>
);

// Log Out Icon
export const LogOutIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <Polyline points="16 17 21 12 16 7"/>
    <Line x1="21" y1="12" x2="9" y2="12"/>
  </Svg>
);

export const ItemStockIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M7.5 4.27l9 5.15" />
    <Path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <Path d="M3.3 7l8.7 5 8.7-5" />
    <Path d="M12 22V12" />
  </Svg>
);

export const OutstandingSalesIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <Path d="M12 7v2" />
    <Path d="M12 13h.01" />
  </Svg>
);

export const BackIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M9 14L4 9l5-5" />
    <Path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11" />
  </Svg>
);

export const RequestFormIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M12.5 22H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v9.5" />
    <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <Path d="M13.378 15.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
  </Svg>
);

export const AnnouncementIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5" />
    <Path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    <Path d="M20 14v4" />
    <Path d="M20 22v.01" />
  </Svg>
);


export const MoreIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Circle cx="12" cy="12" r="10" />
    <Path d="M17 12h.01" />
    <Path d="M12 12h.01" />
    <Path d="M7 12h.01" />
  </Svg>
);

export const UserIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M18 20a6 6 0 0 0-12 0" />
    <Circle cx="12" cy="10" r="4" />
    <Circle cx="12" cy="12" r="10" />
  </Svg>
);

export const ChatIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    <Path d="M8 12h.01" />
    <Path d="M12 12h.01" />
    <Path d="M16 12h.01" />
  </Svg>
);

export const NewChatIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M2 21a8 8 0 0 1 13.292-6" />
    <Circle cx="10" cy="8" r="5" />
    <Path d="M19 16v6" />
    <Path d="M22 19h-6" />
  </Svg>
);

export const SendIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
    <Path d="m21.854 2.147-10.94 10.939" />
  </Svg>
);

export const CloseIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M18 6 6 18" />
    <Path d="m6 6 12 12" />
  </Svg>
);

export const PlusIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M5 12h14" />
    <Path d="M12 5v14" />
  </Svg>
);

export const DownloadIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Polyline points="7 10 12 15 17 10" />
    <Line x1="12" x2="12" y1="15" y2="3" />
  </Svg>
);

export const TripIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
    <Path d="M15 18H9" />
    <Path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
    <Circle cx="17" cy="18" r="2" />
    <Circle cx="7" cy="18" r="2" />
  </Svg>
);

export const EyeIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const EyeOffIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
    <Path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <Path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
    <Path d="m2 2 20 20" />
  </Svg>
);

export const UserAppIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Circle cx="12" cy="8" r="5" />
    <Path d="M20 21a8 8 0 0 0-16 0" />
  </Svg>
);

export const WifiIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M12 20h.01" />
    <Path d="M2 8.82a15 15 0 0 1 20 0" />
    <Path d="M5 12.859a10 10 0 0 1 14 0" />
    <Path d="M8.5 16.429a5 5 0 0 1 7 0" />
  </Svg>
);

export const LocationIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" />
    <Circle cx="12" cy="8" r="2" />
    <Path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712" />
  </Svg>
);

export const CalendarIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Path d="M8 2v4" />
    <Path d="M16 2v4" />
    <Rect width="18" height="18" x="3" y="4" rx="2" />
    <Path d="M3 10h18" />
  </Svg>
);

export const ClockIcon = (props) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);
