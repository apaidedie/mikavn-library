import type { AiConnectionTestResult, AiRecognitionResult } from '@/types/metadata';
import { readSettings } from './mockStoreStorage';

export function createMockStoreAi() {
  return {
    recognizeGameFromImage(imagePath: string): Promise<AiRecognitionResult> {
      return Promise.resolve({ title: '星之终途', rawText: `Mock recognition from ${imagePath}: 星之终途`, confidence: 0.6 });
    },

    testAiConnection(): Promise<AiConnectionTestResult> {
      const settings = readSettings();
      return Promise.resolve({
        ok: true,
        baseUrl: settings.ai_base_url || 'https://api.openai.com/v1',
        model: settings.ai_model || 'gpt-4o-mini',
        message: 'Browser preview mock AI connection is available',
      });
    },
  };
}
