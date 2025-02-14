-- CreateTable
CREATE TABLE "agency_contents" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "content" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_embeddings" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agency_contents_agencyId_key" ON "agency_contents"("agencyId");

-- CreateIndex
CREATE INDEX ON "agency_embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "agency_contents" ADD CONSTRAINT "agency_contents_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_embeddings" ADD CONSTRAINT "agency_embeddings_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
