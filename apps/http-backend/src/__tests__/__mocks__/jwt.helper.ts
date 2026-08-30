import jwt from "jsonwebtoken";

const TEST_SECRET = "123"; // matches packages/backend-common/config.ts fallback

/**
 * Generates a valid JWT for use in test Authorization headers.
 */
export function generateTestToken(
  userId: string = "user-123",
  name: string = "Test User"
): string {
  return jwt.sign({ userId, name }, TEST_SECRET);
}

/**
 * Returns the Authorization header string.
 */
export function authHeader(userId?: string, name?: string): string {
  return generateTestToken(userId, name);
}
