/*
  Warnings:

  - A unique constraint covering the columns `[name,academicYear]` on the table `RootItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RootItem_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "RootItem_name_academicYear_key" ON "RootItem"("name", "academicYear");
