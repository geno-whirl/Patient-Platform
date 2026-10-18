import { NavLink, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { solicitarPersistencia } from '../data/almacenamiento';
import { useDatos } from '../data/DatosContext';

/** Repositorio del código. Si publicas una versión modificada, apunta aquí a tu propio código (VITE_URL_CODIGO). */
const URL_CODIGO = (import.meta.env.VITE_URL_CODIGO as string | undefined) || 'https://github.com/geno-whirl/Patient-Platform';
import { BotonInstalar, useEnLinea } from './EstadoApp';
import { recurso } from '../rutaBase';

export function Marco({ email, onSalir }: { email?: string; onSalir?: () => void }) {
  const { db, modo, cargando, error } = useDatos();
  const enLinea = useEnLinea();
  const hayPacientes = db.pacientes.length > 0;

  // Modo local: en cuanto hay datos que perder, pedir al navegador que no los borre por su cuenta.
  useEffect(() => {
    if (modo !== 'local' || !hayPacientes) return;
    try {
      if (sessionStorage.getItem('kine-persistencia-pedida')) return;
      sessionStorage.setItem('kine-persistencia-pedida', '1');
    } catch {
      // sin sessionStorage: igual se pide, a lo más una vez por carga
    }
    void solicitarPersistencia();
  }, [modo, hayPacientes]);
  return (
    <div className="app">
      <header className="barra">
        <NavLink to="/" className="marca">
          <img src={recurso('favicon.svg')} alt="" width={28} height={28} />
          <span>Kine</span>
        </NavLink>
        <nav className="barra__nav">
          <NavLink to="/" end>
            Pacientes
          </NavLink>
          <NavLink to="/agenda">Agenda</NavLink>
          <NavLink to="/ejercicios">Ejercicios</NavLink>
          <NavLink to="/centros">Centros</NavLink>
          <NavLink to="/datos">Datos e IA</NavLink>
        </nav>
        <div className="barra__usuario">
          <BotonInstalar />
          {!enLinea && (
            <span
              className="insignia insignia--aviso"
              title={modo === 'local' ? 'Los datos locales siguen disponibles' : 'Los cambios no se guardarán hasta recuperar la conexión'}
            >
              Sin conexión
            </span>
          )}
          {modo === 'local' ? (
            <span className="insignia insignia--aviso" title="Los datos se guardan solo en este navegador">
              Modo local
            </span>
          ) : (
            <>
              <span className="tenue barra__email">{email}</span>
              <button className="boton boton--chico" onClick={onSalir}>
                Salir
              </button>
            </>
          )}
        </div>
      </header>
      <main className="contenido">
        {error && <p className="aviso aviso--error">{error}</p>}
        {cargando ? <div className="cargando">Cargando datos…</div> : <Outlet />}
      </main>
      {/* AGPL-3.0 §13: quien usa la app por la red debe poder obtener su código fuente. */}
      <footer className="pie no-imprimir">
        <a href={URL_CODIGO} target="_blank" rel="noreferrer">
          Código fuente
        </a>{' '}
        · Licencia AGPL-3.0 · No es un dispositivo médico: el criterio clínico es del profesional.
      </footer>
    </div>
  );
}
