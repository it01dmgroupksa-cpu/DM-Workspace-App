import RNBlobUtil from 'react-native-blob-util';
import {withStatus} from './errors';
import {backoff, transient} from './outbox';

// Resumable uploads. A big file goes in 4 MB chunks, each starting where the server
// stopped. After a dropped connection, or even an app restart, the phone asks the server
// how far it got and sends only the rest. The whole file's SHA-256 is checked by the
// server at the end, and each chunk's as it arrives. Small files use one request.
export const CHUNK_BYTES = 4 * 1024 * 1024;
export const SINGLE_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_CHUNK_TRIES = 5;
const MAX_FINISH_POLLS = 120;

export type UploadFile = {uri: string; name: string; mime: string};
export type UploadHooks = {
  uploadId?: string; // resuming an upload begun earlier
  onSession?: (id: string) => void; // keep the id, so a restart resumes
  onProgress?: (fraction: number) => void; // 0–1
  onTask?: (cancel: () => void) => void;
};
type State = {
  offset: number;
  size: number;
  file?: {id: string};
  finishing?: boolean;
};

const plain = (uri: string) =>
  decodeURIComponent(uri.replace(/^file:\/\//, ''));
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

async function json(response: Response) {
  return (await response.json().catch(() => ({}))) as any;
}
function failure(body: any, status: number) {
  return withStatus(
    body?.error || 'Upload failed.',
    status,
    typeof body?.offset === 'number' ? {offset: body.offset} : {},
  );
}

export async function singleUpload(
  url: string,
  file: UploadFile,
  hooks: UploadHooks,
) {
  try {
    const task = RNBlobUtil.fetch(
      'POST',
      url,
      {
        'Content-Type': file.mime || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'file'),
      },
      RNBlobUtil.wrap(plain(file.uri)),
    );
    hooks.onTask?.(() => task.cancel());
    if (hooks.onProgress)
      task.uploadProgress({interval: 250}, (sent, total) =>
        hooks.onProgress!(Number(total) > 0 ? Number(sent) / Number(total) : 0),
      );
    const response = await task;
    const body = (() => {
      try {
        return response.json();
      } catch {
        return {};
      }
    })();
    const status = response.info().status;
    if (status >= 400) throw failure(body, status);
    return body.file as {id: string};
  } catch (error: any) {
    if (error?.status) throw error;
    if (/cancel/i.test(String(error?.message)))
      throw withStatus('Upload cancelled.', -1);
    throw withStatus('Upload failed. Check your network.', 0);
  }
}

export async function resumableUpload(
  getTicketUrl: () => Promise<string>,
  file: UploadFile,
  hooks: UploadHooks = {},
  wait: (ms: number) => Promise<void> = sleep,
) {
  const path = plain(file.uri);
  const size = Number((await RNBlobUtil.fs.stat(path)).size) || 0;
  if (!size) throw withStatus('The file is empty.', 400);
  let ticket = await getTicketUrl();
  let cancelled = false;
  let current: {cancel: () => void} | null = null;
  hooks.onTask?.(() => {
    cancelled = true;
    current?.cancel();
  });
  const at = (id?: string) => (id ? `${ticket}&upload=${id}` : ticket);
  // The ticket lasts minutes; a long upload asks for a fresh one when it expires.
  async function withTicket<T>(run: () => Promise<T>) {
    try {
      return await run();
    } catch (error: any) {
      if (error?.status !== 401 || cancelled) throw error;
      ticket = await getTicketUrl();
      return run();
    }
  }
  async function request(
    method: string,
    id: string | undefined,
    headers: Record<string, string> = {},
  ): Promise<any> {
    let response: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      response = await fetch(at(id), {
        method,
        headers,
        signal: controller.signal,
      });
    } catch {
      throw withStatus('Upload failed. Check your network.', 0);
    } finally {
      clearTimeout(timer);
    }
    const body = await json(response);
    if (!response.ok) throw failure(body, response.status);
    return body;
  }
  const status = (id: string) =>
    withTicket(() => request('GET', id)) as Promise<State>;

  async function create(sha256: string) {
    return withTicket(() =>
      request('POST', undefined, {
        'X-Upload-Length': String(size),
        'X-File-Name': encodeURIComponent(file.name || 'file'),
        'Content-Type': file.mime || 'application/octet-stream',
        'X-Upload-Sha256': sha256,
      }),
    ) as Promise<{id: string}>;
  }

  async function sendChunk(id: string, offset: number): Promise<State> {
    const end = Math.min(offset + CHUNK_BYTES, size);
    const length = end - offset;
    const part = `${RNBlobUtil.fs.dirs.CacheDir}/upload-${id}.part`;
    await RNBlobUtil.fs.unlink(part).catch(() => {});
    try {
      await RNBlobUtil.fs.slice(path, part, offset, end);
      const made = Number((await RNBlobUtil.fs.stat(part)).size);
      if (made !== length) throw withStatus('The file could not be read.', 400);
      const sha = await RNBlobUtil.fs.hash(part, 'sha256');
      return await withTicket(async () => {
        try {
          const task = RNBlobUtil.fetch(
            'PATCH',
            at(id),
            {
              'Content-Type': 'application/octet-stream',
              'X-Upload-Offset': String(offset),
              'X-Chunk-Sha256': sha,
            },
            RNBlobUtil.wrap(part),
          );
          current = task;
          if (hooks.onProgress)
            task.uploadProgress({interval: 250}, (sent, total) =>
              hooks.onProgress!(
                (offset +
                  (Number(total) > 0
                    ? (Number(sent) / Number(total)) * length
                    : 0)) /
                  size,
              ),
            );
          const response = await task;
          const body = (() => {
            try {
              return response.json();
            } catch {
              return {};
            }
          })();
          const code = response.info().status;
          if (code >= 400) throw failure(body, code);
          return body as State;
        } catch (error: any) {
          if (error?.status !== undefined) throw error;
          if (cancelled || /cancel/i.test(String(error?.message)))
            throw withStatus('Upload cancelled.', -1);
          throw withStatus('Upload failed. Check your network.', 0);
        } finally {
          current = null;
        }
      });
    } finally {
      RNBlobUtil.fs.unlink(part).catch(() => {});
    }
  }

  // Where did the earlier attempt stop? A forgotten upload (swept after a day, or
  // finished) starts over.
  let id = hooks.uploadId;
  let state: State | null = null;
  if (id) {
    try {
      state = await status(id);
    } catch (error: any) {
      if (error?.status !== 404) throw error;
      id = undefined;
    }
  }
  async function begin() {
    const created = await create(await RNBlobUtil.fs.hash(path, 'sha256'));
    id = created.id;
    hooks.onSession?.(created.id);
    state = {offset: 0, size};
  }
  if (!id) await begin();
  hooks.onProgress?.(state!.offset / size);
  let tries = 0;
  let polls = 0;
  let restarts = 0;
  for (;;) {
    if (cancelled) throw withStatus('Upload cancelled.', -1);
    if (state!.file) return state!.file;
    if (state!.offset >= size) {
      // Every byte is there; the server is checking and storing the file.
      if (++polls > MAX_FINISH_POLLS)
        throw withStatus('The server is slow to finish. Trying again.', 503);
      await wait(1000);
      state = await status(id!);
      continue;
    }
    try {
      state = await sendChunk(id!, state!.offset);
      tries = 0;
    } catch (error: any) {
      // Out of step (a reply was lost): the server says where it is.
      if (error?.status === 409 && typeof error.offset === 'number') {
        state = {...state!, offset: error.offset};
        continue;
      }
      if (cancelled || error?.status === -1) throw error;
      // The server forgot this upload (finished checking and refused it, or swept it):
      // start over, once.
      if (error?.status === 404 && restarts < 1) {
        restarts++;
        await begin();
        continue;
      }
      // The same chunk once more (also when the server found it damaged); each pause
      // longer than the last.
      if (
        (transient(error) || error?.status === 422) &&
        ++tries < MAX_CHUNK_TRIES
      ) {
        await wait(backoff(tries));
        try {
          state = await status(id!); // maybe it arrived after all
        } catch {
          /* still offline: the next try will say */
        }
        continue;
      }
      throw error;
    }
  }
}

// Cancel an upload begun earlier and free its space on the server (best effort).
export async function abandonUpload(url: string, id: string) {
  try {
    await fetch(`${url}&upload=${id}`, {method: 'DELETE'});
  } catch {
    /* the server sweeps it after a day */
  }
}
