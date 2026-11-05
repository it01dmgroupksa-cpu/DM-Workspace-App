import * as Notifications from 'expo-notifications';

// Call notifications go stale once the call is answered, declined or over, on this
// phone or another device; clear them so the shade never offers a dead call. With
// `callId`, only that call's; otherwise every call not in `live`.
export async function dismissCallNotifications(
  callId?: string,
  live?: Set<string>,
) {
  try {
    for (const n of await Notifications.getPresentedNotificationsAsync()) {
      const data: any = n.request.content.data || {};
      if (data.type !== 'call') continue;
      if (callId ? data.callId === callId : !live?.has(data.callId))
        await Notifications.dismissNotificationAsync(n.request.identifier);
    }
  } catch {
    /* best effort */
  }
}
