import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import Branding from '../models/Branding.js';
import https from 'https';
import http from 'http';

/**
 * Generate a PDF for a bill
 * @param bill The bill object
 * @returns Promise with PDF buffer
 */
export const generatePDF = async (bill: any): Promise<Buffer> => {
  // Load branding once per document
  const branding = await loadBranding();
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
      generateHeader(doc, branding, logoBuffer);
      generateCustomerInformation(doc, bill);
      generateInvoiceTable(doc, bill);
      generateFooter(doc, branding);

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
const COMPANY_BRAND = process.env.COMPANY_BRAND || 'TMR TRADING LANKA (Pvt) Ltd';

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
  
  // For the customer name, explicitly handle long names by manually breaking them into multiple lines
  const nameText = bill.customerName || bill.customer_name || '';
  
  // Set starting Y position for customer details
  let currentY = 180;
  
  // Draw the "Name:" label
  doc
    .fontSize(10)
    .text('Name:', 50, currentY);
  
  // Handle the customer name with explicit line breaking
  doc.font('Helvetica-Bold');
  if (nameText.length > 20) {
    // Split long names into chunks of roughly 20 characters
    // This ensures even very long names display correctly
    const chunks = [];
    let currentChunk = '';
    const words = nameText.split(' ');
    
    words.forEach(word => {
      if ((currentChunk + ' ' + word).length <= 20) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = word;
      }
    });
    
    if (currentChunk) chunks.push(currentChunk);
    
    // Render the first chunk at the initial position
    doc.text(chunks[0], 150, currentY);
    currentY += 15;
    
    // Render any additional chunks on new lines
    for (let i = 1; i < chunks.length; i++) {
      doc.text(chunks[i], 150, currentY);
      currentY += 15;
    }
  } else {
    // For short names, render in a single line
    doc.text(nameText, 150, currentY);
    currentY += 15;
  }
  
  // Switch back to normal font
  doc.font('Helvetica');
  
  // Add padding between name and NIC
  currentY += 5;
  
  // Draw NIC and address with calculated positions
  doc
    .text('NIC:', 50, currentY)
    .text(bill.customerNIC || bill.customer_nic || '', 150, currentY, { width: 200 });
  
  currentY += 15;
  
  doc
    .text('Address:', 50, currentY)
    .text(bill.customerAddress || bill.customer_address || '', 150, currentY, { width: 200 });
  
  // Add spacing before vehicle details
  currentY += 30;
  
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
const generateInvoiceTable = (doc: PDFKit.PDFDocument, bill: any): void => {
  // Get the Y position after customer and vehicle details
  let y = (doc as any)._lastDetailY || 320;
  y += 18;
  
  doc
    .fontSize(14)
    .text('Payment Details:', 50, y);
  
  y += 25;
  
  // Draw table with borders
  const tableTop = y;
  const itemRowHeight = 25;
  const tableWidth = 500;
  
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
    .text('Description', 60, tableTop + 7)
    .text('Amount (Rs.)', 50 + col1Width, tableTop + 7, { width: col2Width - 20, align: 'right' });
  
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
    .text('Bike Price', 60, y + 7)
    .text(formatAmount(bill.bikePrice || bill.bike_price), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' });
  
  y += itemRowHeight;
  
  // Add RMV charge if applicable
  if ((bill.rmvCharge > 0 || bill.rmv_charge > 0) && (bill.billType === 'cash' || bill.bill_type === 'cash')) {
    // Draw row background
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    // Row content
    doc
      .text('RMV Charge', 60, y + 7)
      .text(formatAmount(bill.rmvCharge || bill.rmv_charge || 13000), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' });
    
    y += itemRowHeight;
  } else if ((bill.billType === 'leasing' || bill.bill_type === 'leasing')) {
    // Draw row background
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    // Row content
    doc
      .text('RMV Charge - CPZ', 60, y + 7)
      .text(formatAmount(bill.rmvCharge || bill.rmv_charge || 13500), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' });
    
    y += itemRowHeight;
  }
  
  // Add down payment if leasing
  if ((bill.billType === 'leasing' || bill.bill_type === 'leasing') && (bill.downPayment || bill.down_payment)) {
    // Draw row background
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    // Row content
    doc
      .text('Down Payment', 60, y + 7)
      .text(formatAmount(bill.downPayment || bill.down_payment), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' });
    
    y += itemRowHeight;
  }
  
  // If advance payment, show advance amount and balance
  if ((bill.isAdvancePayment || bill.is_advance_payment) && (bill.advanceAmount || bill.advance_amount)) {
    // Draw total row
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    doc
      .font('Helvetica-Bold')
      .text('Total Amount', 60, y + 7)
      .text(formatAmount(bill.totalAmount || bill.total_amount), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' });
    
    doc.font('Helvetica');
    
    y += itemRowHeight;
    
    // Draw advance row
    doc
      .rect(50, y, col1Width, itemRowHeight)
      .stroke()
      .rect(50 + col1Width, y, col2Width, itemRowHeight)
      .stroke();
    
    doc
      .text('Advance Amount', 60, y + 7)
      .text(formatAmount(bill.advanceAmount || bill.advance_amount), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' });
    
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
      .text('Balance', 60, y + 7)
      .text(formatAmount(bill.balanceAmount || bill.balance_amount || 0), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' })
      .font('Helvetica'); // Reset font
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
    .text('Total Amount', 60, y + 7)
    .text(formatAmount(bill.totalAmount || bill.total_amount), 50 + col1Width, y + 7, { width: col2Width - 20, align: 'right' });
    
    doc.font('Helvetica');
  }
  
  // Terms and Conditions
  y += 50;
  doc
    .fillColor('#444444')  // Explicitly set color to match other sections
    .fontSize(12)
    .font('Helvetica-Bold')  // Make the header bold
    .text('Terms and Conditions:', 50, y);
  
  y += 20;
  doc
    .font('Helvetica')  // Reset to regular font
    .fontSize(10);
  
  doc.text('1. All prices are inclusive of taxes.', 50, y);
  y += 15;
  doc.text('2. Warranty is subject to terms and conditions.', 50, y);
  y += 15;
  doc.text('3. This is a computer-generated bill.', 50, y);
  
  // Add additional condition for RMV if applicable
  if ((bill.billType === 'cash' || bill.bill_type === 'cash') && 
      !(bill.isEbicycle || bill.is_ebicycle) && 
      !(bill.isAdvancePayment || bill.is_advance_payment)) {
    y += 15;
    doc.text('4. RMV registration will be completed within 30 days.', 50, y);
  }
  
  // Signature areas
  y += 70;
  doc
    .moveTo(50, y)
    .lineTo(200, y)
    .stroke();
  
  doc
    .moveTo(350, y)
    .lineTo(500, y)
    .stroke();
  
  doc
    .text('Dealer Signature', 70, y + 10)
    .text('Rubber Stamp', 390, y + 10);
};

/**
 * Generate footer section
 */
const generateFooter = (doc: PDFKit.PDFDocument, branding?: any): void => {
  // Thank you line
  doc
    .fillColor('#000000')
    .fontSize(10)
    .text('Thank you for your business!', 50, 700, { align: 'center', width: 500 });

  // Contact/footer info in muted gray beneath
  doc
    .fillColor('#6b7280')
    .fontSize(9)
    .text(branding?.footerNote || '', 50, 716, { align: 'center', width: 500 });

  doc
    .fillColor('#6b7280')
    .fontSize(9)
    .text(branding?.addressLine2 || '', 50, 730, { align: 'center', width: 500 });
};

// Load branding document with safe defaults
const loadBranding = async (): Promise<{
  dealerName: string;
  logoUrl?: string;
  primaryColor?: string;
  addressLine1?: string;
  addressLine2?: string;
  brandPartner?: string;
  footerNote?: string;
}> => {
  try {
    const b = await Branding.findOne();
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
const loadLogoBuffer = async (url?: string): Promise<Buffer | undefined> => {
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
const formatAmount = (value: number | string): string => {
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
const formatDate = (date: string | Date): string => {
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
