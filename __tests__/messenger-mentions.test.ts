import {describe, expect, it} from '@jest/globals';
import {
  insertMention,
  matchPeople,
  mentionQuery,
  pieces,
  stillMentioned,
} from '../src/messenger/mentions';
import {pinEntry, systemText} from '../src/messenger/format';

describe('typing an @mention', () => {
  it('finds the name being typed, only where an @ starts a word', () => {
    expect(mentionQuery('hello @sa', 9)).toEqual({start: 6, query: 'sa'});
    expect(mentionQuery('@', 1)).toEqual({start: 0, query: ''});
    expect(mentionQuery('mail me at sara@dm.sa', 21)).toBeNull(); // an email address
    expect(mentionQuery('hi @sara how are you', 7)).toEqual({
      start: 3,
      query: 'sar',
    }); // cursor mid-word
    expect(mentionQuery('hi @sara how', 12)).toEqual({
      start: 3,
      query: 'sara how',
    });
    expect(mentionQuery('hi @sara\nnext line', 18)).toBeNull(); // not across lines
    expect(mentionQuery('a long @' + 'x'.repeat(40), 48)).toBeNull();
  });

  it('puts the chosen name in place and moves the cursor after it', () => {
    const result = insertMention('hello @sa and more', 6, 9, 'Sara Ali');
    expect(result.text).toBe('hello @Sara Ali  and more');
    expect(result.cursor).toBe('hello @Sara Ali '.length);
  });

  it('suggests names starting with what was typed, then names containing it', () => {
    const people = [
      {name: 'Omar Hassan'},
      {name: 'Sara Ali'},
      {name: 'Rasha Saad'},
      {name: 'Hassan Sami'},
    ];
    expect(matchPeople(people, 'sa').map(p => p.name)).toEqual([
      'Sara Ali',
      'Rasha Saad',
      'Hassan Sami',
      'Omar Hassan',
    ]);
    expect(matchPeople(people, 'ha').map(p => p.name)).toEqual([
      'Omar Hassan',
      'Hassan Sami',
      'Rasha Saad',
    ]);
    expect(matchPeople(people, '', 2)).toHaveLength(2);
    expect(matchPeople(people, 'zzz')).toEqual([]);
  });

  it('counts only the people still named when the message is sent', () => {
    const chosen = new Map([
      ['sara@dm.sa', 'Sara Ali'],
      ['omar@dm.sa', 'Omar Hassan'],
      ['@all', 'all'],
    ]);
    expect(stillMentioned('@Sara Ali please check', chosen)).toEqual({
      users: ['sara@dm.sa'],
      all: false,
    });
    expect(stillMentioned('@all and @omar hassan', chosen)).toEqual({
      users: ['omar@dm.sa'],
      all: true,
    }); // case-insensitive
    expect(stillMentioned('Sara Ali without the at sign', chosen)).toEqual({
      users: [],
      all: false,
    });
    expect(
      stillMentioned('@Sara Alison is someone else', chosen).users,
    ).toEqual([]); // not a prefix match
  });

  it('handles Arabic names', () => {
    const chosen = new Map([['mona@dm.sa', 'منى أحمد']]);
    expect(stillMentioned('مرحبا @منى أحمد، تفضلي', chosen).users).toEqual([
      'mona@dm.sa',
    ]);
    expect(pieces('مرحبا @منى أحمد، تفضلي', ['منى أحمد'])).toEqual([
      {text: 'مرحبا ', kind: 'text'},
      {text: '@منى أحمد', kind: 'mention'},
      {text: '، تفضلي', kind: 'text'},
    ]);
  });
});

describe('showing a message', () => {
  it('marks the people mentioned and the web addresses, nothing else', () => {
    expect(
      pieces('@Sara Ali see https://erp.example/quote?id=5, ok', ['Sara Ali']),
    ).toEqual([
      {text: '@Sara Ali', kind: 'mention'},
      {text: ' see ', kind: 'text'},
      {text: 'https://erp.example/quote?id=5', kind: 'link'},
      {text: ', ok', kind: 'text'},
    ]);
  });
  it("doesn't mark a name nobody was mentioned by, or a longer name sharing its start", () => {
    expect(pieces('@Sara Ali', [])).toEqual([
      {text: '@Sara Ali', kind: 'text'},
    ]);
    expect(pieces('@Sarah', ['Sara'])).toEqual([
      {text: '@Sarah', kind: 'text'},
    ]);
    expect(
      pieces('@Sara Ali and @Sara', ['Sara Ali', 'Sara']).map(p => p.kind),
    ).toEqual(['mention', 'text', 'mention']);
  });
  it('is safe with names that contain regular-expression characters', () => {
    expect(pieces('hi @A.B (C)+', ['A.B (C)+'])[1]).toEqual({
      text: '@A.B (C)+',
      kind: 'mention',
    });
    expect(pieces('hi @AxB', ['A.B'])).toEqual([
      {text: 'hi @AxB', kind: 'text'},
    ]);
  });
  it('marks @all', () => {
    expect(pieces('@all meeting at 3', ['all'])[0]).toEqual({
      text: '@all',
      kind: 'mention',
    });
  });
});

describe('the pinned notice', () => {
  const people = new Map([
    ['sara@dm.sa', {user: 'sara@dm.sa', name: 'Sara Ali'}],
  ]);
  const event = {
    sender: 'sara@dm.sa',
    body: JSON.stringify({event: 'pinned', messageId: 'm1'}),
  };
  it('names who pinned and points at the message', () => {
    expect(systemText(event, 'me@dm.sa', people)).toBe(
      'Sara Ali pinned a message',
    );
    expect(systemText({...event, sender: 'me@dm.sa'}, 'me@dm.sa', people)).toBe(
      'You pinned a message',
    );
    expect(pinEntry(event as never)).toEqual({
      event: 'pinned',
      messageId: 'm1',
    });
    expect(pinEntry({body: 'not json'} as never)).toBeNull();
  });
});
