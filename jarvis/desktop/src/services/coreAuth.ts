/**
 * Optional Core API token (CURRENT_PHASE defect 5).
 * When the owner sets KIAROS_CORE_TOKEN on the Core, the Desktop presents
 * the same secret via VITE_KIAROS_CORE_TOKEN. Unset (default) = no header,
 * behavior unchanged.
 */

export function coreHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_KIAROS_CORE_TOKEN || '').trim();
  return token ? { ...extra, 'x-kiaros-token': token } : extra;
}

/** Query-string suffix for the /ws endpoint when a token is configured. */
export function coreWsQuery(): string {
  const token = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_KIAROS_CORE_TOKEN || '').trim();
  return token ? `?token=${encodeURIComponent(token)}` : '';
}
