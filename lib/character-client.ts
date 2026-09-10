import {browserStorage} from './deployment.ts';

export async function characterApi<T>(url: string, init?: RequestInit): Promise<T> {
  if (browserStorage) {
    const {browserCharacterApi} = await import('./browser-character-store.ts');
    return browserCharacterApi<T>(url, init);
  }
  const response = await fetch(url, {...init, headers: {'Content-Type': 'application/json', ...init?.headers}, cache: 'no-store'});
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new Error('The server did not return a character. Keep this page open and retry, or export a backup.'); }
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'The character could not be saved.';
    throw new Error(error);
  }
  return body as T;
}
