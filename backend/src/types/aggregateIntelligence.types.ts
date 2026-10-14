import { z } from 'zod';
import { MANDATORY_MEDICAL_DISCLAIMER } from './ai.types';

export enum TrendDirection {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable',
  INSUFFICIENT_DATA = 'insufficient_data'
}

export interface INormalizedObservation {
  reportId: string;
  reportDate: Date;
  testName: string;
  rawValue: string;
  numericValue: number | null;
  unit?: string;
  referenceRange?: string;
  isAbnormal: boolean;
  flag?: string;
  sourceContext?: string;
  isHistorical?: boolean;
  isLatest?: boolean;
  temporalStatus?: 'current_normal' | 'current_abnormal' | 'historical_normalized' | 'historical_unrepeated' | 'historical_normal';
}

export interface ILongitudinalTrend {
  markerKey: string;
  displayName: string;
  unit: string;
  direction: TrendDirection;
  changeValue: number | null;
  changePercent: number | null;
  observations: INormalizedObservation[];
  baselineValue: number | null;
  latestValue: number | null;
  firstObservedDate: Date;
  latestObservedDate: Date;
}

export interface ICoverageSummary {
  totalReports: number;
  analyzedReports: number;
  unreadableReports: number;
  pendingReports: number;
  failedReports: number;
  firstReportDate?: Date;
  latestReportDate?: Date;
  coverageAssessment: 'no_reports' | 'no_analyzed_reports' | 'partial_coverage' | 'comprehensive';
  limitations: string[];
}

export const GeneralWellnessGuidanceZodSchema = z.object({
  nutritionNotes: z.array(z.string()).nullish().transform((val) => val || []).default([]),
  activityNotes: z.array(z.string()).nullish().transform((val) => val || []).default([]),
  lifestyleNotes: z.array(z.string()).nullish().transform((val) => val || []).default([])
});

export const UrgentSignalsZodSchema = z.object({
  hasUrgentConcern: z.boolean().default(false),
  urgencyLevel: z.enum(['none', 'informational', 'historical_finding', 'moderate', 'critical']).optional(),
  title: z.string().optional(),
  details: z.string().nullable().optional()
});

export const AggregateHealthSynthesisZodSchema = z.object({
  overview: z.string().min(1),
  keyObservations: z.array(z.string()).nullish().transform((val) => val || []).default([]),
  currentObservations: z.array(z.string()).nullish().transform((val) => val || []).default([]),
  historicalFindings: z.array(z.string()).nullish().transform((val) => val || []).default([]),
  changesOverTime: z.array(z.string()).nullish().transform((val) => val || []).default([]),
  areasToDiscussWithDoctor: z.array(z.string()).nullish().transform((val) => val || []).default([]),
  generalWellnessGuidance: GeneralWellnessGuidanceZodSchema.default({
    nutritionNotes: [],
    activityNotes: [],
    lifestyleNotes: []
  }),
  urgentSignals: UrgentSignalsZodSchema.default({ hasUrgentConcern: false }),
  disclaimer: z.string().default(MANDATORY_MEDICAL_DISCLAIMER)
});

export type IAggregateHealthSynthesis = z.infer<typeof AggregateHealthSynthesisZodSchema>;

export interface IAggregateHealthIntelligenceData {
  status: 'available' | 'no_reports' | 'no_analyzed_reports' | 'partial_data';
  coverage: ICoverageSummary;
  latestObservations: INormalizedObservation[];
  abnormalMarkers: INormalizedObservation[];
  currentFlaggedMarkers: INormalizedObservation[];
  historicalFlaggedMarkers: INormalizedObservation[];
  longitudinalTrends: ILongitudinalTrend[];
  documentedDiagnoses: string[];
  currentDiagnoses?: string[];
  historicalDiagnoses?: string[];
  activeMedications: { name: string; dosage?: string; frequency?: string; instructions?: string }[];
  aggregateHealthScore: number | null;
  aggregateHealthScoreReason: string;
  aiSynthesis: IAggregateHealthSynthesis | null;
  isCached: boolean;
  generatedAt: Date;
  disclaimer: string;
}
