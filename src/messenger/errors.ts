// The status lets the outgoing queue tell "offline, retry" from "refused".
export function withStatus(
  message: string,
  status: number,
  extra: object = {},
) {
  return Object.assign(new Error(message), {status}, extra) as Error & {
    status: number;
    offset?: number;
  };
}
