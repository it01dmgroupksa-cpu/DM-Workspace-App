import {Linking, Platform, Share} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import {relay} from './api';
import {nativeCalls} from './nativeCalls';
import type {Message} from './types';

// "Forward to WhatsApp": for customers who aren't on Messenger (an invoice, a quote). The
// message's text and file go to WhatsApp, where the salesperson picks the customer.
// Every forward is recorded first (monitor: "Forwards & downloads"); one that can't be
// recorded doesn't happen.

export const canForwardToWhatsApp = (m: Message) =>
  !m.pending &&
  !m.failed &&
  !m.deleted &&
  m.kind !== 'system' &&
  !!(m.body?.trim() || m.file?.url);

const SHARE_DIR = `${RNBlobUtil.fs.dirs.CacheDir}/share`;
const safeName = (name: string) =>
  (name || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 120);

async function openWhatsAppText(text: string) {
  const app = `whatsapp://send?text=${encodeURIComponent(text)}`;
  try {
    await Linking.openURL(app);
  } catch {
    // No WhatsApp app: wa.me opens it if it is there after all, or WhatsApp's website.
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }
}

// Throws an Error with a message for the person when it can't go ahead.
export async function forwardToWhatsApp(m: Message) {
  const text = m.body?.trim() || '';
  const file = m.file?.url ? m.file : null;
  if (file && Platform.OS === 'android' && !nativeCalls.canShareToWhatsApp)
    throw new Error(
      'To forward files to WhatsApp, install the latest DM Workspace app. Text can be forwarded already.',
    );
  await relay('messages.shared', {
    messageId: m.id,
    target: 'whatsapp',
    client: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (!file) {
    if (Platform.OS === 'android' && nativeCalls.canShareToWhatsApp) {
      if ((await nativeCalls.shareToWhatsApp(null, null, text)) > 0) return;
      throw new Error('WhatsApp is not installed on this phone.');
    }
    return openWhatsAppText(text);
  }
  // The file is fetched to the app's own cache (not the Downloads folder) and handed over.
  // Only the latest one is kept.
  await RNBlobUtil.fs.unlink(SHARE_DIR).catch(() => {});
  await RNBlobUtil.fs.mkdir(SHARE_DIR).catch(() => {});
  const path = `${SHARE_DIR}/${safeName(file.name)}`;
  let response;
  try {
    response = await RNBlobUtil.config({path}).fetch('GET', file.url!);
  } catch {
    throw new Error("Couldn't get the file. Check your connection and try again.");
  }
  const status = response.info().status;
  if (status < 200 || status >= 300)
    throw new Error(
      status === 401
        ? 'This link has expired. Go back and open the chat again.'
        : "Couldn't get the file. Try again.",
    );
  if (Platform.OS === 'android') {
    const offered = await nativeCalls.shareToWhatsApp(
      path,
      file.mime || null,
      text || null,
    );
    if (!offered) throw new Error('WhatsApp is not installed on this phone.');
    return;
  }
  // iPhone: the share sheet, where WhatsApp is one of the choices.
  await Share.share({url: `file://${path}`, message: text || undefined});
}
