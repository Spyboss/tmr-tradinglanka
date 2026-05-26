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

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="finance-company-sales-${financeCompany.replace(/\s+/g, '-')}.pdf"`);
    doc.pipe(res);

    // Header
    let y = 45;
    if (logoBuffer) {
      try { doc.image(logoBuffer, 50, y, { width: 75 }); y = 45; } catch {}
    }
    doc.fontSize(18).fillColor('#444444').font('Helvetica-Bold')
      .text(dealerName, logoBuffer ? 140 : 50, 45, { align: 'center' });
    doc.fontSize(12).fillColor('#666666').font('Helvetica')
      .text(`Finance Company Sales Report — ${financeCompany}`, logoBuffer ? 140 : 50, 70, { align: 'center' });
    doc.fontSize(9).fillColor('#999999')
      .text(`Period: ${fromDate ? formatDate(fromDate) : 'All time'} — ${toDate ? formatDate(toDate) : 'All time'}`, logoBuffer ? 140 : 50, 87, { align: 'center' });
    doc.moveDown();

    // Summary bar
    const totalAmount = bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const withProforma = bills.filter(b => b.proforma?.financeCompanyName).length;

    const lineY = doc.y;
    doc.moveTo(50, lineY).lineTo(545, lineY).strokeColor('#cccccc').stroke();
    doc.moveDown();

    const summaryY = doc.y;
    doc.fontSize(10).fillColor('#333333').font('Helvetica-Bold')
      .text(`Total Sales: ${bills.length}`, 50, summaryY, { width: 150 })
      .text(`Total Amount: ${formatCurrency(totalAmount)}`, 200, summaryY, { width: 200 })
      .text(`With Proforma: ${withProforma} of ${bills.length}`, 400, summaryY, { width: 150 });
    doc.moveDown();
    const lineY2 = doc.y;
    doc.moveTo(50, lineY2).lineTo(545, lineY2).strokeColor('#cccccc').stroke();
    doc.moveDown();

    // Table header
    const tableTop = doc.y;
    const colWidths = [24, 70, 55, 80, 70, 65, 55, 48];
    const headers = ['#', 'Bill No', 'Date', 'Customer', 'Chassis No', 'Motor No', 'Model', 'Amount'];
    const startX = 50;

    doc.font('Helvetica-Bold').fontSize(7);
    headers.forEach((h, i) => {
      const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.fillColor('#444444').rect(x, tableTop, colWidths[i], 16).fill();
      doc.fillColor('#ffffff').text(h, x + 2, tableTop + 4, { width: colWidths[i] - 4, align: i === colWidths.length - 1 ? 'right' : 'left' });
    });

    // Table rows
    y = tableTop + 16;
    doc.font('Helvetica').fontSize(7).fillColor('#333333');

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

      if (i % 2 === 0) {
        doc.fillColor('#f9fafb').rect(startX, y, 545 - startX, 14).fill();
        doc.fillColor('#333333');
      }

      row.forEach((val, j) => {
        const x = startX + colWidths.slice(0, j).reduce((a, b) => a + b, 0);
        doc.font(j === 1 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(j === 7 ? 8 : 7)
          .fillColor('#333333')
          .text(val, x + 2, y + 3, {
            width: colWidths[j] - 4,
            align: j === colWidths.length - 1 ? 'right' : 'left',
          });
      });
      y += 14;

      if (y > 750) {
        doc.addPage();
        y = 50;
      }
    }

    // Total row
    doc.fillColor('#e5e7eb').rect(startX, y, 545 - startX, 16).fill();
    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(8)
      .text(`Total (${bills.length} bills)`, startX + 2, y + 4, { width: 380 })
      .text(formatCurrency(totalAmount), startX + 383, y + 4, { width: 112, align: 'right' });

    // Footer
    doc.fontSize(7).fillColor('#999999').font('Helvetica')
      .text(
        `Generated by TMR Trading Lanka System — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} — Data Source: Production Database`,
        50, 780, { align: 'center', width: 500 }
      );

    doc.end();
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
