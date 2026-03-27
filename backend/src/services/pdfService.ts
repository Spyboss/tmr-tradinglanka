import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import Branding from '../models/Branding.js';
import https from 'https';
import http from 'http';

type FooterMetrics = {
  left: number;
  width: number;
  lineGap: number;
  blockHeight: number;
  thankYouText: string;
  footerNoteText: string;
  addressLine2Text: string;
  thankYouHeight: number;
  footerNoteHeight: number;
  addressLine2Height: number;
};

/**
 * Generate a PDF for a bill
 * @param bill The bill object
 * @returns Promise with PDF buffer
 */
export const generatePDF = async (bill: any): Promise<Buffer> => {
  // Load branding isolated by the bill owner
  const branding = await loadBranding(bill.owner);
  const logoBuffer = await loadLogoBuffer(branding.logoUrl);

  return new Promise((resolve, reject) => {
    try {
      // Create a document
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // Set up streams to capture PDF data
      const buffers: Buffer[] = [];

      // Handle document stream events
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Start adding content to the PDF
      const footerMetrics = getFooterMetrics(doc, branding);
      generateHeader(doc, branding, logoBuffer);
      generateCustomerInformation(doc, bill);
      generateInvoiceTable(doc, bill, footerMetrics);
      generateFooter(doc, footerMetrics);

      // Finalize the PDF
      doc.end();
    } catch (error) {
      console.error('PDF generation error:', error);
      reject(error);
    }
  });
};

/**
 * Generate the header section of the bill
 */
export const COMPANY_BRAND = process.env.COMPANY_BRAND || 'TMR TRADING LANKA (Pvt) Ltd';

const generateHeader = (doc: PDFKit.PDFDocument, branding: any, logoBuffer?: Buffer): void => {
  try {
    // Include remote logo if available
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 55, { width: 75 });
      } catch {
        // Continue without logo
      }
    }
    // Line 1: Company brand (fixed)
    doc
      .fillColor('#444444')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(COMPANY_BRAND, 130, 55, { width: 400 })
      // Line 2: Dealer name (tighter spacing by ~3px)
      .font('Helvetica')
      .fontSize(12)
      .text(branding?.dealerName || '', 130, 82, { width: 400 })
      // Line 3: Address line 1 (tighter by ~5px)
      .fontSize(11)
      .text(branding?.addressLine1 || '', 130, 100, { width: 400 })
      // Optional: Brand partner (tighter by ~6px)
      .fontSize(10)
      .text(branding?.brandPartner || '', 130, 114, { width: 400 })
      // Optional: Address line 2 (tighter by ~7px)
      .fontSize(10)
      .text(branding?.addressLine2 || '', 130, 128, { width: 400 })
      .moveDown();
  } catch (error) {
    // If there's an error, fall back to text-only header
    console.error('Error rendering header with logo:', error);
    doc
      .fillColor('#444444')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(COMPANY_BRAND, 50, 45, { align: 'center' })
      .font('Helvetica')
      .fontSize(12)
      .text(branding?.dealerName || '', 50, 75, { align: 'center' })
      .fontSize(11)
      .text(branding?.addressLine1 || '', 50, 95, { align: 'center' })
      .fontSize(10)
      .text(branding?.brandPartner || '', 50, 110, { align: 'center' })
      .fontSize(10)
      .text(branding?.addressLine2 || '', 50, 125, { align: 'center' })
      .moveDown();
  }
};

/**
 * Generate customer information section
 */
const generateCustomerInformation = (doc: PDFKit.PDFDocument, bill: any): void => {
  // Right side data (Bill No and Date) with additional spacing from header
  doc
    .fontSize(10)
    .text('Bill No:', 400, 160)
    .font('Helvetica-Bold')
    .text(bill.billNumber || bill.bill_number || '', 450, 160, { width: 150 })
    .font('Helvetica');
    
  // Format the date properly
  const dateText = formatDate(bill.billDate || bill.bill_date);
  doc.text('Date:', 400, 180)
     .font('Helvetica-Bold')
     .text(dateText, 450, 180, { width: 150 })
     .font('Helvetica');
  
  doc
    .fillColor('#444444')
    .fontSize(14)
    .text('Customer Details:', 50, 160);
  
  const customerName = bill.customerName || bill.customer_name || '';
  
  // Set starting Y position for customer details
  let currentY = 180;
  
  const detailLabelX = 50;
  const detailValueX = 150;
  const detailValueWidth = 220;
  const detailRowGap = 4;

  const drawDetailRow = (
    label: string,
    value: string,
    y: number,
    options?: { valueFont?: string }
  ): number => {
    const labelText = `${label}:`;
    const safeValue = value || '';
    const valueFont = options?.valueFont || 'Helvetica';
    const renderedValue = safeValue;

    doc
      .font('Helvetica')
      .fontSize(10)
      .text(labelText, detailLabelX, y);

    doc
      .font(valueFont)
      .fontSize(10)
      .text(renderedValue, detailValueX, y, { width: detailValueWidth, lineGap: 0 });

    doc.font('Helvetica');

    const labelHeight = doc.heightOfString(labelText, { width: 80, lineGap: 0 });
    const valueHeight = doc.heightOfString(renderedValue, { width: detailValueWidth, lineGap: 0 });

    return y + Math.max(labelHeight, valueHeight) + detailRowGap;
  };

  currentY = drawDetailRow('Name', customerName, currentY, { valueFont: 'Helvetica-Bold' });
  currentY = drawDetailRow('NIC', bill.customerNIC || bill.customer_nic || '', currentY);
  currentY = drawDetailRow('Address', bill.customerAddress || bill.customer_address || '', currentY);

  const customerPhone = bill.customerPhone || bill.customer_phone || '';
  if (customerPhone) {
    currentY = drawDetailRow('Contact No', customerPhone, currentY);
  }
  
  // Add spacing before vehicle details
  currentY += 22;
  
  doc
    .fontSize(14)
    .text('Vehicle Details:', 50, currentY);
  
  doc
    .fontSize(10)
    .text('Model:', 50, currentY + 20)
    .text(bill.bikeModel || bill.model_name || '', 150, currentY + 20, { width: 300 })
    .text('Type:', 50, currentY + 35)
    .text(bill.vehicleType || bill.vehicle_type || 'E-MOTORCYCLE', 150, currentY + 35, { width: 300 })
    .text('Motor Number:', 50, currentY + 50)
    .text(bill.motorNumber || bill.motor_number || '', 150, currentY + 50, { width: 300 })
    .text('Chassis Number:', 50, currentY + 65)
    .text(bill.chassisNumber || bill.chassis_number || '', 150, currentY + 65, { width: 300 });
    
  // Store the final Y position as a property on the doc object for the invoice table to use
  (doc as any)._lastDetailY = currentY + 85;
};

/**
 * Generate the invoice table with payment details
 */
const generateInvoiceTable = (doc: PDFKit.PDFDocument, bill: any, footerMetrics: FooterMetrics): void => {
  // Get the Y position after customer and vehicle details
  let y = (doc as any)._lastDetailY || 320;
  y += 18;

  const getContentBottomY = (): number => {
    return doc.page.height - doc.page.margins.bottom - footerMetrics.blockHeight - 14;
  };

  const ensureSpace = (requiredHeight: number): void => {
    if (y + requiredHeight > getContentBottomY()) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  };

  const shouldIncludeRmvCharge = (bill.rmvCharge > 0 || bill.rmv_charge > 0) && (bill.billType === 'cash' || bill.bill_type === 'cash');
  const shouldIncludeLeasingRmv = bill.billType === 'leasing' || bill.bill_type === 'leasing';
  const shouldIncludeDownPayment = shouldIncludeLeasingRmv && (bill.downPayment || bill.down_payment);
  const isAdvancePayment = (bill.isAdvancePayment || bill.is_advance_payment) && (bill.advanceAmount || bill.advance_amount);
  const shouldIncludeRmvCondition = (bill.billType === 'cash' || bill.bill_type === 'cash') &&
    !(bill.isEbicycle || bill.is_ebicycle) &&
    !(bill.isAdvancePayment || bill.is_advance_payment);

  const itemRowHeight = 25;
  const tableTextOffsetY = 7;
  const tableRowsCount = 1 + 1 + (shouldIncludeRmvCharge ? 1 : 0) + (shouldIncludeLeasingRmv ? 1 : 0) + (shouldIncludeDownPayment ? 1 : 0) + (isAdvancePayment ? 3 : 1);
  const tableHeight = tableRowsCount * itemRowHeight;

  ensureSpace(25 + tableHeight);
  
  doc
    .fontSize(14)
    .text('Payment Details:', 50, y);
  
  y += 25;
  
  // Draw table with borders
  const tableTop = y;
  
  // Set column widths
  const col1Width = 350; // Description column
  const col2Width = 150; // Amount column
  
  // Table headers with borders and background
  doc
    .fontSize(10)
    .font('Helvetica-Bold');
  
  // Draw table header row with background
  doc
    .fillColor('#e0e0e0') // Light gray background
    .rect(50, tableTop, col1Width, itemRowHeight)
    .fill() // Fill with background color
    .fillColor('#000000') // Reset to black for text
    .rect(50, tableTop, col1Width, itemRowHeight)
    .stroke(); // Add stroke
    
  doc
    .fillColor('#e0e0e0') // Light gray background
    .rect(50 + col1Width, tableTop, col2Width, itemRowHeight)
    .fill() // Fill with background color
    .fillColor('#000000') // Reset to black for text
    .rect(50 + col1Width, tableTop, col2Width, itemRowHeight)
    .stroke(); // Add stroke
  
  // Header text
  doc
    .text('Description', 60, tableTop + tableTextOffsetY)
    .text('Amount (Rs.)', 50 + col1Width, tableTop + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
  
  doc.font('Helvetica');
  
  y = tableTop + itemRowHeight;
  
  // Add bike price row
  // Draw row background
  doc
    .rect(50, y, col1Width, itemRowHeight)
    .stroke()
    .rect(50 + col1Width, y, col2Width, itemRowHeight)
    .stroke();
  
  // Row content
  doc
    .text('Bike Price', 60, y + tableTextOffsetY)
    .text(formatAmount(bill.bikePrice || bill.bike_price), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
  
  y += itemRowHeight;
  
  // Add RMV charge if applicable
  if (shouldIncludeRmvCharge) {
    // Draw row background
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    // Row content
    doc
      .text('RMV Charge', 60, y + tableTextOffsetY)
      .text(formatAmount(bill.rmvCharge || bill.rmv_charge || 13000), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
    
    y += itemRowHeight;
  } else if (shouldIncludeLeasingRmv) {
    // Draw row background
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    // Row content
    doc
      .text('RMV Charge - CPZ', 60, y + tableTextOffsetY)
      .text(formatAmount(bill.rmvCharge || bill.rmv_charge || 13500), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
    
    y += itemRowHeight;
  }
  
  // Add down payment if leasing
  if (shouldIncludeDownPayment) {
    // Draw row background
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    // Row content
    doc
      .text('Down Payment', 60, y + tableTextOffsetY)
      .text(formatAmount(bill.downPayment || bill.down_payment), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
    
    y += itemRowHeight;
  }
  
  // If advance payment, show advance amount and balance
  if (isAdvancePayment) {
    // Draw total row
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    doc
      .font('Helvetica-Bold')
      .text('Total Amount', 60, y + tableTextOffsetY)
      .text(formatAmount(bill.totalAmount || bill.total_amount), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
    
    doc.font('Helvetica');
    
    y += itemRowHeight;
    
    // Draw advance row
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    doc
      .text('Advance Amount', 60, y + tableTextOffsetY)
      .text(formatAmount(bill.advanceAmount || bill.advance_amount), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
    
    y += itemRowHeight;
    
    // Draw balance row
    doc
      .fillColor('#f8f4e8') // Light cream background for balance
      .rect(50, y, col1Width, itemRowHeight)
      .fill() // Fill with background color
      .fillColor('#000000') // Reset to black for text
      .rect(50, y, col1Width, itemRowHeight)
      .stroke();
    
    doc
      .fillColor('#f8f4e8') // Light cream background for balance
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .fill() // Fill with background color
      .fillColor('#000000') // Reset to black for text
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    doc
      .font('Helvetica-Bold') // Make the balance bold
      .text('Balance', 60, y + tableTextOffsetY)
      .text(formatAmount(bill.balanceAmount || bill.balance_amount || 0), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' })
      .font('Helvetica'); // Reset font

    y += itemRowHeight;
  } else {
    // Draw the total row with gray background
    doc
      .fillColor('#e0e0e0') // Light gray background
      .rect(50, y, col1Width, itemRowHeight)
      .fill() // Fill with background color
      .fillColor('#000000') // Reset to black for text
      .rect(50, y, col1Width, itemRowHeight)
      .stroke();
    
    doc
      .fillColor('#e0e0e0') // Light gray background
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .fill() // Fill with background color
      .fillColor('#000000') // Reset to black for text
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Total Amount', 60, y + tableTextOffsetY)
    .text(formatAmount(bill.totalAmount || bill.total_amount), 50 + col1Width, y + tableTextOffsetY, { width: col2Width - 20, align: 'right' });
    
    doc.font('Helvetica');
  }
  
  const termsLines = [
    '1. All prices are inclusive of taxes.',
    '2. Warranty is subject to terms and conditions.',
    '3. This is a computer-generated bill.'
  ];
  if (shouldIncludeRmvCondition) {
    termsLines.push('4. RMV registration will be completed within 30 days.');
  }

  const termsSectionGap = 42;
  const termsHeadingGap = 18;
  const termsLineGap = 14;
  const signatureGap = 58;
  const signatureLabelOffset = 10;
  const termsBlockHeight = termsSectionGap + termsHeadingGap + (termsLines.length * termsLineGap) + signatureGap + (signatureLabelOffset + 14);

  // Hybrid flow: keep on same page if possible, otherwise move terms/signature block
  // to the next page while preserving all data and avoiding overlap.
  ensureSpace(termsBlockHeight);

  y += termsSectionGap;
  doc
    .fillColor('#444444')  // Explicitly set color to match other sections
    .fontSize(12)
    .font('Helvetica-Bold')  // Make the header bold
    .text('Terms and Conditions:', 50, y);
  
  y += termsHeadingGap;
  doc
    .font('Helvetica')  // Reset to regular font
    .fontSize(10);

  for (const line of termsLines) {
    doc.text(line, 50, y);
    y += termsLineGap;
  }
  
  // Signature areas
  y += signatureGap;

  const maxSignatureY = getContentBottomY() - (signatureLabelOffset + 14);
  if (y > maxSignatureY) y = maxSignatureY;

  doc
    .moveTo(50, y)
    .lineTo(200, y)
    .stroke();
  
  doc
    .moveTo(350, y)
    .lineTo(500, y)
    .stroke();
  
  doc
    .fontSize(10)
    .text('Dealer Signature', 70, y + signatureLabelOffset)
    .text('Rubber Stamp', 390, y + signatureLabelOffset);
};

/**
 * Generate footer section
 */
const getFooterMetrics = (doc: PDFKit.PDFDocument, branding?: any): FooterMetrics => {
  const left = 50;
  const width = 500;
  const lineGap = 4;

  const thankYouText = 'Thank you for your business!';
  const footerNoteText = branding?.footerNote || '';
  const addressLine2Text = branding?.addressLine2 || '';

  const thankYouHeight = doc.font('Helvetica').fontSize(10).heightOfString(thankYouText, { width, align: 'center' });
  const footerNoteHeight = footerNoteText
    ? doc.font('Helvetica').fontSize(9).heightOfString(footerNoteText, { width, align: 'center' })
    : 0;
  const addressLine2Height = addressLine2Text
    ? doc.font('Helvetica').fontSize(9).heightOfString(addressLine2Text, { width, align: 'center' })
    : 0;

  const blockHeight = thankYouHeight + (footerNoteHeight ? lineGap + footerNoteHeight : 0) + (addressLine2Height ? lineGap + addressLine2Height : 0);

  return {
    left,
    width,
    lineGap,
    blockHeight,
    thankYouText,
    footerNoteText,
    addressLine2Text,
    thankYouHeight,
    footerNoteHeight,
    addressLine2Height
  };
};

const generateFooter = (doc: PDFKit.PDFDocument, footerMetrics: FooterMetrics): void => {
  const footerTopY = doc.page.height - doc.page.margins.bottom - footerMetrics.blockHeight;
  let currentY = footerTopY;

  // Thank you line
  doc
    .fillColor('#000000')
    .fontSize(10)
    .text(footerMetrics.thankYouText, footerMetrics.left, currentY, { align: 'center', width: footerMetrics.width });

  currentY += footerMetrics.thankYouHeight;

  if (footerMetrics.footerNoteText) {
    currentY += footerMetrics.lineGap;

    doc
      .fillColor('#6b7280')
      .fontSize(9)
      .text(footerMetrics.footerNoteText, footerMetrics.left, currentY, { align: 'center', width: footerMetrics.width });

    currentY += footerMetrics.footerNoteHeight;
  }

  if (footerMetrics.addressLine2Text) {
    currentY += footerMetrics.lineGap;

    doc
      .fillColor('#6b7280')
      .fontSize(9)
      .text(footerMetrics.addressLine2Text, footerMetrics.left, currentY, { align: 'center', width: footerMetrics.width });
  }
};

// Load branding document with safe defaults
export const loadBranding = async (userId?: any): Promise<{
  dealerName: string;
  logoUrl?: string;
  primaryColor?: string;
  addressLine1?: string;
  addressLine2?: string;
  brandPartner?: string;
  footerNote?: string;
}> => {
  try {
    let b;
    if (userId) {
      // Try to find personal branding for the user first
      b = await Branding.findOne({ userId });
    }
    
    // Fallback to system-wide branding if no personal branding or no userId provided
    if (!b) {
      b = await Branding.findOne({ userId: null });
    }

    return {
      dealerName: b?.dealerName || 'TMR Trading Lanka (Pvt) Ltd',
      logoUrl: b?.logoUrl,
      primaryColor: b?.primaryColor || '#d32f2f',
      addressLine1: b?.addressLine1 || 'Embilipitiya',
      addressLine2: b?.addressLine2 || '',
      brandPartner: b?.brandPartner || '',
      footerNote: b?.footerNote || ''
    };
  } catch (_) {
    return { dealerName: 'TMR Trading Lanka (Pvt) Ltd' };
  }
};

// Fetch remote logo into a Buffer with size and time safeguards
export const loadLogoBuffer = async (url?: string): Promise<Buffer | undefined> => {
  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return undefined;
  const MAX_LOGO_BYTES = 1 * 1024 * 1024; // 1MB cap
  const REQUEST_TIMEOUT_MS = 5000; // 5s timeout

  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https://') ? https : http;
      const req = client.get(url, (res) => {
        // Only accept OK responses and image content-types
        const statusOk = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
        const ct = (res.headers['content-type'] || '').toLowerCase();
        const isImage = ct.startsWith('image/');
        if (!statusOk || !isImage) {
          try { res.destroy(); } catch {}
          resolve(undefined);
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (c) => {
          const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
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

/**
 * Format amount with thousands separator
 */
export const formatAmount = (value: number | string): string => {
  if (value === undefined || value === null) return '0';
  try {
    const amount = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(amount)) return '0';
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  } catch (error) {
    console.error('Error formatting amount:', error);
    return '0';
  }
};

/**
 * Format date
 */
export const formatDate = (date: string | Date): string => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    // Use UTC methods to avoid timezone conversion issues
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = d.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};
