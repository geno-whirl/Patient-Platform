import { useCallback, useEffect, useRef, useState } from 'react';
import { escribirRuta } from '../domain/rutas';
import type { Coleccion, RegistroPorColeccion } from '../domain/schema';
import { useDatos } from './DatosContext';

export type EstadoGuardado = 'guardado' | 'pendiente' | 'guardando' | 'error';

/**
 * Mantiene un borrador editable de un registro y lo guarda automáticamente
 * ~0,7 s después del último cambio (y al salir de la página).
 */
export function useAutoguardado<C extends Coleccion>(coleccion: C, inicial: RegistroPorColeccion[C]) {
  type R = RegistroPorColeccion[C];
  const { guardar } = useDatos();
  const [borrador, setBorrador] = useState<R>(inicial);
  const [estado, setEstado] = useState<EstadoGuardado>('guardado');
  const [mensajeError, setMensajeError] = useState('');
  const actual = useRef<R>(inicial);
  const pendiente = useRef<R | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const volcar = useCallback(async () => {
    clearTimeout(temporizador.current);
    const r = pendiente.current;
    if (!r) return;
    pendiente.current = null;
    setEstado('guardando');
    try {
      await guardar(coleccion, r);
      setEstado(pendiente.current ? 'pendiente' : 'guardado');
    } catch (e) {
      setEstado('error');
      setMensajeError(e instanceof Error ? e.message : String(e));
    }
  }, [coleccion, guardar]);

  const volcarRef = useRef(volcar);
  volcarRef.current = volcar;
  useEffect(() => () => void volcarRef.current(), []);

  const actualizar = useCallback((fn: (r: R) => R) => {
    const nuevo = fn(actual.current);
    actual.current = nuevo;
    pendiente.current = nuevo;
    setBorrador(nuevo);
    setEstado('pendiente');
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void volcarRef.current(), 700);
  }, []);

  const fijar = useCallback(
    (ruta: string, valor: unknown) => actualizar((r) => escribirRuta(r, ruta, valor)),
    [actualizar],
  );

  return { borrador, actualizar, fijar, estado, mensajeError, guardarAhora: volcar };
}
