/**
 * Catálogo base de ejercicios, plantillas de sesión y programas de tratamiento de ejemplo.
 *
 * Se carga en la biblioteca de cada usuario (ver `faltantesDelCatalogo`). Cada ejercicio
 * tiene un id determinista (UUID v5 de su nombre y del usuario), así que volver a cargar
 * el catálogo nunca duplica y las plantillas pueden referenciar ejercicios por id.
 *
 * Formato compacto de cada fila: [nombre, regiones, equipamiento, dosis, descripción, etiquetas?]
 * - regiones / equipamiento: códigos cortos separados por coma (ver REG y EQ).
 * - dosis: "series x repeticiones[@carga][|descanso]", ej. "4x6@RPE 7-8|2 min".
 */
import { aEjercicioSesion } from './catalogoSesion';
import { idEjercicio, idPlantilla, idPrograma, uuidV5 } from './uuid';
import type {
  BaseDeDatos,
  CategoriaEjercicio,
  EjercicioBiblioteca,
  Equipamiento,
  PlantillaSesion,
  ProgramaTratamiento,
  RegionEjercicio,
} from './schema';

const REG: Record<string, RegionEjercicio> = {
  c: 'cervical', t: 'toracica', l: 'lumbar', k: 'core', h: 'hombro', m: 'codo_muneca_mano',
  ca: 'cadera', r: 'rodilla', tp: 'tobillo_pie', ts: 'tren_superior', ti: 'tren_inferior', cc: 'cuerpo_completo',
};

const EQ: Record<string, Equipamiento> = {
  pc: 'peso_corporal', be: 'banda_elastica', mb: 'mini_banda', mn: 'mancuerna', kb: 'kettlebell', ba: 'barra',
  po: 'polea', mq: 'maquina', bm: 'balon_medicinal', fb: 'fitball', bo: 'bosu', si: 'superficie_inestable',
  cj: 'cajon_step', su: 'suspension', fr: 'foam_roller', bt: 'baston', dd: 'disco_deslizante',
  ea: 'escalera_agilidad', bi: 'bicicleta', ot: 'otro',
};

type Fila = [nombre: string, regiones: string, equipo: string, dosis: string, descripcion: string, etiquetas?: string];

const CATALOGO: Record<CategoriaEjercicio, Fila[]> = {
  fuerza: [
    // Tren inferior
    ['Sentadilla con peso corporal', 'ti,r,ca', 'pc', '3x12', 'Pies al ancho de hombros, cadera atrás, rodillas alineadas con los pies y tronco neutro.'],
    ['Sentadilla goblet', 'ti,r,ca', 'kb,mn', '3x10@RPE 7|90 s', 'Peso sostenido al pecho, codos por dentro de las rodillas; bajar controlado.'],
    ['Sentadilla trasera con barra', 'ti,cc', 'ba', '4x6@70-80% 1RM|2 min', 'Barra sobre trapecios, profundidad según tolerancia, rodillas siguen la línea de los pies.'],
    ['Sentadilla frontal con barra', 'ti,k', 'ba', '4x6@RPE 7-8|2 min', 'Barra sobre deltoides anteriores, codos altos, tronco más vertical.'],
    ['Sentadilla a cajón', 'ti,r', 'cj,pc', '3x10', 'Bajar hasta tocar el cajón sin descargar el peso; el cajón regula la profundidad.'],
    ['Sentadilla con mini banda en rodillas', 'ti,ca,r', 'mb', '3x12', 'Empujar las rodillas hacia afuera contra la banda; control del valgo dinámico.'],
    ['Sentadilla con banda bajo los pies', 'ti', 'be', '3x12', 'Banda bajo los pies y sobre los hombros; resistencia creciente al subir.'],
    ['Levantarse y sentarse de una silla', 'ti,r,ca', 'pc', '3x10', 'Sin apoyo de brazos si es posible; clave en adulto mayor y post-operatorio.', 'funcional,adulto-mayor'],
    ['Sentadilla búlgara', 'ti,r,ca', 'mn,cj', '3x8 c/lado@RPE 7|90 s', 'Pie trasero sobre un banco; descender vertical con la rodilla delantera alineada.', 'unilateral'],
    ['Sentadilla split estática', 'ti,r', 'pc,mn', '3x10 c/lado', 'Posición de estocada fija; bajar y subir sin mover los pies.', 'unilateral'],
    ['Sentadilla unipodal a cajón', 'ti,r,ca', 'cj', '3x6 c/lado', 'Sentarse en el cajón con una pierna, controlando pelvis y rodilla.', 'unilateral'],
    ['Sentadilla isométrica en pared', 'r,ti', 'pc', '4x30-45 s', 'Espalda en la pared, rodillas a 60-90°. Útil como analgesia en tendinopatía rotuliana.', 'isométrico'],
    ['Sentadilla isométrica en declive (Spanish squat)', 'r', 'be', '5x45 s', 'Cincha o banda firme detrás de las rodillas; tronco vertical, tibias verticales.', 'isométrico,tendinopatía'],
    ['Estocada frontal', 'ti,r,ca', 'pc,mn', '3x10 c/lado', 'Paso largo adelante, ambas rodillas a ~90°, tronco erguido.', 'unilateral'],
    ['Estocada reversa', 'ti,ca', 'pc,mn', '3x10 c/lado', 'Paso atrás; menor carga anterior sobre la rodilla que la estocada frontal.', 'unilateral'],
    ['Estocada lateral', 'ti,ca', 'pc,mn', '3x8 c/lado', 'Paso lateral, cadera atrás sobre la pierna que flexiona; aductores y glúteos.'],
    ['Estocada caminando', 'ti', 'pc,mn', '3x12 pasos', 'Estocadas alternas avanzando; control de rodilla y pelvis.'],
    ['Step-up a cajón', 'ti,r,ca', 'cj,mn', '3x10 c/lado', 'Subir empujando con la pierna de arriba, sin impulso de la de abajo.', 'unilateral'],
    ['Step-down lateral excéntrico', 'r,ti', 'cj', '3x10 c/lado', 'De pie en el escalón, bajar lento tocando con el talón contrario; controlar valgo y pelvis.', 'excéntrico'],
    ['Peso muerto rumano', 'ca,ti,l', 'ba,mn,kb', '3x8@RPE 7|90 s', 'Bisagra de cadera con rodillas semiflexionadas y columna neutra; tensión en isquiotibiales.'],
    ['Peso muerto convencional', 'ti,cc', 'ba', '4x5@RPE 7-8|2-3 min', 'Barra pegada al cuerpo, empujar el suelo, columna neutra durante todo el recorrido.'],
    ['Peso muerto unipodal', 'ca,ti', 'mn,kb,pc', '3x8 c/lado', 'Bisagra sobre una pierna con la pelvis nivelada; equilibrio y glúteo.', 'unilateral'],
    ['Peso muerto sumo con kettlebell', 'ca,ti', 'kb', '3x10', 'Base amplia, puntas hacia afuera, kettlebell entre los pies.'],
    ['Peso muerto rumano con banda', 'ca,ti', 'be', '3x12', 'Banda bajo los pies; bisagra de cadera con resistencia elástica.'],
    ['Good morning con banda', 'ca,l', 'be', '3x12', 'Banda bajo los pies y tras la nuca; bisagra de cadera con columna neutra.'],
    ['Puente de glúteos', 'ca,l', 'pc', '3x15', 'Leve retroversión pélvica y elevar la cadera sin hiperextender la zona lumbar.'],
    ['Puente de glúteos unipodal', 'ca', 'pc', '3x10 c/lado', 'Una pierna extendida; mantener la pelvis nivelada.', 'unilateral'],
    ['Hip thrust con barra', 'ca', 'ba,cj', '4x8@RPE 7-8|90 s', 'Escápulas apoyadas en banco; extensión completa de cadera con mentón recogido.'],
    ['Hip thrust con mini banda', 'ca', 'mb', '3x15', 'Banda sobre las rodillas, empujar hacia afuera durante la extensión.'],
    ['Patada de glúteo en cuadrupedia con banda', 'ca', 'mb,be', '3x12 c/lado', 'Extensión de cadera sin arquear la zona lumbar.'],
    ['Curl nórdico', 'ti,r', 'pc', '3x5', 'Tobillos fijos; descender lo más lento posible. Prevención de lesión de isquiotibiales.', 'excéntrico,prevención'],
    ['Puente isquiotibial en fitball', 'ca,r', 'fb', '3x10', 'Talones sobre el balón; elevar la cadera y flexionar las rodillas acercando el balón.'],
    ['Curl de isquiotibiales deslizante', 'r,ca', 'dd', '3x8', 'En puente, deslizar talones hacia afuera y volver manteniendo la cadera arriba.'],
    ['Curl femoral en máquina', 'r', 'mq', '3x10|90 s', 'Fase excéntrica lenta (3 s).'],
    ['Extensión de rodilla en máquina', 'r', 'mq', '3x10|90 s', 'Rango según indicación (ej. 90-45° en post-LCA temprano).'],
    ['Extensión de rodilla con banda en sedente', 'r', 'be', '3x15', 'Sentado, extender la rodilla contra la banda; sostener 2 s arriba.'],
    ['Cuádriceps isométrico (set de cuádriceps)', 'r', 'pc', '3x10 x 10 s', 'Contraer el cuádriceps presionando la rodilla contra la camilla. Post-operatorio inmediato.', 'isométrico,post-operatorio'],
    ['Elevación de pierna recta', 'r,ca', 'pc', '3x10', 'Contraer el cuádriceps antes de elevar; sin pérdida de extensión (lag).', 'post-operatorio'],
    ['Extensión terminal de rodilla con banda (TKE)', 'r', 'be', '3x15', 'Banda detrás de la rodilla; llevar a extensión completa. Cuádriceps / vasto medial.'],
    ['Prensa de piernas', 'ti', 'mq', '3x10|90 s', 'Pies al ancho de caderas; rango según tolerancia.'],
    ['Prensa unilateral', 'ti', 'mq', '3x8 c/lado', 'Detecta y corrige asimetrías de fuerza.', 'unilateral'],
    ['Abducción de cadera en decúbito lateral', 'ca', 'pc,mb', '3x15 c/lado', 'Pierna levemente en extensión, sin rotar la pelvis; glúteo medio.'],
    ['Almeja (clamshell) con mini banda', 'ca', 'mb', '3x15 c/lado', 'Decúbito lateral, rodillas flexionadas; abrir sin rotar la pelvis.'],
    ['Caminata lateral con mini banda', 'ca', 'mb', '3x10 pasos c/lado', 'Semisentadilla, pasos laterales manteniendo tensión en la banda.'],
    ['Abducción de cadera de pie con banda', 'ca', 'be,mb', '3x15 c/lado', 'De pie, separar la pierna sin inclinar el tronco.'],
    ['Extensión de cadera de pie con banda', 'ca', 'be', '3x15 c/lado', 'Llevar la pierna atrás sin compensar con la zona lumbar.'],
    ['Flexión de cadera con banda (marcha)', 'ca', 'mb,be', '3x12 c/lado', 'Elevar la rodilla contra la resistencia manteniendo el tronco estable.'],
    ['Aducción de cadera Copenhagen', 'ca,k', 'pc', '3x6-10 c/lado', 'Plancha lateral con la pierna superior apoyada en un banco. Prevención de pubalgia.', 'prevención'],
    ['Aducción de cadera con banda', 'ca', 'be', '3x12 c/lado', 'Llevar la pierna hacia la línea media contra la banda.'],
    ['Elevación de talones bipodal', 'tp', 'pc', '3x15', 'Subir y bajar controlado, peso en el primer dedo.'],
    ['Elevación de talones unipodal', 'tp', 'pc,mn', '3x12 c/lado', 'Rango completo; registrar repeticiones hasta la fatiga como medida de capacidad.', 'unilateral'],
    ['Elevación de talones sentado (sóleo)', 'tp', 'mn,mq', '3x15', 'Rodilla a 90° para enfatizar el sóleo.'],
    ['Excéntrico de gemelos en escalón (Alfredson)', 'tp', 'cj', '3x15 c/lado', 'Subir con ambas piernas y bajar lento con la afectada. Tendinopatía aquiliana.', 'excéntrico,tendinopatía'],
    ['Dorsiflexión de tobillo con banda', 'tp', 'be', '3x15', 'Llevar el pie hacia arriba contra la resistencia.'],
    ['Eversión de tobillo con banda', 'tp', 'be', '3x15', 'Peroneos; clave tras esguince lateral de tobillo.'],
    ['Inversión de tobillo con banda', 'tp', 'be', '3x15', 'Tibial posterior; control del arco.'],
    ['Flexión plantar con banda', 'tp', 'be', '3x15', 'Empujar la banda con el antepié en sedente largo.'],
    ['Pie corto (short foot)', 'tp', 'pc', '3x10 x 5 s', 'Acortar el pie elevando el arco sin flexionar los dedos. Musculatura intrínseca.'],
    ['Flexión de dedos con toalla', 'tp', 'ot', '3x1 min', 'Recoger una toalla con los dedos del pie.'],
    // Tren superior
    ['Flexión de brazos (push-up)', 'ts,h,k', 'pc', '3x10', 'Cuerpo alineado, codos a ~45° del tronco.'],
    ['Flexión de brazos inclinada', 'ts,h', 'pc,cj', '3x12', 'Manos en banco o pared; regresión del push-up.'],
    ['Flexión plus (push-up plus)', 'h', 'pc', '3x10', 'Al final del push-up, protracción escapular adicional. Serrato anterior.'],
    ['Press de banca con barra', 'ts', 'ba', '4x6@RPE 7-8|2 min', 'Escápulas retraídas, pies firmes, barra al esternón.'],
    ['Press de banca con mancuernas', 'ts,h', 'mn', '3x10|90 s', 'Mayor rango y trabajo de estabilidad que con barra.'],
    ['Press de pecho con banda', 'ts', 'be', '3x12', 'Banda anclada atrás; empuje horizontal.'],
    ['Press militar de pie', 'h,ts,k', 'ba,mn', '4x6@RPE 7|2 min', 'Glúteos y abdomen activos; sin hiperextender la zona lumbar.'],
    ['Press de hombro con banda', 'h', 'be', '3x12', 'Banda bajo los pies; empuje vertical.'],
    ['Press de hombro unilateral con kettlebell', 'h,k', 'kb', '3x8 c/lado', 'Antebrazo vertical; estabilidad escapular y de tronco.', 'unilateral'],
    ['Landmine press', 'h,ts', 'ba', '3x10 c/lado', 'Empuje en diagonal; buena opción con flexión de hombro limitada.'],
    ['Remo con mancuerna a una mano', 'ts,h', 'mn', '3x10 c/lado', 'Apoyo en banco; llevar el codo hacia la cadera sin rotar el tronco.', 'unilateral'],
    ['Remo invertido en suspensión', 'ts,h', 'su', '3x10', 'Cuerpo rígido; más horizontal = más difícil.'],
    ['Remo con banda elástica', 'ts,h', 'be', '3x15', 'Retracción escapular primero, luego tirar con los codos.'],
    ['Remo en polea sentado', 'ts', 'po', '3x12|90 s', 'Pecho alto, sin balancear el tronco.'],
    ['Jalón al pecho', 'ts,h', 'po,mq', '3x10|90 s', 'Depresión escapular antes de flexionar los codos.'],
    ['Dominadas', 'ts', 'pc', '3x5-8|2 min', 'Desde suspensión completa hasta mentón sobre la barra.'],
    ['Dominadas asistidas con banda', 'ts', 'be', '3x8', 'La banda reduce la carga; progresar a bandas más delgadas.'],
    ['Face pull con banda', 'h,t', 'be,po', '3x15', 'Tirar hacia la cara terminando en rotación externa. Manguito y escapulares.'],
    ['Pull-apart con banda', 'h,t', 'be', '3x15', 'Brazos extendidos al frente; separar la banda retrayendo escápulas.'],
    ['Rotación externa de hombro con banda', 'h', 'be', '3x15', 'Codo al costado con toalla bajo el brazo. Infraespinoso y redondo menor.'],
    ['Rotación interna de hombro con banda', 'h', 'be', '3x15', 'Codo al costado; subescapular.'],
    ['Rotación externa en decúbito lateral', 'h', 'mn', '3x12', 'Codo apoyado sobre una toalla; rango sin dolor.'],
    ['Rotación externa a 90° de abducción con banda', 'h', 'be', '3x12', 'Posición de lanzamiento; deportistas overhead.'],
    ['Isométrico de rotación externa en pared', 'h', 'pc', '5x30-45 s', 'Empujar el dorso de la mano contra la pared. Analgesia en tendinopatía del manguito.', 'isométrico'],
    ['Isométrico de abducción de hombro en pared', 'h', 'pc', '5x30 s', 'Empujar lateralmente contra la pared con el codo flexionado.', 'isométrico'],
    ['Elevación en el plano escapular (scaption)', 'h', 'mn', '3x12', 'Pulgar arriba, brazo a 30° por delante del plano frontal, hasta 90°.'],
    ['Elevación lateral', 'h', 'mn,be', '3x12', 'Hasta la altura de los hombros, sin elevar los hombros.'],
    ['Elevación frontal', 'h', 'mn', '3x12', 'Hasta la altura de los hombros, tronco estable.'],
    ['Y-T-W en prono', 'h,t', 'pc,mn', '2x10 c/u', 'Prono en camilla o banco inclinado; trapecio medio/inferior.'],
    ['Protracción escapular en supino (punch)', 'h', 'mn', '3x15', 'Brazo vertical; empujar el peso hacia el techo despegando la escápula.'],
    ['Wall slide con banda', 'h', 'be', '3x10', 'Antebrazos en la pared con banda en las muñecas; deslizar hacia arriba con rotación externa.'],
    ['Diagonal PNF D2 flexión con banda', 'h', 'be', '3x12', 'Desde cadera contraria hacia arriba y afuera (patrón de Kabat).'],
    ['Diagonal PNF D2 extensión con banda', 'h', 'be', '3x12', 'Desde arriba y afuera hacia la cadera contraria.'],
    ['Curl de bíceps', 'm', 'mn,be', '3x12', 'Codos fijos al costado.'],
    ['Curl martillo', 'm', 'mn', '3x12', 'Antebrazo en posición neutra; braquiorradial.'],
    ['Extensión de tríceps en polea', 'm', 'po,be', '3x12', 'Codos fijos; extensión completa.'],
    ['Fondos en banco', 'ts', 'cj', '3x10', 'Manos en el banco detrás; evitar si hay dolor anterior de hombro.'],
    ['Excéntrico de extensores de muñeca', 'm', 'mn,ot', '3x15', 'Bajar la mancuerna lento en 3-4 s. Epicondilalgia lateral.', 'excéntrico,tendinopatía'],
    ['Flexión y extensión de muñeca con mancuerna', 'm', 'mn', '3x15', 'Antebrazo apoyado; rango completo.'],
    ['Pronosupinación con mancuerna', 'm', 'mn', '3x15', 'Sostener la mancuerna de un extremo para aumentar el brazo de palanca.'],
    ['Prensión con masilla o pelota', 'm', 'ot', '3x1 min', 'Apretar y soltar; graduar dureza de la masilla.'],
    ['Paseo del granjero', 'cc,m,k', 'kb,mn', '4x30 m', 'Caminar con carga en ambas manos, postura erguida.'],
  ],
  potencia: [
    ['Kettlebell swing', 'ca,cc', 'kb', '4x15|90 s', 'Impulso desde la cadera (bisagra), no desde los brazos.'],
    ['Cargada de potencia', 'cc', 'ba', '5x3@70% 1RM|2-3 min', 'Triple extensión explosiva y recepción en cuarto de sentadilla.'],
    ['Cargada colgante (hang power clean)', 'cc', 'ba', '5x3|2 min', 'Desde la altura de los muslos; enfatiza la extensión de cadera.'],
    ['Push press', 'h,cc', 'ba,mn', '4x5|2 min', 'Semiflexión de rodillas e impulso de piernas para empujar la carga.'],
    ['Thruster', 'cc', 'mn,ba', '3x8|90 s', 'Sentadilla frontal seguida de press sobre la cabeza en un solo movimiento.'],
    ['Sentadilla con salto cargada', 'ti', 'mn,ba', '4x5@20-30% 1RM|2 min', 'Máxima velocidad de ejecución con carga ligera.'],
    ['Lanzamiento de balón medicinal al pecho', 'ts', 'bm', '4x6|60 s', 'Contra la pared o a un compañero; máxima velocidad.'],
    ['Slam con balón medicinal', 'cc,k', 'bm', '4x8|60 s', 'Elevar el balón sobre la cabeza y lanzarlo al suelo con fuerza.'],
    ['Lanzamiento rotacional de balón medicinal', 'k,cc', 'bm', '3x6 c/lado', 'De lado a la pared; rotación desde caderas.'],
    ['Lanzamiento hacia atrás sobre la cabeza', 'cc', 'bm', '4x5', 'Desde semisentadilla, extensión explosiva lanzando el balón hacia atrás.'],
    ['Sprint corto', 'ti,cc', 'pc', '6x20 m|90 s', 'Máxima velocidad con recuperación completa.'],
    ['Arrastre de trineo', 'ti,cc', 'ot', '6x15 m|90 s', 'Empuje o arrastre con carga; aceleración.'],
    ['Rotación externa pliométrica con balón', 'h', 'bm', '3x10', 'Prono con el brazo a 90°; soltar y atrapar un balón liviano. Deportistas de lanzamiento.'],
  ],
  pliometria: [
    ['Saltos bipodales en el lugar (pogo)', 'tp', 'pc', '3x20', 'Rodillas casi extendidas, contactos breves y rígidos del tobillo.'],
    ['Aterrizaje desde cajón (drop landing)', 'ti,r', 'cj', '3x6', 'Educación del aterrizaje: rodillas sobre los pies, flexión de cadera, sin ruido.'],
    ['Salto vertical con contramovimiento', 'ti', 'pc', '4x5|60 s', 'Máxima altura; aterrizaje suave y estable.'],
    ['Salto al cajón', 'ti', 'cj', '4x5|60 s', 'Aterrizaje suave arriba; bajar caminando.'],
    ['Salto en profundidad (drop jump)', 'ti', 'cj', '3x5|2 min', 'Caer del cajón y rebotar con el menor tiempo de contacto. Nivel avanzado.'],
    ['Saltos laterales sobre línea', 'tp,ti', 'pc', '3x20 s', 'Bipodal, rápido y con poco tiempo de contacto.'],
    ['Saltos unipodales en el lugar', 'tp', 'pc', '3x10 c/lado', 'Progresión del pogo a una pierna.', 'unilateral'],
    ['Salto horizontal con aterrizaje estable', 'ti', 'pc', '4x5', 'Saltar hacia adelante y sostener el aterrizaje 2 s; control del valgo.'],
    ['Saltos de tijera', 'ti', 'pc', '3x8 c/lado', 'Desde estocada, saltar y cambiar de pierna en el aire.'],
    ['Saltos de patinador (skater)', 'ti,ca', 'pc', '3x8 c/lado', 'Salto lateral a una pierna con aterrizaje estable.', 'unilateral'],
    ['Saltos alternos (bounding)', 'ti', 'pc', '3x20 m', 'Zancadas saltadas exagerando el tiempo de vuelo.'],
    ['Triple salto unipodal (triple hop)', 'ti', 'pc', '3x3 c/lado', 'Tres saltos consecutivos a una pierna; también como test de retorno deportivo.', 'unilateral,test'],
    ['Salto unipodal en zigzag (crossover hop)', 'ti', 'pc', '3x3 c/lado', 'Saltos a una pierna cruzando una línea hacia adelante.', 'unilateral,test'],
    ['Saltos sobre vallas', 'ti', 'ot', '4x5', 'Vallas bajas consecutivas, contacto breve.'],
    ['Saltos con rodillas al pecho (tuck jump)', 'ti', 'pc', '3x6', 'Llevar las rodillas al pecho; vigilar la técnica de aterrizaje.'],
    ['Escalera de agilidad: pies rápidos', 'tp,ti', 'ea', '4x2 pasadas', 'Dos pies en cada espacio a máxima frecuencia.'],
    ['Flexión de brazos pliométrica', 'ts', 'pc', '3x5', 'Despegar las manos del suelo; aterrizar con codos semiflexionados.'],
    ['Lanzamiento a la pared sobre la cabeza', 'h,ts', 'bm', '3x10', 'Balón liviano, lanzar y recibir con ambas manos sobre la cabeza.'],
  ],
  movilidad: [
    ['Gato-camello', 'l,t', 'pc', '2x10', 'En cuadrupedia, alternar flexión y extensión de columna segmento a segmento.'],
    ['Rotación torácica en cuadrupedia', 't', 'pc', '2x10 c/lado', 'Mano en la nuca, rotar llevando el codo hacia el techo.'],
    ['Libro abierto (rotación torácica en decúbito lateral)', 't', 'pc', '2x10 c/lado', 'Rodillas flexionadas juntas; abrir el brazo superior siguiéndolo con la mirada.'],
    ['Extensión torácica sobre foam roller', 't', 'fr', '2x10', 'Rodillo bajo la columna torácica, manos en la nuca; extender por segmentos.'],
    ['Movilidad de tobillo rodilla a la pared', 'tp', 'pc', '3x10 c/lado', 'Llevar la rodilla a la pared sin despegar el talón; medir la distancia pie-pared.', 'test'],
    ['Movilización de tobillo con banda', 'tp', 'be', '3x10 c/lado', 'Banda tirando el astrágalo hacia atrás mientras se lleva la rodilla adelante.'],
    ['CARs de cadera', 'ca', 'pc', '2x5 c/lado', 'Círculo de máxima amplitud controlada en cuadrupedia o de pie.'],
    ['CARs de hombro', 'h', 'pc', '2x5 c/lado', 'Círculo lento de máxima amplitud con el resto del cuerpo quieto.'],
    ['Rotaciones de cadera 90/90', 'ca', 'pc', '2x8 c/lado', 'Sentado con ambas caderas a 90°, alternar rotaciones sin usar las manos.'],
    ['Estiramiento del mejor del mundo (world’s greatest stretch)', 'ca,t', 'pc', '2x5 c/lado', 'Estocada profunda, codo al empeine y rotación torácica.'],
    ['Péndulo de Codman', 'h', 'pc', '3x1 min', 'Tronco inclinado, brazo colgando relajado; oscilaciones suaves. Post-operatorio / capsulitis.', 'post-operatorio'],
    ['Flexión de hombro asistida con bastón', 'h', 'bt', '2x10', 'Supino; el brazo sano ayuda a elevar el afectado.'],
    ['Rotación externa asistida con bastón', 'h', 'bt', '2x10', 'Codo al costado; empujar con el bastón desde el lado sano.'],
    ['Deslizamiento en pared (wall slide)', 'h', 'pc', '2x10', 'Deslizar las manos por la pared hacia arriba; ganancia de flexión.'],
    ['Deslizamiento de talón (heel slides)', 'r', 'pc', '3x15', 'Supino, flexionar la rodilla deslizando el talón. ROM post-operatorio.', 'post-operatorio'],
    ['Bicicleta estática para rango de rodilla', 'r', 'bi', '1x10 min', 'Medios giros hasta lograr el giro completo; sillín alto al inicio.'],
    ['Extensión pasiva de rodilla con talón elevado', 'r', 'ot', '3x5 min', 'Talón sobre una toalla enrollada, rodilla suspendida; recuperar la extensión completa.', 'post-operatorio'],
    ['Movilidad cervical activa', 'c', 'pc', '2x10 c/dirección', 'Flexión, extensión, rotaciones e inclinaciones lentas sin dolor.'],
    ['Extensión lumbar en prono (McKenzie)', 'l', 'pc', '3x10', 'Prono, extender codos manteniendo la pelvis apoyada. Preferencia direccional en extensión.'],
    ['Rodillas al pecho en supino', 'l', 'pc', '3x10', 'Flexión lumbar suave llevando ambas rodillas al pecho.'],
    ['Rotación lumbar en supino (limpiaparabrisas)', 'l', 'pc', '2x10', 'Rodillas juntas a un lado y al otro, hombros apoyados.'],
    ['Retroversión y anteversión pélvica', 'l,k', 'pc', '2x15', 'Supino o sedente; disociar pelvis de columna.'],
    ['Movilidad de muñeca', 'm', 'pc', '2x10', 'Círculos, flexión-extensión y desviaciones activas.'],
    ['Deslizamiento de tendones flexores de la mano', 'm', 'pc', '2x10', 'Secuencia: mano abierta, gancho, puño completo, puño recto. Post-operatorio de mano / túnel carpiano.'],
    ['Movilidad escapular', 'h,t', 'pc', '2x10', 'Elevación, depresión, protracción y retracción controladas.'],
    ['Sentadilla profunda sostenida', 'ca,tp,r', 'pc', '3x30 s', 'Talones apoyados, codos empujando las rodillas hacia afuera.'],
    ['Liberación con foam roller: cuádriceps', 'r,ca', 'fr', '1x60-90 s', 'Rodar lento; detenerse en zonas sensibles.', 'autoliberación'],
    ['Liberación con foam roller: isquiotibiales', 'ca,r', 'fr', '1x60-90 s c/lado', 'Rodar desde el glúteo hasta sobre la rodilla.', 'autoliberación'],
    ['Liberación con foam roller: gemelos', 'tp', 'fr', '1x60-90 s c/lado', 'Cruzar una pierna sobre la otra para aumentar la presión.', 'autoliberación'],
    ['Liberación con foam roller: glúteo', 'ca', 'fr', '1x60-90 s c/lado', 'Sentado sobre el rodillo con el tobillo cruzado sobre la rodilla.', 'autoliberación'],
    ['Liberación con foam roller: dorsal ancho', 'h,t', 'fr', '1x60 s c/lado', 'Decúbito lateral con el brazo extendido sobre la cabeza.', 'autoliberación'],
  ],
  flexibilidad: [
    ['Estiramiento de isquiotibiales en supino con banda', 'ca,r', 'be', '3x30 s c/lado', 'Pierna extendida elevada con la banda en el pie; rodilla recta.'],
    ['Estiramiento de isquiotibiales de pie', 'ca,r', 'pc', '3x30 s c/lado', 'Talón en un escalón bajo, bisagra de cadera con la columna neutra.'],
    ['Estiramiento de cuádriceps de pie', 'r,ca', 'pc', '3x30 s c/lado', 'Talón al glúteo, rodillas juntas y pelvis en retroversión.'],
    ['Estiramiento de flexores de cadera en semiarrodillado', 'ca', 'pc', '3x30 s c/lado', 'Rodilla atrás apoyada; retroversión pélvica y glúteo contraído.'],
    ['Estiramiento de psoas en borde de camilla (Thomas)', 'ca', 'pc', '3x30 s c/lado', 'Abrazar una rodilla y dejar caer la pierna contraria fuera de la camilla.'],
    ['Estiramiento de gemelo en pared', 'tp', 'pc', '3x30 s c/lado', 'Pierna atrás extendida con el talón apoyado.'],
    ['Estiramiento de sóleo', 'tp', 'pc', '3x30 s c/lado', 'Como el de gemelo pero con la rodilla de atrás flexionada.'],
    ['Estiramiento de piriforme (figura 4)', 'ca', 'pc', '3x30 s c/lado', 'Supino, tobillo sobre la rodilla contraria; acercar el muslo al pecho.'],
    ['Estiramiento de glúteo en supino', 'ca', 'pc', '3x30 s c/lado', 'Llevar la rodilla hacia el hombro contrario.'],
    ['Estiramiento de aductores en mariposa', 'ca', 'pc', '3x30 s', 'Sentado con las plantas juntas, rodillas hacia el suelo.'],
    ['Estiramiento de aductores en rana', 'ca', 'pc', '3x30 s', 'Cuadrupedia con rodillas separadas; llevar la cadera atrás.'],
    ['Estiramiento de banda iliotibial', 'ca,r', 'pc', '3x30 s c/lado', 'De pie, cruzar la pierna atrás e inclinar el tronco hacia el lado contrario.'],
    ['Estiramiento de pectoral en marco de puerta', 'h,t', 'pc', '3x30 s', 'Antebrazos en el marco a 90°; avanzar el tronco.'],
    ['Estiramiento de dorsal ancho', 'h,t', 'pc', '3x30 s c/lado', 'Manos sobre un banco o pared, llevar la cadera atrás.'],
    ['Estiramiento posterior de hombro (cross-body)', 'h', 'pc', '3x30 s c/lado', 'Cruzar el brazo por delante del pecho, escápula estabilizada.'],
    ['Sleeper stretch', 'h', 'pc', '3x30 s', 'Decúbito lateral sobre el hombro afectado; rotación interna suave. Déficit de RI (GIRD).'],
    ['Estiramiento de tríceps sobre la cabeza', 'h,m', 'pc', '3x30 s c/lado', 'Codo flexionado sobre la cabeza, la otra mano lo empuja hacia atrás.'],
    ['Estiramiento de trapecio superior', 'c', 'pc', '3x30 s c/lado', 'Inclinar la cabeza al lado contrario con el hombro descendido.'],
    ['Estiramiento de elevador de la escápula', 'c', 'pc', '3x30 s c/lado', 'Mirar hacia la axila contraria y flexionar suavemente.'],
    ['Estiramiento de escalenos', 'c', 'pc', '3x30 s c/lado', 'Fijar la clavícula, inclinar y extender levemente el cuello hacia el lado contrario.'],
    ['Estiramiento de flexores de muñeca', 'm', 'pc', '3x30 s', 'Codo extendido, extender la muñeca con la otra mano.'],
    ['Estiramiento de extensores de muñeca', 'm', 'pc', '3x30 s', 'Codo extendido, flexionar la muñeca con la otra mano.'],
    ['Estiramiento de fascia plantar', 'tp', 'pc', '3x30 s', 'Extender los dedos del pie con la mano, tobillo en dorsiflexión.'],
    ['Postura del niño', 'l,t', 'pc', '3x30 s', 'De rodillas, sentarse sobre los talones con los brazos extendidos adelante.'],
    ['Estiramiento lateral de tronco (cuadrado lumbar)', 'l', 'pc', '3x30 s c/lado', 'De pie o sentado, inclinación lateral con el brazo sobre la cabeza.'],
  ],
  estabilidad: [
    ['Plancha frontal', 'k', 'pc', '3x30-45 s', 'Antebrazos y puntas de pie, cuerpo alineado sin hundir la zona lumbar.'],
    ['Plancha lateral', 'k,ca', 'pc', '3x20-30 s c/lado', 'Cuerpo alineado sobre el antebrazo; cuadrado lumbar y oblicuos.'],
    ['Plancha lateral con rodillas flexionadas', 'k', 'pc', '3x20 s c/lado', 'Regresión de la plancha lateral.'],
    ['Plancha con toque de hombro', 'k,h', 'pc', '3x10 c/lado', 'Desde plancha alta, tocar el hombro contrario sin rotar la pelvis.'],
    ['Plancha sobre fitball', 'k', 'fb', '3x20-30 s', 'Antebrazos sobre el balón; mayor demanda de estabilidad.'],
    ['Dead bug', 'k,l', 'pc', '3x8 c/lado', 'Zona lumbar apoyada; extender brazo y pierna contrarios.'],
    ['Bird dog (cuadrupedia)', 'k,l', 'pc', '3x8 c/lado', 'Extender brazo y pierna contrarios sin rotar la pelvis.'],
    ['Pallof press con banda', 'k', 'be,po', '3x10 c/lado', 'Antirrotación: extender los brazos al frente resistiendo la rotación.'],
    ['Pallof isométrico', 'k', 'be', '3x20 s c/lado', 'Mantener los brazos extendidos resistiendo la tracción lateral.', 'isométrico'],
    ['Curl-up de McGill', 'k', 'pc', '3x8 x 10 s', 'Una rodilla flexionada, manos bajo la zona lumbar; elevar levemente cabeza y hombros.'],
    ['Activación de transverso abdominal', 'k,l', 'pc', '3x10 x 10 s', 'Supino; contraer suavemente el abdomen bajo sin mover la pelvis.'],
    ['Puente con marcha', 'k,ca', 'pc', '3x10 c/lado', 'En puente, elevar alternadamente un pie sin que caiga la pelvis.'],
    ['Rollout con fitball', 'k', 'fb', '3x8', 'Rodillas en el suelo, rodar el balón hacia adelante sin arquear la zona lumbar.'],
    ['Stir the pot en fitball', 'k', 'fb', '3x30 s', 'Plancha sobre el balón dibujando círculos con los antebrazos.'],
    ['Hollow hold', 'k', 'pc', '3x20 s', 'Supino, zona lumbar pegada al suelo, brazos y piernas elevados.'],
    ['Superman alterno en prono', 'l', 'pc', '3x10 c/lado', 'Elevar brazo y pierna contrarios sin hiperextender.'],
    ['Carga unilateral caminando (suitcase carry)', 'k', 'kb,mn', '4x20 m c/lado', 'Peso en una mano; tronco vertical sin inclinarse.'],
    ['Leñador con polea o banda (chop)', 'k', 'po,be', '3x10 c/lado', 'Diagonal desde arriba hacia la cadera contraria, tronco estable.'],
    ['Levantamiento diagonal con polea o banda (lift)', 'k', 'po,be', '3x10 c/lado', 'Diagonal desde abajo hacia arriba y al lado contrario.'],
    ['Disociación lumbopélvica en cuadrupedia (rock back)', 'l,ca', 'pc', '3x10', 'Llevar la cadera hacia los talones manteniendo la columna neutra.'],
    ['Estabilización escapular en cuadrupedia', 'h,t', 'pc', '3x10', 'Protracción y retracción escapular con codos extendidos.'],
    ['Flexores profundos cervicales (cráneo-cervical)', 'c', 'pc,ot', '3x10 x 10 s', 'Asentimiento suave en supino; con biofeedback de presión 22-30 mmHg si se dispone.'],
    ['Retracción cervical (chin tuck)', 'c', 'pc', '3x10', 'Llevar el mentón hacia atrás sin flexionar la cabeza.'],
    ['Isométricos cervicales multidireccionales', 'c', 'pc', '3x5 x 10 s c/dirección', 'Mano contra la cabeza en flexión, extensión e inclinaciones, sin movimiento.', 'isométrico'],
    ['Mountain climbers lentos', 'k', 'pc', '3x10 c/lado', 'Desde plancha alta, llevar la rodilla al pecho sin elevar la cadera.'],
  ],
  equilibrio: [
    ['Apoyo unipodal estático', 'tp,ti', 'pc', '3x30 s c/lado', 'Progresar: ojos cerrados, mover la cabeza, superficie inestable.'],
    ['Apoyo unipodal con ojos cerrados', 'tp,ti', 'pc', '3x20 s c/lado', 'Con un apoyo cercano por seguridad.'],
    ['Apoyo unipodal en superficie inestable', 'tp,r', 'si,bo', '3x30 s c/lado', 'Cojín, colchoneta o bosu; rodilla levemente flexionada.'],
    ['Apoyo unipodal con perturbaciones', 'tp,ti', 'bm', '3x30 s c/lado', 'Lanzar y recibir un balón, o empujes suaves del terapeuta.'],
    ['Star Excursion / Y-Balance', 'ti,tp', 'pc', '3x3 c/dirección', 'En apoyo unipodal, alcanzar lo más lejos posible en tres direcciones con la otra pierna.', 'test'],
    ['Alcances unipodales en reloj', 'ti', 'pc', '2x1 vuelta c/lado', 'Tocar con el pie libre las horas del reloj manteniendo el equilibrio.'],
    ['Apoyo unipodal con movimientos de la pierna libre', 'ti,ca', 'pc,mb', '3x10 c/lado', 'Flexión, abducción y extensión de la pierna libre (con banda si se tolera).'],
    ['Marcha en tándem', 'tp,cc', 'pc', '3x10 m', 'Punta-talón sobre una línea; adulto mayor y vestibular.', 'adulto-mayor'],
    ['Sentadilla sobre bosu', 'ti', 'bo', '3x10', 'Lado plano o domo según el nivel.'],
    ['Equilibrio en tabla basculante', 'tp', 'si', '3x30 s', 'Bipodal y luego unipodal; controlar las oscilaciones.'],
    ['Transferencias de peso', 'ti', 'pc', '3x10', 'De pie, llevar el peso adelante-atrás y a los lados sin despegar los pies.', 'adulto-mayor'],
    ['Marcha con obstáculos', 'cc', 'ot', '3x2 pasadas', 'Pasar por sobre conos o vallas bajas; cambios de dirección.', 'adulto-mayor'],
  ],
  neurodinamia: [
    ['Deslizamiento neural del ciático en sedente', 'l,ti', 'pc', '2x10', 'Extender la rodilla mientras se extiende el cuello y viceversa, sin tensión.', 'slider'],
    ['Tensor neural del ciático', 'l,ti', 'pc', '2x5', 'Extensión de rodilla con flexión cervical; usar solo si se tolera bien.', 'tensioner'],
    ['Deslizamiento neural del femoral en decúbito lateral', 'ca,r', 'pc', '2x10', 'Flexión de rodilla con extensión de cadera alternando con flexión cervical.', 'slider'],
    ['Deslizamiento del nervio mediano', 'm,c', 'pc', '2x10', 'Extender muñeca y codo mientras se inclina el cuello hacia el mismo lado.', 'slider'],
    ['Deslizamiento del nervio radial', 'm,c', 'pc', '2x10', 'Depresión del hombro, extensión de codo y flexión de muñeca con pronación.', 'slider'],
    ['Deslizamiento del nervio cubital', 'm,c', 'pc', '2x10', 'Mano hacia la oreja (flexión de codo y extensión de muñeca) alternando con inclinación cervical.', 'slider'],
  ],
  acondicionamiento: [
    ['Bicicleta estática', 'cc,ti', 'bi', '1x15-30 min@RPE 4-6', 'Ejercicio aeróbico de bajo impacto.'],
    ['Intervalos en bicicleta', 'cc', 'bi', '8x30 s@RPE 8-9|90 s', 'Alta intensidad con recuperación activa.'],
    ['Caminata', 'cc', 'pc', '1x20-30 min', 'Ritmo que permita hablar; progresar duración antes que velocidad.'],
    ['Retorno al trote (caminar/trotar)', 'cc,ti', 'pc', '6x(2 min caminar + 1 min trotar)', 'Progresar aumentando el tiempo de trote si no hay dolor al día siguiente.'],
    ['Elíptica', 'cc', 'mq', '1x15-20 min', 'Sin impacto; útil en lesiones de miembro inferior.'],
    ['Remoergómetro', 'cc', 'mq', '1x10-15 min', 'Secuencia piernas-tronco-brazos.'],
    ['Ergómetro de brazos', 'ts', 'mq', '1x10 min', 'Alternativa aeróbica con lesión de miembro inferior.'],
    ['Subir y bajar escaleras', 'ti', 'cj', '3x2 tramos', 'Con o sin pasamanos; capacidad funcional.', 'funcional'],
    ['Jumping jacks', 'cc', 'pc', '3x30 s', 'Calentamiento general.'],
    ['Mountain climbers', 'cc,k', 'pc', '3x30 s', 'Ritmo rápido desde plancha alta.'],
  ],
  respiratorio: [
    ['Respiración diafragmática', 'k', 'pc', '3x10 respiraciones', 'Mano en el abdomen; inspiración nasal expandiendo el abdomen y espiración lenta.'],
    ['Respiración con labios fruncidos', '', 'pc', '3x10 respiraciones', 'Inspirar por la nariz y espirar lento por los labios fruncidos (el doble del tiempo).'],
    ['Expansión costal localizada', 't', 'pc', '3x10 respiraciones', 'Manos en las costillas inferiores; dirigir la inspiración hacia ellas.'],
    ['Respiración en posición 90-90', 'l,k', 'pc', '3x5 respiraciones', 'Supino con los pies en la pared, caderas y rodillas a 90°; espiración completa.'],
    ['Inspirómetro incentivo', '', 'ot', '3x10', 'Inspiración lenta y profunda sosteniendo 3 s; post-operatorio.', 'post-operatorio'],
    ['Respiración de relajación 4-6', '', 'pc', '5 min', 'Inspirar en 4 tiempos y espirar en 6; regulación y manejo del dolor.'],
  ],
};

/** Plantillas de ejemplo: [nombre, descripción, objetivos, ejercicios (por nombre del catálogo)]. */
const PLANTILLAS: [string, string, string, string[]][] = [
  [
    'Rodilla post-LCA · fase inicial',
    'Primeras semanas tras reconstrucción de LCA. Ajustar rangos y cargas según el protocolo del cirujano.',
    'Control de dolor y edema; extensión completa; activación de cuádriceps; marcha sin ayudas técnicas.',
    ['Cuádriceps isométrico (set de cuádriceps)', 'Elevación de pierna recta', 'Deslizamiento de talón (heel slides)', 'Extensión pasiva de rodilla con talón elevado', 'Extensión terminal de rodilla con banda (TKE)', 'Bicicleta estática para rango de rodilla', 'Puente de glúteos', 'Elevación de talones bipodal', 'Apoyo unipodal estático'],
  ],
  [
    'Lumbalgia inespecífica · control motor',
    'Dolor lumbar sin signos de alarma. Priorizar movimiento sin miedo y progresar a carga.',
    'Disminuir dolor; mejorar control lumbopélvico y confianza en el movimiento.',
    ['Respiración en posición 90-90', 'Gato-camello', 'Dead bug', 'Bird dog (cuadrupedia)', 'Puente de glúteos', 'Plancha lateral con rodillas flexionadas', 'Curl-up de McGill', 'Caminata'],
  ],
  [
    'Hombro · manguito rotador inicial',
    'Tendinopatía del manguito rotador / dolor subacromial. Progresar de isométricos a isotónicos.',
    'Analgesia; recuperar rango; fuerza de rotadores y estabilizadores escapulares.',
    ['Péndulo de Codman', 'Isométrico de rotación externa en pared', 'Rotación externa de hombro con banda', 'Rotación interna de hombro con banda', 'Elevación en el plano escapular (scaption)', 'Remo con banda elástica', 'Flexión de brazos inclinada', 'Estiramiento posterior de hombro (cross-body)'],
  ],
  [
    'Tobillo · esguince lateral fase 2',
    'Esguince lateral con marcha normal y dolor controlado.',
    'Recuperar dorsiflexión; fuerza de peroneos y tríceps sural; control neuromuscular.',
    ['Movilidad de tobillo rodilla a la pared', 'Eversión de tobillo con banda', 'Elevación de talones unipodal', 'Apoyo unipodal en superficie inestable', 'Star Excursion / Y-Balance', 'Saltos bipodales en el lugar (pogo)'],
  ],
  [
    'Adulto mayor · fuerza y equilibrio',
    'Prevención de caídas y mantención de la funcionalidad. Supervisar la seguridad en los ejercicios de equilibrio.',
    'Fuerza de miembros inferiores; equilibrio estático y dinámico; confianza en la marcha.',
    ['Levantarse y sentarse de una silla', 'Elevación de talones bipodal', 'Abducción de cadera de pie con banda', 'Step-up a cajón', 'Marcha en tándem', 'Apoyo unipodal estático', 'Transferencias de peso', 'Remo con banda elástica', 'Caminata'],
  ],
  [
    'Retorno al deporte · pliometría base',
    'Introducción a la pliometría tras lesión de miembro inferior, con fuerza y control de aterrizaje previos.',
    'Tolerancia al impacto; técnica de aterrizaje; potencia y control unipodal.',
    ['Saltos bipodales en el lugar (pogo)', 'Aterrizaje desde cajón (drop landing)', 'Salto vertical con contramovimiento', 'Salto al cajón', 'Saltos laterales sobre línea', 'Salto horizontal con aterrizaje estable', 'Saltos de patinador (skater)', 'Triple salto unipodal (triple hop)'],
  ],
  [
    'Tendinopatía rotuliana · carga progresiva',
    'Fase de isométricos y fuerza lenta pesada. Monitorear el dolor durante y 24 h después (≤ 3/10).',
    'Analgesia; aumentar la capacidad de carga del tendón.',
    ['Sentadilla isométrica en declive (Spanish squat)', 'Extensión de rodilla en máquina', 'Sentadilla a cajón', 'Step-down lateral excéntrico', 'Hip thrust con barra', 'Elevación de talones unipodal'],
  ],
];

/**
 * Programas de tratamiento de ejemplo, por fases: [título, n° de sesiones, objetivos, ejercicios].
 * Son una guía: el kinesiólogo ajusta dosis y progresiones según la respuesta del paciente.
 */
interface ProgramaBase {
  nombre: string;
  descripcion: string;
  porSemana: number;
  fases: [titulo: string, sesiones: number, objetivos: string, ejercicios: string[]][];
}

const PROGRAMAS: ProgramaBase[] = [
  {
    nombre: 'Manguito rotador · 10 sesiones',
    descripcion:
      'Tendinopatía del manguito rotador / dolor subacromial sin rotura completa. Progresar de fase cuando el dolor durante el ejercicio sea ≤ 3/10 y no aumente al día siguiente.',
    porSemana: 2,
    fases: [
      ['Fase 1 · analgesia y rango', 3, 'Disminuir el dolor; recuperar rango de movimiento sin dolor; educación sobre carga.', ['Péndulo de Codman', 'Isométrico de rotación externa en pared', 'Isométrico de abducción de hombro en pared', 'Flexión de hombro asistida con bastón', 'Rotación externa asistida con bastón', 'Movilidad escapular']],
      ['Fase 2 · fuerza del manguito y escapulares', 4, 'Fuerza de rotadores externos e internos; control escapular; flexibilidad posterior.', ['Rotación externa de hombro con banda', 'Rotación interna de hombro con banda', 'Elevación en el plano escapular (scaption)', 'Remo con banda elástica', 'Protracción escapular en supino (punch)', 'Wall slide con banda', 'Estiramiento posterior de hombro (cross-body)', 'Sleeper stretch']],
      ['Fase 3 · fuerza funcional y retorno', 3, 'Fuerza en posiciones funcionales y sobre la cabeza; retorno a actividades y deporte.', ['Rotación externa a 90° de abducción con banda', 'Face pull con banda', 'Flexión plus (push-up plus)', 'Press de hombro unilateral con kettlebell', 'Remo con mancuerna a una mano', 'Diagonal PNF D2 flexión con banda', 'Y-T-W en prono']],
    ],
  },
  {
    nombre: 'Lumbalgia inespecífica · 8 sesiones',
    descripcion:
      'Dolor lumbar sin signos de alarma. Enfoque activo: educación en dolor, movimiento sin miedo y progresión a carga.',
    porSemana: 2,
    fases: [
      ['Fase 1 · educación y movimiento', 2, 'Reducir el miedo al movimiento; recuperar movilidad; mantenerse activo.', ['Respiración en posición 90-90', 'Gato-camello', 'Rotación lumbar en supino (limpiaparabrisas)', 'Rodillas al pecho en supino', 'Caminata']],
      ['Fase 2 · control motor', 3, 'Control lumbopélvico y resistencia de la musculatura del tronco.', ['Disociación lumbopélvica en cuadrupedia (rock back)', 'Dead bug', 'Bird dog (cuadrupedia)', 'Puente de glúteos', 'Plancha lateral con rodillas flexionadas', 'Curl-up de McGill']],
      ['Fase 3 · carga y función', 3, 'Tolerancia a la carga en tareas de la vida diaria y el trabajo.', ['Peso muerto rumano', 'Sentadilla goblet', 'Pallof press con banda', 'Carga unilateral caminando (suitcase carry)', 'Plancha lateral', 'Hip thrust con barra']],
    ],
  },
  {
    nombre: 'Esguince lateral de tobillo · 8 sesiones',
    descripcion: 'Esguince lateral grado I-II. Progresar según dolor, edema y control en apoyo unipodal.',
    porSemana: 2,
    fases: [
      ['Fase 1 · movilidad y activación', 2, 'Control de edema; recuperar dorsiflexión; activar peroneos; carga progresiva.', ['Movilidad de tobillo rodilla a la pared', 'Eversión de tobillo con banda', 'Inversión de tobillo con banda', 'Elevación de talones bipodal', 'Apoyo unipodal estático', 'Bicicleta estática']],
      ['Fase 2 · fuerza y propiocepción', 3, 'Fuerza de tríceps sural y peroneos; control neuromuscular unipodal.', ['Elevación de talones unipodal', 'Movilización de tobillo con banda', 'Apoyo unipodal en superficie inestable', 'Star Excursion / Y-Balance', 'Step-up a cajón', 'Caminata lateral con mini banda']],
      ['Fase 3 · pliometría y retorno', 3, 'Tolerancia al impacto, cambios de dirección y retorno deportivo.', ['Saltos bipodales en el lugar (pogo)', 'Saltos laterales sobre línea', 'Saltos unipodales en el lugar', 'Apoyo unipodal con perturbaciones', 'Escalera de agilidad: pies rápidos', 'Saltos de patinador (skater)']],
    ],
  },
  {
    nombre: 'Post-operatorio LCA · 12 sesiones iniciales',
    descripcion:
      'Primeras ~6 semanas tras reconstrucción de LCA. Respetar el protocolo del cirujano (tipo de injerto, cargas y rangos permitidos). Con injerto de isquiotibiales, retrasar el trabajo resistido de flexores.',
    porSemana: 2,
    fases: [
      ['Fase 1 · extensión y activación', 4, 'Extensión completa; flexión progresiva; activación de cuádriceps; control de edema.', ['Cuádriceps isométrico (set de cuádriceps)', 'Elevación de pierna recta', 'Deslizamiento de talón (heel slides)', 'Extensión pasiva de rodilla con talón elevado', 'Puente de glúteos', 'Elevación de talones bipodal', 'Bicicleta estática para rango de rodilla']],
      ['Fase 2 · fuerza en cadena cerrada', 4, 'Marcha normal; fuerza en cadena cerrada; equilibrio.', ['Extensión terminal de rodilla con banda (TKE)', 'Sentadilla a cajón', 'Prensa de piernas', 'Step-up a cajón', 'Abducción de cadera de pie con banda', 'Apoyo unipodal estático', 'Bicicleta estática']],
      ['Fase 3 · fuerza unilateral y control', 4, 'Fuerza unilateral; control dinámico de rodilla; preparar la fase de carrera.', ['Sentadilla goblet', 'Estocada reversa', 'Step-down lateral excéntrico', 'Peso muerto rumano', 'Apoyo unipodal en superficie inestable', 'Elevación de talones unipodal']],
    ],
  },
  {
    nombre: 'Tendinopatía rotuliana · 10 sesiones',
    descripcion:
      'Programa de carga progresiva. Dolor durante el ejercicio ≤ 3/10 y que vuelva al nivel basal en 24 h.',
    porSemana: 2,
    fases: [
      ['Fase 1 · isométricos', 3, 'Analgesia con isométricos; mantener la fuerza del resto de la cadena.', ['Sentadilla isométrica en declive (Spanish squat)', 'Sentadilla isométrica en pared', 'Puente de glúteos', 'Elevación de talones bipodal']],
      ['Fase 2 · fuerza lenta y pesada', 4, 'Aumentar la capacidad de carga del tendón con tempo lento (3 s bajada / 3 s subida).', ['Sentadilla a cajón', 'Extensión de rodilla en máquina', 'Prensa de piernas', 'Hip thrust con barra', 'Peso muerto rumano']],
      ['Fase 3 · almacenamiento de energía', 3, 'Reintroducir saltos y cambios de dirección de forma progresiva.', ['Sentadilla búlgara', 'Step-down lateral excéntrico', 'Saltos bipodales en el lugar (pogo)', 'Aterrizaje desde cajón (drop landing)', 'Salto al cajón']],
    ],
  },
  {
    nombre: 'Adulto mayor · prevención de caídas · 10 sesiones',
    descripcion: 'Fuerza de miembros inferiores y equilibrio. Supervisar la seguridad y usar apoyo cercano en los ejercicios de equilibrio.',
    porSemana: 2,
    fases: [
      ['Fase 1 · fuerza base y equilibrio estático', 5, 'Fuerza de piernas; equilibrio estático; confianza en la marcha.', ['Levantarse y sentarse de una silla', 'Elevación de talones bipodal', 'Abducción de cadera de pie con banda', 'Transferencias de peso', 'Marcha en tándem', 'Remo con banda elástica', 'Caminata']],
      ['Fase 2 · equilibrio dinámico y función', 5, 'Equilibrio dinámico, escaleras y obstáculos; autonomía.', ['Step-up a cajón', 'Sentadilla a cajón', 'Apoyo unipodal estático', 'Alcances unipodales en reloj', 'Marcha con obstáculos', 'Elevación de talones unipodal', 'Subir y bajar escaleras']],
    ],
  },
];

// ───────────────────────── Ids deterministas (UUID v5) ─────────────────────────



// ───────────────────────── Construcción ─────────────────────────

function codigos<T>(texto: string, tabla: Record<string, T>, que: string): T[] {
  return texto
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      if (!(c in tabla)) throw new Error(`Código de ${que} desconocido: ${c}`);
      return tabla[c];
    });
}

export function interpretarDosis(dosis: string): { series: string; repeticiones: string; carga: string; descanso: string } {
  const [principal, descanso = ''] = dosis.split('|');
  const [volumen, carga = ''] = principal.split('@');
  const i = volumen.indexOf('x');
  const conSeries = i > 0 && /^\d+$/.test(volumen.slice(0, i).trim());
  return {
    series: conSeries ? volumen.slice(0, i).trim() : '',
    repeticiones: (conSeries ? volumen.slice(i + 1) : volumen).trim(),
    carga: carga.trim(),
    descanso: descanso.trim(),
  };
}

export const TOTAL_CATALOGO = Object.values(CATALOGO).reduce((n, filas) => n + filas.length, 0);

/** Todo el catálogo como registros de la biblioteca (ids deterministas). */
export async function catalogoBase(semilla = '', ahora = new Date().toISOString()): Promise<EjercicioBiblioteca[]> {
  const salida: EjercicioBiblioteca[] = [];
  for (const [categoria, filas] of Object.entries(CATALOGO) as [CategoriaEjercicio, Fila[]][]) {
    for (const [nombre, regiones, equipo, dosis, descripcion, etiquetas = ''] of filas) {
      salida.push({
        tipo: 'ejercicio',
        id: await idEjercicio(nombre, semilla),
        creadoEn: ahora,
        actualizadoEn: ahora,
        nombre,
        categoria,
        regiones: codigos(regiones, REG, 'región'),
        equipamiento: codigos(equipo, EQ, 'equipamiento'),
        descripcion,
        ...interpretarDosis(dosis),
        etiquetas: etiquetas ? etiquetas.split(',') : [],
        favorito: false,
        predefinido: true,
        archivado: false,
      });
    }
  }
  return salida;
}

export async function plantillasBase(semilla = '', ahora = new Date().toISOString()): Promise<PlantillaSesion[]> {
  const ejercicios = new Map((await catalogoBase(semilla, ahora)).map((e) => [e.nombre, e]));
  const salida: PlantillaSesion[] = [];
  for (const [nombre, descripcion, objetivos, nombres] of PLANTILLAS) {
    const id = await idPlantilla(nombre, semilla);
    salida.push({
      tipo: 'plantilla',
      id,
      creadoEn: ahora,
      actualizadoEn: ahora,
      nombre,
      descripcion,
      etiquetas: [],
      objetivos,
      notas: '',
      predefinido: true,
      ejercicios: await Promise.all(
        nombres.map(async (n, i) => {
          const e = ejercicios.get(n);
          if (!e) throw new Error(`La plantilla "${nombre}" usa un ejercicio inexistente: ${n}`);
          return aEjercicioSesion(e, await uuidV5(`${id}:${i}`));
        }),
      ),
    });
  }
  return salida;
}

export async function programasBase(semilla = '', ahora = new Date().toISOString()): Promise<ProgramaTratamiento[]> {
  const ejercicios = new Map((await catalogoBase(semilla, ahora)).map((e) => [e.nombre, e]));
  const salida: ProgramaTratamiento[] = [];
  for (const p of PROGRAMAS) {
    const id = await idPrograma(p.nombre, semilla);
    const sesiones: ProgramaTratamiento['sesiones'] = [];
    for (const [titulo, n, objetivos, nombres] of p.fases) {
      for (let k = 0; k < n; k++) {
        const i = sesiones.length;
        sesiones.push({
          id: await uuidV5(`${id}:s${i}`),
          titulo,
          objetivos,
          notas: '',
          ejercicios: await Promise.all(
            nombres.map(async (nombre, j) => {
              const e = ejercicios.get(nombre);
              if (!e) throw new Error(`El programa "${p.nombre}" usa un ejercicio inexistente: ${nombre}`);
              return aEjercicioSesion(e, await uuidV5(`${id}:s${i}:${j}`));
            }),
          ),
        });
      }
    }
    salida.push({
      tipo: 'programa',
      id,
      creadoEn: ahora,
      actualizadoEn: ahora,
      nombre: p.nombre,
      descripcion: p.descripcion,
      etiquetas: [],
      sesionesPorSemana: p.porSemana,
      sesiones,
      predefinido: true,
    });
  }
  return salida;
}

/**
 * Registros del catálogo que aún no están en la base (por id). Nunca toca los existentes:
 * respeta ediciones y archivados del usuario.
 */
export async function faltantesDelCatalogo(db: Pick<BaseDeDatos, 'ejercicios' | 'plantillas' | 'programas'>, semilla = '') {
  const ids = new Set([...db.ejercicios, ...db.plantillas, ...db.programas].map((r) => r.id));
  return {
    ejercicios: (await catalogoBase(semilla)).filter((e) => !ids.has(e.id)),
    plantillas: (await plantillasBase(semilla)).filter((p) => !ids.has(p.id)),
    programas: (await programasBase(semilla)).filter((p) => !ids.has(p.id)),
  };
}

export { aEjercicioSesion, uuidV5 };
