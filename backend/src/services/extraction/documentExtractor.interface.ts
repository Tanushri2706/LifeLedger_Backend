import { IExtractedDocument } from '../../types';

export interface IDocumentExtractor {
  extractText(fileBuffer: Buffer, mimeType: string, filename: string): Promise<IExtractedDocument>;
}
