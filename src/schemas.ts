import { z } from 'zod';

// YYYY-MM-DD, inclusive calendar days. Lexicographic compare == chronological.
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s + 'T00:00:00Z')), {
    message: 'invalid calendar date',
  });

export const roleSchema = z.enum(['director', 'lead', 'crew']);

export const missionStatusSchema = z.enum([
  'draft',
  'proposed',
  'approved',
  'active',
  'completed',
  'rejected',
  'cancelled',
]);

export const assignmentStatusSchema = z.enum([
  'proposed',
  'accepted',
  'declined',
]);

export const levelSchema = z.number().int().min(1).max(5);

export function assertDateRange(start: string, end: string): void {
  if (start > end) throw new Error(`invalid range: ${start} > ${end}`);
}
