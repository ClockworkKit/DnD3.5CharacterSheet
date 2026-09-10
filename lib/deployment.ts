// Only the standalone Pages build defines these. Sites keeps its existing API.
declare const __BARROW_PAGES__: boolean;
declare const __BARROW_BASE__: string;

export const browserStorage = typeof __BARROW_PAGES__ !== 'undefined' && __BARROW_PAGES__;
export const basePath = typeof __BARROW_BASE__ === 'string' ? __BARROW_BASE__ : '/';

export function assetUrl(path: string): string {
  return basePath + path.replace(/^\/+/, '');
}
