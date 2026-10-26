import { IEmailProvider } from './emailProvider.interface';
import {
  renderVerificationEmail,
  renderPasswordResetEmail,
  renderPasswordResetConfirmationEmail,
  renderEmailChangeOtpEmail,
  IEmailContent
} from './emailTemplates';
import { AppError } from '../../utils';
import { config } from '../../config';

export interface IBrevoEmailOptions {
  apiKey: string;
  senderEmail: string;
  senderName: string;
  timeoutMs?: number;
}

export class BrevoEmailProvider implements IEmailProvider {
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly timeoutMs: number;
  private readonly apiUrl: string = 'https://api.brevo.com/v3/smtp/email';

  constructor(options: IBrevoEmailOptions) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error('[BrevoEmailProvider] API Key is required to initialize Brevo provider');
    }

    this.apiKey = options.apiKey.trim();
    this.senderEmail = options.senderEmail?.trim() || 'notifications@lifeledger.health';
    this.senderName = options.senderName?.trim() || 'LifeLedger';
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  /**
   * Dispatches an account verification OTP via Brevo.
   */
  public async sendVerificationOtp(email: string, otp: string, name?: string): Promise<void> {
    const content = renderVerificationEmail(otp, config.otpExpiryMinutes, name);
    await this.sendTransactionalEmail(email, content, name);
  }

  /**
   * Dispatches a password reset OTP via Brevo.
   */
  public async sendPasswordResetOtp(email: string, otp: string, name?: string): Promise<void> {
    const content = renderPasswordResetEmail(otp, config.otpExpiryMinutes, name);
    await this.sendTransactionalEmail(email, content, name);
  }

  /**
   * Dispatches a confirmation email upon successful password reset via Brevo.
   */
  public async sendPasswordResetConfirmation(email: string, name?: string): Promise<void> {
    const content = renderPasswordResetConfirmationEmail(name);
    await this.sendTransactionalEmail(email, content, name);
  }

  /**
   * Dispatches an email change verification OTP via Brevo.
   */
  public async sendEmailChangeOtp(email: string, otp: string, name?: string): Promise<void> {
    const content = renderEmailChangeOtpEmail(otp, config.otpExpiryMinutes, name);
    await this.sendTransactionalEmail(email, content, name);
  }

  /**
   * Core transactional email dispatcher communicating with Brevo REST API v3.
   */
  private async sendTransactionalEmail(
    recipientEmail: string,
    content: IEmailContent,
    recipientName?: string
  ): Promise<void> {
    const normalizedEmail = recipientEmail.toLowerCase().trim();

    if (!normalizedEmail) {
      throw new AppError('Recipient email address is required', 400);
    }

    const payload = {
      sender: {
        name: this.senderName,
        email: this.senderEmail
      },
      to: [
        {
          email: normalizedEmail,
          ...(recipientName && recipientName.trim() ? { name: recipientName.trim() } : {})
        }
      ],
      subject: content.subject,
      htmlContent: content.html,
      textContent: content.text
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorData: { code?: string; message?: string } = {};
        try {
          errorData = (await response.json()) as { code?: string; message?: string };
        } catch {
          // Non-JSON error body
        }

        const sanitizedErrorMessage = errorData.message || response.statusText || 'Delivery rejected';
        
        // Log controlled warning without exposing API key or payload secrets
        console.warn(
          `[BrevoEmailProvider] Email dispatch failed for recipient (${normalizedEmail}) with status ${response.status}: ${sanitizedErrorMessage}`
        );

        if (response.status === 401 || response.status === 403) {
          throw new AppError('Email service authorization failed. Please contact support.', 502);
        } else if (response.status === 400) {
          throw new AppError(`Email delivery failed: ${sanitizedErrorMessage}`, 400);
        } else if (response.status === 402) {
          throw new AppError('Email service quota exceeded. Please try again later.', 503);
        } else {
          throw new AppError('Failed to send verification email. Please try again.', 502);
        }
      }

      if (config.nodeEnv === 'development') {
        console.log(`[BrevoEmailProvider] Email "${content.subject}" successfully dispatched to ${normalizedEmail}`);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      if (err instanceof AppError) {
        throw err;
      }

      const isAbort = (err as { name?: string })?.name === 'AbortError';
      const errorMsg = isAbort ? 'Email delivery request timed out' : 'Unable to connect to email service';

      console.warn(`[BrevoEmailProvider] Network error sending email to ${normalizedEmail}: ${errorMsg}`);

      throw new AppError(
        isAbort
          ? 'Email delivery timed out. Please try again.'
          : 'Email delivery service is currently unavailable. Please try again.',
        503
      );
    }
  }
}
