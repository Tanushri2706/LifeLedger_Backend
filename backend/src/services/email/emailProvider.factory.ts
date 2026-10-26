import { config } from '../../config';
import { IEmailProvider } from './emailProvider.interface';
import { BrevoEmailProvider } from './brevoEmailProvider';
import { MockEmailProvider } from './mockEmailProvider';

/**
 * Email Provider Factory
 * 
 * Automatically initializes BrevoEmailProvider when BREVO_API_KEY is configured,
 * or gracefully falls back to MockEmailProvider in development/testing environments.
 */
export const createEmailProvider = (forceMock: boolean = false): IEmailProvider => {
  if (forceMock || config.emailProvider === 'mock' || !config.brevoApiKey) {
    return new MockEmailProvider();
  }

  try {
    return new BrevoEmailProvider({
      apiKey: config.brevoApiKey,
      senderEmail: config.brevoSenderEmail,
      senderName: config.brevoSenderName
    });
  } catch (err) {
    console.warn('[Email Factory] Failed to initialize Brevo provider, falling back to mock provider:', err);
    return new MockEmailProvider();
  }
};

export const emailService: IEmailProvider = createEmailProvider();
