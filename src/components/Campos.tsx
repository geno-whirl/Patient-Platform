import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { leerRuta } from '../domain/rutas';
import type { EstadoGuardado } from '../data/useAutoguardado';

interface Base {
  etiqueta: string;
  ayuda?: string;
  ancho?: 'completo' | 'medio' | 'tercio' | 'cuarto';
}

function Envoltura({ etiqueta, ayuda, ancho = 'completo', id, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`campo campo--${ancho}`}>
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {ayuda && <small className="ayuda">{ayuda}</small>}
    </div>
  );
}

export function CampoTexto(
  props: Base & { valor: string; onCambio: (v: string) => void; tipo?: string; placeholder?: string; lista?: string },
) {
  const id = useId();
  return (
    <Envoltura {...props} id={id}>
      <input
        id={id}
        type={props.tipo ?? 'text'}
        value={props.valor}
        placeholder={props.placeholder}
        list={props.lista}
        onChange={(e) => props.onCambio(e.target.value)}
      />
    </Envoltura>
  );
}

/** Textarea que crece con el contenido. */
export function AreaTexto(props: Base & { valor: string; onCambio: (v: string) => void; placeholder?: string; filas?: number }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.valor]);
  return (
    <Envoltura {...props} id={id}>
      <textarea
        id={id}
        ref={ref}
        rows={props.filas ?? 2}
        value={props.valor}
        placeholder={props.placeholder}
        onChange={(e) => props.onCambio(e.target.value)}
      />
    </Envoltura>
  );
}

export function CampoNumero(
  props: Base & { valor: number | null; onCambio: (v: number | null) => void; min?: number; max?: number; paso?: number; unidad?: string },
) {
  const id = useId();
  return (
    <Envoltura {...props} id={id}>
      <div className="con-unidad">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={props.min}
          max={props.max}
          step={props.paso ?? 'any'}
          value={props.valor ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            props.onCambio(v != null && Number.isFinite(v) ? v : null);
          }}
        />
        {props.unidad && <span className="unidad">{props.unidad}</span>}
      </div>
    </Envoltura>
  );
}

export function Seleccion<T extends string>(
  props: Base & { valor: T; onCambio: (v: T) => void; opciones: readonly (readonly [T, string])[]; vacio?: string },
) {
  const id = useId();
  return (
    <Envoltura {...props} id={id}>
      <select id={id} value={props.valor} onChange={(e) => props.onCambio(e.target.value as T)}>
        {props.vacio !== undefined && <option value="">{props.vacio}</option>}
        {props.opciones.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </Envoltura>
  );
}

/** Selector EVA 0–10 con botones grandes (cómodo en tablet). */
export function SelectorEva(props: Base & { valor: number | null; onCambio: (v: number | null) => void }) {
  const id = useId();
  return (
    <div className={`campo campo--${props.ancho ?? 'completo'}`} role="group" aria-labelledby={id}>
      <span id={id} className="etiqueta">
        {props.etiqueta}
      </span>
      <div className="eva">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            className={`eva__btn ${props.valor === n ? 'activo' : ''}`}
            style={{ '--eva': n } as CSSProperties}
            aria-pressed={props.valor === n}
            onClick={() => props.onCambio(props.valor === n ? null : n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Casilla({ etiqueta, valor, onCambio }: { etiqueta: string; valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <label className="casilla">
      <input type="checkbox" checked={valor} onChange={(e) => onCambio(e.target.checked)} />
      {etiqueta}
    </label>
  );
}

export function Seccion({ titulo, children, acciones }: { titulo: string; children: ReactNode; acciones?: ReactNode }) {
  return (
    <section className="seccion">
      <header className="seccion__cab">
        <h3>{titulo}</h3>
        {acciones}
      </header>
      <div className="rejilla">{children}</div>
    </section>
  );
}

export function IndicadorGuardado({ estado, error }: { estado: EstadoGuardado; error?: string }) {
  const textos: Record<EstadoGuardado, string> = {
    guardado: 'Guardado',
    pendiente: 'Cambios sin guardar…',
    guardando: 'Guardando…',
    error: `Error al guardar${error ? `: ${error}` : ''}`,
  };
  return (
    <span className={`guardado guardado--${estado}`} role="status">
      {textos[estado]}
    </span>
  );
}

/**
 * Atajo para enlazar campos de texto a un borrador por ruta:
 *   const t = enlazarTexto(borrador, fijar);
 *   <AreaTexto etiqueta="…" {...t('anamnesisProxima.motivoConsulta')} />
 */
export function enlazarTexto(borrador: unknown, fijar: (ruta: string, v: unknown) => void) {
  return (ruta: string) => ({
    valor: (leerRuta(borrador, ruta) as string) ?? '',
    onCambio: (v: string) => fijar(ruta, v),
  });
}
