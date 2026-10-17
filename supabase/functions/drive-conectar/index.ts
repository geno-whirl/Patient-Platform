// Conecta (o desconecta) el Google Drive del usuario para respaldos automáticos.
// POST { accion: 'conectar', codigo, redirectUri } | { accion: 'desconectar' }
import * as google from '../_shared/google.ts';
import { respaldarUsuario } from '../_shared/respaldo.ts';
import { borrarEstado, CORS, guardarEstado, respuesta, rpc, usuarioDeLaPeticion } from '../_shared/servicio.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405);
  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return respuesta({ error: 'No autenticado' }, 401);
  if (!google.configurado()) return respuesta({ error: 'Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en las Edge Functions' }, 500);

  try {
    const cuerpo = await req.json();
    if (cuerpo.accion === 'desconectar') {
      const refresh = await rpc<string | null>('drive_leer_token', { p_user: usuario.id });
      if (refresh) await google.revocar(refresh);
      await rpc('drive_borrar_token', { p_user: usuario.id });
      await borrarEstado(usuario.id);
      return respuesta({ ok: true });
    }

    if (cuerpo.accion !== 'conectar' || !cuerpo.codigo || !cuerpo.redirectUri) {
      return respuesta({ error: 'Petición inválida' }, 400);
    }
    const tokens = await google.canjearCodigo(cuerpo.codigo, cuerpo.redirectUri);
    if (!tokens.scope?.split(' ').includes(google.ALCANCE_DRIVE)) {
      return respuesta({ error: 'No se otorgó permiso para Google Drive. Vuelve a conectar y marca la casilla de Drive.' }, 400);
    }
    if (!tokens.refresh_token) {
      return respuesta(
        { error: 'Google no entregó un token permanente. Quita el acceso de la app en myaccount.google.com/permissions y vuelve a conectar.' },
        400,
      );
    }
    await rpc('drive_guardar_token', { p_user: usuario.id, p_token: tokens.refresh_token });
    await guardarEstado(usuario.id, {
      email_google: await google.emailDeLaCuenta(tokens.access_token),
      conectado_en: new Date().toISOString(),
      ultimo_estado: 'conectado',
    });
    // Primer respaldo inmediato. Si falla, la conexión queda hecha y el error se informa aparte.
    try {
      return respuesta({ ok: true, ...(await respaldarUsuario(usuario.id)) });
    } catch (e) {
      return respuesta({ ok: true, errorRespaldo: e instanceof Error ? e.message : String(e) });
    }
  } catch (e) {
    console.error(e);
    return respuesta({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
