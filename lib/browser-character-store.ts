import {z} from 'zod';
import {characterSchema} from './model.ts';
import {basePath} from './deployment.ts';

const rowSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string(),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  updated_at: z.string(),
  data: characterSchema,
});
const ledgerSchema = z.object({
  format: z.literal('barrow-ledger-browser'),
  version: z.literal(1),
  characters: z.array(rowSchema),
});
type Row = z.infer<typeof rowSchema>;
type Ledger = z.infer<typeof ledgerSchema>;

export interface BrowserStoreEnvironment {
  storage: () => Pick<Storage, 'getItem' | 'setItem'>;
  lock: <T>(name: string, operation: () => T) => Promise<T>;
  scope: string;
  now?: () => string;
  id?: () => string;
}

function summary(row: Row) {
  return {id: row.id, name: row.data.name, revision: row.revision, updated_at: row.updated_at};
}

/** A single atomic storage write under a shared Web Lock prevents lost tab edits. */
export function createBrowserCharacterApi(environment: BrowserStoreEnvironment) {
  const key = 'barrow-ledger:characters:v1:' + environment.scope;

  function read(): Ledger {
    let raw: string | null;
    try { raw = environment.storage().getItem(key); }
    catch { throw new Error('Browser storage is unavailable. Allow site storage, or export a backup before closing this page.'); }
    if (raw === null) return {format: 'barrow-ledger-browser', version: 1, characters: []};
    try {
      const ledger = ledgerSchema.parse(JSON.parse(raw));
      if (new Set(ledger.characters.map(row => row.id)).size !== ledger.characters.length) throw new Error('Duplicate character IDs');
      return ledger;
    } catch {
      // Never replace an unreadable ledger with an empty one.
      throw new Error('The saved browser ledger could not be read. It has not been changed. Export your current character and keep this browser data for recovery.');
    }
  }

  function write(ledger: Ledger) {
    try { environment.storage().setItem(key, JSON.stringify(ledger)); }
    catch { throw new Error('The browser could not save this character. Storage may be full or blocked. Your edits remain open; export a backup before closing.'); }
  }

  return async function request<T = ReturnType<typeof summary>>(url: string, init?: RequestInit): Promise<T> {
    const match = /^\/api\/characters(?:\/([a-zA-Z0-9_-]+))?$/.exec(url);
    if (!match) throw new Error('Unknown character request.');
    const id = match[1];
    const method = (init?.method || 'GET').toUpperCase();
    if (method === 'GET') {
      const ledger = read();
      if (!id) return {characters: ledger.characters.slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(summary)} as T;
      const row = ledger.characters.find(row => row.id === id);
      if (!row) throw new Error('This character was deleted or is no longer saved in this browser.');
      return {...summary(row), data: row.data} as T;
    }
    if (!(method === 'POST' && !id || ['PUT', 'DELETE'].includes(method) && id)) throw new Error('Unsupported character request.');
    if (typeof init?.body !== 'string' || init.body.length > 1000000) throw new Error('Choose a character file smaller than 1 MB.');
    let payload: {data?: unknown; revision?: number};
    try {
      payload = JSON.parse(init.body);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid payload');
    } catch { throw new Error('The character data is not valid JSON.'); }
    const parsed = method === 'DELETE' ? null : characterSchema.safeParse(payload.data);
    if (parsed && !parsed.success) throw new Error('Check the character fields: ' + parsed.error.issues.slice(0, 3).map(issue => issue.path.join('.') + ' ' + issue.message).join('; '));
    if (id && (!Number.isSafeInteger(payload.revision) || payload.revision! < 1)) throw new Error('A current saved revision is required.');

    return environment.lock(key, () => {
      const ledger = read();
      const index = id ? ledger.characters.findIndex(row => row.id === id) : -1;
      if (id && index < 0) throw new Error('This character was deleted in another tab. Export your edits or save them as a new character.');
      const old = index < 0 ? null : ledger.characters[index];
      if (old && old.revision !== payload.revision) throw new Error('Another tab saved a newer revision. Reload the character, export your edits, or save them as a new character.');
      if (method === 'DELETE') {
        ledger.characters.splice(index, 1);
        write(ledger);
        return {deleted: true} as T;
      }
      if (!parsed?.success) throw new Error('A valid character is required.');
      const nextId = id || (environment.id?.() ?? crypto.randomUUID());
      if (!id && ledger.characters.some(row => row.id === nextId)) throw new Error('Could not create a unique character. Retry saving.');
      const revision = old ? old.revision + 1 : 1;
      if (!Number.isSafeInteger(revision)) throw new Error('Save this character as a new record.');
      const row: Row = {id: nextId, name: parsed.data.name, data: parsed.data, revision, updated_at: environment.now?.() ?? new Date().toISOString()};
      if (old) ledger.characters[index] = row;
      else ledger.characters.push(row);
      write(ledger);
      return summary(row) as T;
    });
  };
}

export const browserCharacterApi = createBrowserCharacterApi({
  scope: basePath,
  storage: () => window.localStorage,
  lock: (name, operation) => {
    if (!navigator.locks) return Promise.reject(new Error('Safe browser saving requires a current browser on HTTPS. You can still export your character as a backup.'));
    return navigator.locks.request(name, operation);
  },
});
