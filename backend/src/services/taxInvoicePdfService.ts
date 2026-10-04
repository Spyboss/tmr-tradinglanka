import PDFDocument from 'pdfkit';
import Branding from '../models/Branding.js';
import { IBill } from '../models/Bill.js';
import http from 'http';
import https from 'https';
import { getDocumentAttributionTop, renderDocumentAttribution } from './pdfAttribution.js';
import { computeVat } from '../utils/vat.js';
import { amountInWords } from '../utils/numberToWords.js';

const loadLogoBuffer = async (url?: string): Promise<Buffer | undefined> => {
  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return undefined;
  const MAX_LOGO_BYTES = 1 * 1024 * 1024;
  const REQUEST_TIMEOUT_MS = 5000;

  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, (res) => {
        const statusOk = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (!statusOk || !ct.startsWith('image/')) {
          try { res.destroy(); } catch { /* already gone */ }
          resolve(undefined);
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (c) => {
          const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
          total += buf.length;
          if (total > MAX_LOGO_BYTES) {
            try { res.destroy(); } catch { /* already gone */ }
            resolve(undefined);
            return;
          }
          chunks.push(buf);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(undefined));
      });
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        try { req.destroy(); } catch { /* already gone */ }
        resolve(undefined);
      });
      req.on('error', () => resolve(undefined));
    } catch {
      resolve(undefined);
    }
  });
};

/** Gazette Annexure I 4.1.b/d: dates in MM/DD/YYYY. */
const formatInvoiceDate = (d?: Date | string | null): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

interface TaxProfile {
  tin?: string;
  vatNumber?: string;
  phone?: string;
  pricesIncludeVat: boolean;
  vatRate: number;
  dealerName: string;
  brandPartner: string;
  primaryColor: string;
  addressLine1: string;
  addressLine2: string;
  footerNote: string;
  logoUrl?: string;
}

const loadTaxProfile = async (ownerId?: unknown): Promise<TaxProfile> => {
  const fallback: TaxProfile = {
    pricesIncludeVat: true,
    vatRate: 18,
    dealerName: 'TMR Trading Lanka',
    brandPartner: 'TMR Trading Lanka (Pvt) Ltd',
    primaryColor: '#d32f2f',
    addressLine1: '',
    addressLine2: '',
    footerNote: '',
    logoUrl: undefined
  };
  try {
    let b: any = null;
    if (ownerId) b = await Branding.findOne({ userId: ownerId }).lean();
    if (!b) b = await Branding.findOne({ userId: null }).lean();
    if (!b) return fallback;
    return {
      tin: b.tin || undefined,
      vatNumber: b.vatNumber || undefined,
      phone: b.phone || undefined,
      pricesIncludeVat: b.pricesIncludeVat !== false,
      vatRate: typeof b.vatRate === 'number' ? b.vatRate : 18,
      dealerName: b.dealerName || fallback.dealerName,
      brandPartner: b.brandPartner || fallback.brandPartner,
      primaryColor: b.primaryColor || fallback.primaryColor,
      addressLine1: b.addressLine1 || '',
      addressLine2: b.addressLine2 || '',
      footerNote: b.footerNote || '',
      logoUrl: b.logoUrl || undefined
    };
  } catch {
    return fallback;
  }
};

const paymentMode = (bill: IBill): string => {
  if (bill.isAdvancePayment) return 'Advance Payment';
  if (bill.billType === 'leasing') return 'Leasing';
  return 'Cash';
};

const supplyDescription = (bill: IBill): string => {
  const bits = [bill.bikeModel || 'Electric Vehicle'];
  if (bill.vehicleType) bits.push(`(${bill.vehicleType})`);
  if (bill.isAdvancePayment) bits.unshift('Advance Payment for');
  return bits.join(' ');
};

const referenceOf = (bill: IBill): string => {
  const parts: string[] = [];
  if (bill.chassisNumber) parts.push(`Chassis: ${bill.chassisNumber}`);
  if (bill.motorNumber) parts.push(`Motor: ${bill.motorNumber}`);
  return parts.join('\n');
};

/**
 * Generate a Tax Invoice PDF for a bill in the format mandated by
 * Gazette 2481/22 Annexure I (TAX INVOICE SPECIFICATION), effective
 * 1 Oct 2026 per Gazette 2500/106.
 *
 * The bill must already carry an invoiceSerialNumber — the caller
 * (route) enforces that; this generator renders whatever it is given.
 */
export const generateTaxInvoicePDF = async (bill: IBill): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, left: 50, right: 50, bottom: 18 },
        bufferPages: true
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      (async () => {
        const profile = await loadTaxProfile(bill.owner);

        const gross = typeof bill.totalAmount === 'number' ? bill.totalAmount : 0;
        const hasStoredVat = typeof bill.taxableValue === 'number' && typeof bill.vatAmount === 'number';
        const breakdown = hasStoredVat
          ? { taxableValue: bill.taxableValue as number, vatAmount: bill.vatAmount as number, total: gross }
          : computeVat(gross, profile.pricesIncludeVat, profile.vatRate);
        const vatRate = typeof bill.taxRate === 'number' ? bill.taxRate : profile.vatRate;

        const attributionWidth = 500;
        const attributionGap = 6;
        const contentBottomY = (): number =>
          getDocumentAttributionTop(doc, attributionWidth) - attributionGap;

        // ---------------------------------------------------------------
        // Header: logo + supplier masthead (left) — Annexure I 2
        // ---------------------------------------------------------------
        const leftX = 50;
        const rightX = 320;
        const topY = 40;
        const logoBuffer = await loadLogoBuffer(profile.logoUrl);
        let titleX = leftX;
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, leftX, topY, { height: 24 });
            titleX = leftX + 75;
          } catch { /* logo optional */ }
        }

        doc.fontSize(16)
          .font('Helvetica-Bold')
          .fillColor(profile.primaryColor)
          .text(profile.brandPartner, titleX, topY);

        doc.fontSize(9)
          .font('Helvetica')
          .fillColor('#000000');
        let supplierY = topY + 22;
        if (profile.addressLine1) {
          doc.text(profile.addressLine1, leftX, supplierY, { width: 250 });
          supplierY += 13;
        }
        if (profile.addressLine2) {
          doc.text(profile.addressLine2, leftX, supplierY, { width: 250 });
          supplierY += 13;
        }
        if (profile.phone) {
          doc.text(`Telephone: ${profile.phone}`, leftX, supplierY, { width: 250 });
          supplierY += 13;
        }

        // Title — Annexure I 1: prominently titled "TAX INVOICE"
        doc.fontSize(24)
          .font('Helvetica-Bold')
          .fillColor('#000000')
          .text('TAX INVOICE', leftX, 118, { width: 495, align: 'center' });

        // ---------------------------------------------------------------
        // Invoice meta — Annexure I 4.1.a/b/d
        // ---------------------------------------------------------------
        let y = 156;
        doc.fontSize(10).font('Helvetica');
        doc.text(`Date of Invoice: ${formatInvoiceDate(bill.invoiceDate || bill.billDate)}`, leftX, y);
        doc.text(`Tax Invoice No.: ${bill.invoiceSerialNumber || ''}`, rightX, y, { width: 230 });

        // ---------------------------------------------------------------
        // Supplier block (left) + Purchaser block (right) — Annexure I 2, 3
        // ---------------------------------------------------------------
        y += 26;

        doc.fontSize(9).font('Helvetica-Bold');
        if (profile.tin || profile.vatNumber) {
          doc.text(`Supplier's TIN: ${profile.tin || profile.vatNumber}`, leftX, y, { width: 250 });
        }
        if (bill.purchaserTin) {
          doc.text(`Purchaser's TIN: ${bill.purchaserTin}`, rightX, y, { width: 230 });
        }
        doc.font('Helvetica');
        doc.text(`Supplier's Name: ${profile.brandPartner}`, leftX, y + 14, { width: 250 });
        doc.text(`Purchaser's Name: ${bill.customerName || ''}`, rightX, y + 14, { width: 230 });

        const leftY = y + 28;
        let rightY = y + 28;
        if (bill.customerAddress) {
          doc.text(bill.customerAddress, rightX, rightY, { width: 230 });
          rightY += Math.max(doc.heightOfString(bill.customerAddress, { width: 230 }), 12) + 3;
        }
        if (bill.customerPhone) {
          doc.text(`Telephone: ${bill.customerPhone}`, rightX, rightY, { width: 230 });
          rightY += 13;
        }
        y = Math.max(leftY, rightY) + 8;

        // Date of supply + place of supply (place optional per 4.1.c)
        doc.text(`Date of Supply: ${formatInvoiceDate(bill.dateOfSupply || bill.invoiceDate || bill.billDate)}`, leftX, y);
        if (profile.addressLine1) {
          doc.text(`Place of Supply: ${profile.addressLine1}`, rightX, y, { width: 230 });
        }
        y += 20;

        // ---------------------------------------------------------------
        // Items table — Annexure I 4.1.e/f/g
        // Content area is 50..545 (A4 595pt minus margins); every column
        // and rule must stay inside it.
        // ---------------------------------------------------------------
        const RIGHT_EDGE = leftX + 495;
        const cols = {
          reference: { x: leftX, width: 110 },
          description: { x: leftX + 115, width: 165 },
          quantity: { x: leftX + 285, width: 45 },
          unitPrice: { x: leftX + 335, width: 75 },
          amountExclVat: { x: leftX + 415, width: 80 }
        };

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Reference', cols.reference.x, y, { width: cols.reference.width });
        doc.text('Description of Goods or Services', cols.description.x, y, { width: cols.description.width });
        doc.text('Quantity', cols.quantity.x, y, { width: cols.quantity.width, align: 'center' });
        doc.text('Unit Price', cols.unitPrice.x, y, { width: cols.unitPrice.width, align: 'right' });
        const amountHeader = 'Amount Excluding VAT (Rs.)';
        doc.text(amountHeader, cols.amountExclVat.x, y, { width: cols.amountExclVat.width, align: 'right' });
        y += Math.max(doc.heightOfString(amountHeader, { width: cols.amountExclVat.width, align: 'right' }), 12) + 8;

        doc.moveTo(leftX, y).lineTo(RIGHT_EDGE, y).stroke();
        y += 8;

        doc.fontSize(9).font('Helvetica');
        const desc = supplyDescription(bill);
        const ref = referenceOf(bill);
        const descHeight = doc.heightOfString(desc, { width: cols.description.width });
        const refHeight = ref ? doc.heightOfString(ref, { width: cols.reference.width }) : 0;
        const rowHeight = Math.max(descHeight, refHeight, 14);

        doc.text(ref, cols.reference.x, y, { width: cols.reference.width });
        doc.text(desc, cols.description.x, y, { width: cols.description.width });
        doc.text('1', cols.quantity.x, y, { width: cols.quantity.width, align: 'center' });
        doc.text(breakdown.taxableValue.toFixed(2), cols.unitPrice.x, y, { width: cols.unitPrice.width, align: 'right' });
        doc.text(breakdown.taxableValue.toFixed(2), cols.amountExclVat.x, y, { width: cols.amountExclVat.width, align: 'right' });
        y += rowHeight + 6;

        doc.moveTo(leftX, y).lineTo(RIGHT_EDGE, y).stroke();
        y += 12;

        // ---------------------------------------------------------------
        // Totals — Annexure I 4.1.g i/ii/iii. Each label is measured so a
        // wrapping label ("VAT Amount (Total Value of Supply @ 18%)") can
        // never overlap the row below it.
        // ---------------------------------------------------------------
        const totalsX = 260;
        const labelW = 170;
        const numX = totalsX + labelW + 10;
        const numW = 105;

        const totalsRow = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}): void => {
          doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size ?? 10);
          const h = doc.heightOfString(label, { width: labelW });
          doc.text(label, totalsX, y, { width: labelW });
          doc.text(value, numX, y, { width: numW, align: 'right' });
          y += Math.max(h, 14) + 6;
        };

        totalsRow('Total Value of Supply:', breakdown.taxableValue.toFixed(2));
        totalsRow(`VAT Amount (Total Value of Supply @ ${vatRate}%)`, breakdown.vatAmount.toFixed(2));
        y += 2;
        doc.moveTo(totalsX, y).lineTo(numX + numW, y).stroke();
        y += 8;
        totalsRow('Total Amount including VAT:', breakdown.total.toFixed(2), { bold: true, size: 11 });
        y += 8;

        // ---------------------------------------------------------------
        // Amount in words + mode of payment — Annexure I 4.1.g.iv / 4.1.h
        // ---------------------------------------------------------------
        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Total Amount in words:', leftX, y, { width: 110 });
        doc.font('Helvetica');
        doc.text(amountInWords(breakdown.total), leftX + 115, y, { width: 435 });
        y += Math.max(doc.heightOfString(amountInWords(breakdown.total), { width: 435 }), 12) + 10;

        doc.font('Helvetica-Bold').fontSize(9);
        doc.text('Mode of Payment:', leftX, y, { width: 110 });
        doc.font('Helvetica');
        doc.text(paymentMode(bill), leftX + 115, y, { width: 200 });
        y += 24;

        // ---------------------------------------------------------------
        // Signature block + footer
        // ---------------------------------------------------------------
        if (y + 70 < contentBottomY()) {
          doc.moveTo(345, y + 30).lineTo(545, y + 30).stroke();
          doc.fontSize(9).font('Helvetica');
          doc.text('Authorized Signature:', 345, y + 36, { width: 200 });
          doc.text('Company Stamp', 345, y + 52, { width: 200 });

          doc.text('This is a computer-generated document.', leftX, y + 36, { width: 250 });
          if (profile.footerNote) {
            doc.text(profile.footerNote, leftX, y + 52, { width: 250 });
          }
        }

        renderDocumentAttribution(doc, { left: leftX, width: attributionWidth });

        const pageRange = doc.bufferedPageRange();
        if (pageRange.count > 1) {
          for (let i = 0; i < pageRange.count; i++) {
            doc.switchToPage(pageRange.start + i);
            const yb = getDocumentAttributionTop(doc, attributionWidth);
            doc.font('Helvetica').fontSize(7).fillColor('#9ca3af');
            const label = `Page ${i + 1} of ${pageRange.count}`;
            const x = leftX + Math.max(attributionWidth - doc.widthOfString(label), 0);
            doc.text(label, x, yb, { lineBreak: false });
          }
        }

        doc.end();
      })().catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};
