import { GoogleGenAI } from '@google/genai';
import {
  IExtractedDocument,
  IReportMetadata,
  IStructuredReportAnalysis,
  MANDATORY_MEDICAL_DISCLAIMER,
  StructuredReportAnalysisZodSchema
} from '../../types';
import { IAIHealthProvider } from './aiProvider.interface';
import { AppError } from '../../utils';

export interface GeminiHealthProviderOptions {
  timeoutMs?: number;
  maxRetries?: number;
  client?: GoogleGenAI;
}

export class GeminiHealthProvider implements IAIHealthProvider {
  public readonly providerName = 'gemini';
  public readonly modelName: string;
  private aiClient: GoogleGenAI;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(
    apiKey: string,
    modelName: string = 'gemini-3.1-flash-lite',
    options: GeminiHealthProviderOptions = {}
  ) {
    if (!apiKey && !options.client) {
      throw new AppError('Gemini API key is required to initialize GeminiHealthProvider', 500);
    }
    this.modelName = modelName;
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.maxRetries = options.maxRetries ?? 2;
    this.aiClient = options.client ?? new GoogleGenAI({ apiKey });
  }

  public async analyzeMedicalDocument(
    extraction: IExtractedDocument,
    metadata: IReportMetadata
  ): Promise<IStructuredReportAnalysis> {
    const startTime = Date.now();

    const systemInstruction = `
You are LifeLedger's Health Intelligence Assistant.
Your purpose is to help patients understand their medical reports in plain, supportive, and accessible language.

CRITICAL MEDICAL SAFETY & ETHICAL RULES:
1. NON-DIAGNOSTIC MANDATE:
   - You MUST NOT claim to diagnose any disease, illness, or condition.
   - You MUST NOT replace a qualified physician or healthcare provider.
   - Use careful, supportive, and non-alarmist language such as: "possible concern", "AI-detected pattern", "may be associated with", "consider discussing this with a doctor".
   - NEVER write statements like "You have diabetes", "You have cancer", "This confirms disease".
2. STRICT SEPARATION OF SOURCE FACTS VS AI INSIGHTS:
   - "sourceFacts": Extract ONLY values and statements explicitly written in the report (test names, values, units, reference ranges, documented prescriptions, and diagnoses written by the issuing physician). Do NOT invent or infer lab values.
   - "aiInsights": Your educational interpretation explaining what the findings mean for the patient in plain English.
3. NEVER INVENT OR HALLUCINATE:
   - Do not invent test values, medications, dosages, or reference ranges not supported by the document.
4. EMERGENCY PROTOCOL:
   - If values indicate severe critical danger (e.g. critically low platelets, extreme cardiac markers), set emergencySignals.isEmergency = true with calm, clear emergency guidance.
5. DISCLAIMER:
   - Always attach the exact mandatory disclaimer.

OUTPUT FORMAT:
Return a single, strictly valid JSON object matching this schema:
{
  "sourceFacts": {
    "extractedValues": [
      {
        "testName": "string",
        "value": "string",
        "unit": "string",
        "referenceRange": "string",
        "isAbnormal": boolean,
        "flag": "LOW" | "HIGH" | "NORMAL" | "ABNORMAL",
        "sourceContext": "string"
      }
    ],
    "documentedDiagnoses": ["string"],
    "documentedMedications": [
      {
        "name": "string",
        "dosage": "string",
        "frequency": "string",
        "instructions": "string"
      }
    ]
  },
  "aiInsights": {
    "summary": "string",
    "keyFindings": ["string"],
    "potentialConcerns": [
      {
        "concern": "string",
        "possibleRelevance": "string",
        "severity": "low" | "moderate" | "high",
        "sourceRef": "string"
      }
    ],
    "riskAssessment": {
      "level": "low" | "moderate" | "high" | "critical",
      "explanation": "string"
    },
    "lifestyleGuidance": {
      "dietSuggestions": ["string"],
      "exerciseSuggestions": ["string"],
      "generalTips": ["string"]
    },
    "questionsForDoctor": ["string"],
    "emergencySignals": {
      "isEmergency": boolean,
      "warningDetails": "string",
      "emergencyAdvice": "string"
    }
  },
  "healthScoreImpact": {
    "calculatedScore": number (0-100),
    "justification": "string"
  },
  "disclaimer": "${MANDATORY_MEDICAL_DISCLAIMER}"
}
    `.trim();

    const prompt = `
DOCUMENT METADATA:
Title: ${metadata.title}
Category: ${metadata.category}
Report Type: ${metadata.reportType || 'General'}
Hospital: ${metadata.hospital || 'Not specified'}
Doctor: ${metadata.doctor || 'Not specified'}
Date: ${metadata.reportDate ? new Date(metadata.reportDate).toLocaleDateString() : 'Not specified'}

DOCUMENT EXTRACTED TEXT:
"""
${extraction.rawText}
"""

Please analyze this document according to the system instructions and return ONLY the valid JSON object.
    `.trim();

    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const responseText = await this.executeWithTimeout(async () => {
          const response = await this.aiClient.models.generateContent({
            model: this.modelName,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          });
          return response.text || '';
        }, this.timeoutMs);

        if (!responseText.trim()) {
          throw new AppError('AI provider returned an empty response', 502);
        }

        // Parse JSON from response
        let parsedJson: unknown;
        try {
          const cleanedJson = responseText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
          parsedJson = JSON.parse(cleanedJson);
        } catch {
          throw new AppError('AI provider returned malformed JSON output', 502);
        }

        // Validate against Zod schema
        const validation = StructuredReportAnalysisZodSchema.safeParse(parsedJson);
        if (!validation.success) {
          throw new AppError('AI analysis output failed validation schema', 502, {
            validationErrors: validation.error.flatten()
          });
        }

        const durationMs = Date.now() - startTime;
        const validatedData = validation.data;

        // Log safe operational metadata only (no medical data)
        console.log(`[GeminiHealthProvider] Analysis completed for reportId=${metadata.reportId} model=${this.modelName} duration=${durationMs}ms`);

        return {
          ...validatedData,
          disclaimer: MANDATORY_MEDICAL_DISCLAIMER,
          metadata: {
            provider: this.providerName,
            model: this.modelName,
            analyzedAt: new Date(),
            durationMs
          }
        };
      } catch (err: unknown) {
        const isTransient = this.isTransientError(err);
        if (isTransient && attempt <= this.maxRetries) {
          const backoffDelay = Math.min(2000, 300 * Math.pow(2, attempt - 1)) + Math.random() * 100;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        if (err instanceof AppError) {
          throw err;
        }

        const sanitizedCategory = this.sanitizeErrorMessage(err);
        console.error(`[GeminiHealthProvider] Analysis failed for reportId=${metadata.reportId} model=${this.modelName} errorCategory="${sanitizedCategory}"`);
        throw new AppError(`AI Health Provider analysis failed: ${sanitizedCategory}`, 502);
      }
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new AppError(`AI provider request timed out after ${timeoutMs}ms`, 504));
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private isTransientError(err: unknown): boolean {
    if (err instanceof AppError && err.statusCode === 504) {
      return false; // Timeouts should not be blindly retried
    }
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (
        msg.includes('429') ||
        msg.includes('rate limit') ||
        msg.includes('quota') ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('network')
      ) {
        return true;
      }
    }
    return false;
  }

  private sanitizeErrorMessage(err: unknown): string {
    if (err instanceof AppError) return err.message;
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key')) {
        return 'Authentication failed with AI provider. Please verify API configuration.';
      }
      if (msg.includes('429') || msg.includes('rate limit')) {
        return 'AI provider rate limit exceeded. Please retry shortly.';
      }
      if (msg.includes('503') || msg.includes('unavailable')) {
        return 'AI provider service is temporarily unavailable. Please retry shortly.';
      }
      if (msg.includes('timed out') || msg.includes('timeout')) {
        return 'AI provider request timed out.';
      }
      return 'Unexpected error during AI generation.';
    }
    return 'Unknown AI provider error.';
  }
}

