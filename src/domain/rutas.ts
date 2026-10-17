/** Utilidades inmutables para leer/escribir campos anidados por ruta "a.b.c". */

export function leerRuta(obj: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

export function escribirRuta<T>(obj: T, ruta: string, valor: unknown): T {
  const [k, ...resto] = ruta.split('.');
  const actual = (obj ?? {}) as Record<string, unknown>;
  if (Array.isArray(obj)) throw new Error('escribirRuta no soporta arreglos');
  return {
    ...actual,
    [k]: resto.length ? escribirRuta(actual[k], resto.join('.'), valor) : valor,
  } as T;
}
