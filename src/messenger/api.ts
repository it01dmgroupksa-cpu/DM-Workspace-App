import RNBlobUtil from 'react-native-blob-util';
import {currentSession, erpCall, sessionEnded} from './session';
import {withStatus} from './errors';
import {
  abandonUpload,
  resumableUpload,
  SINGLE_REQUEST_BYTES,
  singleUpload,
} from './upload';

// One call to the durar_messenger Server Script, as Messenger's own ERP session
// (session.tsx). The script proves who the employee is.
export async function relay<T = any>(
  operation: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  const session = currentSession();
  if (!session) throw new Error('Sign in to Messenger.');
  try {
    const {message} = await erpCall<T>(
      'durar_messenger',
      {operation, data: JSON.stringify(data)},
      session.sid,
    );
    return message;
  } catch (error: any) {
    // ERP refused the session itself: signed out, password changed, no longer an
    // active employee. A script older than this app ("not available") is not that.
    if (
      (error.status === 401 || error.status === 403) &&
      !/operation is not available/i.test(error.message) &&
      currentSession() === session
    )
      sessionEnded(error.message);
    throw withStatus(error.message, error.status);
  }
}
export {withStatus};

// Files go to the panel with a one-chat upload ticket. Small files go in one request;
// bigger ones in resumable chunks, so a dropped connection costs only the last chunk
// (see upload.ts). `onProgress` gets 0-1, `onTask` a function that cancels the upload,
// and `uploadId` / `onSession` carry a half-done upload across an app restart.
export async function uploadFile(
  conversationId: string,
  file: {uri: string; name: string; mime: string; size?: number},
  onProgress?: (fraction: number) => void,
  onTask?: (cancel: () => void) => void,
  resume?: {uploadId?: string; onSession?: (id: string) => void},
) {
  const ticketUrl = async () =>
    (
      await relay<{url: string; maxBytes: number}>('files.ticket', {
        conversationId,
      })
    ).url;
  const hooks = {onProgress, onTask, ...resume};
  const size =
    Number(
      (
        await RNBlobUtil.fs
          .stat(plainPath(file.uri))
          .catch(() => ({size: file.size || 0}))
      ).size,
    ) || 0;
  if (size && size <= SINGLE_REQUEST_BYTES && !resume?.uploadId)
    return singleUpload(await ticketUrl(), file, hooks);
  return resumableUpload(ticketUrl, file, hooks);
}
// A group's picture: a small image, uploaded like any chat file but on an "avatar"
// ticket, so a member can set it even where only admins may post messages.
export async function uploadGroupImage(
  conversationId: string,
  file: {uri: string; name: string; mime: string},
) {
  const {url} = await relay<{url: string}>('files.ticket', {
    conversationId,
    avatar: true,
  });
  return singleUpload(url, file, {});
}
const plainPath = (uri: string) =>
  decodeURIComponent(uri.replace(/^file:\/\//, ''));
// Cancel a half-done upload so the server frees its space.
export async function cancelRemoteUpload(
  conversationId: string,
  uploadId: string,
) {
  try {
    const {url} = await relay<{url: string}>('files.ticket', {conversationId});
    await abandonUpload(url, uploadId);
  } catch {
    /* the server sweeps it after a day */
  }
}
