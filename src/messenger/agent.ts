import {currentSession, erpCall} from './session';
import {withStatus} from './errors';
import type {AgentCard, Message} from './types';

// The CEO agent in the Durar Assistant chat. These calls go to ERP's durar_ai_relay (the
// same relay the ERP agent page uses, which carries the ERP session), never through
// durar_messenger: Messenger's own relay never carries a session. ERP and the panel decide
// whether this person may use the CEO agent; the app only asks.
export async function relayAI<T = any>(
  operation: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const session = currentSession();
  if (!session) throw new Error('Sign in to Messenger.');
  try {
    const {message} = await erpCall<T>(
      'durar_ai_relay',
      {operation, data: JSON.stringify(data), agent: 'ceo'},
      session.sid,
    );
    return message;
  } catch (error: any) {
    throw withStatus(error.message, error.status ?? 0);
  }
}

// One answer per signed-in person. A network failure is not an answer: ask again later.
let known: {user: string; value: boolean} | null = null;
export async function agentAvailable(): Promise<boolean> {
  const user = currentSession()?.user;
  if (!user) return false;
  if (known?.user === user) return known.value;
  try {
    const boot = await relayAI<{agent?: string}>('bootstrap');
    known = {user, value: boot?.agent === 'ceo'};
  } catch (error: any) {
    if (!error.status) return false;
    known = {user, value: false};
  }
  return known.value;
}
export function resetAgent() {
  known = null;
}

export const openAgent = () =>
  relayAI<{conversationId: string; chatId: string}>('messenger.open');
export const askAgent = async (
  clientId: string,
  text: string,
  language: 'en' | 'ar',
): Promise<Message> =>
  (await relayAI<{message: Message}>('messenger.ask', {clientId, text, language}))
    .message;
export const agentCards = async (requestIds: string[]): Promise<AgentCard[]> =>
  (await relayAI<{cards: AgentCard[]}>('messenger.cards', {requestIds})).cards;

// Text typed in the agent chat goes to the agent; a file there is an ordinary Messenger file.
export const routeToAgent = (
  item: {conversationId: string; file?: unknown},
  agentConversation: string | null,
) => !!agentConversation && item.conversationId === agentConversation && !item.file;
export const languageOf = (text: string): 'en' | 'ar' =>
  /[؀-ۿ]/.test(text) ? 'ar' : 'en';
