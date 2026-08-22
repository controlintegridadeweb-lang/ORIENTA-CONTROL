import { z } from "zod";

const expectedRevisionSchema = z.coerce.number().int().positive();
const titleSchema = z.string().trim().min(3).max(200);
const pendingUploadIdSchema = z.string().uuid();

export const actionPlanDocumentCreateBodySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("link"),
      expectedRevision: expectedRevisionSchema,
      title: titleSchema,
      externalLink: z.string().trim().min(1).max(2048),
    })
    .strict(),
  z
    .object({
      kind: z.literal("file"),
      expectedRevision: expectedRevisionSchema,
      title: titleSchema,
      filename: z.string().trim().min(1).max(255),
      mimeType: z.string().trim().max(255).nullable(),
      sizeBytes: z.coerce.number().int().positive().max(20 * 1024 * 1024),
    })
    .strict(),
]);

export const actionPlanDocumentConfirmBodySchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    pendingUploadId: pendingUploadIdSchema,
  })
  .strict();

export const actionPlanDocumentDiscardBodySchema = z
  .object({ pendingUploadId: pendingUploadIdSchema })
  .strict();

export const actionPlanDocumentDeactivateBodySchema = z
  .object({
    expectedRevision: expectedRevisionSchema,
    reason: z.string().trim().min(5).max(1000),
  })
  .strict();
