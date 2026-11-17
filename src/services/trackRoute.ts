/**
 * مسیریابی صفحهٔ پیگیری عمومی بدون کتابخانهٔ router.
 *
 * قالب تأییدشده:
 * - `/track` — فرم دستی
 * - `/track/:trackingCode` — پر کردن خودکار و جست‌وجو (مثلاً `/track/ORD-…`)
 */

export type TrackPathParse =
  | { kind: 'base' }
  | { kind: 'code'; raw: string }
  | { kind: 'invalid' };

export function isPublicTrackPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/track' || path.startsWith('/track/');
}

export function parseTrackPath(pathname: string): TrackPathParse {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/track') return { kind: 'base' };
  if (!path.startsWith('/track/')) return { kind: 'invalid' };

  const rest = path.slice('/track/'.length);
  if (!rest || rest.includes('/')) return { kind: 'invalid' };

  try {
    const decoded = decodeURIComponent(rest).trim();
    if (decoded === '') return { kind: 'invalid' };
    return { kind: 'code', raw: decoded };
  } catch {
    return { kind: 'invalid' };
  }
}
