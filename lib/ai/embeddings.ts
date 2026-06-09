import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK for embeddings
const apiKey = process.env.GEMINI_API_KEY || 'DUMMY_API_KEY_FOR_BUILD';
const gatewayUrl = process.env.VERCEL_AI_GATEWAY_URL;

const aiOptions: any = { apiKey };
if (gatewayUrl) {
    aiOptions.httpOptions = {
        baseUrl: `${gatewayUrl}/google-gemini`,
    };
}

const ai = new GoogleGenAI(aiOptions);

/**
 * Generates a vector embedding (768 or 1536 float values) for the given text
 */
export async function getEmbedding(text: string): Promise<number[]> {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    
    try {
        const response = await ai.models.embedContent({
            model: 'gemini-embedding-2',
            contents: text,
        }) as any;

        if (!response.embedding?.values) {
            throw new Error('No embedding values returned from Gemini API');
        }

        return response.embedding.values;
    } catch (error) {
        console.error('Error generating embedding in getEmbedding:', error);
        throw error;
    }
}

/**
 * Calculates the cosine similarity between two numeric vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
