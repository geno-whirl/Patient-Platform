import { useMemo, useState } from 'react';
import { useDatos } from '../data/DatosContext';
import { fechaLegible, sinTildes } from '../domain/clinica';
import type { EjercicioSesion } from '../domain/schema';
import { Modal } from './Modal';

export interface PlanCopiado {
  origen: string;
  objetivos: string;
  notas: string;
  ejercicios: EjercicioSesion[];
}

/**
 * Elegir una plantilla o una sesión anterior (de cualquier paciente) para copiar su
 * planificación. `modo` indica si reemplaza los ejercicios actuales o se agregan al final.
 */
export function SelectorPlan({
  abierto,
  onCerrar,
  onElegir,
  excluirSesionId,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onElegir: (plan: PlanCopiado, modo: 'reemplazar' | 'agregar') => void;
  excluirSesionId?: string;
}) {
  const { db } = useDatos();
  const [pestana, setPestana] = useState<'plantillas' | 'sesiones'>('plantillas');
  const [texto, setTexto] = useState('');
  const [modo, setModo] = useState<'reemplazar' | 'agregar'>('reemplazar');
  const q = sinTildes(texto.trim());
  const pacientes = useMemo(() => new Map(db.pacientes.map((p) => [p.id, p.identificacion.nombre])), [db.pacientes]);

  const plantillas = db.plantillas
    .filter((p) => !q || sinTildes(`${p.nombre} ${p.descripcion} ${p.etiquetas.join(' ')}`).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const sesiones = db.sesiones
    .filter((s) => s.id !== excluirSesionId && s.planificacion.ejercicios.length > 0)
    .filter((s) => !q || sinTildes(`${pacientes.get(s.pacienteId) ?? ''} ${s.planificacion.objetivos}`).includes(q))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 80);

  const elegir = (plan: PlanCopiado) => {
    onElegir(plan, modo);
    setTexto('');
    onCerrar();
  };

  return (
    <Modal titulo="Copiar planificación" abierto={abierto} onCerrar={onCerrar}>
      <div className="pila pila--compacta">
        <div className="segmentado" role="tablist">
          <button role="tab" aria-selected={pestana === 'plantillas'} className={pestana === 'plantillas' ? 'activo' : ''} onClick={() => setPestana('plantillas')}>
            Plantillas ({db.plantillas.length})
          </button>
          <button role="tab" aria-selected={pestana === 'sesiones'} className={pestana === 'sesiones' ? 'activo' : ''} onClick={() => setPestana('sesiones')}>
            Otra sesión
          </button>
        </div>
        <div className="filtros">
          <input
            type="search"
            placeholder={pestana === 'plantillas' ? 'Buscar plantilla…' : 'Buscar por paciente u objetivos…'}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar"
          />
          <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)} aria-label="Cómo copiar">
            <option value="reemplazar">Reemplazar ejercicios actuales</option>
            <option value="agregar">Agregar al final</option>
          </select>
        </div>
        <ul className="selector-ejercicios">
          {pestana === 'plantillas' &&
            (plantillas.length ? (
              plantillas.map((p) => (
                <li key={p.id}>
                  <div className="selector-ejercicios__info">
                    <strong>{p.nombre}</strong>
                    <span className="tenue">{p.ejercicios.length} ejercicios</span>
                    {p.descripcion && <small className="tenue">{p.descripcion}</small>}
                  </div>
                  <button
                    type="button"
                    className="boton boton--chico boton--primario"
                    onClick={() => elegir({ origen: `plantilla "${p.nombre}"`, objetivos: p.objetivos, notas: p.notas, ejercicios: p.ejercicios })}
                  >
                    Usar
                  </button>
                </li>
              ))
            ) : (
              <li className="tenue">Sin plantillas. Crea una con “Guardar como plantilla” en una sesión o en Ejercicios → Plantillas.</li>
            ))}
          {pestana === 'sesiones' &&
            (sesiones.length ? (
              sesiones.map((s) => (
                <li key={s.id}>
                  <div className="selector-ejercicios__info">
                    <strong>
                      {pacientes.get(s.pacienteId)} · Sesión {s.numero}
                    </strong>
                    <span className="tenue">
                      {fechaLegible(s.fecha)} · {s.planificacion.ejercicios.length} ejercicios
                    </span>
                    {s.planificacion.objetivos && <small className="tenue">{s.planificacion.objetivos}</small>}
                  </div>
                  <button
                    type="button"
                    className="boton boton--chico boton--primario"
                    onClick={() =>
                      elegir({
                        origen: `sesión ${s.numero} de ${pacientes.get(s.pacienteId)}`,
                        objetivos: s.planificacion.objetivos,
                        notas: s.planificacion.notas,
                        ejercicios: s.planificacion.ejercicios,
                      })
                    }
                  >
                    Copiar
                  </button>
                </li>
              ))
            ) : (
              <li className="tenue">No hay otras sesiones con ejercicios.</li>
            ))}
        </ul>
      </div>
    </Modal>
  );
}
