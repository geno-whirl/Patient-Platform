import { useId, useState } from 'react';
import { normalizarEtiqueta } from '../domain/clinica';

/** Editor de etiquetas: Enter o coma para agregar, sugerencias de etiquetas existentes. */
export function EntradaEtiquetas({
  etiquetas,
  onCambio,
  sugerencias,
}: {
  etiquetas: string[];
  onCambio: (e: string[]) => void;
  sugerencias: string[];
}) {
  const [texto, setTexto] = useState('');
  const id = useId();
  const agregar = (t: string) => {
    const n = normalizarEtiqueta(t);
    if (n && !etiquetas.includes(n)) onCambio([...etiquetas, n]);
    setTexto('');
  };
  const disponibles = sugerencias.filter((s) => !etiquetas.includes(s));
  return (
    <div className="campo campo--completo">
      <label htmlFor={id}>Etiquetas</label>
      <div className="etiquetas-entrada">
        {etiquetas.map((t) => (
          <span key={t} className="chip chip--activo">
            {t}
            <button type="button" aria-label={`Quitar ${t}`} onClick={() => onCambio(etiquetas.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={texto}
          list={`${id}-sug`}
          placeholder="Agregar etiqueta…"
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(',')) agregar(v.slice(0, -1));
            else setTexto(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar(texto);
            } else if (e.key === 'Backspace' && !texto && etiquetas.length) {
              onCambio(etiquetas.slice(0, -1));
            }
          }}
          onBlur={() => texto && agregar(texto)}
        />
        <datalist id={`${id}-sug`}>
          {disponibles.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <small className="ayuda">Ej: rodilla, deportista, post-operatorio, fonasa. Enter para agregar.</small>
    </div>
  );
}
