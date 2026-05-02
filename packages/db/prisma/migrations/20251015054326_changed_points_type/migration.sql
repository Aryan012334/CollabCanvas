/*
  Warnings:

  - The `points` column on the `Shape` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Shape" DROP COLUMN "points",
ADD COLUMN     "points" JSONB;
