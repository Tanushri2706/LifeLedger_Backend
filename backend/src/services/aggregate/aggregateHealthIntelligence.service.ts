import crypto from 'crypto';
import { Types } from 'mongoose';
import { MedicalReport } from '../../models';
import {
  IAggregateHealthIntelligenceData,
  ICoverageSummary,
  INormalizedObservation,
  ProcessingStatus,
  MANDATORY_MEDICAL_DISCLAIMER
} from '../../types';
import { AppError } from '../../utils';
import { normalizeExtractedValue } from './markerNormalizer';
import { calculateLongitudinalTrends } from './trendCalculator';
import { aggregateAISynthesizer } from './aggregateAISynthesizer';
import { subjectResolverService } from '../subjectResolver.service';

interface ICacheEntry {
  fingerprint: string;
  data: IAggregateHealthIntelligenceData;
  cachedAt: Date;
}

export class AggregateHealthIntelligenceService {
  private cache = new Map<string, ICacheEntry>();

  public invalidateUserCache(userId: string, subjectType?: string, subjectId?: string): void {
    if (subjectType === 'family_member' && subjectId) {
      this.cache.delete(`family_member:${userId}:${subjectId}`);
    } else if (subjectType === 'user') {
      this.cache.delete(`user:${userId}`);
      this.cache.delete(userId);
    } else {
      // Invalidate all caches associated with this user
      this.cache.delete(userId);
      this.cache.delete(`user:${userId}`);
      for (const key of this.cache.keys()) {
        if (key.startsWith(`family_member:${userId}:`) || key.startsWith(`user:${userId}`)) {
          this.cache.delete(key);
        }
      }
    }
  }

  private computeFingerprint(subjectKey: string, reports: any[]): string {
    const sorted = [...reports].sort((a, b) => a._id.toString().localeCompare(b._id.toString()));
    const pieces = sorted.map((r) => `${r._id}:${r.updatedAt ? new Date(r.updatedAt).getTime() : ''}:${r.analyzedAt ? new Date(r.analyzedAt).getTime() : ''}`);
    const hash = crypto.createHash('sha256');
    hash.update(`${subjectKey}:${pieces.join('|')}`);
    return hash.digest('hex');
  }

  public async getAggregateHealthIntelligence(
    userId: string,
    options: { subjectType?: string; subjectId?: string; forceRefresh?: boolean; forceMock?: boolean } = {}
  ): Promise<IAggregateHealthIntelligenceData> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID', 400);
    }

    // Resolve Subject
    const subject = await subjectResolverService.resolveHealthSubject(
      userId,
      options.subjectType,
      options.subjectId,
      { allowArchived: true }
    );

    const cacheKey = subject.subjectType === 'family_member'
      ? `family_member:${userId}:${subject.subjectId.toString()}`
      : `user:${userId}`;

    // Build subject-isolated query filter
    const reportFilter: Record<string, unknown> = {
      isDeleted: false
    };

    if (subject.subjectType === 'user') {
      reportFilter.$or = [
        { ownerUserId: subject.ownerUserId, subjectType: 'user' },
        { userId: subject.ownerUserId, subjectType: { $in: [null, undefined, 'user'] } }
      ];
    } else {
      reportFilter.ownerUserId = subject.ownerUserId;
      reportFilter.subjectType = 'family_member';
      reportFilter.subjectId = subject.subjectId;
    }

    // Fetch all non-deleted reports for subject
    const allReports = await MedicalReport.find(reportFilter).sort({ reportDate: 1, createdAt: 1 });

    const totalReports = allReports.length;
    const unreadableReports = allReports.filter((r) => r.processingStatus === ProcessingStatus.UNREADABLE).length;
    const pendingReports = allReports.filter(
      (r) => r.processingStatus === ProcessingStatus.PENDING || r.processingStatus === ProcessingStatus.PROCESSING
    ).length;
    const failedReports = allReports.filter((r) => r.processingStatus === ProcessingStatus.FAILED).length;

    // Filter strictly eligible reports
    const eligibleReports = allReports.filter((r) => {
      if (r.processingStatus !== ProcessingStatus.COMPLETED || !r.analysisResult) {
        return false;
      }
      const facts = r.analysisResult.sourceFacts;
      if (!facts) return false;
      const valuesCount = facts.extractedValues?.length || 0;
      const diagCount = facts.documentedDiagnoses?.length || 0;
      const medCount = facts.documentedMedications?.length || 0;
      const isLegacyInvalid =
        valuesCount === 0 &&
        diagCount === 0 &&
        medCount === 0 &&
        /no (?:readable|medical|clinical|usable) (?:data|information|test)|raw pdf|could not be extracted/i.test(
          r.aiSummary || r.analysisResult.aiInsights?.summary || ''
        );
      return (valuesCount > 0 || diagCount > 0 || medCount > 0) && !isLegacyInvalid;
    });

    // Sort eligible reports strictly chronologically by clinical date
    const getReportClinicalDate = (report: any): Date => {
      if (report.reportDate && !isNaN(new Date(report.reportDate).getTime())) {
        return new Date(report.reportDate);
      }
      if (report.analysisResult?.metadata?.reportDate && !isNaN(new Date(report.analysisResult.metadata.reportDate).getTime())) {
        return new Date(report.analysisResult.metadata.reportDate);
      }
      return new Date(report.createdAt || Date.now());
    };

    eligibleReports.sort((a: any, b: any) => {
      const timeA = getReportClinicalDate(a).getTime();
      const timeB = getReportClinicalDate(b).getTime();
      if (timeA !== timeB) return timeA - timeB;
      const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (createdA !== createdB) return createdA - createdB;
      return a._id.toString().localeCompare(b._id.toString());
    });

    const analyzedReports = eligibleReports.length;

    // Case 1: User has zero reports
    if (totalReports === 0) {
      return {
        status: 'no_reports',
        coverage: {
          totalReports: 0,
          analyzedReports: 0,
          unreadableReports: 0,
          pendingReports: 0,
          failedReports: 0,
          coverageAssessment: 'no_reports',
          limitations: ['No medical reports have been uploaded to your Health Vault yet.']
        },
        latestObservations: [],
        abnormalMarkers: [],
        currentFlaggedMarkers: [],
        historicalFlaggedMarkers: [],
        longitudinalTrends: [],
        documentedDiagnoses: [],
        currentDiagnoses: [],
        historicalDiagnoses: [],
        activeMedications: [],
        aggregateHealthScore: null,
        aggregateHealthScoreReason:
          'Aggregate health score is omitted because arithmetic averaging across heterogeneous diagnostic reports is not medically defensible without a validated multi-specialty clinical weighting model.',
        aiSynthesis: null,
        isCached: false,
        generatedAt: new Date(),
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER
      };
    }

    // Case 2: Reports exist but none successfully analyzed
    if (analyzedReports === 0) {
      const limitations: string[] = [];
      if (unreadableReports > 0) {
        limitations.push(`${unreadableReports} uploaded document(s) could not be read or extracted.`);
      }
      if (pendingReports > 0) {
        limitations.push(`${pendingReports} document(s) are currently awaiting AI analysis.`);
      }
      if (failedReports > 0) {
        limitations.push(`${failedReports} document(s) encountered processing errors.`);
      }

      return {
        status: 'no_analyzed_reports',
        coverage: {
          totalReports,
          analyzedReports: 0,
          unreadableReports,
          pendingReports,
          failedReports,
          coverageAssessment: 'no_analyzed_reports',
          limitations
        },
        latestObservations: [],
        abnormalMarkers: [],
        currentFlaggedMarkers: [],
        historicalFlaggedMarkers: [],
        longitudinalTrends: [],
        documentedDiagnoses: [],
        currentDiagnoses: [],
        historicalDiagnoses: [],
        activeMedications: [],
        aggregateHealthScore: null,
        aggregateHealthScoreReason:
          'Aggregate health score is omitted because arithmetic averaging across heterogeneous diagnostic reports is not medically defensible without a validated multi-specialty clinical weighting model.',
        aiSynthesis: null,
        isCached: false,
        generatedAt: new Date(),
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER
      };
    }

    // Case 3: Valid analyzed reports exist
    // Check Cache Fingerprint for zero-cost caching
    const currentFingerprint = this.computeFingerprint(cacheKey, eligibleReports);
    const cachedEntry = this.cache.get(cacheKey);

    if (!options.forceRefresh && cachedEntry && cachedEntry.fingerprint === currentFingerprint) {
      return {
        ...cachedEntry.data,
        isCached: true
      };
    }

    const firstReport = eligibleReports[0]!;
    const latestReport = eligibleReports[eligibleReports.length - 1]!;
    const firstReportDate = getReportClinicalDate(firstReport);
    const latestReportDate = getReportClinicalDate(latestReport);
    const latestReportId = latestReport._id.toString();

    // Extract observations & group by canonical marker
    const groupedObservations = new Map<string, { displayName: string; observations: INormalizedObservation[] }>();
    const allDiagnosesSet = new Set<string>();
    const currentDiagnosesSet = new Set<string>();
    const historicalDiagnosesSet = new Set<string>();
    const activeMedicationsMap = new Map<string, { name: string; dosage?: string; frequency?: string; instructions?: string }>();

    for (const report of eligibleReports) {
      const reportIdStr = report._id.toString();
      const reportClinicalDate = getReportClinicalDate(report);
      const isLatestReport = reportIdStr === latestReportId;
      const facts = report.analysisResult!.sourceFacts;

      // Extract lab values
      if (facts.extractedValues && facts.extractedValues.length > 0) {
        for (const val of facts.extractedValues) {
          const { canonicalKey, displayName, observation } = normalizeExtractedValue(val, reportIdStr, reportClinicalDate);
          if (!groupedObservations.has(canonicalKey)) {
            groupedObservations.set(canonicalKey, { displayName, observations: [] });
          }
          groupedObservations.get(canonicalKey)!.observations.push(observation);
        }
      }

      // Extract diagnoses
      if (facts.documentedDiagnoses && facts.documentedDiagnoses.length > 0) {
        for (const diag of facts.documentedDiagnoses) {
          if (diag && diag.trim()) {
            const cleanDiag = diag.trim();
            allDiagnosesSet.add(cleanDiag);
            if (isLatestReport) {
              currentDiagnosesSet.add(cleanDiag);
            } else {
              historicalDiagnosesSet.add(cleanDiag);
            }
          }
        }
      }

      // Extract medications
      if (facts.documentedMedications && facts.documentedMedications.length > 0) {
        for (const med of facts.documentedMedications) {
          if (med && med.name && med.name.trim()) {
            const key = med.name.trim().toLowerCase();
            activeMedicationsMap.set(key, {
              name: med.name.trim(),
              dosage: med.dosage,
              frequency: med.frequency,
              instructions: med.instructions
            });
          }
        }
      }
    }

    // Calculate Longitudinal Trends
    const longitudinalTrends = calculateLongitudinalTrends(groupedObservations);

    // Calculate Latest Observations and separate Current vs Historical Flagged Findings
    const latestObservations: INormalizedObservation[] = [];
    const currentFlaggedMarkers: INormalizedObservation[] = [];
    const historicalFlaggedMarkers: INormalizedObservation[] = [];
    const historicalQualitativeFindings: INormalizedObservation[] = [];

    for (const [canonicalKey, { observations }] of groupedObservations.entries()) {
      if (!observations || observations.length === 0) continue;

      // Sort chronologically ascending
      observations.sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());

      const latestObs = observations[observations.length - 1];
      if (!latestObs) continue;

      const isFromLatestReport =
        latestObs.reportId === latestReportId ||
        new Date(latestObs.reportDate).getTime() >= latestReportDate.getTime();

      if (isFromLatestReport) {
        latestObs.isLatest = true;
        latestObs.isHistorical = false;

        const isAbnormalVal =
          latestObs.isAbnormal ||
          latestObs.flag === 'HIGH' ||
          latestObs.flag === 'LOW' ||
          latestObs.flag === 'ABNORMAL' ||
          /positive|reactive/i.test(latestObs.rawValue);

        if (isAbnormalVal) {
          latestObs.temporalStatus = 'current_abnormal';
          currentFlaggedMarkers.push(latestObs);
        } else {
          latestObs.temporalStatus = 'current_normal';
        }
        latestObservations.push(latestObs);

        // Check earlier observations for historical abnormalities that have normalized
        for (let i = 0; i < observations.length - 1; i++) {
          const prevObs = observations[i];
          if (!prevObs) continue;

          const isPrevAbnormal =
            prevObs.isAbnormal ||
            prevObs.flag === 'HIGH' ||
            prevObs.flag === 'LOW' ||
            prevObs.flag === 'ABNORMAL' ||
            /positive|reactive/i.test(prevObs.rawValue);

          if (isPrevAbnormal) {
            prevObs.isHistorical = true;
            prevObs.isLatest = false;
            prevObs.temporalStatus = 'historical_normalized';
            historicalFlaggedMarkers.push({
              reportId: prevObs.reportId,
              reportDate: prevObs.reportDate,
              testName: prevObs.testName,
              rawValue: prevObs.rawValue,
              numericValue: prevObs.numericValue,
              unit: prevObs.unit,
              referenceRange: prevObs.referenceRange,
              isAbnormal: prevObs.isAbnormal,
              flag: prevObs.flag,
              isHistorical: true,
              isLatest: false,
              temporalStatus: 'historical_normalized',
              sourceContext: prevObs.sourceContext
                ? `${prevObs.sourceContext} (Normalized to ${latestObs.rawValue} ${latestObs.unit || ''} in latest report)`
                : `Normalized to ${latestObs.rawValue} ${latestObs.unit || ''} in latest report`
            });
          }
        }
      } else {
        // Marker was tested in earlier reports but NOT repeated in the latest report
        latestObs.isHistorical = true;
        latestObs.isLatest = false;

        const isAbnormalVal =
          latestObs.isAbnormal ||
          latestObs.flag === 'HIGH' ||
          latestObs.flag === 'LOW' ||
          latestObs.flag === 'ABNORMAL' ||
          /positive|reactive/i.test(latestObs.rawValue);

        if (isAbnormalVal) {
          latestObs.temporalStatus = 'historical_unrepeated';
          historicalFlaggedMarkers.push(latestObs);

          if (/positive|reactive/i.test(latestObs.rawValue) || canonicalKey.includes('dengue') || latestObs.numericValue === null) {
            historicalQualitativeFindings.push(latestObs);
          }
        } else {
          latestObs.temporalStatus = 'historical_normal';
        }
        latestObservations.push(latestObs);
      }
    }

    // Sort observations for presentation
    latestObservations.sort((a, b) => a.testName.localeCompare(b.testName));
    currentFlaggedMarkers.sort((a, b) => a.testName.localeCompare(b.testName));
    historicalFlaggedMarkers.sort(
      (a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime() || a.testName.localeCompare(b.testName)
    );

    // Coverage dates & limitations
    const limitations: string[] = [];
    if (analyzedReports < 3) {
      limitations.push(`Analysis is based on ${analyzedReports} clinical record(s). Additional records will enhance longitudinal trend precision.`);
    }
    if (unreadableReports > 0) {
      limitations.push(`${unreadableReports} document(s) could not be extracted and are omitted from clinical trends.`);
    }

    const coverage: ICoverageSummary = {
      totalReports,
      analyzedReports,
      unreadableReports,
      pendingReports,
      failedReports,
      firstReportDate: new Date(firstReportDate),
      latestReportDate: new Date(latestReportDate),
      coverageAssessment: analyzedReports >= 3 ? 'comprehensive' : 'partial_coverage',
      limitations
    };

    // Subject profile context (User or Family Member)
    let userProfile: { firstName?: string; gender?: string; age?: number } | undefined;
    if (subject.subjectType === 'user' && subject.user) {
      userProfile = {
        firstName: subject.user.firstName,
        gender: subject.user.gender,
        age: subject.user.dateOfBirth
          ? Math.floor((Date.now() - new Date(subject.user.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : undefined
      };
    } else if (subject.subjectType === 'family_member' && subject.familyMember) {
      const dob = subject.familyMember.dateOfBirth;
      const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined;
      userProfile = {
        firstName: subject.familyMember.displayName,
        gender: subject.familyMember.gender,
        age
      };
    }

    // Generate Cross-Report AI Synthesis
    const aiSynthesis = await aggregateAISynthesizer.synthesize(
      {
        userId: cacheKey,
        userProfile,
        coverage,
        latestObservations,
        abnormalMarkers: currentFlaggedMarkers,
        currentFlaggedMarkers,
        historicalFlaggedMarkers,
        historicalQualitativeFindings,
        longitudinalTrends,
        documentedDiagnoses: Array.from(allDiagnosesSet),
        currentDiagnoses: Array.from(currentDiagnosesSet),
        historicalDiagnoses: Array.from(historicalDiagnosesSet),
        activeMedications: Array.from(activeMedicationsMap.values())
      },
      options.forceMock
    );

    const resultData: IAggregateHealthIntelligenceData = {
      status: analyzedReports >= 3 ? 'available' : 'partial_data',
      coverage,
      latestObservations,
      abnormalMarkers: currentFlaggedMarkers, // Backward compatibility: only current flagged markers
      currentFlaggedMarkers,
      historicalFlaggedMarkers,
      longitudinalTrends,
      documentedDiagnoses: Array.from(allDiagnosesSet),
      currentDiagnoses: Array.from(currentDiagnosesSet),
      historicalDiagnoses: Array.from(historicalDiagnosesSet),
      activeMedications: Array.from(activeMedicationsMap.values()),
      aggregateHealthScore: null,
      aggregateHealthScoreReason:
        'Aggregate health score is omitted because arithmetic averaging across heterogeneous diagnostic reports is not medically defensible without a validated multi-specialty clinical weighting model.',
      aiSynthesis,
      isCached: false,
      generatedAt: new Date(),
      disclaimer: MANDATORY_MEDICAL_DISCLAIMER
    };

    // Save to Cache
    this.cache.set(cacheKey, {
      fingerprint: currentFingerprint,
      data: resultData,
      cachedAt: new Date()
    });

    return resultData;
  }
}

export const aggregateHealthIntelligenceService = new AggregateHealthIntelligenceService();
