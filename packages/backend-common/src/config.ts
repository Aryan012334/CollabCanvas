if (!process.env.JWT_SECRET) {
  console.warn(
    "⚠️  WARNING: JWT_SECRET is not set in environment variables. " +
    "Using insecure default. Set JWT_SECRET in your .env file before deploying."
  );
}

export const JWT_SECRET = process.env.JWT_SECRET || "123";
