import RNBlobUtil from 'react-native-blob-util';
import {currentSession, erpCall, sessionEnded} from './session';

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
// The status lets the outgoing queue tell "offline, retry" from "refused".
export function withStatus(message: string, status: number) {
  const error: Error & {status?: number} = new Error(message);
  error.status = status;
  return error;
}

// Files go straight to the panel with a one-chat upload ticket; the body is the raw file.
// `onProgress` gets 0–1; `onTask` gets a cancel function for the upload in flight.
export async function uploadFile(
  conversationId: string,
  file: {uri: string; name: string; mime: string},
  onProgress?: (fraction: number) => void,
  onTask?: (cancel: () => void) => void,
) {
  const ticket = await relay<{url: string; maxBytes: number}>('files.ticket', {
    conversationId,
  });
  const path = decodeURIComponent(file.uri.replace(/^file:\/\//, ''));
  let response;
  try {
    const task = RNBlobUtil.fetch(
      'POST',
      ticket.url,
      {
        'Content-Type': file.mime || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'file'),
      },
      RNBlobUtil.wrap(path),
    );
    onTask?.(() => task.cancel());
    if (onProgress)
      task.uploadProgress({interval: 250}, (sent, total) =>
        onProgress(Number(total) > 0 ? Number(sent) / Number(total) : 0),
      );
    response = await task;
  } catch (error: any) {
    if (/cancel/i.test(String(error?.message)))
      throw withStatus('Upload cancelled.', -1);
    throw withStatus('Upload failed. Check your network.', 0);
  }
  let json: any = {};
  try {
    json = response.json();
  } catch {
    /* not JSON */
  }
  const status = response.info().status;
  if (status >= 400) throw withStatus(json?.error || 'Upload failed.', status);
  return json.file as {id: string};
}
