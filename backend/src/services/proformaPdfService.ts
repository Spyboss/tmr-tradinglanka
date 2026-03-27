import PDFDocument from 'pdfkit';
import {
  COMPANY_BRAND,
  formatAmount,
  formatDate,
  loadBranding,
  loadLogoBuffer
} from './pdfService.js';

type NormalizedProformaData = {
  proformaNumber: string;
  issueDate: Date;
  validUntil: Date;
  validityDays: number;
  customerName: string;
  customerAddress: string;
  customerNIC: string;
  customerPhone: string;
  facilityProviderName: string;
  facilityProviderType: string;
  facilityProviderAddress: string;
  facilityProviderPhone: string;
  bikeModel: string;
  manufacturedYear: string;
  color: string;
  motorPower: string;
  chassisNumber: string;
  motorNumber: string;
  unitPrice: number;
  downPayment: number;
  amountToBeLeased: number;
  totalAmount: number;
  terms: string[];
  authorizedDealerLabel: string;
};

type InfoCardRow = {
  label: string;
  value: string;
  maxLines?: number;
};

const DEFAULT_VALIDITY_DAYS = 10;
const SRI_LANKA_MOBILE_REGEX = /^07\d{8}$/;
const GENERAL_PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

const toText = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const pickText = (payload: any, keys: string[]): string => {
  for (const key of keys) {
    const value = toText(payload?.[key]);
    if (value) return value;
  }
  return '';
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (!cleaned) return Number.NaN;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
};

const pickNumber = (payload: any, keys: string[]): number => {
  for (const key of keys) {
    if (payload?.[key] === undefined || payload?.[key] === null || payload?.[key] === '') continue;
    const value = toNumber(payload[key]);
    if (Number.isFinite(value)) return value;
  }
  return Number.NaN;
};

const toValidDate = (value: unknown, fallback: Date): Date => {
  if (!value) return fallback;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const clampInteger = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const createAutoProformaNumber = (issueDate: Date): string => {
  const year = issueDate.getUTCFullYear().toString().slice(-2);
  const month = String(issueDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(issueDate.getUTCDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `PF-${year}${month}${day}-${random}`;
};

const normalizeFacilityProviderType = (value: string): string => {
  const normalized = value.toLowerCase();
  if (normalized === 'leasing') return 'Leasing';
  if (normalized === 'finance') return 'Finance';
  if (normalized === 'insurance') return 'Insurance';
  return value || 'Leasing / Finance / Insurance';
};

const normalizeTerms = (payload: any, validityDays: number, dealerName: string): string[] => {
  const terms = Array.isArray(payload?.terms)
    ? payload.terms.map((term: unknown) => toText(term)).filter(Boolean)
    : [];

  if (terms.length > 0) return terms;

  return [
    `All purchase orders and approved leasing or finance cheques must be drawn in favor of ${dealerName} and crossed "Account Payee Only".`,
    'Customer signature on this proforma invoice must be placed at the time of vehicle delivery.',
    'The company is not liable for any delay caused by force majeure or events beyond its control.',
    `This proforma invoice is valid for ${validityDays} days from the issue date. Prices may change after expiry due to tax, duty, or exchange rate changes.`
  ];
};

const truncateToFitLines = (
  doc: PDFKit.PDFDocument,
  text: string,
  options: { width: number; maxLines: number; font: string; fontSize: number }
): string => {
  const value = (text || '').trim();
  if (!value) return '';

  const { width, maxLines, font, fontSize } = options;
  const lineHeight = doc.font(font).fontSize(fontSize).currentLineHeight();
  const maxHeight = lineHeight * maxLines;

  const fits = (candidate: string): boolean => {
    const height = doc.heightOfString(candidate, { width, lineGap: 0 });
    return height <= maxHeight;
  };

  if (fits(value)) return value;

  let low = 0;
  let high = value.length;
  let best = '';

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${value.slice(0, mid).trimEnd()}...`;
    if (fits(candidate)) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best || `${value.slice(0, 3)}...`;
};

const normalizeProformaPayload = (payload: any, dealerName: string): NormalizedProformaData => {
  const issueDate = toValidDate(payload?.issueDate || payload?.billDate || payload?.bill_date, new Date());

  const validityDaysRaw = pickNumber(payload, ['validityDays', 'validity_days']);
  const validityDays = Number.isFinite(validityDaysRaw)
    ? clampInteger(validityDaysRaw, 1, 90)
    : DEFAULT_VALIDITY_DAYS;

  const unitPrice = pickNumber(payload, ['unitPrice', 'unit_price', 'proformaUnitPrice', 'proforma_unit_price', 'bikePrice', 'bike_price']);
  const downPaymentRaw = pickNumber(payload, ['downPayment', 'down_payment']);
  const downPayment = Number.isFinite(downPaymentRaw) ? Math.max(0, downPaymentRaw) : 0;

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new Error('Unit price is required and must be greater than zero');
  }

  if (downPayment > unitPrice) {
    throw new Error('Down payment cannot exceed unit price');
  }

  const amountToBeLeasedRaw = pickNumber(payload, ['amountToBeLeased', 'amount_to_be_leased']);
  const amountToBeLeased = Number.isFinite(amountToBeLeasedRaw)
    ? amountToBeLeasedRaw
    : unitPrice - downPayment;

  if (amountToBeLeased < 0) {
    throw new Error('Amount to be leased must be zero or greater');
  }

  const totalAmountRaw = pickNumber(payload, ['totalAmount', 'total_amount']);
  const totalAmount = Number.isFinite(totalAmountRaw) ? totalAmountRaw : unitPrice;

  const customerPhone = pickText(payload, ['customerPhone', 'customer_phone']);
  if (!SRI_LANKA_MOBILE_REGEX.test(customerPhone)) {
    throw new Error('Customer contact number must be in 07XXXXXXXX format');
  }

  const financePhone = pickText(payload, ['facilityProviderPhone', 'financeProviderPhone', 'finance_provider_phone']);
  if (!GENERAL_PHONE_REGEX.test(financePhone)) {
    throw new Error('Leasing/finance contact number format is invalid');
  }

  const requiredFields: Array<{ key: keyof NormalizedProformaData; value: string; label: string }> = [
    { key: 'customerName', value: pickText(payload, ['customerName', 'customer_name']), label: 'Customer name' },
    { key: 'customerAddress', value: pickText(payload, ['customerAddress', 'customer_address']), label: 'Customer address' },
    { key: 'customerNIC', value: pickText(payload, ['customerNIC', 'customer_nic']), label: 'Customer NIC' },
    { key: 'facilityProviderName', value: pickText(payload, ['facilityProviderName', 'financeProviderName', 'finance_provider_name']), label: 'Leasing/finance by' },
    { key: 'facilityProviderAddress', value: pickText(payload, ['facilityProviderAddress', 'financeProviderAddress', 'finance_provider_address']), label: 'Leasing/finance address' },
    { key: 'bikeModel', value: pickText(payload, ['bikeModel', 'bike_model']), label: 'Vehicle model' },
    {
      key: 'manufacturedYear',
      value: pickText(payload, ['manufacturedYear', 'manufactured_year', 'vehicleManufacturedYear', 'vehicle_manufactured_year', 'manufacturer', 'vehicleManufacturer', 'vehicle_manufacturer']),
      label: 'Manufactured year'
    },
    { key: 'color', value: pickText(payload, ['color', 'vehicleColor', 'vehicle_color']), label: 'Color' },
    { key: 'motorPower', value: pickText(payload, ['motorPower', 'motor_power']), label: 'Motor power' },
    { key: 'chassisNumber', value: pickText(payload, ['chassisNumber', 'chassis_number']), label: 'Chassis number' },
    { key: 'motorNumber', value: pickText(payload, ['motorNumber', 'motor_number']), label: 'Motor number' }
  ];

  const missingField = requiredFields.find((field) => !field.value);
  if (missingField) {
    throw new Error(`${missingField.label} is required`);
  }

  const rawProviderType = pickText(payload, ['facilityProviderType', 'financeProviderType', 'finance_provider_type']);
  const facilityProviderType = normalizeFacilityProviderType(rawProviderType);

  const proformaNumber = pickText(payload, ['proformaNumber', 'proforma_number']) || createAutoProformaNumber(issueDate);
  const validUntil = addDays(issueDate, validityDays);
  const terms = normalizeTerms(payload, validityDays, dealerName);

  return {
    proformaNumber,
    issueDate,
    validUntil,
    validityDays,
    customerName: requiredFields.find((f) => f.key === 'customerName')!.value,
    customerAddress: requiredFields.find((f) => f.key === 'customerAddress')!.value,
    customerNIC: requiredFields.find((f) => f.key === 'customerNIC')!.value,
    customerPhone,
    facilityProviderName: requiredFields.find((f) => f.key === 'facilityProviderName')!.value,
    facilityProviderType,
    facilityProviderAddress: requiredFields.find((f) => f.key === 'facilityProviderAddress')!.value,
    facilityProviderPhone: financePhone,
    bikeModel: requiredFields.find((f) => f.key === 'bikeModel')!.value,
    manufacturedYear: requiredFields.find((f) => f.key === 'manufacturedYear')!.value,
    color: requiredFields.find((f) => f.key === 'color')!.value,
    motorPower: requiredFields.find((f) => f.key === 'motorPower')!.value,
    chassisNumber: requiredFields.find((f) => f.key === 'chassisNumber')!.value,
    motorNumber: requiredFields.find((f) => f.key === 'motorNumber')!.value,
    unitPrice,
    downPayment,
    amountToBeLeased,
    totalAmount,
    terms,
    authorizedDealerLabel: pickText(payload, ['authorizedDealerLabel', 'authorized_dealer_label']) || 'Authorized Dealer'
  };
};

const drawHeader = (
  doc: PDFKit.PDFDocument,
  contentLeft: number,
  contentWidth: number,
  branding: any,
  data: NormalizedProformaData,
  logoBuffer?: Buffer
): number => {
  const top = 32;
  const headerHeight = 94;
  const metaBoxWidth = 172;
  const metaBoxX = contentLeft + contentWidth - metaBoxWidth - 10;
  const cardRadius = 6;

  doc
    .lineWidth(1)
    .strokeColor('#d1d5db')
    .roundedRect(contentLeft, top, contentWidth, headerHeight, cardRadius)
    .stroke();

  let detailsX = contentLeft + 12;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, contentLeft + 12, top + 14, { width: 74 });
      detailsX = contentLeft + 98;
    } catch {
      detailsX = contentLeft + 12;
    }
  }

  const brandWidth = metaBoxX - detailsX - 14;
  const dealerName = toText(branding?.dealerName) || COMPANY_BRAND;
  const addressLine1 = toText(branding?.addressLine1);
  const addressLine2 = toText(branding?.addressLine2);
  const brandPartner = toText(branding?.brandPartner);

  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor('#111827')
    .text(COMPANY_BRAND, detailsX, top + 14, { width: brandWidth, lineGap: 0 });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#374151')
    .text(dealerName, detailsX, top + 36, { width: brandWidth, lineGap: 0 })
    .text(addressLine1, detailsX, top + 50, { width: brandWidth, lineGap: 0 });

  if (brandPartner) {
    doc.text(brandPartner, detailsX, top + 64, { width: brandWidth, lineGap: 0 });
  }

  if (addressLine2) {
    doc.text(addressLine2, detailsX, top + 78, { width: brandWidth, lineGap: 0 });
  }

  doc
    .fillColor('#f8fafc')
    .roundedRect(metaBoxX, top + 10, metaBoxWidth, headerHeight - 20, 4)
    .fill();

  doc
    .lineWidth(1)
    .strokeColor('#d1d5db')
    .roundedRect(metaBoxX, top + 10, metaBoxWidth, headerHeight - 20, 4)
    .stroke();

  const metaLabelX = metaBoxX + 10;
  const metaValueX = metaBoxX + 10;

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#6b7280')
    .text('PROFORMA NO', metaLabelX, top + 18)
    .text('DATE', metaLabelX, top + 44)
    .text('VALID UNTIL', metaLabelX, top + 70);

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#111827')
    .text(data.proformaNumber, metaValueX, top + 28, { width: metaBoxWidth - 20 })
    .text(formatDate(data.issueDate), metaValueX, top + 54, { width: metaBoxWidth - 20 })
    .text(formatDate(data.validUntil), metaValueX, top + 80, { width: metaBoxWidth - 20 });

  const titleY = top + headerHeight + 10;
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#111827')
    .text('PROFORMA INVOICE', contentLeft, titleY, { width: contentWidth, align: 'center' });

  doc
    .lineWidth(1)
    .strokeColor('#1f2937')
    .moveTo(contentLeft, titleY + 26)
    .lineTo(contentLeft + contentWidth, titleY + 26)
    .stroke();

  return titleY + 36;
};

const prepareCardRows = (
  doc: PDFKit.PDFDocument,
  rows: InfoCardRow[],
  valueWidth: number,
  labelWidth: number
): Array<InfoCardRow & { valueText: string; rowHeight: number }> => {
  return rows.map((row) => {
    const valueText = truncateToFitLines(doc, row.value, {
      width: valueWidth,
      maxLines: row.maxLines || 2,
      font: 'Helvetica',
      fontSize: 9
    });

    const labelText = `${row.label}:`;
    const labelHeight = doc.font('Helvetica').fontSize(8.5).heightOfString(labelText, {
      width: labelWidth,
      lineGap: 0
    });

    const valueHeight = doc.font('Helvetica').fontSize(9).heightOfString(valueText || '-', {
      width: valueWidth,
      lineGap: 1
    });

    return {
      ...row,
      valueText: valueText || '-',
      rowHeight: Math.max(labelHeight, valueHeight)
    };
  });
};

const measureCardHeight = (
  preparedRows: Array<InfoCardRow & { valueText: string; rowHeight: number }>
): number => {
  const headingHeight = 28;
  const rowsHeight = preparedRows.reduce((total, row) => total + row.rowHeight + 7, 0);
  return Math.max(120, headingHeight + rowsHeight + 10);
};

const drawInfoCard = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  preparedRows: Array<InfoCardRow & { valueText: string; rowHeight: number }>,
  forcedHeight: number
): void => {
  doc
    .lineWidth(1)
    .strokeColor('#d1d5db')
    .roundedRect(x, y, width, forcedHeight, 5)
    .stroke();

  doc
    .fillColor('#f8fafc')
    .roundedRect(x, y, width, 26, 5)
    .fill();

  doc
    .lineWidth(1)
    .strokeColor('#d1d5db')
    .roundedRect(x, y, width, 26, 5)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#111827')
    .text(title, x + 10, y + 8, { width: width - 20 });

  const labelWidth = 88;
  const valueX = x + labelWidth + 16;
  const valueWidth = width - labelWidth - 24;
  let rowY = y + 33;

  for (const row of preparedRows) {
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#4b5563')
      .text(`${row.label}:`, x + 10, rowY, { width: labelWidth, lineGap: 0 });

    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#111827')
      .text(row.valueText, valueX, rowY, { width: valueWidth, lineGap: 1 });

    rowY += row.rowHeight + 7;
  }
};

const drawVehicleTable = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  data: NormalizedProformaData
): number => {
  const columns = [
    { key: 'bikeModel', label: 'Model', width: 72, align: 'left' as const, maxLines: 2 },
    { key: 'manufacturedYear', label: 'Manufactured\nYear', width: 58, align: 'center' as const, maxLines: 1 },
    { key: 'color', label: 'Color', width: 40, align: 'left' as const, maxLines: 2 },
    { key: 'motorPower', label: 'Motor\nPower', width: 52, align: 'left' as const, maxLines: 2 },
    { key: 'chassisNumber', label: 'Chassis\nNo', width: 67, align: 'left' as const, maxLines: 2 },
    { key: 'motorNumber', label: 'Motor\nNo', width: 67, align: 'left' as const, maxLines: 2 },
    { key: 'unitPrice', label: 'Unit Price\n(LKR)', width: 55, align: 'right' as const, maxLines: 1 },
    { key: 'downPayment', label: 'Down Payment\n(LKR)', width: 52, align: 'right' as const, maxLines: 1 },
    { key: 'amountToBeLeased', label: 'Amount Leased\n(LKR)', width: 52, align: 'right' as const, maxLines: 1 }
  ];

  const cellPadding = 4;
  const headerHeight = 34;

  const valuesByKey: Record<string, string> = {
    bikeModel: data.bikeModel,
    manufacturedYear: data.manufacturedYear,
    color: data.color,
    motorPower: data.motorPower,
    chassisNumber: data.chassisNumber,
    motorNumber: data.motorNumber,
    unitPrice: formatAmount(data.unitPrice),
    downPayment: formatAmount(data.downPayment),
    amountToBeLeased: formatAmount(data.amountToBeLeased)
  };

  const preparedValues = columns.map((column) => {
    const value = valuesByKey[column.key] || '-';
    const text = truncateToFitLines(doc, value, {
      width: column.width - (cellPadding * 2),
      maxLines: column.maxLines,
      font: 'Helvetica',
      fontSize: 8.8
    });

    const height = doc.font('Helvetica').fontSize(8.8).heightOfString(text, {
      width: column.width - (cellPadding * 2),
      align: column.align,
      lineGap: 0
    });

    return {
      ...column,
      text,
      textHeight: height
    };
  });

  const dataRowHeight = Math.max(24, Math.max(...preparedValues.map((item) => item.textHeight)) + (cellPadding * 2));
  const totalRowHeight = 24;

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#111827')
    .text('Details of Motorcycle to be Leased / Financed', x, y, { width });

  let currentY = y + 16;
  let cursorX = x;

  for (const column of preparedValues) {
    doc.fillColor('#e5e7eb').rect(cursorX, currentY, column.width, headerHeight).fill();
    doc.strokeColor('#9ca3af').lineWidth(1).rect(cursorX, currentY, column.width, headerHeight).stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(7.6)
      .fillColor('#111827')
      .text(column.label, cursorX + cellPadding, currentY + 6, {
        width: column.width - (cellPadding * 2),
        align: 'center',
        lineGap: 0
      });

    cursorX += column.width;
  }

  currentY += headerHeight;
  cursorX = x;

  for (const column of preparedValues) {
    const shouldHighlight = column.key === 'amountToBeLeased';
    doc
      .fillColor(shouldHighlight ? '#fef3c7' : '#ffffff')
      .rect(cursorX, currentY, column.width, dataRowHeight)
      .fill();

    doc.strokeColor('#9ca3af').lineWidth(1).rect(cursorX, currentY, column.width, dataRowHeight).stroke();

    doc
      .font('Helvetica')
      .fontSize(8.8)
      .fillColor('#111827')
      .text(column.text, cursorX + cellPadding, currentY + cellPadding, {
        width: column.width - (cellPadding * 2),
        align: column.align,
        lineGap: 0
      });

    cursorX += column.width;
  }

  currentY += dataRowHeight;
  const lastColumnWidth = columns[columns.length - 1].width;
  const totalLabelWidth = width - lastColumnWidth;

  doc.fillColor('#e5e7eb').rect(x, currentY, totalLabelWidth, totalRowHeight).fill();
  doc.strokeColor('#9ca3af').lineWidth(1).rect(x, currentY, totalLabelWidth, totalRowHeight).stroke();

  doc.fillColor('#e5e7eb').rect(x + totalLabelWidth, currentY, lastColumnWidth, totalRowHeight).fill();
  doc.strokeColor('#9ca3af').lineWidth(1).rect(x + totalLabelWidth, currentY, lastColumnWidth, totalRowHeight).stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#111827')
    .text('Total Amount (LKR)', x + 8, currentY + 8, { width: totalLabelWidth - 16, align: 'right' })
    .text(formatAmount(data.totalAmount), x + totalLabelWidth + 4, currentY + 8, {
      width: lastColumnWidth - 8,
      align: 'right'
    });

  return currentY + totalRowHeight;
};

const drawTerms = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  terms: string[]
): number => {
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#111827')
    .text('Notes & Conditions', x, y, { width });

  let currentY = y + 16;
  for (const term of terms) {
    const prefixed = `- ${term}`;
    doc
      .font('Helvetica')
      .fontSize(8.8)
      .fillColor('#374151')
      .text(prefixed, x, currentY, { width, lineGap: 1 });

    currentY += doc.heightOfString(prefixed, { width, lineGap: 1 }) + 6;
  }

  return currentY;
};

const drawSignatures = (
  doc: PDFKit.PDFDocument,
  x: number,
  width: number,
  y: number,
  authorizedDealerLabel: string
): void => {
  const lineY = y + 24;

  doc
    .lineWidth(1)
    .strokeColor('#111827')
    .moveTo(x + 12, lineY)
    .lineTo(x + 212, lineY)
    .stroke();

  doc
    .lineWidth(1)
    .strokeColor('#111827')
    .moveTo(x + width - 212, lineY)
    .lineTo(x + width - 12, lineY)
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#111827')
    .text('Customer Signature', x + 45, lineY + 8)
    .text(authorizedDealerLabel, x + width - 190, lineY + 8, { width: 178, align: 'center' });
};

const drawFooter = (
  doc: PDFKit.PDFDocument,
  x: number,
  width: number,
  footerLines: string[]
): void => {
  const lineHeight = 11;
  const footerY = doc.page.height - doc.page.margins.bottom - (footerLines.length * lineHeight) - 2;

  footerLines.forEach((line, index) => {
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#6b7280')
      .text(line, x, footerY + (index * lineHeight), { width, align: 'center' });
  });
};

export const generateProformaPDF = async (payload: any): Promise<Buffer> => {
  const branding = await loadBranding(payload?.owner);
  const dealerName = toText(branding?.dealerName) || COMPANY_BRAND;
  const normalized = normalizeProformaPayload(payload, dealerName);
  const logoBuffer = await loadLogoBuffer(branding?.logoUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const contentLeft = 40;
      const contentWidth = doc.page.width - (contentLeft * 2);

      let currentY = drawHeader(doc, contentLeft, contentWidth, branding, normalized, logoBuffer);

      const cardGap = 12;
      const cardWidth = (contentWidth - cardGap) / 2;
      const cardLabelWidth = 88;
      const cardValueWidth = cardWidth - cardLabelWidth - 24;

      const customerRows = prepareCardRows(doc, [
        { label: 'Date', value: formatDate(normalized.issueDate), maxLines: 1 },
        { label: 'Customer Name', value: normalized.customerName, maxLines: 2 },
        { label: 'Address', value: normalized.customerAddress, maxLines: 2 },
        { label: 'NIC No', value: normalized.customerNIC, maxLines: 1 },
        { label: 'Contact Number', value: normalized.customerPhone, maxLines: 1 }
      ], cardValueWidth, cardLabelWidth);

      const providerRows = prepareCardRows(doc, [
        { label: `${normalized.facilityProviderType} by`, value: normalized.facilityProviderName, maxLines: 2 },
        { label: 'Address', value: normalized.facilityProviderAddress, maxLines: 2 },
        { label: 'Contact Number', value: normalized.facilityProviderPhone, maxLines: 1 },
        { label: 'Validity', value: `${normalized.validityDays} day(s)`, maxLines: 1 }
      ], cardValueWidth, cardLabelWidth);

      const cardHeight = Math.max(measureCardHeight(customerRows), measureCardHeight(providerRows));

      drawInfoCard(doc, contentLeft, currentY, cardWidth, 'Customer Details', customerRows, cardHeight);
      drawInfoCard(doc, contentLeft + cardWidth + cardGap, currentY, cardWidth, 'Leasing / Finance / Insurance', providerRows, cardHeight);

      currentY += cardHeight + 16;
      currentY = drawVehicleTable(doc, contentLeft, currentY, contentWidth, normalized);
      currentY += 14;

      currentY = drawTerms(doc, contentLeft, currentY, contentWidth, normalized.terms);

      const footerLines = ['This is a system-generated proforma invoice.'];
      const brandingFooterNote = toText(branding?.footerNote);
      if (brandingFooterNote) {
        footerLines.push(brandingFooterNote);
      }

      const footerHeight = (footerLines.length * 11) + 8;
      const signatureBlockHeight = 58;
      const minSignatureY = currentY + 8;
      const maxSignatureY = doc.page.height - doc.page.margins.bottom - footerHeight - signatureBlockHeight;

      if (minSignatureY > maxSignatureY) {
        doc.addPage();
        const nextPageStartY = 80;
        drawSignatures(doc, contentLeft, contentWidth, nextPageStartY, normalized.authorizedDealerLabel);
      } else {
        drawSignatures(doc, contentLeft, contentWidth, Math.max(minSignatureY, maxSignatureY), normalized.authorizedDealerLabel);
      }

      drawFooter(doc, contentLeft, contentWidth, footerLines);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
