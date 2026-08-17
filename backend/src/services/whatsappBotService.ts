import logger from '../utils/logger.js';

const BOT_URL = process.env.DEALER_BOT_URL || '';
const BOT_SECRET = process.env.DEALER_BOT_SECRET || '';
const BOT_ENABLED = process.env.DEALER_BOT_ENABLED === 'true';

/**
 * Normalize Sri Lankan mobile number (07XXXXXXXX) to international (947XXXXXXXXX)
 * as expected by the WhatsApp bot.
 */
const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('94') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '94' + digits.slice(1);
  return digits;
};

/**
 * Fire-and-forget request to the dealer-bot rate-us webhook.
 * Never blocks or fails the sale flow: failures are logged, not thrown.
 */
export const sendReviewRequest = async (customerPhone: string, customerName: string): Promise<void> => {
  if (!BOT_ENABLED || !BOT_URL || !BOT_SECRET) {
    logger.debug('Dealer bot disabled or not configured, skipping review request');
    return;
  }
  if (!customerPhone) {
    logger.debug('No customer phone on bill, skipping review request');
    return;
  }

  const payload = {
    phone: normalizePhone(customerPhone),
    customerName: customerName || '',
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${BOT_URL.replace(/\/$/, '')}/api/rate-us`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bot-Secret': BOT_SECRET,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn(`Dealer bot review request failed: HTTP ${res.status}`);
      return;
    }
    const body = (await res.json()) as { ok?: boolean; reason?: string };
    if (!body.ok) {
      logger.warn(`Dealer bot review request rejected: ${body.reason || 'unknown'}`);
      return;
    }
    logger.info(`Review request queued for ${normalizePhone(customerPhone)}`);
  } catch (error) {
    logger.warn(`Dealer bot review request error: ${error instanceof Error ? error.message : String(error)}`);
  }
};