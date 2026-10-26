import crypto from 'crypto';
import { Types } from 'mongoose';
import { MedicalShare, MedicalShareDocument, MedicalReport } from '../models';
import {
  CreateMedicalShareDto,
  MedicalShareCreatedResponseDto,
  MedicalShareOwnerResponseDto,
  PublicMedicalShareMetadataDto,
  PublicMedicalShareAccessSessionDto,
  PublicMedicalShareDocumentDownloadDto,
  SharedReportSummaryDto,
  MedicalShareAccessMode,
  FamilyAuditAction
} from '../types';
import { subjectResolverService } from './subjectResolver.service';
import { familyService } from './family.service';
import { storageService } from './storage.service';
import { AppError } from '../utils';

export class MedicalShareService {
  /**
   * Generates a 256-bit cryptographically secure random token (64 hex characters).
   */
  private generateRawToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Computes SHA-256 hash of a raw token for secure database indexing and lookup.
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Maps MedicalShare document to owner response DTO.
   * NEVER returns the raw token or token hash.
   */
  private mapToOwnerDto(
    doc: MedicalShareDocument,
    subjectDisplayName: string,
    reports?: SharedReportSummaryDto[]
  ): MedicalShareOwnerResponseDto {
    const id = doc._id ? doc._id.toString() : String(doc.id);
    return {
      id,
      subject: {
        type: doc.subjectType,
        id: doc.subjectId.toString(),
        displayName: subjectDisplayName
      },
      reportCount: doc.selectedReportIds?.length || 0,
      selectedReports: reports,
      accessMode: doc.accessMode,
      status: doc.status,
      expiresAt: doc.expiresAt,
      consumedAt: doc.consumedAt || null,
      revokedAt: doc.revokedAt || null,
      lastAccessedAt: doc.lastAccessedAt || null,
      accessCount: doc.accessCount || 0,
      createdAt: doc.createdAt || new Date(),
      updatedAt: doc.updatedAt || new Date()
    };
  }

  // =========================================================================
  // 1. CREATE MEDICAL SHARE (AUTHENTICATED OWNER)
  // =========================================================================

  public async createShare(
    ownerUserId: string,
    dto: CreateMedicalShareDto
  ): Promise<MedicalShareCreatedResponseDto> {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      throw new AppError('Invalid account owner ID', 400);
    }

    // 1. Resolve Subject using centralized SubjectResolver (verifies ownership & active status)
    const subject = await subjectResolverService.resolveHealthSubject(
      ownerUserId,
      dto.subjectType,
      dto.subjectId,
      { forWrite: true }
    );

    // 2. Validate selected report IDs
    if (!dto.reportIds || !Array.isArray(dto.reportIds) || dto.reportIds.length === 0) {
      throw new AppError('At least one medical report must be selected for sharing', 400);
    }

    if (dto.reportIds.length > 20) {
      throw new AppError('Cannot share more than 20 medical reports in a single share package', 400);
    }

    // Deduplicate report IDs
    const uniqueReportIds = Array.from(new Set(dto.reportIds.map((id) => String(id).trim())));
    const reportObjectIds: Types.ObjectId[] = [];

    for (const rid of uniqueReportIds) {
      if (!Types.ObjectId.isValid(rid)) {
        throw new AppError(`Invalid report ID provided: ${rid}`, 400);
      }
      reportObjectIds.push(new Types.ObjectId(rid));
    }

    // 3. Query all selected reports and assert strict subject & owner boundary
    const reports = await MedicalReport.find({
      _id: { $in: reportObjectIds },
      isDeleted: false
    });

    if (reports.length !== reportObjectIds.length) {
      throw new AppError('One or more selected reports do not exist or have been deleted', 400);
    }

    // Assert that every report belongs strictly to the resolved subject and owner
    for (const rep of reports) {
      const isOwnerMatch = rep.ownerUserId.toString() === subject.ownerUserId.toString();
      const isSubjectTypeMatch = rep.subjectType === subject.subjectType;
      const isSubjectIdMatch = rep.subjectId.toString() === subject.subjectId.toString();

      if (!isOwnerMatch || !isSubjectTypeMatch || !isSubjectIdMatch) {
        throw new AppError(
          'All selected reports must belong exclusively to the selected medical subject. Mixed-subject shares are prohibited.',
          400
        );
      }
    }

    // 4. Determine access mode and expiration policy
    const accessMode: MedicalShareAccessMode =
      dto.accessMode === 'time_limited' ? 'time_limited' : 'one_time';

    let expiresInMinutes = 15;
    if (accessMode === 'time_limited') {
      const requestedMinutes = Number(dto.expiresInMinutes) || 60;
      // Controlled server-approved durations: 15 mins or 60 mins (capped at 60 mins)
      expiresInMinutes = Math.min(Math.max(requestedMinutes, 15), 60);
    } else {
      // For one-time mode, default 15 minutes window to initiate access
      const requestedMinutes = Number(dto.expiresInMinutes) || 15;
      expiresInMinutes = Math.min(Math.max(requestedMinutes, 5), 60);
    }

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    // 5. Generate fresh cryptographically secure 256-bit raw token & SHA-256 hash
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);

    // 6. Persist MedicalShare record
    const share = await MedicalShare.create({
      ownerUserId: subject.ownerUserId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      selectedReportIds: reportObjectIds,
      tokenHash,
      accessMode,
      expiresAt,
      status: 'active',
      accessCount: 0
    });

    // 7. Audit log
    if (subject.subjectType === 'family_member') {
      await familyService.logAuditEvent(
        ownerUserId,
        subject.subjectId,
        FamilyAuditAction.MEDICAL_SHARE_CREATED,
        {
          shareId: share._id.toString(),
          reportCount: reportObjectIds.length,
          accessMode
        }
      );
    }

    const shareUrl = `/medical-share/${rawToken}`;

    return {
      shareId: share._id.toString(),
      rawToken,
      shareUrl,
      subject: {
        type: subject.subjectType,
        id: subject.subjectId.toString(),
        displayName: subject.displayName
      },
      selectedReportCount: reportObjectIds.length,
      accessMode,
      expiresAt,
      status: 'active',
      createdAt: share.createdAt || new Date()
    };
  }

  // =========================================================================
  // 2. PUBLIC SHARE LANDING METADATA (NON-CONSUMING GET)
  // =========================================================================

  public async getPublicShareMetadata(rawToken: string): Promise<PublicMedicalShareMetadataDto> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
      throw new AppError('Medical share not found or link is invalid', 404);
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const share = await MedicalShare.findOne({ tokenHash });

    if (!share) {
      throw new AppError('Medical share not found or link is invalid', 404);
    }

    // Check Revocation
    if (share.status === 'revoked') {
      throw new AppError('This medical share has been revoked by the owner', 410);
    }

    // Check Expiration
    if (Date.now() > share.expiresAt.getTime()) {
      if (share.status !== 'expired') {
        share.status = 'expired';
        await share.save();
      }
      throw new AppError('This medical share has expired', 410);
    }

    // Check One-Time Consumed status
    if (share.status === 'consumed' && share.accessMode === 'one_time') {
      throw new AppError('This one-time medical share has already been accessed and consumed', 410);
    }

    // Resolve Subject Display Name safely
    let subjectDisplayName = 'Personal Record';
    try {
      const resolved = await subjectResolverService.resolveHealthSubject(
        share.ownerUserId.toString(),
        share.subjectType,
        share.subjectId.toString(),
        { allowArchived: true }
      );
      subjectDisplayName = resolved.displayName;
    } catch {
      subjectDisplayName = share.subjectType === 'user' ? 'Personal Record' : 'Family Member';
    }

    // Count non-deleted selected reports
    const activeReportCount = await MedicalReport.countDocuments({
      _id: { $in: share.selectedReportIds },
      isDeleted: false
    });

    return {
      shareId: share._id.toString(),
      subjectDisplayName,
      reportCount: activeReportCount,
      accessMode: share.accessMode,
      expiresAt: share.expiresAt,
      status: share.status,
      isReadyForAccess: share.status === 'active' && activeReportCount > 0
    };
  }

  // =========================================================================
  // 3. EXPLICIT RECIPIENT ACCESS ACTIVATION (ATOMIC CONSUMPTION & SESSION ISSUANCE)
  // =========================================================================

  public async accessPublicShare(rawToken: string): Promise<PublicMedicalShareAccessSessionDto> {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
      throw new AppError('Medical share not found or link is invalid', 404);
    }

    const tokenHash = this.hashToken(rawToken.trim());
    const existingShare = await MedicalShare.findOne({ tokenHash });

    if (!existingShare) {
      throw new AppError('Medical share not found or link is invalid', 404);
    }

    if (existingShare.status === 'revoked') {
      throw new AppError('This medical share has been revoked by the owner', 410);
    }

    if (Date.now() > existingShare.expiresAt.getTime()) {
      if (existingShare.status !== 'expired') {
        existingShare.status = 'expired';
        await existingShare.save();
      }
      throw new AppError('This medical share has expired', 410);
    }

    if (existingShare.status === 'consumed' && existingShare.accessMode === 'one_time') {
      throw new AppError('This one-time medical share has already been accessed and consumed', 410);
    }

    // Generate Recipient Access Session Token
    const sessionToken = this.generateRawToken();
    const sessionTokenHash = this.hashToken(sessionToken);

    // Session duration is 15 minutes (or capped at share expiration for time-limited mode)
    const sessionDurationMs = 15 * 60 * 1000;
    const sessionExpiresAt =
      existingShare.accessMode === 'time_limited'
        ? new Date(Math.min(Date.now() + sessionDurationMs, existingShare.expiresAt.getTime()))
        : new Date(Date.now() + sessionDurationMs);

    let updatedShare: MedicalShareDocument | null = null;

    if (existingShare.accessMode === 'one_time') {
      // Atomic consumption check-and-set: prevents concurrent recipients from consuming same token
      updatedShare = await MedicalShare.findOneAndUpdate(
        {
          _id: existingShare._id,
          status: 'active',
          expiresAt: { $gt: new Date() }
        },
        {
          $set: {
            status: 'consumed',
            consumedAt: new Date(),
            lastAccessedAt: new Date(),
            activeSessionTokenHash: sessionTokenHash,
            sessionExpiresAt
          },
          $inc: { accessCount: 1 }
        },
        { new: true }
      );

      if (!updatedShare) {
        throw new AppError(
          'This one-time medical share has already been consumed or is no longer active',
          410
        );
      }
    } else {
      // Time-limited activation: grants access session
      updatedShare = await MedicalShare.findOneAndUpdate(
        {
          _id: existingShare._id,
          status: 'active',
          expiresAt: { $gt: new Date() }
        },
        {
          $set: {
            lastAccessedAt: new Date(),
            activeSessionTokenHash: sessionTokenHash,
            sessionExpiresAt
          },
          $inc: { accessCount: 1 }
        },
        { new: true }
      );

      if (!updatedShare) {
        throw new AppError('This medical share has expired or is no longer active', 410);
      }
    }

    // Audit log
    if (updatedShare.subjectType === 'family_member') {
      await familyService.logAuditEvent(
        updatedShare.ownerUserId.toString(),
        updatedShare.subjectId,
        FamilyAuditAction.MEDICAL_SHARE_ACCESSED,
        {
          shareId: updatedShare._id.toString(),
          accessMode: updatedShare.accessMode
        }
      );
    }

    // Resolve subject display name
    let subjectDisplayName = 'Personal Record';
    try {
      const resolved = await subjectResolverService.resolveHealthSubject(
        updatedShare.ownerUserId.toString(),
        updatedShare.subjectType,
        updatedShare.subjectId.toString(),
        { allowArchived: true }
      );
      subjectDisplayName = resolved.displayName;
    } catch {
      subjectDisplayName = updatedShare.subjectType === 'user' ? 'Personal Record' : 'Family Member';
    }

    // Fetch only the non-deleted selected reports
    const reports = await MedicalReport.find({
      _id: { $in: updatedShare.selectedReportIds },
      isDeleted: false
    }).sort({ reportDate: -1 });

    const reportSummaries: SharedReportSummaryDto[] = reports.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      category: r.category,
      reportType: r.reportType,
      reportDate: r.reportDate,
      fileType: r.fileType,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      originalFilename: r.originalFilename
    }));

    return {
      sessionToken,
      sessionExpiresAt,
      subjectDisplayName,
      reports: reportSummaries
    };
  }

  // =========================================================================
  // 4. SESSION-PROTECTED RECIPIENT OPERATIONS
  // =========================================================================

  /**
   * Validates a recipient access session token and retrieves the associated active MedicalShare.
   */
  public async validateSession(sessionToken: string): Promise<MedicalShareDocument> {
    if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.trim().length < 16) {
      throw new AppError('Invalid or missing medical share session', 401);
    }

    const sessionTokenHash = this.hashToken(sessionToken.trim());
    const share = await MedicalShare.findOne({
      activeSessionTokenHash: sessionTokenHash
    });

    if (!share) {
      throw new AppError('Invalid or expired medical share session', 401);
    }

    if (share.status === 'revoked') {
      throw new AppError('This medical share was revoked by the owner', 403);
    }

    if (share.sessionExpiresAt && Date.now() > share.sessionExpiresAt.getTime()) {
      throw new AppError('Medical share session has expired. Please request a new access link.', 401);
    }

    return share;
  }

  public async getReportsForSession(
    sessionToken: string
  ): Promise<{ subjectDisplayName: string; reports: SharedReportSummaryDto[] }> {
    const share = await this.validateSession(sessionToken);

    let subjectDisplayName = 'Personal Record';
    try {
      const resolved = await subjectResolverService.resolveHealthSubject(
        share.ownerUserId.toString(),
        share.subjectType,
        share.subjectId.toString(),
        { allowArchived: true }
      );
      subjectDisplayName = resolved.displayName;
    } catch {
      subjectDisplayName = share.subjectType === 'user' ? 'Personal Record' : 'Family Member';
    }

    const reports = await MedicalReport.find({
      _id: { $in: share.selectedReportIds },
      isDeleted: false
    }).sort({ reportDate: -1 });

    const reportSummaries: SharedReportSummaryDto[] = reports.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      category: r.category,
      reportType: r.reportType,
      reportDate: r.reportDate,
      fileType: r.fileType,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      originalFilename: r.originalFilename
    }));

    return {
      subjectDisplayName,
      reports: reportSummaries
    };
  }

  public async getReportDownloadForSession(
    sessionToken: string,
    reportId: string
  ): Promise<PublicMedicalShareDocumentDownloadDto> {
    const share = await this.validateSession(sessionToken);

    if (!Types.ObjectId.isValid(reportId)) {
      throw new AppError('Invalid report ID requested', 400);
    }

    const reportObjId = new Types.ObjectId(reportId);

    // Verify report is part of selectedReportIds in this share
    const isSelected = share.selectedReportIds.some((id) => id.toString() === reportId);
    if (!isSelected) {
      throw new AppError('Report is not part of this shared package', 404);
    }

    const report = await MedicalReport.findOne({
      _id: reportObjId,
      isDeleted: false
    });

    if (!report) {
      throw new AppError('Medical report not found or has been removed', 404);
    }

    // Generate temporary signed Cloudinary download URL
    const downloadUrl = await storageService.getSignedDownloadUrl(
      report.publicId,
      report.originalFilename,
      {
        resourceType: report.resourceType,
        deliveryType: report.deliveryType,
        format: report.format
      }
    );

    return {
      downloadUrl,
      originalFilename: report.originalFilename,
      fileName: report.originalFilename,
      mimeType: report.mimeType,
      fileSize: report.fileSize
    };
  }

  // =========================================================================
  // 5. REVOKE MEDICAL SHARE (AUTHENTICATED OWNER)
  // =========================================================================

  public async revokeShare(
    ownerUserId: string,
    shareId: string
  ): Promise<{ message: string; share: MedicalShareOwnerResponseDto }> {
    if (!Types.ObjectId.isValid(ownerUserId) || !Types.ObjectId.isValid(shareId)) {
      throw new AppError('Invalid ID provided', 400);
    }

    const share = await MedicalShare.findOne({
      _id: new Types.ObjectId(shareId),
      ownerUserId: new Types.ObjectId(ownerUserId)
    });

    if (!share) {
      throw new AppError('Medical share not found', 404);
    }

    share.status = 'revoked';
    share.revokedAt = new Date();
    share.activeSessionTokenHash = undefined;
    share.sessionExpiresAt = undefined;
    await share.save();

    if (share.subjectType === 'family_member') {
      await familyService.logAuditEvent(
        ownerUserId,
        share.subjectId,
        FamilyAuditAction.MEDICAL_SHARE_REVOKED,
        { shareId: share._id.toString() }
      );
    }

    let subjectDisplayName = 'Personal Record';
    try {
      const resolved = await subjectResolverService.resolveHealthSubject(
        ownerUserId,
        share.subjectType,
        share.subjectId.toString(),
        { allowArchived: true }
      );
      subjectDisplayName = resolved.displayName;
    } catch {
      subjectDisplayName = share.subjectType === 'user' ? 'Personal Record' : 'Family Member';
    }

    return {
      message: 'Medical share revoked successfully',
      share: this.mapToOwnerDto(share, subjectDisplayName)
    };
  }

  // =========================================================================
  // 6. OWNER SHARE LISTING & DETAIL
  // =========================================================================

  public async listOwnerShares(
    ownerUserId: string,
    query?: { subjectType?: string; subjectId?: string; status?: string }
  ): Promise<{ shares: MedicalShareOwnerResponseDto[]; count: number }> {
    if (!Types.ObjectId.isValid(ownerUserId)) {
      throw new AppError('Invalid account owner ID', 400);
    }

    const filter: Record<string, unknown> = {
      ownerUserId: new Types.ObjectId(ownerUserId)
    };

    if (query?.subjectType) {
      filter.subjectType = query.subjectType;
    }
    if (query?.subjectId && Types.ObjectId.isValid(query.subjectId)) {
      filter.subjectId = new Types.ObjectId(query.subjectId);
    }
    if (query?.status) {
      filter.status = query.status;
    }

    const docs = await MedicalShare.find(filter).sort({ createdAt: -1 });

    const shares: MedicalShareOwnerResponseDto[] = [];
    for (const doc of docs) {
      let displayName = doc.subjectType === 'user' ? 'Personal Record' : 'Family Member';
      try {
        const resolved = await subjectResolverService.resolveHealthSubject(
          ownerUserId,
          doc.subjectType,
          doc.subjectId.toString(),
          { allowArchived: true }
        );
        displayName = resolved.displayName;
      } catch {
        // Fallback
      }

      shares.push(this.mapToOwnerDto(doc, displayName));
    }

    return {
      shares,
      count: shares.length
    };
  }

  public async getOwnerShareDetail(
    ownerUserId: string,
    shareId: string
  ): Promise<{ share: MedicalShareOwnerResponseDto }> {
    if (!Types.ObjectId.isValid(ownerUserId) || !Types.ObjectId.isValid(shareId)) {
      throw new AppError('Medical share not found', 404);
    }

    const share = await MedicalShare.findOne({
      _id: new Types.ObjectId(shareId),
      ownerUserId: new Types.ObjectId(ownerUserId)
    });

    if (!share) {
      throw new AppError('Medical share not found', 404);
    }

    let displayName = share.subjectType === 'user' ? 'Personal Record' : 'Family Member';
    try {
      const resolved = await subjectResolverService.resolveHealthSubject(
        ownerUserId,
        share.subjectType,
        share.subjectId.toString(),
        { allowArchived: true }
      );
      displayName = resolved.displayName;
    } catch {
      // Fallback
    }

    const reports = await MedicalReport.find({
      _id: { $in: share.selectedReportIds },
      isDeleted: false
    }).sort({ reportDate: -1 });

    const reportSummaries: SharedReportSummaryDto[] = reports.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      category: r.category,
      reportType: r.reportType,
      reportDate: r.reportDate,
      fileType: r.fileType,
      mimeType: r.mimeType,
      fileSize: r.fileSize,
      originalFilename: r.originalFilename
    }));

    return {
      share: this.mapToOwnerDto(share, displayName, reportSummaries)
    };
  }

  // =========================================================================
  // 7. ARCHIVED FAMILY MEMBER INVALIDATION
  // =========================================================================

  public async invalidateSharesForFamilyMember(
    ownerUserId: string,
    familyMemberId: string
  ): Promise<number> {
    if (!Types.ObjectId.isValid(ownerUserId) || !Types.ObjectId.isValid(familyMemberId)) {
      return 0;
    }

    const result = await MedicalShare.updateMany(
      {
        ownerUserId: new Types.ObjectId(ownerUserId),
        subjectType: 'family_member',
        subjectId: new Types.ObjectId(familyMemberId),
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

    return result.modifiedCount || 0;
  }
}

export const medicalShareService: MedicalShareService = new MedicalShareService();
