-- CreateTable
CREATE TABLE "application_state" (
    "id" TEXT NOT NULL,
    "next_processing_date" TEXT,
    "run_until" TEXT,
    "is_caught_up" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "application_state_pkey" PRIMARY KEY ("id")
);
