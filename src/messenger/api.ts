import RNBlobUtil from 'react-native-blob-util';
import {RELAY_URL} from './config';

// One call to the durar_messenger Server Script. The ERP session cookie from the app's
// login is sent automatically; the script proves who the employee is.
export async function relay<T = any>(
  operation: string,
  data: Record<string, unknown> = {},
): Promise<T> {
  let response: Response;
  let body: any = {};
  try {
    response = await fetch(RELAY_URL, {
      method: 'POST',
      credentials: 'include',
      headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify({operation, data: JSON.stringify(data)}),
    });
    body = await response.json().catch(() => ({}));
  } catch {
    throw new Error('No connection. Check your network.');
  }
  if (!response.ok || body.exc || body.exc_type)
    throw new Error(errorText(body, response.status));
  return body.message as T;
}

export function errorText(body: any, status: number) {
  let detail = '';
  try {
    detail =
      JSON.parse(JSON.parse(body._server_messages || '[]')[0] || '{}')
        .message || '';
  } catch {
    /* no readable message */
  }
  if (!detail && status === 403)
    detail = 'Your ERP session ended. Sign in again.';
  return String(detail || body.exception || 'Messenger request failed')
    .replace(/<[^>]+>/g, '')
    .slice(0, 300);
}

// Files go straight to the panel with a one-chat upload ticket; the body is the raw file.
export async function uploadFile(
  conversationId: string,
  file: {uri: string; name: string; mime: string},
) {
  const ticket = await relay<{url: string; maxBytes: number}>('files.ticket', {
    conversationId,
  });
  const path = decodeURIComponent(file.uri.replace(/^file:\/\//, ''));
  let response;
  try {
    response = await RNBlobUtil.fetch(
      'POST',
      ticket.url,
      {
        'Content-Type': file.mime || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name || 'file'),
      },
      RNBlobUtil.wrap(path),
    );
  } catch {
    throw new Error('Upload failed. Check your network.');
  }
  let json: any = {};
  try {
    json = response.json();
  } catch {
    /* not JSON */
  }
  if (response.info().status >= 400)
    throw new Error(json?.error || 'Upload failed.');
  return json.file as {id: string};
}
