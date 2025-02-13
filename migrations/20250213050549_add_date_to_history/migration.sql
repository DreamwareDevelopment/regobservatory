/*
  Warnings:

  - Added the required column `date` to the `agency_history` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "agency_history" ADD COLUMN     "date" TIMESTAMP(3) NOT NULL;
