import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { InsigniaCentro, InsigniaEstadoPaciente } from '../components/Insignias';
import { useDatos } from '../data/DatosContext';
import { useEliminarPaciente } from './PacientePage';
import { edad, fechaLegible, ETIQUETAS_ESTADO_PACIENTE } from '../domain/clinica';
import { filtrarPacientes, resumenPaciente, todasLasEtiquetas, type Filtros } from '../domain/consultas';
import { nuevoPaciente } from '../domain/factories';
import { ESTADOS_PACIENTE } from '../domain/schema';
import { OpcionesCentros } from '../components/OpcionesCentros';

export function PacientesPage() {
  const { db, guardar, importar } = useDatos();
  const eliminarConConfirmacion = useEliminarPaciente();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const centroParam = params.get('centro') ?? '';
  const filtros: Filtros = {
    texto: params.get('q') ?? '',
    // Un centro eliminado no debe dejar un filtro "fantasma" imposible de quitar.
    centroId: centroParam === 'ninguno' || db.centros.some((c) => c.id === centroParam) ? centroParam : '',
    etiquetas: params.get('etiquetas')?.split(',').filter(Boolean) ?? [],
    estado: params.get('estado') ?? 'activo',
  };
  const fijarFiltro = (clave: string, valor: string) => {
    const p = new URLSearchParams(params);
    if (valor || clave === 'estado') p.set(clave, valor);
    else p.delete(clave);
    setParams(p, { replace: true });
  };
  const alternarEtiqueta = (t: string) => {
    const set = new Set(filtros.etiquetas);
    if (set.has(t)) set.delete(t);
    else set.add(t);
    fijarFiltro('etiquetas', [...set].join(','));
  };

  const [nombreNuevo, setNombreNuevo] = useState('');
  const [centroNuevo, setCentroNuevo] = useState('');
  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombreNuevo.trim()) return;
    const centro = centroNuevo || (filtros.centroId && filtros.centroId !== 'ninguno' ? filtros.centroId : '');
    const p = await guardar('pacientes', nuevoPaciente(nombreNuevo.trim(), centro || null));
    navegar(`/pacientes/${p.id}/datos`);
  };

  // Las etiquetas filtradas se muestran siempre, aunque ya ningún paciente las tenga, para poder quitarlas.
  const etiquetas = [...new Set([...todasLasEtiquetas(db), ...filtros.etiquetas])].sort();
  const hayFiltros = !!(filtros.texto || filtros.centroId || filtros.etiquetas.length || filtros.estado !== 'activo');
  const limpiarFiltros = () => setParams(new URLSearchParams(), { replace: true });
  const lista = filtrarPacientes(db.pacientes, db, filtros).sort((a, b) =>
    a.identificacion.nombre.localeCompare(b.identificacion.nombre, 'es'),
  );

  return (
    <div className="pila">
      <div className="titulo">
        <h1>Pacientes</h1>
        <span className="tenue">
          {lista.length} de {db.pacientes.length}
        </span>
      </div>

      <form className="tarjeta nuevo-paciente" onSubmit={crear}>
        <input
          placeholder="Nombre del nuevo paciente"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          aria-label="Nombre del nuevo paciente"
        />
        <select value={centroNuevo} onChange={(e) => setCentroNuevo(e.target.value)} aria-label="Centro">
          <option value="">{db.centros.some((c) => !c.archivado) ? 'Centro…' : 'Sin centros (créalos en Centros)'}</option>
          <OpcionesCentros centros={db.centros} />
        </select>
        <button className="boton boton--primario" type="submit" disabled={!nombreNuevo.trim()}>
          + Nuevo paciente
        </button>
      </form>

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar por nombre, RUT, diagnóstico…"
          value={filtros.texto}
          onChange={(e) => fijarFiltro('q', e.target.value)}
          aria-label="Buscar"
        />
        <select value={filtros.centroId} onChange={(e) => fijarFiltro('centro', e.target.value)} aria-label="Filtrar por centro">
          <option value="">Todos los centros</option>
          <OpcionesCentros centros={db.centros} conArchivados />
          <option value="ninguno">Sin centro</option>
        </select>
        <select value={filtros.estado} onChange={(e) => fijarFiltro('estado', e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {ESTADOS_PACIENTE.map((s) => (
            <option key={s} value={s}>
              {ETIQUETAS_ESTADO_PACIENTE[s]}
            </option>
          ))}
        </select>
      </div>
      {(etiquetas.length > 0 || hayFiltros) && (
        <div className="chips">
          {etiquetas.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${filtros.etiquetas.includes(t) ? 'chip--activo' : ''}`}
              aria-pressed={filtros.etiquetas.includes(t)}
              onClick={() => alternarEtiqueta(t)}
            >
              #{t}
              {filtros.etiquetas.includes(t) && <span aria-hidden> ×</span>}
            </button>
          ))}
          {hayFiltros && (
            <button type="button" className="enlace" onClick={limpiarFiltros}>
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {lista.length === 0 ? (
        <div className="vacio pila">
          {db.pacientes.length === 0 ? (
            <>
              <span>Aún no tienes pacientes. Crea el primero arriba.</span>
              <div>
                <button
                  className="boton"
                  onClick={async () => importar((await import('../domain/demo')).datosDeEjemplo())}
                >
                  Cargar pacientes de ejemplo
                </button>
              </div>
            </>
          ) : (
            <>
              <span>Ningún paciente coincide con los filtros.</span>
              <div>
                <button className="boton" onClick={limpiarFiltros}>
                  Limpiar filtros
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <ul className="lista-pacientes">
          {lista.map((p) => {
            const r = resumenPaciente(p, db);
            const anos = edad(p.identificacion.fechaNacimiento);
            const centro = db.centros.find((c) => c.id === p.centroId);
            return (
              <li key={p.id} className="lista-pacientes__item">
                <button
                  type="button"
                  className="boton boton--icono boton--peligro lista-pacientes__eliminar"
                  title={`Eliminar a ${p.identificacion.nombre}`}
                  aria-label={`Eliminar a ${p.identificacion.nombre}`}
                  onClick={() => void eliminarConConfirmacion(p)}
                >
                  🗑
                </button>
                <Link to={`/pacientes/${p.id}`} className="tarjeta tarjeta-paciente">
                  <div className="tarjeta-paciente__cab">
                    <strong>{p.identificacion.nombre}</strong>
                    {anos != null && <span className="tenue">{anos} años</span>}
                    <span className="espaciador" />
                    <InsigniaCentro centro={centro} />
                    {p.estado !== 'activo' && <InsigniaEstadoPaciente estado={p.estado} />}
                  </div>
                  <div className="tenue tarjeta-paciente__dx">
                    {r.ultimaEvaluacion?.conclusion.diagnosticoKinesiologico ||
                      r.ingreso?.anamnesisProxima.diagnosticoMedico ||
                      'Sin diagnóstico registrado'}
                  </div>
                  <div className="tarjeta-paciente__pie">
                    <span>{r.realizadas} sesiones</span>
                    {r.ultimaSesion && <span>Última: {fechaLegible(r.ultimaSesion.fecha)}</span>}
                    {r.proximaSesion && <span className="destacado">Próxima: {fechaLegible(r.proximaSesion.fecha)}</span>}
                    {r.ultimaEva != null && <span>EVA {r.ultimaEva}</span>}
                    {p.etiquetas.map((t) => (
                      <span key={t} className="etiqueta-mini">
                        #{t}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
