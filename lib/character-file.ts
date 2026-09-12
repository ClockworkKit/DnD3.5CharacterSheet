import {characterSchema} from './model.ts';

/** Validate the envelope before Zod strips unknown fields from character data. */
export function parseCharacterFile(text: string) {
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { throw new Error('This file is not valid JSON. Choose a Barrow Ledger character export.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('This is not a valid Barrow Ledger character file.');
  }
  const file = raw as Record<string, unknown>;
  if ('format' in file || 'version' in file) {
    if (file.format !== 'barrow-ledger-character') {
      throw new Error('This file is not a Barrow Ledger character export.');
    }
    if (file.version !== 1) {
      throw new Error('This character export version is not supported. Use a version 1 Barrow Ledger export.');
    }
    if (!('data' in file)) {
      throw new Error('This character export is missing its character data.');
    }
  }
  // Retain compatibility with raw characters and legacy {data: character} files.
  const result = characterSchema.safeParse('data' in file ? file.data : file);
  if (!result.success) throw new Error('This is not a valid Barrow Ledger character file.');
  return result.data;
}
