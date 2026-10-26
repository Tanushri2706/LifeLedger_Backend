import { Types } from 'mongoose';
import { familyService } from './family.service';
import { User, FamilyMemberDocument, UserDocument } from '../models';
import { AppError } from '../utils';
import { FamilyMemberStatus } from '../types';

export interface IResolvedSubject {
  ownerUserId: Types.ObjectId;
  subjectType: 'user' | 'family_member';
  subjectId: Types.ObjectId;
  displayName: string;
  isOwner: boolean;
  familyMember?: FamilyMemberDocument;
  user?: UserDocument;
}

export interface ResolveSubjectOptions {
  forWrite?: boolean;
  allowArchived?: boolean;
}

export class SubjectResolverService {
  /**
   * Centralized subject resolution and authorization logic.
   * Enforces that:
   * - Personal subjects map to the authenticated user.
   * - Family member subjects resolve strictly through the authenticated owner's family vault.
   * - Cross-user familyMemberId attempts result in a privacy-safe 404.
   * - Archived family members reject write/upload operations with HTTP 400.
   */
  public async resolveHealthSubject(
    actorUserId: string,
    rawSubjectType?: string,
    rawSubjectId?: string,
    options: ResolveSubjectOptions = {}
  ): Promise<IResolvedSubject> {
    if (!Types.ObjectId.isValid(actorUserId)) {
      throw new AppError('Invalid account owner ID', 400);
    }

    const ownerObjId = new Types.ObjectId(actorUserId);
    const normalizedType = (rawSubjectType || 'user').toLowerCase().trim();

    if (normalizedType === 'user') {
      // If a subjectId is provided for user type, verify it matches actorUserId
      if (rawSubjectId && rawSubjectId !== actorUserId) {
        throw new AppError('Subject ID mismatch for personal health space', 403);
      }

      const user = await User.findOne({ _id: ownerObjId, isDeleted: false });
      if (!user) {
        throw new AppError('User account not found', 404);
      }

      return {
        ownerUserId: ownerObjId,
        subjectType: 'user',
        subjectId: ownerObjId,
        displayName: `${user.firstName || 'Personal'} ${user.lastName || ''}`.trim(),
        isOwner: true,
        user
      };
    }

    if (normalizedType === 'family_member') {
      if (!rawSubjectId || !Types.ObjectId.isValid(rawSubjectId)) {
        throw new AppError('Valid family member subjectId is required', 400);
      }

      // Assert ownership of the family member (privacy-safe 404 if not found or cross-user)
      const member = await familyService.getOwnedFamilyMember(actorUserId, rawSubjectId, {
        allowArchived: true
      });

      if (options.forWrite && member.status === FamilyMemberStatus.ARCHIVED) {
        throw new AppError('Cannot upload or analyze reports for an archived family member', 400);
      }

      return {
        ownerUserId: ownerObjId,
        subjectType: 'family_member',
        subjectId: member._id as Types.ObjectId,
        displayName: member.displayName,
        isOwner: false,
        familyMember: member
      };
    }

    throw new AppError('Invalid subjectType. Must be "user" or "family_member"', 400);
  }
}

export const subjectResolverService = new SubjectResolverService();
