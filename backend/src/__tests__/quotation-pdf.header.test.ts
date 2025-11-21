import { describe, it, expect, vi } from 'vitest'
import Branding from '../models/Branding.js'

vi.mock('pdfkit', () => {
  class FakePDFDocument {
    static lastInstance: any
    texts: any[] = []
    handlers: Record<string, Function[]> = {}
    page = { height: 842 }
    y = 0
    constructor() {
      ;(FakePDFDocument as any).lastInstance = this
    }
    fontSize() { return this }
    font() { return this }
    fillColor() { return this }
    text(t: string, x?: number, y?: number, options?: any) { this.texts.push({ t, x, y, options }); return this }
    moveDown() { return this }
    lineWidth() { return this }
    moveTo() { return this }
    lineTo() { return this }
    stroke() { return this }
    strokeColor() { return this }
    addPage() { return this }
    on(event: string, cb: Function) { (this.handlers[event] ||= []).push(cb as any); return this }
    end() { (this.handlers['end'] || []).forEach((cb) => cb()) }
  }
  return { default: FakePDFDocument }
})

describe('Quotation PDF header', () => {
  it('uses Authorized Dealer header and prints address on new line(s)', async () => {
    vi.spyOn(Branding, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        dealerName: 'GUNAWARDHANA ENTERPRISES',
        brandPartner: 'TMR Trading Lanka Pvt Ltd',
        primaryColor: '#ff0000',
        addressLine1: 'Beliatta Road, Tangalle',
        addressLine2: 'Southern Province'
      })
    } as any)

    const quotation: any = {
      type: 'quotation',
      quotationNumber: 'GM-QUO-TEST',
      quotationDate: new Date(),
      customerName: 'Test Customer',
      customerAddress: 'Some Address',
      items: [
        {
          description: 'Test item description',
          quantity: 1,
          rate: 1000,
          amount: 1000,
        }
      ],
      totalAmount: 1000,
    }

    const { generateQuotationPDF } = await import('../services/quotationPdfService.js')
    await generateQuotationPDF(quotation)
    const pdfkit = await import('pdfkit')
    const doc: any = (pdfkit as any).default.lastInstance
    const allTexts = doc.texts.map((e: any) => e.t)
    const joined = allTexts.join('\n')
    expect(joined).toContain('Authorized Dealer:')
    expect(joined).toContain('Beliatta Road, Tangalle')
    expect(joined).toContain('Southern Province')
    expect(joined).not.toContain('Authorized Dealer: GUNAWARDHANA ENTERPRISES - Beliatta Road, Tangalle')
  })
})