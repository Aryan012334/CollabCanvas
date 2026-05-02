import { PrismaClient, ShapeType } from "@prisma/client";

export const prismaClient = new PrismaClient();
export { ShapeType };