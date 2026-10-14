import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { ITokenPayload } from '../types';

export const generateAccessToken = (payload: ITokenPayload): string => {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: config.jwtAccessExpiry as SignOptions['expiresIn']
  };

  return jwt.sign(payload, config.jwtAccessSecret, options);
};

export const verifyAccessToken = (token: string): ITokenPayload => {
  const decoded = jwt.verify(token, config.jwtAccessSecret, {
    algorithms: ['HS256']
  });
  return decoded as ITokenPayload;
};

export const generateRefreshTokenString = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateOtp = (): { code: string; hash: string; expiresAt: Date } => {
  // Generate cryptographically secure 6-digit number between 100000 and 999999
  const code = crypto.randomInt(100000, 1000000).toString();
  const hash = hashToken(code);
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  return { code, hash, expiresAt };
};
