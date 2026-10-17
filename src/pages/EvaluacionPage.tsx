import { Link, useNavigate, useParams } from 'react-router-dom';
import { AreaTexto, CampoTexto, enlazarTexto, Seccion, Seleccion, SelectorEva } from '../components/Campos';
import { MapaDolor } from '../components/MapaDolor';
import { useDatos } from '../data/DatosContext';
import { useAutoguardado } from '../data/useAutoguardado';
import { nuevoId } from '../domain/factories';
import { LADOS, type Evaluacion, type PruebaEspecial } from '../domain/schema';
import { BarraFormulario } from './comun';

const PRUEBAS_FRECUENTES = [
  'Lachman', 'Cajón anterior', 'Cajón posterior', 'McMurray', 'Thessaly', 'Bostezo en valgo', 'Bostezo en varo',
  'Neer', 'Hawkins-Kennedy', 'Jobe', 'Speed', 'Yergason', 'Drop arm', 'Aprehensión',
  'SLR (Lasègue)', 'Slump', 'ULNT1', 'Spurling', 'FABER (Patrick)', 'FADIR', 'Thomas', 'Ober',
  'Trendelenburg', 'Finkelstein', 'Phalen', 'Tinel', 'Thompson', 'Cajón anterior tobillo',
];

const OPCIONES_LADO = LADOS.map((l) => [l, l[0].toUpperCase() + l.slice(1)] as const);
const OPCIONES_RESULTADO = [
  ['positivo', 'Positivo'],
  ['negativo', 'Negativo'],
  ['no_concluyente', 'No concluyente'],
] as const;

export function EvaluacionPage() {
  const { id } = useParams();
  const { db } = useDatos();
  const e = db.evaluaciones.find((x) => x.id === id);
  if (!e) return <p className="vacio">Evaluación no encontrada. <Link to="..">Volver</Link></p>;
  return <FormEvaluacion key={e.id} evaluacion={e} />;
}

function FormEvaluacion({ evaluacion }: { evaluacion: Evaluacion }) {
  const { eliminar } = useDatos();
  const navegar = useNavigate();
  const { borrador, fijar, estado, mensajeError, descartar } = useAutoguardado('evaluaciones', evaluacion);
  const t = enlazarTexto(borrador, fijar);
  const pruebas = borrador.pruebasEspeciales;
  const fijarPrueba = (pid: string, cambios: Partial<PruebaEspecial>) =>
    fijar('pruebasEspeciales', pruebas.map((p) => (p.id === pid ? { ...p, ...cambios } : p)));

  return (
    <div className="pila formulario">
      <BarraFormulario
        titulo={borrador.clase === 'inicial' ? 'Evaluación inicial' : 'Reevaluación'}
        estado={estado}
        error={mensajeError}
        onEliminar={async () => {
          descartar();
          await eliminar('evaluaciones', evaluacion.id);
          navegar('..', { relative: 'path' });
        }}
      />
      <div className="rejilla">
        <CampoTexto etiqueta="Fecha" tipo="date" ancho="tercio" {...t('fecha')} />
        <Seleccion
          etiqueta="Tipo"
          ancho="tercio"
          valor={borrador.clase}
          opciones={[
            ['inicial', 'Evaluación inicial'],
            ['reevaluacion', 'Reevaluación'],
          ]}
          onCambio={(v) => fijar('clase', v)}
        />
      </div>

      <Seccion titulo="Evaluación del dolor (ALICIA)">
        <AreaTexto etiqueta="A — Aparición" ancho="medio" {...t('dolor.alicia.aparicion')} />
        <AreaTexto etiqueta="L — Localización" ancho="medio" {...t('dolor.alicia.localizacion')} />
        <SelectorEva
          etiqueta="I — Intensidad (EVA)"
          valor={borrador.dolor.alicia.intensidadEva}
          onCambio={(v) => fijar('dolor.alicia.intensidadEva', v)}
        />
        <AreaTexto etiqueta="C — Carácter" ancho="medio" {...t('dolor.alicia.caracter')} />
        <AreaTexto etiqueta="I — Irradiación" ancho="medio" {...t('dolor.alicia.irradiacion')} />
        <AreaTexto etiqueta="A — Agravantes / atenuantes" {...t('dolor.alicia.atenuantesAgravantes')} />
      </Seccion>

      <section className="seccion">
        <header className="seccion__cab">
          <h3>Mapa del dolor</h3>
        </header>
        <MapaDolor marcas={borrador.dolor.mapa} onCambio={(m) => fijar('dolor.mapa', m)} />
      </section>

      <Seccion titulo="Observación">
        <AreaTexto etiqueta="Evaluación postural" ancho="medio" {...t('postural')} />
        <AreaTexto etiqueta="Observación / inspección" ancho="medio" {...t('observacion')} />
      </Seccion>

      <Seccion titulo="Evaluación de movimiento">
        <AreaTexto etiqueta="1) Activo" {...t('movimiento.activo')} />
        <AreaTexto etiqueta="2) Pasivo" {...t('movimiento.pasivo')} />
        <AreaTexto etiqueta="3) Artrocinemática" {...t('movimiento.artrocinematica')} />
      </Seccion>

      <Seccion titulo="Evaluación de tejidos blandos">
        <AreaTexto etiqueta="1) Activación muscular" {...t('tejidosBlandos.activacionMuscular')} />
        <AreaTexto etiqueta="2) Fuerza muscular" {...t('tejidosBlandos.fuerzaMuscular')} />
        <AreaTexto etiqueta="3) Longitud muscular" {...t('tejidosBlandos.longitudMuscular')} />
      </Seccion>

      <Seccion titulo="Evaluación neurológica">
        <AreaTexto etiqueta="1) Dermatomas" ancho="medio" {...t('neurologica.dermatomas')} />
        <AreaTexto etiqueta="2) Miotomas" ancho="medio" {...t('neurologica.miotomas')} />
        <AreaTexto etiqueta="3) Reflejos" ancho="medio" {...t('neurologica.reflejos')} />
        <AreaTexto etiqueta="4) Neurodinamia" ancho="medio" {...t('neurologica.neurodinamia')} />
      </Seccion>

      <Seccion titulo="Otras evaluaciones">
        <AreaTexto etiqueta="Control sensoriomotor" {...t('controlSensoriomotor')} />
        <AreaTexto etiqueta="Palpación específica" {...t('palpacion')} />
        <AreaTexto etiqueta="Evaluación funcional" {...t('funcional')} />
      </Seccion>

      <section className="seccion">
        <header className="seccion__cab">
          <h3>Pruebas especiales</h3>
          <button
            type="button"
            className="boton boton--chico"
            onClick={() =>
              fijar('pruebasEspeciales', [...pruebas, { id: nuevoId(), nombre: '', lado: '', resultado: '', notas: '' }])
            }
          >
            + Agregar prueba
          </button>
        </header>
        <datalist id="pruebas-frecuentes">
          {PRUEBAS_FRECUENTES.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {pruebas.length === 0 && <p className="tenue">Sin pruebas registradas.</p>}
        {pruebas.map((p) => (
          <div key={p.id} className="rejilla fila-prueba">
            <CampoTexto etiqueta="Prueba" ancho="tercio" lista="pruebas-frecuentes" valor={p.nombre} onCambio={(v) => fijarPrueba(p.id, { nombre: v })} />
            <Seleccion etiqueta="Lado" ancho="cuarto" valor={p.lado} vacio="—" opciones={OPCIONES_LADO} onCambio={(v) => fijarPrueba(p.id, { lado: v })} />
            <Seleccion
              etiqueta="Resultado"
              ancho="cuarto"
              valor={p.resultado}
              vacio="—"
              opciones={OPCIONES_RESULTADO}
              onCambio={(v) => fijarPrueba(p.id, { resultado: v })}
            />
            <CampoTexto etiqueta="Notas" ancho="medio" valor={p.notas} onCambio={(v) => fijarPrueba(p.id, { notas: v })} />
            <button
              type="button"
              className="boton boton--chico boton--peligro fila-prueba__quitar"
              aria-label={`Quitar prueba ${p.nombre}`}
              onClick={() => fijar('pruebasEspeciales', pruebas.filter((x) => x.id !== p.id))}
            >
              Quitar
            </button>
          </div>
        ))}
      </section>

      <Seccion titulo="Conclusión y plan de tratamiento">
        <AreaTexto etiqueta="Diagnóstico kinesiológico" {...t('conclusion.diagnosticoKinesiologico')} />
        <AreaTexto etiqueta="Objetivos generales" ancho="medio" {...t('conclusion.objetivosGenerales')} />
        <AreaTexto etiqueta="Objetivos específicos" ancho="medio" {...t('conclusion.objetivosEspecificos')} />
        <AreaTexto
          etiqueta="Plan de tratamiento"
          placeholder="Fases, frecuencia semanal, número estimado de sesiones, criterios de progresión…"
          filas={3}
          {...t('conclusion.planTratamiento')}
        />
      </Seccion>
    </div>
  );
}
