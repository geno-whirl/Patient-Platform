import type { CategoriaEjercicio, EjercicioBiblioteca, Equipamiento, RegionEjercicio } from './schema';
import { sinTildes } from './clinica';

export const ETIQUETA_CATEGORIA: Record<CategoriaEjercicio, string> = {
  fuerza: 'Fuerza',
  potencia: 'Potencia',
  pliometria: 'Pliometría',
  movilidad: 'Movilidad',
  flexibilidad: 'Flexibilidad',
  estabilidad: 'Estabilidad / control motor',
  equilibrio: 'Equilibrio / propiocepción',
  neurodinamia: 'Neurodinamia',
  acondicionamiento: 'Acondicionamiento',
  respiratorio: 'Respiratorio',
};

export const ETIQUETA_REGION: Record<RegionEjercicio, string> = {
  cervical: 'Cervical',
  toracica: 'Torácica',
  lumbar: 'Lumbar',
  core: 'Core',
  hombro: 'Hombro',
  codo_muneca_mano: 'Codo / muñeca / mano',
  cadera: 'Cadera',
  rodilla: 'Rodilla',
  tobillo_pie: 'Tobillo / pie',
  tren_superior: 'Tren superior',
  tren_inferior: 'Tren inferior',
  cuerpo_completo: 'Cuerpo completo',
};

export const ETIQUETA_EQUIPAMIENTO: Record<Equipamiento, string> = {
  peso_corporal: 'Peso corporal',
  banda_elastica: 'Banda elástica',
  mini_banda: 'Mini banda',
  mancuerna: 'Mancuerna',
  kettlebell: 'Kettlebell',
  barra: 'Barra',
  polea: 'Polea',
  maquina: 'Máquina',
  balon_medicinal: 'Balón medicinal',
  fitball: 'Fitball',
  bosu: 'Bosu',
  superficie_inestable: 'Superficie inestable',
  cajon_step: 'Cajón / step',
  suspension: 'Suspensión (TRX)',
  foam_roller: 'Foam roller',
  baston: 'Bastón',
  disco_deslizante: 'Disco deslizante',
  escalera_agilidad: 'Escalera de agilidad',
  bicicleta: 'Bicicleta',
  otro: 'Otro',
};

/** "3 × 10 · RPE 7 · desc. 90 s" */
export function dosisLegible(e: { series: string; repeticiones: string; carga: string; descanso: string }): string {
  const volumen = e.series && e.repeticiones ? `${e.series} × ${e.repeticiones}` : e.repeticiones || e.series;
  return [volumen, e.carga, e.descanso && `desc. ${e.descanso}`].filter(Boolean).join(' · ');
}

export interface FiltroEjercicios {
  texto: string;
  categoria: CategoriaEjercicio | '';
  region: RegionEjercicio | '';
  equipamiento: Equipamiento | '';
  favoritos: boolean;
  archivados: boolean;
}

export const FILTRO_VACIO: FiltroEjercicios = { texto: '', categoria: '', region: '', equipamiento: '', favoritos: false, archivados: false };

export function filtrarEjercicios(lista: EjercicioBiblioteca[], f: FiltroEjercicios): EjercicioBiblioteca[] {
  const palabras = sinTildes(f.texto).split(/\s+/).filter(Boolean);
  return lista
    .filter((e) => {
      if (e.archivado !== f.archivados) return false;
      if (f.favoritos && !e.favorito) return false;
      if (f.categoria && e.categoria !== f.categoria) return false;
      if (f.region && !e.regiones.includes(f.region)) return false;
      if (f.equipamiento && !e.equipamiento.includes(f.equipamiento)) return false;
      if (palabras.length) {
        const pajar = sinTildes(
          [
            e.nombre,
            e.descripcion,
            e.etiquetas.join(' '),
            ETIQUETA_CATEGORIA[e.categoria],
            ...e.regiones.map((r) => ETIQUETA_REGION[r]),
            ...e.equipamiento.map((q) => ETIQUETA_EQUIPAMIENTO[q]),
          ].join(' '),
        );
        if (!palabras.every((p) => pajar.includes(p))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Primero los que tienen la búsqueda en el nombre; luego favoritos; luego alfabético.
      const enNombre = (e: EjercicioBiblioteca) => Number(palabras.every((p) => sinTildes(e.nombre).includes(p)));
      return enNombre(b) - enNombre(a) || Number(b.favorito) - Number(a.favorito) || a.nombre.localeCompare(b.nombre, 'es');
    });
}
