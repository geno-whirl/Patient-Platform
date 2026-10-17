/**
 * Ruta base donde se sirve la app: "/" en Vercel/local, "/Patient-Platform/" en GitHub Pages
 * (la define BASE_PATH al compilar, ver vite.config.ts).
 */
export const BASE = import.meta.env.BASE_URL;

/** URL absoluta dentro de la app, ej. urlApp('datos') → https://host/base/datos */
export const urlApp = (ruta = '') => `${window.location.origin}${BASE}${ruta}`;

/** Recurso estático de public/, ej. recurso('favicon.svg') */
export const recurso = (archivo: string) => `${BASE}${archivo}`;
