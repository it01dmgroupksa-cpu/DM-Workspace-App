import AsyncStorage from '@react-native-async-storage/async-storage';
import {currentSession, erpCall} from './session';
import {callKit} from './callKit';

// Blocking and reporting (App Store guideline 1.2: chat apps must let people report
// content and block abusive users).
//
// Blocking is kept on this phone, per employee: their messages are hidden, their calls
// declined, and the direct chat with them is muted on the server so no notification
// reaches the phone. It survives signing out (the chats are wiped, the list is not).
// Every block and report is also recorded in ERP ("DM App Report") for HR to review.

const key = (me: string) => `messenger.blocked.${me}`;

export async function loadBlocked(me: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key(me));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(u => typeof u === 'string') : [];
  } catch {
    return [];
  }
}
export function saveBlocked(me: string, users: Iterable<string>) {
  return AsyncStorage.setItem(key(me), JSON.stringify([...users])).catch(() =>
    console.warn('Messenger could not save the blocked list.'),
  );
}
// iPhone: CallKit ends a call in a direct chat with a blocked person natively, even
// when the app is closed (the VoIP push carries the conversation, not the caller).
export function syncBlockedCalls(conversationIds: string[]) {
  callKit.setBlockedConversations(conversationIds);
}

export type ReportType = 'Message' | 'User' | 'Block';
export const REPORT_REASONS = [
  'Spam',
  'Harassment or bullying',
  'Hate speech',
  'Threats or violence',
  'Sexual or inappropriate content',
  'Something else',
] as const;

// One report to HR through the ERP Server Script `dm_app_report` (see MESSENGER.md,
// "Reports, blocking and account deletion"), as Messenger's own ERP session.
export async function sendReport(report: {
  type: ReportType;
  reportedUser: string;
  conversationId?: string;
  messageId?: string;
  messageText?: string;
  reason?: string;
  details?: string;
}) {
  const session = currentSession();
  if (!session) throw new Error('Sign in to Messenger.');
  await erpCall(
    'dm_app_report',
    {
      type: report.type,
      reported_user: report.reportedUser,
      conversation: report.conversationId || '',
      message_id: report.messageId || '',
      message_text: (report.messageText || '').slice(0, 2000),
      reason: report.reason || '',
      details: (report.details || '').slice(0, 2000),
      source: 'Messenger',
    },
    session.sid,
  );
}
