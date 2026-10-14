export interface IEmailProvider {
  /**
   * Dispatches an email containing the 6-digit OTP for email verification upon signup or resend.
   */
  sendVerificationOtp(email: string, otp: string, name?: string): Promise<void>;

  /**
   * Dispatches an email containing the 6-digit OTP for forgotten password recovery.
   */
  sendPasswordResetOtp(email: string, otp: string, name?: string): Promise<void>;

  /**
   * Optional confirmation email dispatched upon successful password reset.
   */
  sendPasswordResetConfirmation?(email: string, name?: string): Promise<void>;

  /**
   * Dispatches an email containing the 6-digit OTP for verified email change.
   */
  sendEmailChangeOtp(email: string, otp: string, name?: string): Promise<void>;

  /**
   * Development & testing helper to inspect dispatched OTPs in mock environments.
   */
  getLastOtp?(email: string): string | undefined;
}

export type IEmailService = IEmailProvider;
