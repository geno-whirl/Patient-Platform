import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AreaTexto, CampoNumero, CampoTexto, enlazarTexto, Seccion, Seleccion, SelectorEva } from '../components/Campos';
import { EditorEjercicios } from '../components/EditorEjercicios';
import { SelectorPlan, type PlanCopiado } from '../components/SelectorPlan';
import { useDatos } from '../data/DatosContext';
import { useAutoguardado } from '../data/useAutoguardado';
import { ETIQUETAS_ESTADO_SESION, fechaLegible } from '../domain/clinica';
import { sesionesDe } from '../domain/consultas';
import { nuevaPlantilla, nuevoId } from '../domain/factories';
import { ESTADOS_SESION, type Sesion } from '../domain/schema';
import { BarraFormulario } from './comun';

export function SesionPage() {
  const { id } = useParams();
  const { db } = useDatos();
  const s = db.sesiones.find((x) => x.id === id);
  if (!s) return <p className="vacio">Sesión no encontrada. <Link to="..">Volver</Link></p>;
  return <FormSesion key={s.id} sesion={s} />;
}

function FormSesion({ sesion }: { sesion: Sesion }) {
  const { db, eliminar, guardar } = useDatos();
  const navegar = useNavigate();
  const { borrador, fijar, actualizar, estado, mensajeError, descartar } = useAutoguardado('sesiones', sesion);
  const t = enlazarTexto(borrador, fijar);
  const ejercicios = borrador.planificacion.ejercicios;
  const [selectorPlan, setSelectorPlan] = useState(false);
  const [aviso, setAviso] = useState('');

  const copiarPlan = (plan: PlanCopiado, modo: 'reemplazar' | 'agregar') => {
    const copiados = plan.ejercicios.map((e) => ({ ...e, id: nuevoId(), realizado: false }));
    actualizar((d) => ({
      ...d,
      planificacion: {
        objetivos: modo === 'reemplazar' || !d.planificacion.objetivos ? plan.objetivos : d.planificacion.objetivos,
        notas: modo === 'reemplazar' || !d.planificacion.notas ? plan.notas : d.planificacion.notas,
        ejercicios: modo === 'reemplazar' ? copiados : [...d.planificacion.ejercicios, ...copiados],
      },
    }));
    setAviso(`Se copiaron ${copiados.length} ejercicios desde ${plan.origen}.`);
  };

  const guardarComoPlantilla = async () => {
    const nombre = prompt('Nombre de la plantilla', borrador.planificacion.objetivos.slice(0, 60) || `Sesión ${borrador.numero}`);
    if (!nombre?.trim()) return;
    const p = nuevaPlantilla(nombre.trim());
    p.objetivos = borrador.planificacion.objetivos;
    p.notas = borrador.planificacion.notas;
    p.ejercicios = ejercicios.map((e) => ({ ...e, id: nuevoId(), realizado: false }));
    await guardar('plantillas', p);
    setAviso(`Plantilla "${p.nombre}" guardada. Puedes editarla en Ejercicios → Plantillas.`);
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
          <div className="acciones">
            <button type="button" className="boton boton--chico" onClick={() => setSelectorPlan(true)}>
              Usar plantilla / copiar sesión
            </button>
            <button type="button" className="boton boton--chico" onClick={guardarComoPlantilla} disabled={!ejercicios.length}>
              Guardar como plantilla
            </button>
          </div>
        </header>
        {borrador.programa && (
          <p className="tenue">
            Programa: <strong>{borrador.programa.nombre}</strong> · sesión {borrador.programa.numero} de {borrador.programa.total}
          </p>
        )}
        <div className="rejilla">
          <AreaTexto etiqueta="Objetivos de la sesión" {...t('planificacion.objetivos')} />
        </div>
        {aviso && <p className="aviso aviso--ok">{aviso}</p>}
        <EditorEjercicios ejercicios={ejercicios} onCambio={(e) => fijar('planificacion.ejercicios', e)} conRealizado />
        <div className="rejilla">
          <AreaTexto etiqueta="Notas de planificación" {...t('planificacion.notas')} />
        </div>
      </section>

      <SelectorPlan abierto={selectorPlan} onCerrar={() => setSelectorPlan(false)} onElegir={copiarPlan} excluirSesionId={sesion.id} />

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
