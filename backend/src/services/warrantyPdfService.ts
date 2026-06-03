import PDFDocument from 'pdfkit';
import Branding from '../models/Branding.js';
import https from 'https';
import http from 'http';
import { renderDocumentAttribution } from './pdfAttribution.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const loadBranding = async (userId?: any) => {
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
        const ct = (res.headers['content-type'] || '').toLowerCase();
        const isImage = ct.startsWith('image/');
        if (!statusOk || !isImage) {
          try { res.destroy(); } catch { /* ignore */ }
          resolve(undefined);
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (c) => {
          const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
          total += buf.length;
          if (total > MAX_LOGO_BYTES) {
            try { res.destroy(); } catch { /* ignore */ }
            resolve(undefined);
            return;
          }
          chunks.push(buf);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', () => resolve(undefined));
      });

      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        try { req.destroy(); } catch { /* ignore */ }
        resolve(undefined);
      });
      req.on('error', () => resolve(undefined));
    } catch {
      resolve(undefined);
    }
  });
};

export const generateWarrantyPDF = async (claim: any): Promise<Buffer> => {
  const branding = await loadBranding(claim?.owner);
  const logoBuffer = await loadLogoBuffer(branding.logoUrl);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Font registration with Sinhala fallback
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const FONT_DEV = path.resolve(__dirname, '../../assets/fonts');
      const FONT_PROD = path.resolve(__dirname, '../assets/fonts');
      const FONT_DIR = fs.existsSync(FONT_DEV) ? FONT_DEV : FONT_PROD;

      let hasSinhalaFont = false;
      const regularFontPath = path.join(FONT_DIR, 'NotoSansSinhala-Regular.ttf');
      const boldFontPath = path.join(FONT_DIR, 'NotoSansSinhala-Bold.ttf');
      if (fs.existsSync(regularFontPath) && fs.existsSync(boldFontPath)) {
        doc.registerFont('NotoSansSinhala', regularFontPath);
        doc.registerFont('NotoSansSinhala-Bold', boldFontPath);
        hasSinhalaFont = true;
      }

      const useFont = (isBold = false) => {
        if (hasSinhalaFont) return isBold ? 'NotoSansSinhala-Bold' : 'NotoSansSinhala';
        return isBold ? 'Helvetica-Bold' : 'Helvetica';
      };

      const startX = 40;
      const endX = 555;
      const contentWidth = endX - startX;

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, startX, 40, { width: 120 });
        } catch {
          // Continue without logo
        }
      }

      doc.font('Helvetica-Bold').fontSize(9).text('TMR TRADING LANKA', 280, 40, { align: 'right', width: 275 });
      doc.font('Helvetica').fontSize(7.5);
      let headerY = 52;
      doc.text('Office Address : No.141/E, Megoda Thammita, Makewita', 280, headerY, { align: 'right', width: 275 });
      headerY += 10;
      doc.text('Showroom Address : No.145/2/A, Kandy Road, Yakkala', 280, headerY, { align: 'right', width: 275 });
      headerY += 10;
      doc.text('Dealer department : 033 2 321 887', 280, headerY, { align: 'right', width: 275 });
      headerY += 10;
      doc.text('Email : finance.tmrtradinglanka@gmail.com', 280, headerY, { align: 'right', width: 275 });
      headerY += 10;
      doc.text('Mobile : + 94 777 585 986', 280, headerY, { align: 'right', width: 275 });
      headerY += 10;
      if (claim.formNumber) {
        doc.fillColor('red')
          .font('Helvetica-Bold')
          .fontSize(13)
          .text(String(claim.formNumber), 280, headerY, { align: 'right', width: 275 });
        doc.fillColor('black');
      }

      if (claim.serialNumber) {
        doc.fillColor('red')
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(String(claim.serialNumber), 510, 100, { width: 45, align: 'right' });
        doc.fillColor('black');
      }

      doc.font('Helvetica-Bold').fontSize(12).text('SERVICE POINT WARRANTY CLAIM FORM', startX, 125, { align: 'center', width: contentWidth });
      doc.font(useFont(false)).fontSize(10).text('සේවා වගකීම් සම්බන්ධ පෝරමය', startX, 140, { align: 'center', width: contentWidth });

      const drawLabel = (eng: string, sin: string, x: number, y: number, w?: number) => {
        doc.font('Helvetica-Bold').fontSize(7.5).text(eng, x, y, w ? { width: w } : undefined);
        doc.font(useFont(false)).fontSize(7).text(sin, x, y + 9, w ? { width: w } : undefined);
      };

      const printValue = (text: string, x: number, y: number, w?: number, h?: number) => {
        if (text) {
          doc.font(useFont(false)).fontSize(8).text(String(text), x, y, { width: w, height: h });
        }
      };

      const formatDate = (d: any): string => {
        if (!d) return '';
        const date = new Date(d);
        if (isNaN(date.getTime())) return String(d);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };

      const grid1Y = 160;
      const rowH1 = 28;

      doc.lineWidth(0.7).rect(startX, grid1Y, contentWidth, rowH1 * 5).stroke();
      for (let i = 1; i < 5; i++) {
        doc.moveTo(startX, grid1Y + (rowH1 * i)).lineTo(endX, grid1Y + (rowH1 * i)).stroke();
      }

      const colX_MidLeft = startX + 220;
      const colX_RightSide = startX + 340;
      const nameRightX = startX + 295;
      const valLine1 = startX + 130;
      const valLine4 = colX_RightSide + 105;

      doc.moveTo(colX_RightSide, grid1Y).lineTo(colX_RightSide, grid1Y + (rowH1 * 5)).stroke();
      doc.moveTo(nameRightX, grid1Y).lineTo(nameRightX, grid1Y + rowH1).stroke();
      doc.moveTo(colX_MidLeft, grid1Y + (rowH1 * 3)).lineTo(colX_MidLeft, grid1Y + (rowH1 * 4)).stroke();
      doc.moveTo(valLine1, grid1Y).lineTo(valLine1, grid1Y + (rowH1 * 5)).stroke();
      doc.moveTo(valLine4, grid1Y).lineTo(valLine4, grid1Y + (rowH1 * 5)).stroke();

      const labelW1 = valLine1 - (startX + 5);
      const labelW2 = 80;
      const labelW3 = 100;

      drawLabel('Customer\'s Name', 'පාරිභෝගිකයාගේ නම', startX + 5, grid1Y + 4, labelW1);
      drawLabel('Tel', 'දු.අංකය', nameRightX + 5, grid1Y + 4, labelW2);
      drawLabel('Date of Sale', 'විකුණූ කල දිනය', colX_RightSide + 5, grid1Y + 4, labelW3);

      drawLabel('Address', 'ලිපිනය', startX + 5, grid1Y + rowH1 + 4, labelW1);
      drawLabel('Oddmeter (km)', 'ධාවනය කල දුර', colX_RightSide + 5, grid1Y + rowH1 + 4, labelW3);

      drawLabel('Chassis No', 'චැසි නොම්බරය', startX + 5, grid1Y + (rowH1 * 2) + 4, labelW1);
      drawLabel('Date of Complaint', 'පැමිණිලි කල දිනය', colX_RightSide + 5, grid1Y + (rowH1 * 2) + 4, labelW3);

      drawLabel('Register No', 'ලියාපදිංචි අංකය', startX + 5, grid1Y + (rowH1 * 3) + 4, labelW1);
      drawLabel('Modle', 'වර්ගය', colX_MidLeft + 5, grid1Y + (rowH1 * 3) + 4, labelW2);
      drawLabel('Date of repair', 'අලුත්වැඩියා කල දිනය', colX_RightSide + 5, grid1Y + (rowH1 * 3) + 4, labelW3);

      drawLabel('Motor Number', 'මෝටර් නොම්බරය', startX + 5, grid1Y + (rowH1 * 4) + 4, labelW1);
      drawLabel('Color', 'පාට', colX_RightSide + 5, grid1Y + (rowH1 * 4) + 4, labelW3);

      const valLine2 = colX_MidLeft;
      const valLine3 = colX_RightSide;
      const pad = 4;

      const rowY = (r: number) => grid1Y + (rowH1 * r) + 4;

      printValue(claim.customerName, valLine1 + pad, rowY(0), nameRightX - valLine1 - pad, rowH1 - 6);
      printValue(claim.customerPhone, nameRightX + 15, rowY(0), valLine3 - nameRightX - 15);
      printValue(formatDate(claim.dateOfSale), valLine4 + pad, rowY(0), endX - valLine4 - pad);

      printValue(claim.customerAddress, valLine1 + pad, rowY(1), valLine3 - valLine1 - pad, rowH1 - 6);
      printValue(claim.odometerReading, valLine4 + pad, rowY(1), endX - valLine4 - pad);

      printValue(claim.chassisNumber, valLine1 + pad, rowY(2), valLine3 - valLine1 - pad);
      printValue(formatDate(claim.dateOfComplaint), valLine4 + pad, rowY(2), endX - valLine4 - pad);

      printValue(claim.registerNo, valLine1 + pad, rowY(3), valLine2 - valLine1 - pad);
      printValue(claim.bikeModel, valLine2 + 35, rowY(3), valLine3 - valLine2 - 35);
      printValue(formatDate(claim.dateOfRepair), valLine4 + pad, rowY(3), endX - valLine4 - pad);

      printValue(claim.motorNumber, valLine1 + pad, rowY(4), valLine3 - valLine1 - pad);
      printValue(claim.color, valLine4 + pad, rowY(4), endX - valLine4 - pad);

      const grid2Y = grid1Y + (rowH1 * 5) + 12;
      const rowH2 = 36;

      doc.rect(startX, grid2Y, contentWidth, rowH2 * 4).stroke();
      for (let i = 1; i < 4; i++) {
        doc.moveTo(startX, grid2Y + (rowH2 * i)).lineTo(endX, grid2Y + (rowH2 * i)).stroke();
      }
      doc.moveTo(startX + 180, grid2Y).lineTo(startX + 180, grid2Y + (rowH2 * 4)).stroke();

      const labelW4 = 175;
      drawLabel('Defect reported by customer', 'පාරිභෝගිකයාගේ පැමිණිලි වාර්තාව', startX + 5, grid2Y + 4, labelW4);
      drawLabel('Probale cause', 'නියතයෙන්ම සිදුවී තිබූ දේ', startX + 5, grid2Y + rowH2 + 4, labelW4);
      drawLabel('Action taken', 'මේ සඳහා ගනු ලැබූ පියවර', startX + 5, grid2Y + (rowH2 * 2) + 4, labelW4);
      drawLabel('Suggestion', 'අදහස', startX + 5, grid2Y + (rowH2 * 3) + 4, labelW4);

      const valG2Y1 = grid2Y + 4;
      const valG2Y2 = grid2Y + rowH2 + 4;
      const valG2Y3 = grid2Y + (rowH2 * 2) + 4;
      const valG2Y4 = grid2Y + (rowH2 * 3) + 4;
      const valG2X = startX + 185;

      printValue(claim.defectReported, valG2X, valG2Y1, contentWidth - 190);
      printValue(claim.probableCause, valG2X, valG2Y2, contentWidth - 190);
      printValue(claim.actionTaken, valG2X, valG2Y3, contentWidth - 190);
      printValue(claim.suggestion, valG2X, valG2Y4, contentWidth - 190);

      const grid3Y = grid2Y + (rowH2 * 4) + 12;
      const headerH3 = 24;
      const itemRowH = 22;
      const totalTableH = headerH3 + (itemRowH * 4);

      doc.rect(startX, grid3Y, contentWidth, totalTableH).stroke();
      doc.moveTo(startX, grid3Y + headerH3).lineTo(endX, grid3Y + headerH3).stroke();
      for (let i = 1; i < 4; i++) {
        doc.moveTo(startX, grid3Y + headerH3 + (itemRowH * i)).lineTo(endX, grid3Y + headerH3 + (itemRowH * i)).stroke();
      }

      const wItem = 55;
      const wPartNo = 80;
      const wDesc = 240;
      const c1 = startX + wItem;
      const c2 = c1 + wPartNo;
      const c3 = c2 + wDesc;

      doc.moveTo(c1, grid3Y).lineTo(c1, grid3Y + totalTableH).stroke();
      doc.moveTo(c2, grid3Y).lineTo(c2, grid3Y + totalTableH).stroke();
      doc.moveTo(c3, grid3Y).lineTo(c3, grid3Y + totalTableH).stroke();

      const printCenteredLabel = (eng: string, sin: string, xStart: number, width: number) => {
        doc.font('Helvetica-Bold').fontSize(7.5).text(eng, xStart, grid3Y + 3, { width, align: 'center' });
        doc.font(useFont(false)).fontSize(7).text(sin, xStart, grid3Y + 12, { width, align: 'center' });
      };

      printCenteredLabel('Item', 'භාණ්ඩය', startX, wItem);
      printCenteredLabel('Part Number', 'භාණ්ඩ අංක', c1, wPartNo);
      printCenteredLabel('Description', 'භාණ්ඩ පිළිබඳ විස්තර', c2, wDesc);
      printCenteredLabel('Remark', 'සටහන', c3, endX - c3);

      if (claim.items && claim.items.length > 0) {
        claim.items.slice(0, 4).forEach((item: any, index: number) => {
          const rowY = grid3Y + headerH3 + (itemRowH * index);
          doc.font(useFont(false)).fontSize(7.5).text(item.item || '', startX + 3, rowY + 4, { width: wItem - 6 });
          doc.font(useFont(false)).fontSize(7.5).text(item.partNumber || '', c1 + 3, rowY + 4, { width: wPartNo - 6 });
          doc.font(useFont(false)).fontSize(7.5).text(item.description || '', c2 + 3, rowY + 4, { width: wDesc - 6 });
          doc.font(useFont(false)).fontSize(7.5).text(item.remark || '', c3 + 3, rowY + 4, { width: (endX - c3) - 6 });
        });
      }

      const grid4Y = grid3Y + totalTableH + 12;
      const box4H = 105;

      doc.rect(startX, grid4Y, contentWidth, box4H).stroke();
      doc.font('Helvetica-Bold').fontSize(8.5).text('Office use only', startX + 6, grid4Y + 6);
      doc.font('Helvetica').fontSize(7.5).text('Comments authorized person of TMR Lanka.', startX + 6, grid4Y + 18);
      doc.font(useFont(false)).fontSize(7).text('සේවා නියෝජිතයාගේ සටහන', startX + 6, grid4Y + 27);
      const dotLineX = startX + 6;
      const dotWidth = contentWidth - 12;
      printValue(claim.officeComments, startX + 6, grid4Y + 36, dotWidth);

      doc.font('Helvetica').fontSize(8);
      doc.text('.'.repeat(145), dotLineX, grid4Y + 52, { width: dotWidth });
      doc.text('.'.repeat(145), dotLineX, grid4Y + 68, { width: dotWidth });

      const sigY = grid4Y + 88;
      doc.text('Approved By ', startX + 6, sigY);
      doc.text('.'.repeat(45), startX + 62, sigY - 2);
      doc.text('Date ', startX + 320, sigY);
      doc.text('.'.repeat(40), startX + 342, sigY - 2);
      printValue(claim.approvedBy, startX + 62, sigY, 250);
      printValue(formatDate(claim.approvalDate), startX + 342, sigY, 200);

      const footerY = grid4Y + box4H + 55;
      doc.moveTo(startX + 10, footerY).lineTo(startX + 130, footerY).stroke();
      doc.moveTo(startX + 210, footerY).lineTo(startX + 300, footerY).stroke();
      doc.moveTo(endX - 120, footerY).lineTo(endX - 10, footerY).stroke();

      doc.font('Helvetica').fontSize(7.5);
      doc.text('Service point stamp signature', startX + 12, footerY + 4);
      doc.text('Date', startX + 245, footerY + 4);
      doc.text('Customer signature', endX - 110, footerY + 4);

      renderDocumentAttribution(doc, {
        left: startX,
        width: contentWidth
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
