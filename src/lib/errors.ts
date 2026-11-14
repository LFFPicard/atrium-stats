// Turns an unknown thrown value into one log line that includes the cause chain.
// fetch() failures surface as a bare "fetch failed" with the useful part (ECONNREFUSED,
// ENOTFOUND, certificate errors, ...) hidden in err.cause — sometimes two levels down.

function one(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    return typeof code === 'string' && !err.message.includes(code) ? `${err.message} [${code}]` : err.message;
  }
  return String(err);
}

export function describeError(err: unknown): string {
  const parts: string[] = [one(err)];
  let current: unknown = err;
  for (let depth = 0; depth < 5; depth++) {
    const cause: unknown = current instanceof Error ? current.cause : undefined;
    if (cause === undefined || cause === null) break;
    parts.push(one(cause));
    current = cause;
  }
  return parts.join(' — cause: ');
}
