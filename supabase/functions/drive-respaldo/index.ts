// Ejecuta respaldos en Google Drive.
// - Con el JWT de un usuario: respalda a ese usuario ahora ("Respaldar ahora").
// - Con la cabecera x-secreto-cron (llamada desde pg_cron): respalda a todos los
//   usuarios a quienes les corresponde según su frecuencia.
import { respaldarUsuario } from '../_shared/respaldo.ts';
import { CORS, respuesta, rpc, usuarioDeLaPeticion } from '../_shared/servicio.ts';

const SECRETO_CRON = Deno.env.get('SECRETO_CRON') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405);

  const secreto = req.headers.get('x-secreto-cron');
  if (secreto) {
    if (!SECRETO_CRON || secreto !== SECRETO_CRON) return respuesta({ error: 'Secreto inválido' }, 401);
    const pendientes = await rpc<string[]>('drive_respaldos_pendientes');
    const resultados: Record<string, string> = {};
    for (const userId of pendientes) {
      try {
        const r = await respaldarUsuario(userId);
        resultados[userId] = `ok ${r.archivo}`;
      } catch (e) {
        resultados[userId] = `error ${e instanceof Error ? e.message : e}`;
      }
    }
    console.log('respaldo programado', resultados);
    return respuesta({ ok: true, usuarios: pendientes.length, resultados });
  }

  const usuario = await usuarioDeLaPeticion(req);
  if (!usuario) return respuesta({ error: 'No autenticado' }, 401);
  try {
    return respuesta({ ok: true, ...(await respaldarUsuario(usuario.id)) });
  } catch (e) {
    return respuesta({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
