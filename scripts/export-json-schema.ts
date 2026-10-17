// Genera docs/esquema.json (JSON Schema del formato de exportación) desde src/domain/schema.ts.
// Uso: npm run schema
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { ExportacionSchema } from '../src/domain/schema.ts';

const esquema = z.toJSONSchema(ExportacionSchema, { io: 'input' });
writeFileSync(new URL('../docs/esquema.json', import.meta.url), JSON.stringify(esquema, null, 2) + '\n');
console.log('docs/esquema.json actualizado');
