/** Rotas do fluxo de resposta e de sua confirmação final. */
const FORM_FILL_PATH = /^\/respondente\/ciclos\/[^/]+(?:\/enviado)?$/;

export function isFormFillRoute(pathname: string): boolean {
  return FORM_FILL_PATH.test(pathname);
}
