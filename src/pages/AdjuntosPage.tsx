import { useEffect, useRef, useState, type DragEvent } from 'react';
import { AreaTexto, CampoTexto, IndicadorGuardado, Seleccion } from '../components/Campos';
import { useDatos } from '../data/DatosContext';
import { useAutoguardado } from '../data/useAutoguardado';
import { fechaLegible } from '../domain/clinica';
import { CATEGORIAS_ADJUNTO, type Adjunto } from '../domain/schema';
import { usePaciente } from './PacientePage';

const ETIQUETA_CATEGORIA: Record<Adjunto['categoria'], string> = {
  imagen: 'Imagen / foto',
  examen: 'Examen',
  informe: 'Informe',
  consentimiento: 'Consentimiento',
  video: 'Video',
  otro: 'Otro',
};
const OPCIONES_CATEGORIA = CATEGORIAS_ADJUNTO.map((c) => [c, ETIQUETA_CATEGORIA[c]] as const);

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** URL temporal (object URL) para mostrar un archivo guardado; se libera al desmontar. */
export function useArchivoUrl(ruta: string | null): { url: string | null; error: string } {
  const { leerArchivo } = useDatos();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!ruta) return;
    let creada: string | null = null;
    let vigente = true;
    leerArchivo(ruta)
      .then((b) => {
        if (!vigente) return;
        creada = URL.createObjectURL(b);
        setUrl(creada);
      })
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
      if (creada) URL.revokeObjectURL(creada);
    };
  }, [ruta, leerArchivo]);
  return { url, error };
}

export function ListaAdjuntos() {
  const p = usePaciente()!;
  const { db, subirAdjunto } = useDatos();
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const adjuntos = db.adjuntos.filter((a) => a.pacienteId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn.localeCompare(a.creadoEn));

  const subir = async (archivos: FileList | File[] | null) => {
    if (!archivos?.length) return;
    setError('');
    const lista = [...archivos];
    setSubiendo((n) => n + lista.length);
    for (const f of lista) {
      try {
        await subirAdjunto(p.id, f);
      } catch (e) {
        setError(`${f.name}: ${e instanceof Error ? e.message : e}`);
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    void subir(e.dataTransfer.files);
  };

  return (
    <div className="pila">
      <div
        className={`zona-carga ${arrastrando ? 'zona-carga--activa' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
      >
        <p>Arrastra aquí fotos, exámenes (PDF) o informes</p>
        <div className="acciones acciones--centro">
          <button className="boton boton--primario" onClick={() => entrada.current?.click()}>
            Elegir archivos
          </button>
          <button className="boton" onClick={() => camara.current?.click()}>
            Tomar foto
          </button>
        </div>
        <input
          ref={entrada}
          type="file"
          multiple
          hidden
          accept="image/*,application/pdf,video/*,.doc,.docx"
          onChange={(e) => {
            void subir(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={camara}
          type="file"
          hidden
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            void subir(e.target.files);
            e.target.value = '';
          }}
        />
        <small className="tenue">Máx. 25 MB por archivo. Las fotos grandes se reducen automáticamente.</small>
      </div>
      {subiendo > 0 && <p className="aviso">Subiendo {subiendo} archivo(s)…</p>}
      {error && <p className="aviso aviso--error">{error}</p>}
      {adjuntos.length === 0 && !subiendo && <p className="vacio">Sin adjuntos.</p>}
      <ul className="adjuntos">
        {adjuntos.map((a) => (
          <TarjetaAdjunto key={a.id} adjunto={a} />
        ))}
      </ul>
    </div>
  );
}

function TarjetaAdjunto({ adjunto }: { adjunto: Adjunto }) {
  const { db, eliminar } = useDatos();
  const { borrador, fijar, estado, mensajeError, descartar } = useAutoguardado('adjuntos', adjunto);
  const esImagen = adjunto.tipoMime.startsWith('image/');
  const { url, error } = useArchivoUrl(adjunto.ruta);
  const evaluaciones = db.evaluaciones.filter((e) => e.pacienteId === adjunto.pacienteId);

  return (
    <li className="tarjeta adjunto">
      <a className="adjunto__vista" href={url ?? undefined} target="_blank" rel="noreferrer" aria-label={`Abrir ${adjunto.nombreArchivo}`}>
        {esImagen && url ? (
          <img src={url} alt={borrador.descripcion || adjunto.nombreArchivo} />
        ) : (
          <span className="adjunto__icono">{error ? '⚠️' : adjunto.tipoMime === 'application/pdf' ? 'PDF' : '📄'}</span>
        )}
      </a>
      <div className="adjunto__datos">
        <div className="adjunto__cab">
          <strong className="adjunto__nombre" title={adjunto.nombreArchivo}>
            {adjunto.nombreArchivo}
          </strong>
          <span className="tenue">
            {tamanoLegible(adjunto.tamanoBytes)} · subido {fechaLegible(adjunto.creadoEn)}
          </span>
          <span className="espaciador" />
          <IndicadorGuardado estado={estado} error={mensajeError} />
        </div>
        <div className="rejilla">
          <CampoTexto etiqueta="Fecha del examen" tipo="date" ancho="tercio" valor={borrador.fecha} onCambio={(v) => fijar('fecha', v)} />
          <Seleccion etiqueta="Categoría" ancho="tercio" valor={borrador.categoria} opciones={OPCIONES_CATEGORIA} onCambio={(v) => fijar('categoria', v)} />
          <Seleccion
            etiqueta="Evaluación relacionada"
            ancho="tercio"
            valor={borrador.evaluacionId ?? ''}
            vacio="—"
            opciones={evaluaciones.map((e) => [e.id, `${e.clase === 'inicial' ? 'Inicial' : 'Reevaluación'} ${fechaLegible(e.fecha)}`] as const)}
            onCambio={(v) => fijar('evaluacionId', v || null)}
          />
          <AreaTexto
            etiqueta="Descripción / hallazgos"
            placeholder="Ej: RM rodilla D — rotura completa LCA, edema óseo cóndilo femoral lateral"
            valor={borrador.descripcion}
            onCambio={(v) => fijar('descripcion', v)}
          />
        </div>
        {error && <small className="aviso aviso--error">{error}</small>}
        <div className="acciones">
          {url && (
            <a className="boton boton--chico" href={url} download={adjunto.nombreArchivo}>
              Descargar
            </a>
          )}
          <button
            className="boton boton--chico boton--peligro"
            onClick={() => {
              if (!confirm(`¿Eliminar ${adjunto.nombreArchivo}?`)) return;
              descartar();
              void eliminar('adjuntos', adjunto.id);
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </li>
  );
}
