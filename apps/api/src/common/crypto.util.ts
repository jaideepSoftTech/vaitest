import { createHash, randomBytes } from "crypto";

/**
 * Compute SHA256 hash of a string and return as hex.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate a cryptographically secure random token (32 bytes, base64url-encoded).
 */
export function generateRandomToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Sleep utility with jitter for timing-attack padding.
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Add random jitter (0-50ms) to a base latency for timing-attack resistance.
 */
export function jitter(): number {
  return Math.random() * 50;
}
