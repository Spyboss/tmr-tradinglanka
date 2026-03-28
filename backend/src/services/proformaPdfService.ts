import PDFDocument from 'pdfkit';
import http from 'http';
import https from 'https';
import Branding from '../models/Branding.js';

type ProformaPayload = {
  type?: string;
  documentNumber?: string;
  issueDate?: string | Date;
  financeCompanyName?: string;
  financeCompanyAddress?: string;
  financeCompanyContact?: string;
  manufactureYear?: string;
  color?: string;
  motorPower?: string;
  unitPrice?: number;
  downPayment?: number;
  amountToBeLeased?: number;
};

type BillForProforma = {
  owner?: any;
  billNumber?: string;
  bill_number?: string;
  billDate?: string | Date;
  customerName?: string;
  customerNIC?: string;
  customerAddress?: string;
  customerPhone?: string;
  bikeModel?: string;
  motorNumber?: string;
  chassisNumber?: string;
  bikePrice?: number;
  downPayment?: number;
  proforma?: ProformaPayload;
};

type BrandingData = {
  dealerName: string;
  logoUrl?: string;
  primaryColor?: string;
  addressLine1?: string;
  addressLine2?: string;
  brandPartner?: string;
};

const TERMS = [
  'All purchase orders and pertinent cheques from bank and approved leasing/finance companies shall be drawn in favor of TMR Trading Lanka (Pvt) Ltd and crossed "Account Payee only".',
  'Customer\'s signature on this "Proforma Invoice" shall be placed at the time of delivery of motorcycle.',
  'The company shall not be liable for any failure or delay to observe or perform any obligation under this instrument due to force majeure or act of God beyond the control of the company.',
  'This proforma invoice is valid for a period of 10 days from date of issue. Non-receipt of purchase order within the stipulated period will result in automatic lapse of validity and the motorcycle may be sold without prior notice. Prices are subject to change due to dollar parity fluctuation or imposition of fiscal duties/taxes.'
];

export const generateProformaPDF = async (bill: BillForProforma): Promise<Buffer> => {
  const branding = await loadBranding(bill.owner);
  const logoBuffer = await loadLogoBuffer(branding.logoUrl);

  const proforma = bill.proforma || {};
  const unitPrice = toNumber(proforma.unitPrice, toNumber(bill.bikePrice, 0));
  const downPayment = toNumber(proforma.downPayment, toNumber(bill.downPayment, 0));
  const amountToBeLeased = toNumber(proforma.amountToBeLeased, Math.max(unitPrice - downPayment, 0));

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const contentWidth = right - left;

      let y = 40;

      y = renderHeader(doc, branding, logoBuffer, {
        title: 'PROFORMA INVOICE',
        docNo: proforma.documentNumber || '-',
        issueDate: proforma.issueDate,
        y,
        left,
        right
      });

      y += 10;
      y = renderPartiesSection(doc, {
        y,
        left,
        contentWidth,
        customerName: bill.customerName,
        customerAddress: bill.customerAddress,
        customerNIC: bill.customerNIC,
        customerPhone: bill.customerPhone,
        financeCompanyName: proforma.financeCompanyName,
        financeCompanyAddress: proforma.financeCompanyAddress,
        financeCompanyContact: proforma.financeCompanyContact
      });

      y += 10;
      y = renderVehicleTable(doc, {
        y,
        left,
        contentWidth,
        model: bill.bikeModel,
        manufactureYear: proforma.manufactureYear,
        color: proforma.color,
        motorPower: proforma.motorPower,
        chassisNumber: bill.chassisNumber,
        motorNumber: bill.motorNumber,
        unitPrice,
        downPayment,
        amountToBeLeased
      });

      y += 16;
      y = renderTerms(doc, { y, left, contentWidth, terms: TERMS });

      y += 28;
      renderSignatureArea(doc, { y, left, contentWidth, branding });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const renderHeader = (
  doc: PDFKit.PDFDocument,
  branding: BrandingData,
  logoBuffer: Buffer | undefined,
  params: { title: string; docNo: string; issueDate?: string | Date; y: number; left: number; right: number }
): number => {
  const { title, docNo, issueDate, y, left, right } = params;
  const pageWidth = right;
  const centerX = left + (pageWidth - left) / 2;
  const rightSectionX = right - 150;
  const rightSectionWidth = 150;

  const leftSectionWidth = 180;
  const centerSectionWidth = 260;

  const headerBaseY = y + 10;
  const logoHeight = logoBuffer ? 70 : 0;
  
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, left, headerBaseY, { width: 85 });
    } catch {}
  }

  const titleY = headerBaseY + 22;
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#111827')
    .text(title, centerX - centerSectionWidth / 2, titleY, { width: centerSectionWidth, align: 'center' });

  const rightBlockY = headerBaseY;
  const rightBlockHeight = 72;
  const boxPadding = 10;
  
  doc
    .rect(rightSectionX - boxPadding, rightBlockY - 4, rightSectionWidth + boxPadding * 2, rightBlockHeight)
    .lineWidth(0.7)
    .strokeColor('#d1d5db')
    .stroke();

  const rightContentX = rightSectionX;
  const lineHeight = 16;
  
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#6b7280')
    .text('Invoice No', rightContentX, rightBlockY + 2, { width: rightSectionWidth, align: 'left' });
  
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#111827')
    .text(String(docNo), rightContentX, rightBlockY + lineHeight, { width: rightSectionWidth, align: 'left' });
  
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#6b7280')
    .text('Date', rightContentX, rightBlockY + lineHeight * 2 + 2, { width: rightSectionWidth, align: 'left' });
  
  const dateStr = formatDate(issueDate);
  
  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor('#111827')
    .text(dateStr, rightContentX, rightBlockY + lineHeight * 3 - 2, { width: rightSectionWidth, align: 'left' });

  return y + 90;
};

const renderPartiesSection = (
  doc: PDFKit.PDFDocument,
  params: {
    y: number;
    left: number;
    contentWidth: number;
    customerName?: string;
    customerAddress?: string;
    customerNIC?: string;
    customerPhone?: string;
    financeCompanyName?: string;
    financeCompanyAddress?: string;
    financeCompanyContact?: string;
  }
): number => {
  const { y, left, contentWidth } = params;
  const gap = 14;
  const colWidth = (contentWidth - gap) / 2;
  const leftX = left;
  const rightX = left + colWidth + gap;

  let currentY = y;

  const leftBlockStart = currentY;
  currentY = drawFieldRow(doc, leftX, currentY, colWidth, 'Customer Name', params.customerName || '-', 28);
  currentY = drawFieldRow(doc, leftX, currentY, colWidth, 'Address', params.customerAddress || '-', 50);
  currentY = drawFieldRow(doc, leftX, currentY, colWidth, 'NIC No', params.customerNIC || '-', 24);
  currentY = drawFieldRow(doc, leftX, currentY, colWidth, 'Contact No.', params.customerPhone || '-', 24);

  let rightY = leftBlockStart;
  rightY = drawFieldRow(doc, rightX, rightY, colWidth, 'Leasing / Finance Company', params.financeCompanyName || '-', 28);
  rightY = drawFieldRow(doc, rightX, rightY, colWidth, 'Address', params.financeCompanyAddress || '-', 78);
  rightY += 8;
  rightY = drawFieldRow(doc, rightX, rightY, colWidth, 'Contact No.', params.financeCompanyContact || '-', 24);

  return Math.max(currentY, rightY);
};

const drawFieldRow = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  height: number
): number => {
  doc.rect(x, y, width, height).lineWidth(0.8).strokeColor('#4b5563').stroke();

  const paddingX = 8;
  const labelY = y + 5;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#6b7280')
    .text(`${label}:`, x + paddingX, labelY, { width: width - (paddingX * 2) });

  const valueY = y + 17;
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#111827')
    .text(value || '-', x + paddingX, valueY, {
      width: width - (paddingX * 2),
      lineGap: 1,
      height: Math.max(height - 18, 8)
    });

  return y + height;
};

const renderVehicleTable = (
  doc: PDFKit.PDFDocument,
  params: {
    y: number;
    left: number;
    contentWidth: number;
    model?: string;
    manufactureYear?: string;
    color?: string;
    motorPower?: string;
    chassisNumber?: string;
    motorNumber?: string;
    unitPrice: number;
    downPayment: number;
    amountToBeLeased: number;
  }
): number => {
  const { y, left, contentWidth } = params;
  const titleHeight = 26;
  const headerHeight = 44;
  const rowHeight = 46;
  const totalHeight = 28;

  const widths = [62, 46, 44, 52, 74, 74, 57, 53, 53];
  const headers = [
    'Model',
    'Manufacture\nYear',
    'Color',
    'Motor\nPower',
    'Chassis No',
    'Motor No',
    'Unit Price\n(LKR)',
    'Down\nPayment\n(LKR)',
    'Amount to be\nLeased (LKR)'
  ];

  let currentY = y;

  doc.rect(left, currentY, contentWidth, titleHeight).lineWidth(0.9).strokeColor('#374151').stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text('Details Of Motorcycle To Be Leased/Finance', left, currentY + 6, { width: contentWidth, align: 'center' });

  currentY += titleHeight;

  let cellX = left;
  headers.forEach((header, index) => {
    const width = widths[index];
    doc.rect(cellX, currentY, width, headerHeight).lineWidth(0.7).strokeColor('#4b5563').stroke();
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#1f2937')
      .text(header, cellX + 3, currentY + 5, { width: width - 6, align: 'center', lineGap: 1 });
    cellX += width;
  });

  currentY += headerHeight;

  const rowValues = [
    params.model || '-',
    params.manufactureYear || '-',
    params.color || '-',
    params.motorPower || '-',
    params.chassisNumber || '-',
    params.motorNumber || '-',
    formatAmount(params.unitPrice),
    formatAmount(params.downPayment),
    formatAmount(params.amountToBeLeased)
  ];

  cellX = left;
  rowValues.forEach((value, index) => {
    const width = widths[index];
    doc.rect(cellX, currentY, width, rowHeight).lineWidth(0.7).strokeColor('#4b5563').stroke();
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#111827')
      .text(value, cellX + 3, currentY + 14, {
        width: width - 6,
        align: index >= 6 ? 'right' : 'center'
      });
    cellX += width;
  });

  currentY += rowHeight;

  doc.rect(left, currentY, contentWidth, totalHeight).lineWidth(0.9).strokeColor('#374151').stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#111827')
    .text(`Total Amount (LKR): ${formatAmount(params.amountToBeLeased)}`, left, currentY + 8, {
      width: contentWidth - 10,
      align: 'center'
    });

  return currentY + totalHeight;
};

const renderTerms = (
  doc: PDFKit.PDFDocument,
  params: { y: number; left: number; contentWidth: number; terms: string[] }
): number => {
  let currentY = params.y;

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#111827');

  params.terms.forEach((term) => {
    const bulletX = params.left + 6;
    const textX = params.left + 20;
    const textWidth = params.contentWidth - 24;

    doc.text('*', bulletX, currentY);
    doc.text(term, textX, currentY, { width: textWidth, lineGap: 2 });

    const usedHeight = doc.heightOfString(term, { width: textWidth, lineGap: 2 });
    currentY += usedHeight + 12;
  });

  return currentY;
};

const renderSignatureArea = (
  doc: PDFKit.PDFDocument,
  params: { y: number; left: number; contentWidth: number; branding: BrandingData }
): void => {
  const lineWidth = 180;
  const leftX = params.left + 40;
  const rightX = params.left + params.contentWidth - (lineWidth + 40);
  const y = doc.page.height - doc.page.margins.bottom - 80;

  doc
    .moveTo(leftX, y)
    .lineTo(leftX + lineWidth, y)
    .strokeColor('#374151')
    .lineWidth(0.9)
    .stroke();

  doc
    .moveTo(rightX, y)
    .lineTo(rightX + lineWidth, y)
    .strokeColor('#374151')
    .lineWidth(0.9)
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#111827')
    .text('Customer Signature', leftX + 12, y + 10, { width: lineWidth - 20, align: 'center' })
    .text('Authorized Dealer for', rightX + 10, y + 10, { width: lineWidth - 20, align: 'center' });

  const dealerInfo = params.branding.brandPartner || params.branding.dealerName;
  const dealerAddress = params.branding.addressLine1;
  
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#111827')
    .text(dealerInfo, rightX + 10, y + 24, { width: lineWidth - 20, align: 'center' });
  
  if (dealerAddress) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#6b7280')
      .text(dealerAddress, rightX + 10, y + 36, { width: lineWidth - 20, align: 'center' });
  }

};

const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDate = (value?: string | Date): string => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const day = d.getUTCDate().toString().padStart(2, '0');
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

const loadBranding = async (userId?: string): Promise<BrandingData> => {
  try {
    let b;
    if (userId) {
      b = await Branding.findOne({ userId }).lean();
    }
    if (!b) {
      b = await Branding.findOne({ userId: null }).lean();
    }

    return {
      dealerName: b?.dealerName || 'TMR Trading Lanka (Pvt) Ltd',
      logoUrl: b?.logoUrl,
      primaryColor: b?.primaryColor || '#111827',
      addressLine1: b?.addressLine1 || '',
      addressLine2: b?.addressLine2 || '',
      brandPartner: b?.brandPartner || ''
    };
  } catch {
    return { dealerName: 'TMR Trading Lanka (Pvt) Ltd' };
  }
};

const loadLogoBuffer = async (url?: string): Promise<Buffer | undefined> => {
  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return undefined;

  const MAX_LOGO_BYTES = 1 * 1024 * 1024;
  const REQUEST_TIMEOUT_MS = 5000;

  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https://') ? https : http;
      const req = client.get(url, (res) => {
        const statusOk = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
        const contentType = (res.headers['content-type'] || '').toLowerCase();

        if (!statusOk || !contentType.startsWith('image/')) {
          try { res.destroy(); } catch {}
          resolve(undefined);
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;

        res.on('data', (chunk) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += buf.length;
          if (total > MAX_LOGO_BYTES) {
            try { res.destroy(); } catch {}
            resolve(undefined);
            return;
          }
          chunks.push(buf);
        });

        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(undefined));
      });

      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        try { req.destroy(); } catch {}
        resolve(undefined);
      });

      req.on('error', () => resolve(undefined));
    } catch {
      resolve(undefined);
    }
  });
};
