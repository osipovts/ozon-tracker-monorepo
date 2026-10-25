/*
  Warnings:

  - You are about to drop the column `browserVersion` on the `browser_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `platform` on the `browser_sessions` table. All the data in the column will be lost.
  - You are about to drop the column `percent` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `price_observations` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `price_observations` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `proxies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "browser_sessions" DROP COLUMN "browserVersion",
DROP COLUMN "platform";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "percent",
DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "price_observations" DROP COLUMN "createdAt",
DROP COLUMN "status";

-- AlterTable
ALTER TABLE "proxies" DROP COLUMN "createdAt";
