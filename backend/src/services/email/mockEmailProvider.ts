import { IEmailProvider } from './emailProvider.interface';
import { config } from '../../config';

export class MockEmailProvider implements IEmailProvider {
  // In-memory record of last sent OTP by normalized email for test/dev inspections
  private lastSentOtpByEmail: Map<string, string> = new Map();
  private lastSentEmailTypeByEmail: Map<string, string> = new Map();

  public async sendVerificationOtp(email: string, otp: string, _name?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    this.lastSentOtpByEmail.set(normalizedEmail, otp);
    this.lastSentEmailTypeByEmail.set(normalizedEmail, 'VERIFICATION_OTP');

    if (config.nodeEnv === 'development') {
      console.log(`[MockEmailService] Simulated dispatch: Email verification OTP dispatched to ${normalizedEmail}`);
    }
  }

  public async sendPasswordResetOtp(email: string, otp: string, _name?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    this.lastSentOtpByEmail.set(normalizedEmail, otp);
    this.lastSentEmailTypeByEmail.set(normalizedEmail, 'PASSWORD_RESET_OTP');

    if (config.nodeEnv === 'development') {
      console.log(`[MockEmailService] Simulated dispatch: Password reset OTP dispatched to ${normalizedEmail}`);
    }
  }

  public async sendPasswordResetConfirmation(email: string, _name?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    this.lastSentEmailTypeByEmail.set(normalizedEmail, 'PASSWORD_RESET_CONFIRMATION');

    if (config.nodeEnv === 'development') {
      console.log(`[MockEmailService] Simulated dispatch: Password reset confirmation dispatched to ${normalizedEmail}`);
    }
  }

  public async sendEmailChangeOtp(email: string, otp: string, _name?: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    this.lastSentOtpByEmail.set(normalizedEmail, otp);
    this.lastSentEmailTypeByEmail.set(normalizedEmail, 'EMAIL_CHANGE_OTP');

    if (config.nodeEnv === 'development') {
      console.log(`[MockEmailService] Simulated dispatch: Email change OTP dispatched to ${normalizedEmail}`);
    }
  }

  /**
   * Helper to retrieve the last dispatched OTP for automated testing.
   */
  public getLastOtp(email: string): string | undefined {
    return this.lastSentOtpByEmail.get(email.toLowerCase().trim());
  }

  /**
   * Helper to retrieve the last dispatched email type for automated testing.
   */
  public getLastEmailType(email: string): string | undefined {
    return this.lastSentEmailTypeByEmail.get(email.toLowerCase().trim());
  }

  /**
   * Clear in-memory OTP cache.
   */
  public clear(): void {
    this.lastSentOtpByEmail.clear();
    this.lastSentEmailTypeByEmail.clear();
  }
}

// Retain alias for full backward compatibility
export const MockEmailService = MockEmailProvider;
