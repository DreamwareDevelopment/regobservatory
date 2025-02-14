/*
  Warnings:

  - Added the required column `date` to the `agency_embeddings` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "agency_embeddings_embedding_idx";

-- AlterTable
ALTER TABLE "agency_embeddings" ADD COLUMN     "date" TEXT NOT NULL;
