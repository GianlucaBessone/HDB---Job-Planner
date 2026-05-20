import { NextResponse } from 'next/server';
import { prisma } from './prisma';

/**
 * Helper to handle idempotency in API routes.
 * Uses an atomic optimistic insert strategy to avoid race conditions.
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
    // Try to register the key immediately with status PROCESSING
    try {
      await (prisma as any).idempotencyKey.create({
        data: {
          key,
          response: { status: 'PROCESSING' }
        }
      });
    } catch (error: any) {
      // P2002 is Prisma's code for Unique Constraint Violation
      if (error?.code === 'P2002') {
        console.log(`[Idempotency] Key conflict detected for: ${key}. Fetching stored state.`);
        const existing = await (prisma as any).idempotencyKey.findUnique({
          where: { key }
        });

        if (existing?.response) {
          const resObj = existing.response as any;
          if (resObj.status === 'PROCESSING') {
            return NextResponse.json({ error: 'La petición ya se encuentra en proceso' }, { status: 409 });
          }
          // Return the cached response body and original status code
          return NextResponse.json(resObj.body || { success: true }, { status: resObj.statusCode || 200 });
        }
        return NextResponse.json({ error: 'Operación duplicada' }, { status: 409 });
      }
      throw error;
    }

    // Execute the handler
    const response = await handler();

    if (response.ok) {
      try {
        const data = await response.clone().json();
        await (prisma as any).idempotencyKey.update({
          where: { key },
          data: {
            response: {
              body: data,
              statusCode: response.status
            }
          }
        });
      } catch (e) {
        console.error('[Idempotency] Failed to store response body, saving default:', e);
        await (prisma as any).idempotencyKey.update({
          where: { key },
          data: {
            response: {
              body: { success: true },
              statusCode: response.status
            }
          }
        });
      }
    } else {
      // If the execution failed (non-2xx), release the key to allow retries
      try {
        await (prisma as any).idempotencyKey.delete({ where: { key } });
      } catch (delError) {
        console.error('[Idempotency] Failed to release key on failure:', delError);
      }
    }

    return response;
  } catch (error) {
    console.error('[Idempotency] Critical Error:', error);
    // Catastrophic error cleanup: release the lock to prevent permanent deadlock
    try {
      await (prisma as any).idempotencyKey.delete({ where: { key } });
    } catch {}
    return handler();
  }
}
