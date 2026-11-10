import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Writes dist/sw.js with the built files to precache, and a version that changes whenever any of them do. */
export function serviceWorker(): Plugin {
  const out = path.resolve('dist');
  return {
    name: 'devart-service-worker',
    apply: 'build',
    closeBundle() {
      const files = readdirSync(out, { recursive: true, withFileTypes: true })
        .filter((f) => f.isFile() && f.name !== 'sw.js')
        .map((f) => path.relative(out, path.join(f.parentPath, f.name)).replaceAll('\\', '/'))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(path.join(out, f)));
      const template = readFileSync(path.resolve('tools/sw-template.js'), 'utf8');
      hash.update(template);
      const sw = template
        .replace('self.__PRECACHE__', JSON.stringify(files.map((f) => `/${f}`)))
        .replace('self.__VERSION__', JSON.stringify(hash.digest('hex').slice(0, 16)));
      writeFileSync(path.join(out, 'sw.js'), sw);
    },
  };
}
