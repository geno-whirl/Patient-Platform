import { describe, expect, it } from 'vitest';
import { anonimizar, codigoPaciente, limpiarTexto } from '../anonimizar';
import { nuevaSesion, nuevoIngreso, nuevoPaciente } from '../factories';
import { pacienteAMarkdown } from '../markdown';
import type { BaseDeDatos } from '../schema';

function base() {
  const p = nuevoPaciente('María José Pérez Ñúñez');
  Object.assign(p.identificacion, {
    rut: '12.345.678-5',
    fechaNacimiento: '1980-01-01',
    telefono: '+56 9 8765 4321',
    email: 'mj@correo.cl',
    sexo: 'femenino',
    ocupacion: 'Profesora',
  });
  p.notas = 'Llamar a su hija Ana';
  const i = nuevoIngreso(p.id);
  i.anamnesisProxima.medicoTratante = 'Dr. Soto';
  i.anamnesisProxima.motivoConsulta =
    'Maria refiere dolor de hombro. Contacto: mj@correo.cl, fono 9 8765 4321, RUT 12345678-5. Fecha 2026-01-08, 3 series de 10.';
  const s = nuevaSesion(p.id, 1, '2026-01-10');
  s.registro.subjetivo = 'La sra. PÉREZ llega mejor';
  const adj = {
    tipo: 'adjunto' as const,
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    creadoEn: '',
    actualizadoEn: '',
    pacienteId: p.id,
    fecha: '2026-01-09',
    categoria: 'examen' as const,
    descripcion: 'RM hombro de María Pérez: tendinopatía supraespinoso',
    nombreArchivo: 'RM-Maria-Perez-12345678-5.pdf',
    tipoMime: 'application/pdf',
    tamanoBytes: 1000,
    ruta: 'u/p/a1b2-rm.pdf',
    evaluacionId: null,
  };
  const db: BaseDeDatos = { centros: [], pacientes: [p], ingresos: [i], evaluaciones: [], sesiones: [s], adjuntos: [adj], ejercicios: [], plantillas: [], programas: [] };
  return { db, p };
}

describe('anonimización', () => {
  it('genera un código estable', () => {
    expect(codigoPaciente('3f2a9c10-aaaa-bbbb-cccc-000000000000')).toBe('P-3F2A9C');
  });

  it('quita identificadores directos y conserva la edad y lo clínico', () => {
    const { db, p } = base();
    const { db: a, edades } = anonimizar(db);
    const id = a.pacientes[0].identificacion;
    expect(id.nombre).toBe(codigoPaciente(p.id));
    expect([id.rut, id.telefono, id.email, id.fechaNacimiento]).toEqual(['', '', '', '']);
    expect(id.sexo).toBe('femenino');
    expect(a.pacientes[0].notas).toBe('');
    expect(a.ingresos[0].anamnesisProxima.medicoTratante).toBe('');
    expect(edades[p.id]).toBeGreaterThan(40);
    // no muta el original
    expect(db.pacientes[0].identificacion.rut).toBe('12.345.678-5');
  });

  it('enmascara nombre (sin importar tildes/mayúsculas), RUT, email y teléfono en texto libre', () => {
    const { db, p } = base();
    const { db: a } = anonimizar(db);
    const c = codigoPaciente(p.id);
    expect(a.ingresos[0].anamnesisProxima.motivoConsulta).toBe(
      `${c} refiere dolor de hombro. Contacto: [email], fono [teléfono], RUT [RUT]. Fecha 2026-01-08, 3 series de 10.`,
    );
    expect(a.sesiones[0].registro.subjetivo).toBe(`La sra. ${c} llega mejor`);
    expect(a.sesiones[0].fecha).toBe('2026-01-10');
  });

  it('no toca números clínicos', () => {
    expect(limpiarTexto('Flexión 0-95°, 3x12, 2026-01-08, 120 kg', [], 'P-X')).toBe('Flexión 0-95°, 3x12, 2026-01-08, 120 kg');
  });

  it('el markdown anónimo no contiene datos identificatorios', () => {
    const { db, p } = base();
    const md = pacienteAMarkdown(p, db, { anonimo: true });
    for (const dato of ['María', 'Maria', 'Pérez', 'Perez', 'PÉREZ', '12.345.678', '12345678', 'mj@correo.cl', '8765', 'Dr. Soto', 'hija Ana', '1980', 'u/p/']) {
      expect(md).not.toContain(dato);
    }
    expect(md).toContain(`# Paciente: ${codigoPaciente(p.id)}`);
    expect(md).toContain('**Edad:**');
    expect(md).toContain(`2026-01-09 · examen: RM hombro de ${codigoPaciente(p.id)}: tendinopatía supraespinoso`);
    const normal = pacienteAMarkdown(p, db);
    expect(normal).toContain('**RUT:** 12.345.678-5');
    expect(normal).toContain('(RM-Maria-Perez-12345678-5.pdf)');
  });
});
