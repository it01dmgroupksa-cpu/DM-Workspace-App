import {beforeEach, describe, expect, it, jest} from '@jest/globals';

// A fake panel: it keeps one upload and answers like lib/messenger/uploads.ts does.
const MB = 1024 * 1024;
const mock = {
  size: 0, // bytes of the file on the phone
  server: null as null | {received: number; size: number; file?: {id: string}},
  sent: [] as number[], // offsets of every chunk that reached the server
  failNext: [] as (string | number)[], // 'network' | 'lose-reply' | an HTTP status
  tickets: 0,
  expireTicket: false,
  created: 0,
  parts: new Map<string, number>(), // slice path -> bytes
};
const mockReply = (status: number, body: object) => ({
  ok: status < 400,
  status,
  body,
  json: async () => body,
});
function view() {
  const s = mock.server!;
  return s.file
    ? {offset: s.size, size: s.size, file: s.file}
    : {offset: s.received, size: s.size};
}
function mockHandle(method: string, url: string, offset?: number, bytes = 0) {
  const params = new URL(url).searchParams;
  if (mock.expireTicket && params.get('t') === 'old')
    return mockReply(401, {error: 'This link has expired.'});
  if (method === 'POST') {
    mock.created++;
    mock.server = {received: 0, size: mock.size};
    return mockReply(200, {
      id: 'up-' + mock.created,
      offset: 0,
      size: mock.size,
    });
  }
  if (!mock.server || params.get('upload') !== 'up-' + mock.created)
    return mockReply(404, {error: 'This upload is no longer available.'});
  if (method === 'GET') return mockReply(200, view());
  if (method === 'DELETE') {
    mock.server = null;
    return mockReply(200, {ok: true});
  }
  const s = mock.server;
  if (offset !== s.received)
    return mockReply(409, {error: 'out of step', offset: s.received});
  mock.sent.push(offset!);
  s.received += bytes;
  if (s.received >= s.size) s.file = {id: 'file-1'};
  return mockReply(200, view());
}

jest.mock('react-native-blob-util', () => {
  const wrap = (p: string) => ({wrapped: p});
  return {
    __esModule: true,
    default: {
      wrap,
      fs: {
        dirs: {CacheDir: '/cache', DocumentDir: '/docs'},
        stat: async (p: string) => ({
          size: p.includes('/cache/') ? mock.parts.get(p) : mock.size,
        }),
        hash: async () => 'a'.repeat(64),
        unlink: async (p: string) => void mock.parts.delete(p),
        slice: async (_src: string, dest: string, start: number, end: number) =>
          void mock.parts.set(dest, end - start),
      },
      fetch: (
        method: string,
        url: string,
        headers: Record<string, string>,
        body: {wrapped: string},
      ) => {
        const next = mock.failNext[0];
        const run = async () => {
          if (
            typeof next === 'string' &&
            next === 'network' &&
            method === 'PATCH'
          ) {
            mock.failNext.shift();
            throw new Error('Network request failed');
          }
          if (
            method === 'POST' &&
            !headers['X-Upload-Offset'] &&
            !url.includes('upload=')
          ) {
            // single-request upload
            mock.sent.push(-1);
            return {
              json: () => ({file: {id: 'file-single'}}),
              info: () => ({status: 200}),
            };
          }
          const bytes = mock.parts.get(body.wrapped) || 0;
          const result = mockHandle(
            method,
            url,
            Number(headers['X-Upload-Offset']),
            bytes,
          );
          if (next === 'lose-reply' && method === 'PATCH') {
            mock.failNext.shift();
            throw new Error('Network request failed'); // the server stored it; the reply never came
          }
          if (typeof next === 'number' && method === 'PATCH') {
            mock.failNext.shift();
            return {
              json: () => ({error: 'damaged'}),
              info: () => ({status: next}),
            };
          }
          return {
            json: () => result.body,
            info: () => ({status: result.status}),
          }; // the library's json() is synchronous
        };
        const promise: any = run();
        promise.uploadProgress = (
          _c: unknown,
          cb: (a: number, b: number) => void,
        ) => (
          cb(mockBytesOf(body.wrapped), mockBytesOf(body.wrapped)), promise
        );
        promise.cancel = jest.fn();
        return promise;
      },
    },
  };
});
const mockBytesOf = (p: string) => mock.parts.get(p) || 1;
import {resumableUpload, CHUNK_BYTES} from '../src/messenger/upload';

const file = {
  uri: 'file:///docs/quote.pdf',
  name: 'quote.pdf',
  mime: 'application/pdf',
};
const instantly = () => Promise.resolve();
const ticket = () =>
  Promise.resolve(
    `https://panel.example/api/messenger/v1/files?t=${
      mock.tickets++ && mock.expireTicket
        ? 'new'
        : mock.expireTicket
        ? 'old'
        : 'ok'
    }`,
  );

beforeEach(() => {
  Object.assign(mock, {
    size: 10 * MB,
    server: null,
    sent: [],
    failNext: [],
    tickets: 0,
    expireTicket: false,
    created: 0,
  });
  mock.parts.clear();
  (global as any).fetch = jest.fn(
    async (
      url: string,
      init: {method: string; headers?: Record<string, string>},
    ) =>
      mockHandle(init.method, url, Number(init.headers?.['X-Upload-Offset'])),
  );
});

describe('resumable uploads from the phone', () => {
  it('sends a big file in 4 MB chunks and returns the stored file', async () => {
    const done = await resumableUpload(ticket, file, {}, instantly);
    expect(done).toEqual({id: 'file-1'});
    expect(mock.sent).toEqual([0, CHUNK_BYTES, 2 * CHUNK_BYTES]);
  });

  it('after a dropped connection, continues from where the server stopped', async () => {
    mock.failNext = [];
    let chunks = 0;
    const original = (global as any).fetch;
    // The connection dies as the second chunk goes out.
    const rn = (require('react-native-blob-util') as any).default;
    const fetchChunk = rn.fetch;
    rn.fetch = (...args: any[]) => {
      if (args[0] === 'PATCH' && ++chunks === 2) mock.failNext = ['network'];
      return fetchChunk(...args);
    };
    const done = await resumableUpload(ticket, file, {}, instantly);
    rn.fetch = fetchChunk;
    (global as any).fetch = original;
    expect(done).toEqual({id: 'file-1'});
    // The first chunk was never sent again.
    expect(mock.sent.filter(o => o === 0)).toHaveLength(1);
    expect(mock.sent).toEqual([0, CHUNK_BYTES, 2 * CHUNK_BYTES]);
  });

  it('continues an upload begun before the app restarted, sending only the rest', async () => {
    mock.created = 1;
    mock.server = {received: 2 * CHUNK_BYTES, size: mock.size};
    let session = '';
    const done = await resumableUpload(
      ticket,
      file,
      {uploadId: 'up-1', onSession: id => (session = id)},
      instantly,
    );
    expect(done).toEqual({id: 'file-1'});
    expect(mock.sent).toEqual([2 * CHUNK_BYTES]);
    expect(session).toBe(''); // no new upload was made
    expect(mock.created).toBe(1);
  });

  it('starts over, and says so, when the server no longer knows the upload', async () => {
    let session = '';
    const done = await resumableUpload(
      ticket,
      file,
      {uploadId: 'up-gone', onSession: id => (session = id)},
      instantly,
    );
    expect(done).toEqual({id: 'file-1'});
    expect(session).toBe('up-1');
    expect(mock.sent).toEqual([0, CHUNK_BYTES, 2 * CHUNK_BYTES]);
  });

  it("goes by the server's position when it is out of step", async () => {
    mock.created = 1;
    mock.server = {received: CHUNK_BYTES, size: mock.size};
    // The phone believes it is at 0 (it lost the reply that said otherwise).
    const original = (global as any).fetch;
    let first = true;
    (global as any).fetch = jest.fn(async (url: string, init: any) =>
      init.method === 'GET' && first
        ? ((first = false), mockReply(200, {offset: 0, size: mock.size}))
        : mockHandle(
            init.method,
            url,
            Number(init.headers?.['X-Upload-Offset']),
          ),
    );
    const done = await resumableUpload(
      ticket,
      file,
      {uploadId: 'up-1'},
      instantly,
    );
    (global as any).fetch = original;
    expect(done).toEqual({id: 'file-1'});
    expect(mock.sent).toEqual([CHUNK_BYTES, 2 * CHUNK_BYTES]); // the first chunk was not stored twice
  });

  it('sends a chunk the server found damaged again', async () => {
    mock.failNext = [422];
    const done = await resumableUpload(ticket, file, {}, instantly);
    expect(done).toEqual({id: 'file-1'});
    expect(mock.sent).toEqual([0, CHUNK_BYTES, 2 * CHUNK_BYTES]);
  });

  it('gets the file when the last reply was lost', async () => {
    mock.failNext = [];
    let chunks = 0;
    const rn = (require('react-native-blob-util') as any).default;
    const fetchChunk = rn.fetch;
    rn.fetch = (...args: any[]) => {
      if (args[0] === 'PATCH' && ++chunks === 3) mock.failNext = ['lose-reply'];
      return fetchChunk(...args);
    };
    const done = await resumableUpload(ticket, file, {}, instantly);
    rn.fetch = fetchChunk;
    expect(done).toEqual({id: 'file-1'});
    expect(mock.sent).toEqual([0, CHUNK_BYTES, 2 * CHUNK_BYTES]); // the last chunk wasn't repeated
  });

  it('asks for a new ticket when the old one expires mid-upload', async () => {
    mock.expireTicket = true;
    const done = await resumableUpload(ticket, file, {}, instantly);
    expect(done).toEqual({id: 'file-1'});
    expect(mock.tickets).toBeGreaterThanOrEqual(2);
  });

  it('reports progress up to the whole file', async () => {
    const seen: number[] = [];
    await resumableUpload(
      ticket,
      file,
      {onProgress: f => seen.push(f)},
      instantly,
    );
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBeCloseTo(1, 5);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it('stops when cancelled', async () => {
    let cancel = () => {};
    await expect(
      resumableUpload(
        ticket,
        file,
        {
          onTask: c => (cancel = c),
          onSession: () => cancel(), // the person cancels right after it starts
        },
        instantly,
      ),
    ).rejects.toMatchObject({status: -1});
    expect(mock.sent).toEqual([]);
  });

  it('gives up with the reason when the server refuses the file', async () => {
    mock.failNext = [403, 403];
    await expect(
      resumableUpload(ticket, file, {}, instantly),
    ).rejects.toMatchObject({status: 403});
  });
});
