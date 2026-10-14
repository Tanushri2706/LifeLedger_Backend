import { GoogleGenAI } from '@google/genai';
import { config } from '../../config';
import {
  AggregateHealthSynthesisZodSchema,
  IAggregateHealthSynthesis,
  ICoverageSummary,
  ILongitudinalTrend,
  INormalizedObservation,
  MANDATORY_MEDICAL_DISCLAIMER
} from '../../types';
import { AppError } from '../../utils';

export interface AggregateSynthesisInput {
  userId: string;
  userProfile?: { age?: number; gender?: string; firstName?: string };
  coverage: ICoverageSummary;
  latestObservations: INormalizedObservation[];
  abnormalMarkers: INormalizedObservation[];
  currentFlaggedMarkers?: INormalizedObservation[];
  historicalFlaggedMarkers?: INormalizedObservation[];
  historicalQualitativeFindings?: INormalizedObservation[];
  longitudinalTrends: ILongitudinalTrend[];
  documentedDiagnoses: string[];
  currentDiagnoses?: string[];
  historicalDiagnoses?: string[];
  activeMedications: { name: string; dosage?: string; frequency?: string; instructions?: string }[];
}

export class AggregateAISynthesizer {
  private aiClient: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    this.modelName = config.aiModel || 'gemini-3.1-flash-lite';
    if (config.geminiApiKey) {
      this.aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
  }

  public async synthesize(input: AggregateSynthesisInput, forceMock: boolean = false): Promise<IAggregateHealthSynthesis> {
    // If mock provider is forced or test environment, return deterministic structured synthesis
    if (forceMock || config.aiProvider === 'mock' || !this.aiClient || process.env.NODE_ENV === 'test') {
      return this.generateDeterministicSynthesis(input);
    }

    const systemInstruction = `
You are LifeLedger's Longitudinal Health Intelligence Assistant.
Your role is to summarize a patient's historical lab trends and longitudinal health overview in plain, supportive, and educational language based ONLY on validated, structured facts from their health records.

CRITICAL MEDICAL SAFETY & TEMPORAL SEPARATION RULES:
1. TEMPORAL SEPARATION OF CURRENT VS HISTORICAL OBSERVATIONS:
   - Base current health assessments primarily on the LATEST available report observations.
   - You MUST distinguish between CURRENT findings (from the latest report) and HISTORICAL findings (from earlier reports).
   - If an earlier report had an abnormal result (e.g. low platelets or positive infectious antigen) and a later report shows normal CBC or improved values, do NOT describe the patient as currently having low platelets or an active acute abnormality.
   - For historical positive qualitative diagnostic results (e.g. positive Dengue NS1), use accurate language: "Previous testing recorded a positive Dengue NS1 result on [date]. Later CBC measurements show substantial numerical improvement."
   - Do NOT claim definitive "cure", "complete recovery", or "resolved infection" without explicit physician documentation.
2. URGENT SIGNALS POLICY:
   - "urgentSignals.hasUrgentConcern" MUST ONLY be true if the CURRENT/LATEST report contains active critical danger values requiring immediate medical intervention.
   - Historical abnormalities that have normalized or improved in subsequent testing MUST NOT trigger an urgent concern banner.
   - If only historical findings exist with normalized latest values, set "hasUrgentConcern: false" and "urgencyLevel: 'historical_finding'".
3. NON-DIAGNOSTIC MANDATE:
   - You MUST NOT diagnose diseases or state definitive medical conclusions.
   - Use educational, non-alarmist phrasing: "Lab trends indicate elevated markers that may be associated with...", "Consider reviewing these trends with your physician".
   - You MUST NOT recommend changing, stopping, or starting prescription medications.
4. KEY OBSERVATIONS FORMAT:
   - Distinguish Current vs Historical observations clearly.
   - If no abnormal values exist in the latest report, explicitly state: "No currently flagged values in the latest available report."
5. MANDATORY DISCLAIMER:
   - Always attach the mandatory medical disclaimer.

OUTPUT FORMAT:
Return a single strictly valid JSON object matching this schema:
{
  "overview": "string (clear 2-4 sentence summary of longitudinal health status)",
  "keyObservations": ["string (bullet points highlighting current and historical observations)"],
  "currentObservations": ["string (bullet points for current state)"],
  "historicalFindings": ["string (bullet points for past findings)"],
  "changesOverTime": ["string (notable longitudinal trend descriptions with percentages)"],
  "areasToDiscussWithDoctor": ["string (recommended talking points for next routine doctor appointment)"],
  "generalWellnessGuidance": {
    "nutritionNotes": ["string (broad supportive nutrition guidance)"],
    "activityNotes": ["string (broad supportive activity guidance)"],
    "lifestyleNotes": ["string (general sleep/hydration/stress management guidance)"]
  },
  "urgentSignals": {
    "hasUrgentConcern": boolean,
    "urgencyLevel": "none" | "informational" | "historical_finding" | "moderate" | "critical",
    "details": "string (optional, clear non-alarmist note if historical finding or critical alert if acute)"
  },
  "disclaimer": "${MANDATORY_MEDICAL_DISCLAIMER}"
}
    `.trim();

    // Prepare clean structured summary payload with explicit temporal grouping
    const structuredFactsPayload = {
      coverage: {
        analyzedReportsCount: input.coverage.analyzedReports,
        firstReportDate: input.coverage.firstReportDate,
        latestReportDate: input.coverage.latestReportDate,
        limitations: input.coverage.limitations
      },
      currentReportDate: input.coverage.latestReportDate,
      currentFlaggedMarkers: (input.currentFlaggedMarkers || []).map((o) => ({
        test: o.testName,
        value: `${o.rawValue} ${o.unit || ''}`.trim(),
        referenceRange: o.referenceRange || 'N/A',
        flag: o.flag || 'ABNORMAL',
        date: o.reportDate
      })),
      historicalFlaggedMarkers: (input.historicalFlaggedMarkers || []).map((o) => ({
        test: o.testName,
        value: `${o.rawValue} ${o.unit || ''}`.trim(),
        referenceRange: o.referenceRange || 'N/A',
        flag: o.flag || 'ABNORMAL',
        date: o.reportDate,
        temporalStatus: o.temporalStatus,
        context: o.sourceContext || 'Historical observation'
      })),
      latestMarkersSummary: input.latestObservations.map((o) => ({
        test: o.testName,
        value: `${o.rawValue} ${o.unit || ''}`.trim(),
        referenceRange: o.referenceRange || 'N/A',
        isAbnormal: o.isAbnormal,
        flag: o.flag || 'NORMAL',
        isHistorical: o.isHistorical || false,
        date: o.reportDate
      })),
      longitudinalTrends: input.longitudinalTrends.map((t) => ({
        marker: t.displayName,
        direction: t.direction,
        baseline: t.baselineValue !== null ? `${t.baselineValue} ${t.unit}` : 'N/A',
        latest: t.latestValue !== null ? `${t.latestValue} ${t.unit}` : 'N/A',
        changePercent: t.changePercent !== null ? `${t.changePercent}%` : 'N/A',
        observationsCount: t.observations.length,
        firstObservedDate: t.firstObservedDate,
        latestObservedDate: t.latestObservedDate
      })),
      currentDiagnoses: input.currentDiagnoses || [],
      historicalDiagnoses: input.historicalDiagnoses || [],
      activeMedications: input.activeMedications.map((m) => `${m.name} ${m.dosage || ''} (${m.frequency || ''})`.trim())
    };

    const prompt = `
PATIENT STRUCTURED LONGITUDINAL HEALTH FACTS:
${JSON.stringify(structuredFactsPayload, null, 2)}

Please analyze these structured longitudinal facts according to the system instructions and return ONLY the valid JSON object.
    `.trim();

    try {
      const startTime = Date.now();
      const response = await this.aiClient.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const responseText = response.text || '';
      if (!responseText.trim()) {
        throw new AppError('AI provider returned an empty synthesis response', 502);
      }

      const cleanedJson = responseText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsedJson = JSON.parse(cleanedJson);

      const validation = AggregateHealthSynthesisZodSchema.safeParse(parsedJson);
      if (!validation.success) {
        console.warn('[AggregateAISynthesizer] Schema validation issue:', JSON.stringify(validation.error.issues));
        return this.generateDeterministicSynthesis(input);
      }

      const durationMs = Date.now() - startTime;
      console.log(`[AggregateAISynthesizer] Longitudinal synthesis generated in ${durationMs}ms`);

      return {
        ...validation.data,
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER
      };
    } catch (err) {
      console.error('[AggregateAISynthesizer] Synthesis generation error, using deterministic fallback:', err instanceof Error ? err.message : 'Unknown error');
      return this.generateDeterministicSynthesis(input);
    }
  }

  public generateDeterministicSynthesis(input: AggregateSynthesisInput): IAggregateHealthSynthesis {
    const {
      coverage,
      latestObservations = [],
      currentFlaggedMarkers = input.abnormalMarkers || [],
      historicalFlaggedMarkers = [],
      historicalQualitativeFindings = [],
      longitudinalTrends = [],
      currentDiagnoses = [],
      historicalDiagnoses = [],
      activeMedications = []
    } = input;

    let overview = '';
    const keyObservations: string[] = [];
    const currentObservations: string[] = [];
    const historicalFindings: string[] = [];
    const changesOverTime: string[] = [];
    const areasToDiscussWithDoctor: string[] = [];
    const nutritionNotes: string[] = [];
    const activityNotes: string[] = [];
    const lifestyleNotes: string[] = [];

    const formatDateStr = (d?: Date): string => {
      if (!d) return 'N/A';
      try {
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return String(d);
      }
    };

    const firstDateStr = formatDateStr(coverage.firstReportDate);
    const latestDateStr = formatDateStr(coverage.latestReportDate);
    const isMultiDate = firstDateStr !== latestDateStr && firstDateStr !== 'N/A' && latestDateStr !== 'N/A';
    const dateRangeStr = isMultiDate ? `${firstDateStr} – ${latestDateStr}` : latestDateStr;

    if (coverage.analyzedReports === 0) {
      overview = 'No analyzed medical records are currently available in your Health Vault to generate longitudinal insights.';
    } else {
      const reportWord = coverage.analyzedReports === 1 ? 'report' : 'reports';
      if (currentFlaggedMarkers.length === 0) {
        if (historicalFlaggedMarkers.length > 0 || historicalQualitativeFindings.length > 0) {
          overview = `Health Intelligence evaluated ${coverage.analyzedReports} ${reportWord} across your record history (${dateRangeStr}). The latest laboratory panel demonstrates marked improvement with all tracked clinical parameters within normal reference ranges, reflecting positive longitudinal progress following earlier clinical findings.`;
        } else {
          overview = `Health Intelligence evaluated ${coverage.analyzedReports} ${reportWord} across your record history (${dateRangeStr}). All extracted clinical parameters in the latest report appear within documented reference ranges.`;
        }
      } else {
        overview = `Health Intelligence evaluated ${coverage.analyzedReports} ${reportWord} across your record history (${dateRangeStr}). ${currentFlaggedMarkers.length} marker${currentFlaggedMarkers.length === 1 ? '' : 's'} in your latest report were noted outside typical reference ranges.`;
      }
    }

    // 1. Current observations
    if (currentFlaggedMarkers.length > 0) {
      for (const cm of currentFlaggedMarkers.slice(0, 4)) {
        const item = `Current: ${cm.testName} is ${cm.rawValue} ${cm.unit || ''} (${cm.flag || 'Abnormal'}) - reference: ${cm.referenceRange || 'N/A'}`;
        currentObservations.push(item);
        keyObservations.push(item);
      }
    } else {
      const noFlagMsg = 'Current: No currently flagged values in the latest available report.';
      currentObservations.push(noFlagMsg);
      keyObservations.push(noFlagMsg);

      // Highlight key normalized parameters if present
      const keyNormalMarkers = latestObservations.filter((o) =>
        /platelet|wbc|white blood|hemoglobin|hematocrit|glucose|creatinine/i.test(o.testName) && !o.isAbnormal && !o.isHistorical
      ).slice(0, 3);

      for (const kn of keyNormalMarkers) {
        const item = `Current: Latest ${kn.testName} is ${kn.rawValue} ${kn.unit || ''} (Normal) - within reference range.`;
        currentObservations.push(item);
        keyObservations.push(item);
      }
    }

    if (currentDiagnoses.length > 0) {
      const item = `Current: Active documented impression: ${currentDiagnoses.join(', ')}.`;
      currentObservations.push(item);
      keyObservations.push(item);
    }

    // 2. Historical findings
    if (historicalQualitativeFindings.length > 0) {
      for (const hq of historicalQualitativeFindings) {
        const hDate = formatDateStr(hq.reportDate);
        const item = `Historical: Previous testing recorded a positive ${hq.testName} result on ${hDate}. Later CBC measurements show substantial numerical improvement.`;
        historicalFindings.push(item);
        keyObservations.push(item);
      }
    }

    const uniqueHistMarkers = new Set<string>();
    for (const hf of historicalFlaggedMarkers) {
      if (historicalQualitativeFindings.some((q) => q.testName === hf.testName)) continue;
      if (uniqueHistMarkers.has(hf.testName)) continue;
      uniqueHistMarkers.add(hf.testName);

      const hDate = formatDateStr(hf.reportDate);
      const isResolved = hf.temporalStatus === 'historical_normalized';
      const item = isResolved
        ? `Historical: Previous ${hf.testName} was ${hf.rawValue} ${hf.unit || ''} (${hf.flag || 'Low'}) on ${hDate}, which has normalized in the latest report.`
        : `Historical: Previous ${hf.testName} was ${hf.rawValue} ${hf.unit || ''} (${hf.flag || 'Abnormal'}) on ${hDate}.`;
      historicalFindings.push(item);
      keyObservations.push(item);
    }

    if (historicalDiagnoses.length > 0) {
      const item = `Historical: Previous documented clinical impression: ${historicalDiagnoses.join(', ')}.`;
      historicalFindings.push(item);
      keyObservations.push(item);
    }

    // 3. Trends over time
    for (const t of longitudinalTrends) {
      if (t.direction !== 'insufficient_data' && t.observations.length >= 2) {
        const pctStr = t.changePercent !== null ? ` (${t.changePercent > 0 ? '+' : ''}${t.changePercent}%)` : '';
        const changeStr = t.changeValue !== null ? ` [${t.changeValue > 0 ? '+' : ''}${t.changeValue} ${t.unit}]` : '';
        changesOverTime.push(
          `${t.displayName} showed an ${t.direction} trajectory (${t.baselineValue} $\\rightarrow$ ${t.latestValue} ${t.unit}${changeStr}${pctStr}) across ${t.observations.length} recordings.`
        );
      }
    }
    if (changesOverTime.length === 0 && coverage.analyzedReports >= 2) {
      changesOverTime.push('Markers showed steady, stable values across analyzed testing intervals.');
    }

    // 4. Areas to discuss with doctor
    if (currentFlaggedMarkers.length > 0) {
      areasToDiscussWithDoctor.push(`Review recent ${currentFlaggedMarkers.map((a) => a.testName).slice(0, 3).join(', ')} findings with your doctor.`);
    } else if (historicalFlaggedMarkers.length > 0 || historicalQualitativeFindings.length > 0) {
      areasToDiscussWithDoctor.push('Review recent lab normalization and recovery progress with your physician.');
      areasToDiscussWithDoctor.push('Confirm if any follow-up convalescent monitoring or repeat clinical consultation is needed.');
    } else {
      areasToDiscussWithDoctor.push('Discuss recommended timing for routine preventive follow-up panels.');
    }

    if (activeMedications.length > 0) {
      areasToDiscussWithDoctor.push('Confirm optimal dosage and tolerance for current prescribed medications.');
    }

    // 5. General wellness guidance
    nutritionNotes.push('Maintain balanced, nutrient-dense meals with adequate hydration and fiber.');
    activityNotes.push('Aim for regular moderate aerobic physical activity as advised by your healthcare provider.');
    lifestyleNotes.push('Prioritize consistent 7-8 hours of sleep and routine health checkups.');

    // 6. Urgent signals calculation
    let hasUrgentConcern = false;
    let urgencyLevel: 'none' | 'historical_finding' | 'moderate' | 'critical' = 'none';
    let urgentDetails: string | null = null;

    // Only CURRENT critical abnormalities trigger an urgent alert
    const criticalCurrentMarkers = currentFlaggedMarkers.filter((m) => {
      if (/platelet/i.test(m.testName) && m.numericValue !== null && m.numericValue < 50000) return true;
      if (/hemoglobin/i.test(m.testName) && m.numericValue !== null && m.numericValue < 7.0) return true;
      if (/wbc/i.test(m.testName) && m.numericValue !== null && (m.numericValue < 2000 || m.numericValue > 30000)) return true;
      return false;
    });

    if (criticalCurrentMarkers.length > 0) {
      hasUrgentConcern = true;
      urgencyLevel = 'critical';
      urgentDetails = `Critical value noted in latest report: ${criticalCurrentMarkers.map((c) => `${c.testName} (${c.rawValue} ${c.unit || ''})`).join(', ')}. Please contact your healthcare provider promptly.`;
    } else if (historicalFlaggedMarkers.length > 0 || historicalQualitativeFindings.length > 0) {
      hasUrgentConcern = false;
      urgencyLevel = 'historical_finding';
      const histSummary = historicalQualitativeFindings.length > 0 && historicalQualitativeFindings[0]
        ? `Previous record noted positive ${historicalQualitativeFindings[0].testName}. Later laboratory results demonstrate marked numerical improvement across CBC parameters with no active acute flags.`
        : 'Previous abnormal findings have improved or normalized in subsequent testing.';
      urgentDetails = histSummary;
    }

    return {
      overview,
      keyObservations,
      currentObservations,
      historicalFindings,
      changesOverTime,
      areasToDiscussWithDoctor,
      generalWellnessGuidance: {
        nutritionNotes,
        activityNotes,
        lifestyleNotes
      },
      urgentSignals: {
        hasUrgentConcern,
        urgencyLevel,
        details: urgentDetails
      },
      disclaimer: MANDATORY_MEDICAL_DISCLAIMER
    };
  }
}

export const aggregateAISynthesizer = new AggregateAISynthesizer();
