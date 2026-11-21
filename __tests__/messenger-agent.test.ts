import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockErpCall = jest.fn<(...args: any[]) => Promise<any>>();
let mockSession: {sid: string; user: string} | null = {sid: 's1', user: 'ceo@dm.sa'};
jest.mock('../src/messenger/session', () => ({
  currentSession: () => mockSession,
  erpCall: (...args: any[]) => mockErpCall(...args),
}));

import {
  agentAvailable,
  agentCards,
  askAgent,
  languageOf,
  openAgent,
  relayAI,
  resetAgent,
  routeToAgent,
} from '../src/messenger/agent';

beforeEach(() => {
  mockErpCall.mockReset();
  mockSession = {sid: 's1', user: 'ceo@dm.sa'};
  resetAgent();
});

describe('CEO agent from Messenger', () => {
  it('calls durar_ai_relay as the CEO agent with Messenger session', async () => {
    mockErpCall.mockResolvedValue({message: {ok: 1}});
    expect(await relayAI('messenger.open')).toEqual({ok: 1});
    expect(mockErpCall).toHaveBeenCalledWith(
      'durar_ai_relay',
      {operation: 'messenger.open', data: '{}', agent: 'ceo'},
      's1',
    );
  });

  it('keeps the refusal status, so the outbox can tell refused from offline', async () => {
    mockErpCall.mockRejectedValue(
      Object.assign(new Error('Wait for the current answer, or say stop.'), {status: 409}),
    );
    await expect(askAgent('k1', 'Next', 'en')).rejects.toMatchObject({
      status: 409,
      message: 'Wait for the current answer, or say stop.',
    });
  });

  it('asks once per session whether the CEO agent is open to this person', async () => {
    mockErpCall.mockResolvedValue({message: {agent: 'ceo'}});
    expect(await agentAvailable()).toBe(true);
    expect(await agentAvailable()).toBe(true);
    expect(mockErpCall).toHaveBeenCalledTimes(1);
    expect(mockErpCall.mock.calls[0][1]).toMatchObject({operation: 'bootstrap'});
  });

  it('is not available when ERP refuses, and remembers that', async () => {
    mockErpCall.mockRejectedValue(Object.assign(new Error('not allowed'), {status: 403}));
    expect(await agentAvailable()).toBe(false);
    expect(await agentAvailable()).toBe(false);
    expect(mockErpCall).toHaveBeenCalledTimes(1);
  });

  it('asks again after a network failure instead of remembering "no"', async () => {
    mockErpCall.mockRejectedValueOnce(Object.assign(new Error('No connection.'), {status: 0}));
    expect(await agentAvailable()).toBe(false);
    mockErpCall.mockResolvedValue({message: {agent: 'ceo'}});
    expect(await agentAvailable()).toBe(true);
  });

  it('asks again for another signed-in person', async () => {
    mockErpCall.mockResolvedValue({message: {agent: 'ceo'}});
    await agentAvailable();
    mockSession = {sid: 's2', user: 'sara@dm.sa'};
    await agentAvailable();
    expect(mockErpCall).toHaveBeenCalledTimes(2);
  });

  it('opens the chat, asks and reads cards through the messenger operations', async () => {
    mockErpCall.mockResolvedValueOnce({message: {conversationId: 'c1', chatId: 'a1'}});
    expect(await openAgent()).toEqual({conversationId: 'c1', chatId: 'a1'});
    mockErpCall.mockResolvedValueOnce({message: {message: {id: 'm1'}}});
    expect(await askAgent('k1', 'How are sales?', 'en')).toEqual({id: 'm1'});
    expect(JSON.parse(mockErpCall.mock.calls[1][1].data)).toEqual({
      clientId: 'k1',
      text: 'How are sales?',
      language: 'en',
    });
    mockErpCall.mockResolvedValueOnce({message: {cards: [{id: 'r1'}]}});
    expect(await agentCards(['r1'])).toEqual([{id: 'r1'}]);
  });

  it('sends only text in the agent chat to the agent', () => {
    expect(routeToAgent({conversationId: 'c1'}, 'c1')).toBe(true);
    expect(routeToAgent({conversationId: 'c2'}, 'c1')).toBe(false);
    expect(routeToAgent({conversationId: 'c1', file: {uri: 'x'}}, 'c1')).toBe(false);
    expect(routeToAgent({conversationId: 'c1'}, null)).toBe(false);
  });

  it('answers in Arabic when the question is Arabic', () => {
    expect(languageOf('كم المبيعات؟')).toBe('ar');
    expect(languageOf('How are sales?')).toBe('en');
  });

  it('fails cleanly when Messenger is signed out', async () => {
    mockSession = null;
    await expect(relayAI('messenger.open')).rejects.toThrow('Sign in to Messenger.');
  });
});
