import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useDatos } from '../data/DatosContext';
import { nuevoCentro } from '../domain/factories';
import type { Centro } from '../domain/schema';

const COLORES = ['#0f766e', '#2a78d6', '#eb6834', '#6250d6', '#d55181', '#008300', '#c98500', '#52514e'];

export function CentrosPage() {
  const { db, guardar, eliminar } = useDatos();
  const [nombre, setNombre] = useState('');

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const c = nuevoCentro(nombre.trim());
    c.color = COLORES[db.centros.length % COLORES.length];
    await guardar('centros', c);
    setNombre('');
  };

  const borrar = async (c: Centro) => {
    const n = db.pacientes.filter((p) => p.centroId === c.id).length;
    if (n > 0) {
      alert(`No se puede eliminar "${c.nombre}": tiene ${n} paciente(s). Muévelos a otro centro primero.`);
      return;
    }
    if (confirm(`¿Eliminar el centro "${c.nombre}"?`)) await eliminar('centros', c.id);
  };

  return (
    <div className="pila">
      <div className="titulo">
        <h1>Centros</h1>
      </div>
      <p className="tenue">Lugares donde atiendes (clínicas, consultas, domicilio…). Cada paciente pertenece a un centro.</p>
      <form className="tarjeta nuevo-paciente" onSubmit={crear}>
        <input placeholder="Nombre del centro" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del centro" />
        <button className="boton boton--primario" disabled={!nombre.trim()}>
          + Agregar centro
        </button>
      </form>
      <ul className="lista-simple">
        {db.centros.map((c) => {
          const n = db.pacientes.filter((p) => p.centroId === c.id && p.estado === 'activo').length;
          return (
            <li key={c.id} className="tarjeta centro">
              <input
                type="color"
                value={c.color}
                onChange={(e) => guardar('centros', { ...c, color: e.target.value })}
                aria-label={`Color de ${c.nombre}`}
              />
              <div className="centro__datos">
                <input
                  className="centro__nombre"
                  defaultValue={c.nombre}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && guardar('centros', { ...c, nombre: e.target.value.trim() })}
                  aria-label="Nombre"
                />
                <input
                  placeholder="Dirección"
                  defaultValue={c.direccion}
                  onBlur={(e) => e.target.value !== c.direccion && guardar('centros', { ...c, direccion: e.target.value })}
                  aria-label="Dirección"
                />
              </div>
              <Link to={`/?centro=${c.id}`} className="enlace">
                {n} activos
              </Link>
              <button className="boton boton--chico boton--peligro" onClick={() => borrar(c)}>
                Eliminar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
