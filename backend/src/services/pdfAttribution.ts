const DEFAULT_DOCUMENT_ATTRIBUTION = 'Generated through UHADEV DMS (Dealership Management System) — dms.uhadev.com';

export const getDocumentAttributionText = (): string => {
  const value = process.env.PDF_DOCUMENT_ATTRIBUTION?.trim();
  return value || DEFAULT_DOCUMENT_ATTRIBUTION;
};

// Distance from the bottom edge of the sheet to the bottom of the faded
// attribution strip. Kept tight so the footer hugs the bottom of the page
// instead of floating above a half inch of white space, while still leaving
// every printer's non-printable area alone.
const ATTRIBUTION_BOTTOM_INSET = 28;

export const getDocumentAttributionHeight = (
  doc: PDFKit.PDFDocument,
  width: number
): number => {
  return doc.font('Helvetica').fontSize(7).heightOfString(getDocumentAttributionText(), {
    width,
    align: 'center'
  });
};

/** Top edge of the attribution strip on the current page (PDF coordinates grow downward). */
export const getDocumentAttributionTop = (
  doc: PDFKit.PDFDocument,
  width: number
): number => {
  return doc.page.height - ATTRIBUTION_BOTTOM_INSET - getDocumentAttributionHeight(doc, width);
};

export const renderDocumentAttribution = (
  doc: PDFKit.PDFDocument,
  options?: {
    left?: number;
    width?: number;
  }
): void => {
  const left = options?.left ?? doc.page.margins.left;
  const width = options?.width ?? doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const text = getDocumentAttributionText();
  const y = getDocumentAttributionTop(doc, width);

  doc.font('Helvetica').fontSize(7).fillColor('#9ca3af');

  // lineBreak:false keeps PDFKit from "helpfully" starting a new page when the
  // strip sits below the page's bottom margin — the footer belongs on the page
  // it was drawn for. Centering is done by hand for the same reason.
  const textWidth = doc.widthOfString(text);
  doc.text(text, left + Math.max((width - textWidth) / 2, 0), y, { lineBreak: false });
};
