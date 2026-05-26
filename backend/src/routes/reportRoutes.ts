import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import { authenticate, AuthRequest } from '../auth/auth.middleware.js';
import Bill from '../models/Bill.js';
import Branding from '../models/Branding.js';
import https from 'https';
import http from 'http';

const router = Router();

const loadLogoBuffer = (url?: string): Promise<Buffer | undefined> => {
  if (!url) return Promise.resolve(undefined);
  const protocol = url.startsWith('https') ? https : http;
  return new Promise((resolve) => {
    protocol.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(undefined));
  });
};

const formatCurrency = (amount: number = 0) =>
  `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d: any) => {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

router.get('/finance-company-sales', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    const { financeCompany, fromDate, toDate, search, page = '1', limit = '50' } = req.query as Record<string, string>;

    const query: any = {};

    if (financeCompany) {
      query['proforma.financeCompanyName'] = { $regex: financeCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    if (fromDate || toDate) {
      query.billDate = {};
      if (fromDate) query.billDate.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    if (!isAdmin && req.user?.id) {
      query.owner = req.user.id;
    }

    if (search) {
      const searchRegex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      query.$or = [
        { billNumber: searchRegex },
        { customerName: searchRegex },
        { chassisNumber: searchRegex },
        { motorNumber: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [bills, total] = await Promise.all([
      Bill.find(query)
        .sort({ billDate: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('owner', 'name email'),
      Bill.countDocuments(query),
    ]);

    res.status(200).json({
      bills,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/finance-company-sales/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await req.app.locals.models?.User.findById(req.user?.id);
    const isAdmin = user?.role === 'admin';

    const { financeCompany, fromDate, toDate } = req.query as Record<string, string>;
    if (!financeCompany) {
      res.status(400).json({ error: 'financeCompany query parameter is required' });
      return;
    }

    const query: any = {
      'proforma.financeCompanyName': { $regex: financeCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
    };

    if (fromDate || toDate) {
      query.billDate = {};
      if (fromDate) query.billDate.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        query.billDate.$lte = end;
      }
    }

    if (!isAdmin && req.user?.id) {
      query.owner = req.user.id;
    }

    const bills = await Bill.find(query).sort({ billDate: 1 });

    const branding = await Branding.findOne().sort({ createdAt: -1 });
    const dealerName = branding?.dealerName || 'TMR TRADING LANKA (Pvt) Ltd';
    const logoBuffer = await loadLogoBuffer(branding?.logoUrl);

    const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="finance-company-sales-${financeCompany.replace(/\s+/g, '-')}.pdf"`);
    doc.pipe(res);

    const leftMargin = 50;
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const usableWidth = pageWidth - leftMargin * 2;

    // Header
    let y = 40;
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, leftMargin, y, { width: 75 });
        doc.fontSize(20).fillColor('#444444').font('Helvetica-Bold')
          .text(dealerName, leftMargin + 85, y, { width: usableWidth - 85 });
        doc.fontSize(11).fillColor('#666666').font('Helvetica')
          .text(`Finance Company Sales Report — ${financeCompany}`, leftMargin + 85, y + 22, { width: usableWidth - 85 });
        doc.fontSize(9).fillColor('#999999')
          .text(`Period: ${fromDate ? formatDate(fromDate) : 'All time'} — ${toDate ? formatDate(toDate) : 'All time'}`, leftMargin + 85, y + 38, { width: usableWidth - 85 });
        y += 60;
      } catch {
        y = 40;
        doc.fontSize(20).fillColor('#444444').font('Helvetica-Bold')
          .text(dealerName, leftMargin, y, { align: 'center', width: usableWidth });
        doc.fontSize(11).fillColor('#666666').font('Helvetica')
          .text(`Finance Company Sales Report — ${financeCompany}`, leftMargin, y + 24, { align: 'center', width: usableWidth });
        doc.fontSize(9).fillColor('#999999')
          .text(`Period: ${fromDate ? formatDate(fromDate) : 'All time'} — ${toDate ? formatDate(toDate) : 'All time'}`, leftMargin, y + 40, { align: 'center', width: usableWidth });
        y += 62;
      }
    } else {
      doc.fontSize(20).fillColor('#444444').font('Helvetica-Bold')
        .text(dealerName, leftMargin, y, { align: 'center', width: usableWidth });
      doc.fontSize(11).fillColor('#666666').font('Helvetica')
        .text(`Finance Company Sales Report — ${financeCompany}`, leftMargin, y + 24, { align: 'center', width: usableWidth });
      doc.fontSize(9).fillColor('#999999')
        .text(`Period: ${fromDate ? formatDate(fromDate) : 'All time'} — ${toDate ? formatDate(toDate) : 'All time'}`, leftMargin, y + 40, { align: 'center', width: usableWidth });
      y += 62;
    }

    doc.y = y;

    // Summary bar
    const totalAmount = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const withProforma = bills.filter(b => b.proforma?.financeCompanyName).length;

    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + usableWidth, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown();

    const summaryY = doc.y;
    doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold');
    doc.text(`Total Sales: ${bills.length}`, leftMargin, summaryY, { width: usableWidth * 0.3 });
    doc.text(`Total Amount: ${formatCurrency(totalAmount)}`, leftMargin + usableWidth * 0.33, summaryY, { width: usableWidth * 0.34 });
    doc.text(`With Proforma: ${withProforma} of ${bills.length}`, leftMargin + usableWidth * 0.7, summaryY, { width: usableWidth * 0.3 });
    doc.moveDown();
    doc.moveTo(leftMargin, doc.y).lineTo(leftMargin + usableWidth, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown();

    // Table dimensions — landscape columns for readability
    const colWidths = [
      26,      // #
      100,     // Bill No
      70,      // Date
      130,     // Customer
      110,     // Chassis No
      105,     // Motor No
      75,      // Model
      65,      // Amount
    ];
    const totalColWidth = colWidths.reduce((a, b) => a + b);
    const tableStartX = leftMargin + Math.floor((usableWidth - totalColWidth) / 2);
    const rowHeight = 20;
    const headerHeight = 22;
    const headerFontSize = 9;
    const bodyFontSize = 9;
    const amountFontSize = 10;

    const headers = ['#', 'Bill No', 'Date', 'Customer', 'Chassis No', 'Motor No', 'Model', 'Amount'];

    // Table header
    const tableTop = doc.y;
    y = tableTop;

    doc.font('Helvetica-Bold').fontSize(headerFontSize);
    headers.forEach((h, i) => {
      const x = tableStartX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.fillColor('#444444').rect(x, y, colWidths[i], headerHeight).fill();
      doc.fillColor('#ffffff').text(h, x + 4, y + 6, {
        width: colWidths[i] - 8,
        align: i === colWidths.length - 1 ? 'right' : 'left',
      });
    });

    // Table rows — dynamic row height to fit wrapped text
    y = tableTop + headerHeight;
    doc.fillColor('#333333');

    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];
      const row = [
        String(i + 1),
        bill.billNumber || '',
        formatDate(bill.billDate),
        bill.customerName || '',
        bill.chassisNumber || '',
        bill.motorNumber || '',
        bill.bikeModel || '',
        formatCurrency(bill.totalAmount),
      ];

      // Measure every cell height for this row
      let rowH = rowHeight;
      row.forEach((val, j) => {
        const fs = j === colWidths.length - 1 ? amountFontSize : bodyFontSize;
        const fn = j === 1 || j === colWidths.length - 1 ? 'Helvetica-Bold' : 'Helvetica';
        const h = doc.font(fn).fontSize(fs).heightOfString(val, {
          width: colWidths[j] - 8,
        });
        const cellH = h + 10;
        if (cellH > rowH) rowH = cellH;
      });

      // Check page break before drawing
      if (y + rowH > pageHeight - 100) {
        doc.addPage();
        y = 50;
      }

      // Background
      if (i % 2 === 0) {
        doc.fillColor('#f9fafb').rect(tableStartX, y, totalColWidth, rowH).fill();
        doc.fillColor('#333333');
      }

      // Cells
      row.forEach((val, j) => {
        const x = tableStartX + colWidths.slice(0, j).reduce((a, b) => a + b, 0);
        const fs = j === colWidths.length - 1 ? amountFontSize : bodyFontSize;
        const fn = j === 1 || j === colWidths.length - 1 ? 'Helvetica-Bold' : 'Helvetica';
        doc.font(fn).fontSize(fs).fillColor('#333333')
          .text(val, x + 4, y + 5, {
            width: colWidths[j] - 8,
            align: j === colWidths.length - 1 ? 'right' : 'left',
          });
      });

      y += rowH;
    }

    // Total row
    doc.fillColor('#e5e7eb').rect(tableStartX, y, totalColWidth, headerHeight).fill();
    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(bodyFontSize)
      .text(`Total (${bills.length} bills)`, tableStartX + 4, y + 6, { width: totalColWidth - 80 })
      .text(formatCurrency(totalAmount), tableStartX + totalColWidth - 72, y + 6, { width: 68, align: 'right' });

    // Footer
    doc.fontSize(7).fillColor('#999999').font('Helvetica')
      .text(
        `Generated by TMR Trading Lanka System — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — Data Source: Production Database`,
        leftMargin, pageHeight - doc.page.margins.bottom - 20, { align: 'center', width: usableWidth }
      );

    doc.end();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
