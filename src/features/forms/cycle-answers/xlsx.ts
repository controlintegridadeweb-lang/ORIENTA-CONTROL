import "server-only";

import writeXlsxFile from "write-excel-file/node";
import {
  buildCycleAnswersXlsxSheets,
  cycleAnswersExcelAutoFilterFeature,
  cycleAnswersFilename,
  type CycleAnswersSpreadsheet,
} from "./spreadsheet";

type NodeFileContent = Buffer | import("node:stream").Stream | import("node:buffer").Blob;

export async function buildCycleAnswersXlsx(
  data: CycleAnswersSpreadsheet,
): Promise<{ filename: string; content: Buffer }> {
  const sheets = buildCycleAnswersXlsxSheets<NodeFileContent>(data);
  const file = await writeXlsxFile(sheets, {
    fontFamily: "Arial",
    fontSize: 10,
    features: [cycleAnswersExcelAutoFilterFeature<NodeFileContent>(data.rows.length)],
  }).toBuffer();

  return {
    filename: cycleAnswersFilename(data),
    content: Buffer.from(file),
  };
}
