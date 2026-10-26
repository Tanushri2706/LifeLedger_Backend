import { Types } from 'mongoose';
import { MedicalReport, MedicalReportDocument } from '../models';
import {
  ReportCategory,
  ProcessingStatus,
  UploadReportDto,
  GetReportsQueryDto,
  MedicalReportResponseDto,
  FamilyAuditAction
} from '../types';
import { AppError } from '../utils';
import { storageService } from './storage.service';
import { timelineService } from './timeline.service';
import { aggregateHealthIntelligenceService } from './aggregate/aggregateHealthIntelligence.service';
import { subjectResolverService, IResolvedSubject } from './subjectResolver.service';
import { familyService } from './family.service';

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export class MedicalReportService {
  private formatReportDto(report: MedicalReportDocument, subjectOverride?: IResolvedSubject): MedicalReportResponseDto {
    const subjectType = subjectOverride
      ? subjectOverride.subjectType
      : ((report.subjectType || 'user') as 'user' | 'family_member');
    const subjectId = subjectOverride
      ? subjectOverride.subjectId.toString()
      : (report.subjectId || report.userId).toString();
    const displayName = subjectOverride?.displayName;

    return {
      id: report._id.toString(),
      title: report.title,
      category: report.category,
      reportType: report.reportType,
      hospital: report.hospital,
      doctor: report.doctor,
      reportDate: report.reportDate,
      fileUrl: report.fileUrl,
      thumbnailUrl: report.thumbnailUrl,
      fileType: report.fileType,
      fileSize: report.fileSize,
      originalFilename: report.originalFilename,
      mimeType: report.mimeType,
      processingStatus: report.processingStatus,
      subject: {
        type: subjectType,
        id: subjectId,
        displayName
      },
      createdAt: report.createdAt,
      updatedAt: report.updatedAt
    };
  }

  public async uploadReport(userId: string, file: Express.Multer.File | undefined, dto: UploadReportDto) {
    if (!file) {
      throw new AppError('Medical report file is required', 400);
    }

    // Resolve and Authorize Subject (Rejects write for archived members with 400, cross-user with 404)
    const subject = await subjectResolverService.resolveHealthSubject(
      userId,
      dto.subjectType,
      dto.subjectId,
      { forWrite: true }
    );

    const originalFilename = file.originalname || 'medical_report';
    const fallbackTitle = originalFilename.replace(/\.[^/.]+$/, '').trim() || 'Medical Report';
    const title = (dto.title && dto.title.trim()) || fallbackTitle;

    if (title.length > 200) {
      throw new AppError('Report title cannot exceed 200 characters', 400);
    }

    let category = ReportCategory.OTHER;
    if (dto.category) {
      const normalizedCat = String(dto.category).toLowerCase().trim();
      const validCategories = Object.values(ReportCategory) as string[];
      if (!validCategories.includes(normalizedCat)) {
        throw new AppError('Invalid medical report category provided', 400);
      }
      category = normalizedCat as ReportCategory;
    }

    let reportDate = new Date();
    if (dto.reportDate) {
      const parsed = new Date(dto.reportDate);
      if (isNaN(parsed.getTime())) {
        throw new AppError('Invalid report date provided', 400);
      }
      // Allow up to 24h into future for clock drift
      if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        throw new AppError('Report date cannot be in the future', 400);
      }
      reportDate = parsed;
    }

    // Tenant-isolated Storage Folder
    const storageFolder = subject.subjectType === 'family_member'
      ? `lifeledger/vault/${userId}/family/${subject.subjectId}`
      : `lifeledger/vault/${userId}`;

    // Upload to Storage Layer
    const storageResult = await storageService.uploadFile(file, userId, storageFolder);

    // Persist metadata to MongoDB with unambiguous subject identity
    const report = new MedicalReport({
      userId: new Types.ObjectId(userId),
      ownerUserId: new Types.ObjectId(userId),
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      title,
      category,
      reportType: dto.reportType ? dto.reportType.trim() : undefined,
      hospital: dto.hospital ? dto.hospital.trim() : undefined,
      doctor: dto.doctor ? dto.doctor.trim() : undefined,
      reportDate,
      fileUrl: storageResult.fileUrl,
      publicId: storageResult.publicId,
      thumbnailUrl: storageResult.thumbnailUrl,
      fileType: storageResult.fileType,
      fileSize: storageResult.fileSize,
      originalFilename: storageResult.originalFilename,
      mimeType: storageResult.mimeType,
      resourceType: storageResult.resourceType,
      deliveryType: storageResult.deliveryType,
      format: storageResult.format,
      processingStatus: ProcessingStatus.PENDING,
      timelineGenerated: false,
      isDeleted: false
    });

    await report.save();

    // Invalidate aggregate health intelligence cache for this subject
    aggregateHealthIntelligenceService.invalidateUserCache(
      userId,
      subject.subjectType,
      subject.subjectId.toString()
    );

    // Automatically generate timeline event for uploaded report with subject context
    await timelineService.createReportUploadEvent(userId, report, subject);

    // Audit family report upload (Privacy-safe: no OCR, values, diagnoses)
    if (subject.subjectType === 'family_member') {
      await familyService.logAuditEvent(
        userId,
        subject.subjectId,
        FamilyAuditAction.REPORT_UPLOADED,
        { reportId: report._id.toString() }
      );
    }

    return {
      report: this.formatReportDto(report, subject)
    };
  }

  public async getReports(userId: string, query: GetReportsQueryDto) {
    const page = Math.max(1, parseInt(String(query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit), 10) || 10));
    const skip = (page - 1) * limit;

    // Resolve Subject
    const subject = await subjectResolverService.resolveHealthSubject(
      userId,
      query.subjectType,
      query.subjectId,
      { allowArchived: true }
    );

    const filter: Record<string, unknown> = {
      isDeleted: false
    };

    if (subject.subjectType === 'user') {
      filter.$or = [
        { ownerUserId: subject.ownerUserId, subjectType: 'user' },
        { userId: subject.ownerUserId, subjectType: { $in: [null, undefined, 'user'] } }
      ];
    } else {
      filter.ownerUserId = subject.ownerUserId;
      filter.subjectType = 'family_member';
      filter.subjectId = subject.subjectId;
    }

    if (query.category) {
      if (Object.values(ReportCategory).includes(query.category)) {
        filter.category = query.category;
      }
    }

    if (query.startDate || query.endDate) {
      const dateQuery: Record<string, Date> = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        if (!isNaN(start.getTime())) dateQuery.$gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        if (!isNaN(end.getTime())) dateQuery.$lte = end;
      }
      if (Object.keys(dateQuery).length > 0) {
        filter.reportDate = dateQuery;
      }
    }

    if (query.search && typeof query.search === 'string' && query.search.trim()) {
      const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [
        { title: searchRegex },
        { hospital: searchRegex },
        { doctor: searchRegex },
        { originalFilename: searchRegex }
      ];
    }

    const [total, reports] = await Promise.all([
      MedicalReport.countDocuments(filter),
      MedicalReport.find(filter)
        .sort({ reportDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const formattedReports = reports.map((r) => this.formatReportDto(r, subject));

    return {
      reports: formattedReports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  public async getReportById(userId: string, reportId: string) {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new AppError('Medical report not found', 404);
    }

    const report = await MedicalReport.findOne({
      _id: new Types.ObjectId(reportId),
      $or: [
        { ownerUserId: new Types.ObjectId(userId) },
        { userId: new Types.ObjectId(userId) }
      ],
      isDeleted: false
    });

    if (!report) {
      throw new AppError('Medical report not found', 404);
    }

    return {
      report: this.formatReportDto(report)
    };
  }

  public async updateReport(userId: string, reportId: string, dto: import('../types').UpdateReportDto) {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new AppError('Medical report not found', 404);
    }

    const report = await MedicalReport.findOne({
      _id: new Types.ObjectId(reportId),
      $or: [
        { ownerUserId: new Types.ObjectId(userId) },
        { userId: new Types.ObjectId(userId) }
      ],
      isDeleted: false
    });

    if (!report) {
      throw new AppError('Medical report not found', 404);
    }

    if (dto.title !== undefined) {
      const trimmed = dto.title.trim();
      if (!trimmed) {
        throw new AppError('Report title cannot be empty', 400);
      }
      if (trimmed.length > 200) {
        throw new AppError('Report title cannot exceed 200 characters', 400);
      }
      report.title = trimmed;
    }

    if (dto.category !== undefined) {
      const normalizedCat = String(dto.category).toLowerCase().trim();
      const validCategories = Object.values(ReportCategory) as string[];
      if (!validCategories.includes(normalizedCat)) {
        throw new AppError('Invalid medical report category provided', 400);
      }
      report.category = normalizedCat as ReportCategory;
    }

    if (dto.reportType !== undefined) {
      report.reportType = dto.reportType ? dto.reportType.trim() : undefined;
    }

    if (dto.hospital !== undefined) {
      report.hospital = dto.hospital ? dto.hospital.trim() : undefined;
    }

    if (dto.doctor !== undefined) {
      report.doctor = dto.doctor ? dto.doctor.trim() : undefined;
    }

    if (dto.reportDate !== undefined) {
      const parsed = new Date(dto.reportDate);
      if (isNaN(parsed.getTime())) {
        throw new AppError('Invalid report date provided', 400);
      }
      if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
        throw new AppError('Report date cannot be in the future', 400);
      }
      report.reportDate = parsed;
    }

    await report.save();

    // Invalidate aggregate health intelligence cache for this subject
    aggregateHealthIntelligenceService.invalidateUserCache(
      userId,
      report.subjectType,
      report.subjectId?.toString()
    );

    return {
      report: this.formatReportDto(report)
    };
  }

  public async deleteReport(userId: string, reportId: string) {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new AppError('Medical report not found', 404);
    }

    const report = await MedicalReport.findOne({
      _id: new Types.ObjectId(reportId),
      $or: [
        { ownerUserId: new Types.ObjectId(userId) },
        { userId: new Types.ObjectId(userId) }
      ],
      isDeleted: false
    });

    if (!report) {
      throw new AppError('Medical report not found', 404);
    }

    // Delete object from Storage Provider
    await storageService.deleteFile(report.publicId, {
      resourceType: report.resourceType,
      deliveryType: report.deliveryType,
      format: report.format,
      mimeType: report.mimeType
    });

    // Soft delete in MongoDB
    report.isDeleted = true;
    await report.save();

    // Invalidate aggregate health intelligence cache for this subject
    aggregateHealthIntelligenceService.invalidateUserCache(
      userId,
      report.subjectType,
      report.subjectId?.toString()
    );

    // Cascading soft-delete associated timeline events for this owner and source
    await timelineService.handleSourceDeleted(reportId, userId);

    // Audit family report deletion
    if (report.subjectType === 'family_member' && report.subjectId) {
      await familyService.logAuditEvent(
        userId,
        report.subjectId,
        FamilyAuditAction.REPORT_DELETED,
        { reportId: report._id.toString() }
      );
    }

    return { success: true };
  }

  public async getReportDownloadUrl(userId: string, reportId: string) {
    if (!Types.ObjectId.isValid(reportId)) {
      throw new AppError('Medical report not found', 404);
    }

    const report = await MedicalReport.findOne({
      _id: new Types.ObjectId(reportId),
      $or: [
        { ownerUserId: new Types.ObjectId(userId) },
        { userId: new Types.ObjectId(userId) }
      ],
      isDeleted: false
    });

    if (!report) {
      throw new AppError('Medical report not found', 404);
    }

    const downloadUrl = await storageService.getSignedDownloadUrl(report.publicId, report.originalFilename, {
      resourceType: report.resourceType,
      deliveryType: report.deliveryType,
      format: report.format,
      mimeType: report.mimeType
    });

    return {
      downloadUrl,
      fileName: report.originalFilename,
      mimeType: report.mimeType,
      fileSize: report.fileSize
    };
  }
}

export const medicalReportService: MedicalReportService = new MedicalReportService();

