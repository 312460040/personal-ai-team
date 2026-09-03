/**
 * Central API routing for the split deployment:
 * GitHub Pages hosts the React UI; Render hosts the Express/Agent API.
 *
 * Set VITE_API_BASE_URL during the Pages build to the Render service URL.
 * Local development keeps the same-origin /api fallback.
 */
const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

export const API_BASE_URL = configuredBase;

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

/**
 * Route relative /api browser requests to Render when VITE_API_BASE_URL is set.
 * This keeps existing services/components compatible without duplicating base-url logic.
 */
if (typeof window !== 'undefined' && API_BASE_URL) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return originalFetch(apiUrl(input), init);
    }
    if (input instanceof URL && input.pathname.startsWith('/api/')) {
      return originalFetch(new URL(apiUrl(`${input.pathname}${input.search}`)), init);
    }
    if (input instanceof Request && new URL(input.url).pathname.startsWith('/api/')) {
      const url = new URL(input.url);
      return originalFetch(apiUrl(`${url.pathname}${url.search}`), init || input);
    }
    return originalFetch(input, init);
  };
}
