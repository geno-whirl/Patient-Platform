import { useState } from 'react';
import { fechaLegible } from '../domain/clinica';

export interface PuntoEva {
  fecha: string;
  etiqueta: string; // "Sesión 3", "Evaluación inicial"
  pre: number | null;
  post: number | null;
}

const ANCHO = 900;
const ALTO = 240;
const M = { izq: 34, der: 74, sup: 14, inf: 30 };

/**
 * Evolución del dolor (EVA 0–10) por sesión. Dos series sobre un mismo eje:
 * EVA al inicio (pre) y al final (post) de cada sesión.
 */
export function GraficoEva({ puntos }: { puntos: PuntoEva[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const [tabla, setTabla] = useState(false);
  const validos = puntos.filter((p) => p.pre != null || p.post != null);
  if (validos.length === 0) return <p className="tenue">Aún no hay registros de EVA en sesiones o evaluaciones.</p>;

  const w = ANCHO - M.izq - M.der;
  const h = ALTO - M.sup - M.inf;
  const x = (i: number) => M.izq + (validos.length === 1 ? w / 2 : (i / (validos.length - 1)) * w);
  const y = (v: number) => M.sup + h - (v / 10) * h;

  const linea = (clave: 'pre' | 'post') =>
    validos
      .map((p, i) => (p[clave] == null ? null : `${x(i)},${y(p[clave] as number)}`))
      .filter(Boolean)
      .join(' ');

  const ultimo = (clave: 'pre' | 'post') => {
    for (let i = validos.length - 1; i >= 0; i--) if (validos[i][clave] != null) return i;
    return -1;
  };

  const series = [
    { clave: 'pre' as const, nombre: 'EVA inicio', clase: 'serie-1' },
    { clave: 'post' as const, nombre: 'EVA término', clase: 'serie-2' },
  ];

  const p = activo != null ? validos[activo] : null;

  return (
    <div className="grafico">
      <div className="grafico__cab">
        <div className="leyenda">
          {series.map((s) => (
            <span key={s.clave} className="leyenda__item">
              <span className={`leyenda__marca ${s.clase}`} /> {s.nombre}
            </span>
          ))}
        </div>
        <button type="button" className="enlace" onClick={() => setTabla(!tabla)}>
          {tabla ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {tabla ? (
        <table className="tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Registro</th>
              <th>EVA inicio</th>
              <th>EVA término</th>
            </tr>
          </thead>
          <tbody>
            {validos.map((q, i) => (
              <tr key={i}>
                <td>{fechaLegible(q.fecha)}</td>
                <td>{q.etiqueta}</td>
                <td>{q.pre ?? '—'}</td>
                <td>{q.post ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grafico__lienzo">
          <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Evolución de EVA por sesión" onMouseLeave={() => setActivo(null)}>
            {[0, 5, 10].map((v) => (
              <g key={v}>
                <line x1={M.izq} x2={ANCHO - M.der} y1={y(v)} y2={y(v)} className="grafico__rejilla" />
                <text x={M.izq - 8} y={y(v) + 4} textAnchor="end" className="grafico__eje">
                  {v}
                </text>
              </g>
            ))}
            {activo != null && <line x1={x(activo)} x2={x(activo)} y1={M.sup} y2={M.sup + h} className="grafico__guia" />}
            {series.map((s) => (
              <g key={s.clave} className={s.clase}>
                <polyline points={linea(s.clave)} className="grafico__linea" />
                {validos.map((q, i) =>
                  q[s.clave] == null ? null : (
                    <circle key={i} cx={x(i)} cy={y(q[s.clave] as number)} r={activo === i ? 5 : 4} className="grafico__punto" />
                  ),
                )}
                {ultimo(s.clave) >= 0 && (
                  <text
                    x={x(ultimo(s.clave)) + 10}
                    y={y(validos[ultimo(s.clave)][s.clave] as number) + (s.clave === 'pre' ? -4 : 12)}
                    className="grafico__etiqueta"
                  >
                    {s.nombre}
                  </text>
                )}
              </g>
            ))}
            {validos.map((q, i) => (
              <text key={i} x={x(i)} y={ALTO - 10} textAnchor="middle" className="grafico__eje">
                {validos.length <= 12 || i % Math.ceil(validos.length / 12) === 0 ? q.etiqueta.replace(/^Sesión /, 'S') : ''}
              </text>
            ))}
            {/* zonas de captura más anchas que los puntos */}
            {validos.map((_, i) => {
              const ancho = validos.length === 1 ? w : w / (validos.length - 1);
              return (
                <rect
                  key={i}
                  x={x(i) - ancho / 2}
                  y={M.sup}
                  width={ancho}
                  height={h}
                  fill="transparent"
                  onMouseEnter={() => setActivo(i)}
                  onTouchStart={() => setActivo(i)}
                />
              );
            })}
          </svg>
          {p && activo != null && (
            <div
              className="grafico__tooltip"
              style={{ left: `${(x(activo) / ANCHO) * 100}%`, top: 0 }}
            >
              <strong>{p.etiqueta}</strong>
              <span className="tenue">{fechaLegible(p.fecha)}</span>
              <span>
                <span className="leyenda__marca serie-1" /> Inicio: {p.pre ?? '—'}
              </span>
              <span>
                <span className="leyenda__marca serie-2" /> Término: {p.post ?? '—'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
