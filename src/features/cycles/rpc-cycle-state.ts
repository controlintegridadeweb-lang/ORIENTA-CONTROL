/** Extrai o estado atual de mensagens padronizadas emitidas pelas RPCs de ciclo. */
export function cycleStateFromRpcMessage(message: string): string | null {
  const match = message.match(/estado do ciclo\s+([a-z_]+)/i);
  return match?.[1] ?? null;
}
