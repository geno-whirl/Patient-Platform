import { Link, useNavigate, useParams } from 'react-router-dom';
import { AreaTexto, CampoNumero, CampoTexto, Casilla, enlazarTexto, Seccion, Seleccion } from '../components/Campos';
import { useDatos } from '../data/DatosContext';
import { useAutoguardado } from '../data/useAutoguardado';
import { categoriaImc, imc } from '../domain/clinica';
import { LATERALIDADES, type Ingreso } from '../domain/schema';
import { BarraFormulario } from './comun';

export function IngresoPage() {
  const { id } = useParams();
  const { db } = useDatos();
  const ingreso = db.ingresos.find((i) => i.id === id);
  if (!ingreso) return <p className="vacio">Ingreso no encontrado. <Link to="..">Volver</Link></p>;
  return <FormIngreso key={ingreso.id} ingreso={ingreso} />;
}

function FormIngreso({ ingreso }: { ingreso: Ingreso }) {
  const { eliminar } = useDatos();
  const navegar = useNavigate();
  const { borrador, fijar, actualizar, estado, mensajeError } = useAutoguardado('ingresos', ingreso);
  const t = enlazarTexto(borrador, fijar);
  const r = borrador.anamnesisRemota;

  const fijarAntropometria = (campo: 'pesoKg' | 'tallaCm', v: number | null) =>
    actualizar((d) => {
      const ar = { ...d.anamnesisRemota, [campo]: v };
      return { ...d, anamnesisRemota: { ...ar, imc: imc(ar.pesoKg, ar.tallaCm) } };
    });

  return (
    <div className="pila formulario">
      <BarraFormulario
        titulo="Ingreso"
        estado={estado}
        error={mensajeError}
        onEliminar={async () => {
          await eliminar('ingresos', ingreso.id);
          navegar('..', { relative: 'path' });
        }}
      />
      <div className="rejilla">
        <CampoTexto etiqueta="Fecha de ingreso" tipo="date" ancho="tercio" {...t('fecha')} />
      </div>

      <Seccion titulo="Anamnesis próxima">
        <CampoTexto etiqueta="Diagnóstico médico" ancho="medio" {...t('anamnesisProxima.diagnosticoMedico')} />
        <CampoTexto etiqueta="Tiempo de evolución" ancho="medio" placeholder="ej: 3 semanas" {...t('anamnesisProxima.tiempoEvolucion')} />
        <CampoTexto etiqueta="Médico tratante" ancho="medio" {...t('anamnesisProxima.medicoTratante')} />
        <CampoTexto etiqueta="Previsión" ancho="medio" lista="previsiones" {...t('anamnesisProxima.prevision')} />
        <datalist id="previsiones">
          <option value="Fonasa" />
          <option value="Isapre" />
          <option value="Particular" />
          <option value="Mutual / ley 16.744" />
        </datalist>
        <AreaTexto etiqueta="Motivo de consulta / cuadro clínico" filas={3} {...t('anamnesisProxima.motivoConsulta')} />
        <AreaTexto etiqueta="Episodios previos" {...t('anamnesisProxima.episodiosPrevios')} />
        <AreaTexto etiqueta="Tratamiento / procedimientos previos" {...t('anamnesisProxima.tratamientosPrevios')} />
        <AreaTexto etiqueta="Exámenes complementarios / imágenes" {...t('anamnesisProxima.examenesComplementarios')} />
        <AreaTexto etiqueta="Objetivos del paciente" {...t('anamnesisProxima.objetivosPaciente')} />
      </Seccion>

      <Seccion titulo="Anamnesis remota">
        <Seleccion
          etiqueta="Lateralidad"
          ancho="cuarto"
          valor={r.lateralidad}
          vacio="—"
          opciones={LATERALIDADES.map((l) => [l, l[0].toUpperCase() + l.slice(1)] as const)}
          onCambio={(v) => fijar('anamnesisRemota.lateralidad', v)}
        />
        <CampoNumero etiqueta="Peso" unidad="kg" ancho="cuarto" valor={r.pesoKg} onCambio={(v) => fijarAntropometria('pesoKg', v)} />
        <CampoNumero etiqueta="Talla" unidad="cm" ancho="cuarto" valor={r.tallaCm} onCambio={(v) => fijarAntropometria('tallaCm', v)} />
        <div className="campo campo--cuarto">
          <span className="etiqueta">IMC</span>
          <output className="calculado">{r.imc != null ? `${r.imc} · ${categoriaImc(r.imc)}` : '—'}</output>
        </div>

        <AreaTexto etiqueta="Antecedentes médicos" ancho="medio" {...t('anamnesisRemota.antecedentesMedicos')} />
        <AreaTexto etiqueta="Antecedentes quirúrgicos" ancho="medio" {...t('anamnesisRemota.antecedentesQuirurgicos')} />
        <AreaTexto etiqueta="Antecedentes familiares" ancho="medio" {...t('anamnesisRemota.antecedentesFamiliares')} />
        <AreaTexto etiqueta="Antecedentes ginecoobstétricos" ancho="medio" {...t('anamnesisRemota.antecedentesGinecoobstetricos')} />

        <AreaTexto etiqueta="Medicamentos" ancho="medio" {...t('anamnesisRemota.medicamentos')} />
        <AreaTexto etiqueta="Suplementos" ancho="medio" {...t('anamnesisRemota.suplementos')} />
        <AreaTexto etiqueta="Alimentación" ancho="medio" {...t('anamnesisRemota.alimentacion')} />
        <div className="campo campo--medio">
          <span className="etiqueta">Hábitos</span>
          <div className="casillas">
            <Casilla etiqueta="OH" valor={r.habitos.alcohol} onCambio={(v) => fijar('anamnesisRemota.habitos.alcohol', v)} />
            <Casilla etiqueta="TBQ" valor={r.habitos.tabaco} onCambio={(v) => fijar('anamnesisRemota.habitos.tabaco', v)} />
            <Casilla etiqueta="Drogas" valor={r.habitos.drogas} onCambio={(v) => fijar('anamnesisRemota.habitos.drogas', v)} />
          </div>
          <input
            placeholder="Detalle (cantidad, frecuencia)"
            value={r.habitos.detalle}
            onChange={(e) => fijar('anamnesisRemota.habitos.detalle', e.target.value)}
            aria-label="Detalle de hábitos"
          />
        </div>
        <AreaTexto etiqueta="Actividad física" ancho="medio" {...t('anamnesisRemota.actividadFisica')} />
        <AreaTexto etiqueta="Sueño" ancho="medio" {...t('anamnesisRemota.sueno')} />
        <AreaTexto etiqueta="Psicología" {...t('anamnesisRemota.psicologia')} />
      </Seccion>

      <Seccion titulo="Contexto biopsicosocial">
        <AreaTexto etiqueta="Red de apoyo" ancho="medio" {...t('anamnesisRemota.redDeApoyo')} />
        <AreaTexto etiqueta="Vivienda" ancho="medio" {...t('anamnesisRemota.vivienda')} />
        <AreaTexto etiqueta="Transporte" ancho="medio" {...t('anamnesisRemota.transporte')} />
        <AreaTexto etiqueta="ABVD / AVD" ancho="medio" {...t('anamnesisRemota.abvdAvd')} />
        <AreaTexto etiqueta="Hobbies / actividades" ancho="medio" {...t('anamnesisRemota.hobbies')} />
        <AreaTexto etiqueta="Rutina diaria" ancho="medio" {...t('anamnesisRemota.rutinaDiaria')} />
        <AreaTexto etiqueta="Antecedente de caídas" ancho="medio" {...t('anamnesisRemota.antecedenteCaidas')} />
        <AreaTexto etiqueta="Ayudas técnicas" ancho="medio" {...t('anamnesisRemota.ayudasTecnicas')} />
      </Seccion>
    </div>
  );
}
