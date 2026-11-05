import type {Conversation, Message, Person} from './types';
import {ASSISTANT} from './config';

export const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60));
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm.padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
};
export const time = (at: string) =>
  new Date(at).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
export function dayLabel(at: string) {
  const d = new Date(at);
  const today = new Date();
  const days = Math.round(
    (+new Date(today.toDateString()) - +new Date(d.toDateString())) /
      86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], {weekday: 'long'});
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export const listTime = (at: string) =>
  new Date().toDateString() === new Date(at).toDateString()
    ? time(at)
    : dayLabel(at);
export const fileSize = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1048576).toFixed(1)} MB`;
export const initials = (name: string) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
export const hue = (s: string) =>
  [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function personOf(people: Map<string, Person>, user: string): Person {
  if (user === ASSISTANT)
    return {user, name: 'Durar Assistant', designation: 'CEO assistant'};
  return people.get(user) || {user, name: user.split('@')[0]};
}
export const convTitle = (c: Conversation, people: Map<string, Person>) =>
  c.kind === 'group'
    ? c.title
    : c.peer
    ? personOf(people, c.peer).name
    : 'You (notes)';
export const muted = (c: Conversation) =>
  !!c.mutedUntil && new Date(c.mutedUntil) > new Date();
export const online = (p?: Person) =>
  !!p?.lastSeenAt && Date.now() - new Date(p.lastSeenAt).getTime() < 70_000;
export function lastSeen(p: Person) {
  if (online(p)) return 'online';
  if (!p.lastSeenAt) return p.designation || p.department || '';
  return `last seen ${dayLabel(p.lastSeenAt)} ${time(p.lastSeenAt)}`;
}

export function callEntry(m: Message) {
  try {
    const e = JSON.parse(m.body);
    return e.event === 'call'
      ? (e as {video: boolean; reason: string; seconds: number})
      : null;
  } catch {
    return null;
  }
}
export function systemText(
  m: Pick<Message, 'body' | 'sender'>,
  me: string,
  people: Map<string, Person>,
) {
  let e: any = {};
  try {
    e = JSON.parse(m.body);
  } catch {
    /* unknown event */
  }
  const name = (u: string) => (u === me ? 'You' : personOf(people, u).name);
  const who = name(m.sender);
  const users = (e.users || []).map(name).join(', ');
  switch (e.event) {
    case 'created':
      return `${who} created the group "${e.title}"`;
    case 'renamed':
      return `${who} renamed the group to "${e.title}"`;
    case 'added':
      return `${who} added ${users}`;
    case 'removed':
      return `${who} removed ${users}`;
    case 'left':
      return `${who} left`;
    case 'call': {
      const kind = e.video ? 'Video call' : 'Voice call';
      if (e.reason === 'completed') return `${kind} · ${clock(e.seconds)}`;
      if (m.sender === me)
        return `${kind} · ${
          e.reason === 'declined' ? 'Declined' : 'No answer'
        }`;
      return `Missed ${e.video ? 'video' : 'voice'} call from ${who}`;
    }
    default:
      return '';
  }
}
const plain = (text?: string) =>
  String(text || '')
    .replace(/(^|[\s(])([*_~])([^*_~\n]+)\2(?=$|[\s).,!?])/g, '$1$3')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\s+/g, ' ');
export function preview(
  c: Conversation,
  me: string,
  people: Map<string, Person>,
) {
  const l = c.last;
  if (!l) return c.kind === 'group' ? 'Group created' : '';
  if (l.kind === 'system')
    return systemText({body: l.body || '', sender: l.sender}, me, people);
  if (l.deleted) return 'This message was deleted';
  const label =
    l.kind === 'image'
      ? '📷 Photo'
      : l.kind === 'voice'
      ? '🎤 Voice message'
      : l.kind === 'file'
      ? `📄 ${l.file || 'File'}`
      : plain(l.body);
  const who =
    c.kind === 'group' && l.sender !== me
      ? `${personOf(people, l.sender).name.split(' ')[0]}: `
      : '';
  return who + label;
}
// One tick sent, two delivered, blue read.
export function ticks(
  m: Message,
  c?: Conversation,
): 'pending' | 'failed' | 'sent' | 'delivered' | 'read' | null {
  if (m.kind === 'system' || m.deleted) return null;
  if (m.failed) return 'failed';
  if (m.pending) return 'pending';
  const at = new Date(m.createdAt);
  if (c?.othersReadAt && new Date(c.othersReadAt) >= at) return 'read';
  if (c?.othersDeliveredAt && new Date(c.othersDeliveredAt) >= at)
    return 'delivered';
  return 'sent';
}
// A message's permanent id from this phone: time, a counter (unique even within one
// millisecond) and randomness (unique across phones).
let counter = 0;
export const uid = () => {
  counter = (counter + 1) % 1_679_616;
  return `${Date.now().toString(36)}${counter
    .toString(36)
    .padStart(4, '0')}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 32);
};
