import {describe, expect, it} from '@jest/globals';
import {preview, systemText, ticks} from '../src/messenger/format';
import type {Conversation, Message, Person} from '../src/messenger/types';

const me = 'me@dm.sa';
const people = new Map<string, Person>([
  ['sara@dm.sa', {user: 'sara@dm.sa', name: 'Sara Ali'}],
]);
const message = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  conversationId: 'c1',
  sender: me,
  kind: 'text',
  body: 'hello',
  createdAt: '2026-11-05T10:00:00.000Z',
  reactions: [],
  ...over,
});
const conv = (over: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  kind: 'direct',
  title: '',
  peer: 'sara@dm.sa',
  role: 'member',
  pinned: false,
  archived: false,
  unread: 0,
  memberCount: 2,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

describe('ticks', () => {
  it('goes sent, delivered, read as the other side catches up', () => {
    expect(ticks(message(), conv())).toBe('sent');
    expect(
      ticks(message(), conv({othersDeliveredAt: '2026-11-05T10:00:01.000Z'})),
    ).toBe('delivered');
    expect(
      ticks(message(), conv({othersReadAt: '2026-11-05T10:00:02.000Z'})),
    ).toBe('read');
  });
  it('shows local states and nothing for system or deleted messages', () => {
    expect(ticks(message({pending: true}), conv())).toBe('pending');
    expect(ticks(message({failed: true}), conv())).toBe('failed');
    expect(ticks(message({kind: 'system'}), conv())).toBeNull();
    expect(ticks(message({deleted: true}), conv())).toBeNull();
  });
});

describe('call entries', () => {
  const call = (sender: string, reason: string) =>
    systemText(
      {
        sender,
        body: JSON.stringify({
          event: 'call',
          video: false,
          reason,
          seconds: 75,
        }),
      },
      me,
      people,
    );
  it('reads as a missed call to the person called, and no answer to the caller', () => {
    expect(call('sara@dm.sa', 'missed')).toBe(
      'Missed voice call from Sara Ali',
    );
    expect(call(me, 'missed')).toBe('Voice call · No answer');
    expect(call(me, 'completed')).toBe('Voice call · 1:15');
  });
});

describe('chat list preview', () => {
  it('names the sender in groups and labels attachments', () => {
    const last = {
      id: 'm',
      sender: 'sara@dm.sa',
      at: '2026-11-05T10:00:00.000Z',
    };
    expect(
      preview(
        conv({
          kind: 'group',
          last: {...last, kind: 'text', body: '*Done* today'},
        }),
        me,
        people,
      ),
    ).toBe('Sara: Done today');
    expect(preview(conv({last: {...last, kind: 'voice'}}), me, people)).toBe(
      '🎤 Voice message',
    );
    expect(
      preview(conv({last: {...last, kind: 'text', deleted: true}}), me, people),
    ).toBe('This message was deleted');
  });
});
