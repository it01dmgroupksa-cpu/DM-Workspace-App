import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockRelayAI = jest.fn<(...args: any[]) => Promise<any>>();
const mockErpCall = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../src/messenger/agent', () => ({
  relayAI: (...args: any[]) => mockRelayAI(...args),
}));
jest.mock('../src/messenger/session', () => ({
  currentSession: () => ({sid: 's1', user: 'ceo@dm.sa'}),
  erpCall: (...args: any[]) => mockErpCall(...args),
}));
import {actionsFor, applyAgain, cardHeading, decide} from '../src/messenger/approvals';

const bundle = {proposal: 'P', company: 'DM', payload: 'X', authorization: {sig: 'a'}};
const calls = () => mockRelayAI.mock.calls.map(c => [c[0], c[1]]);

beforeEach(() => {
  mockRelayAI.mockReset();
  mockErpCall.mockReset();
});

describe('approval cards in the Durar Assistant chat', () => {
  it('approve applies the change in ERP as the CEO, then reports the receipt', async () => {
    mockRelayAI.mockResolvedValueOnce({execute: bundle}).mockResolvedValueOnce({execution: 'executed'});
    mockErpCall.mockResolvedValue({message: {receipt: 'r'}});
    expect(await decide('chat-1', 'req-1', 'approve')).toEqual({execution: 'executed'});
    expect(mockErpCall).toHaveBeenCalledWith(
      'durar_ai_execute',
      {mode: 'execute', proposal: 'P', company: 'DM', payload: 'X', authorization: JSON.stringify({sig: 'a'})},
      's1',
    );
    expect(calls()).toEqual([
      ['requests.decide', {chatId: 'chat-1', requestId: 'req-1', decision: 'approve'}],
      ['requests.complete', {chatId: 'chat-1', requestId: 'req-1', result: {receipt: 'r'}}],
    ]);
  });

  it('an ERP failure is still reported, so the card offers Apply again', async () => {
    mockRelayAI.mockResolvedValueOnce({execute: bundle}).mockResolvedValueOnce({execution: 'failed'});
    mockErpCall.mockRejectedValue(new Error('Customer was changed by someone else.'));
    await decide('chat-1', 'req-1', 'approve');
    expect(calls()[1]).toEqual([
      'requests.complete',
      {chatId: 'chat-1', requestId: 'req-1', error: 'Customer was changed by someone else.'},
    ]);
  });

  it('reject records the decision and never calls ERP', async () => {
    mockRelayAI.mockResolvedValueOnce({decided: true});
    await decide('chat-1', 'req-1', 'reject');
    expect(mockErpCall).not.toHaveBeenCalled();
    expect(calls()).toEqual([['requests.decide', {chatId: 'chat-1', requestId: 'req-1', decision: 'reject'}]]);
  });

  it('an approval that applies nothing automatically only records the decision', async () => {
    mockRelayAI.mockResolvedValueOnce({decided: true});
    await decide('chat-1', 'req-1', 'approve');
    expect(mockErpCall).not.toHaveBeenCalled();
  });

  it('apply again asks for a fresh instruction, then applies it', async () => {
    mockRelayAI.mockResolvedValueOnce({execute: bundle}).mockResolvedValueOnce({execution: 'executed'});
    mockErpCall.mockResolvedValue({message: {receipt: 'r'}});
    await applyAgain('chat-1', 'req-1');
    expect(calls().map(c => c[0])).toEqual(['requests.execute', 'requests.complete']);
  });

  it('shows the buttons that fit the card', () => {
    expect(actionsFor({status: 'pending', execution: 'waiting'} as any)).toEqual(['approve', 'reject']);
    expect(actionsFor({status: 'approved', execution: 'failed'} as any)).toEqual(['apply']);
    expect(actionsFor({status: 'approved', execution: 'ready'} as any)).toEqual(['apply']);
    expect(actionsFor({status: 'approved', execution: 'executed'} as any)).toEqual([]);
    expect(actionsFor({status: 'expired', execution: 'waiting'} as any)).toEqual([]);
  });

  it('heads the card like the agent page', () => {
    expect(cardHeading({title: 'Update', target: {doctype: 'Customer', name: 'C-1'}})).toBe('Update: Customer · C-1');
    expect(cardHeading({title: 'Send email'})).toBe('Send email');
    expect(cardHeading(undefined)).toBe('Change request');
  });
});
