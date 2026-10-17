import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { AreaTexto, CampoTexto, enlazarTexto, IndicadorGuardado, Seccion, Seleccion } from '../components/Campos';
import { EntradaEtiquetas } from '../components/EntradaEtiquetas';
import { GraficoEva } from '../components/GraficoEva';
import { InsigniaCentro, InsigniaEstadoPaciente, InsigniaEstadoSesion } from '../components/Insignias';
import { MapaDolor } from '../components/MapaDolor';
import { AplicarPrograma } from '../components/AplicarPrograma';
import { useDatos } from '../data/DatosContext';
import { useAutoguardado } from '../data/useAutoguardado';
import { edad, ETIQUETAS_ESTADO_PACIENTE, fechaLegible } from '../domain/clinica';
import { resumenPaciente, serieEva, sesionesDe, todasLasEtiquetas } from '../domain/consultas';
import { nuevaEvaluacion, nuevaSesion, nuevoId, nuevoIngreso } from '../domain/factories';
import { pacienteAMarkdown } from '../domain/markdown';
import { ESTADOS_PACIENTE, SEXOS, type Paciente } from '../domain/schema';
import { descargar, nombreArchivo } from '../domain/archivos';
import { codigoPaciente } from '../domain/anonimizar';

export function usePaciente(): Paciente | undefined {
  const { pid } = useParams();
  const { db } = useDatos();
  return db.pacientes.find((p) => p.id === pid);
}

/** Confirma y elimina un paciente con todos sus registros. Devuelve true si se eliminó. */
export function useEliminarPaciente() {
  const { db, eliminarPaciente } = useDatos();
  return async (p: Paciente): Promise<boolean> => {
    const cuenta = (xs: { pacienteId: string }[]) => xs.filter((x) => x.pacienteId === p.id).length;
    const detalle = [
      `${cuenta(db.sesiones)} sesiones`,
      `${cuenta(db.evaluaciones)} evaluaciones`,
      `${cuenta(db.ingresos)} ingresos`,
      `${cuenta(db.adjuntos)} adjuntos`,
    ].join(', ');
    const ok = confirm(
      `¿Eliminar a ${p.identificacion.nombre}?\n\nSe borrarán también sus registros (${detalle}). Esta acción no se puede deshacer.\n\nSi solo terminó el tratamiento, puedes cambiar su estado a "Alta" en Datos.`,
    );
    if (!ok) return false;
    await eliminarPaciente(p.id);
    return true;
  };
}

export function PacienteMarco() {
  const p = usePaciente();
  const { db } = useDatos();
  const navegar = useNavigate();
  const eliminarConConfirmacion = useEliminarPaciente();
  if (!p) return <p className="vacio">Paciente no encontrado. <Link to="/">Volver</Link></p>;
  const anos = edad(p.identificacion.fechaNacimiento);
  const centro = db.centros.find((c) => c.id === p.centroId);
  const n = db.adjuntos.filter((a) => a.pacienteId === p.id).length;
  const pestañas = [
    ['', 'Resumen'],
    ['datos', 'Datos'],
    ['ingresos', 'Ingreso'],
    ['evaluaciones', 'Evaluaciones'],
    ['sesiones', 'Sesiones'],
    ['adjuntos', `Adjuntos${n ? ` (${n})` : ''}`],
  ];
  return (
    <div className="pila">
      <div className="titulo">
        <Link to="/" className="enlace volver" aria-label="Volver a pacientes">
          ←
        </Link>
        <h1>{p.identificacion.nombre}</h1>
        {anos != null && <span className="tenue">{anos} años</span>}
        <InsigniaCentro centro={centro} />
        <InsigniaEstadoPaciente estado={p.estado} />
        <span className="espaciador" />
        <button
          className="boton boton--chico boton--peligro"
          onClick={async () => {
            if (await eliminarConConfirmacion(p)) navegar('/');
          }}
        >
          Eliminar paciente
        </button>
      </div>
      <nav className="pestanas">
        {pestañas.map(([ruta, nombre]) => (
          <NavLink key={ruta} to={`/pacientes/${p.id}${ruta ? `/${ruta}` : ''}`} end={!ruta}>
            {nombre}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

// ───────────────────────── Resumen ─────────────────────────

export function ResumenPaciente() {
  const p = usePaciente()!;
  const { db, guardar } = useDatos();
  const navegar = useNavigate();
  const r = resumenPaciente(p, db);
  const [copiado, setCopiado] = useState(false);
  const [anonimo, setAnonimo] = useState(true);
  const conclusion = r.ultimaEvaluacion?.conclusion;

  const copiarParaIA = async () => {
    await navigator.clipboard.writeText(pacienteAMarkdown(p, db, { anonimo }));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const planificar = async () => {
    const s = await guardar('sesiones', siguienteSesion(p.id, sesionesDe(p.id, db)));
    navegar(`/pacientes/${p.id}/sesiones/${s.id}`);
  };

  return (
    <div className="resumen">
      <div className="acciones acciones--izq">
        <button className="boton boton--primario" onClick={planificar}>
          + Planificar sesión
        </button>
        <button className="boton" onClick={copiarParaIA}>
          {copiado ? '¡Copiado!' : 'Copiar ficha para IA'}
        </button>
        <button
          className="boton"
          onClick={() =>
            descargar(
              `${anonimo ? codigoPaciente(p.id) : nombreArchivo(p.identificacion.nombre)}.md`,
              pacienteAMarkdown(p, db, { anonimo }),
              'text/markdown',
            )
          }
        >
          Descargar .md
        </button>
        <Link className="boton" to={`/pacientes/${p.id}/imprimir`}>
          Imprimir / PDF
        </Link>
        <label className="casilla" title="Quita nombre, RUT, contacto y fecha de nacimiento">
          <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} /> Anonimizada
        </label>
      </div>

      <div className="resumen__rejilla">
        <section className="tarjeta">
          <h3>Diagnóstico y plan</h3>
          <dl className="definiciones">
            <dt>Diagnóstico médico</dt>
            <dd>{r.ingreso?.anamnesisProxima.diagnosticoMedico || '—'}</dd>
            <dt>Diagnóstico kinesiológico</dt>
            <dd>{conclusion?.diagnosticoKinesiologico || '—'}</dd>
            <dt>Objetivos</dt>
            <dd className="pre">{[conclusion?.objetivosGenerales, conclusion?.objetivosEspecificos].filter(Boolean).join('\n') || '—'}</dd>
            <dt>Plan</dt>
            <dd className="pre">{conclusion?.planTratamiento || '—'}</dd>
          </dl>
          {!r.ingreso && (
            <p className="tenue">
              Sin ingreso aún. <Link to="../ingresos">Crear ingreso</Link>
            </p>
          )}
        </section>

        <section className="tarjeta">
          <h3>Seguimiento</h3>
          <dl className="definiciones">
            <dt>Sesiones realizadas</dt>
            <dd>{r.realizadas}</dd>
            <dt>Última sesión</dt>
            <dd>
              {r.ultimaSesion ? (
                <Link to={`sesiones/${r.ultimaSesion.id}`}>
                  #{r.ultimaSesion.numero} · {fechaLegible(r.ultimaSesion.fecha)}
                </Link>
              ) : (
                '—'
              )}
            </dd>
            <dt>Próxima sesión</dt>
            <dd>
              {r.proximaSesion ? (
                <Link to={`sesiones/${r.proximaSesion.id}`}>
                  #{r.proximaSesion.numero} · {fechaLegible(r.proximaSesion.fecha)} {r.proximaSesion.hora}
                </Link>
              ) : (
                '—'
              )}
            </dd>
            <dt>Indicaciones vigentes</dt>
            <dd className="pre">{r.ultimaSesion?.registro.plan || '—'}</dd>
            <dt>Etiquetas</dt>
            <dd>{p.etiquetas.length ? p.etiquetas.map((t) => `#${t}`).join(' ') : '—'}</dd>
          </dl>
        </section>
      </div>

      <section className="tarjeta">
        <h3>Evolución del dolor (EVA)</h3>
        <GraficoEva puntos={serieEva(p.id, db)} />
      </section>

      {r.ultimaEvaluacion && (
        <section className="tarjeta">
          <h3>
            Mapa del dolor ·{' '}
            <Link to={`evaluaciones/${r.ultimaEvaluacion.id}`}>
              {r.ultimaEvaluacion.clase === 'inicial' ? 'evaluación inicial' : 'reevaluación'} del{' '}
              {fechaLegible(r.ultimaEvaluacion.fecha)}
            </Link>
          </h3>
          <MapaDolor marcas={r.ultimaEvaluacion.dolor.mapa} />
        </section>
      )}
    </div>
  );
}

// ───────────────────────── Datos del paciente ─────────────────────────

export function DatosPacientePage() {
  const p = usePaciente()!;
  return <FormDatosPaciente key={p.id} paciente={p} />;
}

function FormDatosPaciente({ paciente }: { paciente: Paciente }) {
  const { db } = useDatos();
  const navegar = useNavigate();
  const { borrador, fijar, estado, mensajeError, descartar } = useAutoguardado('pacientes', paciente);
  const t = enlazarTexto(borrador, fijar);
  const id = borrador.identificacion;
  const anos = edad(id.fechaNacimiento);

  const eliminarConConfirmacion = useEliminarPaciente();
  const eliminar = async () => {
    descartar();
    if (await eliminarConConfirmacion(paciente)) navegar('/');
  };

  return (
    <div className="pila">
      <div className="barra-form">
        <IndicadorGuardado estado={estado} error={mensajeError} />
      </div>
      <Seccion titulo="Identificación">
        <CampoTexto etiqueta="Nombre completo" {...t('identificacion.nombre')} />
        <CampoTexto etiqueta="RUT" ancho="tercio" {...t('identificacion.rut')} />
        <CampoTexto
          etiqueta={`Fecha de nacimiento${anos != null ? ` (${anos} años)` : ''}`}
          tipo="date"
          ancho="tercio"
          {...t('identificacion.fechaNacimiento')}
        />
        <Seleccion
          etiqueta="Sexo"
          ancho="tercio"
          valor={id.sexo}
          vacio="—"
          opciones={SEXOS.map((s) => [s, s[0].toUpperCase() + s.slice(1)] as const)}
          onCambio={(v) => fijar('identificacion.sexo', v)}
        />
        <CampoTexto etiqueta="Ocupación" ancho="tercio" {...t('identificacion.ocupacion')} />
        <CampoTexto etiqueta="Teléfono" tipo="tel" ancho="tercio" {...t('identificacion.telefono')} />
        <CampoTexto etiqueta="Email" tipo="email" ancho="tercio" {...t('identificacion.email')} />
      </Seccion>
      <Seccion titulo="Organización">
        <Seleccion
          etiqueta="Centro"
          ancho="medio"
          valor={borrador.centroId ?? ''}
          vacio="Sin centro"
          opciones={db.centros
            .filter((c) => !c.archivado || c.id === borrador.centroId)
            .map((c) => [c.id, c.archivado ? `${c.nombre} (archivado)` : c.nombre] as const)}
          onCambio={(v) => fijar('centroId', v || null)}
        />
        <Seleccion
          etiqueta="Estado"
          ancho="medio"
          valor={borrador.estado}
          opciones={ESTADOS_PACIENTE.map((s) => [s, ETIQUETAS_ESTADO_PACIENTE[s]] as const)}
          onCambio={(v) => fijar('estado', v)}
        />
        <EntradaEtiquetas etiquetas={borrador.etiquetas} sugerencias={todasLasEtiquetas(db)} onCambio={(v) => fijar('etiquetas', v)} />
        <AreaTexto etiqueta="Notas generales" placeholder="Horarios, preferencias, contacto de familiar…" {...t('notas')} />
      </Seccion>
      <div className="acciones">
        <button className="boton boton--peligro" onClick={eliminar}>
          Eliminar paciente
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Listas ─────────────────────────

export function ListaIngresos() {
  const p = usePaciente()!;
  const { db, guardar } = useDatos();
  const navegar = useNavigate();
  const ingresos = db.ingresos.filter((i) => i.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const crear = async () => {
    const i = await guardar('ingresos', nuevoIngreso(p.id));
    navegar(i.id);
  };
  return (
    <div className="pila">
      <div className="acciones acciones--izq">
        <button className="boton boton--primario" onClick={crear}>
          + Nuevo ingreso
        </button>
      </div>
      {ingresos.length === 0 && <p className="vacio">Sin ingresos. El ingreso registra la anamnesis próxima y remota.</p>}
      <ul className="lista-simple">
        {ingresos.map((i) => (
          <li key={i.id}>
            <Link to={i.id} className="tarjeta fila">
              <strong>Ingreso {fechaLegible(i.fecha)}</strong>
              <span className="tenue">{i.anamnesisProxima.diagnosticoMedico || i.anamnesisProxima.motivoConsulta || 'Sin diagnóstico'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ListaEvaluaciones() {
  const p = usePaciente()!;
  const { db, guardar } = useDatos();
  const navegar = useNavigate();
  const evals = db.evaluaciones.filter((e) => e.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const crear = async () => {
    const e = await guardar('evaluaciones', nuevaEvaluacion(p.id, evals.length ? 'reevaluacion' : 'inicial'));
    navegar(e.id);
  };
  return (
    <div className="pila">
      <div className="acciones acciones--izq">
        <button className="boton boton--primario" onClick={crear}>
          + {evals.length ? 'Nueva reevaluación' : 'Evaluación inicial'}
        </button>
      </div>
      {evals.length === 0 && <p className="vacio">Sin evaluaciones.</p>}
      <ul className="lista-simple">
        {evals.map((e) => (
          <li key={e.id}>
            <Link to={e.id} className="tarjeta fila">
              <strong>
                {e.clase === 'inicial' ? 'Evaluación inicial' : 'Reevaluación'} · {fechaLegible(e.fecha)}
              </strong>
              <span className="tenue">
                {e.dolor.alicia.intensidadEva != null && `EVA ${e.dolor.alicia.intensidadEva} · `}
                {e.dolor.mapa.length} marcas · {e.conclusion.diagnosticoKinesiologico || 'sin diagnóstico kinesiológico'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Crea la siguiente sesión copiando los ejercicios de la última (sin marcar como realizados). */
export function siguienteSesion(pacienteId: string, sesiones: ReturnType<typeof sesionesDe>) {
  const numero = sesiones.reduce((m, s) => Math.max(m, s.numero), 0) + 1;
  const s = nuevaSesion(pacienteId, numero);
  const ultima = sesiones.filter((x) => x.estado !== 'cancelada').at(-1);
  if (ultima) {
    s.planificacion.objetivos = ultima.planificacion.objetivos;
    s.planificacion.ejercicios = ultima.planificacion.ejercicios.map((e) => ({ ...e, id: nuevoId(), realizado: false }));
  }
  return s;
}

export function ListaSesiones() {
  const p = usePaciente()!;
  const { db, guardar } = useDatos();
  const navegar = useNavigate();
  const sesiones = sesionesDe(p.id, db);
  const [aplicando, setAplicando] = useState(false);
  const [aviso, setAviso] = useState('');
  const crear = async () => {
    const s = await guardar('sesiones', siguienteSesion(p.id, sesiones));
    navegar(s.id);
  };
  return (
    <div className="pila">
      <div className="acciones acciones--izq">
        <button className="boton boton--primario" onClick={crear}>
          + Planificar sesión {sesiones.length ? '(copia el plan anterior)' : ''}
        </button>
        <button className="boton" onClick={() => setAplicando(true)}>
          Aplicar programa de tratamiento
        </button>
      </div>
      {aviso && <p className="aviso aviso--ok">{aviso}</p>}
      <AplicarPrograma
        pacienteId={p.id}
        abierto={aplicando}
        onCerrar={() => setAplicando(false)}
        onAplicado={(n) => setAviso(`Se crearon ${n} sesiones planificadas. Aparecen también en la Agenda.`)}
      />
      {sesiones.length === 0 && <p className="vacio">Sin sesiones.</p>}
      <ol className="linea-tiempo">
        {[...sesiones].reverse().map((s) => (
          <li key={s.id}>
            <Link to={s.id} className="tarjeta fila">
              <strong>
                Sesión {s.numero} · {fechaLegible(s.fecha)} {s.hora}
              </strong>
              <InsigniaEstadoSesion estado={s.estado} />
              {s.programa && (
                <span className="insignia" title={s.programa.nombre}>
                  {s.programa.nombre.split(' · ')[0]} {s.programa.numero}/{s.programa.total}
                </span>
              )}
              {(s.registro.evaPre != null || s.registro.evaPost != null) && (
                <span className="tenue">
                  EVA {s.registro.evaPre ?? '?'} → {s.registro.evaPost ?? '?'}
                </span>
              )}
              <span className="tenue fila__texto">{s.registro.analisis || s.planificacion.objetivos}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
