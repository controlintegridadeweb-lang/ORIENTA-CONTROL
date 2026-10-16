import "server-only";

import writeXlsxFile from "write-excel-file/node";
import { businessToday } from "@/shared/datetime/business-date";
import type { RespondentEvidenceItem } from "./respondent-contracts";
import {
  buildRespondentEvidenceXlsxSheets,
  respondentEvidenceExcelAutoFilterFeature,
} from "./respondent-export-xlsx-sheets";

type NodeFileContent = Buffer | import("node:stream").Stream | import("node:buffer").Blob;

export async function buildRespondentEvidencesXlsx(
  items: readonly RespondentEvidenceItem[],
): Promise<{ filename: string; content: Buffer }> {
  const sheets = buildRespondentEvidenceXlsxSheets<NodeFileContent>(items);
  const file = await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
    features: [respondentEvidenceExcelAutoFilterFeature<NodeFileContent>(items.length)],
  }).toBuffer();

  return {
    filename: `evidencias-${businessToday()}.xlsx`,
    content: Buffer.from(file),
  };
}
