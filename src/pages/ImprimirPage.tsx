import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapaDolor } from '../components/MapaDolor';
import { useDatos } from '../data/DatosContext';
import { fechaLegible } from '../domain/clinica';
import { hoy } from '../domain/factories';
import { construirFicha, type Bloque, type RegistroFicha } from '../domain/ficha';
import type { Adjunto } from '../domain/schema';
import { useArchivoUrl } from './AdjuntosPage';
import { usePaciente } from './PacientePage';

interface Opciones {
  ingreso: boolean;
  evaluaciones: boolean;
  sesiones: 'ninguna' | 'realizadas' | 'todas';
  adjuntos: boolean;
  imagenes: boolean;
  anonimo: boolean;
}

/** Ficha clínica en formato documento, para imprimir o "Guardar como PDF" desde el navegador. */
export function ImprimirPage() {
  const p = usePaciente();
  const { db } = useDatos();
  const [o, setO] = useState<Opciones>({
    ingreso: true,
    evaluaciones: true,
    sesiones: 'realizadas',
    adjuntos: true,
    imagenes: true,
    anonimo: false,
  });
  if (!p) return <p className="vacio">Paciente no encontrado. <Link to="/">Volver</Link></p>;

  const f = construirFicha(p, db, { anonimo: o.anonimo, todasLasSesiones: o.sesiones === 'todas' });
  const centro = db.centros.find((c) => c.id === p.centroId);
  const casilla = (clave: 'ingreso' | 'evaluaciones' | 'adjuntos' | 'imagenes' | 'anonimo', texto: string) => (
    <label className="casilla">
      <input type="checkbox" checked={o[clave]} onChange={(e) => setO({ ...o, [clave]: e.target.checked })} /> {texto}
    </label>
  );

  return (
    <div className="pila">
      <div className="tarjeta no-imprimir opciones-impresion">
        <Link to={`/pacientes/${p.id}`} className="enlace">
          ← Volver a la ficha
        </Link>
        <div className="filtros">
          {casilla('ingreso', 'Ingreso')}
          {casilla('evaluaciones', 'Evaluaciones')}
          <select
            value={o.sesiones}
            onChange={(e) => setO({ ...o, sesiones: e.target.value as Opciones['sesiones'] })}
            aria-label="Sesiones a incluir"
          >
            <option value="realizadas">Sesiones realizadas</option>
            <option value="todas">Todas las sesiones</option>
            <option value="ninguna">Sin sesiones</option>
          </select>
          {casilla('adjuntos', 'Lista de adjuntos')}
          {casilla('imagenes', 'Imágenes')}
          {casilla('anonimo', 'Anonimizar')}
        </div>
        <button className="boton boton--primario" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
        <small className="tenue">Para PDF, elige “Guardar como PDF” como impresora.</small>
        {o.anonimo && o.imagenes && (
          <small className="aviso">Ojo: las fotos pueden identificar al paciente aunque la ficha esté anonimizada.</small>
        )}
      </div>

      <article className="hoja">
        <header className="hoja__cab">
          <div>
            <div className="hoja__tipo">Ficha kinesiológica{f.anonima ? ' (anonimizada)' : ''}</div>
            <h1>{f.titulo}</h1>
          </div>
          <div className="hoja__meta">
            {centro && !f.anonima && <div>{centro.nombre}</div>}
            <div>Emitida el {fechaLegible(hoy())}</div>
          </div>
        </header>

        <dl className="hoja__datos">
          {f.cabecera
            .filter(([k]) => k !== 'Id')
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>

        {o.ingreso && f.ingresos.map((r) => <Registro key={r.id} r={r} />)}
        {o.evaluaciones && f.evaluaciones.map((r) => <Registro key={r.id} r={r} />)}

        {o.sesiones !== 'ninguna' && f.sesiones.length > 0 && (
          <section className="hoja__seccion">
            <h2>Sesiones · {f.resumenSesiones}</h2>
            {f.sesiones.map((r) => (
              <Registro key={r.id} r={r} nivel={3} />
            ))}
          </section>
        )}

        {(o.adjuntos || o.imagenes) && f.adjuntos.length > 0 && (
          <section className="hoja__seccion">
            <h2>Adjuntos</h2>
            {o.adjuntos && (
              <ul>
                {f.adjuntos.map((a) => (
                  <li key={a.id}>
                    {fechaLegible(a.fecha)} · {a.categoria}
                    {a.descripcion && `: ${a.descripcion}`}
                    {!f.anonima && <span className="tenue"> ({a.nombreArchivo})</span>}
                  </li>
                ))}
              </ul>
            )}
            {o.imagenes && (
              <div className="hoja__imagenes">
                {/* Las rutas vienen de los registros originales: la ficha anónima no las conserva. */}
                {db.adjuntos
                  .filter((a) => a.pacienteId === p.id && a.tipoMime.startsWith('image/'))
                  .map((a) => (
                    <ImagenAdjunta key={a.id} adjunto={a} descripcion={f.adjuntos.find((x) => x.id === a.id)?.descripcion ?? ''} />
                  ))}
              </div>
            )}
          </section>
        )}

        <footer className="hoja__pie">
          Documento clínico confidencial · generado el {fechaLegible(hoy())}
          {f.anonima && ' · sin datos identificatorios'}
        </footer>
      </article>
    </div>
  );
}

function BloqueHoja({ b }: { b: Bloque }) {
  return (
    <div className="hoja__bloque">
      {b.titulo && <h4>{b.titulo}</h4>}
      {b.campos && b.campos.length > 0 && (
        <dl>
          {b.campos.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {b.items && b.items.length > 0 && (
        <ul>
          {b.items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Registro({ r, nivel = 2 }: { r: RegistroFicha; nivel?: 2 | 3 }) {
  const Titulo = nivel === 2 ? 'h2' : 'h3';
  // El mapa se dibuja (con su propia lista), así que se omite el bloque de texto equivalente.
  const bloques = r.mapa?.length ? r.bloques.filter((b) => b.titulo !== 'Mapa del dolor') : r.bloques;
  return (
    <section className={nivel === 2 ? 'hoja__seccion' : 'hoja__sesion'}>
      <Titulo>{r.titulo}</Titulo>
      {r.mapa && r.mapa.length > 0 && (
        <div className="hoja__bloque hoja__mapa">
          <h4>Mapa del dolor</h4>
          <MapaDolor marcas={r.mapa} />
        </div>
      )}
      {bloques.map((b, i) => (
        <BloqueHoja key={i} b={b} />
      ))}
    </section>
  );
}

function ImagenAdjunta({ adjunto, descripcion }: { adjunto: Adjunto; descripcion: string }) {
  const { url } = useArchivoUrl(adjunto.ruta);
  return (
    <figure>
      {url ? <img src={url} alt={descripcion || adjunto.categoria} /> : <div className="hoja__cargando">Cargando…</div>}
      <figcaption>
        {fechaLegible(adjunto.fecha)}
        {descripcion && ` · ${descripcion}`}
      </figcaption>
    </figure>
  );
}
