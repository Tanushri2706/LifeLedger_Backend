import { User, Otp, RefreshToken } from '../models';
import {
  UpdateUserProfileDto,
  Gender,
  BloodGroup,
  OtpPurpose
} from '../types';
import {
  AppError,
  generateOtp,
  hashToken
} from '../utils';
import { storageService } from './storage.service';
import { emailService } from './email.service';

export class UserService {
  /**
   * Helper to format sanitized user profile response
   */
  private formatUserProfile(user: any) {
    const userJson = typeof user.toJSON === 'function' ? user.toJSON() : user;
    const fullName = `${userJson.firstName || ''} ${userJson.lastName || ''}`.trim();
    const profilePhoto = userJson.avatar || null;

    return {
      id: userJson._id ? userJson._id.toString() : userJson.id,
      fullName,
      firstName: userJson.firstName,
      lastName: userJson.lastName,
      email: userJson.email,
      phone: userJson.phone || null,
      profilePhoto,
      avatar: profilePhoto,
      dateOfBirth: userJson.dateOfBirth || null,
      gender: userJson.gender || null,
      bloodGroup: userJson.bloodGroup || null,
      role: userJson.role,
      isVerified: Boolean(userJson.isVerified),
      createdAt: userJson.createdAt,
      updatedAt: userJson.updatedAt,
      // Optional profile context
      height: userJson.height,
      weight: userJson.weight,
      emergencyContact: userJson.emergencyContact,
      emergencyContacts: userJson.emergencyContacts || [],
      address: userJson.address,
      city: userJson.city,
      state: userJson.state,
      country: userJson.country,
      pincode: userJson.pincode,
      healthScore: userJson.healthScore
    };
  }

  /**
   * GET /api/v1/users/me
   */
  public async getProfile(userId: string) {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    return {
      user: this.formatUserProfile(user)
    };
  }

  /**
   * PATCH/PUT /api/v1/users/me
   * Generic profile update with strict whitelist
   */
  public async updateProfile(userId: string, dto: UpdateUserProfileDto) {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    // 1. Validate & Update Name (fullName or firstName/lastName)
    if (dto.fullName !== undefined) {
      if (typeof dto.fullName !== 'string' || !dto.fullName.trim() || dto.fullName.trim().length > 100) {
        throw new AppError('Full name must be between 1 and 100 characters', 400);
      }
      const trimmedFull = dto.fullName.trim();
      const parts = trimmedFull.split(/\s+/);
      const firstNamePart = parts[0] || trimmedFull;
      const lastNamePart = parts.length > 1 ? parts.slice(1).join(' ') : firstNamePart;
      user.firstName = firstNamePart;
      user.lastName = lastNamePart;
    } else {
      if (dto.firstName !== undefined) {
        if (typeof dto.firstName !== 'string' || !dto.firstName.trim() || dto.firstName.trim().length > 50) {
          throw new AppError('First name must be between 1 and 50 characters', 400);
        }
        user.firstName = dto.firstName.trim();
      }

      if (dto.lastName !== undefined) {
        if (typeof dto.lastName !== 'string' || !dto.lastName.trim() || dto.lastName.trim().length > 50) {
          throw new AppError('Last name must be between 1 and 50 characters', 400);
        }
        user.lastName = dto.lastName.trim();
      }
    }

    // 2. Validate & Update Phone (optional, safe validation, uniqueness check)
    if (dto.phone !== undefined) {
      if (dto.phone === null || (typeof dto.phone === 'string' && dto.phone.trim() === '')) {
        user.phone = undefined;
      } else if (typeof dto.phone === 'string') {
        const trimmedPhone = dto.phone.trim();
        // Safe phone validation: 7 to 20 alphanumeric/plus/dash characters without guessing country codes
        const phoneRegex = /^[+]?[0-9\s\-()]{7,20}$/;
        if (!phoneRegex.test(trimmedPhone)) {
          throw new AppError('Please provide a valid phone number', 400);
        }

        // Check phone uniqueness against other accounts
        const existingPhoneUser = await User.findOne({
          phone: trimmedPhone,
          _id: { $ne: user._id },
          isDeleted: false
        });
        if (existingPhoneUser) {
          throw new AppError('An account with this phone number already exists', 409);
        }

        user.phone = trimmedPhone;
      } else {
        throw new AppError('Phone number must be a valid string', 400);
      }
    }

    // 3. Validate & Update Gender Enum
    if (dto.gender !== undefined) {
      if (dto.gender === null || (typeof dto.gender === 'string' && dto.gender.trim() === '')) {
        user.gender = undefined;
      } else {
        if (!Object.values(Gender).includes(dto.gender)) {
          throw new AppError('Invalid gender value provided', 400);
        }
        user.gender = dto.gender;
      }
    }

    // 4. Validate & Update Blood Group Enum
    if (dto.bloodGroup !== undefined) {
      if (dto.bloodGroup === null || (typeof dto.bloodGroup === 'string' && dto.bloodGroup.trim() === '')) {
        user.bloodGroup = undefined;
      } else {
        if (!Object.values(BloodGroup).includes(dto.bloodGroup)) {
          throw new AppError('Invalid blood group value provided', 400);
        }
        user.bloodGroup = dto.bloodGroup;
      }
    }

    // 5. Validate & Update Date of Birth (must be valid past date)
    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth === null || (typeof dto.dateOfBirth === 'string' && dto.dateOfBirth.trim() === '')) {
        user.dateOfBirth = undefined;
      } else {
        const parsedDate = new Date(dto.dateOfBirth);
        if (isNaN(parsedDate.getTime())) {
          throw new AppError('Date of birth must be a valid date', 400);
        }
        if (parsedDate.getTime() > Date.now()) {
          throw new AppError('Date of birth cannot be in the future', 400);
        }
        user.dateOfBirth = parsedDate;
      }
    }

    // 6. Optional text / vitals fields if provided
    if (dto.height !== undefined) {
      if (typeof dto.height !== 'number' || isNaN(dto.height) || dto.height < 0 || dto.height > 300) {
        throw new AppError('Height must be a valid number between 0 and 300 cm', 400);
      }
      user.height = dto.height;
    }

    if (dto.weight !== undefined) {
      if (typeof dto.weight !== 'number' || isNaN(dto.weight) || dto.weight < 0 || dto.weight > 500) {
        throw new AppError('Weight must be a valid number between 0 and 500 kg', 400);
      }
      user.weight = dto.weight;
    }

    if (dto.emergencyContact !== undefined) user.emergencyContact = dto.emergencyContact;
    if (dto.address !== undefined) user.address = dto.address ? dto.address.trim() : undefined;
    if (dto.city !== undefined) user.city = dto.city ? dto.city.trim() : undefined;
    if (dto.state !== undefined) user.state = dto.state ? dto.state.trim() : undefined;
    if (dto.country !== undefined) user.country = dto.country ? dto.country.trim() : undefined;
    if (dto.pincode !== undefined) user.pincode = dto.pincode ? dto.pincode.trim() : undefined;

    // Strict Whitelist Enforcement:
    // Any attempt to modify email, password, role, isVerified, isDeleted, avatar, avatarPublicId,
    // healthScore, googleId, appleId is ignored and NOT saved.
    await user.save();

    return {
      user: this.formatUserProfile(user)
    };
  }

  /**
   * POST /api/v1/users/me/avatar
   * Isolated avatar upload & replacement
   */
  public async uploadAvatar(userId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new AppError('Avatar image file is required', 400);
    }

    // Strict image MIME validation
    const allowedImageMimes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ]);

    const mimeType = file.mimetype?.toLowerCase();
    if (!mimeType || !allowedImageMimes.has(mimeType)) {
      throw new AppError('Unsupported file type. Only JPEG, JPG, PNG, and WEBP images are allowed.', 400);
    }

    // Maximum avatar size: 5MB
    const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_AVATAR_SIZE) {
      throw new AppError('Avatar file size exceeds the 5MB limit', 413);
    }

    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const previousPublicId = user.avatarPublicId;

    // Dedicated isolated namespace for user avatars
    const avatarFolder = `lifeledger/users/${userId}/profile`;

    // 1. Upload new avatar first
    const uploadResult = await storageService.uploadFile(file, userId, avatarFolder);

    // 2. Persist new avatar reference
    user.avatar = uploadResult.fileUrl;
    user.avatarPublicId = uploadResult.publicId;
    await user.save();

    // 3. Safely delete old managed avatar if scoped to user profile folder
    if (previousPublicId && (previousPublicId.includes(`users/${userId}/profile`) || previousPublicId.includes('/profile/'))) {
      try {
        await storageService.deleteFile(previousPublicId, { resourceType: 'image' });
      } catch (err) {
        console.warn('[UserService] Non-blocking cleanup of previous avatar failed:', err);
      }
    }

    return {
      profilePhoto: user.avatar,
      avatar: user.avatar,
      user: this.formatUserProfile(user)
    };
  }

  /**
   * DELETE /api/v1/users/me/avatar
   * Remove profile photo
   */
  public async removeAvatar(userId: string) {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      throw new AppError('User account not found', 404);
    }

    const currentPublicId = user.avatarPublicId;
    if (currentPublicId && (currentPublicId.includes(`users/${userId}/profile`) || currentPublicId.includes('/profile/'))) {
      try {
        await storageService.deleteFile(currentPublicId, { resourceType: 'image' });
      } catch (err) {
        console.warn('[UserService] Non-blocking avatar deletion failed:', err);
      }
    }

    user.avatar = undefined;
    user.avatarPublicId = undefined;
    await user.save();

    return {
      profilePhoto: null,
      avatar: null,
      user: this.formatUserProfile(user)
    };
  }

  /**
   * POST /api/v1/users/me/email/request-change
   * Initiates verified email change flow
   */
  public async requestEmailChange(userId: string, newEmail?: string) {
    if (!newEmail || typeof newEmail !== 'string' || !newEmail.trim()) {
      throw new AppError('New email address is required', 400);
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedNewEmail)) {
      throw new AppError('Please provide a valid email address', 400);
    }

    const currentUser = await User.findOne({ _id: userId, isDeleted: false });
    if (!currentUser) {
      throw new AppError('User account not found', 404);
    }

    if (currentUser.email.toLowerCase().trim() === normalizedNewEmail) {
      throw new AppError('New email address must be different from current email', 400);
    }

    // Check if new email is already claimed by another account
    const existingUser = await User.findOne({
      email: normalizedNewEmail,
      _id: { $ne: currentUser._id },
      isDeleted: false
    });
    if (existingUser) {
      throw new AppError('An account with this email address already exists', 409);
    }

    // Invalidate prior active OTPs for this new email & purpose
    await Otp.updateMany(
      { email: normalizedNewEmail, purpose: OtpPurpose.EMAIL_CHANGE, isVerified: false },
      { expiresAt: new Date(Date.now() - 1000) }
    );

    // Generate secure 6-digit OTP
    const { code, hash, expiresAt } = generateOtp();
    const otpDoc = new Otp({
      email: normalizedNewEmail,
      otpHash: hash,
      purpose: OtpPurpose.EMAIL_CHANGE,
      expiresAt,
      attempts: 0,
      isVerified: false
    });
    await otpDoc.save();

    // Dispatch verification OTP to the NEW email address
    await emailService.sendEmailChangeOtp(normalizedNewEmail, code, currentUser.firstName);

    return {
      message: 'Verification code sent to the new email address.',
      newEmail: normalizedNewEmail
    };
  }

  /**
   * POST /api/v1/users/me/email/verify-change
   * Verifies OTP and atomically updates User email
   */
  public async verifyEmailChange(userId: string, newEmail?: string, otp?: string) {
    if (!newEmail || !otp) {
      throw new AppError('New email and verification code are required', 400);
    }

    const normalizedNewEmail = newEmail.toLowerCase().trim();

    const currentUser = await User.findOne({ _id: userId, isDeleted: false });
    if (!currentUser) {
      throw new AppError('User account not found', 404);
    }

    if (currentUser.email.toLowerCase().trim() === normalizedNewEmail) {
      throw new AppError('New email address must be different from current email', 400);
    }

    // Find latest active OTP for EMAIL_CHANGE
    const otpDoc = await Otp.findOne({
      email: normalizedNewEmail,
      purpose: OtpPurpose.EMAIL_CHANGE,
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

    // Race condition check: ensure email is not claimed by another user in the interim
    const conflictUser = await User.findOne({
      email: normalizedNewEmail,
      _id: { $ne: currentUser._id },
      isDeleted: false
    });
    if (conflictUser) {
      throw new AppError('An account with this email address already exists', 409);
    }

    // Mark OTP as verified/consumed to prevent replay
    otpDoc.isVerified = true;
    otpDoc.verifiedAt = new Date();
    await otpDoc.save();

    // Atomically update user email and ensure verification state is true
    currentUser.email = normalizedNewEmail;
    currentUser.isVerified = true;
    await currentUser.save();

    // Revoke all active refresh sessions for this user for security
    await RefreshToken.updateMany(
      { userId: currentUser._id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date(), revokedReason: 'Email address updated' }
    );

    return {
      user: this.formatUserProfile(currentUser)
    };
  }
}

export const userService: UserService = new UserService();
