import { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { AreaTexto, CampoNumero, CampoTexto, IndicadorGuardado, Seleccion } from '../components/Campos';
import { EditorEjercicios } from '../components/EditorEjercicios';
import { EntradaEtiquetas } from '../components/EntradaEtiquetas';
import { FiltrosEjercicios } from '../components/SelectorEjercicios';
import { SelectorPlan } from '../components/SelectorPlan';
import { useDatos } from '../data/DatosContext';
import { useAutoguardado } from '../data/useAutoguardado';
import {
  dosisLegible,
  ETIQUETA_CATEGORIA,
  ETIQUETA_EQUIPAMIENTO,
  ETIQUETA_REGION,
  FILTRO_VACIO,
  filtrarEjercicios,
} from '../domain/etiquetasEjercicio';
import { nuevaPlantilla, nuevoEjercicioBiblioteca, nuevoId, nuevoPrograma } from '../domain/factories';
import {
  CATEGORIAS_EJERCICIO,
  EQUIPAMIENTOS,
  REGIONES_EJERCICIO,
  type EjercicioBiblioteca,
  type PlantillaSesion,
  type ProgramaTratamiento,
  type SesionPrograma,
} from '../domain/schema';

export function BibliotecaMarco() {
  const { db } = useDatos();
  return (
    <div className="pila">
      <div className="titulo">
        <h1>Ejercicios</h1>
      </div>
      <nav className="pestanas">
        <NavLink to="/ejercicios" end>
          Biblioteca ({db.ejercicios.filter((e) => !e.archivado).length})
        </NavLink>
        <NavLink to="/ejercicios/plantillas">Plantillas de sesión ({db.plantillas.length})</NavLink>
        <NavLink to="/ejercicios/programas">Programas de tratamiento ({db.programas.length})</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

// ───────────────────────── Biblioteca ─────────────────────────

export function ListaBiblioteca() {
  const { db, guardar, cargarCatalogo } = useDatos();
  const [filtro, setFiltro] = useState(FILTRO_VACIO);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [limite, setLimite] = useState(80);
  const lista = useMemo(() => filtrarEjercicios(db.ejercicios, filtro), [db.ejercicios, filtro]);

  const crear = async () => {
    const e = await guardar('ejercicios', nuevoEjercicioBiblioteca(filtro.texto.trim() || 'Nuevo ejercicio'));
    setFiltro(FILTRO_VACIO);
    setAbierto(e.id);
  };

  const restaurar = async () => {
    const r = await cargarCatalogo();
    const total = r.ejercicios + r.plantillas + r.programas;
    setAviso(
      total
        ? `Se agregaron ${r.ejercicios} ejercicios, ${r.plantillas} plantillas y ${r.programas} programas del catálogo base.`
        : 'Ya tienes todo el catálogo base (los archivados se ven marcando “Archivados”).',
    );
  };

  return (
    <div className="pila">
      <div className="acciones acciones--izq">
        <button className="boton boton--primario" onClick={crear}>
          + Nuevo ejercicio
        </button>
        <button className="boton" onClick={restaurar}>
          Restaurar catálogo base
        </button>
        <span className="tenue">{lista.length} ejercicios</span>
      </div>
      {aviso && <p className="aviso aviso--ok">{aviso}</p>}
      <FiltrosEjercicios
        filtro={filtro}
        onCambio={(f) => {
          setFiltro(f);
          setLimite(80);
        }}
        conArchivados
      />
      {lista.length === 0 && <p className="vacio">Ningún ejercicio coincide con los filtros.</p>}
      <ul className="biblioteca">
        {lista.slice(0, limite).map((e) => (
          <li key={e.id} className={`tarjeta biblioteca__item ${abierto === e.id ? 'biblioteca__item--abierto' : ''}`}>
            <div className="biblioteca__fila">
              <button
                type="button"
                className={`estrella ${e.favorito ? 'estrella--activa' : ''}`}
                aria-label={e.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
                aria-pressed={e.favorito}
                onClick={() => guardar('ejercicios', { ...e, favorito: !e.favorito })}
              >
                {e.favorito ? '★' : '☆'}
              </button>
              <button type="button" className="biblioteca__resumen" onClick={() => setAbierto(abierto === e.id ? null : e.id)} aria-expanded={abierto === e.id}>
                <strong>{e.nombre}</strong>
                <span className={`insignia insignia--cat-${e.categoria}`}>{ETIQUETA_CATEGORIA[e.categoria]}</span>
                <span className="tenue">{dosisLegible(e)}</span>
                <span className="tenue biblioteca__equipo">{e.equipamiento.map((q) => ETIQUETA_EQUIPAMIENTO[q]).join(' · ')}</span>
              </button>
            </div>
            {abierto === e.id && <FichaEjercicio ejercicio={e} onCerrar={() => setAbierto(null)} />}
          </li>
        ))}
      </ul>
      {lista.length > limite && (
        <button className="boton" onClick={() => setLimite((l) => l + 80)}>
          Mostrar más ({lista.length - limite})
        </button>
      )}
    </div>
  );
}

function Chips<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  nombres,
}: {
  etiqueta: string;
  opciones: readonly T[];
  valor: T[];
  onCambio: (v: T[]) => void;
  nombres: Record<T, string>;
}) {
  return (
    <div className="campo campo--completo" role="group" aria-label={etiqueta}>
      <span className="etiqueta">{etiqueta}</span>
      <div className="chips">
        {opciones.map((o) => {
          const activo = valor.includes(o);
          return (
            <button
              key={o}
              type="button"
              className={`chip ${activo ? 'chip--activo' : ''}`}
              aria-pressed={activo}
              onClick={() => onCambio(activo ? valor.filter((x) => x !== o) : [...valor, o])}
            >
              {nombres[o]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FichaEjercicio({ ejercicio, onCerrar }: { ejercicio: EjercicioBiblioteca; onCerrar: () => void }) {
  const { db, guardar, eliminar } = useDatos();
  const { borrador, fijar, estado, mensajeError, descartar } = useAutoguardado('ejercicios', ejercicio);
  const etiquetas = useMemo(() => [...new Set(db.ejercicios.flatMap((e) => e.etiquetas))].sort(), [db.ejercicios]);
  const usos = db.sesiones.filter((s) => s.planificacion.ejercicios.some((x) => x.ejercicioId === ejercicio.id)).length;

  return (
    <div className="pila biblioteca__ficha">
      <div className="rejilla">
        <CampoTexto etiqueta="Nombre" ancho="medio" valor={borrador.nombre} onCambio={(v) => fijar('nombre', v)} />
        <Seleccion
          etiqueta="Categoría"
          ancho="medio"
          valor={borrador.categoria}
          opciones={CATEGORIAS_EJERCICIO.map((c) => [c, ETIQUETA_CATEGORIA[c]] as const)}
          onCambio={(v) => fijar('categoria', v)}
        />
        <CampoTexto etiqueta="Series" ancho="cuarto" valor={borrador.series} onCambio={(v) => fijar('series', v)} />
        <CampoTexto etiqueta="Reps / tiempo" ancho="cuarto" valor={borrador.repeticiones} onCambio={(v) => fijar('repeticiones', v)} />
        <CampoTexto etiqueta="Carga" ancho="cuarto" valor={borrador.carga} onCambio={(v) => fijar('carga', v)} />
        <CampoTexto etiqueta="Descanso" ancho="cuarto" valor={borrador.descanso} onCambio={(v) => fijar('descanso', v)} />
        <AreaTexto etiqueta="Ejecución y claves técnicas" valor={borrador.descripcion} onCambio={(v) => fijar('descripcion', v)} />
        <Chips etiqueta="Regiones" opciones={REGIONES_EJERCICIO} valor={borrador.regiones} onCambio={(v) => fijar('regiones', v)} nombres={ETIQUETA_REGION} />
        <Chips etiqueta="Equipamiento" opciones={EQUIPAMIENTOS} valor={borrador.equipamiento} onCambio={(v) => fijar('equipamiento', v)} nombres={ETIQUETA_EQUIPAMIENTO} />
        <EntradaEtiquetas
          etiquetas={borrador.etiquetas}
          sugerencias={etiquetas}
          onCambio={(v) => fijar('etiquetas', v)}
          ayuda="Ej: excéntrico, isométrico, unilateral, post-operatorio."
        />
      </div>
      <div className="acciones">
        <IndicadorGuardado estado={estado} error={mensajeError} />
        <span className="espaciador" />
        {usos > 0 && <span className="tenue">Usado en {usos} sesión(es)</span>}
        <button
          className="boton boton--chico"
          onClick={async () => {
            const copia = await guardar('ejercicios', { ...borrador, id: nuevoId(), nombre: `${borrador.nombre} (copia)`, predefinido: false, archivado: false });
            alert(`Creado "${copia.nombre}".`);
          }}
        >
          Duplicar
        </button>
        <button className="boton boton--chico" onClick={() => fijar('archivado', !borrador.archivado)}>
          {borrador.archivado ? 'Desarchivar' : 'Archivar'}
        </button>
        {!ejercicio.predefinido && (
          <button
            className="boton boton--chico boton--peligro"
            onClick={async () => {
              if (!confirm(`¿Eliminar "${ejercicio.nombre}" de la biblioteca? Las sesiones que lo usan no cambian.`)) return;
              descartar();
              await eliminar('ejercicios', ejercicio.id);
            }}
          >
            Eliminar
          </button>
        )}
        <button className="boton boton--chico" onClick={onCerrar}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ───────────────────────── Plantillas ─────────────────────────

export function ListaPlantillas() {
  const { db, guardar } = useDatos();
  const navegar = useNavigate();
  const plantillas = [...db.plantillas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return (
    <div className="pila">
      <p className="tenue">Sesiones tipo que se aplican desde cualquier sesión con “Usar plantilla / copiar sesión”.</p>
      <div className="acciones acciones--izq">
        <button
          className="boton boton--primario"
          onClick={async () => {
            const p = await guardar('plantillas', nuevaPlantilla('Nueva plantilla'));
            navegar(p.id);
          }}
        >
          + Nueva plantilla
        </button>
      </div>
      {plantillas.length === 0 && <p className="vacio">Sin plantillas.</p>}
      <ul className="lista-simple">
        {plantillas.map((p) => (
          <li key={p.id}>
            <Link to={p.id} className="tarjeta fila">
              <strong>{p.nombre}</strong>
              <span className="tenue">{p.ejercicios.length} ejercicios</span>
              <span className="tenue fila__texto">{p.descripcion || p.objetivos}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlantillaPage() {
  const { id } = useParams();
  const { db } = useDatos();
  const p = db.plantillas.find((x) => x.id === id);
  if (!p) return <p className="vacio">Plantilla no encontrada. <Link to="/ejercicios/plantillas">Volver</Link></p>;
  return <EditorPlantilla key={p.id} plantilla={p} />;
}

function EditorPlantilla({ plantilla }: { plantilla: PlantillaSesion }) {
  const { db, guardar, eliminar } = useDatos();
  const navegar = useNavigate();
  const { borrador, fijar, estado, mensajeError, descartar } = useAutoguardado('plantillas', plantilla);
  return (
    <div className="pila formulario">
      <div className="barra-form">
        <Link to="/ejercicios/plantillas" className="enlace">
          ← Plantillas
        </Link>
        <h2>{borrador.nombre}</h2>
        <span className="espaciador" />
        <IndicadorGuardado estado={estado} error={mensajeError} />
        <button
          className="boton boton--chico"
          onClick={async () => {
            const c = await guardar('plantillas', { ...borrador, id: nuevoId(), nombre: `${borrador.nombre} (copia)`, predefinido: false });
            navegar(`/ejercicios/plantillas/${c.id}`);
          }}
        >
          Duplicar
        </button>
        <button
          className="boton boton--chico boton--peligro"
          onClick={async () => {
            if (!confirm(`¿Eliminar la plantilla "${plantilla.nombre}"?`)) return;
            descartar();
            await eliminar('plantillas', plantilla.id);
            navegar('/ejercicios/plantillas');
          }}
        >
          Eliminar
        </button>
      </div>
      <section className="seccion">
        <div className="rejilla">
          <CampoTexto etiqueta="Nombre" valor={borrador.nombre} onCambio={(v) => fijar('nombre', v)} />
          <AreaTexto etiqueta="Descripción / indicaciones" valor={borrador.descripcion} onCambio={(v) => fijar('descripcion', v)} />
          <AreaTexto etiqueta="Objetivos de la sesión" valor={borrador.objetivos} onCambio={(v) => fijar('objetivos', v)} />
          <EntradaEtiquetas
            etiquetas={borrador.etiquetas}
            sugerencias={[...new Set(db.plantillas.flatMap((p) => p.etiquetas))]}
            onCambio={(v) => fijar('etiquetas', v)}
            ayuda="Ej: hombro, fase-1, deportista."
          />
        </div>
      </section>
      <section className="seccion">
        <header className="seccion__cab">
          <h3>Ejercicios</h3>
        </header>
        <EditorEjercicios ejercicios={borrador.ejercicios} onCambio={(e) => fijar('ejercicios', e)} />
        <div className="rejilla">
          <AreaTexto etiqueta="Notas de planificación" valor={borrador.notas} onCambio={(v) => fijar('notas', v)} />
        </div>
      </section>
    </div>
  );
}

// ───────────────────────── Programas ─────────────────────────

export function ListaProgramas() {
  const { db, guardar } = useDatos();
  const navegar = useNavigate();
  const programas = [...db.programas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return (
    <div className="pila">
      <p className="tenue">
        Secuencias de sesiones tipo (por ejemplo, 10 sesiones para manguito rotador). Se aplican a un paciente desde su pestaña
        Sesiones con “Aplicar programa”, que crea todas las sesiones planificadas con fecha.
      </p>
      <div className="acciones acciones--izq">
        <button
          className="boton boton--primario"
          onClick={async () => {
            const p = nuevoPrograma('Nuevo programa');
            p.sesiones = [{ id: nuevoId(), titulo: 'Sesión 1', objetivos: '', ejercicios: [], notas: '' }];
            navegar((await guardar('programas', p)).id);
          }}
        >
          + Nuevo programa
        </button>
      </div>
      {programas.length === 0 && <p className="vacio">Sin programas.</p>}
      <ul className="lista-simple">
        {programas.map((p) => (
          <li key={p.id}>
            <Link to={p.id} className="tarjeta fila">
              <strong>{p.nombre}</strong>
              <span className="tenue">
                {p.sesiones.length} sesiones · {p.sesionesPorSemana} por semana
              </span>
              <span className="tenue fila__texto">{p.descripcion}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgramaPage() {
  const { id } = useParams();
  const { db } = useDatos();
  const p = db.programas.find((x) => x.id === id);
  if (!p) return <p className="vacio">Programa no encontrado. <Link to="/ejercicios/programas">Volver</Link></p>;
  return <EditorPrograma key={p.id} programa={p} />;
}

function EditorPrograma({ programa }: { programa: ProgramaTratamiento }) {
  const { guardar, eliminar } = useDatos();
  const navegar = useNavigate();
  const { borrador, fijar, actualizar, estado, mensajeError, descartar } = useAutoguardado('programas', programa);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [copiarEn, setCopiarEn] = useState<string | null>(null);
  const sesiones = borrador.sesiones;

  const fijarSesiones = (fn: (s: SesionPrograma[]) => SesionPrograma[]) => actualizar((p) => ({ ...p, sesiones: fn(p.sesiones) }));
  const editarSesion = (id: string, cambios: Partial<SesionPrograma>) =>
    fijarSesiones((ss) => ss.map((s) => (s.id === id ? { ...s, ...cambios } : s)));
  const copiaDe = (s: SesionPrograma): SesionPrograma => ({
    ...s,
    id: nuevoId(),
    ejercicios: s.ejercicios.map((e) => ({ ...e, id: nuevoId() })),
  });
  const mover = (i: number, d: -1 | 1) =>
    fijarSesiones((ss) => {
      const j = i + d;
      if (j < 0 || j >= ss.length) return ss;
      const c = [...ss];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  return (
    <div className="pila formulario">
      <div className="barra-form">
        <Link to="/ejercicios/programas" className="enlace">
          ← Programas
        </Link>
        <h2>{borrador.nombre}</h2>
        <span className="espaciador" />
        <IndicadorGuardado estado={estado} error={mensajeError} />
        <button
          className="boton boton--chico"
          onClick={async () => {
            const c = await guardar('programas', {
              ...borrador,
              id: nuevoId(),
              nombre: `${borrador.nombre} (copia)`,
              predefinido: false,
              sesiones: borrador.sesiones.map(copiaDe),
            });
            navegar(`/ejercicios/programas/${c.id}`);
          }}
        >
          Duplicar
        </button>
        <button
          className="boton boton--chico boton--peligro"
          onClick={async () => {
            if (!confirm(`¿Eliminar el programa "${programa.nombre}"? Las sesiones ya creadas en pacientes no cambian.`)) return;
            descartar();
            await eliminar('programas', programa.id);
            navegar('/ejercicios/programas');
          }}
        >
          Eliminar
        </button>
      </div>
      <section className="seccion">
        <div className="rejilla">
          <CampoTexto etiqueta="Nombre" ancho="medio" valor={borrador.nombre} onCambio={(v) => fijar('nombre', v)} />
          <CampoNumero
            etiqueta="Sesiones por semana (sugerido)"
            ancho="medio"
            min={1}
            max={7}
            paso={1}
            valor={borrador.sesionesPorSemana}
            onCambio={(v) => v && fijar('sesionesPorSemana', Math.min(7, Math.max(1, Math.round(v))))}
          />
          <AreaTexto etiqueta="Descripción, indicaciones y criterios de progresión" valor={borrador.descripcion} onCambio={(v) => fijar('descripcion', v)} />
        </div>
      </section>

      <section className="seccion">
        <header className="seccion__cab">
          <h3>Sesiones ({sesiones.length})</h3>
        </header>
        <ol className="programa-sesiones">
          {sesiones.map((s, i) => (
            <li key={s.id} className="tarjeta">
              <div className="programa-sesiones__cab">
                <button type="button" className="biblioteca__resumen" onClick={() => setAbierta(abierta === s.id ? null : s.id)} aria-expanded={abierta === s.id}>
                  <strong>Sesión {i + 1}</strong>
                  <span>{s.titulo}</span>
                  <span className="tenue">{s.ejercicios.length} ejercicios</span>
                </button>
                <div className="ejercicio__acciones">
                  <button type="button" className="boton boton--icono" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir sesión">
                    ↑
                  </button>
                  <button type="button" className="boton boton--icono" onClick={() => mover(i, 1)} disabled={i === sesiones.length - 1} aria-label="Bajar sesión">
                    ↓
                  </button>
                  <button
                    type="button"
                    className="boton boton--icono"
                    title="Duplicar sesión"
                    aria-label="Duplicar sesión"
                    onClick={() => fijarSesiones((ss) => [...ss.slice(0, i + 1), copiaDe(s), ...ss.slice(i + 1)])}
                  >
                    ⧉
                  </button>
                  <button
                    type="button"
                    className="boton boton--icono boton--peligro"
                    aria-label="Quitar sesión"
                    onClick={() => confirm(`¿Quitar la sesión ${i + 1} del programa?`) && fijarSesiones((ss) => ss.filter((x) => x.id !== s.id))}
                  >
                    ×
                  </button>
                </div>
              </div>
              {abierta === s.id && (
                <div className="pila">
                  <div className="rejilla">
                    <CampoTexto etiqueta="Título / fase" valor={s.titulo} onCambio={(v) => editarSesion(s.id, { titulo: v })} />
                    <AreaTexto etiqueta="Objetivos" valor={s.objetivos} onCambio={(v) => editarSesion(s.id, { objetivos: v })} />
                  </div>
                  <div className="acciones acciones--izq">
                    <button type="button" className="boton boton--chico" onClick={() => setCopiarEn(s.id)}>
                      Usar plantilla / copiar sesión
                    </button>
                  </div>
                  <EditorEjercicios ejercicios={s.ejercicios} onCambio={(e) => editarSesion(s.id, { ejercicios: e })} />
                  <AreaTexto etiqueta="Notas" valor={s.notas} onCambio={(v) => editarSesion(s.id, { notas: v })} />
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="acciones acciones--izq">
          <button
            type="button"
            className="boton boton--chico boton--primario"
            onClick={() => {
              const ultima = sesiones.at(-1);
              const nueva = ultima ? { ...copiaDe(ultima) } : { id: nuevoId(), titulo: '', objetivos: '', ejercicios: [], notas: '' };
              fijarSesiones((ss) => [...ss, nueva]);
              setAbierta(nueva.id);
            }}
          >
            + Agregar sesión {sesiones.length ? '(copia la última)' : ''}
          </button>
        </div>
      </section>
      <SelectorPlan
        abierto={copiarEn !== null}
        onCerrar={() => setCopiarEn(null)}
        onElegir={(plan, modo) => {
          const id = copiarEn;
          if (!id) return;
          const copiados = plan.ejercicios.map((e) => ({ ...e, id: nuevoId(), realizado: false }));
          fijarSesiones((ss) =>
            ss.map((s) =>
              s.id === id
                ? {
                    ...s,
                    objetivos: modo === 'reemplazar' || !s.objetivos ? plan.objetivos : s.objetivos,
                    ejercicios: modo === 'reemplazar' ? copiados : [...s.ejercicios, ...copiados],
                  }
                : s,
            ),
          );
        }}
      />
    </div>
  );
}
