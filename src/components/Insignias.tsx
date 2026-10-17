import type { CSSProperties } from 'react';
import type { Centro } from '../domain/schema';
import { ETIQUETAS_ESTADO_PACIENTE, ETIQUETAS_ESTADO_SESION } from '../domain/clinica';

export function InsigniaCentro({ centro }: { centro?: Centro }) {
  if (!centro) return <span className="insignia">Sin centro</span>;
  return (
    <span className="insignia insignia--centro" style={{ '--c': centro.color } as CSSProperties}>
      {centro.nombre}
    </span>
  );
}

export function InsigniaEstadoPaciente({ estado }: { estado: string }) {
  return <span className={`insignia insignia--${estado}`}>{ETIQUETAS_ESTADO_PACIENTE[estado]}</span>;
}

export function InsigniaEstadoSesion({ estado }: { estado: string }) {
  return <span className={`insignia insignia--s-${estado}`}>{ETIQUETAS_ESTADO_SESION[estado]}</span>;
}
