import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../server.js';
import Bill from '../models/Bill.js';
import User from '../models/User.js';

vi.mock('../auth/jwt.strategy.js', () => ({
  verifyToken: vi.fn(async () => ({ sub: 'test-user-id' }))
}));

vi.mock('../services/proformaPdfService.js', () => ({
  generateProformaPDF: vi.fn(async () => Buffer.from('fake-proforma-pdf'))
}));

describe('Bill proforma routes', () => {
  const billId = '6566f1f2a1b2c3d4e5f6a7b8';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns default proforma payload when none is saved', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: 'admin-id', role: 'admin' } as any);
    vi.spyOn(Bill, 'findById').mockResolvedValue({
      _id: billId,
      owner: 'test-user-id',
      status: 'completed',
      billNumber: 'BILL-20260327-001',
      billDate: new Date('2026-03-27T00:00:00.000Z'),
      bikePrice: 480000,
      downPayment: 120000
    } as any);

    const res = await request(app)
      .get(`/api/bills/${billId}/proforma`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('proforma');
    expect(res.body.proforma.type).toBe('leasing');
    expect(res.body.proforma.unitPrice).toBe(480000);
    expect(res.body.proforma.downPayment).toBe(120000);
  });

  it('rejects proforma save for non-completed bills', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: 'admin-id', role: 'admin' } as any);
    vi.spyOn(Bill, 'findById').mockResolvedValue({
      _id: billId,
      owner: 'test-user-id',
      status: 'pending'
    } as any);

    const res = await request(app)
      .put(`/api/bills/${billId}/proforma`)
      .set('Authorization', 'Bearer test-token')
      .send({
        financeCompanyName: 'ABC Finance',
        financeCompanyAddress: 'No 1, Main Street',
        financeCompanyContact: '0712345678'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('only available for completed bills');
  });

  it('saves proforma details for completed bills', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: 'admin-id', role: 'admin' } as any);

    const save = vi.fn(async () => true);
    const billDoc: any = {
      _id: billId,
      owner: 'test-user-id',
      status: 'completed',
      billNumber: 'BILL-20260327-001',
      billDate: new Date('2026-03-27T00:00:00.000Z'),
      bikePrice: 480000,
      downPayment: 100000,
      save
    };

    vi.spyOn(Bill, 'findById').mockResolvedValue(billDoc);

    const res = await request(app)
      .put(`/api/bills/${billId}/proforma`)
      .set('Authorization', 'Bearer test-token')
      .send({
        type: 'leasing',
        documentNumber: 'PF-001',
        financeCompanyName: 'ABC Finance',
        financeCompanyAddress: 'No 1, Main Street',
        financeCompanyContact: '0712345678',
        unitPrice: 480000,
        downPayment: 100000,
        amountToBeLeased: 380000
      });

    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(billDoc.proforma.financeCompanyName).toBe('ABC Finance');
    expect(billDoc.proforma.amountToBeLeased).toBe(380000);
  });

  it('preserves date-only issueDate values without timezone drift', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: 'admin-id', role: 'admin' } as any);

    const save = vi.fn(async () => true);
    const billDoc: any = {
      _id: billId,
      owner: 'test-user-id',
      status: 'completed',
      billNumber: 'BILL-20260327-001',
      billDate: new Date('2026-03-27T00:00:00.000Z'),
      bikePrice: 480000,
      downPayment: 100000,
      save
    };

    vi.spyOn(Bill, 'findById').mockResolvedValue(billDoc);

    const res = await request(app)
      .put(`/api/bills/${billId}/proforma`)
      .set('Authorization', 'Bearer test-token')
      .send({
        issueDate: '2026-03-19',
        financeCompanyName: 'ABC Finance',
        financeCompanyAddress: 'No 1, Main Street',
        financeCompanyContact: '0712345678'
      });

    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(billDoc.proforma.issueDate.toISOString()).toBe('2026-03-19T00:00:00.000Z');
  });

  it('generates proforma pdf when details are complete', async () => {
    vi.spyOn(User, 'findById').mockResolvedValue({ _id: 'admin-id', role: 'admin' } as any);

    const toObject = vi.fn(() => ({
      _id: billId,
      billNumber: 'BILL-20260327-001',
      customerName: 'Test Customer'
    }));

    vi.spyOn(Bill, 'findById').mockResolvedValue({
      _id: billId,
      owner: 'test-user-id',
      status: 'completed',
      billNumber: 'BILL-20260327-001',
      proforma: {
        type: 'leasing',
        financeCompanyName: 'ABC Finance',
        financeCompanyAddress: 'No 1, Main Street',
        financeCompanyContact: '0712345678',
        unitPrice: 480000,
        downPayment: 120000,
        amountToBeLeased: 360000
      },
      toObject
    } as any);

    const res = await request(app)
      .get(`/api/bills/${billId}/proforma/pdf`)
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('application/pdf');
  });
});
