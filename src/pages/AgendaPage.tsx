import { Link, useSearchParams } from 'react-router-dom';
import { InsigniaCentro, InsigniaEstadoSesion } from '../components/Insignias';
import { useDatos } from '../data/DatosContext';
import { fechaLegible } from '../domain/clinica';
import { hoy } from '../domain/factories';

/** Sesiones planificadas de todos los pacientes, agrupadas por día. */
export function AgendaPage() {
  const { db } = useDatos();
  const [params, setParams] = useSearchParams();
  const centroId = params.get('centro') ?? '';
  const verPasadas = params.get('pasadas') === '1';
  const fechaHoy = hoy();
  const pacientes = new Map(db.pacientes.map((p) => [p.id, p]));

  const sesiones = db.sesiones
    .filter((s) => {
      const p = pacientes.get(s.pacienteId);
      if (!p) return false;
      if (centroId && p.centroId !== centroId) return false;
      // Pendientes: planificadas desde hoy. Con "pasadas": planificadas atrasadas (sin registrar).
      return s.estado === 'planificada' && (verPasadas ? s.fecha < fechaHoy : s.fecha >= fechaHoy);
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));

  const porDia = new Map<string, typeof sesiones>();
  for (const s of sesiones) porDia.set(s.fecha, [...(porDia.get(s.fecha) ?? []), s]);

  const fijar = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  return (
    <div className="pila">
      <div className="titulo">
        <h1>Agenda</h1>
      </div>
      <div className="filtros">
        <select value={centroId} onChange={(e) => fijar('centro', e.target.value)} aria-label="Filtrar por centro">
          <option value="">Todos los centros</option>
          {db.centros.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <div className="segmentado" role="group" aria-label="Periodo">
          <button className={!verPasadas ? 'activo' : ''} onClick={() => fijar('pasadas', '')}>
            Próximas
          </button>
          <button className={verPasadas ? 'activo' : ''} onClick={() => fijar('pasadas', '1')}>
            Pendientes de registrar
          </button>
        </div>
      </div>
      {sesiones.length === 0 && (
        <p className="vacio">
          {verPasadas
            ? 'No hay sesiones pasadas sin registrar. ¡Todo al día!'
            : 'No hay sesiones planificadas. Planifícalas desde la ficha de cada paciente.'}
        </p>
      )}
      {[...porDia].map(([fecha, lista]) => (
        <section key={fecha} className="agenda-dia">
          <h3>
            {fecha === fechaHoy ? 'Hoy · ' : ''}
            {fechaLegible(fecha)}
          </h3>
          <ul className="lista-simple">
            {lista.map((s) => {
              const p = pacientes.get(s.pacienteId)!;
              return (
                <li key={s.id}>
                  <Link to={`/pacientes/${p.id}/sesiones/${s.id}`} className="tarjeta fila">
                    <strong>{s.hora || '--:--'}</strong>
                    <span>{p.identificacion.nombre}</span>
                    <span className="tenue">Sesión {s.numero}</span>
                    <InsigniaCentro centro={db.centros.find((c) => c.id === p.centroId)} />
                    <InsigniaEstadoSesion estado={s.estado} />
                    <span className="tenue fila__texto">{s.planificacion.objetivos}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
