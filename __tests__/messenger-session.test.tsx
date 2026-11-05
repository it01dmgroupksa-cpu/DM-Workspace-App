import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import renderer, {act} from 'react-test-renderer';
import * as SecureStore from 'expo-secure-store';
import {relay} from '../src/messenger/api';
import {
  ChatSessionProvider,
  SESSION_DAYS,
  expired,
  sidFrom,
  signIn,
  useChatSession,
} from '../src/messenger/session';

type Reply = {status?: number; body?: any; cookie?: string};
const calls: {url: string; init: any}[] = [];
function serve(...replies: Reply[]) {
  (global as any).fetch = jest.fn(async (url: string, init: any) => {
    calls.push({url, init});
    const r = replies.shift() || {body: {message: null}};
    return {
      ok: (r.status || 200) < 400,
      status: r.status || 200,
      headers: {
        get: (name: string) =>
          name === 'set-cookie' ? r.cookie || null : null,
      },
      json: async () => r.body || {},
    };
  });
}
const body = (i: number) => JSON.parse(calls[i].init.body);
const DAY = 86_400_000;

beforeEach(() => {
  calls.length = 0;
  (SecureStore as any).__store.clear();
});
afterEach(() => {
  delete (global as any).fetch;
});

describe('the ERP session id from the login response', () => {
  it('reads sid from the combined Set-Cookie header of either platform', () => {
    expect(
      sidFrom('sid=abc123; path=/; HttpOnly, system_user=yes; path=/'),
    ).toBe('abc123');
    expect(
      sidFrom(
        'full_name=Sara, sid=def456; Expires=Thu, 05 Dec 2026 10:00:00 GMT; path=/',
      ),
    ).toBe('def456');
    expect(sidFrom('sid=Guest; path=/')).toBeNull();
    expect(sidFrom(null)).toBeNull();
  });
});

describe('the monthly sign-out', () => {
  it(`ends ${SESSION_DAYS} days after sign-in, and if the clock was turned back`, () => {
    const now = Date.parse('2026-11-05T10:00:00Z');
    expect(
      expired({sid: 's', user: 'u', signedInAt: now - 29 * DAY}, now),
    ).toBe(false);
    expect(
      expired({sid: 's', user: 'u', signedInAt: now - 31 * DAY}, now),
    ).toBe(true);
    expect(expired({sid: 's', user: 'u', signedInAt: now + 2 * DAY}, now)).toBe(
      true,
    );
  });
});

describe('signing in to Messenger', () => {
  it('starts a mobile session without touching the shared cookies, and checks chat access', async () => {
    serve(
      {body: {message: 'Logged In'}, cookie: 'sid=s3cret; path=/; HttpOnly'},
      {body: {message: 'sara@dm.sa'}},
      {body: {message: {custom_allow_app: 1, custom_allow_chat_module: 1}}},
    );
    const session = await signIn(' Sara@dm.sa ', 'pw');
    expect(session).toMatchObject({sid: 's3cret', user: 'sara@dm.sa'});
    expect(body(0)).toEqual({usr: 'Sara@dm.sa', pwd: 'pw', device: 'mobile'});
    expect(calls.every(c => c.init.credentials === 'omit')).toBe(true);
    expect(body(1).sid).toBe('s3cret');
    expect(body(2)).toMatchObject({
      doctype: 'Employee',
      filters: {user_id: 'sara@dm.sa'},
      sid: 's3cret',
    });
  });
  it('says plainly when the password is wrong', async () => {
    serve({status: 401, body: {message: 'Invalid Login. Try again.'}});
    await expect(signIn('sara', 'bad')).rejects.toThrow(
      'Wrong username or password.',
    );
  });
  it('refuses employees without the chat module and ends the session it started', async () => {
    serve(
      {body: {message: 'Logged In'}, cookie: 'sid=s3cret'},
      {body: {message: 'sara@dm.sa'}},
      {body: {message: {custom_allow_app: 1, custom_allow_chat_module: 0}}},
      {body: {}},
    );
    await expect(signIn('sara', 'pw')).rejects.toThrow(
      "Messenger isn't turned on",
    );
    await act(async () => {});
    expect(calls[3].url).toMatch(/\/logout$/);
    expect(body(3).sid).toBe('s3cret');
  });
});

describe('a signed-in Messenger', () => {
  let status = '';
  function Probe() {
    status = useChatSession().status;
    return null;
  }
  async function start(signedInAt = Date.now()) {
    await SecureStore.setItemAsync(
      'messenger.session',
      JSON.stringify({sid: 's1', user: 'sara@dm.sa', signedInAt}),
    );
    let app: any;
    await act(async () => {
      app = renderer.create(
        <ChatSessionProvider>
          <Probe />
        </ChatSessionProvider>,
      );
    });
    return app;
  }
  it('stays signed in across app starts and sends its own session id', async () => {
    serve(
      {body: {message: {custom_allow_app: 1, custom_allow_chat_module: 1}}},
      {body: {message: {ok: true}}},
    );
    const app = await start();
    expect(status).toBe('signedIn');
    await act(async () => {
      await relay('typing', {conversationId: 'c1'});
    });
    expect(body(1)).toEqual({
      operation: 'typing',
      data: '{"conversationId":"c1"}',
      sid: 's1',
    });
    app.unmount();
  });
  it('signs out after the month is up', async () => {
    serve({body: {}}, {body: {}});
    const app = await start(Date.now() - 31 * DAY);
    expect(status).toBe('signedOut');
    expect(await SecureStore.getItemAsync('messenger.session')).toBeNull();
    app.unmount();
  });
  it('signs out when ERP refuses the session (password changed, account disabled)', async () => {
    serve(
      {body: {message: {custom_allow_app: 1, custom_allow_chat_module: 1}}},
      {status: 403, body: {exc_type: 'PermissionError'}},
    );
    const app = await start();
    await act(async () => {
      await expect(relay('conversations.list')).rejects.toThrow();
    });
    expect(status).toBe('signedOut');
    app.unmount();
  });
  it('stays signed in when ERP only lacks a newer operation', async () => {
    const notAvailable = JSON.stringify([
      JSON.stringify({message: 'This messenger operation is not available'}),
    ]);
    serve(
      {body: {message: {custom_allow_app: 1, custom_allow_chat_module: 1}}},
      {status: 403, body: {_server_messages: notAvailable}},
    );
    const app = await start();
    await act(async () => {
      await expect(relay('devices.register', {})).rejects.toThrow(
        'not available',
      );
    });
    expect(status).toBe('signedIn');
    app.unmount();
  });
  it('signs out when chat access was withdrawn in ERP', async () => {
    serve(
      {body: {message: {custom_allow_app: 1, custom_allow_chat_module: 0}}},
      {body: {}},
    );
    const app = await start();
    await act(async () => {});
    expect(status).toBe('signedOut');
    app.unmount();
  });
});
