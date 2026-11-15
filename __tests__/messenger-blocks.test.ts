import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';

const mockRelay = jest.fn<(op: string, data?: any) => Promise<any>>();
const mockReport = jest.fn<(report: any) => Promise<void>>();
const mockSync = jest.fn<(ids: string[]) => void>();
jest.mock('../src/messenger/api', () => ({
  relay: (op: string, data?: any) => mockRelay(op, data),
  uploadFile: jest.fn(),
  cancelRemoteUpload: jest.fn(),
  withStatus: (message: string, status: number) =>
    Object.assign(new Error(message), {status}),
}));
jest.mock('../src/messenger/blocks', () => {
  const actual: any = jest.requireActual('../src/messenger/blocks');
  return {
    ...actual,
    sendReport: (report: any) => mockReport(report),
    syncBlockedCalls: (ids: string[]) => mockSync(ids),
  };
});
import {createMessenger, totalUnread} from '../src/messenger/store';

const ME = 'sara@dm.sa';
const OMAR = 'omar@dm.sa';
const conv = (id: string, extra: object) => ({
  id,
  title: '',
  role: 'member',
  pinned: false,
  archived: false,
  unread: 0,
  memberCount: 2,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...extra,
});
const direct = conv('d1', {kind: 'direct', peer: OMAR});
const group = conv('g1', {kind: 'group', title: 'Sales', memberCount: 3});
const message = (id: string, conversationId: string, sender = OMAR) => ({
  id,
  conversationId,
  sender,
  kind: 'text',
  body: `message ${id}`,
  createdAt: new Date().toISOString(),
  reactions: [],
});
const settingsCalls: any[] = [];
const originalState = AppState.currentState;
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
  (AppState as any).currentState = 'background';
  jest.useFakeTimers({doNotFake: ['nextTick', 'setImmediate']});
  await AsyncStorage.clear();
  settingsCalls.length = 0;
  mockReport.mockReset().mockResolvedValue(undefined);
  mockSync.mockReset();
  mockRelay.mockReset().mockImplementation(async (op, data) => {
    if (op === 'bootstrap')
      return {
        me: {user: ME, name: 'Sara'},
        limits: {},
        conversations: [direct, group],
        calls: [],
      };
    if (op === 'conversations.settings') {
      settingsCalls.push(data);
      return {conversation: {...direct, mutedUntil: data.mutedUntil}};
    }
    throw Object.assign(new Error('offline'), {status: 0});
  });
});
afterEach(() => {
  (AppState as any).currentState = originalState;
  jest.useRealTimers();
});

describe('blocking someone', () => {
  it('mutes their chat on the server, tells HR and ends their calls natively', async () => {
    const m = await open();
    await m.block(OMAR);
    await flush();
    expect(m.isBlocked(OMAR)).toBe(true);
    expect(settingsCalls[0]).toMatchObject({conversationId: 'd1'});
    expect(new Date(settingsCalls[0].mutedUntil) > new Date()).toBe(true);
    expect(mockReport).toHaveBeenCalledWith(
      expect.objectContaining({type: 'Block', reportedUser: OMAR}),
    );
    expect(mockSync).toHaveBeenLastCalledWith(['d1']);
    m.stop();
  });

  it("doesn't count their new messages as unread, in any chat", async () => {
    const m = await open();
    await m.block(OMAR);
    m.receive(message('a', 'd1') as never);
    m.receive(message('b', 'g1') as never);
    m.receive(message('c', 'g1', 'mona@dm.sa') as never);
    expect(m.convs.get('d1')?.unread).toBe(0);
    expect(m.convs.get('g1')?.unread).toBe(1);
    expect(totalUnread(m)).toBe(1);
    m.stop();
  });

  it('is remembered on the phone and can be undone', async () => {
    const first = await open();
    await first.block(OMAR);
    first.stop();
    const again = await open();
    expect(again.isBlocked(OMAR)).toBe(true);
    await again.unblock(OMAR);
    await flush();
    expect(again.isBlocked(OMAR)).toBe(false);
    expect(settingsCalls.at(-1)).toMatchObject({mutedUntil: null});
    expect(mockSync).toHaveBeenLastCalledWith([]);
    again.stop();
  });

  it("can't block yourself", async () => {
    const m = await open();
    await m.block(ME);
    expect(m.isBlocked(ME)).toBe(false);
    m.stop();
  });
});
