import { useMemo } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Acceso } from './auth/Acceso';
import { Marco } from './components/Marco';
import { DatosProvider } from './data/DatosContext';
import { RepositorioLocal } from './data/repositorioLocal';
import { RepositorioSupabase } from './data/repositorioSupabase';
import { supabase } from './data/supabase';
import { AgendaPage } from './pages/AgendaPage';
import { CentrosPage } from './pages/CentrosPage';
import { DatosPage } from './pages/DatosPage';
import { EvaluacionPage } from './pages/EvaluacionPage';
import { IngresoPage } from './pages/IngresoPage';
import { DatosPacientePage, ListaEvaluaciones, ListaIngresos, ListaSesiones, PacienteMarco, ResumenPaciente } from './pages/PacientePage';
import { PacientesPage } from './pages/PacientesPage';
import { SesionPage } from './pages/SesionPage';

function Rutas({ email, onSalir }: { email?: string; onSalir?: () => void }) {
  return (
    <Routes>
      <Route element={<Marco email={email} onSalir={onSalir} />}>
        <Route index element={<PacientesPage />} />
        <Route path="agenda" element={<AgendaPage />} />
        <Route path="centros" element={<CentrosPage />} />
        <Route path="datos" element={<DatosPage />} />
        <Route path="pacientes/:pid" element={<PacienteMarco />}>
          <Route index element={<ResumenPaciente />} />
          <Route path="datos" element={<DatosPacientePage />} />
          <Route path="ingresos" element={<ListaIngresos />} />
          <Route path="ingresos/:id" element={<IngresoPage />} />
          <Route path="evaluaciones" element={<ListaEvaluaciones />} />
          <Route path="evaluaciones/:id" element={<EvaluacionPage />} />
          <Route path="sesiones" element={<ListaSesiones />} />
          <Route path="sesiones/:id" element={<SesionPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  const local = useMemo(() => new RepositorioLocal(), []);
  const remoto = useMemo(() => (supabase ? new RepositorioSupabase(supabase) : null), []);

  return (
    <BrowserRouter>
      {remoto ? (
        <Acceso>
          {(sesion) => (
            // key: al cambiar de usuario se recargan los datos desde cero.
            <DatosProvider key={sesion.user.id} repositorio={remoto}>
              <Rutas email={sesion.user.email} onSalir={() => supabase!.auth.signOut()} />
            </DatosProvider>
          )}
        </Acceso>
      ) : (
        <DatosProvider repositorio={local}>
          <Rutas />
        </DatosProvider>
      )}
    </BrowserRouter>
  );
}
