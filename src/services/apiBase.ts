const PRODUCTION_API_BASE_URL = 'https://personal-ai-team-1.onrender.com';

// GitHub Pages builds do not automatically receive Vite environment variables.
// Keep an explicit production backend fallback so deployed frontend requests do
// not accidentally target the GitHub Pages origin (which has no /api server).
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || PRODUCTION_API_BASE_URL).replace(/\/$/, '');

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
