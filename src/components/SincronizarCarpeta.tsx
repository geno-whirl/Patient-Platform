import { useState } from 'react';
import { useSincronizacionCarpeta, type CarpetaElegida } from '../data/SincronizacionCarpeta';
import { Modal } from './Modal';

const hora = (d: Date) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
const fecha = (iso: string) => (iso ? new Date(iso).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short', hour12: false }) : 'fecha desconocida');

/** Datos e IA → mantener una carpeta del computador siempre al día. */
export function SincronizarCarpeta() {
  const { estado, elegir, activar, reanudar, desconectar, sincronizarAhora } = useSincronizacionCarpeta();
  const [elegida, setElegida] = useState<CarpetaElegida | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const intentar = async (fn: () => Promise<void>) => {
    setMensaje(null);
    setTrabajando(true);
    try {
      await fn();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setTrabajando(false);
    }
  };

  const alElegir = () =>
    intentar(async () => {
      const r = await elegir();
      if (!r) return;
      // Carpeta vacía o solo con archivos de la app: se usa directamente.
      if (!r.resumen.respaldo && !r.resumen.otrosArchivos) await activar(r, false);
      else setElegida(r);
    });

  const confirmar = (restaurar: boolean) =>
    intentar(async () => {
      if (!elegida) return;
      const r = await activar(elegida, restaurar);
      setElegida(null);
      if (r) setMensaje({ tipo: 'ok', texto: `Restaurados ${r.importados} registros desde la carpeta.` });
    });

  return (
    <section className="tarjeta pila">
      <h3>Sincronizar con una carpeta del computador</h3>
      <p>
        Elige una carpeta y la app la mantendrá siempre al día: después de cada cambio reescribe <code>respaldo.json</code> (todos
        los datos), <code>fichas-pacientes.md</code> (las fichas en Markdown, para leerlas o dárselas a una IA) y copia los
        adjuntos a <code>adjuntos/</code>. Si la carpeta está dentro de Google Drive, Dropbox, OneDrive o iCloud Drive en tu
        computador, además queda respaldada en la nube.
      </p>

      {estado.tipo === 'no_soportado' && (
        <p className="aviso aviso--aviso">
          Este navegador no permite que una página escriba en una carpeta. Funciona en Chrome o Edge en un computador (Windows,
          Mac, Linux o ChromeOS); no en Safari, Firefox ni en el celular. Mientras tanto, usa “Descargar respaldo completo”.
        </p>
      )}

      {estado.tipo === 'sin_carpeta' && (
        <div className="acciones acciones--izq">
          <button className="boton boton--primario" onClick={alElegir} disabled={trabajando}>
            Elegir carpeta…
          </button>
          <span className="tenue">Te recomendamos una carpeta nueva, solo para esto (por ejemplo “Kine”).</span>
        </div>
      )}

      {estado.tipo === 'requiere_permiso' && (
        <div className="estado-almacenamiento">
          <strong>Sincronización en pausa · 📁 {estado.carpeta}</strong>
          <small className="tenue">El navegador pide confirmar que la app puede seguir escribiendo en esa carpeta.</small>
          <div className="acciones acciones--izq">
            <button className="boton boton--primario boton--chico" onClick={() => intentar(reanudar)} disabled={trabajando}>
              Reanudar sincronización
            </button>
            <button className="boton boton--chico" onClick={() => intentar(desconectar)} disabled={trabajando}>
              Dejar de sincronizar
            </button>
          </div>
        </div>
      )}

      {estado.tipo === 'activa' && (
        <div className="estado-almacenamiento">
          <strong>
            {estado.error ? 'Error al sincronizar' : estado.sincronizando ? 'Sincronizando…' : 'Sincronizada ✓'} · 📁 {estado.carpeta}
          </strong>
          {estado.error ? (
            <small className="aviso aviso--error">{estado.error}</small>
          ) : (
            <small className="tenue">
              {estado.ultima ? `Última escritura a las ${hora(estado.ultima)}.` : 'Preparando la primera escritura…'} Se actualiza sola
              mientras la app está abierta en este navegador.
            </small>
          )}
          {estado.faltantes > 0 && (
            <small className="aviso aviso--aviso">
              {estado.faltantes} adjunto(s) no se pudieron copiar porque su archivo no está disponible; se reintentará.
            </small>
          )}
          <div className="acciones acciones--izq">
            <button className="boton boton--chico" onClick={sincronizarAhora} disabled={estado.sincronizando}>
              Sincronizar ahora
            </button>
            <button className="boton boton--chico" onClick={alElegir} disabled={trabajando}>
              Cambiar carpeta…
            </button>
            <button className="boton boton--chico" onClick={() => intentar(desconectar)} disabled={trabajando}>
              Dejar de sincronizar
            </button>
          </div>
        </div>
      )}

      {mensaje && <p className={`aviso aviso--${mensaje.tipo}`}>{mensaje.texto}</p>}
      {estado.tipo !== 'no_soportado' && (
        <p className="tenue">
          Dejar de sincronizar no borra la carpeta. Para pasar tus datos a otro computador, elige la misma carpeta allá y
          “Restaurar”. La carpeta contiene datos clínicos sensibles: no la compartas.
        </p>
      )}

      <Modal
        titulo={elegida?.resumen.respaldo ? 'La carpeta ya tiene un respaldo' : 'La carpeta no está vacía'}
        abierto={!!elegida}
        onCerrar={() => setElegida(null)}
        pie={
          <>
            <button className="boton" onClick={() => setElegida(null)} disabled={trabajando}>
              Cancelar
            </button>
            {elegida?.resumen.respaldo ? (
              <>
                <button className="boton" onClick={() => confirmar(false)} disabled={trabajando}>
                  Reemplazar con los datos de este navegador
                </button>
                <button className="boton boton--primario" onClick={() => confirmar(true)} disabled={trabajando}>
                  Restaurar y sincronizar
                </button>
              </>
            ) : (
              <button className="boton boton--primario" onClick={() => confirmar(false)} disabled={trabajando}>
                Usar esta carpeta
              </button>
            )}
          </>
        }
      >
        {elegida?.resumen.respaldo ? (
          <div className="pila">
            <p>
              <strong>📁 {elegida.carpeta.name}</strong> tiene un respaldo con {elegida.resumen.respaldo.pacientes} paciente(s),
              escrito el {fecha(elegida.resumen.respaldo.exportadoEn)}.
            </p>
            <p>
              <strong>Restaurar y sincronizar</strong> trae a la app lo que la carpeta tenga más nuevo (pacientes, sesiones,
              adjuntos…) sin borrar nada de lo que ya tienes, y desde ahí la mantiene al día. Úsalo en un computador nuevo o si
              no estás seguro.
            </p>
            <p>
              <strong>Reemplazar</strong> sobrescribe la carpeta con los datos de este navegador: lo que solo esté en la carpeta
              se perderá.
            </p>
          </div>
        ) : (
          <p>
            <strong>📁 {elegida?.carpeta.name}</strong> ya tiene otros archivos. La app agregará <code>respaldo.json</code>,{' '}
            <code>fichas-pacientes.md</code>, <code>LEEME.txt</code> y la carpeta <code>adjuntos/</code>, sin tocar lo demás.
            Igual es más ordenado usar una carpeta solo para esto.
          </p>
        )}
      </Modal>
    </section>
  );
}

/** Insignia en la barra superior: estado de la carpeta sincronizada (si hay una). */
export function InsigniaCarpeta() {
  const { estado, reanudar } = useSincronizacionCarpeta();
  if (estado.tipo === 'requiere_permiso') {
    return (
      <button className="insignia insignia--aviso insignia--boton" onClick={() => void reanudar()} title={`Reanudar la sincronización con la carpeta ${estado.carpeta}`}>
        📁 Reanudar
      </button>
    );
  }
  if (estado.tipo !== 'activa') return null;
  const titulo = estado.error
    ? estado.error
    : `Sincronizada con la carpeta ${estado.carpeta}${estado.ultima ? ` (última escritura ${hora(estado.ultima)})` : ''}`;
  return (
    <span className={`insignia ${estado.error ? 'insignia--error' : 'insignia--ok'}`} title={titulo}>
      📁 {estado.error ? 'Error' : estado.sincronizando ? 'Guardando…' : 'Al día'}
    </span>
  );
}
