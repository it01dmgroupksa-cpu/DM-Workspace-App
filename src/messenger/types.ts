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
  // Posted by the CEO agent: its chat, and the answer's run or the approval card's request.
  agent?: {chatId: string; runId?: string; requestId?: string} | null;
  // An approval card (an air ticket Travel Request): the snapshot the panel keeps current.
  approval?: {doctype: string; name: string; state: string; [key: string]: unknown} | null;
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
  // The panel's one call lifecycle (lib/messenger/calls.ts). Absent from an older panel.
  status?: 'ringing' | 'active' | 'declined' | 'missed' | 'completed';
  members: {
    user: string;
    state: 'ringing' | 'joined' | 'declined' | 'left' | 'missed';
    // When one of their devices confirmed it is ringing (calls.ringing / the push's
    // ackUrl). Absent from a panel that doesn't track it yet.
    ringingAt?: string | null;
    // Rung again in a group call: the id that ring went out under (Android rings each
    // id once). Answering with it joins this call.
    ringId?: string | null;
  }[];
};
export type Limits = {
  body: number;
  fileBytes: number;
  editMinutes: number;
  deleteForAllHours: number;
  translation: boolean;
  callsEnabled: boolean;
  // This person approves air tickets (gets the card's buttons).
  travelApprover?: boolean;
};

// An approval card the CEO agent prepared: the panel's write-request view
// (apps/ceopanel/lib/ai/write-requests.ts, RequestView), read through messenger.cards.
export type AgentCard = {
  id: string;
  tool: string;
  channel?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'restricted';
  execution: 'waiting' | 'ready' | 'executed' | 'failed' | 'unsupported';
  preview?: {
    title: string;
    reason?: string;
    company?: string;
    target?: {doctype: string; name: string};
    currentChecked?: boolean;
    changes?: {field: string; old?: string; new: string}[];
    details?: {label: string; value: string}[];
  };
  error?: string;
  result?: {name: string; modified: string; detail?: string};
  coordination?: {status: string; report: string | null; updatedAt: string};
};
