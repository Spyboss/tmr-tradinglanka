import PDFDocument from 'pdfkit';
import Branding from '../models/Branding.js';
import { IQuotation } from '../models/Quotation.js';

/**
 * Utility function to wrap text properly within specified width
 */
const wrapText = (text: string, maxWidth: number, fontSize: number = 10): string[] => {
  if (!text) return [''];
  
  // Handle manual line breaks (\n) first
  const manualLines = text.split('\n');
  const wrappedLines: string[] = [];
  
  manualLines.forEach(line => {
    if (!line.trim()) {
      wrappedLines.push('');
      return;
    }
    
    const words = line.split(' ');
    let currentLine = '';
    
    // Approximate character limit based on font size and width
    const charLimit = Math.floor(maxWidth / (fontSize * 0.6));
    
    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= charLimit) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
        currentLine = word;
      }
    });
    
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  });
  
  return wrappedLines.length > 0 ? wrappedLines : [''];
};

/**
 * Generate a PDF for a quotation or invoice
 * @param quotation The quotation object
 * @returns Promise with PDF buffer
 */
export const generateQuotationPDF = async (quotation: IQuotation): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });

      // Set up streams to capture PDF data
      const buffers: Buffer[] = [];

      // Handle document stream events
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Branding-aware content generation
      const loadBranding = async () => {
        try {
          const b = await Branding.findOne({}).lean();
          return {
            dealerName: b?.dealerName || 'TMR Trading Lanka',
            brandPartner: b?.brandPartner || 'TMR Trading Lanka (Pvt) Ltd',
            primaryColor: b?.primaryColor || '#1e90ff',
            addressLine1: b?.addressLine1 || '',
            addressLine2: b?.addressLine2 || '',
            footerNote: b?.footerNote || ''
          };
        } catch {
          return {
            dealerName: 'TMR Trading Lanka',
            brandPartner: 'TMR Trading Lanka (Pvt) Ltd',
            primaryColor: '#1e90ff',
            addressLine1: '',
            addressLine2: '',
            footerNote: ''
          };
        }
      };

      (async () => {
        const branding = await loadBranding();

        // Company header
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .fillColor(branding.primaryColor)
           .text(branding.brandPartner, 50, 50);

        const addressLine1 = branding.addressLine1 || '';
        const dealerHeader = `Authorized Dealer: ${branding.dealerName}${addressLine1 ? ` - ${addressLine1}` : ''}`;

        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#000000')
           .text(dealerHeader, 50, 75);

        const footerNote = (branding as any).footerNote || '';
        if (footerNote) {
          doc.text(footerNote, 50, 90);
        }

        // Document title
        const title = quotation.type === 'invoice' ? 'INVOICE' : 'QUOTATION';
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .text(title, 50, 130);

        // Document details
        doc.fontSize(12)
           .font('Helvetica')
           .text(`${title} No: ${quotation.quotationNumber}`, 50, 170)
           .text(`Date: ${quotation.quotationDate.toLocaleDateString()}`, 50, 185);

        if (quotation.validUntil && quotation.type === 'quotation') {
          doc.text(`Valid Until: ${quotation.validUntil.toLocaleDateString()}`, 50, 200);
        }

      // Customer details with proper text wrapping
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Customer Details:', 50, 230);

      let yPos = 250;
      const lineHeight = 15;
      const labelWidth = 100;
      const contentWidth = 400;
      const sectionSpacing = 5; // Consistent spacing between fields
      
      doc.fontSize(12).font('Helvetica');
      
      // Customer Name with text wrapping
      doc.text('Name:', 50, yPos);
      const nameLines = wrapText(quotation.customerName, contentWidth, 12);
      nameLines.forEach((line, index) => {
        doc.text(line, 150, yPos + (index * lineHeight));
      });
      yPos += Math.max(nameLines.length * lineHeight, lineHeight) + sectionSpacing;
      
      // Address with text wrapping
      doc.text('Address:', 50, yPos);
      const addressLines = wrapText(quotation.customerAddress, contentWidth, 12);
      addressLines.forEach((line, index) => {
        doc.text(line, 150, yPos + (index * lineHeight));
      });
      yPos += Math.max(addressLines.length * lineHeight, lineHeight) + sectionSpacing;

      if (quotation.customerNIC) {
        doc.text('NIC:', 50, yPos)
           .text(quotation.customerNIC, 150, yPos);
        yPos += lineHeight + sectionSpacing;
      }

      if (quotation.customerPhone) {
        doc.text('Phone:', 50, yPos)
           .text(quotation.customerPhone, 150, yPos);
        yPos += lineHeight + sectionSpacing;
      }

      if (quotation.bikeRegNo) {
        doc.text('Bike Registration No:', 50, yPos)
           .text(quotation.bikeRegNo, 150, yPos);
        yPos += lineHeight + sectionSpacing;
      }

      // Insurance details (if available)
      const insurance = (quotation as any).insuranceDetails?.companyName ?? (quotation as any).insuranceDetails;
      if (insurance) {
        doc.text('Insurance:', 50, yPos)
           .text(String(insurance), 150, yPos);
        yPos += lineHeight + (sectionSpacing * 2); // Double spacing before items section
      }

      // Items table with improved alignment
      yPos += (sectionSpacing * 4); // Consistent spacing before table
      
      // Check if we need a new page
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }

      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Items:', 50, yPos);

      yPos += 30;

      // Define column positions and widths
      const columns = {
        description: { x: 50, width: 280 },
        qty: { x: 340, width: 40 },
        rate: { x: 390, width: 70 },
        amount: { x: 470, width: 80 }
      };

      // Table headers with better alignment
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('Description', columns.description.x, yPos)
         .text('Qty', columns.qty.x, yPos, { align: 'center', width: columns.qty.width })
         .text('Rate', columns.rate.x, yPos, { align: 'right', width: columns.rate.width })
         .text('Amount', columns.amount.x, yPos, { align: 'right', width: columns.amount.width });

      // Add (LKR) labels
      doc.fontSize(10)
         .font('Helvetica')
         .text('(LKR)', columns.rate.x, yPos + 15, { align: 'right', width: columns.rate.width })
         .text('(LKR)', columns.amount.x, yPos + 15, { align: 'right', width: columns.amount.width });

      yPos += (sectionSpacing * 7); // Consistent header spacing

      // Draw line under headers
      doc.moveTo(50, yPos)
         .lineTo(550, yPos)
         .stroke();

      yPos += 10;

      // Add items with proper text wrapping
      quotation.items.forEach((item) => {
        // Check if we need a new page
        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }

        const startY = yPos;
        
        // Description with text wrapping
        const descriptionLines = wrapText(item.description, columns.description.width, 10);
        const itemHeight = Math.max(descriptionLines.length * 12, 20);
        
        doc.fontSize(10).font('Helvetica');
        
        // Draw description with multiple lines
        descriptionLines.forEach((line, index) => {
          doc.text(line, columns.description.x, startY + (index * 12));
        });
        
        // Align other columns to the middle of the item height
        const middleY = startY + (itemHeight / 2) - 6;
        
        doc.text(item.quantity.toString(), columns.qty.x, middleY, { 
          align: 'center', 
          width: columns.qty.width 
        })
        .text(item.rate.toFixed(2), columns.rate.x, middleY, { 
          align: 'right', 
          width: columns.rate.width 
        })
        .text(item.amount.toFixed(2), columns.amount.x, middleY, { 
          align: 'right', 
          width: columns.amount.width 
        });

        yPos += itemHeight + sectionSpacing;
      });

      // Draw line before total
      yPos += (sectionSpacing * 2);
      doc.moveTo(350, yPos)
         .lineTo(550, yPos)
         .stroke();

      // Total
      yPos += (sectionSpacing * 3);
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(`Total Amount: LKR ${quotation.totalAmount.toFixed(2)}`, 350, yPos, { align: 'right', width: 200 });

      // Remarks with text wrapping
      if (quotation.remarks) {
        yPos += (sectionSpacing * 8); // Consistent spacing before remarks
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Remarks:', 50, yPos);

        yPos += (sectionSpacing * 4); // Consistent spacing after remarks header
        const remarksLines = wrapText(quotation.remarks, 500, 10);
        doc.fontSize(10).font('Helvetica');
        remarksLines.forEach((line, index) => {
          doc.text(line, 50, yPos + (index * 12));
        });
        yPos += remarksLines.length * 12 + (sectionSpacing * 4);
      }

      // Footer with consistent spacing
      yPos = Math.max(yPos + (sectionSpacing * 8), doc.page.height - 100); // Ensure minimum footer position
      doc.fontSize(10)
         .font('Helvetica')
         .text('Thank you for your business!', 50, yPos)
         .text('This is a computer-generated document.', 50, yPos + (sectionSpacing * 3));

      // Company stamp area
      doc.fontSize(8)
         .text('Authorized Signature: ___________________', 350, yPos)
         .text('Company Stamp', 350, yPos + (sectionSpacing * 6));

        // Finalize the PDF
        doc.end();
      })();

    } catch (error) {
      reject(error);
    }
  });
};
