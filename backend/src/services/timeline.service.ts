import { Types } from 'mongoose';
import { HealthTimeline, HealthTimelineDocument } from '../models';
import {
  TimelineEventType,
  CreateTimelineEventDto,
  GetTimelineQueryDto,
  IStructuredReportAnalysis,
  TimelineEventResponseDto
} from '../types';
import { AppError } from '../utils';
import { subjectResolverService } from './subjectResolver.service';

const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export class TimelineService {
  public async createOrUpdateTimelineEvent(dto: CreateTimelineEventDto): Promise<HealthTimelineDocument> {
    const userId = typeof dto.userId === 'string' ? new Types.ObjectId(dto.userId) : dto.userId;
    const ownerUserId = dto.ownerUserId
      ? typeof dto.ownerUserId === 'string'
        ? new Types.ObjectId(dto.ownerUserId)
        : dto.ownerUserId
      : userId;
    const subjectType = dto.subjectType || 'user';
    const subjectId = dto.subjectId
      ? typeof dto.subjectId === 'string'
        ? new Types.ObjectId(dto.subjectId)
        : dto.subjectId
      : ownerUserId;

    const relatedReport = dto.relatedReport
      ? typeof dto.relatedReport === 'string'
        ? new Types.ObjectId(dto.relatedReport)
        : dto.relatedReport
      : undefined;

    const eventDate = dto.date ? new Date(dto.date) : new Date();

    // Deduplication check: Find existing active event with the same owner, subject, eventType, and sourceId
    const existing = await HealthTimeline.findOne({
      $or: [
        { ownerUserId, subjectId },
        { userId: ownerUserId, subjectId },
        { userId: ownerUserId }
      ],
      eventType: dto.eventType,
      sourceId: dto.sourceId,
      isDeleted: false
    });

    if (existing) {
      existing.title = dto.title.trim();
      existing.description = dto.description.trim();
      existing.date = eventDate;
      existing.ownerUserId = ownerUserId;
      existing.subjectType = subjectType;
      existing.subjectId = subjectId;
      if (relatedReport) existing.relatedReport = relatedReport;
      if (dto.sourceType) existing.sourceType = dto.sourceType;
      if (dto.metadata) existing.metadata = { ...existing.metadata, ...dto.metadata };
      await existing.save();
      return existing;
    }

    const newEvent = new HealthTimeline({
      userId: ownerUserId,
      ownerUserId,
      subjectType,
      subjectId,
      eventType: dto.eventType,
      title: dto.title.trim(),
      description: dto.description.trim(),
      date: eventDate,
      relatedReport,
      sourceType: dto.sourceType || 'medical_report',
      sourceId: dto.sourceId,
      metadata: dto.metadata || {},
      isDeleted: false
    });

    await newEvent.save();
    return newEvent;
  }

  public async createReportUploadEvent(
    userId: string,
    report: {
      _id: Types.ObjectId | string;
      title: string;
      category: string;
      hospital?: string;
      doctor?: string;
      reportDate: Date;
      fileUrl?: string;
      thumbnailUrl?: string;
      ownerUserId?: Types.ObjectId | string;
      subjectType?: 'user' | 'family_member';
      subjectId?: Types.ObjectId | string;
    },
    subject?: {
      ownerUserId?: Types.ObjectId | string;
      subjectType?: 'user' | 'family_member';
      subjectId?: Types.ObjectId | string;
    }
  ): Promise<HealthTimelineDocument> {
    const reportIdStr = report._id.toString();
    const cleanCategory = report.category.replace(/_/g, ' ');
    const originDesc = report.hospital ? ` from ${report.hospital}` : '';

    const effectiveSubjectType = subject?.subjectType || report.subjectType || 'user';
    const effectiveSubjectId = subject?.subjectId || report.subjectId || userId;
    const effectiveOwnerUserId = subject?.ownerUserId || report.ownerUserId || userId;

    return this.createOrUpdateTimelineEvent({
      userId,
      ownerUserId: effectiveOwnerUserId,
      subjectType: effectiveSubjectType,
      subjectId: effectiveSubjectId,
      eventType: TimelineEventType.REPORT_UPLOADED,
      title: `Report Uploaded: ${report.title}`,
      description: `Medical report (${cleanCategory}) added to Health Vault${originDesc}.`,
      date: report.reportDate || new Date(),
      relatedReport: report._id,
      sourceType: 'medical_report',
      sourceId: reportIdStr,
      metadata: {
        category: report.category,
        hospital: report.hospital,
        doctor: report.doctor,
        fileUrl: report.fileUrl,
        thumbnailUrl: report.thumbnailUrl
      }
    });
  }

  public async createAIAnalysisEvent(
    userId: string,
    report: {
      _id: Types.ObjectId | string;
      title: string;
      category: string;
      hospital?: string;
      doctor?: string;
      reportDate?: Date;
      analyzedAt?: Date;
      ownerUserId?: Types.ObjectId | string;
      subjectType?: 'user' | 'family_member';
      subjectId?: Types.ObjectId | string;
    },
    analysis: IStructuredReportAnalysis,
    subject?: {
      ownerUserId?: Types.ObjectId | string;
      subjectType?: 'user' | 'family_member';
      subjectId?: Types.ObjectId | string;
    }
  ): Promise<HealthTimelineDocument> {
    const reportIdStr = report._id.toString();
    const riskLevel = analysis.aiInsights.riskAssessment.level;
    const summarySnippet = analysis.aiInsights.summary.length > 200
      ? `${analysis.aiInsights.summary.slice(0, 197)}...`
      : analysis.aiInsights.summary;

    const effectiveSubjectType = subject?.subjectType || report.subjectType || 'user';
    const effectiveSubjectId = subject?.subjectId || report.subjectId || userId;
    const effectiveOwnerUserId = subject?.ownerUserId || report.ownerUserId || userId;

    return this.createOrUpdateTimelineEvent({
      userId,
      ownerUserId: effectiveOwnerUserId,
      subjectType: effectiveSubjectType,
      subjectId: effectiveSubjectId,
      eventType: TimelineEventType.AI_ANALYSIS,
      title: `AI Health Analysis: ${report.title}`,
      description: `AI evaluated this record with a ${riskLevel} risk assessment. Summary: ${summarySnippet}`,
      date: report.analyzedAt || new Date(),
      relatedReport: report._id,
      sourceType: 'ai_analysis',
      sourceId: reportIdStr,
      metadata: {
        category: report.category,
        riskLevel,
        healthScore: analysis.healthScoreImpact.calculatedScore,
        findingsCount: analysis.aiInsights.keyFindings.length,
        extractedValuesCount: analysis.sourceFacts.extractedValues.length,
        model: analysis.metadata.model
      }
    });
  }

  public async handleSourceDeleted(sourceId: string, userId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const isObjectId = Types.ObjectId.isValid(sourceId);

    const conditions: Array<Record<string, unknown>> = [{ sourceId }];
    if (isObjectId) {
      conditions.push({ relatedReport: new Types.ObjectId(sourceId) });
    }

    await HealthTimeline.updateMany(
      {
        $or: [
          { ownerUserId: userObjectId },
          { userId: userObjectId }
        ],
        $and: [{ $or: conditions }],
        isDeleted: false
      },
      {
        isDeleted: true
      }
    );
  }

  public async getTimeline(
    userId: string,
    query: GetTimelineQueryDto
  ): Promise<{
    timeline: TimelineEventResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
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

    if (query.eventType) {
      if (Object.values(TimelineEventType).includes(query.eventType)) {
        filter.eventType = query.eventType;
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
        filter.date = dateQuery;
      }
    }

    if (query.search && typeof query.search === 'string' && query.search.trim()) {
      const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
      filter.$or = [{ title: searchRegex }, { description: searchRegex }];
    }

    const [total, events] = await Promise.all([
      HealthTimeline.countDocuments(filter),
      HealthTimeline.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const formattedEvents: TimelineEventResponseDto[] = events.map((e) => ({
      id: e._id.toString(),
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      date: e.date,
      relatedReport: e.relatedReport ? e.relatedReport.toString() : undefined,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      metadata: e.metadata,
      subject: {
        type: (e.subjectType || 'user') as 'user' | 'family_member',
        id: (e.subjectId || e.userId).toString()
      },
      createdAt: e.createdAt
    }));

    return {
      timeline: formattedEvents,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  public async getTimelineEventById(userId: string, eventId: string): Promise<{ event: TimelineEventResponseDto }> {
    if (!Types.ObjectId.isValid(eventId)) {
      throw new AppError('Timeline event not found', 404);
    }

    const event = await HealthTimeline.findOne({
      _id: new Types.ObjectId(eventId),
      $or: [
        { ownerUserId: new Types.ObjectId(userId) },
        { userId: new Types.ObjectId(userId) }
      ],
      isDeleted: false
    });

    if (!event) {
      throw new AppError('Timeline event not found', 404);
    }

    return {
      event: {
        id: event._id.toString(),
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        date: event.date,
        relatedReport: event.relatedReport ? event.relatedReport.toString() : undefined,
        sourceType: event.sourceType,
        sourceId: event.sourceId,
        metadata: event.metadata,
        subject: {
          type: (event.subjectType || 'user') as 'user' | 'family_member',
          id: (event.subjectId || event.userId).toString()
        },
        createdAt: event.createdAt
      }
    };
  }
}

export const timelineService: TimelineService = new TimelineService();

