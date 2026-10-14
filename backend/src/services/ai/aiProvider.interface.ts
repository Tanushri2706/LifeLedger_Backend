import { IExtractedDocument, IReportMetadata, IStructuredReportAnalysis } from '../../types';

export interface IAIHealthProvider {
  readonly providerName: string;
  readonly modelName: string;
  analyzeMedicalDocument(
    extraction: IExtractedDocument,
    metadata: IReportMetadata
  ): Promise<IStructuredReportAnalysis>;
}
