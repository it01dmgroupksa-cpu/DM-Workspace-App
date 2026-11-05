// Durar Messenger in the DM Workspace app. Everything goes through the same ERP
// Server Script as the Messenger block on the ERP desk (durar_messenger), using the
// ERP session the app already signs in with, so ERP decides who is an employee.
export const ERP_ORIGIN = 'https://dmgroup.frappe.cloud';
export const RELAY_URL = `${ERP_ORIGIN}/api/method/durar_messenger`;

// Expo project id used for push notifications (Expo push service). Set it after
// creating the project with `eas init`; with it empty the app still works, but only
// notifies while it is open. See MESSENGER.md at the repo root.
export const EXPO_PROJECT_ID = '';

export const BRAND = {
  navy: '#153156',
  accent: '#0f766e',
  accentSoft: '#d8f3e4',
  bg: '#F5F7FA',
  chat: '#efeae2',
  card: '#FFFFFF',
  text: '#111b21',
  sub: '#54656f',
  muted: '#667781',
  line: '#e9edef',
  danger: '#d92d20',
  read: '#0284c7',
  mine: '#d8f3e4',
  theirs: '#FFFFFF',
};
export const ASSISTANT = 'durar-assistant';
export const RING_SECONDS = 45;
