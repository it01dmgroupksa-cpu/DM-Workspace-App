import {currentSession, erpCall} from './session';
import {withStatus} from './errors';

// Air ticket approval cards. The card is a snapshot the panel keeps up to date from ERP;
// the CEO's buttons run ERP's own Travel Request workflow (Approve / Reject) with Messenger's
// ERP session, so ERP checks the CEO's permission and records the decision in its history.
export type TravelApproval = {
  doctype: 'Travel Request';
  name: string;
  state: string;
  employeeName?: string | null;
  employee?: string | null;
  department?: string | null;
  purpose?: string | null;
  passengers: string[];
  itinerary: {from?: string | null; to?: string | null; departure?: string | null}[];
  offer?: {
    airline?: {name?: string};
    slices?: {stops?: number; segments?: {flight?: string; departAt?: string; arriveAt?: string}[]}[];
  } | null;
  summary?: string | null;
  total?: number | null;
  currency?: string | null;
  priceCheckedAt?: string | null;
  priceVerified?: boolean;
  source?: string | null;
  reason?: string | null;
  allowance?: {allotted?: number | null; provisioned?: number | null} | null;
};
export const PENDING = 'Pending Approval by CEO';

async function call<T = any>(method: string, body: Record<string, unknown>) {
  const sid = currentSession()?.sid;
  if (!sid) throw new Error('Sign in to Messenger.');
  try {
    return (await erpCall<T>(method, body, sid)).message;
  } catch (error: any) {
    throw withStatus(error.message, error.status ?? 0);
  }
}

export async function decideTravel(name: string, action: 'Approve' | 'Reject', reason = '') {
  const why = reason.trim().slice(0, 1000);
  if (action === 'Reject' && why)
    await call('frappe.client.set_value', {doctype: 'Travel Request', name, fieldname: 'custom_rejection_reason', value: why});
  // The current document, so ERP's "changed since you opened it" check passes.
  const doc = await call('frappe.client.get', {doctype: 'Travel Request', name});
  return call('frappe.model.workflow.apply_workflow', {doc: JSON.stringify(doc), action});
}

export function travelActions(approval: Pick<TravelApproval, 'state'>, isApprover: boolean): ('Approve' | 'Reject')[] {
  return isApprover && approval.state === PENDING ? ['Approve', 'Reject'] : [];
}

const clock = (iso?: string) => (iso ? iso.slice(11, 16) : '');
export function travelLines(a: TravelApproval): [string, string][] {
  const lines: [string, string][] = [];
  lines.push(['Traveller', [a.employeeName || a.employee, a.department].filter(Boolean).join(' · ')]);
  if (a.purpose) lines.push(['Purpose', a.purpose]);
  if (a.passengers?.length) lines.push(['Passengers', a.passengers.join(', ')]);
  if (a.itinerary?.length)
    lines.push(['Route', a.itinerary.map(i => `${i.from} → ${i.to} ${i.departure || ''}`.trim()).join('\n')]);
  const slices = a.offer?.slices || [];
  if (slices.length) {
    const text = slices
      .map(s => {
        const segs = s.segments || [];
        const stops = s.stops ? `${s.stops} stop${s.stops > 1 ? 's' : ''}` : 'direct';
        return `${[a.offer?.airline?.name, segs.map(g => g.flight).join(', ')].filter(Boolean).join(' ')} · ${clock(segs[0]?.departAt)} → ${clock(segs[segs.length - 1]?.arriveAt)} · ${stops}`;
      })
      .join('\n');
    lines.push(['Flight', text]);
  } else if (a.summary) lines.push(['Flight', a.summary]);
  if (a.total != null) {
    const how = a.priceVerified && a.priceCheckedAt
      ? `checked ${a.priceCheckedAt.slice(0, 16)}`
      : a.source === 'Manual'
      ? 'entered by the coordinator'
      : 'not checked by the panel';
    lines.push(['Price', `${a.total} ${a.currency || ''} · ${how}`.replace(/ {2,}/g, ' ')]);
  }
  if (a.allowance && (a.allowance.allotted != null || a.allowance.provisioned != null))
    lines.push([
      'Allowance',
      [a.allowance.allotted != null && `${a.allowance.allotted} ${a.currency || ''} allotted`.trim(), a.allowance.provisioned != null && `${a.allowance.provisioned} provisioned`]
        .filter(Boolean)
        .join(' · '),
    ]);
  if (a.reason) lines.push(['Reason', a.reason]);
  return lines;
}
