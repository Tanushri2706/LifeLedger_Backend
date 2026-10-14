import { z } from 'zod';

export enum ExtractionQuality {
  USABLE_CLINICAL = 'usable_clinical',
  UNREADABLE_RAW_STREAM = 'unreadable_raw_stream',
  EMPTY_TEXT = 'empty_text',
  NON_MEDICAL_CONTENT = 'non_medical_content',
  UNSUPPORTED_IMAGE_SCAN = 'unsupported_image_scan'
}

export interface IExtractedDocument {
  rawText: string;
  pageCount?: number;
  confidence: number;
  mimeType: string;
  isReadable: boolean;
  hasClinicalContent: boolean;
  quality: ExtractionQuality;
  qualityReason?: string;
  extractionMethod?: 'pdf_text' | 'gemini_multimodal' | 'mock';
  extractedMetadata?: Record<string, unknown>;
}

export interface IReportMetadata {
  reportId: string;
  userId: string;
  title: string;
  category: string;
  reportType?: string;
  hospital?: string;
  doctor?: string;
  reportDate?: Date;
  fileType: string;
  mimeType: string;
}

export interface IExtractedLabValue {
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  isAbnormal: boolean;
  flag?: 'LOW' | 'HIGH' | 'NORMAL' | 'ABNORMAL' | string;
  sourceContext?: string;
}

export interface IDocumentedMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  instructions?: string;
}

export interface IPotentialConcern {
  concern: string;
  possibleRelevance: string;
  severity: 'low' | 'moderate' | 'high';
  sourceRef?: string;
}

export interface IRiskAssessment {
  level: 'low' | 'moderate' | 'high' | 'critical';
  explanation: string;
}

export interface ILifestyleGuidance {
  dietSuggestions?: string[];
  exerciseSuggestions?: string[];
  generalTips?: string[];
}

export interface IEmergencySignals {
  isEmergency: boolean;
  warningDetails?: string;
  emergencyAdvice?: string;
}

export interface IHealthScoreImpact {
  calculatedScore?: number;
  justification?: string;
}

export interface IStructuredReportAnalysis {
  sourceFacts: {
    extractedValues: IExtractedLabValue[];
    documentedDiagnoses: string[];
    documentedMedications: IDocumentedMedication[];
  };
  aiInsights: {
    summary: string;
    keyFindings: string[];
    potentialConcerns: IPotentialConcern[];
    riskAssessment: IRiskAssessment;
    lifestyleGuidance: ILifestyleGuidance;
    questionsForDoctor: string[];
    emergencySignals: IEmergencySignals;
  };
  healthScoreImpact: IHealthScoreImpact;
  disclaimer: string;
  metadata: {
    provider: string;
    model: string;
    analyzedAt: Date;
    durationMs?: number;
  };
}

export const MANDATORY_MEDICAL_DISCLAIMER =
  'This AI analysis is for educational and organizational purposes only and does not constitute a medical diagnosis, prognosis, or treatment plan. Always consult a qualified healthcare professional for medical advice and before making healthcare decisions.';

// Zod Schema for Structured AI Output Validation
export const ExtractedLabValueZodSchema = z.object({
  testName: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().optional().default(''),
  referenceRange: z.string().optional().default(''),
  isAbnormal: z.boolean().default(false),
  flag: z.enum(['LOW', 'HIGH', 'NORMAL', 'ABNORMAL']).or(z.string()).optional(),
  sourceContext: z.string().optional()
});

export const DocumentedMedicationZodSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  instructions: z.string().optional()
});

export const PotentialConcernZodSchema = z.object({
  concern: z.string().min(1),
  possibleRelevance: z.string().min(1),
  severity: z.enum(['low', 'moderate', 'high']).default('low'),
  sourceRef: z.string().optional()
});

export const RiskAssessmentZodSchema = z.object({
  level: z.enum(['low', 'moderate', 'high', 'critical']).default('low'),
  explanation: z.string().min(1)
});

export const LifestyleGuidanceZodSchema = z.object({
  dietSuggestions: z.array(z.string()).optional().default([]),
  exerciseSuggestions: z.array(z.string()).optional().default([]),
  generalTips: z.array(z.string()).optional().default([])
});

export const EmergencySignalsZodSchema = z.object({
  isEmergency: z.boolean().default(false),
  warningDetails: z.string().optional(),
  emergencyAdvice: z.string().optional()
});

export const HealthScoreImpactZodSchema = z.object({
  calculatedScore: z.number().min(0).max(100).optional(),
  justification: z.string().optional()
});

export const StructuredReportAnalysisZodSchema = z.object({
  sourceFacts: z.object({
    extractedValues: z.array(ExtractedLabValueZodSchema).default([]),
    documentedDiagnoses: z.array(z.string()).default([]),
    documentedMedications: z.array(DocumentedMedicationZodSchema).default([])
  }),
  aiInsights: z.object({
    summary: z.string().min(1),
    keyFindings: z.array(z.string()).default([]),
    potentialConcerns: z.array(PotentialConcernZodSchema).default([]),
    riskAssessment: RiskAssessmentZodSchema,
    lifestyleGuidance: LifestyleGuidanceZodSchema.default({
      dietSuggestions: [],
      exerciseSuggestions: [],
      generalTips: []
    }),
    questionsForDoctor: z.array(z.string()).default([]),
    emergencySignals: EmergencySignalsZodSchema.default({ isEmergency: false })
  }),
  healthScoreImpact: HealthScoreImpactZodSchema.default({}),
  disclaimer: z.string().default(MANDATORY_MEDICAL_DISCLAIMER)
});

export type StructuredReportAnalysisDto = z.infer<typeof StructuredReportAnalysisZodSchema>;

export interface AnalyzeReportRequestDto {
  reportId?: string;
  forceReanalyze?: boolean;
}
