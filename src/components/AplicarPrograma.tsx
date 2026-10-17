import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatos } from '../data/DatosContext';
import { fechaLegible } from '../domain/clinica';
import { sesionesDe } from '../domain/consultas';
import { hoy } from '../domain/factories';
import { aplicarPrograma, diasSugeridos, fechasDeSesiones } from '../domain/programas';
import { Modal } from './Modal';

const DIAS = [
  [1, 'Lun'],
  [2, 'Mar'],
  [3, 'Mié'],
  [4, 'Jue'],
  [5, 'Vie'],
  [6, 'Sáb'],
  [0, 'Dom'],
] as const;

/** Elige un programa de tratamiento y crea todas sus sesiones planificadas para el paciente. */
export function AplicarPrograma({ pacienteId, abierto, onCerrar, onAplicado }: { pacienteId: string; abierto: boolean; onCerrar: () => void; onAplicado: (n: number) => void }) {
  const { db, guardarVarios } = useDatos();
  const programas = [...db.programas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const [programaId, setProgramaId] = useState('');
  const programa = programas.find((p) => p.id === programaId);
  const [inicio, setInicio] = useState(hoy());
  const [dias, setDias] = useState<number[]>([1, 4]);
  const [hora, setHora] = useState('');
  const [guardando, setGuardando] = useState(false);
  const fechas = programa ? fechasDeSesiones(inicio, dias, programa.sesiones.length) : [];

  const elegir = (id: string) => {
    setProgramaId(id);
    const p = programas.find((x) => x.id === id);
    if (p) setDias(diasSugeridos(p.sesionesPorSemana));
  };

  const aplicar = async () => {
    if (!programa || !dias.length) return;
    setGuardando(true);
    try {
      const nuevas = aplicarPrograma(programa, pacienteId, sesionesDe(pacienteId, db), { inicio, dias, hora });
      await guardarVarios('sesiones', nuevas);
      onAplicado(nuevas.length);
      setProgramaId('');
      onCerrar();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo="Aplicar programa de tratamiento"
      abierto={abierto}
      onCerrar={onCerrar}
      pie={
        <>
          <span className="tenue">{programa ? `Se crearán ${programa.sesiones.length} sesiones planificadas` : ''}</span>
          <span className="espaciador" />
          <button className="boton" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton boton--primario" onClick={aplicar} disabled={!programa || !dias.length || guardando}>
            {guardando ? 'Creando…' : 'Crear sesiones'}
          </button>
        </>
      }
    >
      {programas.length === 0 ? (
        <p className="vacio">
          No hay programas. <Link to="/ejercicios/programas">Crea uno en Ejercicios → Programas</Link>.
        </p>
      ) : (
        <div className="pila">
          <ul className="selector-ejercicios">
            {programas.map((p) => (
              <li key={p.id} className={p.id === programaId ? 'seleccionado' : ''}>
                <label className="selector-ejercicios__info selector-ejercicios__opcion">
                  <span>
                    <input type="radio" name="programa" checked={p.id === programaId} onChange={() => elegir(p.id)} /> <strong>{p.nombre}</strong>
                  </span>
                  <span className="tenue">
                    {p.sesiones.length} sesiones · {p.sesionesPorSemana} por semana
                  </span>
                  {p.descripcion && <small className="tenue">{p.descripcion}</small>}
                </label>
              </li>
            ))}
          </ul>
          {programa && (
            <>
              <div className="rejilla">
                <div className="campo campo--tercio">
                  <label htmlFor="inicio-programa">Desde</label>
                  <input id="inicio-programa" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>
                <div className="campo campo--tercio">
                  <label htmlFor="hora-programa">Hora (opcional)</label>
                  <input id="hora-programa" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
                </div>
                <div className="campo campo--completo" role="group" aria-label="Días de atención">
                  <span className="etiqueta">Días de atención</span>
                  <div className="chips">
                    {DIAS.map(([d, nombre]) => (
                      <button
                        key={d}
                        type="button"
                        className={`chip ${dias.includes(d) ? 'chip--activo' : ''}`}
                        aria-pressed={dias.includes(d)}
                        onClick={() => setDias(dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d])}
                      >
                        {nombre}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <ol className="vista-previa">
                {programa.sesiones.map((s, i) => (
                  <li key={s.id}>
                    <strong>{fechas[i] ? fechaLegible(fechas[i]) : '—'}</strong> · {s.titulo || `Sesión ${i + 1}`}
                    <span className="tenue"> · {s.ejercicios.length} ejercicios</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
