import { clsx, type ClassValue } from "clsx"
import { Logger } from "inngest/middleware/logger";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  logger?: Logger,
  maxAttempts: number = 20,
  backoffFactor: number = 1000
): Promise<T> {
  let attempts = 0;
  const retryTimeRegex = /try again in (\d+\.\d+)s/;

  while (attempts < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Rate limit') || error.message.includes('fetch failed') || error.message.includes('AI_RetryError'))) {
        attempts++;
        const retryTime = retryTimeRegex.exec(error.message)?.[1];
        const baseWaitTime = backoffFactor * Math.pow(2, attempts);
        const jitter = Math.random() * baseWaitTime;
        const waitTime = retryTime ? parseFloat(retryTime) * 1000 : baseWaitTime + jitter;
        (logger ?? console).warn(`Rate limited, reason: ${error.message}. Retrying in ${(waitTime / 1000).toFixed(2)} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retry attempts reached');
}
