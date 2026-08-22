export function scrollToWorkbenchTarget(questionId?: string | null) {
  window.setTimeout(() => {
    const target = questionId
      ? document.getElementById(`pergunta-${questionId}`)
      : document.querySelector<HTMLElement>("[data-workbench-section]");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 0);
}
