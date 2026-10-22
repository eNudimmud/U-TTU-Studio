import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { phrase } from '../src/lib/i18n/phrase.ts';

const catalogs = Object.fromEntries(['fr', 'en', 'de', 'es'].map(code => [code, JSON.parse(readFileSync(`messages/${code}.json`, 'utf8'))]));
const tr = (code: string) => (key: string, values: Record<string, string | number> = {}) => {
  const text = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalogs[code]);
  assert.equal(typeof text, 'string', `${code}: ${key}`);
  return (text as string).replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));
};

test('reliability errors from the libraries are translated in every language', () => {
  const fr = Object.values(catalogs.fr.runtimeSafe as Record<string, string>);
  for (const code of ['en', 'de', 'es']) {
    for (const key of Object.keys(catalogs.fr.runtimeSafe)) assert.equal(typeof catalogs[code].runtimeSafe[key], 'string', `${code}.${key}`);
  }
  assert.equal(phrase(tr('en'), 'Sauvegarde interrompue. Vérifie l’espace disponible puis réessaie.'), 'Save interrupted. Check the available space, then try again.');
  assert.equal(phrase(tr('fr'), fr[0]), fr[0]);
  assert.match(phrase(tr('de'), 'Le rendu job-42 a été envoyé, mais son reçu n’a pas pu être sauvegardé. Conserve cet identifiant et vérifie ton espace disque. Ne relance pas la génération.'), /job-42/);
});
