import { z } from "zod";

export const syncFormAssignmentsSchema = z.object({
  organizationIds: z.array(z.string().uuid()),
});
