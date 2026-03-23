'use client';

import { useState, useCallback, useRef } from 'react';
import { generateIdempotencyKey, idempotencyTracker } from '@/lib/idempotency';

/**
 * Submission state machine:
 *   idle → pending → confirmed | failed
 *   failed → pending (retry with same key)
 */
export type SubmitState = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface SubmitResult<T> {
  data?: T;
  error?: string;
}

interface UseIdempotentSubmitReturn<T> {
  /** Current submission state */
  state: SubmitState;
  /** Submit an action with idempotency protection */
  submit: (action: (key: string) => Promise<T>) => Promise<SubmitResult<T>>;
  /** Reset to idle (after user dismisses success/error) */
  reset: () => void;
  /** The last successful result */
  lastResult: T | null;
  /** The last error message */
  lastError: string | null;
}

/**
 * Hook: Idempotent submit guard.
 *
 * Generates a fresh idempotency key per user intent. If the user
 * clicks Submit again while pending, the click is ignored. If the
 * request fails, the same key is reused on retry so the backend
 * returns the cached result if it actually succeeded.
 *
 * Usage:
 *   const { state, submit, reset } = useIdempotentSubmit();
 *   const handleClick = () => submit((key) => tradingApi.placeOrder(dto, key));
 */
export function useIdempotentSubmit<T = any>(): UseIdempotentSubmitReturn<T> {
  const [state, setState] = useState<SubmitState>('idle');
  const [lastResult, setLastResult] = useState<T | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const currentKeyRef = useRef<string | null>(null);

  const submit = useCallback(async (action: (key: string) => Promise<T>): Promise<SubmitResult<T>> => {
    // Generate new key if idle, reuse if retrying from failed
    let key = currentKeyRef.current;
    if (state === 'idle' || !key) {
      key = generateIdempotencyKey();
      currentKeyRef.current = key;
    }

    // Check tracker — block if already in flight
    const check = idempotencyTracker.acquire(key);
    if (!check.allowed) {
      if (check.cached) {
        // Already completed — return cached
        setLastResult(check.cached);
        setState('confirmed');
        return { data: check.cached };
      }
      // In flight — ignore click
      return { error: 'Request already in progress' };
    }

    setState('pending');
    setLastError(null);

    try {
      const result = await action(key);
      idempotencyTracker.complete(key, result);
      setLastResult(result);
      setState('confirmed');
      return { data: result };
    } catch (err) {
      idempotencyTracker.release(key);
      const message = err instanceof Error ? err.message : 'Request failed';
      setLastError(message);
      setState('failed');
      // Keep the key for retry — don't generate a new one
      return { error: message };
    }
  }, [state]);

  const reset = useCallback(() => {
    setState('idle');
    setLastResult(null);
    setLastError(null);
    currentKeyRef.current = null;
  }, []);

  return { state, submit, reset, lastResult, lastError };
}
