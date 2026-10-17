import { useState } from 'react';
import { useDatos } from '../data/DatosContext';
import { nuevoId } from '../domain/factories';
import type { EjercicioSesion } from '../domain/schema';
import { SelectorEjercicios } from './SelectorEjercicios';

export const ejercicioVacio = (): EjercicioSesion => ({
  id: nuevoId(),
  ejercicioId: null,
  nombre: '',
  series: '',
  repeticiones: '',
  carga: '',
  descanso: '',
  notas: '',
  realizado: false,
});

/**
 * Lista editable de ejercicios con series, repeticiones, carga, descanso y notas.
 * `conRealizado` muestra la casilla "realizado" (sesiones); en plantillas y programas no aplica.
 */
export function EditorEjercicios({
  ejercicios,
  onCambio,
  conRealizado = false,
}: {
  ejercicios: EjercicioSesion[];
  onCambio: (e: EjercicioSesion[]) => void;
  conRealizado?: boolean;
}) {
  const { db } = useDatos();
  const [selector, setSelector] = useState(false);
  const enBiblioteca = new Set(db.ejercicios.map((e) => e.id));
  const editar = (id: string, cambios: Partial<EjercicioSesion>) =>
    onCambio(ejercicios.map((e) => (e.id === id ? { ...e, ...cambios } : e)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ejercicios.length) return;
    const copia = [...ejercicios];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    onCambio(copia);
  };

  return (
    <div className="ejercicios">
      {ejercicios.length > 0 && (
        <div className={`ejercicio ejercicio--cab ${conRealizado ? '' : 'ejercicio--sin-check'}`} aria-hidden>
          {conRealizado && <span title="Realizado">✓</span>}
          <span>Ejercicio</span>
          <span>Series</span>
          <span>Reps / tiempo</span>
          <span>Carga</span>
          <span>Descanso</span>
          <span>Notas</span>
          <span />
        </div>
      )}
      {ejercicios.map((e, i) => (
        <div key={e.id} className={`ejercicio ${conRealizado ? '' : 'ejercicio--sin-check'} ${e.realizado ? 'ejercicio--hecho' : ''}`}>
          {conRealizado && (
            <label className="ejercicio__check" title="Realizado">
              <input type="checkbox" checked={e.realizado} onChange={(ev) => editar(e.id, { realizado: ev.target.checked })} aria-label={`Realizado: ${e.nombre}`} />
            </label>
          )}
          <div className="ejercicio__nombre-celda">
            <input
              className="ejercicio__nombre"
              placeholder="Ejercicio / intervención"
              value={e.nombre}
              onChange={(ev) => editar(e.id, { nombre: ev.target.value })}
              aria-label="Ejercicio"
            />
            {e.ejercicioId && enBiblioteca.has(e.ejercicioId) && (
              <span className="ejercicio__origen" title="Proviene de la biblioteca">
                📚
              </span>
            )}
          </div>
          <input placeholder="Series" value={e.series} onChange={(ev) => editar(e.id, { series: ev.target.value })} aria-label="Series" />
          <input placeholder="Reps" value={e.repeticiones} onChange={(ev) => editar(e.id, { repeticiones: ev.target.value })} aria-label="Repeticiones o tiempo" />
          <input placeholder="Carga" value={e.carga} onChange={(ev) => editar(e.id, { carga: ev.target.value })} aria-label="Carga" />
          <input placeholder="Descanso" value={e.descanso} onChange={(ev) => editar(e.id, { descanso: ev.target.value })} aria-label="Descanso" />
          <input className="ejercicio__notas" placeholder="Notas / progresión" value={e.notas} onChange={(ev) => editar(e.id, { notas: ev.target.value })} aria-label="Notas" />
          <div className="ejercicio__acciones">
            <button type="button" className="boton boton--icono" onClick={() => mover(i, -1)} aria-label="Subir" disabled={i === 0}>
              ↑
            </button>
            <button type="button" className="boton boton--icono" onClick={() => mover(i, 1)} aria-label="Bajar" disabled={i === ejercicios.length - 1}>
              ↓
            </button>
            <button
              type="button"
              className="boton boton--icono"
              aria-label="Duplicar"
              title="Duplicar"
              onClick={() => onCambio([...ejercicios.slice(0, i + 1), { ...e, id: nuevoId(), realizado: false }, ...ejercicios.slice(i + 1)])}
            >
              ⧉
            </button>
            <button type="button" className="boton boton--icono boton--peligro" onClick={() => onCambio(ejercicios.filter((x) => x.id !== e.id))} aria-label="Quitar">
              ×
            </button>
          </div>
        </div>
      ))}
      <div className="acciones acciones--izq">
        <button type="button" className="boton boton--chico boton--primario" onClick={() => setSelector(true)}>
          + Desde biblioteca
        </button>
        <button type="button" className="boton boton--chico" onClick={() => onCambio([...ejercicios, ejercicioVacio()])}>
          + Ejercicio libre
        </button>
      </div>
      <SelectorEjercicios abierto={selector} onCerrar={() => setSelector(false)} onAgregar={(nuevos) => onCambio([...ejercicios, ...nuevos])} />
    </div>
  );
}
