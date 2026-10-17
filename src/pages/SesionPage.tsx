import { Link, useNavigate, useParams } from 'react-router-dom';
import { AreaTexto, CampoNumero, CampoTexto, enlazarTexto, Seccion, Seleccion, SelectorEva } from '../components/Campos';
import { useDatos } from '../data/DatosContext';
import { useAutoguardado } from '../data/useAutoguardado';
import { ETIQUETAS_ESTADO_SESION, fechaLegible } from '../domain/clinica';
import { sesionesDe } from '../domain/consultas';
import { nuevoId } from '../domain/factories';
import { ESTADOS_SESION, type Ejercicio, type Sesion } from '../domain/schema';
import { BarraFormulario } from './comun';

export function SesionPage() {
  const { id } = useParams();
  const { db } = useDatos();
  const s = db.sesiones.find((x) => x.id === id);
  if (!s) return <p className="vacio">Sesión no encontrada. <Link to="..">Volver</Link></p>;
  return <FormSesion key={s.id} sesion={s} />;
}

function FormSesion({ sesion }: { sesion: Sesion }) {
  const { db, eliminar } = useDatos();
  const navegar = useNavigate();
  const { borrador, fijar, estado, mensajeError, descartar } = useAutoguardado('sesiones', sesion);
  const t = enlazarTexto(borrador, fijar);
  const ejercicios = borrador.planificacion.ejercicios;
  const fijarEjercicios = (e: Ejercicio[]) => fijar('planificacion.ejercicios', e);
  const editarEjercicio = (eid: string, cambios: Partial<Ejercicio>) =>
    fijarEjercicios(ejercicios.map((e) => (e.id === eid ? { ...e, ...cambios } : e)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ejercicios.length) return;
    const copia = [...ejercicios];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    fijarEjercicios(copia);
  };

  const anteriores = sesionesDe(sesion.pacienteId, db).filter(
    (s) => s.id !== sesion.id && s.estado === 'realizada' && s.fecha <= borrador.fecha,
  );
  const anterior = anteriores.at(-1);

  return (
    <div className="pila formulario">
      <BarraFormulario
        titulo={`Sesión ${borrador.numero}`}
        estado={estado}
        error={mensajeError}
        onEliminar={async () => {
          descartar();
          await eliminar('sesiones', sesion.id);
          navegar('..', { relative: 'path' });
        }}
      />
      <div className="rejilla">
        <CampoTexto etiqueta="Fecha" tipo="date" ancho="cuarto" {...t('fecha')} />
        <CampoTexto etiqueta="Hora" tipo="time" ancho="cuarto" {...t('hora')} />
        <CampoNumero etiqueta="N° de sesión" ancho="cuarto" min={1} paso={1} valor={borrador.numero} onCambio={(v) => v && fijar('numero', Math.round(v))} />
        <Seleccion
          etiqueta="Estado"
          ancho="cuarto"
          valor={borrador.estado}
          opciones={ESTADOS_SESION.map((s) => [s, ETIQUETAS_ESTADO_SESION[s]] as const)}
          onCambio={(v) => fijar('estado', v)}
        />
      </div>

      {anterior && (
        <aside className="aviso">
          <strong>
            Sesión anterior (#{anterior.numero}, {fechaLegible(anterior.fecha)})
          </strong>
          {anterior.registro.evaPost != null && ` · EVA final ${anterior.registro.evaPost}`}
          {anterior.registro.analisis && <div>A: {anterior.registro.analisis}</div>}
          {anterior.registro.plan && <div>P: {anterior.registro.plan}</div>}
        </aside>
      )}

      <section className="seccion">
        <header className="seccion__cab">
          <h3>Planificación</h3>
        </header>
        <div className="rejilla">
          <AreaTexto etiqueta="Objetivos de la sesión" {...t('planificacion.objetivos')} />
        </div>
        <div className="ejercicios">
          {ejercicios.map((e, i) => (
            <div key={e.id} className={`ejercicio ${e.realizado ? 'ejercicio--hecho' : ''}`}>
              <label className="ejercicio__check" title="Realizado">
                <input type="checkbox" checked={e.realizado} onChange={(ev) => editarEjercicio(e.id, { realizado: ev.target.checked })} />
              </label>
              <input
                className="ejercicio__nombre"
                placeholder="Ejercicio / intervención"
                value={e.nombre}
                onChange={(ev) => editarEjercicio(e.id, { nombre: ev.target.value })}
                aria-label="Ejercicio"
              />
              <input placeholder="Series" value={e.series} onChange={(ev) => editarEjercicio(e.id, { series: ev.target.value })} aria-label="Series" />
              <input placeholder="Reps / tiempo" value={e.repeticiones} onChange={(ev) => editarEjercicio(e.id, { repeticiones: ev.target.value })} aria-label="Repeticiones" />
              <input placeholder="Carga" value={e.carga} onChange={(ev) => editarEjercicio(e.id, { carga: ev.target.value })} aria-label="Carga" />
              <input className="ejercicio__notas" placeholder="Notas / progresión" value={e.notas} onChange={(ev) => editarEjercicio(e.id, { notas: ev.target.value })} aria-label="Notas" />
              <div className="ejercicio__acciones">
                <button type="button" className="boton boton--icono" onClick={() => mover(i, -1)} aria-label="Subir" disabled={i === 0}>
                  ↑
                </button>
                <button type="button" className="boton boton--icono" onClick={() => mover(i, 1)} aria-label="Bajar" disabled={i === ejercicios.length - 1}>
                  ↓
                </button>
                <button
                  type="button"
                  className="boton boton--icono boton--peligro"
                  onClick={() => fijarEjercicios(ejercicios.filter((x) => x.id !== e.id))}
                  aria-label="Quitar"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="boton boton--chico"
            onClick={() =>
              fijarEjercicios([...ejercicios, { id: nuevoId(), nombre: '', series: '', repeticiones: '', carga: '', notas: '', realizado: false }])
            }
          >
            + Agregar ejercicio
          </button>
        </div>
        <div className="rejilla">
          <AreaTexto etiqueta="Notas de planificación" {...t('planificacion.notas')} />
        </div>
      </section>

      <Seccion
        titulo="Registro de la sesión (SOAP)"
        acciones={
          borrador.estado === 'planificada' && (
            <button type="button" className="boton boton--chico boton--primario" onClick={() => fijar('estado', 'realizada')}>
              Marcar como realizada
            </button>
          )
        }
      >
        <SelectorEva etiqueta="EVA al inicio" ancho="medio" valor={borrador.registro.evaPre} onCambio={(v) => fijar('registro.evaPre', v)} />
        <SelectorEva etiqueta="EVA al término" ancho="medio" valor={borrador.registro.evaPost} onCambio={(v) => fijar('registro.evaPost', v)} />
        <AreaTexto etiqueta="S — Subjetivo" placeholder="Cómo llega, qué reporta, adherencia a tareas…" {...t('registro.subjetivo')} />
        <AreaTexto etiqueta="O — Objetivo" placeholder="Hallazgos, mediciones, lo realizado…" {...t('registro.objetivo')} />
        <AreaTexto etiqueta="A — Análisis" placeholder="Respuesta al tratamiento, interpretación…" {...t('registro.analisis')} />
        <AreaTexto etiqueta="P — Plan" placeholder="Indicaciones, tareas para la casa, próxima sesión…" {...t('registro.plan')} />
      </Seccion>
    </div>
  );
}
