import { useState, type MouseEvent } from 'react';
import { nuevoId } from '../domain/factories';
import { detectarRegion, ETIQUETAS_VISTA, LIENZO } from '../domain/regiones';
import { LADOS, TIPOS_SINTOMA, VISTAS_CUERPO, type MarcaDolor, type VistaCuerpo } from '../domain/schema';
import { BodyFigure } from './BodyFigure';
import { AreaTexto, CampoTexto, Seleccion, SelectorEva } from './Campos';

export const COLOR_SINTOMA: Record<MarcaDolor['sintoma'], string> = {
  dolor: '#dc2626',
  dolor_irradiado: '#ea580c',
  parestesia: '#7c3aed',
  rigidez: '#2563eb',
  debilidad: '#0d9488',
  otro: '#64748b',
};

const ETIQUETA_SINTOMA: Record<MarcaDolor['sintoma'], string> = {
  dolor: 'Dolor',
  dolor_irradiado: 'Dolor irradiado',
  parestesia: 'Parestesia',
  rigidez: 'Rigidez',
  debilidad: 'Debilidad',
  otro: 'Otro',
};

const OPCIONES_SINTOMA = TIPOS_SINTOMA.map((t) => [t, ETIQUETA_SINTOMA[t]] as const);
const OPCIONES_LADO = LADOS.map((l) => [l, l[0].toUpperCase() + l.slice(1)] as const);

/** Letras D/I a cada lado de la silueta para orientar (lado del PACIENTE). */
function orientacion(vista: VistaCuerpo): [string, string] {
  switch (vista) {
    case 'anterior':
      return ['D', 'I'];
    case 'posterior':
      return ['I', 'D'];
    case 'lateral_derecha':
      return ['post.', 'ant.'];
    case 'lateral_izquierda':
      return ['ant.', 'post.'];
  }
}

interface Props {
  marcas: MarcaDolor[];
  /** Si no se entrega, el mapa es de solo lectura. */
  onCambio?: (marcas: MarcaDolor[]) => void;
}

export function MapaDolor({ marcas, onCambio }: Props) {
  const editable = !!onCambio;
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [sintoma, setSintoma] = useState<MarcaDolor['sintoma']>('dolor');
  const [intensidad, setIntensidad] = useState<number | null>(5);
  const marcaSel = marcas.find((m) => m.id === seleccion);

  const agregar = (vista: VistaCuerpo, e: MouseEvent<SVGSVGElement>) => {
    if (!onCambio) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const { region, lado } = detectarRegion(vista, x, y);
    const marca: MarcaDolor = {
      id: nuevoId(),
      vista,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      region,
      lado,
      sintoma,
      intensidad,
      nota: '',
    };
    onCambio([...marcas, marca]);
    setSeleccion(marca.id);
  };

  const editar = (cambios: Partial<MarcaDolor>) =>
    onCambio?.(marcas.map((m) => (m.id === seleccion ? { ...m, ...cambios } : m)));

  return (
    <div className="mapa">
      {editable && (
        <div className="mapa__herramientas">
          <span className="etiqueta">Marcar:</span>
          {TIPOS_SINTOMA.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${sintoma === t ? 'chip--activo' : ''}`}
              style={{ borderColor: COLOR_SINTOMA[t] }}
              onClick={() => setSintoma(t)}
            >
              <span className="punto" style={{ background: COLOR_SINTOMA[t] }} /> {ETIQUETA_SINTOMA[t]}
            </button>
          ))}
          <label className="mapa__intensidad">
            EVA nueva marca
            <select
              value={intensidad ?? ''}
              onChange={(e) => setIntensidad(e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">—</option>
              {Array.from({ length: 11 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="mapa__vistas">
        {VISTAS_CUERPO.map((vista) => {
          const [izq, der] = orientacion(vista);
          return (
            <figure key={vista} className="mapa__vista">
              <svg
                viewBox={`0 0 ${LIENZO.ancho} ${LIENZO.alto}`}
                className={editable ? 'editable' : ''}
                onClick={(e) => agregar(vista, e)}
                role={editable ? 'button' : 'img'}
                aria-label={`Vista ${ETIQUETAS_VISTA[vista]}${editable ? ': haz clic para marcar' : ''}`}
              >
                <BodyFigure vista={vista} />
                <text x="3" y="10" className="mapa__orient">
                  {izq}
                </text>
                <text x="97" y="10" className="mapa__orient" textAnchor="end">
                  {der}
                </text>
                {marcas
                  .filter((m) => m.vista === vista)
                  .map((m) => (
                    <g
                      key={m.id}
                      className={`marca ${m.id === seleccion ? 'marca--sel' : ''}`}
                      transform={`translate(${m.x * LIENZO.ancho},${m.y * LIENZO.alto})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSeleccion(m.id === seleccion ? null : m.id);
                      }}
                    >
                      <title>
                        {`${ETIQUETA_SINTOMA[m.sintoma]} · ${m.region}${m.lado ? ` (${m.lado})` : ''}${
                          m.intensidad != null ? ` · EVA ${m.intensidad}` : ''
                        }`}
                      </title>
                      <circle r="5" fill={COLOR_SINTOMA[m.sintoma]} />
                      {m.intensidad != null && (
                        <text textAnchor="middle" dy="2.2" className="marca__num">
                          {m.intensidad}
                        </text>
                      )}
                    </g>
                  ))}
              </svg>
              <figcaption>{ETIQUETAS_VISTA[vista]}</figcaption>
            </figure>
          );
        })}
      </div>

      {editable && marcaSel && (
        <div className="mapa__editor tarjeta">
          <div className="rejilla">
            <Seleccion
              etiqueta="Síntoma"
              ancho="tercio"
              valor={marcaSel.sintoma}
              opciones={OPCIONES_SINTOMA}
              onCambio={(v) => editar({ sintoma: v })}
            />
            <CampoTexto etiqueta="Región" ancho="tercio" valor={marcaSel.region} onCambio={(v) => editar({ region: v })} />
            <Seleccion
              etiqueta="Lado"
              ancho="tercio"
              valor={marcaSel.lado}
              vacio="—"
              opciones={OPCIONES_LADO}
              onCambio={(v) => editar({ lado: v })}
            />
            <SelectorEva etiqueta="Intensidad (EVA)" valor={marcaSel.intensidad} onCambio={(v) => editar({ intensidad: v })} />
            <AreaTexto etiqueta="Nota" valor={marcaSel.nota} onCambio={(v) => editar({ nota: v })} filas={1} />
          </div>
          <div className="acciones">
            <button
              type="button"
              className="boton boton--peligro"
              onClick={() => {
                onCambio?.(marcas.filter((m) => m.id !== seleccion));
                setSeleccion(null);
              }}
            >
              Eliminar marca
            </button>
            <button type="button" className="boton" onClick={() => setSeleccion(null)}>
              Listo
            </button>
          </div>
        </div>
      )}

      {marcas.length > 0 ? (
        <ul className="mapa__lista">
          {marcas.map((m) => (
            <li key={m.id}>
              <button type="button" className="enlace" onClick={() => setSeleccion(m.id)} disabled={!editable}>
                <span className="punto" style={{ background: COLOR_SINTOMA[m.sintoma] }} />
                {ETIQUETA_SINTOMA[m.sintoma]} — {m.region || 'sin región'}
                {m.lado && ` (${m.lado})`}
                {m.intensidad != null && ` · EVA ${m.intensidad}`}
                {m.nota && <span className="tenue"> · {m.nota}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tenue">{editable ? 'Haz clic sobre la silueta para marcar dolor u otros síntomas.' : 'Sin marcas.'}</p>
      )}
    </div>
  );
}
