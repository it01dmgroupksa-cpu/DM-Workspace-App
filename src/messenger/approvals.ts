import {relayAI} from './agent';
import {currentSession, erpCall} from './session';
import type {AgentCard} from './types';

// Approving a CEO agent card from the phone: the same three steps as the ERP agent page.
// 1. requests.decide records the decision; approving a change that can be applied returns a
//    signed instruction. 2. ERP's durar_ai_execute applies it as the CEO, with the CEO's own
//    permissions, using Messenger's ERP session. 3. requests.complete hands back ERP's signed
//    receipt (or the error), so the card shows applied, or "Apply again".
type Bundle = {proposal: string; company: string; payload: string; authorization: unknown};

async function apply(chatId: string, requestId: string, bundle: Bundle) {
  let outcome: {result: unknown} | {error: string};
  try {
    const sid = currentSession()?.sid;
    if (!sid) throw new Error('Sign in to Messenger.');
    const {message} = await erpCall(
      'durar_ai_execute',
      {
        mode: 'execute',
        proposal: bundle.proposal,
        company: bundle.company,
        payload: bundle.payload,
        authorization: JSON.stringify(bundle.authorization),
      },
      sid,
    );
    outcome = message ? {result: message} : {error: 'ERP did not apply the change.'};
  } catch (error: any) {
    outcome = {error: String(error?.message || 'Could not reach ERP to apply the change.').slice(0, 300)};
  }
  return relayAI('requests.complete', {chatId, requestId, ...outcome});
}

export async function decide(chatId: string, requestId: string, decision: 'approve' | 'reject') {
  const decided = await relayAI<{execute?: Bundle}>('requests.decide', {chatId, requestId, decision});
  if (decision === 'approve' && decided?.execute) return apply(chatId, requestId, decided.execute);
  return decided;
}

export async function applyAgain(chatId: string, requestId: string) {
  const {execute} = await relayAI<{execute: Bundle}>('requests.execute', {chatId, requestId});
  return apply(chatId, requestId, execute);
}

export function actionsFor(card: Pick<AgentCard, 'status' | 'execution'>): ('approve' | 'reject' | 'apply')[] {
  if (card.status === 'pending') return ['approve', 'reject'];
  if (card.status === 'approved' && (card.execution === 'failed' || card.execution === 'ready')) return ['apply'];
  return [];
}

export function cardHeading(preview: AgentCard['preview']) {
  if (!preview) return 'Change request';
  return preview.target ? `${preview.title}: ${preview.target.doctype} · ${preview.target.name}` : preview.title;
}

export function cardStatus(card: AgentCard) {
  if (card.status === 'pending') return 'Waiting for your approval';
  if (card.status === 'rejected') return 'Rejected';
  if (card.status === 'expired') return 'Expired';
  if (card.status === 'restricted') return 'No longer available';
  if (card.execution === 'executed')
    return card.coordination?.status === 'active' ? 'Approved · running in Messenger' : 'Approved · done';
  if (card.execution === 'failed') return `Not applied${card.error ? `: ${card.error}` : ''}`;
  if (card.execution === 'ready') return 'Approved · not applied yet';
  return 'Approved · recorded (nothing changed in ERP)';
}
