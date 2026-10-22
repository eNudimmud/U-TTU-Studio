"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assetPath } from '@/lib/site';
import { useI18n, useLocaleSwitch } from '@/components/i18n/provider';
import { SEMANTIC_MODEL_ENABLED } from '@/lib/agent/semantic-flag';
import { emptyConversation, refreshPlan, updateStep, restoreConversation, type Conversation, type ProductionStep } from '@/lib/agent/kernel/production';
import { agentLocale, interpretAgentRequest, localizedTurn, MEDIA_CLASSIFY, MEDIA_SEARCH } from '@/lib/agent/language';
import { productionContext, projectResources } from '@/lib/agent/context';
import { studioActionRegistry } from '@/lib/agent/registry';
import { AGENT_EVENT, prepareStep } from '@/lib/agent/execution';
import { listTasks, subscribeTasks, type Task } from '@/lib/tasks';
import type { Edit } from '@/lib/montage/edit';
import { useStudio } from './studio-session';
import { MediaLibrary, MEDIA_SELECT_EVENT } from './media-library';

const KEY = 'u-ttu-assistant';
const FILE = '.uttu/agent-conversation.json';
export function toggleAssistant(force?: boolean) {
  let next = force ?? true;
  try { next = force ?? window.localStorage.getItem(KEY) !== '1'; window.localStorage.setItem(KEY, next ? '1' : '0'); } catch {}
  window.dispatchEvent(new CustomEvent(KEY, { detail: next }));
}
export function useAssistantOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(window.localStorage.getItem(KEY) === '1'); } catch {}
    const sync = (event: Event) => setOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(KEY, sync); return () => window.removeEventListener(KEY, sync);
  }, []);
  return open;
}
export function AssistantPanel() {
  const { t } = useI18n();
  const { locale: uiLocale } = useLocaleSwitch();
  const locale = agentLocale(uiLocale);
  const session = useStudio();
  const open = useAssistantOpen();
  const project = session.studio.project ?? '';
  const [conversation, setConversation] = useState<Conversation>(() => emptyConversation(''));
  const liveConversation = useRef(conversation); liveConversation.current = conversation;
  const [modelKey, setModelKey] = useState('');
  const [modelConfirm, setModelConfirm] = useState(false);
  const [query, setQuery] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loaded, setLoaded] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState<Edit[]>([]);
  const opened = useRef(`open:${Date.now()}`);
  const [receipts, setReceipts] = useState<Record<string, string[]>>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [library, setLibrary] = useState(false);
  const [mediaQuery, setMediaQuery] = useState('');
  const [proposedSequence, setProposedSequence] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const operations = useMemo(() => studioActionRegistry(session.prefs, t), [session.prefs, t]);
  const context = productionContext(session, operations, conversation.selectedIds, edits, receipts);
  const contextRef = useRef(context); contextRef.current = context;
  const plan = conversation.plan ? refreshPlan(conversation.plan, context) : null;
  const resources = projectResources(session);
  const latest = useRef(session); latest.current = session;
  useEffect(() => { document.documentElement.toggleAttribute('data-assistant', open); return () => document.documentElement.removeAttribute('data-assistant'); }, [open]);
  useEffect(() => { setTasks(listTasks()); return subscribeTasks(setTasks); }, []);
  useEffect(() => {
    let gone = false;
    setLoaded(''); setError(''); setEdits([]); setReceipts({ projects: [opened.current] }); setQuery(''); setSelectedPath(''); setModelConfirm(false);
    if (!session.ready || !project) { setConversation(emptyConversation(project)); return; }
    void (async () => {
      try {
        const [raw, edits, events] = await Promise.all([session.readProjectFile(FILE), session.loadMontages(), session.readProjectFile('.uttu/agent-events.json')]);
        if (gone) return;
        setConversation(restoreConversation(raw, contextRef.current)); setEdits(edits);
        if (events) { const e = JSON.parse(events); if (typeof e.export === 'string') setReceipts({ projects: [opened.current], export: [e.export] }); }
        setLoaded(project);
      } catch { if (!gone) setError(t('agent.storageError')); }
    })();
    return () => { gone = true; };
  }, [session.ready, project]); // Project-scoped snapshot; never transplant a conversation across projects.
  useEffect(() => {
    if (!project || loaded !== project) return;
    let gone = false;
    void Promise.all([session.loadMontages(), session.readProjectFile('.uttu/agent-events.json')]).then(([e, raw]) => {
      if (gone) return; setEdits(e);
      try { const r = raw ? JSON.parse(raw) : {}; if (typeof r.export === 'string') setReceipts({ projects: [opened.current], export: [r.export] }); } catch {}
    }).catch(() => {});
    return () => { gone = true; };
  }, [project, loaded, session.studio, open]);
  useEffect(() => {
    const select = (event: Event) => { const d = (event as CustomEvent<{ project: string; path: string }>).detail; if (d?.project === latest.current.studio.project && typeof d.path === 'string') setSelectedPath(d.path); };
    window.addEventListener(MEDIA_SELECT_EVENT, select); return () => window.removeEventListener(MEDIA_SELECT_EVENT, select);
  }, []);
  const commit = useCallback(async (next: Conversation, optimistic = false) => {
    if (latest.current.studio.project !== next.projectId) throw new Error('project');
    const captured = latest.current;
    const previous = liveConversation.current;
    // A controlled checkbox must reflect the tap immediately while its durable write runs.
    // Only selections use this; completion receipts still wait for successful persistence.
    if (optimistic) { liveConversation.current = next; setConversation(next); }
    try { await captured.writeProjectFile(FILE, JSON.stringify(next)); }
    catch (error) {
      if (optimistic && latest.current.studio.project === next.projectId) { liveConversation.current = previous; setConversation(previous); }
      throw error;
    }
    if (latest.current.studio.project === next.projectId) { liveConversation.current = next; setConversation(next); }
  }, []);
  async function work(fn: () => Promise<void>) {
    if (working.current) return; working.current = true; setBusy(true); setError('');
    try { await fn(); } catch { setError(t('agent.actionError')); }
    finally { working.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!selectedPath || loaded !== project) return;
    const resource = projectResources(session).find(r => r.path === selectedPath);
    if (!resource) return;
    setSelectedPath('');
    void work(() => commit({ ...liveConversation.current, selectedIds: [...new Set([...liveConversation.current.selectedIds, resource.id])].slice(0, 20) }, true));
  }, [selectedPath, session.media, loaded, project]);

  async function send() {
    const value = query.trim(); if (!value || !project || loaded !== project) return;
    await work(async () => {
      const search = MEDIA_SEARCH.test(value);
      if (search) {
        const classify = MEDIA_CLASSIFY.test(value);
        setLibrary(true); setMediaQuery(classify ? '' : value);
        setProposedSequence(classify ? /(?:s[eé]quence|sequenz|secuencia)\s+([A-Za-z0-9-]{1,40})/i.exec(value)?.[1] ?? '' : '');
        const response = t('agent.mediaReply');
        await commit({ ...liveConversation.current, messages: [...liveConversation.current.messages, { role: 'user', text: value.slice(0, 2000), at: Date.now() }, { role: 'assistant', text: response, at: Date.now() }].slice(-40) as Conversation['messages'] });
      } else await commit(localizedTurn(liveConversation.current, value, contextRef.current, locale, t));
      setQuery('');
    });
  }
  async function sendSemantic() {
    if (!SEMANTIC_MODEL_ENABLED || !modelConfirm || !modelKey || !query.trim() || loaded !== project) return;
    const message = query.trim(); setModelConfirm(false);
    await work(async () => {
      const response = await fetch(assetPath('/studio-agent/interpret'), { method: 'POST', headers: { 'content-type': 'application/json', 'x-typesafe-key': modelKey, 'x-studio-model-confirmed': 'yes' }, body: JSON.stringify({ message, project, name: context.projectName, conversation: JSON.stringify(liveConversation.current), resources: context.resources.filter(r => context.selectedIds.includes(r.id)) }) });
      if (!response.ok) { setError(t('agent.modelError')); return; }
      const { interpretation } = await response.json();
      if (!interpretation) { setError(t('agent.modelUncertain')); return; }
      // Revalidate the provider proposal against this tab's live preferences/catalogue.
      if (latest.current.studio.project !== project || !Array.isArray(interpretation.operationIds) || !interpretation.operationIds.every((id: string) => contextRef.current.operations.some(op => op.id === id))) throw new Error('model');
      await commit(localizedTurn(liveConversation.current, message, contextRef.current, locale, t, interpretation)); setQuery('');
    });
  }
  async function prepare(step: ProductionStep) {
    if (!plan) return;
    await work(async () => {
      // Bind the explicit current selection, after live validation. No guessed file path.
      const selected = { ...step, state: step.reason === "resource" ? "ready" as const : step.state, resourceIds: [...contextRef.current.selectedIds] };
      const bound = { ...plan, steps: plan.steps.map(s => s.id === step.id ? selected : s) };
      const op = operations.find(op => op.id === step.operationId)!;
      const baseline = step.state === 'prepared' ? [...step.baseline] : [...(contextRef.current.evidence[op.evidenceKey] ?? [])];
      await commit({ ...liveConversation.current, plan: updateStep(bound, step.id, { state: 'prepared', baseline }) });
      const result = await prepareStep(session, contextRef.current, bound, selected);
      await commit({ ...liveConversation.current, plan: updateStep(bound, step.id, { state: result.state, baseline, results: result.results }) });
      window.dispatchEvent(new Event(AGENT_EVENT));
      if (result.href) { toggleAssistant(false); window.location.assign(assetPath(result.href)); }
    });
  }
  function accept(step: ProductionStep) {
    if (!plan) return;
    const op = operations.find(o => o.id === step.operationId);
    const results = (context.evidence[op?.evidenceKey ?? ''] ?? []).filter(id => !step.baseline.includes(id));
    if (!results.length) return;
    void work(() => commit({ ...liveConversation.current, plan: updateStep(plan, step.id, { state: 'done', results: [...results] }) }));
  }
  if (!open) return null;
  const hinted = interpretAgentRequest(query, context, locale).map(id => operations.find(op => op.id === id)).filter(op => op?.toolId && op.status === 'ready');
  return <aside className="u-assistant u-agent" data-assistant-panel="" aria-labelledby="u-assistant-title">
    <header className="u-assistant-head"><h2 id="u-assistant-title">{t('assistant.title')}</h2><button type="button" className="u-top-icon" aria-label={t('assistant.close')} onClick={() => toggleAssistant(false)}>×</button></header>
    <p className="u-small" id="u-agent-guidance">{t('agent.guidance')}</p>
    <p className="u-label">{session.studio.projectName || t('agent.noProject')}</p>
    {!project && <form onSubmit={e => { e.preventDefault(); void work(() => session.createProject(projectName)); }}><label className="u-field">{t('agent.projectName')}<input value={projectName} maxLength={80} onChange={e => setProjectName(e.target.value)} /></label><button className="u-secondary" aria-describedby="u-agent-guidance" disabled={busy || !projectName.trim()}>{t('agent.createProject')}</button></form>}
    <div className="u-agent-messages" role="log" aria-live="polite" aria-label={t('agent.conversation')}>
      {conversation.projectId === project && conversation.messages.map((m, i) => <p key={`${m.at}-${i}`} data-role={m.role}><strong>{m.role === 'user' ? t('agent.you') : 'U*TTU Studio'}</strong><span>{m.text}</span></p>)}
      {!conversation.messages.length && <p>{t('agent.welcome')}</p>}
    </div>
    <form onSubmit={e => { e.preventDefault(); void send(); }}>
      <label className="u-field"><span className="u-label">{t('assistant.ask')}</span><textarea value={query} maxLength={2000} rows={3} disabled={busy || !session.ready || Boolean(project && loaded !== project)} aria-describedby="u-agent-guidance" onChange={e => { setQuery(e.target.value); setModelConfirm(false); }} placeholder={t('agent.placeholder')} data-assistant-input="" /></label>
      <div className="u-agent-actions"><button className="u-primary" data-agent-send="" aria-describedby="u-agent-guidance" disabled={busy || !query.trim() || loaded !== project || !project}>{t('agent.send')}</button><button type="button" className="u-secondary" onClick={() => { setLibrary(v => !v); setMediaQuery(''); }}>{t('media.title')}</button></div>
    </form>
    {hinted.length > 0 && <ul className="u-assistant-list">{hinted.map(op => op && <li key={op.id}><a href={assetPath(op.href!)} data-assistant-outil={op.toolId}>{op.label}</a></li>)}</ul>}
    {SEMANTIC_MODEL_ENABLED && <details><summary>{t('agent.model')}</summary><p className="u-small">{t('agent.modelHelp')}</p><label className="u-field">{t('agent.modelKey')}<input type="password" autoComplete="off" value={modelKey} onChange={e => { setModelKey(e.target.value); setModelConfirm(false); }} /></label><p className="u-small">{t('agent.modelScope')}</p><label className="u-media-name"><input type="checkbox" checked={modelConfirm} onChange={e => setModelConfirm(e.target.checked)} />{t('agent.modelConsent')}</label><button type="button" className="u-secondary" aria-describedby="u-agent-guidance" disabled={busy || !modelConfirm || modelKey.length < 10 || !query.trim() || loaded !== project} onClick={() => void sendSemantic()}>{t('agent.modelSend')}</button></details>}
    {error && <p role="alert">{error}</p>}
    {resources.length > 0 && <details><summary>{t('agent.references')} ({conversation.selectedIds.length})</summary><div className="u-agent-resources">{resources.map(r => <label key={r.id}><input type="checkbox" disabled={busy || !r.available || loaded !== project} checked={conversation.selectedIds.includes(r.id)} onChange={e => { const checked = e.target.checked; void work(() => commit({ ...liveConversation.current, selectedIds: checked ? [...new Set([...liveConversation.current.selectedIds, r.id])].slice(0, 20) : liveConversation.current.selectedIds.filter(id => id !== r.id) }, true)); }} />{r.name} · {t(`media.kinds.${r.kind}`)}{!r.available && ` · ${t('media.uncached')}`}</label>)}</div></details>}
    {plan && <section data-agent-plan=""><h3>{t('agent.plan')}</h3><ol className="u-agent-plan">{plan.steps.map(step => {
      const op = operations.find(o => o.id === step.operationId);
      const results = (context.evidence[op?.evidenceKey ?? ''] ?? []).filter(id => !step.baseline.includes(id));
      const canPrepare = ['ready','prepared','failed','interrupted'].includes(step.state) || step.reason === 'resource';
      return <li key={step.id} data-agent-step={step.operationId} data-state={step.state}><strong>{op?.label ?? step.operationId}{step.quantity > 1 && ` × ${step.quantity}`}</strong><span className="u-small">{t(`agent.states.${step.state}`)}</span>
        {step.reason && <p className="u-small">{t(`agent.reasons.${step.reason}`)}</p>}
        {op?.description && <p className="u-small">{op.description}</p>}
        {op?.quote && <p className="u-small">{t('agent.quote')} {op.quote.credits}–{op.quote.ceiling} {t('agent.credits')}</p>}
        <div className="u-agent-actions">{canPrepare && <button type="button" className="u-secondary" aria-describedby="u-agent-guidance" disabled={busy} data-agent-prepare="" onClick={() => void prepare(step)}>{t('agent.prepare')}</button>}
          {step.state === 'prepared' && <button type="button" className="u-secondary" aria-describedby="u-agent-guidance" disabled={busy || !results.length} data-agent-accept="" onClick={() => accept(step)}>{t('agent.accept')}</button>}
          {!['done','cancelled'].includes(step.state) && <button type="button" className="u-text-button" aria-describedby="u-agent-guidance" disabled={busy} onClick={() => void work(() => commit({ ...liveConversation.current, plan: updateStep(plan, step.id, { state: 'cancelled' }) }))}>{t('agent.cancelStep')}</button>}
        </div>{step.state === 'prepared' && !results.length && <p className="u-small">{t('agent.waitResult')}</p>}
      </li>;
    })}</ol></section>}
    <details><summary>{t('agent.jobs')}</summary><p className="u-small">{t('agent.jobsHelp')}</p>{tasks.filter(task => task.project === project).slice(0,5).map(task => <p key={task.id}>{task.plain ? task.label : t(task.label)} · {t(`agent.states.${task.state}`)}{task.reason && ` — ${task.reason}`}</p>)}<button type="button" className="u-secondary" aria-describedby="u-agent-guidance" disabled={session.creating || session.run.phase === 'running'} onClick={() => session.resumeRun()}>{t('agent.recover')}</button></details>
    {library && <MediaLibrary compact initialQuery={mediaQuery} proposedSequence={proposedSequence} selectedPaths={resources.filter(r => conversation.selectedIds.includes(r.id)).map(r => r.path)} />}
    <a className="u-small" data-assistant-next="" href={assetPath('/mon-studio')}>{t('agent.projects')}</a>
    <p className="u-small">{t('agent.local')}</p>
  </aside>;
}
