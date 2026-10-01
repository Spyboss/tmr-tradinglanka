import { describe, it, expect, vi } from 'vitest';
import Branding from '../models/Branding.js';
import { generateQuotationPDF } from '../services/quotationPdfService.js';
import { countPages, textByPage, findRun } from '../test-utils/pdfProbe.js';

vi.mock('../models/Branding.js', () => ({
  default: { findOne: vi.fn().mockReturnValue({ lean: () => Promise.resolve(null) }) }
}));

const FIXTURE_FOOTER_NOTE = 'Contact: +94 77 8318 061 | Email: gunawardanaenttangalle@gmail.com';

/** The real invoice that spilled onto two pages despite ample space. */
const realInvoice = (): any => ({
  type: 'invoice',
  quotationNumber: 'GM-INV-20260928-147',
  quotationDate: new Date('2026-10-01T00:00:00Z'),
  customerName: 'W. A. KARUNASENA',
  customerAddress: 'DHANARAN SUBODA PATUMAGA, SITINAMALUWA,\nTANGALLE',
  bikeRegNo: 'SP BJM - 4847',
  items: [
    { description: 'Shield, Leg Cover White Matte (with sticker)', quantity: 1, rate: 11495, amount: 11495 },
    { description: 'Front Fender Red Matte (with sticker)', quantity: 1, rate: 6550, amount: 6550 },
    { description: 'Headlight Assy', quantity: 1, rate: 11500, amount: 11500 },
    { description: 'Front Protection Bar', quantity: 1, rate: 8000, amount: 8000 },
    { description: 'Service Charge', quantity: 1, rate: 5500, amount: 5500 }
  ],
  discountAmount: 0,
  totalAmount: 43045,
  remarks: 'Payment should be made within 7 days of invoice date.',
  owner: 'user-1'
});

const manyItemsInvoice = (itemCount: number): any => ({
  ...realInvoice(),
  quotationNumber: `BULK-${itemCount}`,
  items: Array.from({ length: itemCount }, (_, i) => ({
    description: `Part number ${i + 1} with a description long enough to wrap across more than one column width`,
    quantity: 2,
    rate: 1500,
    amount: 3000
  })),
  totalAmount: 3000 * itemCount
});

const BOTTOM_MARGIN = 50; // doc margin; content must not render below this.

describe('quotation/invoice PDF pagination', () => {
  it('keeps the real GM-INV-20260928-147 invoice on a single page', async () => {
    const pdf = await generateQuotationPDF(realInvoice());
    expect(countPages(pdf)).toBe(1);
  });

  it('renders the closing footer block on page 1 of a fitting invoice', async () => {
    const pdf = await generateQuotationPDF(realInvoice());
    const pages = textByPage(pdf);

    const thankYou = findRun(pdf, 'Thank you for your business!');
    expect(thankYou, 'closing line missing').toBeDefined();
    expect(thankYou!.page, 'closing line spilled to a later page').toBe(0);

    const attribution = findRun(pdf, 'dms.uhadev.com');
    expect(attribution, 'attribution missing').toBeDefined();
    expect(attribution!.page, 'attribution landed on a different page').toBe(0);

    // The whole closing group must read top-to-bottom: closing lines, then
    // signature/stamp area, then the faded attribution at the page bottom.
    expect(attribution!.y, 'attribution must sit below the closing line').toBeGreaterThan(thankYou!.y);
    expect(pages[0].every(run => run.y >= BOTTOM_MARGIN - 10), 'content overflowed past the bottom margin').toBe(true);
  });

  it('never places content below the bottom margin on any page', async () => {
    const pdf = await generateQuotationPDF(manyItemsInvoice(40));
    const pages = textByPage(pdf);

    pages.forEach((runs, pageIndex) => {
      runs.forEach(run => {
        expect(
          run.y,
          `page ${pageIndex + 1}: "${run.text}" rendered at y=${run.y.toFixed(1)} below the margin`
        ).toBeGreaterThanOrEqual(BOTTOM_MARGIN - 10);
      });
    });
  });

  it('repeats the items table header when rows continue on a new page', async () => {
    const pdf = await generateQuotationPDF(manyItemsInvoice(40));
    const pages = textByPage(pdf);
    expect(pages.length, 'fixture should force a page break').toBeGreaterThan(1);

    for (let i = 1; i < pages.length; i++) {
      const hasHeader = pages[i].some(run => run.text.includes('Description'));
      expect(hasHeader, `page ${i + 1} continued item rows without a repeated column header`).toBe(true);
    }
  });

  it('keeps subtotal, total and remarks together when they fit', async () => {
    const pdf = await generateQuotationPDF(realInvoice());
    const total = findRun(pdf, 'Total Amount:');
    const remarks = findRun(pdf, 'Remarks:');
    const closing = findRun(pdf, 'Thank you for your business!');

    expect(total && remarks && closing).toBeTruthy();
    expect(total!.page).toBe(remarks!.page);
    expect(remarks!.page).toBe(closing!.page);
    // Remarks heading must precede its body, which must precede the closing line.
    expect(remarks!.y).toBeGreaterThan(findRun(pdf, 'Payment should be made within 7 days')!.y);
    expect(findRun(pdf, 'Payment should be made within 7 days')!.y).toBeGreaterThan(closing!.y);
  });
});
