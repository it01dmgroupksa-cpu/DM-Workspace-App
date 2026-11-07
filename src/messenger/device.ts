// This phone's push tokens (Expo's, and an iPhone's VoIP one). Sent with Answer, Decline
// and Hang up, so when the server tells the person's other phones to stop ringing it skips
// this one: an iPhone told to stop would end the very call it just answered.
const tokens: {expo?: string; voip?: string} = {};

export const thisDevice = {
  set(kind: 'expo' | 'voip', token: string | null | undefined) {
    if (token) tokens[kind] = token;
    else delete tokens[kind];
  },
  tokens(): string[] {
    return [tokens.expo, tokens.voip].filter((t): t is string => !!t);
  },
};
