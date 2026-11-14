import {nativeCalls} from './nativeCalls';

// JavaScript errors go to Crashlytics too (Telemetry.kt), next to native crashes and the
// call-event trail, so a problem on someone's phone shows up in the Firebase console.
// The previous handler still runs: a fatal error still shows React Native's own screen.
type Handler = (error: any, isFatal?: boolean) => void;
const ErrorUtils = (global as any).ErrorUtils as
  | {getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void}
  | undefined;

let installed = false;
export function installErrorReporting() {
  if (installed || !ErrorUtils) return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      nativeCalls.reportError(
        String(error?.message ?? error),
        String(error?.stack ?? ''),
        !!isFatal,
      );
    } catch {
      /* reporting must never make it worse */
    }
    previous?.(error, isFatal);
  });
}

// A step worth seeing when a call goes wrong ("ring ack sent", "answered").
export const reportEvent = (message: string) => nativeCalls.reportEvent(message);

// Whose phone a report is from (the employee's user id), or null after signing out.
export const setReportUser = (id: string | null) => nativeCalls.setUser(id);
