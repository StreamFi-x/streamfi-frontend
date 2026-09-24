import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTracing } from '@/lib/tracing/api-route-wrapper';
import { logger } from '@/lib/tracing/logger';
import { getCurrentTraceContext } from '@/lib/tracing/trace-context';
import { verifySession } from '@/lib/auth/verify-session';
import { buildTipTransaction, submitTransaction, getCurrentNetwork } from '@/lib/stellar/payments';
import { sql } from '@vercel/postgres';
import { addTraceComment, logDbQuery } from '@/lib/tracing/db-tracer';

const bodySchema = z.object({
  destinationPublicKey: z.string(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  memo: z.string().optional(),
});

const handler = async (req: NextRequest): Promise<NextResponse> => {
  if (req.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const traceContext = getCurrentTraceContext();
  const traceId = traceContext?.traceId;

  try {
    logger.info('Tip send request received', {
      endpoint: 'POST /api/tips/send',
    });

    // 1. Verify session (auth check)
    const session = await verifySession(req);
    if (!session.ok) {
      logger.warn('Session verification failed', {
        endpoint: 'POST /api/tips/send',
      });
      return session.response;
    }

    logger.info('Session verified', {
      userId: session.userId,
      wallet: session.wallet,
    });

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400, headers: { 'x-request-id': traceId || '' } }
      );
    }

    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      logger.warn('Request validation failed', {
        errors: validation.error.issues.map(i => i.path.join('.')),
      });
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400, headers: { 'x-request-id': traceId || '' } }
      );
    }

    const { destinationPublicKey, amount, memo } = validation.data;

    logger.info('Request validated', {
      destinationPublicKey: destinationPublicKey.substring(0, 8),
      amount,
    });

    // 3. Query database to get sender's Stellar public key
    logger.debug('Querying database for user wallet', {
      userId: session.userId,
    });

    let dbError: Error | null = null;
    const query = addTraceComment(
      `SELECT stellar_public_key FROM users WHERE id = $1`
    );

    let senderPublicKey: string;
    try {
      const { rows } = await sql`SELECT stellar_public_key FROM users WHERE id = ${session.userId}`;
      logDbQuery('SELECT user wallet', query);

      if (rows.length === 0 || !rows[0].stellar_public_key) {
        logger.warn('User wallet not found', {
          userId: session.userId,
        });
        return NextResponse.json(
          { error: 'User wallet not configured' },
          { status: 400, headers: { 'x-request-id': traceId || '' } }
        );
      }

      senderPublicKey = rows[0].stellar_public_key;
      logger.debug('User wallet retrieved from database', {
        senderPublicKey: senderPublicKey.substring(0, 8),
      });
    } catch (error) {
      dbError = error instanceof Error ? error : new Error(String(error));
      logDbQuery('SELECT user wallet', query, dbError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500, headers: { 'x-request-id': traceId || '' } }
      );
    }

    // 4. Build Stellar transaction (calls Horizon API)
    logger.info('Building Stellar transaction', {
      operation: 'buildTipTransaction',
      senderKey: senderPublicKey.substring(0, 8),
      destinationKey: destinationPublicKey.substring(0, 8),
    });

    let transaction;
    try {
      transaction = await buildTipTransaction({
        sourcePublicKey: senderPublicKey,
        destinationPublicKey,
        amount,
        network: getCurrentNetwork(),
        memo,
      });
      logger.info('Stellar transaction built successfully', {
        txHash: transaction.hash().toString('hex').substring(0, 16),
      });
    } catch (error) {
      logger.error('Failed to build Stellar transaction', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Failed to build transaction' },
        { status: 500, headers: { 'x-request-id': traceId || '' } }
      );
    }

    // 5. Record tip in database before submitting (for audit trail)
    try {
      const insertQuery = addTraceComment(
        `INSERT INTO tips (user_id, destination_wallet, amount, status, created_at) VALUES ($1, $2, $3, 'pending', NOW())`
      );

      await sql`INSERT INTO tips (user_id, destination_wallet, amount, status, created_at) VALUES (${session.userId}, ${destinationPublicKey}, ${amount}, 'pending', NOW())`;
      logDbQuery('INSERT tip record', insertQuery);

      logger.info('Tip recorded in database', {
        userId: session.userId,
        status: 'pending',
      });
    } catch (error) {
      dbError = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to record tip in database', {
        errorMessage: dbError.message,
      });
      // Non-critical — proceed with submission
    }

    // 6. Submit transaction to Stellar (Horizon API)
    logger.info('Submitting transaction to Stellar', {
      txHash: transaction.hash().toString('hex').substring(0, 16),
    });

    let result;
    try {
      result = await submitTransaction(transaction, getCurrentNetwork());
      if (!result.success) {
        logger.error('Stellar transaction submission returned error', {
          errorMessage: result.error,
          resultCode: result.resultCode,
        });
        return NextResponse.json(
          { error: result.error || 'Transaction failed' },
          { status: 400, headers: { 'x-request-id': traceId || '' } }
        );
      }

      logger.info('Transaction submitted to Stellar successfully', {
        hash: result.hash,
        ledger: result.ledger,
      });
    } catch (error) {
      logger.error('Failed to submit transaction to Stellar', {
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Failed to submit transaction' },
        { status: 500, headers: { 'x-request-id': traceId || '' } }
      );
    }

    // 7. Update tip record with confirmed transaction hash
    try {
      const updateQuery = addTraceComment(
        `UPDATE tips SET status = 'confirmed', tx_hash = $1 WHERE user_id = $2 AND destination_wallet = $3 AND status = 'pending'`
      );

      await sql`UPDATE tips SET status = 'confirmed', tx_hash = ${result.hash}, ledger = ${result.ledger} WHERE user_id = ${session.userId} AND destination_wallet = ${destinationPublicKey} AND status = 'pending'`;
      logDbQuery('UPDATE tip status', updateQuery);

      logger.info('Tip status updated to confirmed', {
        txHash: result.hash,
      });
    } catch (error) {
      dbError = error instanceof Error ? error : new Error(String(error));
      logger.warn('Failed to update tip status in database', {
        errorMessage: dbError.message,
      });
      // Non-critical
    }

    logger.info('Tip send completed successfully', {
      transactionHash: result.hash,
      ledger: result.ledger,
    });

    const response = NextResponse.json(
      {
        success: true,
        transactionHash: result.hash,
        ledger: result.ledger,
        requestId: traceId,
      },
      { status: 200 }
    );

    response.headers.set('x-request-id', traceId || '');
    return response;
  } catch (error) {
    logger.error('Unhandled error in tip send endpoint', {
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    const errorResponse = NextResponse.json(
      { error: 'Internal server error', requestId: traceId },
      { status: 500 }
    );
    errorResponse.headers.set('x-request-id', traceId || '');
    return errorResponse;
  }
};

export const POST = withTracing(handler);
