import { NextResponse } from 'next/server';
import { prisma } from './dataLayer';

/**
 * Helper to handle idempotency in API routes.
 * If the X-Idempotency-Key header is present, it checks if the action was already processed.
 * If so, it returns the previous response.
 * If not, it executes the handler and stores the result.
 */
export async function withIdempotency(
  req: Request,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const key = req.headers.get('X-Idempotency-Key');

  if (!key) {
    return handler();
  }

  try {
    // Check if key exists
    const existing = await (prisma as any).idempotencyKey.findUnique({
      where: { key }
    });

    if (existing) {
      console.log(`[Idempotency] key ${key} found, returning cached response.`);
      return NextResponse.json(existing.response || { success: true }, { status: 409 });
      // Status 409 (Conflict) or 200/201? Usually 200 or 409 depending on strategy.
      // But safeApiRequest in offline.ts handles 409 as success (already synced).
    }

    // Execute handler
    const response = await handler();

    // If successful (2xx), store the result
    if (response.ok) {
        try {
            const data = await response.clone().json();
            await (prisma as any).idempotencyKey.create({
                data: {
                    key,
                    response: data
                }
            });
        } catch (e) {
            console.error('[Idempotency] Failed to store key:', e);
            // Optionally store just the key without response if it's not JSON
            await (prisma as any).idempotencyKey.create({
                data: { key }
            });
        }
    }

    return response;
  } catch (error) {
    console.error('[Idempotency] Error:', error);
    return handler(); // Fallback to normal execution if idempotency logic fails
  }
}
