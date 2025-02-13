/*
  Warnings:

  - You are about to drop the column `agencyId` on the `agency_contents` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `agency_contents` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `agency_contents` table. All the data in the column will be lost.
  - You are about to drop the column `agencyId` on the `agency_embeddings` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `agency_embeddings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `agency_embeddings` table. All the data in the column will be lost.
  - You are about to drop the column `agencyId` on the `agency_history` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `agency_history` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `agency_history` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[agency_id]` on the table `agency_contents` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `agency_id` to the `agency_contents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `agency_contents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `agency_id` to the `agency_embeddings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `agency_embeddings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `agency_id` to the `agency_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `agency_history` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "agency_contents" DROP CONSTRAINT "agency_contents_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "agency_embeddings" DROP CONSTRAINT "agency_embeddings_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "agency_history" DROP CONSTRAINT "agency_history_agencyId_fkey";

-- DropIndex
DROP INDEX "agency_contents_agencyId_key";

-- AlterTable
ALTER TABLE "agency_contents" DROP COLUMN "agencyId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "agency_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "agency_embeddings" DROP COLUMN "agencyId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "agency_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "agency_history" DROP COLUMN "agencyId",
DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "agency_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "agency_contents_agency_id_key" ON "agency_contents"("agency_id");

-- AddForeignKey
ALTER TABLE "agency_contents" ADD CONSTRAINT "agency_contents_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_embeddings" ADD CONSTRAINT "agency_embeddings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_history" ADD CONSTRAINT "agency_history_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
