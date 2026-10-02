import { describe, it, expect, vi } from 'vitest';
import { generateQuotationPDF } from '../services/quotationPdfService.js';
import { countPages, extractRuns, textByPage, findRun } from '../test-utils/pdfProbe.js';

vi.mock('../models/Branding.js', () => ({
  default: { findOne: vi.fn().mockReturnValue({ lean: () => Promise.resolve(null) }) }
}));

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

    // The footer hugs the bottom edge of the sheet (A4 = 841.9pt tall)
    // instead of floating above a half inch of white space.
    expect(attribution!.y, 'footer too far from the bottom edge').toBeGreaterThanOrEqual(805);
    expect(attribution!.y, 'footer ran off the sheet').toBeLessThan(830);

    // The signature needs a real signing area: clear space above the rule and
    // a stamp label that does not crowd it.
    const signature = findRun(pdf, 'Authorized Signature:');
    const stamp = findRun(pdf, 'Company Stamp');
    expect(signature, 'signature line missing').toBeDefined();
    expect(stamp, 'stamp label missing').toBeDefined();
    const remarksBody = findRun(pdf, 'Payment should be made within 7 days');
    expect(remarksBody, 'remarks body missing').toBeDefined();
    expect(
      signature!.y - remarksBody!.y,
      'signature is crowded by the block above it'
    ).toBeGreaterThanOrEqual(60);
    expect(
      stamp!.y - signature!.y,
      'no room between the signature line and the stamp'
    ).toBeGreaterThanOrEqual(30);
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

    // The attribution strip always trails the document on its final page.
    const attribution = findRun(pdf, 'dms.uhadev.com');
    expect(attribution, 'attribution missing').toBeDefined();
    expect(attribution!.page, 'attribution must be the last page').toBe(pages.length - 1);
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
    // (Probe y grows downward from the top of the page.)
    const remarksBody = findRun(pdf, 'Payment should be made within 7 days');
    expect(remarksBody, 'remarks body missing').toBeDefined();
    expect(remarks!.y).toBeLessThan(remarksBody!.y);
    expect(remarksBody!.y).toBeLessThan(closing!.y);
  });

  it('numbers every page of a multi-page document and leaves single pages alone', async () => {
    const multi = await generateQuotationPDF(manyItemsInvoice(40));
    const pages = textByPage(multi);
    expect(pages.length, 'fixture should force a page break').toBeGreaterThan(1);

    pages.forEach((runs, i) => {
      const label = runs.find(run => run.text.startsWith('Page '));
      expect(label, `page ${i + 1} is missing its page number`).toBeDefined();
      expect(label!.text).toBe(`Page ${i + 1} of ${pages.length}`);
      // The number sits in the same bottom band as the attribution.
      expect(label!.y, 'page number not in the footer band').toBeGreaterThanOrEqual(805);
      expect(label!.y, 'page number ran off the sheet').toBeLessThan(830);
    });

    const single = await generateQuotationPDF(realInvoice());
    expect(
      extractRuns(single).some(run => run.text.startsWith('Page ')),
      'a one-page invoice must not carry a page number'
    ).toBe(false);
  });

  it('puts a light continuation header on every page after the first', async () => {
    const pdf = await generateQuotationPDF(manyItemsInvoice(40));
    const pages = textByPage(pdf);
    expect(pages.length, 'fixture should force a page break').toBeGreaterThan(1);

    // Fallback brand partner used while the Branding model is mocked to null.
    for (let i = 1; i < pages.length; i++) {
      const header = pages[i].find(run => run.text.includes('TMR Trading Lanka (Pvt) Ltd'));
      expect(header, `page ${i + 1} has no continuation header`).toBeDefined();
      expect(header!.y, `continuation header too low on page ${i + 1}`).toBeLessThan(60);
      const ref = pages[i].find(run => run.text.includes('BULK-40'));
      expect(ref, `page ${i + 1} does not reference the document number`).toBeDefined();
    }

    // The first page keeps the full masthead, not the light one: brand partner
    // appears at the 20pt title size there, never at the 11pt continuation size.
    expect(
      pages[0].some(run => run.text.includes('TMR Trading Lanka (Pvt) Ltd') && run.size === 20),
      'first page must keep the full-sized masthead'
    ).toBe(true);
  });
});
