import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';

const mockRelay = jest.fn<(op: string, data?: any) => Promise<any>>();
jest.mock('../src/messenger/api', () => ({
  relay: (op: string, data?: any) => mockRelay(op, data),
  uploadFile: jest.fn(),
  cancelRemoteUpload: jest.fn(),
  withStatus: (message: string, status: number) =>
    Object.assign(new Error(message), {status}),
}));
import {createMessenger} from '../src/messenger/store';

const ME = 'sara@dm.sa';
const group = {
  id: 'g1',
  kind: 'group',
  title: 'Sales',
  role: 'admin',
  pinned: false,
  archived: false,
  unread: 0,
  memberCount: 3,
  createdAt: '2026-11-01T00:00:00.000Z',
};
const message = (id: string, extra: object = {}) => ({
  id,
  conversationId: 'g1',
  sender: 'omar@dm.sa',
  kind: 'text',
  body: `message ${id}`,
  createdAt: '2026-11-05T10:00:00.000Z',
  reactions: [],
  ...extra,
});
const originalState = AppState.currentState;
let serverPins: any[] = [];
const sentPayloads: any[] = [];
function server() {
  mockRelay.mockImplementation(async (op, data) => {
    switch (op) {
      case 'bootstrap':
        return {
          me: {user: ME, name: 'Sara'},
          limits: {},
          conversations: [group],
          calls: [],
        };
      case 'messages.pins':
        return {pins: serverPins};
      case 'messages.pin':
        serverPins = data.pinned
          ? [message(data.messageId), ...serverPins]
          : serverPins.filter(p => p.id !== data.messageId);
        return {pins: serverPins};
      case 'conversations.members':
        return {
          members: [{user: ME}, {user: 'omar@dm.sa'}, {user: 'mona@dm.sa'}],
          people: {
            'mona@dm.sa': {user: 'mona@dm.sa', name: 'Mona'},
            'omar@dm.sa': {user: 'omar@dm.sa', name: 'Omar'},
          },
        };
      case 'messages.send':
        sentPayloads.push(data);
        return {
          message: message('m-sent', {
            clientId: data.clientId,
            sender: ME,
            body: data.body,
            mentions: data.mentions,
            mentionAll: data.mentionAll,
          }),
        };
      case 'messages.edit':
        sentPayloads.push({edit: data});
        return {ok: true};
      case 'messages.messages':
      default:
        throw Object.assign(new Error('offline'), {status: 0});
    }
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

beforeEach(async () => {
  (AppState as any).currentState = 'active'; // a phone with the app open
  jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate']});
  await AsyncStorage.clear();
  serverPins = [];
  sentPayloads.length = 0;
  mockRelay.mockReset();
  server();
});
afterEach(() => {
  (AppState as any).currentState = originalState;
  jest.useRealTimers();
});

describe('pinned messages on the phone', () => {
  it('load when a chat opens and follow pins and unpins', async () => {
    serverPins = [message('m1')];
    const m = await open();
    m.setActive('g1');
    await flush();
    expect(m.pins.get('g1')?.map(p => p.id)).toEqual(['m1']);
    await m.pin(message('m2') as never, true);
    expect(m.pins.get('g1')?.map(p => p.id)).toEqual(['m2', 'm1']);
    await m.pin(message('m1') as never, false);
    expect(m.pins.get('g1')?.map(p => p.id)).toEqual(['m2']);
    m.stop();
  });

  it('drop a message deleted for everyone, and one deleted for me', async () => {
    serverPins = [message('m1'), message('m2')];
    const m = await open();
    m.setActive('g1');
    await flush();
    mockRelay.mockImplementation(async op =>
      op === 'messages.delete' ? {ok: true} : {pins: serverPins},
    );
    await m.remove(message('m1') as never, true);
    expect(m.pins.get('g1')?.map(p => p.id)).toEqual(['m2']);
    await m.remove(message('m2') as never, false);
    expect(m.pins.get('g1')).toEqual([]);
    m.stop();
  });

  it('refresh when someone edits a pinned message, and drop it when it is deleted for everyone', async () => {
    serverPins = [message('m1')];
    const m = await open();
    m.setActive('g1');
    await flush();
    m.receive(
      message('m1', {
        body: 'edited wording',
        editedAt: '2026-11-05T10:05:00.000Z',
      }) as never,
    );
    expect(m.pins.get('g1')?.[0]).toMatchObject({
      id: 'm1',
      body: 'edited wording',
    });
    m.receive(message('m1', {deleted: true, body: ''}) as never);
    expect(m.pins.get('g1')).toEqual([]);
    m.stop();
  });
});

describe('@mentions through the queue', () => {
  it('send the people named and @all with the message', async () => {
    const m = await open();
    await m.send('g1', '@Mona please check', null, {
      users: ['mona@dm.sa'],
      all: false,
    });
    await flush();
    expect(sentPayloads[0]).toMatchObject({
      body: '@Mona please check',
      mentions: ['mona@dm.sa'],
    });
    expect(sentPayloads[0].mentionAll).toBeUndefined();
    await m.send('g1', '@all meeting', null, {users: [], all: true});
    await flush();
    expect(sentPayloads[1]).toMatchObject({mentionAll: true});
    expect(sentPayloads[1].mentions).toBeUndefined();
    m.stop();
  });

  it('are kept when a message waits offline and are sent when it does', async () => {
    const m = await open();
    const original = mockRelay.getMockImplementation()!;
    mockRelay.mockImplementation(async (op, data) => {
      if (op === 'messages.send')
        throw Object.assign(new Error('No connection.'), {status: 0});
      return original(op, data);
    });
    await m.send('g1', '@Mona hello', null, {
      users: ['mona@dm.sa'],
      all: false,
    });
    await flush();
    const saved = JSON.parse(
      (await AsyncStorage.getItem(`messenger.${ME}.outbox`)) || '[]',
    );
    expect(saved[0]).toMatchObject({mentions: ['mona@dm.sa'], state: 'queued'});
    mockRelay.mockImplementation(original);
    await jest.advanceTimersByTimeAsync(60_000);
    await flush();
    expect(sentPayloads[0]).toMatchObject({mentions: ['mona@dm.sa']});
    m.stop();
  });

  it('edit with the names that are still there', async () => {
    const m = await open();
    await m.edit(message('m9', {sender: ME}) as never, '@Mona only', [
      'mona@dm.sa',
    ]);
    expect(sentPayloads.at(-1)).toEqual({
      edit: {messageId: 'm9', body: '@Mona only', mentions: ['mona@dm.sa']},
    });
    m.stop();
  });

  it("list a group's members once, for the mention picker", async () => {
    const m = await open();
    expect(await m.membersOf('g1')).toEqual([ME, 'omar@dm.sa', 'mona@dm.sa']);
    await m.membersOf('g1');
    expect(
      mockRelay.mock.calls.filter(([op]) => op === 'conversations.members'),
    ).toHaveLength(1);
    expect(m.people.get('mona@dm.sa')?.name).toBe('Mona');
    m.stop();
  });

  it('flag a chat when I am mentioned, not for other messages, and clear it when I read', async () => {
    const m = await open();
    m.setActive(null);
    m.receive(
      message('m5', {
        createdAt: new Date(Date.now() + 1000).toISOString(),
      }) as never,
    );
    expect(m.convs.get('g1')).toMatchObject({unread: 1});
    expect(m.convs.get('g1')!.mentioned).toBeFalsy();
    m.receive(
      message('m6', {
        mentions: [ME],
        createdAt: new Date(Date.now() + 2000).toISOString(),
      }) as never,
    );
    expect(m.convs.get('g1')).toMatchObject({unread: 2, mentioned: true});
    m.markRead('g1');
    expect(m.convs.get('g1')).toMatchObject({unread: 0, mentioned: false});
    m.receive(
      message('m7', {
        mentionAll: true,
        createdAt: new Date(Date.now() + 3000).toISOString(),
      }) as never,
    );
    expect(m.convs.get('g1')!.mentioned).toBe(true); // @all counts too
    m.stop();
  });
});
