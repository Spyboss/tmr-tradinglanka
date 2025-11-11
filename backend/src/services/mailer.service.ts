import logger from '../utils/logger.js';

export interface MailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER ?? 'console').toLowerCase();
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'TMR Trading Lanka <no-reply@gunawardanamotors.lk>';

export const sendMail = async ({ to, subject, html, text }: MailRequest): Promise<{ success: boolean; id?: string; error?: string }> => {
  if (EMAIL_PROVIDER === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn('RESEND_API_KEY missing; falling back to console mailer');
    } else {
      try {
        const mod = await import('resend');
        const Resend = (mod as any).Resend;
        const resend = new Resend(apiKey);
        const result = await resend.emails.send({ from: EMAIL_FROM, to, subject, html: html ?? undefined, text: text ?? undefined });
        if ((result as any)?.id) {
          logger.info(`Email sent via Resend to ${to} (id: ${(result as any).id})`);
          return { success: true, id: (result as any).id };
        }
        // Resend returns `{ error }` on failure
        const error = (result as any)?.error?.message ?? 'Unknown Resend error';
        logger.error(`Resend send error: ${error}`);
        return { success: false, error };
      } catch (error) {
        logger.error(`Resend module error: ${(error as Error).message}`);
        // fall through to console
      }
    }
  }

  // Console fallback: log the message, do not fail requests
  const mode = EMAIL_PROVIDER;
  logger.info(`[mailer:${mode}] to=${to} subject="${subject}"`);
  if (text) logger.debug(`[mailer:${mode}] text=${text}`);
  if (html) logger.debug(`[mailer:${mode}] html length=${html.length}`);
  return { success: true };
};