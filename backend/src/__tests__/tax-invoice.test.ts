import { describe, it, expect, vi } from 'vitest';
import {
  buildSerial,
  parseSerial,
  isValidSerial,
  validateClassificationCode,
  issueSerial,
  SerialFormatError
} from '../services/serialEngine.js';
import { vatFromGross, vatFromNet, computeVat } from '../utils/vat.js';
import { amountInWords, integerToWords } from '../utils/numberToWords.js';
import { generateTaxInvoicePDF } from '../services/taxInvoicePdfService.js';
import { countPages, findRun } from '../test-utils/pdfProbe.js';

vi.mock('../models/Branding.js', () => ({
  default: {
    findOne: vi.fn().mockReturnValue({
      lean: () =>
        Promise.resolve({
          tin: '123456789',
          phone: '0112345678',
          pricesIncludeVat: true,
          vatRate: 18,
          dealerName: 'TMR Trading Lanka',
          brandPartner: 'TMR Trading Lanka (Pvt) Ltd',
          primaryColor: '#d32f2f',
          addressLine1: 'No. 1, Galle Road, Colombo 03',
          addressLine2: '',
          footerNote: ''
        })
    })
  }
}));

vi.mock('../models/InvoiceSequence.js', () => {
  let seq = 0;
  return {
    default: {
      findOneAndUpdate: vi.fn().mockImplementation(() =>
        Promise.resolve({ seq: ++seq })
      )
    }
  };
});

describe('serial engine — gazette format YYMMM_QQQQ_XXXXX', () => {
  it('builds the gazette example: first invoice of July 2026 for branch BR03', () => {
    // 26JUL_BR03_00001 — padded XXXXX, gazette example is unpadded "1"
    expect(buildSerial(new Date(2026, 6, 1), 'BR03', 1)).toBe('26JUL_BR03_00001');
  });

  it('pads the sequence to five digits', () => {
    expect(buildSerial(new Date(2026, 9, 2), 'TX01', 7)).toBe('26OCT_TX01_00007');
    expect(buildSerial(new Date(2026, 9, 2), 'TX01', 12345)).toBe('26OCT_TX01_12345');
  });

  it('keeps serials within 40 characters and free of spaces', () => {
    const serial = buildSerial(new Date(2026, 9, 2), 'A1B2C3D4E5F6G7H8'.slice(0, 15), 99999);
    expect(serial.length).toBeLessThanOrEqual(40);
    expect(/\s/.test(serial)).toBe(false);
  });

  it('rejects classification codes with symbols, spaces, or over 15 characters', () => {
    expect(validateClassificationCode('BR03')).toBe(true);
    expect(validateClassificationCode('CASH')).toBe(true);
    expect(validateClassificationCode('BR-03')).toBe(false);
    expect(validateClassificationCode('BR 03')).toBe(false);
    expect(validateClassificationCode('ABCDEFGHIJKLMNOP')).toBe(false);
    expect(validateClassificationCode('')).toBe(false);
    expect(() => buildSerial(new Date(2026, 9, 2), 'BR-03', 1)).toThrow(SerialFormatError);
  });

  it('rejects non-positive or fractional sequences', () => {
    expect(() => buildSerial(new Date(2026, 9, 2), 'TX01', 0)).toThrow(SerialFormatError);
    expect(() => buildSerial(new Date(2026, 9, 2), 'TX01', 1.5)).toThrow(SerialFormatError);
  });

  it('parses a valid serial into its parts', () => {
    const parts = parseSerial('26OCT_TX01_00042');
    expect(parts).toEqual({ yy: '26', month: 'OCT', code: 'TX01', sequence: 42 });
  });

  it('rejects serials with spaces, bad months, letters in the sequence, or >40 chars', () => {
    expect(() => parseSerial('26 OCT_TX01_00001')).toThrow(SerialFormatError);
    expect(() => parseSerial('26XXX_TX01_00001')).toThrow(SerialFormatError);
    expect(() => parseSerial('26OCT_TX01_ABCDE')).toThrow(SerialFormatError);
    expect(() => parseSerial('26OCT_TX01_1_2')).toThrow(SerialFormatError);
    expect(() => parseSerial('X'.repeat(41))).toThrow(SerialFormatError);
    expect(isValidSerial('26OCT_TX01_00001')).toBe(true);
    expect(isValidSerial('garbage')).toBe(false);
  });

  it('issues sequences atomically per code and month', async () => {
    const a = await issueSerial(new Date(2026, 9, 2), 'TX01');
    const b = await issueSerial(new Date(2026, 9, 31), 'TX01');
    expect(a).toBe('26OCT_TX01_00001');
    expect(b).toBe('26OCT_TX01_00002');
  });
});

describe('VAT split (Sri Lanka 18%)', () => {
  it('splits a gross retail price into net + VAT', () => {
    expect(vatFromGross(118000)).toEqual({ taxableValue: 100000, vatAmount: 18000, total: 118000 });
    expect(vatFromGross(11800)).toEqual({ taxableValue: 10000, vatAmount: 1800, total: 11800 });
  });

  it('adds VAT on top of a net amount', () => {
    expect(vatFromNet(100000)).toEqual({ taxableValue: 100000, vatAmount: 18000, total: 118000 });
  });

  it('rounds to two decimals and keeps vat = total - net exactly', () => {
    const b = vatFromGross(100000);
    expect(b.taxableValue).toBe(84745.76);
    expect(b.vatAmount).toBe(15254.24);
    expect(b.taxableValue + b.vatAmount).toBe(b.total);
  });

  it('switches on the prices-include-VAT profile flag', () => {
    expect(computeVat(118000, true).taxableValue).toBe(100000);
    expect(computeVat(100000, false).total).toBe(118000);
  });

  it('rejects invalid amounts', () => {
    expect(() => vatFromGross(-1)).toThrow();
    expect(() => vatFromGross(NaN)).toThrow();
    expect(() => vatFromNet(Infinity)).toThrow();
  });
});

describe('total amount in words (gazette 4.1.g.iv)', () => {
  it('spells Sri Lankan scale units', () => {
    expect(integerToWords(0)).toBe('Zero');
    expect(integerToWords(450000)).toBe('Four Lakh Fifty Thousand');
    expect(integerToWords(118000)).toBe('One Lakh Eighteen Thousand');
    expect(integerToWords(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred and Sixty Seven');
    expect(integerToWords(10000000)).toBe('One Crore');
  });

  it('formats the full rupee phrase with cents when present', () => {
    expect(amountInWords(450000)).toBe('Rupees Four Lakh Fifty Thousand Only');
    expect(amountInWords(450000.5)).toBe('Rupees Four Lakh Fifty Thousand and Fifty Cents Only');
    expect(amountInWords(118000)).toBe('Rupees One Lakh Eighteen Thousand Only');
  });
});

describe('tax invoice PDF (Gazette 2481/22 Annexure I)', () => {
  const taxBill = (): any => ({
    billNumber: 'BILL-261002-001',
    billDate: new Date(2026, 9, 2),
    status: 'completed',
    customerName: 'W. A. KARUNASENA',
    customerNIC: '000000000V',
    customerAddress: 'DHANARAN SUBODA PATUMAGA, SITINAMALUWA, TANGALLE',
    customerPhone: '0771234567',
    bikeModel: 'E-MOTORCYCLE X1',
    motorNumber: 'MTR123456',
    chassisNumber: 'CHS123456',
    bikePrice: 450000,
    rmvCharge: 13000,
    billType: 'cash',
    totalAmount: 463000,
    invoiceSerialNumber: '26OCT_TX01_00001',
    taxType: 'tax',
    purchaserTin: '987654321',
    taxRate: 18,
    taxableValue: 392372.88,
    vatAmount: 70627.12,
    invoiceDate: new Date(2026, 9, 2),
    dateOfSupply: new Date(2026, 9, 2),
    owner: 'user-1'
  });

  it('renders a single page carrying every mandatory Annexure I element', async () => {
    const pdf = await generateTaxInvoicePDF(taxBill());
    expect(countPages(pdf)).toBe(1);

    expect(findRun(pdf, 'TAX INVOICE'), 'title missing').toBeDefined();
    expect(findRun(pdf, '26OCT_TX01_00001'), 'serial missing').toBeDefined();
    expect(findRun(pdf, '123456789'), 'supplier TIN missing').toBeDefined();
    expect(findRun(pdf, '987654321'), 'purchaser TIN missing').toBeDefined();
    expect(findRun(pdf, '10/02/2026'), 'invoice date not in MM/DD/YYYY').toBeDefined();
    expect(findRun(pdf, 'Total Value of Supply'), 'net total missing').toBeDefined();
    expect(findRun(pdf, '70627.12'), 'VAT amount missing').toBeDefined();
    expect(findRun(pdf, '463000.00'), 'gross total missing').toBeDefined();
    expect(findRun(pdf, 'Mode of Payment'), 'payment mode missing').toBeDefined();
    expect(findRun(pdf, 'Rupees '), 'amount in words missing').toBeDefined();
    expect(findRun(pdf, 'dms.uhadev.com'), 'attribution missing').toBeDefined();
  });

  it('computes VAT on the fly for a bill that carries totals but no stored split', async () => {
    const bill = taxBill();
    delete bill.taxableValue;
    delete bill.vatAmount;
    const pdf = await generateTaxInvoicePDF(bill);

    // 463000 gross @18% -> net 392372.88
    expect(findRun(pdf, '392372.88'), 'computed net missing').toBeDefined();
    expect(findRun(pdf, '70627.12'), 'computed VAT missing').toBeDefined();
  });
});
