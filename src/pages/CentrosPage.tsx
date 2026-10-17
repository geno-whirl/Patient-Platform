import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { OpcionesCentros } from '../components/OpcionesCentros';
import { useDatos } from '../data/DatosContext';
import { nuevoCentro } from '../domain/factories';
import type { Centro } from '../domain/schema';

const COLORES = ['#0f766e', '#2a78d6', '#eb6834', '#6250d6', '#d55181', '#008300', '#c98500', '#52514e'];

export function CentrosPage() {
  const { db, guardar } = useDatos();
  const [nombre, setNombre] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);
  const [aEliminar, setAEliminar] = useState<Centro | null>(null);
  const [aviso, setAviso] = useState('');

  const orden = (a: Centro, b: Centro) => a.nombre.localeCompare(b.nombre, 'es');
  const activos = db.centros.filter((c) => !c.archivado).sort(orden);
  const archivados = db.centros.filter((c) => c.archivado).sort(orden);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const c = nuevoCentro(nombre.trim());
    c.color = COLORES[db.centros.length % COLORES.length];
    await guardar('centros', c);
    setNombre('');
  };

  const archivar = async (c: Centro, archivado: boolean) => {
    await guardar('centros', { ...c, archivado });
    setAviso(
      archivado
        ? `"${c.nombre}" quedó archivado: ya no aparece al crear pacientes, pero sus pacientes e historial se mantienen.`
        : `"${c.nombre}" está activo de nuevo.`,
    );
  };

  return (
    <div className="pila">
      <div className="titulo">
        <h1>Centros</h1>
      </div>
      <p className="tenue">
        Lugares donde atiendes (clínicas, consultas, domicilio…). Si dejas de atender en uno, <strong>archívalo</strong>: conserva
        sus pacientes e historial y deja de ofrecerse para pacientes nuevos.
      </p>
      <form className="tarjeta nuevo-paciente" onSubmit={crear}>
        <input placeholder="Nombre del centro" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del centro" />
        <button className="boton boton--primario" disabled={!nombre.trim()}>
          + Agregar centro
        </button>
      </form>
      {aviso && <p className="aviso aviso--ok">{aviso}</p>}
      {activos.length === 0 && <p className="vacio">No hay centros activos.</p>}
      <ul className="lista-simple">
        {activos.map((c) => (
          <FilaCentro key={c.id} centro={c} onArchivar={() => archivar(c, true)} onEliminar={() => setAEliminar(c)} />
        ))}
      </ul>

      {archivados.length > 0 && (
        <section className="pila">
          <button type="button" className="enlace" onClick={() => setVerArchivados(!verArchivados)} aria-expanded={verArchivados}>
            {verArchivados ? '▾' : '▸'} Centros archivados ({archivados.length})
          </button>
          {verArchivados && (
            <ul className="lista-simple">
              {archivados.map((c) => (
                <FilaCentro key={c.id} centro={c} onArchivar={() => archivar(c, false)} onEliminar={() => setAEliminar(c)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {aEliminar && (
        <EliminarCentro
          centro={aEliminar}
          onCerrar={() => setAEliminar(null)}
          onListo={(mensaje) => {
            setAEliminar(null);
            setAviso(mensaje);
          }}
        />
      )}
    </div>
  );
}

function FilaCentro({ centro: c, onArchivar, onEliminar }: { centro: Centro; onArchivar: () => void; onEliminar: () => void }) {
  const { db, guardar } = useDatos();
  const pacientes = db.pacientes.filter((p) => p.centroId === c.id);
  const activos = pacientes.filter((p) => p.estado === 'activo').length;
  return (
    <li className={`tarjeta centro ${c.archivado ? 'centro--archivado' : ''}`}>
      <input type="color" value={c.color} onChange={(e) => guardar('centros', { ...c, color: e.target.value })} aria-label={`Color de ${c.nombre}`} />
      <div className="centro__datos">
        <input
          className="centro__nombre"
          defaultValue={c.nombre}
          onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && guardar('centros', { ...c, nombre: e.target.value.trim() })}
          aria-label="Nombre"
        />
        <input
          placeholder="Dirección"
          defaultValue={c.direccion}
          onBlur={(e) => e.target.value !== c.direccion && guardar('centros', { ...c, direccion: e.target.value })}
          aria-label="Dirección"
        />
      </div>
      <Link to={`/?centro=${c.id}&estado=`} className="enlace">
        {activos} activos · {pacientes.length} en total
      </Link>
      <button className="boton boton--chico" onClick={onArchivar}>
        {c.archivado ? 'Reactivar' : 'Archivar'}
      </button>
      <button className="boton boton--chico boton--peligro" onClick={onEliminar}>
        Eliminar
      </button>
    </li>
  );
}

type Destino = 'mover' | 'sin_centro' | 'eliminar';

/** Eliminar un centro preguntando qué hacer con sus pacientes. */
function EliminarCentro({ centro, onCerrar, onListo }: { centro: Centro; onCerrar: () => void; onListo: (mensaje: string) => void }) {
  const { db, guardarVarios, eliminar, eliminarPaciente } = useDatos();
  const pacientes = db.pacientes.filter((p) => p.centroId === centro.id);
  const otros = db.centros.filter((c) => c.id !== centro.id);
  const [destino, setDestino] = useState<Destino>(otros.some((c) => !c.archivado) ? 'mover' : 'sin_centro');
  const [centroDestino, setCentroDestino] = useState(otros.find((c) => !c.archivado)?.id ?? '');
  const [confirmacion, setConfirmacion] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');
  const n = pacientes.length;
  const puedeConfirmar =
    !trabajando &&
    (n === 0 || (destino === 'mover' && !!centroDestino) || destino === 'sin_centro' || (destino === 'eliminar' && confirmacion.trim().toUpperCase() === 'ELIMINAR'));

  const confirmar = async () => {
    setTrabajando(true);
    setError('');
    try {
      let mensaje = `Centro "${centro.nombre}" eliminado.`;
      if (n > 0 && destino === 'mover') {
        const nombreDestino = db.centros.find((c) => c.id === centroDestino)?.nombre;
        await guardarVarios('pacientes', pacientes.map((p) => ({ ...p, centroId: centroDestino })));
        mensaje += ` ${n} paciente(s) movido(s) a "${nombreDestino}".`;
      } else if (n > 0 && destino === 'sin_centro') {
        await guardarVarios('pacientes', pacientes.map((p) => ({ ...p, centroId: null })));
        mensaje += ` ${n} paciente(s) quedaron sin centro.`;
      } else if (n > 0 && destino === 'eliminar') {
        for (const p of pacientes) await eliminarPaciente(p.id);
        mensaje += ` También se eliminaron ${n} paciente(s) con todos sus registros.`;
      }
      await eliminar('centros', centro.id);
      onListo(mensaje);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTrabajando(false);
    }
  };

  const opcion = (valor: Destino, titulo: string, detalle: string, deshabilitada = false) => (
    <label className={`opcion-radio ${destino === valor ? 'opcion-radio--activa' : ''} ${deshabilitada ? 'opcion-radio--deshabilitada' : ''}`}>
      <input type="radio" name="destino" checked={destino === valor} disabled={deshabilitada} onChange={() => setDestino(valor)} />
      <span>
        <strong>{titulo}</strong>
        <small className="tenue">{detalle}</small>
      </span>
    </label>
  );

  return (
    <Modal
      titulo={`Eliminar "${centro.nombre}"`}
      abierto
      onCerrar={onCerrar}
      pie={
        <>
          <span className="espaciador" />
          <button className="boton" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton boton--primario boton--peligro-solido" onClick={confirmar} disabled={!puedeConfirmar}>
            {trabajando ? 'Eliminando…' : 'Eliminar centro'}
          </button>
        </>
      }
    >
      {n === 0 ? (
        <p>Este centro no tiene pacientes. Se eliminará sin afectar a nadie.</p>
      ) : (
        <div className="pila">
          <p>
            Este centro tiene <strong>{n} paciente(s)</strong> ({pacientes.filter((p) => p.estado === 'activo').length} activos). ¿Qué
            hacemos con ellos?
          </p>
          <p className="tenue">
            Si solo dejaste de atender ahí, considera <strong>archivarlo</strong> en vez de eliminarlo: conserva todo tal cual.
          </p>
          {opcion('mover', 'Moverlos a otro centro', 'Conservan todo su historial.', otros.length === 0)}
          {destino === 'mover' && otros.length > 0 && (
            <select value={centroDestino} onChange={(e) => setCentroDestino(e.target.value)} aria-label="Centro de destino">
              <OpcionesCentros centros={otros} conArchivados />
            </select>
          )}
          {opcion('sin_centro', 'Dejarlos sin centro', 'Conservan todo su historial; podrás asignarles un centro después.')}
          {opcion('eliminar', 'Eliminar también a los pacientes', 'Se borran sus fichas, sesiones, evaluaciones y adjuntos. No se puede deshacer.')}
          {destino === 'eliminar' && (
            <div className="campo">
              <label htmlFor="confirmar-eliminar">
                Escribe <strong>ELIMINAR</strong> para confirmar
              </label>
              <input id="confirmar-eliminar" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off" />
            </div>
          )}
        </div>
      )}
      {error && <p className="aviso aviso--error">{error}</p>}
    </Modal>
  );
}
