import type { CSSProperties, ReactNode } from 'react';
import type { VistaCuerpo } from '../domain/schema';

/** Segmento de extremidad: línea gruesa de extremos redondeados (grosor en --w). */
function M({ d, w }: { d: string; w: number }) {
  return <path d={d} className="miembro" style={{ '--w': w } as CSSProperties} />;
}

/**
 * Silueta corporal esquemática en un lienzo de 100 × 220 (mismas medidas que
 * domain/regiones.ts). Se dibuja dos veces: primero en color de contorno y más
 * gruesa, luego en color de relleno, para obtener un contorno unificado.
 */

function Frontal({ espalda }: { espalda: boolean }) {
  const torso = 'M30,33 Q50,28 70,33 L68.5,64 Q66,82 67.5,104 Q50,113 32.5,104 Q34,82 31.5,64 Z';
  return (
    <>
      <ellipse cx="50" cy="13.5" rx="8.5" ry="10.5" />
      <rect x="45.5" y="21" width="9" height="11" rx="2" />
      <path d={torso} />
      {/* brazos */}
      <M d="M27,37 L22,75" w={9} />
      <M d="M22,75 L18.5,111" w={7} />
      <circle cx="18" cy="119" r="5" />
      <M d="M73,37 L78,75" w={9} />
      <M d="M78,75 L81.5,111" w={7} />
      <circle cx="82" cy="119" r="5" />
      {/* piernas */}
      <M d="M42,104 L40.5,152" w={13} />
      <M d="M40.5,152 L40,199" w={9} />
      <M d="M58,104 L59.5,152" w={13} />
      <M d="M59.5,152 L60,199" w={9} />
      <ellipse cx={espalda ? 40 : 38.5} cy="206" rx="5" ry="4" />
      <ellipse cx={espalda ? 60 : 61.5} cy="206" rx="5" ry="4" />
    </>
  );
}

function Lateral() {
  const torso = 'M41,32 Q53,29 60,34 Q64,50 61.5,66 Q58,82 61,100 Q52,109 39,103 Q35,92 39,80 Q41,66 39,50 Q38,40 41,32 Z';
  return (
    <>
      <ellipse cx="50" cy="13.5" rx="9" ry="10.5" />
      <path d="M58,11 L61.5,15.5 L58,17 Z" />
      <rect x="45" y="21" width="9" height="12" rx="2" />
      <path d={torso} />
      <M d="M50,103 L51,152" w={14} />
      <M d="M51,152 L49,199" w={10} />
      <ellipse cx="54" cy="206" rx="8.5" ry="3.8" />
    </>
  );
}

/** El brazo lateral va por delante del tronco, así que se dibuja como capa aparte. */
function BrazoLateral() {
  return (
    <>
      <M d="M50,37 L50,74" w={8.5} />
      <M d="M50,74 L53,110" w={7} />
      <circle cx="54" cy="118" r="4.8" />
    </>
  );
}

function Capas({ children }: { children: ReactNode }) {
  return (
    <>
      <g className="cuerpo__contorno">{children}</g>
      <g className="cuerpo__relleno">{children}</g>
    </>
  );
}

export function BodyFigure({ vista }: { vista: VistaCuerpo }) {
  const frontal = vista === 'anterior' || vista === 'posterior';
  const espejo = vista === 'lateral_izquierda' ? 'translate(100,0) scale(-1,1)' : undefined;
  return (
    <g transform={espejo} strokeLinecap="round" strokeLinejoin="round">
      <Capas>{frontal ? <Frontal espalda={vista === 'posterior'} /> : <Lateral />}</Capas>
      {!frontal && (
        <Capas>
          <BrazoLateral />
        </Capas>
      )}
      {vista === 'posterior' && (
        <path className="cuerpo__linea" d="M50,34 L50,100" strokeDasharray="1.5 2.5" fill="none" />
      )}
      {vista === 'anterior' && (
        <>
          <circle className="cuerpo__detalle" cx="46.5" cy="12" r="0.9" />
          <circle className="cuerpo__detalle" cx="53.5" cy="12" r="0.9" />
        </>
      )}
    </g>
  );
}
