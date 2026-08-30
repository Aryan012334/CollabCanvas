/**
 * Central mock for the Prisma client.
 * Every test file imports this instead of the real DB,
 * so tests never need a running database.
 */

export const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  room: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  shape: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
  $disconnect: jest.fn(),
};

// Patch the module so any import of @repo/db/client returns our mock
jest.mock("@repo/db/client", () => ({
  prismaClient: mockPrisma,
}));
