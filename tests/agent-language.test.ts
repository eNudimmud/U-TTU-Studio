import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studioActionRegistry } from '../src/lib/agent/registry.ts';
import { emptyConversation, type ProductionContext } from '../src/lib/agent/kernel/production.ts';
import { AGENT_REPLY_KEYS, MEDIA_SEARCH, interpretAgentRequest, localizedTurn, replyKey, toKernelLanguage, type AgentLocale } from '../src/lib/agent/language.ts';


const catalogue = (locale: AgentLocale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
const lookup = (locale: AgentLocale) => { const m = catalogue(locale); return (key: string) => key.split('.').reduce((n: any, p) => n?.[p], m) ?? key; };
const context = (locale: AgentLocale): ProductionContext => ({ projectId: 'p', projectName: 'P', resources: [], selectedIds: [], evidence: {}, operations: studioActionRegistry({}, lookup(locale)) });
const turn = (locale: AgentLocale, text: string) => localizedTurn(emptyConversation('p'), text, context(locale), locale, lookup(locale), undefined, 1);
const steps = (c: ReturnType<typeof turn>) => c.plan?.steps.map(s => s.operationId) ?? [];
const reply = (c: ReturnType<typeof turn>) => c.messages.at(-1)!.text;

test('« monte » and its conjugations map to Assembler (local:montage)', () => {
  for (const text of ['Monte les prises', 'Prépare un personnage, puis un décor, puis monte les prises', 'Tu montes la séquence', 'On monte le film', 'Assemble les prises'])
    assert.ok(interpretAgentRequest(text, context('fr'), 'fr').includes('local:montage'), text);
  assert.ok(!interpretAgentRequest('Montre la dernière image', context('fr'), 'fr').includes('local:montage'));
  assert.equal(lookup('fr')('agent.operations.montage'), 'Assembler les prises');
});

test('German requests yield a plan with a German reply (du)', () => {
  const c = turn('de', 'Bereite eine Figur vor, dann eine Kulisse, dann schneide die Takes zusammen');
  assert.deepEqual(steps(c).filter(id => ['local:cast', 'local:decor', 'local:montage'].includes(id)), ['local:cast', 'local:decor', 'local:montage']);
  assert.equal(reply(c), lookup('de')('agent.reply.plan'));
  assert.match(reply(c), /Prüf jedes Ergebnis/);
  assert.equal(c.messages.at(-2)!.text, 'Bereite eine Figur vor, dann eine Kulisse, dann schneide die Takes zusammen');
  assert.deepEqual(steps(turn('de', 'Exportiere den Film')), ['local:export']);
  const three = turn('de', 'Bereite drei Einstellungen mit dieser Figur vor');
  assert.equal(three.plan?.steps.find(s => s.operationId === 'local:shots')?.quantity, 3);
});

test('Spanish requests yield a plan with a Spanish reply (tú)', () => {
  const c = turn('es', 'Prepara un personaje, luego un decorado y después monta las tomas');
  assert.deepEqual(steps(c).filter(id => ['local:cast', 'local:decor', 'local:montage'].includes(id)), ['local:cast', 'local:decor', 'local:montage']);
  assert.equal(reply(c), lookup('es')('agent.reply.plan'));
  assert.match(reply(c), /Revisa cada resultado/);
  assert.deepEqual(steps(turn('es', 'Exporta la película')), ['local:export']);
  assert.ok(!interpretAgentRequest('Una montaña al fondo', context('es'), 'es').includes('local:montage'));
});

test('unknown or negated requests stay a question in the active language', () => {
  assert.equal(reply(turn('de', 'Hallo')), lookup('de')('agent.reply.which'));
  assert.equal(reply(turn('es', 'Hola')), lookup('es')('agent.reply.which'));
  assert.deepEqual(steps(turn('es', 'No prepares ningún personaje')), []);
  assert.deepEqual(steps(turn('de', 'Bereite keine Figur vor')), []);
  assert.equal(reply(turn('fr', 'Bonjour')), lookup('fr')('agent.reply.which'));
  assert.equal(reply(turn('en', 'Hello')), lookup('en')('agent.reply.which'));
});

test('continue in German/Spanish keeps the plan and the original words', () => {
  const ctx = context('de'); const t = lookup('de');
  const first = localizedTurn(emptyConversation('p'), 'Bereite eine Figur vor', ctx, 'de', t, undefined, 1);
  const next = localizedTurn(first, 'Weiter', ctx, 'de', t, undefined, 2);
  assert.equal(next.plan?.id, first.plan?.id);
  assert.equal(next.messages.at(-2)!.text, 'Weiter');
  assert.equal(next.messages.at(-1)!.text, t('agent.reply.preserved'));
});

test('every kernel reply has a catalogue text in the four languages, FR/EN identical to the kernel', () => {
  for (const key of AGENT_REPLY_KEYS) for (const locale of ['fr', 'en', 'de', 'es'] as AgentLocale[]) {
    const text = lookup(locale)(`agent.reply.${key}`);
    assert.notEqual(text, `agent.reply.${key}`, `${locale} ${key}`);
    if (locale === 'fr' || locale === 'en') assert.equal(replyKey(text), key, `${locale} ${key}`);
  }
});

test('native operation descriptions are translated and contain no Hermes/Core', () => {
  for (const locale of ['fr', 'en', 'de', 'es'] as AgentLocale[]) for (const op of studioActionRegistry({}, lookup(locale)).filter(op => op.id.startsWith('local:'))) {
    assert.ok(op.description && !op.description.startsWith('agent.'), `${locale} ${op.id}`);
    assert.doesNotMatch(`${op.label} ${op.description}`, /Hermes|U\*TTU Core/);
  }
  assert.equal(lookup('de')('agent.descriptions.cast'), 'Fotos, Referenzen, Identität und Figurenblatt');
});

test('media questions are recognised in the four languages', () => {
  for (const text of ['Retrouve la dernière image', 'Show the last image', 'Zeig mir das letzte Bild', 'Muéstrame la última imagen']) assert.match(text, MEDIA_SEARCH, text);
  for (const text of ['Prépare un personnage', 'Bereite eine Figur vor', 'Monta las tomas']) assert.doesNotMatch(text, MEDIA_SEARCH, text);
});

test('the cutout planner understands German and Spanish through the same adapter', () => {
  assert.match(toKernelLanguage('Stell dieses Bild frei', 'de'), /remove background/);
  assert.match(toKernelLanguage('Recorta esta imagen', 'es'), /remove background/);
});

test('the studio inline assistant has no hard-coded French', () => {
  const code = readFileSync(new URL('../src/components/app/studio-agent-inline.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /Que veux-tu|Proposer|Demande à|Détour|devis|Enregistre-la/);
});
