import { z } from 'zod';
const { PDFParse } = require('pdf-parse');
import { GoogleGenAI } from '@google/genai';
import { config } from '../../config';
import { IExtractedDocument, ExtractionQuality } from '../../types';
import { IDocumentExtractor } from './documentExtractor.interface';

// Comprehensive list of medical & clinical indicator tokens
export const CLINICAL_MARKERS = [
  // Laboratory tests & blood markers
  'glucose', 'sugar', 'hba1c', 'hemoglobin', 'cbc', 'rbc', 'wbc', 'platelet', 'platelets',
  'cholesterol', 'ldl', 'hdl', 'vldl', 'triglyceride', 'triglycerides', 'lipid', 'creatinine',
  'urea', 'bun', 'bilirubin', 'sgot', 'sgpt', 'ast', 'alt', 'alkaline phosphatase', 'alp',
  'thyroid', 'tsh', 't3', 't4', 'electrolyte', 'electrolytes', 'sodium', 'potassium',
  'chloride', 'calcium', 'vitamin', 'crp', 'esr', 'uric acid', 'albumin', 'globulin',
  'metabolic', 'hematocrit', 'pcv', 'mcv', 'mch', 'mchc', 'rdw', 'neutrophil', 'neutrophils',
  'lymphocyte', 'lymphocytes', 'monocyte', 'monocytes', 'eosinophil', 'eosinophils', 'basophil',
  'dengue', 'ns1', 'serology', 'antigen', 'antibody', 'igm', 'igg', 'malaria', 'typhoid', 'widal',
  'urine', 'serum', 'plasma', 'biopsy', 'pathology', 'haematology', 'hematology',
  'ecg', 'ekg', 'x-ray', 'ct scan', 'mri', 'ultrasound', 'sonography',
  // Units & ranges
  'mg/dl', 'g/dl', 'mmol/l', 'u/l', 'iu/l', 'mcg/dl', 'cells/mcl', 'cells/ul', 'cells/cumm',
  'ng/ml', 'pg/ml', 'fl', 'pg', 'million/ul', 'million/mcl', '%',
  'reference range', 'ref range', 'normal range', 'reference interval',
  // Clinical headers & terms
  'patient', 'physician', 'doctor', 'hospital', 'clinic', 'laboratory', 'diagnostic',
  'diagnosis', 'impression', 'clinical impression', 'findings', 'medication', 'prescription',
  'rx', 'dosage', 'tablet', 'tablets', 'capsule', 'capsules', 'syrup', 'injection',
  'twice daily', 'once daily', 'thrice daily', 'at bedtime', 'with meals', 'sos',
  'vital signs', 'blood pressure', 'pulse rate', 'heart rate', 'reactive', 'non-reactive',
  'positive', 'negative'
];

export const MultimodalExtractionZodSchema = z.object({
  isMedicalDocument: z.boolean().default(false),
  unreadableReason: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  reportDate: z.string().nullable().optional(),
  facility: z.string().nullable().optional(),
  extractedValues: z
    .array(
      z.object({
        testName: z.string(),
        value: z.string(),
        unit: z.string().nullable().optional(),
        referenceRange: z.string().nullable().optional(),
        isAbnormal: z.boolean().default(false),
        flag: z.string().nullable().optional()
      })
    )
    .nullish()
    .transform((val) => val || [])
    .default([]),
  documentedDiagnoses: z
    .array(z.string())
    .nullish()
    .transform((val) => val || [])
    .default([]),
  documentedMedications: z
    .array(
      z.object({
        name: z.string(),
        dosage: z.string().nullable().optional(),
        frequency: z.string().nullable().optional(),
        instructions: z.string().nullable().optional()
      })
    )
    .nullish()
    .transform((val) => val || [])
    .default([]),
  clinicalTextSummary: z.string().nullish().transform((val) => val || '').default('')
});

export type IMultimodalExtractionResult = z.infer<typeof MultimodalExtractionZodSchema>;

export interface QualityAssessment {
  isReadable: boolean;
  hasClinicalContent: boolean;
  quality: ExtractionQuality;
  qualityReason?: string;
  cleanedText: string;
}

export function assessDocumentContent(
  rawText: string,
  mimeType: string,
  filename: string,
  rawBufferString?: string
): QualityAssessment {
  const fullContent = (rawText || rawBufferString || '').trim();

  // 1. Check for empty / whitespace text
  if (!fullContent || fullContent.length === 0) {
    return {
      isReadable: false,
      hasClinicalContent: false,
      quality: ExtractionQuality.EMPTY_TEXT,
      qualityReason: 'The document contains no readable text. Scanned or empty documents require multimodal extraction.',
      cleanedText: ''
    };
  }

  // 2. Detect and filter raw PDF structure / syntax if input was raw stream
  const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf') || fullContent.startsWith('%PDF-');

  let cleanedText = fullContent;

  if (isPdf && fullContent.startsWith('%PDF-')) {
    const textWithoutPdf = fullContent
      .replace(/%(?:PDF-\d\.\d).*/gi, ' ')
      .replace(/\b\d+\s+\d+\s+obj\b/gi, ' ')
      .replace(/\bendobj\b/gi, ' ')
      .replace(/\b\d+\s+\d+\s+R\b/gi, ' ')
      .replace(/\bxref\b[\s\S]*?(?:trailer|\b\d+\s+\d+\s+obj\b|$)/gi, ' ')
      .replace(/\bstartxref\b[\s\S]*/gi, ' ')
      .replace(/\btrailer\b/gi, ' ')
      .replace(/%%EOF/gi, ' ')
      .replace(/\bstream[\s\S]*?endstream\b/gi, ' ')
      .replace(/<<[\s\S]*?>>/g, ' ')
      .replace(/(?:^|[\s<[(\\/])\/[A-Z][a-zA-Z0-9_]+/g, ' ')
      .replace(/[^a-zA-Z0-9\s.,:%()/-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const naturalWords = textWithoutPdf
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z]/g, ''))
      .filter((w) => w.length >= 3);

    if (naturalWords.length < 4) {
      return {
        isReadable: false,
        hasClinicalContent: false,
        quality: ExtractionQuality.UNREADABLE_RAW_STREAM,
        qualityReason: 'The document appears to contain raw PDF syntax or binary stream metadata rather than readable medical text.',
        cleanedText: ''
      };
    }
    cleanedText = textWithoutPdf;
  } else {
    cleanedText = fullContent
      .replace(/[^a-zA-Z0-9\s.,:%()/-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const naturalWords = cleanedText
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length >= 3);

  if (cleanedText.length < 15 || naturalWords.length < 3) {
    return {
      isReadable: false,
      hasClinicalContent: false,
      quality: isPdf ? ExtractionQuality.UNREADABLE_RAW_STREAM : ExtractionQuality.EMPTY_TEXT,
      qualityReason: 'The document contains insufficient readable text for medical evaluation.',
      cleanedText: ''
    };
  }

  // 3. Clinical Context Evaluation
  const lower = cleanedText.toLowerCase();
  let clinicalHits = 0;
  for (const marker of CLINICAL_MARKERS) {
    if (lower.includes(marker)) {
      clinicalHits++;
    }
  }

  if (clinicalHits === 0) {
    return {
      isReadable: true,
      hasClinicalContent: false,
      quality: ExtractionQuality.NON_MEDICAL_CONTENT,
      qualityReason: 'The document text does not contain recognized medical or clinical diagnostic information.',
      cleanedText
    };
  }

  return {
    isReadable: true,
    hasClinicalContent: true,
    quality: ExtractionQuality.USABLE_CLINICAL,
    qualityReason: undefined,
    cleanedText
  };
}

export class StandardDocumentExtractor implements IDocumentExtractor {
  private aiClient: GoogleGenAI | null = null;
  private modelName: string;

  constructor() {
    this.modelName = config.aiModel || 'gemini-3.1-flash-lite';
    if (config.geminiApiKey) {
      this.aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
  }

  public async extractText(fileBuffer: Buffer, mimeType: string, filename: string): Promise<IExtractedDocument> {
    const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
    const isImage = mimeType.startsWith('image/') || /\.(?:png|jpe?g|webp|tiff|bmp)$/i.test(filename);

    // STEP 1: If PDF, attempt digital text extraction first
    if (isPdf) {
      try {
        const parser = new PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        const extractedText = (parsed?.text || '').trim();

        if (extractedText.length > 30) {
          const assessment = assessDocumentContent(extractedText, mimeType, filename);
          if (assessment.isReadable && assessment.hasClinicalContent && assessment.quality === ExtractionQuality.USABLE_CLINICAL) {
            return {
              rawText: assessment.cleanedText,
              confidence: 0.95,
              mimeType,
              pageCount: parsed?.total || 1,
              isReadable: true,
              hasClinicalContent: true,
              quality: ExtractionQuality.USABLE_CLINICAL,
              extractionMethod: 'pdf_text',
              extractedMetadata: {
                filename,
                extractor: 'StandardDocumentExtractor:PDFParse',
                quality: ExtractionQuality.USABLE_CLINICAL,
                pageCount: parsed?.total || 1
              }
            };
          }
        }
      } catch (pdfErr) {
        // Digital binary extraction failed - check if buffer contains readable text directly
        const rawContent = fileBuffer.toString('utf-8');
        if (rawContent.length > 30) {
          const assessment = assessDocumentContent(rawContent, mimeType, filename);
          if (assessment.isReadable && assessment.hasClinicalContent && assessment.quality === ExtractionQuality.USABLE_CLINICAL) {
            return {
              rawText: assessment.cleanedText,
              confidence: 0.90,
              mimeType,
              pageCount: 1,
              isReadable: true,
              hasClinicalContent: true,
              quality: ExtractionQuality.USABLE_CLINICAL,
              extractionMethod: 'pdf_text',
              extractedMetadata: {
                filename,
                extractor: 'StandardDocumentExtractor:TextBufferFallback',
                quality: ExtractionQuality.USABLE_CLINICAL,
                pageCount: 1
              }
            };
          }
        }
      }
    }

    // STEP 2: Multimodal Extraction Fallback (for Scanned PDFs and Images)
    if (this.aiClient && (isPdf || isImage)) {
      return this.extractMultimodal(fileBuffer, mimeType, filename);
    }

    // Fail-safe if no multimodal provider is available
    return {
      rawText: '',
      confidence: 0,
      mimeType,
      isReadable: false,
      hasClinicalContent: false,
      quality: isImage ? ExtractionQuality.UNSUPPORTED_IMAGE_SCAN : ExtractionQuality.EMPTY_TEXT,
      qualityReason: 'Digital text extraction was insufficient and multimodal extraction provider is unavailable.',
      extractionMethod: isPdf ? 'pdf_text' : 'gemini_multimodal',
      extractedMetadata: {
        filename,
        extractor: 'StandardDocumentExtractor:Fallback'
      }
    };
  }

  private async extractMultimodal(
    fileBuffer: Buffer,
    mimeType: string,
    filename: string
  ): Promise<IExtractedDocument> {
    const systemInstruction = `
You are LifeLedger's Document Fact Extraction Engine (STAGE 1).
Your role is to read the uploaded medical document (image or scanned PDF) and extract ONLY the explicitly visible medical and clinical text facts.

CRITICAL EXTRACTION MANDATES:
1. STRICT FACT EXTRACTION ONLY:
   - Extract only what is visibly printed or written in the document.
   - Do NOT provide medical diagnoses, health advice, risk levels, or clinical conclusions.
   - Do NOT invent missing values, reference ranges, or units.
2. NON-MEDICAL DOCUMENT RECOGNITION:
   - If the uploaded image or document is NOT a medical record, diagnostic report, lab test, clinical summary, discharge note, or prescription (e.g. a photo of a vehicle, scenery, generic invoice, selfie, blank page):
     Set "isMedicalDocument": false and "unreadableReason": "Document does not contain recognizable clinical or medical diagnostic content."
3. READABLE MEDICAL DOCUMENT:
   - If valid medical content is present, set "isMedicalDocument": true.
   - Extract patient info, test names, raw values, units, reference ranges, abnormal flags, documented physician impressions/diagnoses, and prescribed medications.

OUTPUT FORMAT:
Return a single strictly valid JSON object matching this schema:
{
  "isMedicalDocument": boolean,
  "unreadableReason": string | null,
  "patientName": string | null,
  "reportDate": string | null,
  "facility": string | null,
  "extractedValues": [
    {
      "testName": "string",
      "value": "string",
      "unit": "string",
      "referenceRange": "string",
      "isAbnormal": boolean,
      "flag": "LOW" | "HIGH" | "NORMAL" | "ABNORMAL" | null
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
  ],
  "clinicalTextSummary": "string (formatted multiline text representation of all extracted clinical observations, headers, and values)"
}
    `.trim();

    try {
      const normalizedMime = mimeType === 'application/pdf'
        ? 'application/pdf'
        : mimeType.startsWith('image/')
          ? mimeType
          : filename.toLowerCase().endsWith('.png')
            ? 'image/png'
            : filename.toLowerCase().endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';

      const response = await this.aiClient!.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: fileBuffer.toString('base64')
                }
              },
              {
                text: 'Extract visible clinical facts from this document as JSON according to system instructions.'
              }
            ]
          }
        ],
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      });

      const responseText = response.text || '';
      if (!responseText.trim()) {
        throw new Error('Empty response from multimodal extraction');
      }

      const cleanedJson = responseText.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      const parsedJson = JSON.parse(cleanedJson);
      const validation = MultimodalExtractionZodSchema.safeParse(parsedJson);

      if (!validation.success) {
        return {
          rawText: '',
          confidence: 0,
          mimeType,
          isReadable: false,
          hasClinicalContent: false,
          quality: ExtractionQuality.UNREADABLE_RAW_STREAM,
          qualityReason: 'Multimodal extraction output could not be verified against the clinical schema.',
          extractionMethod: 'gemini_multimodal',
          extractedMetadata: { filename, extractor: 'GeminiMultimodalExtractor:ParseFailed' }
        };
      }

      const result = validation.data;

      // Check if document was classified as non-medical or has 0 clinical facts
      const hasFacts =
        result.extractedValues.length > 0 ||
        result.documentedDiagnoses.length > 0 ||
        result.documentedMedications.length > 0;

      if (!result.isMedicalDocument || !hasFacts) {
        return {
          rawText: '',
          confidence: 0,
          mimeType,
          isReadable: false,
          hasClinicalContent: false,
          quality: ExtractionQuality.NON_MEDICAL_CONTENT,
          qualityReason: result.unreadableReason || 'The uploaded document does not contain recognized medical or clinical diagnostic information.',
          extractionMethod: 'gemini_multimodal',
          extractedMetadata: {
            filename,
            extractor: 'GeminiMultimodalExtractor',
            quality: ExtractionQuality.NON_MEDICAL_CONTENT
          }
        };
      }

      // Format clean clinical text representation for OCR storage and Stage 2 analysis
      const lines: string[] = [];
      if (result.facility) lines.push(`FACILITY: ${result.facility}`);
      if (result.patientName) lines.push(`PATIENT: ${result.patientName}`);
      if (result.reportDate) lines.push(`REPORT DATE: ${result.reportDate}`);
      lines.push('');

      if (result.clinicalTextSummary && result.clinicalTextSummary.trim().length > 30) {
        lines.push(result.clinicalTextSummary.trim());
      } else {
        if (result.extractedValues.length > 0) {
          lines.push('LABORATORY AND CLINICAL VALUES:');
          for (const v of result.extractedValues) {
            const flagStr = v.flag ? ` [${v.flag}]` : v.isAbnormal ? ' [ABNORMAL]' : '';
            const refStr = v.referenceRange ? ` (Reference Range: ${v.referenceRange})` : '';
            lines.push(`• ${v.testName}: ${v.value} ${v.unit || ''}${refStr}${flagStr}`);
          }
          lines.push('');
        }

        if (result.documentedDiagnoses.length > 0) {
          lines.push('DOCUMENTED DIAGNOSES / IMPRESSION:');
          for (const d of result.documentedDiagnoses) {
            lines.push(`• ${d}`);
          }
          lines.push('');
        }

        if (result.documentedMedications.length > 0) {
          lines.push('DOCUMENTED MEDICATIONS / PRESCRIPTIONS:');
          for (const m of result.documentedMedications) {
            lines.push(`• ${m.name} ${m.dosage || ''} - ${m.frequency || ''} ${m.instructions || ''}`);
          }
        }
      }

      const rawClinicalText = lines.join('\n').trim();

      return {
        rawText: rawClinicalText,
        confidence: 0.92,
        mimeType,
        pageCount: 1,
        isReadable: true,
        hasClinicalContent: true,
        quality: ExtractionQuality.USABLE_CLINICAL,
        extractionMethod: 'gemini_multimodal',
        extractedMetadata: {
          filename,
          extractor: 'GeminiMultimodalExtractor',
          extractedValuesCount: result.extractedValues.length,
          diagnosesCount: result.documentedDiagnoses.length,
          medicationsCount: result.documentedMedications.length,
          patientName: result.patientName,
          reportDate: result.reportDate,
          facility: result.facility
        }
      };
    } catch (error) {
      return {
        rawText: '',
        confidence: 0,
        mimeType,
        isReadable: false,
        hasClinicalContent: false,
        quality: ExtractionQuality.UNREADABLE_RAW_STREAM,
        qualityReason: error instanceof Error ? error.message : 'Multimodal extraction encountered an unexpected processing error.',
        extractionMethod: 'gemini_multimodal',
        extractedMetadata: { filename, extractor: 'GeminiMultimodalExtractor:Error' }
      };
    }
  }
}

export class DeterministicMockExtractor implements IDocumentExtractor {
  public async extractText(fileBuffer: Buffer, mimeType: string, filename: string): Promise<IExtractedDocument> {
    const isImage = mimeType.startsWith('image/') || /\.(?:png|jpe?g|webp|tiff|bmp)$/i.test(filename);
    const rawContent = fileBuffer.toString('utf-8');
    const lowerFilename = filename.toLowerCase();

    // Check for simulated non-medical or unreadable files
    const hasMedicalKeywords =
      /prescription|blood|cbc|hemoglobin|rbc|wbc|platelet|dengue|lipid|cardio|ecg|heart|cholesterol|lab|report|rx|doctor|hospital|test/i.test(lowerFilename) ||
      /blood|dengue|cholesterol|prescription/i.test(rawContent);

    const isSimulatedNonMedical =
      !hasMedicalKeywords &&
      (/non_medical|car|vehicle|selfie|invoice|nature|random|scenery|vacation/i.test(lowerFilename) ||
        /non_medical|scenery|vehicle/i.test(rawContent));
    const isSimulatedBlank = /blank|corrupt|empty/i.test(lowerFilename) || rawContent.length < 5;

    if (isSimulatedBlank) {
      return {
        rawText: '',
        confidence: 0,
        mimeType,
        isReadable: false,
        hasClinicalContent: false,
        quality: ExtractionQuality.EMPTY_TEXT,
        qualityReason: 'The document contains no readable text or data.',
        extractionMethod: isImage ? 'gemini_multimodal' : 'pdf_text',
        extractedMetadata: { filename, extractor: 'DeterministicMockExtractor' }
      };
    }

    if (isSimulatedNonMedical) {
      return {
        rawText: '',
        confidence: 0,
        mimeType,
        isReadable: false,
        hasClinicalContent: false,
        quality: ExtractionQuality.NON_MEDICAL_CONTENT,
        qualityReason: 'The document text does not contain recognized medical or clinical diagnostic information.',
        extractionMethod: isImage ? 'gemini_multimodal' : 'pdf_text',
        extractedMetadata: { filename, extractor: 'DeterministicMockExtractor' }
      };
    }

    // If PDF and contains plain clinical text
    const assessment = assessDocumentContent(rawContent, mimeType, filename, rawContent);
    const extractionMethod = isImage || /scan/i.test(lowerFilename) ? 'gemini_multimodal' : 'pdf_text';

    if (assessment.isReadable && assessment.hasClinicalContent && !isImage) {
      return {
        rawText: assessment.cleanedText,
        confidence: 0.95,
        mimeType,
        pageCount: 1,
        isReadable: true,
        hasClinicalContent: true,
        quality: ExtractionQuality.USABLE_CLINICAL,
        extractionMethod: 'pdf_text',
        extractedMetadata: { filename, extractor: 'DeterministicMockExtractor:PDF' }
      };
    }

    // Simulated multimodal extraction for medical images & scanned PDFs
    const hasBloodKeywords = /blood|cbc|hemoglobin|rbc|wbc|platelet|dengue|lipid/i.test(lowerFilename) || /blood|dengue/i.test(rawContent);
    const hasCardioKeywords = /cardio|ecg|heart|cholesterol/i.test(lowerFilename) || /cardio/i.test(rawContent);
    const hasPrescriptionKeywords = /prescription|rx|tablet|medication/i.test(lowerFilename) || /prescription/i.test(rawContent);

    let simulatedText = '';

    if (hasBloodKeywords || /dengue/i.test(lowerFilename)) {
      simulatedText = `
        PATIENT REPORT: Complete Blood Count & Dengue Serology
        Hemoglobin: 12.6 g/dL (Reference Range: 13.0 - 17.0 g/dL) [LOW]
        RBC Count: 4.62 million/mcL (Reference Range: 4.5 - 5.5 million/mcL) [NORMAL]
        Total Leukocyte Count: 3,600 cells/mcL (Reference Range: 4,000 - 11,000 cells/mcL) [LOW]
        Platelet Count: 92,000 cells/mcL (Reference Range: 150,000 - 450,000 cells/mcL) [LOW]
        Dengue NS1 Antigen: POSITIVE [REACTIVE]
        Documented Diagnosis: Acute Dengue Viral Illness
        Documented Recommendations: Fluid intake, platelet monitoring.
      `.trim();
    } else if (hasCardioKeywords) {
      simulatedText = `
        CARDIOLOGY DIAGNOSTIC REPORT: Lipid Profile
        Total Cholesterol: 240 mg/dL (Reference Range: < 200 mg/dL) [HIGH]
        LDL Cholesterol: 160 mg/dL (Reference Range: < 100 mg/dL) [HIGH]
        HDL Cholesterol: 45 mg/dL (Reference Range: > 40 mg/dL) [NORMAL]
        Triglycerides: 180 mg/dL (Reference Range: < 150 mg/dL) [HIGH]
        Documented Diagnosis: Hyperlipidemia
        Documented Medication: Atorvastatin 10mg once daily at bedtime
      `.trim();
    } else if (hasPrescriptionKeywords) {
      simulatedText = `
        MEDICAL PRESCRIPTION
        Rx:
        1. Amoxicillin 500mg - 1 capsule three times daily for 7 days
        2. Paracetamol 650mg - 1 tablet SOS for fever
        Documented Diagnosis: Acute upper respiratory tract infection
        Advised: Warm saline gargles, plenty of oral fluids.
      `.trim();
    } else {
      simulatedText = `
        DIAGNOSTIC CLINICAL LAB REPORT
        Fasting Blood Sugar: 95 mg/dL (Reference Range: 70 - 99 mg/dL) [NORMAL]
        Serum Creatinine: 0.9 mg/dL (Reference Range: 0.6 - 1.2 mg/dL) [NORMAL]
        Documented Impression: Normal routine metabolic parameters.
      `.trim();
    }

    return {
      rawText: simulatedText,
      confidence: 0.92,
      mimeType,
      pageCount: 1,
      isReadable: true,
      hasClinicalContent: true,
      quality: ExtractionQuality.USABLE_CLINICAL,
      extractionMethod,
      extractedMetadata: {
        filename,
        extractor: `DeterministicMockExtractor:${extractionMethod}`,
        quality: ExtractionQuality.USABLE_CLINICAL
      }
    };
  }
}

export const createDocumentExtractor = (forceMock: boolean = false): IDocumentExtractor => {
  if (forceMock || process.env.NODE_ENV === 'test') {
    return new DeterministicMockExtractor();
  }
  return new StandardDocumentExtractor();
};

export const documentExtractor: IDocumentExtractor = createDocumentExtractor();
