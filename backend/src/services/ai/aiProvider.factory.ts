import { config } from '../../config';
import { IAIHealthProvider } from './aiProvider.interface';
import { GeminiHealthProvider } from './geminiHealthProvider';
import { MockHealthProvider } from './mockHealthProvider';
import { AppError } from '../../utils';

export const createAIHealthProvider = (forceMock: boolean = false): IAIHealthProvider => {
  if (forceMock || config.aiProvider === 'mock') {
    return new MockHealthProvider();
  }

  if (config.aiProvider === 'gemini') {
    if (!config.geminiApiKey) {
      throw new AppError('GEMINI_API_KEY is required to initialize the Gemini AI Health Provider', 500);
    }
    return new GeminiHealthProvider(config.geminiApiKey, config.aiModel);
  }

  return new MockHealthProvider();
};

export const aiHealthProvider: IAIHealthProvider = createAIHealthProvider();

