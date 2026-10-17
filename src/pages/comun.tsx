import { useNavigate } from 'react-router-dom';
import { IndicadorGuardado } from '../components/Campos';
import type { EstadoGuardado } from '../data/useAutoguardado';

/** Barra superior de un formulario: volver, estado de guardado y eliminar. */
export function BarraFormulario({
  titulo,
  estado,
  error,
  onEliminar,
}: {
  titulo: string;
  estado: EstadoGuardado;
  error: string;
  onEliminar: () => void;
}) {
  const navegar = useNavigate();
  return (
    <div className="barra-form">
      <button className="enlace" onClick={() => navegar('..', { relative: 'path' })}>
        ← Volver
      </button>
      <h2>{titulo}</h2>
      <span className="espaciador" />
      <IndicadorGuardado estado={estado} error={error} />
      <button
        className="boton boton--chico boton--peligro"
        onClick={() => {
          if (confirm('¿Eliminar este registro? No se puede deshacer.')) onEliminar();
        }}
      >
        Eliminar
      </button>
    </div>
  );
}
