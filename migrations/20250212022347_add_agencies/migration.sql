-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "display_name" TEXT NOT NULL,
    "sortable_name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cfr_references" JSONB[],
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
