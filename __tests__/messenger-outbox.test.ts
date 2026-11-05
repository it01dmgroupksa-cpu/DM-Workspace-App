import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The relay is the only way out of the phone; each test decides how it answers.
const mockRelay = jest.fn<(op: string, data?: any) => Promise<any>>();
jest.mock('../src/messenger/api', () => {
  const withStatus = (message: string, status: number) =>
    Object.assign(new Error(message), {status});
  return {
    relay: (op: string, data?: any) => mockRelay(op, data),
    uploadFile: jest.fn(),
    withStatus,
  };
});
import {createMessenger} from '../src/messenger/store';
import {backoff, transient} from '../src/messenger/outbox';

const ME = 'sara@dm.sa';
const conv = {
  id: 'c1',
  kind: 'direct',
  title: '',
  peer: 'omar@dm.sa',
  role: 'member',
  pinned: false,
  archived: false,
  unread: 0,
  memberCount: 2,
  createdAt: '2026-11-01T00:00:00.000Z',
};
const offline = () =>
  Object.assign(new Error('No connection. Check your network.'), {status: 0});
const sent: any[] = [];
let accept: 'no' | 'yes' | 'refuse' | 'lose-reply' = 'yes';
function server() {
  mockRelay.mockImplementation(async (op, data) => {
    if (op === 'bootstrap')
      return {
        me: {user: ME, name: 'Sara'},
        limits: {},
        conversations: [conv],
        calls: [],
      };
    if (op === 'messages.send') {
      if (accept === 'no') throw offline();
      if (accept === 'refuse')
        throw Object.assign(
          new Error('You are no longer a member of this group.'),
          {status: 417},
        );
      // The server keeps one message per clientId, as the panel does.
      let message = sent.find(m => m.clientId === data.clientId);
      if (!message) {
        message = {
          id: `m${sent.length + 1}`,
          clientId: data.clientId,
          conversationId: data.conversationId,
          sender: ME,
          kind: 'text',
          body: data.body,
          createdAt: new Date().toISOString(),
          reactions: [],
        };
        sent.push(message);
      }
      if (accept === 'lose-reply') {
        accept = 'yes';
        throw offline(); // stored, but the answer never came back
      }
      return {message};
    }
    throw offline(); // directory, stream.ticket…: not needed here
  });
}
const flush = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
async function open() {
  const m = createMessenger(ME, () => {});
  await m.start();
  await flush();
  return m;
}
const mine = (m: ReturnType<typeof createMessenger>) =>
  m.thread('c1').list.filter(x => x.sender === ME);

beforeEach(async () => {
  jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate']});
  jest.spyOn(Math, 'random').mockReturnValue(1);
  await AsyncStorage.clear();
  sent.length = 0;
  mockRelay.mockReset();
  server();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the outgoing queue', () => {
  it('shows a message offline as pending, keeps it, and sends it by itself later', async () => {
    const m = await open();
    accept = 'no';
    await m.send('c1', 'hello');
    await flush();
    expect(mine(m)).toEqual([
      expect.objectContaining({body: 'hello', pending: true}),
    ]);
    expect(mine(m)[0].failed).toBeFalsy();
    expect(m.pendingCount()).toBe(1);
    const saved = JSON.parse(
      (await AsyncStorage.getItem(`messenger.${ME}.outbox`)) || '[]',
    );
    expect(saved).toEqual([
      expect.objectContaining({body: 'hello', state: 'queued'}),
    ]);

    accept = 'yes'; // the network is back
    await jest.advanceTimersByTimeAsync(backoff(1) + 10);
    await flush();
    expect(sent).toHaveLength(1);
    expect(mine(m)).toEqual([
      expect.objectContaining({id: 'm1', body: 'hello'}),
    ]);
    expect(mine(m)[0].pending).toBeFalsy();
    expect(m.pendingCount()).toBe(0);
    m.stop();
  });

  it('never duplicates a message whose reply was lost', async () => {
    const m = await open();
    accept = 'lose-reply';
    await m.send('c1', 'only once');
    await flush();
    await jest.advanceTimersByTimeAsync(backoff(1) + 10);
    await flush();
    expect(sent).toHaveLength(1);
    const calls = mockRelay.mock.calls.filter(([op]) => op === 'messages.send');
    expect(calls).toHaveLength(2);
    expect(calls[0][1].clientId).toBe(calls[1][1].clientId);
    expect(mine(m)).toHaveLength(1);
    m.stop();
  });

  it('sends in the order written', async () => {
    const m = await open();
    accept = 'no';
    for (const body of ['one', 'two', 'three']) await m.send('c1', body);
    await flush();
    accept = 'yes';
    // Each failed try waits longer, up to a minute.
    await jest.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(sent.map(x => x.body)).toEqual(['one', 'two', 'three']);
    m.stop();
  });

  it('marks a message failed only when the server refuses it, and retries on request', async () => {
    const m = await open();
    accept = 'refuse';
    await m.send('c1', 'refused');
    await flush();
    expect(mine(m)[0]).toMatchObject({
      failed: true,
      error: 'You are no longer a member of this group.',
    });
    accept = 'yes';
    await m.retryMessage(mine(m)[0]);
    await flush();
    expect(mine(m)).toEqual([
      expect.objectContaining({id: 'm1', body: 'refused'}),
    ]);
    m.stop();
  });

  it('keeps unsent messages and drafts across an app restart, then sends them', async () => {
    const first = await open();
    accept = 'no';
    await first.send('c1', 'written offline');
    first.setDraft('c1', 'half a thought');
    await flush();
    first.stop();
    await flush();

    const second = await open(); // the app opened again, still offline
    expect(mine(second)).toEqual([
      expect.objectContaining({body: 'written offline', pending: true}),
    ]);
    expect(second.draftOf('c1')).toBe('half a thought');
    accept = 'yes';
    await jest.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(sent.map(x => x.body)).toEqual(['written offline']);
    second.stop();
  });

  it('cancels a message that has not been sent', async () => {
    const m = await open();
    accept = 'no';
    await m.send('c1', 'never mind');
    await flush();
    m.discard(mine(m)[0]);
    accept = 'yes';
    await jest.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(sent).toHaveLength(0);
    expect(mine(m)).toHaveLength(0);
    m.stop();
  });
});

describe('what counts as worth retrying', () => {
  it('retries no network, timeouts, busy or restarting servers, not refusals', () => {
    expect(transient({status: 0})).toBe(true);
    expect(transient({status: 503})).toBe(true);
    expect(transient({status: 429})).toBe(true);
    expect(
      transient({
        status: 417,
        message:
          'Messenger is unavailable. Check your connection and try again.',
      }),
    ).toBe(true);
    expect(transient({status: 417, message: 'This message is too long.'})).toBe(
      false,
    );
    expect(
      transient({
        status: 403,
        message: 'This messenger operation is not available',
      }),
    ).toBe(false);
  });
  it('backs off exponentially up to a minute', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1);
    expect(backoff(1)).toBe(2000);
    expect(backoff(3)).toBe(8000);
    expect(backoff(20)).toBe(60_000);
  });
});
