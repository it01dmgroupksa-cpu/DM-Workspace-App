export type Person = {
  user: string;
  employee?: string;
  name: string;
  department?: string;
  designation?: string;
  image?: string;
  lastSeenAt?: string | null;
};
export type FileInfo = {
  id?: string;
  name: string;
  mime?: string;
  size: number;
  width?: number;
  height?: number;
  url?: string;
};
export type Message = {
  id: string;
  conversationId: string;
  sender: string;
  clientId?: string;
  kind: 'text' | 'image' | 'file' | 'voice' | 'system';
  body: string;
  forwarded?: boolean;
  byAssistant?: boolean;
  createdAt: string;
  cursor?: string;
  editedAt?: string | null;
  deleted?: boolean;
  file?: FileInfo | null;
  reply?: {
    id: string;
    sender: string;
    body?: string;
    file?: string;
    deleted?: boolean;
  } | null;
  reactions: {user: string; emoji: string}[];
  // Employees named with @, and whether it was "@all" (group admins only).
  mentions?: string[];
  mentionAll?: boolean;
  translation?: {lang: 'ar' | 'en'; body: string} | null;
  // Only on this phone, until the panel confirms.
  pending?: boolean;
  failed?: boolean;
  error?: string; // why the server refused it
  upload?: {
    uri: string;
    name: string;
    mime: string;
    size: number;
    voice: boolean;
  };
};
export type Conversation = {
  id: string;
  kind: 'direct' | 'group';
  title: string;
  description?: string;
  peer?: string | null;
  role: 'admin' | 'member';
  left?: boolean;
  onlyAdminsSend?: boolean;
  // A group's picture: a signed link to one of the chat's own images.
  image?: string | null;
  pinned: boolean;
  archived: boolean;
  mutedUntil?: string | null;
  unread: number;
  // Someone @mentioned me in what I haven't read yet.
  mentioned?: boolean;
  memberCount: number;
  othersReadAt?: string | null;
  othersDeliveredAt?: string | null;
  createdAt: string;
  last?: {
    id: string;
    sender: string;
    kind: string;
    body?: string;
    file?: string;
    deleted?: boolean;
    at: string;
  } | null;
};
export type Call = {
  id: string;
  conversationId: string;
  conversationKind: 'direct' | 'group';
  video: boolean;
  startedBy: string;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endReason: 'completed' | 'missed' | 'declined' | null;
  members: {
    user: string;
    state: 'ringing' | 'joined' | 'declined' | 'left' | 'missed';
  }[];
};
export type Limits = {
  body: number;
  fileBytes: number;
  editMinutes: number;
  deleteForAllHours: number;
  translation: boolean;
  callsEnabled: boolean;
};
