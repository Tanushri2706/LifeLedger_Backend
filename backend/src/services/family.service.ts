import { Types } from 'mongoose';
import { FamilyMember, FamilyMemberDocument, FamilyAudit, User, MedicalShare } from '../models';
import {
  CreateFamilyMemberDto,
  UpdateFamilyMemberDto,
  FamilyMemberResponseDto,
  FamilyVaultSummaryDto,
  FamilyRelationship,
  FamilyMemberStatus,
  FamilyAuditAction,
  BloodGroup,
  Gender
} from '../types';
import { AppError } from '../utils';

export class FamilyService {
  /**
   * Calculates age in whole years from Date of Birth.
   */
  private calculateAge(dob?: Date | null): number | null {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }

  /**
   * Validates and normalizes phone numbers (7 to 15 numeric digits).
   */
  private normalizeAndValidatePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') {
      throw new AppError('Valid phone number is required', 400);
    }
    const trimmed = phone.trim();
    const cleaned = trimmed.replace(/[\s\-()]/g, '');
    const phoneRegex = /^\+?[0-9]{7,15}$/;
    if (!phoneRegex.test(cleaned)) {
      throw new AppError(
        'Phone number must contain between 7 and 15 digits (e.g. +919876543210 or 9876543210)',
        400
      );
    }
    return trimmed;
  }

  /**
   * Maps a Mongoose FamilyMember document to privacy-safe FamilyMemberResponseDto.
   * NEVER leaks owner credentials, password hashes, or internal database metadata.
   */
  public mapDocumentToDto(doc: FamilyMemberDocument): FamilyMemberResponseDto {
    const json = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
    const id = json._id ? json._id.toString() : String(doc.id || doc._id);

    return {
      id,
      displayName: json.displayName,
      relationship: json.relationship as FamilyRelationship,
      dateOfBirth: json.dateOfBirth ? new Date(json.dateOfBirth) : null,
      age: this.calculateAge(json.dateOfBirth),
      gender: json.gender || null,
      bloodGroup: json.bloodGroup || null,
      phone: json.phone || null,
      emergencyNotes: json.emergencyNotes || null,
      allergies: Array.isArray(json.allergies) ? json.allergies : [],
      medicalConditions: Array.isArray(json.medicalConditions) ? json.medicalConditions : [],
      managementAuthorizationConfirmed: Boolean(json.managementAuthorizationConfirmed),
      managementAuthorizationConfirmedAt: json.managementAuthorizationConfirmedAt
        ? new Date(json.managementAuthorizationConfirmedAt)
        : null,
      status: json.status as FamilyMemberStatus,
      archivedAt: json.archivedAt ? new Date(json.archivedAt) : null,
      createdAt: json.createdAt ? new Date(json.createdAt) : new Date(),
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : new Date()
    };
  }

  /**
   * Centralized Server-Side Ownership Assertion.
   * Ensures that the requested managed family profile belongs strictly to the authenticated owner.
   * Throws privacy-safe 404 if not found or owned by a different user.
   */
  public async getOwnedFamilyMember(
    ownerUserId: string,
    memberId: string,
    options?: { allowArchived?: boolean }
  ): Promise<FamilyMemberDocument> {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      throw new AppError('Invalid account owner ID', 400);
    }
    if (!Types.ObjectId.isValid(memberId)) {
      throw new AppError('Family member profile not found', 404);
    }

    const member = await FamilyMember.findOne({
      _id: new Types.ObjectId(memberId),
      ownerUserId: new Types.ObjectId(ownerUserId),
      isDeleted: false
    });

    if (!member) {
      throw new AppError('Family member profile not found', 404);
    }

    if (!options?.allowArchived && member.status === FamilyMemberStatus.ARCHIVED) {
      throw new AppError('Family member profile is archived. Restore profile to modify.', 400);
    }

    return member;
  }

  /**
   * Safe Audit Event Logger.
   * Stores high-level actor and action metadata without storing sensitive medical payloads in audit logs.
   */
  public async logAuditEvent(
    actorUserId: string,
    familyMemberId: Types.ObjectId | string,
    action: FamilyAuditAction,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      await FamilyAudit.create({
        actorUserId: new Types.ObjectId(actorUserId),
        familyMemberId: new Types.ObjectId(familyMemberId),
        action,
        details
      });
    } catch {
      // Safe non-blocking audit write
    }
  }

  // =========================================================================
  // 1. CREATE MANAGED FAMILY PROFILE
  // =========================================================================

  public async createMember(
    ownerUserId: string,
    dto: CreateFamilyMemberDto
  ): Promise<{ member: FamilyMemberResponseDto }> {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      throw new AppError('Invalid account owner ID', 400);
    }

    const owner = await User.findOne({ _id: new Types.ObjectId(ownerUserId), isDeleted: false });
    if (!owner) {
      throw new AppError('Account owner not found', 404);
    }

    // 1. Validate Display Name
    if (!dto.displayName || typeof dto.displayName !== 'string' || dto.displayName.trim().length < 2) {
      throw new AppError('Display name is required and must be at least 2 characters', 400);
    }
    if (dto.displayName.trim().length > 100) {
      throw new AppError('Display name cannot exceed 100 characters', 400);
    }

    // 2. Validate Relationship
    if (!dto.relationship || !Object.values(FamilyRelationship).includes(dto.relationship)) {
      throw new AppError(
        `Relationship must be one of: ${Object.values(FamilyRelationship).join(', ')}`,
        400
      );
    }

    // 3. Validate Date of Birth (No future DOB)
    let parsedDob: Date | undefined;
    if (dto.dateOfBirth !== undefined && dto.dateOfBirth !== null && dto.dateOfBirth !== '') {
      parsedDob = new Date(dto.dateOfBirth);
      if (isNaN(parsedDob.getTime())) {
        throw new AppError('Invalid date of birth provided', 400);
      }
      if (parsedDob > new Date()) {
        throw new AppError('Date of birth cannot be in the future', 400);
      }
    }

    // 4. Validate Gender
    if (dto.gender !== undefined && dto.gender !== null) {
      if (!Object.values(Gender).includes(dto.gender)) {
        throw new AppError('Invalid gender value provided', 400);
      }
    }

    // 5. Validate Blood Group
    if (dto.bloodGroup !== undefined && dto.bloodGroup !== null) {
      if (!Object.values(BloodGroup).includes(dto.bloodGroup)) {
        throw new BloodGroupValidationError();
      }
    }

    // 6. Validate Phone if provided
    let normalizedPhone: string | undefined;
    if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() !== '') {
      normalizedPhone = this.normalizeAndValidatePhone(dto.phone);
    }

    // 7. Validate Allergies
    let sanitizedAllergies: string[] = [];
    if (dto.allergies !== undefined && dto.allergies !== null) {
      if (!Array.isArray(dto.allergies)) {
        throw new AppError('Allergies must be provided as an array of strings', 400);
      }
      if (dto.allergies.length > 20) {
        throw new AppError('Cannot exceed 20 allergy entries', 400);
      }
      sanitizedAllergies = dto.allergies
        .filter((a) => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim().slice(0, 50));
    }

    // 8. Validate Medical Conditions
    let sanitizedConditions: string[] = [];
    if (dto.medicalConditions !== undefined && dto.medicalConditions !== null) {
      if (!Array.isArray(dto.medicalConditions)) {
        throw new AppError('Medical conditions must be provided as an array of strings', 400);
      }
      if (dto.medicalConditions.length > 20) {
        throw new AppError('Cannot exceed 20 medical condition entries', 400);
      }
      sanitizedConditions = dto.medicalConditions
        .filter((c) => typeof c === 'string' && c.trim().length > 0)
        .map((c) => c.trim().slice(0, 50));
    }

    // 9. Validate Emergency Notes
    let sanitizedNotes: string | undefined;
    if (dto.emergencyNotes !== undefined && dto.emergencyNotes !== null) {
      if (typeof dto.emergencyNotes !== 'string') {
        throw new AppError('Emergency notes must be a string', 400);
      }
      if (dto.emergencyNotes.trim().length > 500) {
        throw new AppError('Emergency notes cannot exceed 500 characters', 400);
      }
      sanitizedNotes = dto.emergencyNotes.trim();
    }

    // 10. Adult Authorization Acknowledgement
    const isAuthorized = Boolean(dto.managementAuthorizationConfirmed);
    const authorizedAt = isAuthorized ? new Date() : null;

    // Create Managed Family Profile strictly bound to ownerUserId
    const newMember = await FamilyMember.create({
      ownerUserId: owner._id,
      displayName: dto.displayName.trim(),
      relationship: dto.relationship,
      dateOfBirth: parsedDob,
      gender: dto.gender,
      bloodGroup: dto.bloodGroup,
      phone: normalizedPhone,
      emergencyNotes: sanitizedNotes,
      allergies: sanitizedAllergies,
      medicalConditions: sanitizedConditions,
      managementAuthorizationConfirmed: isAuthorized,
      managementAuthorizationConfirmedAt: authorizedAt,
      status: FamilyMemberStatus.ACTIVE,
      isDeleted: false
    });

    await this.logAuditEvent(ownerUserId, newMember._id, FamilyAuditAction.MEMBER_CREATED, {
      relationship: newMember.relationship
    });

    return { member: this.mapDocumentToDto(newMember) };
  }

  // =========================================================================
  // 2. LIST MANAGED FAMILY PROFILES
  // =========================================================================

  public async getMembers(
    ownerUserId: string,
    query?: { status?: string; includeArchived?: boolean | string }
  ): Promise<{ members: FamilyMemberResponseDto[]; count: number }> {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      throw new AppError('Invalid account owner ID', 400);
    }

    const matchFilter: Record<string, unknown> = {
      ownerUserId: new Types.ObjectId(ownerUserId),
      isDeleted: false
    };

    const includeArchived =
      query?.includeArchived === true ||
      query?.includeArchived === 'true' ||
      query?.status === 'all';

    if (query?.status === 'archived') {
      matchFilter.status = FamilyMemberStatus.ARCHIVED;
    } else if (!includeArchived) {
      matchFilter.status = FamilyMemberStatus.ACTIVE;
    }

    const documents = await FamilyMember.find(matchFilter).sort({ createdAt: -1 });

    const members = documents.map((doc) => this.mapDocumentToDto(doc));

    return {
      members,
      count: members.length
    };
  }

  // =========================================================================
  // 3. GET SINGLE FAMILY PROFILE DETAILS
  // =========================================================================

  public async getMemberById(
    ownerUserId: string,
    memberId: string
  ): Promise<{ member: FamilyMemberResponseDto }> {
    const member = await this.getOwnedFamilyMember(ownerUserId, memberId, { allowArchived: true });
    return { member: this.mapDocumentToDto(member) };
  }

  // =========================================================================
  // 4. UPDATE MANAGED FAMILY PROFILE
  // =========================================================================

  public async updateMember(
    ownerUserId: string,
    memberId: string,
    dto: UpdateFamilyMemberDto
  ): Promise<{ member: FamilyMemberResponseDto }> {
    const member = await this.getOwnedFamilyMember(ownerUserId, memberId, { allowArchived: false });

    // Update Display Name
    if (dto.displayName !== undefined) {
      if (typeof dto.displayName !== 'string' || dto.displayName.trim().length < 2) {
        throw new AppError('Display name must be at least 2 characters', 400);
      }
      if (dto.displayName.trim().length > 100) {
        throw new AppError('Display name cannot exceed 100 characters', 400);
      }
      member.displayName = dto.displayName.trim();
    }

    // Update Relationship
    if (dto.relationship !== undefined) {
      if (!Object.values(FamilyRelationship).includes(dto.relationship)) {
        throw new AppError(
          `Relationship must be one of: ${Object.values(FamilyRelationship).join(', ')}`,
          400
        );
      }
      member.relationship = dto.relationship;
    }

    // Update Date of Birth
    if (dto.dateOfBirth !== undefined) {
      if (dto.dateOfBirth === null || dto.dateOfBirth === '') {
        member.dateOfBirth = undefined;
      } else {
        const parsedDob = new Date(dto.dateOfBirth);
        if (isNaN(parsedDob.getTime())) {
          throw new AppError('Invalid date of birth provided', 400);
        }
        if (parsedDob > new Date()) {
          throw new AppError('Date of birth cannot be in the future', 400);
        }
        member.dateOfBirth = parsedDob;
      }
    }

    // Update Gender
    if (dto.gender !== undefined) {
      if (dto.gender === null) {
        member.gender = undefined;
      } else {
        if (!Object.values(Gender).includes(dto.gender)) {
          throw new AppError('Invalid gender value provided', 400);
        }
        member.gender = dto.gender;
      }
    }

    // Update Blood Group
    if (dto.bloodGroup !== undefined) {
      if (dto.bloodGroup === null) {
        member.bloodGroup = undefined;
      } else {
        if (!Object.values(BloodGroup).includes(dto.bloodGroup)) {
          throw new BloodGroupValidationError();
        }
        member.bloodGroup = dto.bloodGroup;
      }
    }

    // Update Phone
    if (dto.phone !== undefined) {
      if (dto.phone === null || dto.phone.trim() === '') {
        member.phone = undefined;
      } else {
        member.phone = this.normalizeAndValidatePhone(dto.phone);
      }
    }

    // Update Allergies
    if (dto.allergies !== undefined) {
      if (!Array.isArray(dto.allergies)) {
        throw new AppError('Allergies must be provided as an array of strings', 400);
      }
      if (dto.allergies.length > 20) {
        throw new AppError('Cannot exceed 20 allergy entries', 400);
      }
      member.allergies = dto.allergies
        .filter((a) => typeof a === 'string' && a.trim().length > 0)
        .map((a) => a.trim().slice(0, 50));
    }

    // Update Medical Conditions
    if (dto.medicalConditions !== undefined) {
      if (!Array.isArray(dto.medicalConditions)) {
        throw new AppError('Medical conditions must be provided as an array of strings', 400);
      }
      if (dto.medicalConditions.length > 20) {
        throw new AppError('Cannot exceed 20 medical condition entries', 400);
      }
      member.medicalConditions = dto.medicalConditions
        .filter((c) => typeof c === 'string' && c.trim().length > 0)
        .map((c) => c.trim().slice(0, 50));
    }

    // Update Emergency Notes
    if (dto.emergencyNotes !== undefined) {
      if (dto.emergencyNotes === null || dto.emergencyNotes.trim() === '') {
        member.emergencyNotes = undefined;
      } else {
        if (dto.emergencyNotes.trim().length > 500) {
          throw new AppError('Emergency notes cannot exceed 500 characters', 400);
        }
        member.emergencyNotes = dto.emergencyNotes.trim();
      }
    }

    // Update Management Authorization Acknowledgement
    if (dto.managementAuthorizationConfirmed !== undefined) {
      member.managementAuthorizationConfirmed = Boolean(dto.managementAuthorizationConfirmed);
      member.managementAuthorizationConfirmedAt = member.managementAuthorizationConfirmed
        ? member.managementAuthorizationConfirmedAt || new Date()
        : null;
    }

    await member.save();

    await this.logAuditEvent(ownerUserId, member._id, FamilyAuditAction.MEMBER_UPDATED);

    return { member: this.mapDocumentToDto(member) };
  }

  // =========================================================================
  // 5. ARCHIVE / REMOVE MANAGED FAMILY PROFILE (NON-CASCADE SOFT-ARCHIVE)
  // =========================================================================

  public async archiveMember(
    ownerUserId: string,
    memberId: string
  ): Promise<{ message: string; member: FamilyMemberResponseDto }> {
    const member = await this.getOwnedFamilyMember(ownerUserId, memberId, { allowArchived: true });

    if (member.status === FamilyMemberStatus.ARCHIVED) {
      return {
        message: 'Family member profile is already archived',
        member: this.mapDocumentToDto(member)
      };
    }

    member.status = FamilyMemberStatus.ARCHIVED;
    member.archivedAt = new Date();
    await member.save();

    // Revoke any active medical shares associated with this family member profile
    try {
      await MedicalShare.updateMany(
        {
          ownerUserId: new Types.ObjectId(ownerUserId),
          subjectType: 'family_member',
          subjectId: member._id,
          status: 'active'
        },
        {
          $set: {
            status: 'revoked',
            revokedAt: new Date(),
            activeSessionTokenHash: undefined,
            sessionExpiresAt: undefined
          }
        }
      );
    } catch {
      // Non-blocking
    }

    await this.logAuditEvent(ownerUserId, member._id, FamilyAuditAction.MEMBER_ARCHIVED);

    return {
      message: 'Family member profile archived successfully',
      member: this.mapDocumentToDto(member)
    };
  }

  // =========================================================================
  // 6. RESTORE ARCHIVED MANAGED FAMILY PROFILE
  // =========================================================================

  public async restoreMember(
    ownerUserId: string,
    memberId: string
  ): Promise<{ message: string; member: FamilyMemberResponseDto }> {
    const member = await this.getOwnedFamilyMember(ownerUserId, memberId, { allowArchived: true });

    if (member.status === FamilyMemberStatus.ACTIVE) {
      return {
        message: 'Family member profile is already active',
        member: this.mapDocumentToDto(member)
      };
    }

    member.status = FamilyMemberStatus.ACTIVE;
    member.archivedAt = null;
    await member.save();

    await this.logAuditEvent(ownerUserId, member._id, FamilyAuditAction.MEMBER_RESTORED);

    return {
      message: 'Family member profile restored successfully',
      member: this.mapDocumentToDto(member)
    };
  }

  // =========================================================================
  // 7. FAMILY VAULT SUMMARY
  // =========================================================================

  public async getVaultSummary(ownerUserId: string): Promise<FamilyVaultSummaryDto> {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      throw new AppError('Invalid account owner ID', 400);
    }

    const members = await FamilyMember.find({
      ownerUserId: new Types.ObjectId(ownerUserId),
      isDeleted: false
    });

    let activeMemberCount = 0;
    let archivedMemberCount = 0;
    const relationshipsSummary: Record<string, number> = {};

    members.forEach((m) => {
      if (m.status === FamilyMemberStatus.ACTIVE) {
        activeMemberCount++;
      } else if (m.status === FamilyMemberStatus.ARCHIVED) {
        archivedMemberCount++;
      }

      const rel = m.relationship || 'other';
      relationshipsSummary[rel] = (relationshipsSummary[rel] || 0) + 1;
    });

    return {
      activeMemberCount,
      archivedMemberCount,
      totalMembers: members.length,
      relationshipsSummary
    };
  }
}

class BloodGroupValidationError extends AppError {
  constructor() {
    super(`Blood group must be one of: ${Object.values(BloodGroup).join(', ')}`, 400);
  }
}

export const familyService: FamilyService = new FamilyService();
