/**
 * Error handling utilities (Backend)
 */

export function getErrorMessage(err: unknown, fallback: string = 'Terjadi kesalahan pada server.'): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === 'string' && err.trim().length > 0) {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim().length > 0) {
      return msg;
    }
  }
  return fallback;
}
