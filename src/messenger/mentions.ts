// @mentions: finding the "@name" being typed, inserting a chosen name, deciding which of
// the chosen people are still named when the message is sent, and finding "@Name" and
// web addresses in a message to show them differently.

// A web address; the last character can't be punctuation that ends a sentence.
const URL_SOURCE = 'https?:\\/\\/[^\\s<>"\']+[^\\s<>"\'.,;:!?)\\]]';
const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type Piece = {text: string; kind: 'text' | 'link' | 'mention'};
// Splits a message into plain text, web addresses and "@Name" of the people mentioned.
// `names` are the names without the "@" (and "all" for @all).
export function pieces(text: string, names: string[]): Piece[] {
  const alternatives = [URL_SOURCE];
  if (names.length)
    alternatives.push(
      `@(?:${[...names]
        .sort((a, b) => b.length - a.length)
        .map(escapeRegex)
        .join('|')})(?![\\p{L}\\p{N}])`,
    );
  const out: Piece[] = [];
  let last = 0;
  for (const match of text.matchAll(
    new RegExp(alternatives.join('|'), 'giu'),
  )) {
    const start = match.index ?? 0;
    if (start > last) out.push({text: text.slice(last, start), kind: 'text'});
    out.push({
      text: match[0],
      kind: /^https?:/i.test(match[0]) ? 'link' : 'mention',
    });
    last = start + match[0].length;
  }
  if (last < text.length) out.push({text: text.slice(last), kind: 'text'});
  return out;
}

// The "@que" being typed at the cursor: an @ that starts a word, then letters, no newline.
export function mentionQuery(text: string, cursor: number) {
  const before = text.slice(0, Math.max(0, Math.min(cursor, text.length)));
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null; // an email address, not a mention
  const query = before.slice(at + 1);
  if (query.length > 30 || /[\n@]/.test(query)) return null;
  return {start: at, query};
}

// Puts "@Name " where "@que" was, and says where the cursor goes.
export function insertMention(
  text: string,
  start: number,
  cursor: number,
  name: string,
) {
  const inserted = `@${name} `;
  return {
    text: text.slice(0, start) + inserted + text.slice(cursor),
    cursor: start + inserted.length,
  };
}

// Of the people picked while typing, only those still named in the final text count
// (the writer may have deleted a name afterwards).
export function stillMentioned(
  text: string,
  chosen: Map<string, string>, // user -> the name as inserted, e.g. "Sara Ali"
) {
  const users: string[] = [];
  let all = false;
  for (const [user, name] of chosen) {
    const found = new RegExp(
      `@${escapeRegex(name)}(?![\\p{L}\\p{N}])`,
      'iu',
    ).test(text);
    if (!found) continue;
    if (user === '@all') all = true;
    else users.push(user);
  }
  return {users, all};
}

// People matching what was typed after the @: names starting with it first, then
// names that contain it.
export function matchPeople<T extends {name: string}>(
  people: T[],
  query: string,
  limit = 6,
) {
  const q = query.trim().toLowerCase();
  const starts: T[] = [];
  const contains: T[] = [];
  for (const p of people) {
    const name = p.name.toLowerCase();
    if (
      !q ||
      name.startsWith(q) ||
      name.split(/\s+/).some(w => w.startsWith(q))
    )
      starts.push(p);
    else if (name.includes(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}
