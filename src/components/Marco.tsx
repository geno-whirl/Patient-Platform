import { NavLink, Outlet } from 'react-router-dom';
import { useDatos } from '../data/DatosContext';
import { BotonInstalar, useEnLinea } from './EstadoApp';
import { recurso } from '../rutaBase';

export function Marco({ email, onSalir }: { email?: string; onSalir?: () => void }) {
  const { modo, cargando, error } = useDatos();
  const enLinea = useEnLinea();
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
    </div>
  );
}
