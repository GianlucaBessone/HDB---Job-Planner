/**
 * AI Module — Public re-exports.
 * 
 * This is the single import point for all business routes:
 *   import { generateObject, analyzeImage, performOCR } from '@/lib/ai';
 */

export { generateObject, analyzeImage, performOCR } from './service';
export type { AiRequestOptions, AiServiceResponse, TokenUsage } from './types';
