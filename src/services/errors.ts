export function describeError(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim()) return cause.message;
  if (typeof cause === 'string' && cause.trim()) return cause;
  return '发生未知错误，请重试。';
}
