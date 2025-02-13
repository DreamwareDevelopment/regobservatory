/*
  Warnings:

  - You are about to drop the `sample` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "sample";

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "title" INTEGER NOT NULL,
    "part" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "content" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "section_embeddings" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_sections" (
    "sectionId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,

    CONSTRAINT "agency_sections_pkey" PRIMARY KEY ("agencyId","sectionId")
);

-- CreateTable
CREATE TABLE "agency_history" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "section_embeddings" ADD CONSTRAINT "section_embeddings_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_sections" ADD CONSTRAINT "agency_sections_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_sections" ADD CONSTRAINT "agency_sections_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_history" ADD CONSTRAINT "agency_history_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
