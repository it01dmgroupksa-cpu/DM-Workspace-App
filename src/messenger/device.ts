// This phone's push tokens (Expo's, an Android phone's own Firebase one for calls, and an
// iPhone's VoIP one). Sent with Answer, Decline and Hang up, so when the server tells the
// person's other phones to stop ringing it skips this one: an iPhone told to stop would
// end the very call it just answered.
type Kind = 'expo' | 'fcm' | 'voip';
const tokens: Partial<Record<Kind, string>> = {};

export const thisDevice = {
  set(kind: Kind, token: string | null | undefined) {
    if (token) tokens[kind] = token;
    else delete tokens[kind];
  },
  has(kind: Kind): boolean {
    return !!tokens[kind];
  },
  tokens(): string[] {
    return [tokens.expo, tokens.fcm, tokens.voip].filter(
      (t): t is string => !!t,
    );
  },
};
