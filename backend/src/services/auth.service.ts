import { User, Doctor, RefreshToken, Otp, UserDocument } from '../models';
import {
  UserRole,
  OtpPurpose,
  SignupUserDto,
  SignupDoctorDto,
  IDeviceInfo,
  ResetPasswordDto,
  ChangePasswordDto
} from '../types';
import {
  AppError,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
  generateAccessToken,
  generateRefreshTokenString,
  hashToken,
  generateOtp
} from '../utils';
import { emailService } from './email.service';

export class AuthService {
  public async signupUser(dto: SignupUserDto, _deviceInfo?: IDeviceInfo) {
    const { firstName, lastName, email, password, phone, gender, dateOfBirth, bloodGroup, emergencyContact, address, city, state, country, pincode } = dto;

    if (!firstName || !lastName || !email || !password) {
      throw new AppError('First name, last name, email, and password are required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.message || 'Password does not meet requirements', 400);
    }

    // 1. Check duplicate / unverified user email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.isVerified) {
      throw new AppError('An account with this email address already exists', 409);
    }

    // 2. Check duplicate phone if provided
    if (phone && phone.trim()) {
      const normalizedPhone = phone.trim();
      const existingPhoneUser = await User.findOne({ phone: normalizedPhone });
      if (existingPhoneUser) {
        if (existingUser && existingPhoneUser._id.equals(existingUser._id)) {
          // Same user restarting registration with their phone, allowed.
        } else if (existingPhoneUser.isVerified) {
          throw new AppError('An account with this phone number already exists', 409);
        } else {
          // Stale unverified account holding this phone number -> safely release the phone reservation
          await User.updateOne({ _id: existingPhoneUser._id }, { $unset: { phone: 1 } });
        }
      }
    }

    const hashedPassword = await hashPassword(password);

    let user: UserDocument;

    if (existingUser && !existingUser.isVerified) {
      // Safe recovery / restart for abandoned unverified registration
      // If previous unverified registration had role DOCTOR, clean up any unverified Doctor profile
      if (existingUser.role === UserRole.DOCTOR) {
        await Doctor.deleteOne({ userId: existingUser._id });
      }

      existingUser.firstName = firstName.trim();
      existingUser.lastName = lastName.trim();
      existingUser.password = hashedPassword;
      existingUser.phone = phone ? phone.trim() : undefined;
      existingUser.gender = gender;
      existingUser.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
      existingUser.bloodGroup = bloodGroup;
      existingUser.emergencyContact = emergencyContact;
      existingUser.address = address ? address.trim() : undefined;
      existingUser.city = city ? city.trim() : undefined;
      existingUser.state = state ? state.trim() : undefined;
      existingUser.country = country ? country.trim() : undefined;
      existingUser.pincode = pincode ? pincode.trim() : undefined;
      existingUser.role = UserRole.PATIENT;
      existingUser.isVerified = false;

      user = await existingUser.save();
    } else {
      user = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : undefined,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        bloodGroup,
        emergencyContact,
        address: address ? address.trim() : undefined,
        city: city ? city.trim() : undefined,
        state: state ? state.trim() : undefined,
        country: country ? country.trim() : undefined,
        pincode: pincode ? pincode.trim() : undefined,
        role: UserRole.PATIENT,
        isVerified: false
      });

      await user.save();
    }

    // Invalidate any existing OTPs for this email
    await Otp.updateMany(
      { email: normalizedEmail, isVerified: false },
      { expiresAt: new Date(Date.now() - 1000) }
    );

    // Generate & store verification OTP
    const { code, hash, expiresAt } = generateOtp();
    const otpDoc = new Otp({
      email: normalizedEmail,
      otpHash: hash,
      purpose: OtpPurpose.SIGNUP_VERIFICATION,
      expiresAt,
      attempts: 0,
      isVerified: false
    });
    await otpDoc.save();

    // Dispatch verification email
    try {
      await emailService.sendVerificationOtp(normalizedEmail, code, firstName.trim());
    } catch (err: any) {
      console.error(`[AuthService] Failed to send verification OTP email to ${normalizedEmail}:`, err);
    }

    return {
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        phone: user.phone,
        avatar: user.avatar,
        healthScore: user.healthScore
      }
    };
  }

  public async signupDoctor(dto: SignupDoctorDto, _deviceInfo?: IDeviceInfo) {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      gender,
      dateOfBirth,
      bloodGroup,
      address,
      city,
      state,
      country,
      pincode,
      licenseNumber,
      specialization,
      experience,
      qualification,
      hospital,
      consultationFee,
      languages,
      availability
    } = dto;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !licenseNumber ||
      !specialization ||
      experience === undefined ||
      !qualification ||
      !hospital ||
      consultationFee === undefined
    ) {
      throw new AppError('All required doctor profile fields must be provided', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedLicense = licenseNumber.trim().toUpperCase();

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.message || 'Password does not meet requirements', 400);
    }

    // 1. Check duplicate user email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.isVerified) {
      throw new AppError('An account with this email address already exists', 409);
    }

    // 2. Check duplicate license number
    const existingLicense = await Doctor.findOne({ licenseNumber: normalizedLicense });
    if (existingLicense) {
      const linkedUser = await User.findById(existingLicense.userId);
      if (existingUser && existingLicense.userId.toString() === existingUser._id.toString()) {
        // Same unverified doctor restarting registration with same license, allowed.
      } else if (linkedUser && linkedUser.isVerified) {
        throw new AppError('Medical license number is already registered', 409);
      } else {
        // Stale unverified doctor record holding this license number -> release the reservation
        await Doctor.deleteOne({ _id: existingLicense._id });
      }
    }

    // 3. Check duplicate phone if provided
    if (phone && phone.trim()) {
      const normalizedPhone = phone.trim();
      const existingPhoneUser = await User.findOne({ phone: normalizedPhone });
      if (existingPhoneUser) {
        if (existingUser && existingPhoneUser._id.equals(existingUser._id)) {
          // Same user restarting registration with same phone.
        } else if (existingPhoneUser.isVerified) {
          throw new AppError('An account with this phone number already exists', 409);
        } else {
          // Stale unverified account holding this phone number -> safely release the phone reservation
          await User.updateOne({ _id: existingPhoneUser._id }, { $unset: { phone: 1 } });
        }
      }
    }

    const hashedPassword = await hashPassword(password);

    let user: UserDocument;

    if (existingUser && !existingUser.isVerified) {
      existingUser.firstName = firstName.trim();
      existingUser.lastName = lastName.trim();
      existingUser.password = hashedPassword;
      existingUser.phone = phone ? phone.trim() : undefined;
      existingUser.gender = gender;
      existingUser.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
      existingUser.bloodGroup = bloodGroup;
      existingUser.address = address ? address.trim() : undefined;
      existingUser.city = city ? city.trim() : undefined;
      existingUser.state = state ? state.trim() : undefined;
      existingUser.country = country ? country.trim() : undefined;
      existingUser.pincode = pincode ? pincode.trim() : undefined;
      existingUser.role = UserRole.DOCTOR;
      existingUser.isVerified = false;

      user = await existingUser.save();
    } else {
      user = new User({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : undefined,
        gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        bloodGroup,
        address: address ? address.trim() : undefined,
        city: city ? city.trim() : undefined,
        state: state ? state.trim() : undefined,
        country: country ? country.trim() : undefined,
        pincode: pincode ? pincode.trim() : undefined,
        role: UserRole.DOCTOR,
        isVerified: false
      });

      await user.save();
    }

    // Update or create linked Doctor profile
    let doctor = await Doctor.findOne({ userId: user._id });
    if (doctor) {
      doctor.licenseNumber = normalizedLicense;
      doctor.specialization = specialization.trim();
      doctor.experience = experience;
      doctor.qualification = qualification.trim();
      doctor.hospital = hospital.trim();
      doctor.consultationFee = consultationFee;
      doctor.languages = languages && languages.length > 0 ? languages : ['English'];
      doctor.availability = availability || [];
      doctor.verified = false;
      await doctor.save();
    } else {
      doctor = new Doctor({
        userId: user._id,
        licenseNumber: normalizedLicense,
        specialization: specialization.trim(),
        experience,
        qualification: qualification.trim(),
        hospital: hospital.trim(),
        consultationFee,
        languages: languages && languages.length > 0 ? languages : ['English'],
        availability: availability || [],
        verified: false
      });
      await doctor.save();
    }

    // Invalidate any existing OTPs for this email
    await Otp.updateMany(
      { email: normalizedEmail, isVerified: false },
      { expiresAt: new Date(Date.now() - 1000) }
    );

    // Generate & store verification OTP
    const { code, hash, expiresAt } = generateOtp();
    const otpDoc = new Otp({
      email: normalizedEmail,
      otpHash: hash,
      purpose: OtpPurpose.SIGNUP_VERIFICATION,
      expiresAt,
      attempts: 0,
      isVerified: false
    });
    await otpDoc.save();

    // Dispatch verification email
    try {
      await emailService.sendVerificationOtp(normalizedEmail, code, firstName.trim());
    } catch (err: any) {
      console.error(`[AuthService] Failed to send verification OTP email to ${normalizedEmail}:`, err);
    }

    return {
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        phone: user.phone,
        avatar: user.avatar,
        healthScore: user.healthScore
      },
      doctor: {
        id: doctor._id.toString(),
        licenseNumber: doctor.licenseNumber,
        specialization: doctor.specialization,
        hospital: doctor.hospital,
        consultationFee: doctor.consultationFee,
        verified: doctor.verified
      }
    };
  }

  public async verifyEmail(email: string, otp: string) {
    if (!email || !otp) {
      throw new AppError('Email and verification code are required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the latest active verification OTP for this email
    const otpDoc = await Otp.findOne({
      email: normalizedEmail,
      purpose: OtpPurpose.SIGNUP_VERIFICATION,
      isVerified: false
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      throw new AppError('Invalid or expired verification code', 400);
    }

    if (otpDoc.expiresAt.getTime() < Date.now()) {
      throw new AppError('Verification code has expired. Please request a new code.', 400);
    }

    if (otpDoc.attempts >= 5) {
      throw new AppError('Maximum verification attempts exceeded. Please request a new code.', 400);
    }

    const providedHash = hashToken(otp.trim());
    if (providedHash !== otpDoc.otpHash) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      throw new AppError('Invalid verification code', 400);
    }

    // Mark OTP as verified
    otpDoc.isVerified = true;
    otpDoc.verifiedAt = new Date();
    await otpDoc.save();

    // Mark User as verified
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      throw new AppError('User account not found', 404);
    }

    return { success: true };
  }

  public async resendOtp(email: string, purposeStr?: string) {
    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const purpose = (purposeStr as OtpPurpose) || OtpPurpose.SIGNUP_VERIFICATION;

    const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
    if (!user) {
      // Return success message to avoid account enumeration
      return { success: true };
    }

    // Invalidate existing active OTPs for this email and purpose
    await Otp.updateMany(
      { email: normalizedEmail, purpose, isVerified: false },
      { expiresAt: new Date(Date.now() - 1000) }
    );

    // Generate new OTP
    const { code, hash, expiresAt } = generateOtp();
    const otpDoc = new Otp({
      email: normalizedEmail,
      otpHash: hash,
      purpose,
      expiresAt,
      attempts: 0,
      isVerified: false
    });
    await otpDoc.save();

    if (purpose === OtpPurpose.PASSWORD_RESET) {
      await emailService.sendPasswordResetOtp(normalizedEmail, code, user.firstName);
    } else {
      await emailService.sendVerificationOtp(normalizedEmail, code, user.firstName);
    }

    return { success: true };
  }

  public async login(email: string, password: string, portal?: string, deviceInfo?: IDeviceInfo) {
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    let normalizedPortal: string | undefined = undefined;
    if (portal !== undefined && portal !== null && portal !== '') {
      if (typeof portal !== 'string') {
        throw new AppError("Invalid portal specified. Allowed values: 'patient', 'doctor'.", 400);
      }
      normalizedPortal = portal.toLowerCase().trim();
      if (normalizedPortal !== 'patient' && normalizedPortal !== 'doctor') {
        throw new AppError("Invalid portal specified. Allowed values: 'patient', 'doctor'.", 400);
      }
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail, isDeleted: false }).select('+password');
    if (!user || !user.password) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isVerified) {
      throw new AppError('Please verify your email address before logging in', 403, {
        isVerified: false
      });
    }

    // Enforce Portal Role Isolation BEFORE creating session or issuing tokens
    if (normalizedPortal) {
      if (normalizedPortal === 'patient' && user.role !== UserRole.PATIENT && user.role !== UserRole.ADMIN) {
        throw new AppError('This account cannot sign in through the selected portal.', 403);
      }
      if (normalizedPortal === 'doctor' && user.role !== UserRole.DOCTOR && user.role !== UserRole.ADMIN) {
        throw new AppError('This account cannot sign in through the selected portal.', 403);
      }
    }

    // Generate Access Token (signed JWT)
    const accessToken = generateAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    });

    // Generate Refresh Token (secure hash persistence)
    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashToken(rawRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const refreshTokenDoc = new RefreshToken({
      userId: user._id,
      tokenHash,
      expiresAt: refreshExpiresAt,
      isRevoked: false,
      deviceInfo
    });
    await refreshTokenDoc.save();

    const userJson = user.toJSON();

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: userJson._id.toString(),
        firstName: userJson.firstName,
        lastName: userJson.lastName,
        email: userJson.email,
        role: userJson.role,
        isVerified: userJson.isVerified,
        phone: userJson.phone,
        avatar: userJson.avatar,
        healthScore: userJson.healthScore
      }
    };
  }

  public async refreshSession(rawRefreshToken: string, deviceInfo?: IDeviceInfo) {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new AppError('Refresh token is required', 401);
    }

    const tokenHash = hashToken(rawRefreshToken.trim());

    const session = await RefreshToken.findOne({ tokenHash });
    if (!session) {
      throw new AppError('Invalid or unrecognized refresh token', 401);
    }

    if (session.isRevoked) {
      // Potential token theft/reuse: revoke all sessions for this user
      await RefreshToken.updateMany(
        { userId: session.userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date(), revokedReason: 'Token reuse detected' }
      );
      throw new AppError('Refresh token has been revoked', 401);
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new AppError('Refresh token has expired. Please log in again.', 401);
    }

    const user = await User.findOne({ _id: session.userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found or deactivated', 401);
    }

    // Rotate: Revoke the current token
    session.isRevoked = true;
    session.revokedAt = new Date();
    session.revokedReason = 'Token rotation';
    await session.save();

    // Generate new Access Token
    const accessToken = generateAccessToken({
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      isVerified: user.isVerified
    });

    // Generate new Refresh Token
    const newRawRefreshToken = generateRefreshTokenString();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const newSession = new RefreshToken({
      userId: user._id,
      tokenHash: newTokenHash,
      expiresAt: newExpiresAt,
      isRevoked: false,
      deviceInfo: deviceInfo || session.deviceInfo
    });
    await newSession.save();

    const userJson = user.toJSON();

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      user: {
        id: userJson._id.toString(),
        firstName: userJson.firstName,
        lastName: userJson.lastName,
        email: userJson.email,
        role: userJson.role,
        isVerified: userJson.isVerified,
        phone: userJson.phone,
        avatar: userJson.avatar,
        healthScore: userJson.healthScore
      }
    };
  }

  public async logout(rawRefreshToken?: string) {
    if (rawRefreshToken && typeof rawRefreshToken === 'string') {
      const tokenHash = hashToken(rawRefreshToken.trim());
      await RefreshToken.updateOne(
        { tokenHash, isRevoked: false },
        { isRevoked: true, revokedAt: new Date(), revokedReason: 'User logout' }
      );
    }

    return { success: true };
  }

  public async forgotPassword(email: string) {
    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail, isDeleted: false });
    if (user) {
      // Invalidate existing reset OTPs
      await Otp.updateMany(
        { email: normalizedEmail, purpose: OtpPurpose.PASSWORD_RESET, isVerified: false },
        { expiresAt: new Date(Date.now() - 1000) }
      );

      const { code, hash, expiresAt } = generateOtp();
      const otpDoc = new Otp({
        email: normalizedEmail,
        otpHash: hash,
        purpose: OtpPurpose.PASSWORD_RESET,
        expiresAt,
        attempts: 0,
        isVerified: false
      });
      await otpDoc.save();

      await emailService.sendPasswordResetOtp(normalizedEmail, code, user.firstName);
    }

    // Always return generic success message to prevent account enumeration
    return { success: true };
  }

  public async resetPassword(dto: ResetPasswordDto) {
    const { email, otp, newPassword } = dto;

    if (!email || !otp || !newPassword) {
      throw new AppError('Email, reset code, and new password are required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.message || 'Password does not meet requirements', 400);
    }

    const otpDoc = await Otp.findOne({
      email: normalizedEmail,
      purpose: OtpPurpose.PASSWORD_RESET,
      isVerified: false
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      throw new AppError('Invalid or expired password reset code', 400);
    }

    if (otpDoc.expiresAt.getTime() < Date.now()) {
      throw new AppError('Password reset code has expired. Please request a new one.', 400);
    }

    if (otpDoc.attempts >= 5) {
      throw new AppError('Maximum attempts exceeded. Please request a new reset code.', 400);
    }

    const providedHash = hashToken(otp.trim());
    if (providedHash !== otpDoc.otpHash) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      throw new AppError('Invalid password reset code', 400);
    }

    // Mark OTP as used
    otpDoc.isVerified = true;
    otpDoc.verifiedAt = new Date();
    await otpDoc.save();

    // Hash new password and update user
    const hashedPassword = await hashPassword(newPassword);
    const user = await User.findOneAndUpdate(
      { email: normalizedEmail, isDeleted: false },
      { password: hashedPassword }
    );

    if (!user) {
      throw new AppError('User account not found', 404);
    }

    // Revoke all existing refresh sessions for security
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'Password reset' }
    );

    // Send password reset confirmation email (safely handle if optional)
    if (emailService.sendPasswordResetConfirmation) {
      try {
        await emailService.sendPasswordResetConfirmation(normalizedEmail, user.firstName);
      } catch (emailErr) {
        console.warn('[AuthService] Non-blocking confirmation email delivery failure:', emailErr);
      }
    }

    return { success: true };
  }

  public async changePassword(userId: string, dto: ChangePasswordDto) {
    const { currentPassword, newPassword, confirmNewPassword } = dto;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      throw new AppError('Current password, new password, and confirmation are required', 400);
    }

    if (newPassword !== confirmNewPassword) {
      throw new AppError('New password and confirmation do not match', 400);
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.message || 'New password does not meet requirements', 400);
    }

    const user = await User.findOne({ _id: userId, isDeleted: false }).select('+password');
    if (!user || !user.password) {
      throw new AppError('User account not found', 404);
    }

    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    // Revoke all active refresh sessions for this user for security
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'Password changed by user' }
    );

    // Send password update confirmation email (non-blocking)
    if (emailService.sendPasswordResetConfirmation) {
      try {
        await emailService.sendPasswordResetConfirmation(user.email, user.firstName);
      } catch (emailErr) {
        console.warn('[AuthService] Non-blocking password change confirmation email delivery failed:', emailErr);
      }
    }

    return { success: true };
  }

  public async getUserProfile(userId: string) {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const userJson = user.toJSON();
    let doctorData: Record<string, unknown> | null = null;

    if (user.role === UserRole.DOCTOR) {
      const doctor = await Doctor.findOne({ userId: user._id });
      if (doctor) {
        doctorData = doctor.toJSON();
      }
    }

    const fullName = `${userJson.firstName || ''} ${userJson.lastName || ''}`.trim();
    const profilePhoto = userJson.avatar || null;

    return {
      user: {
        id: userJson._id.toString(),
        fullName,
        firstName: userJson.firstName,
        lastName: userJson.lastName,
        email: userJson.email,
        phone: userJson.phone || null,
        profilePhoto,
        avatar: profilePhoto,
        role: userJson.role,
        isVerified: userJson.isVerified,
        gender: userJson.gender || null,
        dateOfBirth: userJson.dateOfBirth || null,
        bloodGroup: userJson.bloodGroup || null,
        height: userJson.height,
        weight: userJson.weight,
        emergencyContact: userJson.emergencyContact,
        emergencyContacts: userJson.emergencyContacts || [],
        address: userJson.address,
        city: userJson.city,
        state: userJson.state,
        country: userJson.country,
        pincode: userJson.pincode,
        healthScore: userJson.healthScore,
        createdAt: userJson.createdAt,
        updatedAt: userJson.updatedAt
      },
      ...(doctorData ? { doctor: doctorData } : {})
    };
  }

  public async deleteAccount(userId: string) {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    user.isDeleted = true;
    await user.save();

    // Revoke all active refresh token sessions for security
    await RefreshToken.updateMany(
      { userId: user._id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'Account deletion' }
    );

    return { success: true };
  }
}

export const authService: AuthService = new AuthService();
