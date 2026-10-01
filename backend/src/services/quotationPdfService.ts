import PDFDocument from 'pdfkit';
import Branding from '../models/Branding.js';
import { IQuotation } from '../models/Quotation.js';
import http from 'http';
import https from 'https';
import { getDocumentAttributionHeight, renderDocumentAttribution } from './pdfAttribution.js';
import { formatColomboDate } from '../utils/dateFormat.js';

// Fetch remote logo into a Buffer with size and time safeguards
const loadLogoBuffer = async (url?: string): Promise<Buffer | undefined> => {
  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return undefined;
  const MAX_LOGO_BYTES = 1 * 1024 * 1024; // 1MB cap
  const REQUEST_TIMEOUT_MS = 5000; // 5s timeout

  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https://') ? https : http;
      const req = client.get(url, (res) => {
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
          const userId = quotation.owner;
          let b = await Branding.findOne({ userId }).lean();
          
          if (!b) {
            b = await Branding.findOne({ userId: null }).lean();
          }

          return {
            dealerName: b?.dealerName || 'TMR Trading Lanka',
            brandPartner: b?.brandPartner || 'TMR Trading Lanka (Pvt) Ltd',
            primaryColor: b?.primaryColor || '#1e90ff',
            addressLine1: b?.addressLine1 || '',
            addressLine2: b?.addressLine2 || '',
            footerNote: b?.footerNote || '',
            logoUrl: b?.logoUrl
          };
        } catch {
          return {
            dealerName: 'TMR Trading Lanka',
            brandPartner: 'TMR Trading Lanka (Pvt) Ltd',
            primaryColor: '#1e90ff',
            addressLine1: '',
            addressLine2: '',
            footerNote: '',
            logoUrl: undefined
          };
        }
      };

      (async () => {
        const branding = await loadBranding();

        // Company header with optional logo
        const topY = 40;
        const leftX = 50;
        const logoBuffer = await loadLogoBuffer((branding as any).logoUrl);
        const logoWidth = 60;
        const logoHeight = 24;
        let titleX = leftX;
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, leftX, topY, { height: logoHeight });
            titleX = leftX + logoWidth + 15;
          } catch {}
        }

        doc.fontSize(20)
          .font('Helvetica-Bold')
          .fillColor(branding.primaryColor)
          .text(branding.brandPartner, titleX, topY);

        const addressLine1 = branding.addressLine1 || '';
        const dealerHeader = `Authorized Dealer: ${branding.dealerName}${addressLine1 ? ` - ${addressLine1}` : ''}`;

        doc.fontSize(12)
          .font('Helvetica')
          .fillColor('#000000')
          .text(dealerHeader, titleX, topY + 26);

        const footerNote = (branding as any).footerNote || '';
        if (footerNote) {
          doc.text(footerNote, titleX, topY + 44);
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
          .text(`Date: ${formatColomboDate(quotation.quotationDate)}`, 50, 185);

        if (quotation.validUntil && quotation.type === 'quotation') {
          doc.text(`Valid Until: ${formatColomboDate(quotation.validUntil)}`, 50, 200);
        }

        // Customer details with proper text wrapping
        doc.fontSize(14)
          .font('Helvetica-Bold')
          .text('Customer Details:', 50, 230);

        let yPos = 250;
        const lineHeight = 15;
        const labelWidth = 150;
        const contentStartX = 50 + labelWidth + 10;
        const contentWidth = 550 - contentStartX;
        const sectionSpacing = 5; // Consistent spacing between fields

        // ------------------------------------------------------------------
        // Pagination engine
        //
        // 1. Text is measured with PDFKit (heightOfString) using the exact
        //    font/size/width/alignment the renderer passes to text(), so a fit
        //    decision can never disagree with what gets drawn. No character
        //    counting, no magic constants.
        // 2. Each block lays itself out through one pure function used by both
        //    the fit check and the renderer.
        // 3. A block moves as a whole; related lines are never split.
        // 4. Body content stays above the faded attribution strip, which is
        //    anchored to the bottom of the final page.
        // ------------------------------------------------------------------
        const attributionWidth = 500;
        const attributionHeight = getDocumentAttributionHeight(doc, attributionWidth);
        const attributionGap = 6;

        const contentBottomY = (): number =>
          doc.page.height - doc.page.margins.bottom - attributionHeight - attributionGap;

        const measureText = (
          text: string,
          size: number,
          opts: { font?: string; width?: number; align?: 'left' | 'center' | 'right' } = {}
        ): number =>
          doc
            .font(opts.font ?? 'Helvetica')
            .fontSize(size)
            .heightOfString(text, { width: opts.width, align: opts.align ?? 'left' });

        const ensureSpace = (spaceNeeded: number, onNewPage?: () => void): void => {
          if (yPos + spaceNeeded > contentBottomY()) {
            doc.addPage();
            yPos = doc.page.margins.top;
            if (onNewPage) onNewPage();
          }
        };

        doc.fontSize(12).font('Helvetica');
      
        // Customer name/address: measured and drawn with the same width so the
        // advance below always matches the rendered block.
        doc.text('Name:', 50, yPos, { width: labelWidth });
        const nameHeight = measureText(quotation.customerName, 12, { width: contentWidth });
        doc.text(quotation.customerName, contentStartX, yPos, { width: contentWidth });
        yPos += Math.max(nameHeight, lineHeight) + sectionSpacing;

        doc.text('Address:', 50, yPos, { width: labelWidth });
        const addressHeight = measureText(quotation.customerAddress, 12, { width: contentWidth });
        doc.text(quotation.customerAddress, contentStartX, yPos, { width: contentWidth });
        yPos += Math.max(addressHeight, lineHeight) + sectionSpacing;

        if (quotation.customerNIC) {
          doc.text('NIC:', 50, yPos, { width: labelWidth });
          doc.text(quotation.customerNIC, contentStartX, yPos);
          yPos += lineHeight + sectionSpacing;
        }

        if (quotation.customerPhone) {
          doc.text('Phone:', 50, yPos, { width: labelWidth });
          doc.text(quotation.customerPhone, contentStartX, yPos);
          yPos += lineHeight + sectionSpacing;
        }

        if (quotation.bikeRegNo) {
          doc.text('Bike Registration No:', 50, yPos, { width: labelWidth });
          doc.text(quotation.bikeRegNo, contentStartX, yPos);
          yPos += lineHeight + sectionSpacing;
        }

        // Insurance details (if available)
        const insurance = (quotation as any).insuranceDetails?.companyName ?? (quotation as any).insuranceDetails;
        if (insurance) {
          doc.text('Insurance:', 50, yPos, { width: labelWidth });
          doc.text(String(insurance), contentStartX, yPos);
          yPos += lineHeight + (sectionSpacing * 2); // Double spacing before items section
        }

        // Pure layout for the items column header: shared by the fit check and
        // the renderer so the header can never be taller than reserved.
        const itemsHeaderLayout = (top: number) => {
          const headingY = top;
          const headingHeight = measureText('Items:', 14, { font: 'Helvetica-Bold' });
          const labelsY = headingY + headingHeight + 10;
          const labelsHeight = measureText('Description', 12, { font: 'Helvetica-Bold' });
          const unitRowHeight = 15 + measureText('(LKR)', 10);
          const labelsBottom = labelsY + Math.max(labelsHeight, unitRowHeight);
          const ruleY = Math.max(labelsY + sectionSpacing * 7, labelsBottom + 5);
          return { headingY, labelsY, ruleY, height: ruleY + 10 - top };
        };

        // Items table with improved alignment
        yPos += (sectionSpacing * 4); // Consistent spacing before table
        ensureSpace(itemsHeaderLayout(yPos).height);

        // Define column positions and widths
        const columns = {
          description: { x: 50, width: 280 },
          qty: { x: 340, width: 40 },
          rate: { x: 390, width: 70 },
          amount: { x: 470, width: 80 }
        };

        const drawItemsHeader = () => {
          const layout = itemsHeaderLayout(yPos);

          doc.fontSize(14)
            .font('Helvetica-Bold')
            .text('Items:', 50, layout.headingY);

          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Description', columns.description.x, layout.labelsY)
            .text('Qty', columns.qty.x, layout.labelsY, { align: 'center', width: columns.qty.width })
            .text('Rate', columns.rate.x, layout.labelsY, { align: 'right', width: columns.rate.width })
            .text('Amount', columns.amount.x, layout.labelsY, { align: 'right', width: columns.amount.width });

          doc.fontSize(10)
            .font('Helvetica')
            .text('(LKR)', columns.rate.x, layout.labelsY + 15, { align: 'right', width: columns.rate.width })
            .text('(LKR)', columns.amount.x, layout.labelsY + 15, { align: 'right', width: columns.amount.width });

          doc.moveTo(50, layout.ruleY)
            .lineTo(550, layout.ruleY)
            .stroke();

          yPos = layout.ruleY + 10;
        };

        drawItemsHeader();

        // Add items. Row height comes from PDFKit's own measurement of the
        // description at the column width, which is also the width it draws
        // with, so a row can never be shorter than what it renders.
        quotation.items.forEach((item) => {
          const descriptionHeight = measureText(item.description, 10, {
            width: columns.description.width
          });
          const itemHeight = Math.max(descriptionHeight, 20);

          ensureSpace(itemHeight + sectionSpacing, drawItemsHeader);

          const startY = yPos;

          doc.fontSize(10).font('Helvetica');
          doc.text(item.description, columns.description.x, startY, {
            width: columns.description.width
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

        // Compute subtotal from items
        const subtotal = quotation.items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

        const subtotalText = `Subtotal: LKR ${subtotal.toFixed(2)}`;
        const totalText = `Total Amount: LKR ${quotation.totalAmount.toFixed(2)}`;
        const discountLabel = quotation.discountAmount > 0
          ? (quotation.discountType === 'percentage'
            ? `Discount (${quotation.discountValue}%):`
            : 'Discount:')
          : '';
        const discountText = discountLabel
          ? `${discountLabel} -LKR ${quotation.discountAmount.toFixed(2)}`
          : '';
        const discountNoteText = discountText && quotation.discountNote
          ? String(quotation.discountNote)
          : '';

        // Totals: laid out as one block so a break can never strand a subtotal
        // without its total.
        const totalsLayout = (top: number) => {
          let y = top + (sectionSpacing * 2);
          const rule1Y = y;

          y += (sectionSpacing * 3);
          const subtotalY = y;
          const subtotalHeight = measureText(subtotalText, 10, { width: 200, align: 'right' });
          y = subtotalY + Math.max(subtotalHeight, sectionSpacing * 3);

          let discountY = 0;
          let discountNoteY = 0;
          if (discountText) {
            y += (sectionSpacing * 3);
            discountY = y;
            const discountHeight = measureText(discountText, 10, { width: 200, align: 'right' });
            y = discountY + Math.max(discountHeight, sectionSpacing * 3);

            if (discountNoteText) {
              y += 14;
              discountNoteY = y;
              y += measureText(discountNoteText, 8, { width: 500 });
            }
          }

          y += (sectionSpacing * 3);
          const rule2Y = y;
          y += (sectionSpacing * 2);
          const totalY = y;
          const totalHeight = measureText(totalText, 12, {
            font: 'Helvetica-Bold',
            width: 200,
            align: 'right'
          });

          return {
            rule1Y,
            subtotalY,
            discountY,
            discountNoteY,
            rule2Y,
            totalY,
            height: totalY + totalHeight - top
          };
        };

        ensureSpace(totalsLayout(yPos).height);
        const totals = totalsLayout(yPos);

        doc.moveTo(350, totals.rule1Y)
          .lineTo(550, totals.rule1Y)
          .stroke();

        doc.fontSize(10)
          .font('Helvetica')
          .text(subtotalText, 350, totals.subtotalY, { align: 'right', width: 200 });

        if (discountText) {
          doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#cc0000')
            .text(discountText, 350, totals.discountY, { align: 'right', width: 200 });

          if (discountNoteText) {
            doc.fontSize(8)
              .font('Helvetica')
              .text(discountNoteText, 50, totals.discountNoteY, { width: 500 });
          }

          doc.fillColor('#000000');
        }

        doc.moveTo(350, totals.rule2Y)
          .lineTo(550, totals.rule2Y)
          .stroke();

        doc.fontSize(12)
          .font('Helvetica-Bold')
          .text(totalText, 350, totals.totalY, { align: 'right', width: 200 });

        yPos += totals.height;

        // Remarks: heading and body move together. The three gaps reproduce the
        // production spacing (26pt after the total line, 6pt under the heading,
        // 20pt of air before the closing group) but are applied below measured
        // text bottoms, so a taller line can never make them overlap.
        if (quotation.remarks) {
          const remarksLayout = (top: number) => {
            const headingY = top + 26;
            const headingHeight = measureText('Remarks:', 12, { font: 'Helvetica-Bold' });
            const bodyY = headingY + headingHeight + 6;
            const bodyHeight = measureText(quotation.remarks, 10, { width: 500 });
            return { headingY, bodyY, height: bodyY + bodyHeight + 20 - top };
          };

          ensureSpace(remarksLayout(yPos).height);
          const remarks = remarksLayout(yPos);

          doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Remarks:', 50, remarks.headingY);

          doc.fontSize(10)
            .font('Helvetica')
            .text(quotation.remarks, 50, remarks.bodyY, { width: 500 });

          yPos += remarks.height;
        }

        // Closing group: thank-you lines, signature and stamp are one block,
        // reserved against the space above the attribution strip rather than a
        // guessed constant.
        const closingLayout = (top: number) => {
          const thankYouY = top + (sectionSpacing * 8);
          const thankYouHeight = measureText('Thank you for your business!', 10, { width: 500 });
          const computerY = thankYouY + Math.max(thankYouHeight, sectionSpacing * 3);
          const computerHeight = measureText('This is a computer-generated document.', 10, { width: 500 });
          const stampY = top + (sectionSpacing * 6);
          const stampHeight = measureText('Company Stamp', 8, { width: 200 });
          const bottom = Math.max(computerY + computerHeight, stampY + stampHeight);

          return {
            thankYouY,
            computerY,
            signatureY: top,
            stampY,
            height: bottom - top
          };
        };

        ensureSpace(closingLayout(yPos).height);
        const closing = closingLayout(yPos);

        doc.fontSize(10)
          .font('Helvetica')
          .text('Thank you for your business!', 50, closing.thankYouY)
          .text('This is a computer-generated document.', 50, closing.computerY);

        renderDocumentAttribution(doc, {
          left: 50,
          width: attributionWidth
        });

        // Company stamp area
        doc.fillColor('#000000')
          .fontSize(8)
          .font('Helvetica')
          .text('Authorized Signature: ___________________', 350, closing.signatureY)
          .text('Company Stamp', 350, closing.stampY);

        // Finalize the PDF
        doc.end();
      })();

    } catch (error) {
      reject(error);
    }
  });
};
