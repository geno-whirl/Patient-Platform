/**
 * Asigna una región anatómica aproximada a un punto del mapa corporal.
 *
 * Coordenadas normalizadas (0–1) sobre un lienzo de 100 × 220 unidades
 * (ver components/BodyFigure.tsx, que dibuja con las mismas medidas).
 *
 * Vista anterior: el paciente mira al observador, por lo que el lado
 * DERECHO del paciente aparece a la IZQUIERDA de la imagen.
 * Vista posterior: el lado derecho del paciente aparece a la derecha.
 * Vistas laterales: lateral_derecha muestra el lado derecho del paciente,
 * que mira hacia la derecha de la imagen; lateral_izquierda es su espejo.
 */
import type { VistaCuerpo } from './schema';

export const LIENZO = { ancho: 100, alto: 220 } as const;

type Lado = 'derecho' | 'izquierdo' | 'central' | '';

export interface RegionDetectada {
  region: string;
  lado: Lado;
}

function segmentoBrazo(y: number): string {
  if (y < 45) return 'hombro';
  if (y < 70) return 'brazo';
  if (y < 82) return 'codo';
  if (y < 110) return 'antebrazo';
  if (y < 116) return 'muñeca';
  return 'mano';
}

function segmentoPierna(y: number, vista: VistaCuerpo): string {
  const posterior = vista === 'posterior';
  if (y < 140) return posterior ? 'muslo posterior' : 'muslo';
  if (y < 158) return posterior ? 'hueco poplíteo' : 'rodilla';
  if (y < 192) return posterior ? 'pantorrilla' : 'pierna';
  if (y < 202) return 'tobillo';
  return posterior ? 'talón' : 'pie';
}

export function detectarRegion(vista: VistaCuerpo, xn: number, yn: number): RegionDetectada {
  const x = xn * LIENZO.ancho;
  const y = yn * LIENZO.alto;

  if (vista === 'lateral_derecha' || vista === 'lateral_izquierda') {
    const lado: Lado = vista === 'lateral_derecha' ? 'derecho' : 'izquierdo';
    // En lateral_derecha el frente del paciente queda a la derecha de la imagen.
    const frente = vista === 'lateral_derecha' ? x > 52 : x < 48;
    if (y < 23) return { region: 'cabeza', lado };
    if (y < 32) return { region: frente ? 'cuello' : 'zona cervical', lado };
    if (y < 45) return { region: 'hombro', lado };
    if (y < 104) {
      if (Math.abs(x - 50) < 5 && y < 112) return { region: segmentoBrazo(y), lado };
      if (y < 72) return { region: frente ? 'tórax' : 'zona dorsal', lado };
      if (y < 96) return { region: frente ? 'abdomen' : 'zona lumbar', lado };
      return { region: frente ? 'cadera' : 'glúteo', lado };
    }
    if (y < 120) return { region: 'cadera', lado };
    return { region: segmentoPierna(y, frente ? 'anterior' : 'posterior'), lado };
  }

  const posterior = vista === 'posterior';
  const ladoPorX = (xx: number): Lado => {
    if (Math.abs(xx - 50) < 3.5) return 'central';
    const izquierdaImagen = xx < 50;
    if (posterior) return izquierdaImagen ? 'izquierdo' : 'derecho';
    return izquierdaImagen ? 'derecho' : 'izquierdo';
  };
  const lado = ladoPorX(x);
  const ladoSinCentro: Lado = lado === 'central' ? '' : lado;

  if (y < 24) return { region: posterior ? 'cabeza (occipital)' : 'cabeza / cara', lado };
  if (y < 33) return { region: posterior ? 'zona cervical' : 'cuello', lado };

  const enBrazo = (x < 31 || x > 69) && y < 128;
  if (enBrazo) return { region: segmentoBrazo(y), lado: ladoSinCentro };

  if (y < 106) {
    if (y < 44 && Math.abs(x - 50) > 13) return { region: posterior ? 'escápula / hombro' : 'hombro', lado };
    if (posterior) {
      if (y < 72) return { region: 'zona dorsal', lado };
      if (y < 97) return { region: 'zona lumbar', lado };
      return { region: Math.abs(x - 50) < 4 ? 'sacro' : 'glúteo', lado };
    }
    if (y < 70) return { region: 'tórax', lado };
    if (y < 94) return { region: 'abdomen', lado };
    return { region: Math.abs(x - 50) < 8 ? 'pelvis / pubis' : 'cadera / ingle', lado };
  }

  return { region: segmentoPierna(y, vista), lado: ladoSinCentro };
}

export const ETIQUETAS_VISTA: Record<VistaCuerpo, string> = {
  anterior: 'Anterior',
  posterior: 'Posterior',
  lateral_derecha: 'Lateral der.',
  lateral_izquierda: 'Lateral izq.',
};
