/*
  Warnings:

  - The `content` column on the `agency_contents` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `agency_sections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `section_embeddings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sections` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `identifier` to the `agency_embeddings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `agency_embeddings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `agency_embeddings` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "agency_sections" DROP CONSTRAINT "agency_sections_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "agency_sections" DROP CONSTRAINT "agency_sections_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "section_embeddings" DROP CONSTRAINT "section_embeddings_sectionId_fkey";

-- AlterTable
ALTER TABLE "agency_contents" DROP COLUMN "content",
ADD COLUMN     "content" JSONB[];

-- AlterTable
ALTER TABLE "agency_embeddings" ADD COLUMN     "identifier" TEXT NOT NULL,
ADD COLUMN     "title" INTEGER NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- DropTable
DROP TABLE "agency_sections";

-- DropTable
DROP TABLE "section_embeddings";

-- DropTable
DROP TABLE "sections";
