// Cliente mínimo de Google OAuth + Drive v3 (alcance drive.file: la app solo ve
// los archivos y carpetas que ella misma crea en el Drive del usuario).

const OAUTH = Deno.env.get('GOOGLE_OAUTH_URL') ?? 'https://oauth2.googleapis.com';
const API = Deno.env.get('GOOGLE_API_URL') ?? 'https://www.googleapis.com';
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

export const ALCANCE_DRIVE = 'https://www.googleapis.com/auth/drive.file';

async function json<T>(r: Response, que: string): Promise<T> {
  if (!r.ok) throw new Error(`Google ${que}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export function configurado(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET;
}

/** Intercambia el código de autorización por tokens (incluye refresh token). */
export async function canjearCodigo(codigo: string, redirectUri: string) {
  const r = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: codigo,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  return await json<{ access_token: string; refresh_token?: string; scope: string }>(r, 'canje de código');
}

export async function tokenDeAcceso(refreshToken: string): Promise<string> {
  const r = await fetch(`${OAUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  return (await json<{ access_token: string }>(r, 'renovar token')).access_token;
}

export async function revocar(token: string) {
  await fetch(`${OAUTH}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

export async function emailDeLaCuenta(token: string): Promise<string | null> {
  const r = await fetch(`${API}/drive/v3/about?fields=user(emailAddress)`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return (await r.json()).user?.emailAddress ?? null;
}

export async function crearCarpeta(token: string, nombre: string, padre?: string): Promise<string> {
  const r = await fetch(`${API}/drive/v3/files?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', ...(padre ? { parents: [padre] } : {}) }),
  });
  return (await json<{ id: string }>(r, 'crear carpeta')).id;
}

/** ¿Sigue existiendo (y no está en la papelera) la carpeta? */
export async function carpetaExiste(token: string, id: string): Promise<boolean> {
  const r = await fetch(`${API}/drive/v3/files/${id}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return false;
  return !(await r.json()).trashed;
}

/** Subida reanudable (sirve para cualquier tamaño). Devuelve el id del archivo. */
export async function subirArchivo(
  token: string,
  { nombre, carpeta, tipo, contenido, descripcion }: { nombre: string; carpeta: string; tipo: string; contenido: Blob; descripcion?: string },
): Promise<string> {
  const inicio = await fetch(`${API}/upload/drive/v3/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': tipo,
      'X-Upload-Content-Length': String(contenido.size),
    },
    body: JSON.stringify({ name: nombre, parents: [carpeta], ...(descripcion ? { description: descripcion } : {}) }),
  });
  if (!inicio.ok) throw new Error(`Google iniciar subida: ${inicio.status} ${await inicio.text()}`);
  const destino = inicio.headers.get('Location');
  if (!destino) throw new Error('Google no entregó la URL de subida');
  const r = await fetch(destino, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': tipo },
    body: contenido,
  });
  return (await json<{ id: string }>(r, 'subir archivo')).id;
}

/** Borra los respaldos más antiguos, conservando los `conservar` más recientes. */
export async function podarRespaldos(token: string, carpeta: string, prefijo: string, conservar: number): Promise<number> {
  const q = `'${carpeta}' in parents and name contains '${prefijo}' and trashed = false`;
  const r = await fetch(
    `${API}/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&pageSize=200&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const { files } = await json<{ files: { id: string }[] }>(r, 'listar respaldos');
  const sobrantes = files.slice(conservar);
  for (const f of sobrantes) {
    await fetch(`${API}/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  }
  return sobrantes.length;
}
