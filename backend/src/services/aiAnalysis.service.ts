import { Types } from 'mongoose';
import { MedicalReport } from '../models';
import {
  ProcessingStatus,
  IStructuredReportAnalysis,
  MANDATORY_MEDICAL_DISCLAIMER,
  IReportMetadata,
  GetReportsQueryDto,
  FamilyAuditAction
} from '../types';
import { AppError } from '../utils';
import { storageService } from './storage.service';
import { documentExtractor, IDocumentExtractor, assessDocumentContent } from './extraction';
import { aiHealthProvider, IAIHealthProvider } from './ai';
import { timelineService } from './timeline.service';
import { aggregateHealthIntelligenceService } from './aggregate/aggregateHealthIntelligence.service';
import { subjectResolverService } from './subjectResolver.service';
import { familyService } from './family.service';

export interface AnalyzeReportOptions {
  forceReanalyze?: boolean;
  provider?: IAIHealthProvider;
  extractor?: IDocumentExtractor;
}

export class AIHealthAnalysisService {
  public async analyzeReport(
    userId: string,
    reportId: string,
    options: AnalyzeReportOptions = {}
  ): Promise<{
    reportId: string;
    processingStatus: ProcessingStatus;
    analysis: IStructuredReportAnalysis;
    isCached: boolean;
  }> {
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

    // If family report, ensure family member profile is not archived
    if (report.subjectType === 'family_member' && report.subjectId) {
      await familyService.getOwnedFamilyMember(userId, report.subjectId.toString(), {
        allowArchived: false
      });
    }

    // 1. Idempotency Check: Return existing completed analysis unless forceReanalyze is requested
    if (
      report.processingStatus === ProcessingStatus.COMPLETED &&
      report.analysisResult &&
      !options.forceReanalyze
    ) {
      // Check if existing record is a legacy invalid unreadable record
      const isLegacyInvalid =
        (report.analysisResult.sourceFacts.extractedValues?.length || 0) === 0 &&
        (report.analysisResult.sourceFacts.documentedDiagnoses?.length || 0) === 0 &&
        (report.analysisResult.sourceFacts.documentedMedications?.length || 0) === 0 &&
        /no (?:readable|medical|clinical|usable) (?:data|information|test)|raw pdf|could not be extracted/i.test(
          report.aiSummary || report.analysisResult.aiInsights?.summary || ''
        );

      if (!isLegacyInvalid) {
        return {
          reportId: report._id.toString(),
          processingStatus: ProcessingStatus.COMPLETED,
          analysis: report.analysisResult,
          isCached: true
        };
      }
    }

    // 2. Concurrency Guard: If currently processing within the last 60 seconds, prevent duplicate pipeline runs
    if (
      report.processingStatus === ProcessingStatus.PROCESSING &&
      report.updatedAt &&
      Date.now() - new Date(report.updatedAt).getTime() < 60000
    ) {
      throw new AppError('Medical report analysis is currently in progress. Please try again shortly.', 409);
    }

    // 3. Transition status to PROCESSING
    report.processingStatus = ProcessingStatus.PROCESSING;
    report.errorMessage = undefined;
    await report.save();

    const extractor = options.extractor || documentExtractor;
    const provider = options.provider || aiHealthProvider;

    try {
      // 4. Retrieve document buffer from Storage Abstraction
      const fileBuffer = await storageService.getFileBuffer(report.publicId, report.mimeType, {
        resourceType: report.resourceType as any,
        deliveryType: report.deliveryType,
        format: report.format
      });

      // 5. Extract document text & evaluate clinical readability
      let extraction = await extractor.extractText(
        fileBuffer,
        report.mimeType,
        report.originalFilename
      );

      // Fallback: If extractor did not compute quality flags, assess text content now
      if (extraction.isReadable === undefined || extraction.hasClinicalContent === undefined) {
        const assessment = assessDocumentContent(extraction.rawText, extraction.mimeType, report.originalFilename);
        extraction = {
          ...extraction,
          isReadable: assessment.isReadable,
          hasClinicalContent: assessment.hasClinicalContent,
          quality: assessment.quality,
          qualityReason: assessment.qualityReason,
          rawText: assessment.cleanedText || extraction.rawText
        };
      }

      // 6. VALIDATION GUARD: Do NOT call AI provider if extraction is unreadable or lacks clinical content
      if (!extraction.isReadable || !extraction.hasClinicalContent) {
        const userSafeMessage = "We couldn't extract enough clinical information from this document to provide AI health insights.";
        report.processingStatus = ProcessingStatus.UNREADABLE;
        report.errorMessage = userSafeMessage;
        report.analysisResult = undefined;
        report.aiSummary = undefined;
        report.healthScore = undefined;
        report.riskLevel = undefined;
        report.timelineGenerated = false;
        report.ocrText = extraction.rawText ? extraction.rawText.slice(0, 1000) : undefined;
        await report.save();

        throw new AppError(userSafeMessage, 422, {
          processingStatus: ProcessingStatus.UNREADABLE,
          quality: extraction.quality,
          reason: extraction.qualityReason
        });
      }

      // 7. Assemble safe report metadata
      const metadata: IReportMetadata = {
        reportId: report._id.toString(),
        userId,
        title: report.title,
        category: report.category,
        reportType: report.reportType,
        hospital: report.hospital,
        doctor: report.doctor,
        reportDate: report.reportDate,
        fileType: report.fileType,
        mimeType: report.mimeType
      };

      // 8. Request structured analysis from AI Provider
      const analysis = await provider.analyzeMedicalDocument(extraction, metadata);

      // 9. Post-AI verification (Defense in depth): Ensure AI didn't return zero facts + unreadable summary
      const hasFacts =
        (analysis.sourceFacts.extractedValues?.length || 0) > 0 ||
        (analysis.sourceFacts.documentedDiagnoses?.length || 0) > 0 ||
        (analysis.sourceFacts.documentedMedications?.length || 0) > 0;

      const isUnreadableAiSummary = /no (?:readable|medical|clinical|usable) (?:data|information|test)|raw pdf|could not be extracted/i.test(
        analysis.aiInsights.summary
      );

      if (!hasFacts && isUnreadableAiSummary) {
        const userSafeMessage = "We couldn't extract enough clinical information from this document to provide AI health insights.";
        report.processingStatus = ProcessingStatus.UNREADABLE;
        report.errorMessage = userSafeMessage;
        report.analysisResult = undefined;
        report.aiSummary = undefined;
        report.healthScore = undefined;
        report.riskLevel = undefined;
        report.timelineGenerated = false;
        await report.save();

        throw new AppError(userSafeMessage, 422, {
          processingStatus: ProcessingStatus.UNREADABLE,
          reason: analysis.aiInsights.summary
        });
      }

      // 10. Persist genuine structured results to MongoDB
      report.processingStatus = ProcessingStatus.COMPLETED;
      report.analysisResult = analysis;
      report.ocrText = extraction.rawText.length > 5000 ? extraction.rawText.slice(0, 5000) : extraction.rawText;
      report.aiSummary = analysis.aiInsights.summary;
      if (analysis.healthScoreImpact.calculatedScore !== undefined) {
        report.healthScore = analysis.healthScoreImpact.calculatedScore;
      }
      report.riskLevel = analysis.aiInsights.riskAssessment.level;
      report.analyzedAt = new Date();
      report.analysisModel = analysis.metadata.model;
      report.analysisProvider = analysis.metadata.provider;
      report.timelineGenerated = true;
      report.errorMessage = undefined;

      await report.save();

      // Invalidate aggregate health intelligence cache for subject
      aggregateHealthIntelligenceService.invalidateUserCache(
        userId,
        report.subjectType,
        report.subjectId?.toString()
      );

      // Automatically generate timeline event for successful AI analysis
      await timelineService.createAIAnalysisEvent(userId, report, analysis, {
        ownerUserId: report.ownerUserId || userId,
        subjectType: report.subjectType,
        subjectId: report.subjectId
      });

      // Audit family AI analysis
      if (report.subjectType === 'family_member' && report.subjectId) {
        await familyService.logAuditEvent(
          userId,
          report.subjectId,
          FamilyAuditAction.AI_ANALYSIS_COMPLETED,
          { reportId: report._id.toString() }
        );
      }

      return {
        reportId: report._id.toString(),
        processingStatus: ProcessingStatus.COMPLETED,
        analysis,
        isCached: false
      };
    } catch (error: unknown) {
      if (error instanceof AppError && error.statusCode === 422) {
        // Already recorded as UNREADABLE in database
        throw error;
      }

      // Fail-safe Error Handling: Mark report as FAILED and record safe error reason without leaking medical text
      report.processingStatus = ProcessingStatus.FAILED;
      const safeErrorMsg = error instanceof AppError ? error.message : 'AI analysis pipeline encountered an unexpected error';
      report.errorMessage = safeErrorMsg;
      await report.save();

      // Log safe operational metadata ONLY (no patient or medical report content)
      console.error(`[AI Analysis Service] Pipeline failed for reportId=${reportId} provider=${provider.providerName}:`, safeErrorMsg);

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Medical report analysis failed: ${safeErrorMsg}`, 502);
    }
  }

  public async getReportAnalysis(userId: string, reportId: string) {
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

    const isLegacyInvalid =
      report.processingStatus === ProcessingStatus.COMPLETED &&
      report.analysisResult &&
      (report.analysisResult.sourceFacts.extractedValues?.length || 0) === 0 &&
      (report.analysisResult.sourceFacts.documentedDiagnoses?.length || 0) === 0 &&
      (report.analysisResult.sourceFacts.documentedMedications?.length || 0) === 0 &&
      /no (?:readable|medical|clinical|usable) (?:data|information|test)|raw pdf|could not be extracted/i.test(
        report.aiSummary || report.analysisResult.aiInsights?.summary || ''
      );

    if (
      report.processingStatus !== ProcessingStatus.COMPLETED ||
      !report.analysisResult ||
      isLegacyInvalid
    ) {
      return {
        reportId: report._id.toString(),
        title: report.title,
        category: report.category,
        processingStatus: isLegacyInvalid ? ProcessingStatus.UNREADABLE : report.processingStatus,
        errorMessage: isLegacyInvalid
          ? "We couldn't extract enough clinical information from this document to provide AI health insights."
          : report.errorMessage || (report.processingStatus === ProcessingStatus.UNREADABLE ? "We couldn't extract enough clinical information from this document to provide AI health insights." : undefined),
        analysis: null,
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER
      };
    }

    return {
      reportId: report._id.toString(),
      title: report.title,
      category: report.category,
      processingStatus: report.processingStatus,
      analysis: report.analysisResult,
      analyzedAt: report.analyzedAt,
      disclaimer: report.analysisResult.disclaimer || MANDATORY_MEDICAL_DISCLAIMER
    };
  }

  public async getAnalysisHistory(userId: string, query: GetReportsQueryDto) {
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
      processingStatus: ProcessingStatus.COMPLETED,
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
      filter.category = query.category;
    }

    const [total, reports] = await Promise.all([
      MedicalReport.countDocuments(filter),
      MedicalReport.find(filter)
        .sort({ analyzedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    // Filter out any legacy invalid records from history
    const history = reports
      .filter((r) => {
        const isLegacyInvalid =
          (r.analysisResult?.sourceFacts.extractedValues?.length || 0) === 0 &&
          (r.analysisResult?.sourceFacts.documentedDiagnoses?.length || 0) === 0 &&
          (r.analysisResult?.sourceFacts.documentedMedications?.length || 0) === 0 &&
          /no (?:readable|medical|clinical|usable) (?:data|information|test)|raw pdf|could not be extracted/i.test(
            r.aiSummary || r.analysisResult?.aiInsights?.summary || ''
          );
        return !isLegacyInvalid;
      })
      .map((r) => ({
        reportId: r._id.toString(),
        title: r.title,
        category: r.category,
        aiSummary: r.aiSummary || r.analysisResult?.aiInsights.summary,
        riskLevel: r.riskLevel || r.analysisResult?.aiInsights.riskAssessment.level,
        healthScore: r.healthScore,
        analyzedAt: r.analyzedAt || r.updatedAt,
        processingStatus: r.processingStatus,
        findingsCount: r.analysisResult?.aiInsights.keyFindings?.length || 0,
        extractedValuesCount: r.analysisResult?.sourceFacts.extractedValues?.length || 0
      }));

    return {
      history,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }
}

export const aiHealthAnalysisService: AIHealthAnalysisService = new AIHealthAnalysisService();
