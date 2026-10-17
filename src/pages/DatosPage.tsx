import { useRef, useState } from 'react';
import { z } from 'zod';
import { RespaldoDrive } from '../components/RespaldoDrive';
import { useDatos } from '../data/DatosContext';
import { descargar } from '../domain/archivos';
import { hoy } from '../domain/factories';
import { pacienteAMarkdown } from '../domain/markdown';
import { ExportacionSchema } from '../domain/schema';

export function DatosPage() {
  const { db, modo, exportar, importar } = useDatos();
  const [centroId, setCentroId] = useState('');
  const [soloActivos, setSoloActivos] = useState(true);
  const [anonimo, setAnonimo] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const archivo = useRef<HTMLInputElement>(null);

  const seleccion = db.pacientes.filter(
    (p) => (!centroId || p.centroId === centroId) && (!soloActivos || p.estado === 'activo'),
  );
  const markdown = () =>
    `# Pacientes de kinesiología (exportado ${hoy()})\n\n` +
    seleccion.map((p) => pacienteAMarkdown(p, db, { anonimo })).join('\n---\n\n');

  const alImportar = async (f: File | undefined) => {
    if (!f) return;
    try {
      const { total } = await importar(JSON.parse(await f.text()));
      setMensaje(`Importados ${total} registros.`);
    } catch (e) {
      setMensaje(`Error al importar: ${e instanceof Error ? e.message : e}`);
    } finally {
      if (archivo.current) archivo.current.value = '';
    }
  };

  return (
    <div className="pila">
      <div className="titulo">
        <h1>Datos e IA</h1>
      </div>

      <section className="tarjeta pila">
        <h3>Consultar a un LLM sobre tus pacientes</h3>
        <p>
          Exporta las fichas en Markdown (legible para humanos y modelos de lenguaje) y súbelas a un proyecto de Claude u otro
          asistente. Puedes preguntar, por ejemplo: <em>“¿Qué pacientes con dolor lumbar no han mejorado su EVA en las últimas 3
          sesiones?”</em> o <em>“Resume la evolución de María y propón progresiones para la próxima sesión”</em>.
        </p>
        <div className="filtros">
          <select value={centroId} onChange={(e) => setCentroId(e.target.value)} aria-label="Centro">
            <option value="">Todos los centros</option>
            {db.centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <label className="casilla">
            <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} /> Solo activos
          </label>
          <label className="casilla">
            <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} /> Anonimizar
          </label>
          <span className="tenue">{seleccion.length} pacientes</span>
        </div>
        <div className="acciones acciones--izq">
          <button className="boton boton--primario" onClick={() => descargar(`pacientes${anonimo ? '-anonimo' : ''}-${hoy()}.md`, markdown(), 'text/markdown')}>
            Descargar fichas (.md)
          </button>
          <button
            className="boton"
            onClick={async () => {
              await navigator.clipboard.writeText(markdown());
              setMensaje('Fichas copiadas al portapapeles.');
            }}
          >
            Copiar al portapapeles
          </button>
        </div>
        <p className="tenue">
          {anonimo
            ? 'Anonimizado: se reemplaza el nombre por un código (ej. P-3F2A9C), se quitan RUT, contacto, fecha de nacimiento (queda la edad), médico tratante y notas generales, y se enmascaran nombre, RUT, correos y teléfonos escritos en el texto libre. Los nombres de otras personas en texto libre no se detectan: revisa antes de compartir.'
            : '⚠️ Incluye datos identificatorios. Úsalo solo con servicios que cumplan tus obligaciones de confidencialidad.'}
        </p>
      </section>

      <section className="tarjeta pila">
        <h3>Respaldo</h3>
        <p>
          {modo === 'local'
            ? 'Estás en modo local: los datos viven solo en este navegador. Descarga respaldos periódicamente.'
            : 'Tus datos se guardan en la nube (Supabase). Igual puedes descargar un respaldo completo cuando quieras.'}
        </p>
        <div className="acciones acciones--izq">
          <button className="boton boton--primario" onClick={() => descargar(`respaldo-kine-${hoy()}.json`, JSON.stringify(exportar(), null, 2))}>
            Descargar respaldo (.json)
          </button>
          <button className="boton" onClick={() => archivo.current?.click()}>
            Importar respaldo…
          </button>
          <input ref={archivo} type="file" accept="application/json,.json" hidden onChange={(e) => alImportar(e.target.files?.[0])} />
          <button
            className="boton"
            onClick={() =>
              descargar('esquema-kine.json', JSON.stringify(z.toJSONSchema(ExportacionSchema, { io: 'input' }), null, 2))
            }
          >
            Descargar esquema de datos (JSON Schema)
          </button>
        </div>
        <p className="tenue">Importar agrega o actualiza registros por id; no borra nada.</p>
      </section>
      {modo === 'supabase' && <RespaldoDrive />}
      {mensaje && <p className="aviso">{mensaje}</p>}
    </div>
  );
}
