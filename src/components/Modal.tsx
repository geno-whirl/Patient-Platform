import { useEffect, useRef, type ReactNode } from 'react';

/** Diálogo modal nativo (<dialog>): foco, Esc y fondo bloqueado los maneja el navegador. */
export function Modal({ titulo, abierto, onCerrar, children, pie }: { titulo: string; abierto: boolean; onCerrar: () => void; children: ReactNode; pie?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className="modal" onClose={onCerrar} onClick={(e) => e.target === ref.current && onCerrar()}>
      <div className="modal__caja">
        <header className="modal__cab">
          <h2>{titulo}</h2>
          <button type="button" className="boton boton--icono" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal__cuerpo">{abierto && children}</div>
        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </dialog>
  );
}
