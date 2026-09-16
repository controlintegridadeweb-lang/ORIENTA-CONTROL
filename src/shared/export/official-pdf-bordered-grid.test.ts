import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawGridBlock,
  drawGridBlockPaginated,
  gridColumnWidth,
  gridPaletteForAxis,
  headerRowCells,
  headerValueRowCells,
  labelValueRowCells,
  noticeRowCells,
  planGridPageBatches,
  quadRowCells,
  subheaderRowCells,
} from "./official-pdf-bordered-grid";
import type { PdfGridHost } from "./official-pdf-types";
import { contentWidth, reportAxisTheme, reportTheme } from "./official-pdf-theme";

async function createHost(): Promise<PdfGridHost & { pdf: PDFDocument }> {
  const pdf = await PDFDocument.create();
  const fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const contentBottom = reportTheme.margin + reportTheme.footerH;
  return {
    pdf,
    fonts,
    contentBottom,
    ensureSpace(cursor, needed) {
      if (cursor.y - needed < contentBottom) {
        const page = pdf.addPage([reportTheme.page.w, reportTheme.page.h]);
        return { page, y: reportTheme.page.h - reportTheme.margin };
      }
      return cursor;
    },
  };
}

describe("grade institucional do PDF", () => {
  it("mantém a mesma malha de 4 colunas em todas as linhas", () => {
    const col = gridColumnWidth();
    const pair = labelValueRowCells("Critério", "Pergunta institucional");
    const headerValue = headerValueRowCells("Recomendação 1", "Texto da recomendação");
    const subheader = subheaderRowCells("Plano de integridade e compliance");
    const notice = noticeRowCells("Nenhuma ação cadastrada para esta recomendação.");
    const quad = quadRowCells("Prazo inicial", "01/10/2026", "Prazo final", "17/12/2027");

    expect(pair[0]?.width).toBe(col);
    expect(pair[1]?.width).toBe(gridColumnWidth(3));
    expect(headerValue[0]?.width).toBe(col);
    expect(headerValue[1]?.width).toBe(gridColumnWidth(3));
    expect(subheader).toHaveLength(1);
    expect(subheader[0]?.width).toBe(contentWidth());
    expect(notice[0]?.width).toBe(col);
    expect(quad.every((cell) => cell.width === col)).toBe(true);
    expect(quad.reduce((sum, cell) => sum + cell.width, 0)).toBeCloseTo(contentWidth());
    expect(pair[0]!.width + pair[1]!.width).toBeCloseTo(contentWidth());
  });

  it("pinta a grade com a identidade visual de cada eixo", () => {
    const gov = gridPaletteForAxis("Governança");
    const env = gridPaletteForAxis("Ambiental");
    const soc = gridPaletteForAxis("Social");
    expect(gov.headerBg).toEqual(reportAxisTheme("Governança").strong);
    expect(env.labelBg).toEqual(reportAxisTheme("Ambiental").softBackground);
    expect(soc.subheaderBg).toEqual(reportAxisTheme("Social").tint);
    expect(gov.headerBg).not.toEqual(env.headerBg);
    expect(env.headerBg).not.toEqual(soc.headerBg);
  });

  it("mantém recomendação e aviso dentro da tabela, sem bloco solto", () => {
    expect(headerValueRowCells("Recomendação 4", "Estabelecer prazos.")).toEqual([
      expect.objectContaining({ tone: "header", align: "left" }),
      expect.objectContaining({ tone: "value", align: "left" }),
    ]);
    expect(subheaderRowCells("Plano de integridade e compliance")[0]).toMatchObject({
      tone: "subheader",
      align: "left",
      text: "Plano de integridade e compliance",
      width: contentWidth(),
    });
    expect(headerRowCells("Recomendação de origem R1.1")[0]).toMatchObject({
      tone: "header",
      align: "left",
    });
    expect(noticeRowCells("Nenhuma ação cadastrada para esta recomendação.")[1]).toMatchObject({
      tone: "notice",
      align: "left",
    });
  });

  it("desenha o bloco sem lançar e avança o cursor", async () => {
    const host = await createHost();
    const page = host.pdf.addPage([reportTheme.page.w, reportTheme.page.h]);
    const next = drawGridBlock(host, { page, y: reportTheme.page.h - reportTheme.margin }, [
      labelValueRowCells(
        "Critério",
        "O órgão ou entidade estabelece prazos e acompanha a implementação das medidas corretivas?",
      ),
      quadRowCells("Resposta", "Não", "Resultado da análise", "Não atendido"),
      labelValueRowCells("Fundamentação", "Não implementado"),
      headerValueRowCells(
        "Recomendação 4",
        "Estabelecer prazos e monitorar a implementação das ações corretivas pelas empresas contratadas.",
      ),
      subheaderRowCells("Plano de integridade e compliance"),
      labelValueRowCells(
        "Ação 1",
        "Criar uma rotina para comunicar as empresas sobre as irregularidades identificadas na due diligence trabalhista, estabelecer prazo para correção e acompanhar o cumprimento das medidas até a regularização.",
      ),
      quadRowCells("Prazo inicial", "01/10/2026", "Prazo final", "31/12/2027"),
      quadRowCells("Situação atual", "Não iniciada", "Progresso", "0%"),
      quadRowCells(
        "Área responsável",
        "UIAG",
        "Respondente responsável",
        "Maurício Gomes",
      ),
      labelValueRowCells("Documentos", "Nenhum comprovante registrado."),
      labelValueRowCells(
        "Última atualização",
        "14/09/2026, 14:19\nAtualização de progresso registrada.",
      ),
    ]);

    expect(next.y).toBeLessThan(reportTheme.page.h - reportTheme.margin);
    expect(next.page).toBe(page);
  });
});

describe("paginação da grade institucional", () => {
  it("move a ação inteira para a página seguinte em vez de soltar Documentos e Última atualização", () => {
    const heights = [50, 50, 50, 50, 120, 24, 24, 24, 28, 36];
    const batches = planGridPageBatches(heights, [4, 6], 250, 700);
    expect(batches).toEqual([
      { start: 0, end: 4, newPageBefore: false },
      { start: 4, end: 10, newPageBefore: true },
    ]);
  });

  it("não parte um grupo que ainda cabe em uma página vazia", () => {
    const heights = [40, 24, 24, 24, 24, 36];
    expect(planGridPageBatches(heights, [6], 80, 700)).toEqual([
      { start: 0, end: 6, newPageBefore: true },
    ]);
  });

  it("empacota o restante em um único bloco depois da quebra de página", async () => {
    const host = await createHost();
    const page = host.pdf.addPage([reportTheme.page.w, reportTheme.page.h]);
    const action = [
      labelValueRowCells("Ação 1", "Criar uma rotina de comunicação com as empresas contratadas."),
      quadRowCells("Prazo inicial", "01/10/2026", "Prazo final", "31/12/2027"),
      quadRowCells("Situação atual", "Não iniciada", "Progresso", "0%"),
      quadRowCells("Área responsável", "UIAG", "Respondente responsável", "Maurício Gomes"),
      labelValueRowCells("Documentos", "Nenhum comprovante registrado."),
      labelValueRowCells("Última atualização", "14/09/2026, 14:00\nAtualização de progresso registrada."),
    ];
    const rows = [
      headerValueRowCells("Recomendação 4", "Estabelecer prazos e monitorar a implementação."),
      subheaderRowCells("Plano de integridade e compliance"),
      ...action,
    ];
    const nearFooter = reportTheme.margin + reportTheme.footerH + 90;
    const next = drawGridBlockPaginated(host, { page, y: nearFooter }, rows, {
      spans: [1, 7],
    });

    expect(host.pdf.getPageCount()).toBe(2);
    expect(next.page).not.toBe(page);
  });
});
