import {currentSession, erpCall} from './session';
import {withStatus} from './errors';
import type {Lang} from '../twoFactor';

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
  // A shortlist the coordinator prepared: the CEO approves one of them.
  options?: TravelOption[] | null;
  chosen?: number | null; // 0-based index into options, once approved
  approvedBy?: string | null;
  approvedOn?: string | null;
};
export type TravelOption = {
  summary?: string | null;
  total?: number | null;
  currency?: string | null;
  source?: string | null;
  priceVerified?: boolean;
  offer?: {
    airline?: {name?: string};
    slices?: {
      origin?: string;
      destination?: string;
      departAt?: string;
      arriveAt?: string;
      stops?: number;
      segments?: {flight?: string}[];
    }[];
  } | null;
};
export const PENDING = 'Pending Approval by CEO';

const T = {
  en: {
    title: 'Air ticket for approval',
    waiting: 'Waiting for the CEO',
    approvedState: 'Approved',
    rejectedState: 'Rejected',
    traveller: 'Traveller',
    purpose: 'Purpose',
    passengers: 'Passengers',
    route: 'Route',
    flight: 'Flight',
    price: 'Price',
    allowance: 'Allowance',
    reason: 'Reason',
    approvedBy: 'Approved by',
    allotted: 'allotted',
    provisioned: 'provisioned',
    direct: 'direct',
    stops: (n: number) => `${n} stop${n > 1 ? 's' : ''}`,
    checkedAt: (at: string) => `checked ${at}`,
    checked: 'price checked',
    manual: 'entered by the coordinator',
    unchecked: 'not checked by the panel',
    option: (n: number) => `Option ${n}`,
    approveThis: 'Approve this',
    chosen: 'Approved',
    notChosen: 'Not chosen',
    confirmTitle: (n: number) => `Approve option ${n}?`,
    confirmBody: (name: string, airline: string, price: string) =>
      `${name}\n${[airline, price].filter(Boolean).join(' · ')}\nERP records the approval under your name.`,
    approve: 'Approve',
    reject: 'Reject',
    cancel: 'Cancel',
    reasonPlaceholder: 'Reason (optional)',
    notDone: 'Not done',
    tryAgain: 'Try again.',
    confirmOne: 'Approve this air ticket?',
    confirmOneBody: (name: string) => `${name}\nERP records the approval under your name.`,
  },
  ar: {
    title: 'تذكرة طيران للموافقة',
    waiting: 'بانتظار الرئيس التنفيذي',
    approvedState: 'تمت الموافقة',
    rejectedState: 'مرفوضة',
    traveller: 'المسافر',
    purpose: 'الغرض',
    passengers: 'الركاب',
    route: 'المسار',
    flight: 'الرحلة',
    price: 'السعر',
    allowance: 'البدل',
    reason: 'السبب',
    approvedBy: 'وافق عليها',
    allotted: 'مخصّص',
    provisioned: 'محجوز',
    direct: 'مباشرة',
    stops: (n: number) => (n === 1 ? 'توقف واحد' : n === 2 ? 'توقفان' : `${n} توقفات`),
    checkedAt: (at: string) => `تم التحقق ${at}`,
    checked: 'تم التحقق من السعر',
    manual: 'أدخله المنسّق',
    unchecked: 'لم تتحقق منه اللوحة',
    option: (n: number) => `الخيار ${n}`,
    approveThis: 'الموافقة على هذا',
    chosen: 'تمت الموافقة',
    notChosen: 'لم يُختر',
    confirmTitle: (n: number) => `الموافقة على الخيار ${n}؟`,
    confirmBody: (name: string, airline: string, price: string) =>
      `${name}\n${[airline, price].filter(Boolean).join(' · ')}\nيسجّل ERP الموافقة باسمك.`,
    approve: 'موافقة',
    reject: 'رفض',
    cancel: 'إلغاء',
    reasonPlaceholder: 'السبب (اختياري)',
    notDone: 'لم يتم',
    tryAgain: 'حاول مرة أخرى.',
    confirmOne: 'الموافقة على تذكرة الطيران؟',
    confirmOneBody: (name: string) => `${name}\nيسجّل ERP الموافقة باسمك.`,
  },
};
export const travelText = (lang: Lang = 'en') => T[lang];

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

// The approver picks one option of a shortlist: ERP's durar_air_ticket_decide approves the
// request with that option (1-based), as the approver's own ERP session.
export function decideTravelOption(name: string, index: number) {
  return call('durar_air_ticket_decide', {name, option: index + 1});
}

export function travelActions(approval: Pick<TravelApproval, 'state'>, isApprover: boolean): ('Approve' | 'Reject')[] {
  return isApprover && approval.state === PENDING ? ['Approve', 'Reject'] : [];
}

export const travelOptions = (a: Pick<TravelApproval, 'options'>) =>
  Array.isArray(a.options) ? a.options.filter(o => o && typeof o === 'object') : [];
export const chosenOption = (a: Pick<TravelApproval, 'chosen'>) =>
  typeof a.chosen === 'number' && a.chosen >= 0 ? a.chosen : null;
// "Approve this" buttons: the approver, while it waits for him, and nothing chosen yet.
export const canChooseOption = (a: TravelApproval, isApprover: boolean) =>
  isApprover && a.state === PENDING && chosenOption(a) == null && travelOptions(a).length > 0;

const clock = (iso?: string) => (iso ? iso.slice(11, 16) : '');
const day = (iso?: string) => (iso ? iso.slice(0, 10) : '');
const money = (total?: number | null, currency?: string | null) =>
  total == null ? '' : `${total} ${currency || ''}`.trim();

// One shortlist option, as shown on the card.
export function optionView(o: TravelOption, lang: Lang = 'en') {
  const t = T[lang];
  const legs = (o.offer?.slices || []).map(s => {
    const flights = (s.segments || []).map(g => g.flight).filter(Boolean).join(', ');
    const stops = s.stops ? t.stops(s.stops) : t.direct;
    return [
      `${s.origin || '?'} → ${s.destination || '?'}`,
      `${day(s.departAt)} ${clock(s.departAt)} → ${clock(s.arriveAt)}`.trim(),
      stops,
      flights,
    ]
      .filter(Boolean)
      .join(' · ');
  });
  const how = o.priceVerified ? t.checked : o.source === 'Manual' ? t.manual : t.unchecked;
  const amount = money(o.total, o.currency);
  return {
    airline: o.offer?.airline?.name || '',
    legs: legs.length ? legs : o.summary ? [o.summary] : [],
    amount,
    price: amount ? `${amount} · ${how}` : '',
  };
}

export function travelLines(a: TravelApproval, lang: Lang = 'en'): [string, string][] {
  const t = T[lang];
  const lines: [string, string][] = [];
  // With a shortlist the flights and prices are in the options instead.
  const shortlist = travelOptions(a).length > 0;
  lines.push([t.traveller, [a.employeeName || a.employee, a.department].filter(Boolean).join(' · ')]);
  if (a.purpose) lines.push([t.purpose, a.purpose]);
  if (a.passengers?.length) lines.push([t.passengers, a.passengers.join(', ')]);
  if (a.itinerary?.length)
    lines.push([t.route, a.itinerary.map(i => `${i.from} → ${i.to} ${i.departure || ''}`.trim()).join('\n')]);
  const slices = a.offer?.slices || [];
  if (shortlist) {
    /* shown per option */
  } else if (slices.length) {
    const text = slices
      .map(s => {
        const segs = s.segments || [];
        const stops = s.stops ? t.stops(s.stops) : t.direct;
        return `${[a.offer?.airline?.name, segs.map(g => g.flight).join(', ')].filter(Boolean).join(' ')} · ${clock(segs[0]?.departAt)} → ${clock(segs[segs.length - 1]?.arriveAt)} · ${stops}`;
      })
      .join('\n');
    lines.push([t.flight, text]);
  } else if (a.summary) lines.push([t.flight, a.summary]);
  if (a.total != null && !shortlist) {
    const how = a.priceVerified && a.priceCheckedAt
      ? t.checkedAt(a.priceCheckedAt.slice(0, 16))
      : a.source === 'Manual'
      ? t.manual
      : t.unchecked;
    lines.push([t.price, `${a.total} ${a.currency || ''} · ${how}`.replace(/ {2,}/g, ' ')]);
  }
  if (a.allowance && (a.allowance.allotted != null || a.allowance.provisioned != null))
    lines.push([
      t.allowance,
      [a.allowance.allotted != null && `${a.allowance.allotted} ${a.currency || ''} ${t.allotted}`.replace(/ {2,}/g, ' ').trim(), a.allowance.provisioned != null && `${a.allowance.provisioned} ${t.provisioned}`]
        .filter(Boolean)
        .join(' · '),
    ]);
  if (a.reason) lines.push([t.reason, a.reason]);
  if (a.approvedBy && chosenOption(a) != null)
    lines.push([t.approvedBy, [a.approvedBy, a.approvedOn?.slice(0, 16)].filter(Boolean).join(' · ')]);
  return lines;
}
