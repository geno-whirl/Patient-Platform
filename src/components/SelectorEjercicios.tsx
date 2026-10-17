import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatos } from '../data/DatosContext';
import { aEjercicioSesion } from '../domain/catalogoSesion';
import {
  dosisLegible,
  ETIQUETA_CATEGORIA,
  ETIQUETA_EQUIPAMIENTO,
  ETIQUETA_REGION,
  FILTRO_VACIO,
  filtrarEjercicios,
  type FiltroEjercicios,
} from '../domain/etiquetasEjercicio';
import { nuevoId } from '../domain/factories';
import { CATEGORIAS_EJERCICIO, EQUIPAMIENTOS, REGIONES_EJERCICIO, type EjercicioSesion } from '../domain/schema';
import { Modal } from './Modal';

const POR_PAGINA = 60;

/** Filtros de la biblioteca (búsqueda, categoría, región, equipamiento, favoritos). */
export function FiltrosEjercicios({
  filtro,
  onCambio,
  conArchivados = false,
}: {
  filtro: FiltroEjercicios;
  onCambio: (f: FiltroEjercicios) => void;
  conArchivados?: boolean;
}) {
  const fijar = <K extends keyof FiltroEjercicios>(k: K, v: FiltroEjercicios[K]) => onCambio({ ...filtro, [k]: v });
  return (
    <div className="pila pila--compacta">
      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar: sentadilla, banda, hombro, excéntrico…"
          value={filtro.texto}
          onChange={(e) => fijar('texto', e.target.value)}
          aria-label="Buscar ejercicio"
        />
        <select value={filtro.region} onChange={(e) => fijar('region', e.target.value as FiltroEjercicios['region'])} aria-label="Región">
          <option value="">Todas las regiones</option>
          {REGIONES_EJERCICIO.map((r) => (
            <option key={r} value={r}>
              {ETIQUETA_REGION[r]}
            </option>
          ))}
        </select>
        <select
          value={filtro.equipamiento}
          onChange={(e) => fijar('equipamiento', e.target.value as FiltroEjercicios['equipamiento'])}
          aria-label="Equipamiento"
        >
          <option value="">Todo el equipamiento</option>
          {EQUIPAMIENTOS.map((q) => (
            <option key={q} value={q}>
              {ETIQUETA_EQUIPAMIENTO[q]}
            </option>
          ))}
        </select>
        <label className="casilla">
          <input type="checkbox" checked={filtro.favoritos} onChange={(e) => fijar('favoritos', e.target.checked)} /> ★ Favoritos
        </label>
        {conArchivados && (
          <label className="casilla">
            <input type="checkbox" checked={filtro.archivados} onChange={(e) => fijar('archivados', e.target.checked)} /> Archivados
          </label>
        )}
      </div>
      <div className="chips">
        <button type="button" className={`chip ${!filtro.categoria ? 'chip--activo' : ''}`} onClick={() => fijar('categoria', '')}>
          Todas
        </button>
        {CATEGORIAS_EJERCICIO.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${filtro.categoria === c ? 'chip--activo' : ''}`}
            aria-pressed={filtro.categoria === c}
            onClick={() => fijar('categoria', filtro.categoria === c ? '' : c)}
          >
            {ETIQUETA_CATEGORIA[c]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Modal para elegir ejercicios de la biblioteca y agregarlos (con su dosis sugerida). */
export function SelectorEjercicios({
  abierto,
  onCerrar,
  onAgregar,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onAgregar: (e: EjercicioSesion[]) => void;
}) {
  const { db } = useDatos();
  const [filtro, setFiltro] = useState(FILTRO_VACIO);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [agregados, setAgregados] = useState<Record<string, number>>({});
  const lista = useMemo(() => filtrarEjercicios(db.ejercicios, filtro), [db.ejercicios, filtro]);
  const total = Object.values(agregados).reduce((a, b) => a + b, 0);

  const cerrar = () => {
    setAgregados({});
    onCerrar();
  };

  return (
    <Modal
      titulo="Agregar desde la biblioteca"
      abierto={abierto}
      onCerrar={cerrar}
      pie={
        <>
          <span className="tenue">{total ? `${total} agregado(s)` : `${lista.length} ejercicios`}</span>
          <span className="espaciador" />
          <button type="button" className="boton boton--primario" onClick={cerrar}>
            Listo
          </button>
        </>
      }
    >
      <FiltrosEjercicios
        filtro={filtro}
        onCambio={(f) => {
          setFiltro(f);
          setLimite(POR_PAGINA);
        }}
      />
      {db.ejercicios.length === 0 ? (
        <p className="vacio">
          La biblioteca está vacía. <Link to="/ejercicios">Ir a la biblioteca</Link>
        </p>
      ) : lista.length === 0 ? (
        <p className="vacio">Ningún ejercicio coincide con la búsqueda.</p>
      ) : (
        <ul className="selector-ejercicios">
          {lista.slice(0, limite).map((e) => (
            <li key={e.id}>
              <div className="selector-ejercicios__info">
                <strong>
                  {e.favorito && '★ '}
                  {e.nombre}
                </strong>
                <span className="tenue">
                  {ETIQUETA_CATEGORIA[e.categoria]} · {dosisLegible(e) || 'sin dosis'}
                  {e.equipamiento.length > 0 && ` · ${e.equipamiento.map((q) => ETIQUETA_EQUIPAMIENTO[q]).join(', ')}`}
                </span>
                {e.descripcion && <small className="tenue">{e.descripcion}</small>}
              </div>
              <button
                type="button"
                className={`boton boton--chico ${agregados[e.id] ? '' : 'boton--primario'}`}
                onClick={() => {
                  onAgregar([aEjercicioSesion(e, nuevoId())]);
                  setAgregados((a) => ({ ...a, [e.id]: (a[e.id] ?? 0) + 1 }));
                }}
              >
                {agregados[e.id] ? `✓ Agregado${agregados[e.id] > 1 ? ` ×${agregados[e.id]}` : ''}` : 'Agregar'}
              </button>
            </li>
          ))}
          {lista.length > limite && (
            <li>
              <button type="button" className="boton boton--ancho" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                Mostrar más ({lista.length - limite})
              </button>
            </li>
          )}
        </ul>
      )}
    </Modal>
  );
}
