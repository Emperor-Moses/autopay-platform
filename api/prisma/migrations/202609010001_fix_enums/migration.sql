-- Fix enum values required by the application.
-- PostgreSQL allows enum values to be added without rewriting existing rows.
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'success';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'free';
