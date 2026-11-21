import {beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockErpCall = jest.fn<(...args: any[]) => Promise<any>>();
jest.mock('../src/messenger/session', () => ({
  currentSession: () => ({sid: 's1', user: 'ceo@dm.sa'}),
  erpCall: (...args: any[]) => mockErpCall(...args),
}));
import {decideTravel, travelActions, travelLines} from '../src/messenger/travel';

const doc = {doctype: 'Travel Request', name: 'HR-TRQ-1', modified: '2026-11-21 09:30:00', workflow_state: 'Pending Approval by CEO'};

beforeEach(() => mockErpCall.mockReset());

describe('air ticket approval from Messenger', () => {
  it('approve runs ERP workflow on the current document, as the CEO', async () => {
    mockErpCall.mockResolvedValueOnce({message: doc}).mockResolvedValueOnce({message: {...doc, workflow_state: 'Approved'}});
    await decideTravel('HR-TRQ-1', 'Approve');
    expect(mockErpCall.mock.calls[0]).toEqual(['frappe.client.get', {doctype: 'Travel Request', name: 'HR-TRQ-1'}, 's1']);
    expect(mockErpCall.mock.calls[1]).toEqual(['frappe.model.workflow.apply_workflow', {doc: JSON.stringify(doc), action: 'Approve'}, 's1']);
  });

  it('reject saves the reason first, then rejects the saved document', async () => {
    const saved = {...doc, modified: '2026-11-21 09:31:00', custom_rejection_reason: 'Too expensive'};
    mockErpCall.mockResolvedValueOnce({message: saved}).mockResolvedValueOnce({message: saved}).mockResolvedValueOnce({message: {}});
    await decideTravel('HR-TRQ-1', 'Reject', ' Too expensive ');
    expect(mockErpCall.mock.calls[0]).toEqual([
      'frappe.client.set_value',
      {doctype: 'Travel Request', name: 'HR-TRQ-1', fieldname: 'custom_rejection_reason', value: 'Too expensive'},
      's1',
    ]);
    expect(mockErpCall.mock.calls[1][0]).toBe('frappe.client.get');
    expect(mockErpCall.mock.calls[2][1]).toEqual({doc: JSON.stringify(saved), action: 'Reject'});
  });

  it('reject without a reason skips saving one', async () => {
    mockErpCall.mockResolvedValueOnce({message: doc}).mockResolvedValueOnce({message: {}});
    await decideTravel('HR-TRQ-1', 'Reject', '  ');
    expect(mockErpCall.mock.calls.map(c => c[0])).toEqual(['frappe.client.get', 'frappe.model.workflow.apply_workflow']);
  });

  it("ERP's refusal reaches the CEO as ERP worded it", async () => {
    mockErpCall.mockResolvedValueOnce({message: doc}).mockRejectedValueOnce(Object.assign(new Error('Not a valid Workflow Action'), {status: 417}));
    await expect(decideTravel('HR-TRQ-1', 'Approve')).rejects.toThrow('Not a valid Workflow Action');
  });

  it('only the approver gets buttons, and only while it waits for the CEO', () => {
    expect(travelActions({state: 'Pending Approval by CEO'}, true)).toEqual(['Approve', 'Reject']);
    expect(travelActions({state: 'Pending Approval by CEO'}, false)).toEqual([]);
    expect(travelActions({state: 'Approved'}, true)).toEqual([]);
  });

  it('lays out the card', () => {
    const lines = travelLines({
      employeeName: 'Badr Ali', department: 'Sales - DM', purpose: 'Annual Vaccation', passengers: ['BADR ALI', 'SARA BADR'],
      itinerary: [{from: 'RUH', to: 'COK', departure: '2026-12-20'}, {from: 'COK', to: 'RUH', departure: '2027-01-10'}],
      offer: {airline: {name: 'Saudia'}, slices: [{segments: [{flight: 'SV 780', departAt: '2026-12-20T01:10:00', arriveAt: '2026-12-20T09:20:00'}], stops: 0}]},
      total: 1840, currency: 'SAR', priceCheckedAt: '2026-11-21 09:30:00', priceVerified: true, source: 'Duffel',
      allowance: {allotted: 2400, provisioned: 1200},
    } as any);
    expect(lines).toEqual([
      ['Traveller', 'Badr Ali · Sales - DM'],
      ['Purpose', 'Annual Vaccation'],
      ['Passengers', 'BADR ALI, SARA BADR'],
      ['Route', 'RUH → COK 2026-12-20\nCOK → RUH 2027-01-10'],
      ['Flight', 'Saudia SV 780 · 01:10 → 09:20 · direct'],
      ['Price', '1840 SAR · checked 2026-11-21 09:30'],
      ['Allowance', '2400 SAR allotted · 1200 provisioned'],
    ]);
  });

  it('marks a price typed in by hand', () => {
    const lines = travelLines({employeeName: 'A', itinerary: [], passengers: [], total: 900, currency: 'SAR', source: 'Manual', priceVerified: false} as any);
    expect(lines.find(l => l[0] === 'Price')![1]).toBe('900 SAR · entered by the coordinator');
  });
});
