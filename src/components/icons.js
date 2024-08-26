import React from 'react';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';

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
