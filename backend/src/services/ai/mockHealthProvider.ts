import {
  IExtractedDocument,
  IReportMetadata,
  IStructuredReportAnalysis,
  MANDATORY_MEDICAL_DISCLAIMER,
  StructuredReportAnalysisZodSchema
} from '../../types';
import { IAIHealthProvider } from './aiProvider.interface';
import { AppError } from '../../utils';

export interface MockProviderOptions {
  simulateFailure?: boolean;
  simulateMalformedOutput?: boolean;
}

export class MockHealthProvider implements IAIHealthProvider {
  public readonly providerName = 'mock';
  public readonly modelName = 'deterministic-mock-v1';
  private options: MockProviderOptions;

  constructor(options: MockProviderOptions = {}) {
    this.options = options;
  }

  public setOptions(options: MockProviderOptions): void {
    this.options = { ...this.options, ...options };
  }

  public async analyzeMedicalDocument(
    extraction: IExtractedDocument,
    metadata: IReportMetadata
  ): Promise<IStructuredReportAnalysis> {
    const startTime = Date.now();

    if (this.options.simulateFailure) {
      throw new AppError('Simulated AI provider connection failure', 502);
    }

    if (this.options.simulateMalformedOutput) {
      // Return invalid structured object to trigger schema rejection
      const malformedPayload = {
        sourceFacts: { extractedValues: 'invalid_type_here' },
        aiInsights: { summary: null }
      };
      const validation = StructuredReportAnalysisZodSchema.safeParse(malformedPayload);
      if (!validation.success) {
        throw new AppError('AI provider returned malformed structured response', 502, {
          validationErrors: validation.error.flatten()
        });
      }
    }

    const text = extraction.rawText.toLowerCase();
    const isBloodReport = text.includes('blood') || text.includes('cbc') || text.includes('hemoglobin') || metadata.category === 'blood_report';
    const isCardio = text.includes('cholesterol') || text.includes('lipid') || text.includes('ecg') || text.includes('cardio');
    const isPrescription = text.includes('prescription') || text.includes('amoxicillin') || metadata.category === 'prescription';

    let result: Omit<IStructuredReportAnalysis, 'metadata'>;

    if (isBloodReport) {
      result = {
        sourceFacts: {
          extractedValues: [
            {
              testName: 'Hemoglobin',
              value: '10.2',
              unit: 'g/dL',
              referenceRange: '13.0 - 17.0 g/dL',
              isAbnormal: true,
              flag: 'LOW',
              sourceContext: 'Hemoglobin: 10.2 g/dL (Reference Range: 13.0 - 17.0 g/dL) [LOW]'
            },
            {
              testName: 'RBC Count',
              value: '4.1',
              unit: 'million/mcL',
              referenceRange: '4.5 - 5.9 million/mcL',
              isAbnormal: true,
              flag: 'LOW',
              sourceContext: 'RBC Count: 4.1 million/mcL [LOW]'
            },
            {
              testName: 'WBC Count',
              value: '7500',
              unit: 'cells/mcL',
              referenceRange: '4,500 - 11,000 cells/mcL',
              isAbnormal: false,
              flag: 'NORMAL',
              sourceContext: 'WBC Count: 7,500 cells/mcL'
            },
            {
              testName: 'Platelet Count',
              value: '250000',
              unit: '/mcL',
              referenceRange: '150,000 - 450,000 /mcL',
              isAbnormal: false,
              flag: 'NORMAL',
              sourceContext: 'Platelet Count: 250,000 /mcL'
            }
          ],
          documentedDiagnoses: ['Mild microcytic hypochromic anemia (documented by laboratory)'],
          documentedMedications: []
        },
        aiInsights: {
          summary:
            'Your Complete Blood Count shows hemoglobin and red blood cell counts slightly below normal reference ranges, while white blood cells and platelets remain healthy and balanced.',
          keyFindings: [
            'Hemoglobin (10.2 g/dL) is lower than the typical reference range (13.0 - 17.0 g/dL).',
            'Red Blood Cell count (4.1 million/mcL) is slightly decreased.',
            'White Blood Cell and Platelet counts are normal.'
          ],
          potentialConcerns: [
            {
              concern: 'Lower hemoglobin level',
              possibleRelevance:
                'May be associated with mild iron or nutritional deficiency, which could contribute to feelings of fatigue.',
              severity: 'moderate',
              sourceRef: 'Hemoglobin 10.2 g/dL'
            }
          ],
          riskAssessment: {
            level: 'low',
            explanation:
              'Overall vital markers are stable with mild anemia indicators that can typically be managed through dietary adjustments or doctor-recommended supplementation.'
          },
          lifestyleGuidance: {
            dietSuggestions: [
              'Consider iron-rich foods such as spinach, lentils, beans, fortified cereals, and lean poultry.',
              'Pair iron sources with Vitamin C rich foods (oranges, bell peppers) to assist natural absorption.'
            ],
            exerciseSuggestions: ['Engage in moderate-paced walking or light aerobic exercise as energy levels permit.'],
            generalTips: ['Stay adequately hydrated and maintain regular sleep patterns.']
          },
          questionsForDoctor: [
            'Would you recommend checking serum ferritin or iron studies?',
            'Should I consider an oral iron supplement or dietary changes?'
          ],
          emergencySignals: {
            isEmergency: false,
            warningDetails: undefined,
            emergencyAdvice: undefined
          }
        },
        healthScoreImpact: {
          calculatedScore: 78,
          justification: 'Slight reduction due to out-of-range hemoglobin and RBC levels.'
        },
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER
      };
    } else if (isCardio) {
      result = {
        sourceFacts: {
          extractedValues: [
            {
              testName: 'Total Cholesterol',
              value: '240',
              unit: 'mg/dL',
              referenceRange: '< 200 mg/dL',
              isAbnormal: true,
              flag: 'HIGH',
              sourceContext: 'Total Cholesterol: 240 mg/dL [HIGH]'
            },
            {
              testName: 'LDL Cholesterol',
              value: '160',
              unit: 'mg/dL',
              referenceRange: '< 100 mg/dL',
              isAbnormal: true,
              flag: 'HIGH',
              sourceContext: 'LDL Cholesterol: 160 mg/dL [HIGH]'
            },
            {
              testName: 'HDL Cholesterol',
              value: '45',
              unit: 'mg/dL',
              referenceRange: '> 40 mg/dL',
              isAbnormal: false,
              flag: 'NORMAL',
              sourceContext: 'HDL Cholesterol: 45 mg/dL'
            }
          ],
          documentedDiagnoses: ['Hyperlipidemia (documented in source report)'],
          documentedMedications: [
            {
              name: 'Atorvastatin',
              dosage: '10mg',
              frequency: 'Once daily',
              instructions: 'Take at bedtime'
            }
          ]
        },
        aiInsights: {
          summary:
            'The lipid profile indicates elevated total cholesterol and LDL cholesterol, with protective HDL within normal bounds.',
          keyFindings: [
            'Total Cholesterol (240 mg/dL) and LDL (160 mg/dL) exceed standard reference thresholds.',
            'HDL (good cholesterol) is in the normal range.'
          ],
          potentialConcerns: [
            {
              concern: 'Elevated circulating lipid markers',
              possibleRelevance: 'Over time, elevated LDL may be associated with increased cardiovascular workload.',
              severity: 'moderate',
              sourceRef: 'LDL 160 mg/dL'
            }
          ],
          riskAssessment: {
            level: 'moderate',
            explanation: 'Lipid indicators suggest benefits from cardiovascular-supportive nutrition and routine monitoring.'
          },
          lifestyleGuidance: {
            dietSuggestions: [
              'Increase dietary fiber from oats, flaxseeds, and legumes.',
              'Reduce saturated and trans fats found in deep-fried foods.'
            ],
            exerciseSuggestions: ['Aim for 30 minutes of brisk walking or moderate cardio 5 days a week.'],
            generalTips: ['Monitor blood pressure and schedule periodic lipid panels.']
          },
          questionsForDoctor: [
            'What is my recommended target LDL level based on my overall health?',
            'How often should I repeat this lipid panel to track progress?'
          ],
          emergencySignals: {
            isEmergency: false
          }
        },
        healthScoreImpact: {
          calculatedScore: 72,
          justification: 'Elevated total and LDL cholesterol.'
        },
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER
      };
    } else if (isPrescription) {
      result = {
        sourceFacts: {
          extractedValues: [],
          documentedDiagnoses: ['Acute upper respiratory tract infection (documented in Rx)'],
          documentedMedications: [
            {
              name: 'Amoxicillin',
              dosage: '500mg',
              frequency: '3 times daily',
              instructions: 'Take for 7 days with food'
            },
            {
              name: 'Paracetamol',
              dosage: '650mg',
              frequency: 'As needed (SOS)',
              instructions: 'For fever/discomfort'
            }
          ]
        },
        aiInsights: {
          summary:
            'This prescription outlines an antibiotic course and supportive fever management for a respiratory infection.',
          keyFindings: [
            'Prescribed antibiotic (Amoxicillin 500mg) for 7 days.',
            'Prescribed fever relief (Paracetamol 650mg) on an as-needed basis.'
          ],
          potentialConcerns: [
            {
              concern: 'Antibiotic adherence',
              possibleRelevance: 'Completing the full 7-day course is essential to prevent bacterial recurrence.',
              severity: 'low'
            }
          ],
          riskAssessment: {
            level: 'low',
            explanation: 'Standard acute prescription regimen.'
          },
          lifestyleGuidance: {
            dietSuggestions: ['Warm soups, herbal teas, and plenty of fluids.'],
            exerciseSuggestions: ['Rest and prioritize physical recovery.'],
            generalTips: ['Warm saline gargles and humidified air.']
          },
          questionsForDoctor: [
            'Should I follow up if symptoms do not improve after 3-4 days?',
            'Are there any specific food or supplement interactions I should avoid?'
          ],
          emergencySignals: {
            isEmergency: false
          }
        },
        healthScoreImpact: {
          calculatedScore: 82,
          justification: 'Active acute prescription regimen.'
        },
        disclaimer: MANDATORY_MEDICAL_DISCLAIMER
      };
    } else {
      const isClinical = extraction.hasClinicalContent || /patient|doctor|hospital|clinic|medical|health|diagnosis|report|test/i.test(text);
      if (!isClinical) {
        result = {
          sourceFacts: {
            extractedValues: [],
            documentedDiagnoses: [],
            documentedMedications: []
          },
          aiInsights: {
            summary: 'The document appears to contain raw PDF stream/metadata rather than readable medical data. No clinical data could be extracted.',
            keyFindings: ['No readable medical data extracted.'],
            potentialConcerns: [],
            riskAssessment: {
              level: 'low',
              explanation: 'Unable to evaluate risk because no clinical data was extracted.'
            },
            lifestyleGuidance: {
              dietSuggestions: [],
              exerciseSuggestions: [],
              generalTips: []
            },
            questionsForDoctor: [],
            emergencySignals: {
              isEmergency: false
            }
          },
          healthScoreImpact: {
            calculatedScore: undefined,
            justification: undefined
          },
          disclaimer: MANDATORY_MEDICAL_DISCLAIMER
        };
      } else {
        result = {
          sourceFacts: {
            extractedValues: [],
            documentedDiagnoses: [],
            documentedMedications: []
          },
          aiInsights: {
            summary: `Medical report for "${metadata.title}" cataloged and structured.`,
            keyFindings: ['General medical document indexed in your Health Vault.'],
            potentialConcerns: [],
            riskAssessment: {
              level: 'low',
              explanation: 'No critical acute flags identified in the document summary.'
            },
            lifestyleGuidance: {
              dietSuggestions: ['Maintain a balanced, nutritious diet.'],
              exerciseSuggestions: ['Continue regular physical activity.'],
              generalTips: ['Keep routine preventive checkups with your doctor.']
            },
            questionsForDoctor: ['Review these findings during your next routine health consultation.'],
            emergencySignals: {
              isEmergency: false
            }
          },
          healthScoreImpact: {
            calculatedScore: 85,
            justification: 'Standard evaluation with normal parameters.'
          },
          disclaimer: MANDATORY_MEDICAL_DISCLAIMER
        };
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      ...result,
      metadata: {
        provider: this.providerName,
        model: this.modelName,
        analyzedAt: new Date(),
        durationMs
      }
    };
  }
}
