import zlib from 'zlib';

/**
 * Lightweight PDF inspection helpers for pagination tests.
 *
 * PDFKit compresses content streams and hex-encodes text, so these helpers
 * inflate each stream and decode the text runs together with their position
 * on the page. Coordinates are converted to standard PDF space (y grows
 * upward from the bottom-left corner) so assertions read naturally.
 */

const PAGE_HEIGHT_A4 = 841.89;

export type TextRun = {
  page: number;
  x: number;
  y: number;
  size: number;
  text: string;
};

export const countPages = (buf: Buffer): number => {
  return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
};

const decodeHex = (hex: string): string => {
  let out = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    out += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return out;
};

const unescapeLiteral = (text: string): string =>
  text
    .replace(/\\([nrtbf()\\])/g, (_, c: string) =>
      ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' })[c]!
    )
    .replace(/\\(\d{1,3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));

const inflateContentStreams = (buf: Buffer): string[] => {
  const source = buf.toString('latin1');
  const chunks: string[] = [];
  const streamRe = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(source))) {
    const start = match.index + match[0].length;
    const end = source.indexOf('endstream', start);
    if (end < 0) continue;
    try {
      chunks.push(zlib.inflateSync(buf.subarray(start, end)).toString('latin1'));
    } catch {
      // Not a FlateDecode content stream (e.g. embedded font/image); skip.
    }
  }
  return chunks;
};

export const extractRuns = (buf: Buffer): TextRun[] => {
  const runs: TextRun[] = [];

  inflateContentStreams(buf).forEach((content, page) => {
    const blockRe = /BT([\s\S]*?)ET/g;
    let block: RegExpExecArray | null;
    while ((block = blockRe.exec(content))) {
      const body = block[1];
      const tm = body.match(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/);
      if (!tm) continue;
      const font = body.match(/\/F\d+ ([\d.]+) Tf/);

      let text = '';
      const partRe = /<([0-9a-fA-F]+)>|\(((?:[^()\\]|\\.)*)\)/g;
      let part: RegExpExecArray | null;
      while ((part = partRe.exec(body))) {
        text += part[1] !== undefined ? decodeHex(part[1]) : unescapeLiteral(part[2]);
      }

      const x = parseFloat(tm[1]);
      const yFromTop = parseFloat(tm[2]);
      runs.push({
        page,
        x,
        y: PAGE_HEIGHT_A4 - yFromTop,
        size: font ? parseFloat(font[1]) : 0,
        text
      });
    }
  });

  return runs;
};

/** Text runs grouped by page index, sorted top-of-page first. */
export const textByPage = (buf: Buffer): TextRun[][] => {
  const pages: TextRun[][] = Array.from({ length: countPages(buf) }, () => []);
  extractRuns(buf).forEach(run => {
    if (pages[run.page]) pages[run.page].push(run);
  });
  pages.forEach(runs => runs.sort((a, b) => b.y - a.y));
  return pages;
};

export const findRun = (buf: Buffer, needle: string): TextRun | undefined => {
  return extractRuns(buf).find(run => run.text.includes(needle));
};
