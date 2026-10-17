import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../data/supabase';
import { fechaLegible } from '../domain/clinica';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const URL_AUTORIZACION = (import.meta.env.VITE_GOOGLE_AUTH_URL as string | undefined) ?? 'https://accounts.google.com/o/oauth2/v2/auth';
const ALCANCE = 'https://www.googleapis.com/auth/drive.file';
const CLAVE_ESTADO = 'kine-drive-estado-oauth';

interface Estado {
  email_google: string | null;
  frecuencia: 'diaria' | 'semanal' | 'pausada';
  ultimo_respaldo: string | null;
  ultimo_estado: string | null;
  ultimo_archivo: string | null;
  adjuntos_subidos: Record<string, string>;
}

const redirectUri = () => `${window.location.origin}/datos`;

function horaLegible(iso: string) {
  const d = new Date(iso);
  return `${fechaLegible(iso.slice(0, 10))} ${d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Respaldo automático en Google Drive (solo con Supabase; lo ejecutan las Edge Functions). */
export function RespaldoDrive() {
  const [estado, setEstado] = useState<Estado | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [params, setParams] = useSearchParams();
  const procesado = useRef(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase!.from('respaldos_drive').select('*').maybeSingle();
    if (error) setMensaje({ tipo: 'error', texto: error.message });
    setEstado((data as Estado | null) ?? null);
  }, []);

  const invocar = async (funcion: string, cuerpo: object) => {
    const { data, error } = await supabase!.functions.invoke(funcion, { body: cuerpo });
    if (error) {
      // El cuerpo de la respuesta trae el mensaje legible.
      const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(detalle?.error ?? error.message);
    }
    return data as { archivo?: string; adjuntosNuevos?: number; errorRespaldo?: string };
  };

  // Vuelta desde Google con ?code=…&state=…
  useEffect(() => {
    const codigo = params.get('code');
    const errorGoogle = params.get('error');
    if ((!codigo && !errorGoogle) || procesado.current) {
      if (!procesado.current) void cargar();
      return;
    }
    procesado.current = true;
    const estadoEsperado = sessionStorage.getItem(CLAVE_ESTADO);
    sessionStorage.removeItem(CLAVE_ESTADO);
    setParams({}, { replace: true });
    if (errorGoogle) {
      setMensaje({ tipo: 'error', texto: 'No se otorgó acceso a Google Drive.' });
      void cargar();
      return;
    }
    if (!estadoEsperado || params.get('state') !== estadoEsperado) {
      setMensaje({ tipo: 'error', texto: 'La respuesta de Google no coincide con esta sesión. Intenta conectar de nuevo.' });
      void cargar();
      return;
    }
    setOcupado('Conectando con Google Drive y haciendo el primer respaldo…');
    invocar('drive-conectar', { accion: 'conectar', codigo, redirectUri: redirectUri() })
      .then((r) =>
        setMensaje(
          r.errorRespaldo
            ? { tipo: 'error', texto: `Conectado, pero el primer respaldo falló: ${r.errorRespaldo}` }
            : { tipo: 'ok', texto: `Conectado. Primer respaldo: ${r.archivo}` },
        ),
      )
      .catch((e: Error) => setMensaje({ tipo: 'error', texto: e.message }))
      .finally(() => {
        setOcupado('');
        void cargar();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conectar = () => {
    const state = crypto.randomUUID();
    sessionStorage.setItem(CLAVE_ESTADO, state);
    const q = new URLSearchParams({
      client_id: CLIENT_ID!,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: ALCANCE,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    window.location.assign(`${URL_AUTORIZACION}?${q}`);
  };

  const respaldarAhora = async () => {
    setOcupado('Respaldando…');
    setMensaje(null);
    try {
      const r = await invocar('drive-respaldo', {});
      setMensaje({ tipo: 'ok', texto: `Respaldo creado: ${r.archivo}${r.adjuntosNuevos ? ` (+${r.adjuntosNuevos} adjuntos)` : ''}` });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado('');
      void cargar();
    }
  };

  const desconectar = async () => {
    if (!confirm('¿Desconectar Google Drive? Los respaldos ya guardados en tu Drive se conservan.')) return;
    setOcupado('Desconectando…');
    try {
      await invocar('drive-conectar', { accion: 'desconectar' });
      setMensaje({ tipo: 'ok', texto: 'Google Drive desconectado.' });
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado('');
      void cargar();
    }
  };

  const cambiarFrecuencia = async (frecuencia: Estado['frecuencia']) => {
    setEstado((e) => (e ? { ...e, frecuencia } : e));
    const { error } = await supabase!.from('respaldos_drive').update({ frecuencia }).not('user_id', 'is', null);
    if (error) setMensaje({ tipo: 'error', texto: error.message });
  };

  return (
    <section className="tarjeta pila">
      <h3>Respaldo automático en Google Drive</h3>
      {estado === undefined ? (
        <p className="tenue">Cargando…</p>
      ) : estado ? (
        <>
          <dl className="definiciones">
            <dt>Cuenta</dt>
            <dd>{estado.email_google ?? 'Conectada'}</dd>
            <dt>Carpeta</dt>
            <dd>“Kine — respaldos” en tu Drive (se conservan los últimos 30 respaldos)</dd>
            <dt>Último respaldo</dt>
            <dd>{estado.ultimo_respaldo ? horaLegible(estado.ultimo_respaldo) : '—'}</dd>
            <dt>Estado</dt>
            <dd className={estado.ultimo_estado?.startsWith('error') ? 'texto-error' : ''}>{estado.ultimo_estado ?? '—'}</dd>
            <dt>Adjuntos en Drive</dt>
            <dd>{Object.keys(estado.adjuntos_subidos ?? {}).length}</dd>
          </dl>
          <div className="filtros">
            <label className="casilla">
              Frecuencia
              <select
                value={estado.frecuencia}
                onChange={(e) => cambiarFrecuencia(e.target.value as Estado['frecuencia'])}
                aria-label="Frecuencia del respaldo"
              >
                <option value="diaria">Diaria</option>
                <option value="semanal">Semanal</option>
                <option value="pausada">Pausada</option>
              </select>
            </label>
            <button className="boton boton--primario" onClick={respaldarAhora} disabled={!!ocupado}>
              Respaldar ahora
            </button>
            <button className="boton boton--peligro" onClick={desconectar} disabled={!!ocupado}>
              Desconectar
            </button>
          </div>
        </>
      ) : (
        <>
          <p>
            Guarda automáticamente una copia completa (JSON) de todas tus fichas y tus adjuntos en tu propio Google Drive, aunque
            no tengas la app abierta. La app solo puede ver los archivos que ella misma crea en tu Drive.
          </p>
          {CLIENT_ID ? (
            <div>
              <button className="boton boton--primario" onClick={conectar} disabled={!!ocupado}>
                Conectar Google Drive
              </button>
            </div>
          ) : (
            <p className="aviso">Falta configurar VITE_GOOGLE_CLIENT_ID (ver README, sección Google Drive).</p>
          )}
        </>
      )}
      {ocupado && <p className="aviso">{ocupado}</p>}
      {mensaje && <p className={`aviso aviso--${mensaje.tipo}`}>{mensaje.texto}</p>}
    </section>
  );
}
