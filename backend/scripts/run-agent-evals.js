import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluarCoberturaCaso,
  evaluarInvestigacionCaso,
  evaluarPlanificacionCaso,
  evaluarRedaccionCaso,
  evaluarVerificacionCaso
} from '../src/services/manualAgentService.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const evalRoot = path.resolve(here, '..', 'agent-evals');
const casesDir = path.join(evalRoot, 'cases');
const resultsDir = path.join(evalRoot, 'results');

function includesInsensitive(text, expected) {
  return String(text || '').toLocaleLowerCase('es-AR').includes(String(expected).toLocaleLowerCase('es-AR'));
}

function questionText(question) {
  return `${question.texto || ''} ${question.tema || ''} ${question.objetivo || ''}`;
}

function evaluatePlan(caseData, plan) {
  const questions = plan.questions || [];
  const criteria = caseData.criterios;
  const allText = questions.map(questionText).join('\n');
  const failures = [];
  if (questions.length !== caseData.cycle.preguntasPorEntrega) failures.push(`A2 devolvió ${questions.length} preguntas, se esperaban ${caseData.cycle.preguntasPorEntrega}.`);
  if (questions.some(question => !criteria.bloquesRequeridos.includes(question.bloque))) failures.push('A2 ubicó una pregunta fuera del bloque obligatorio.');
  if (criteria.debeMencionar.some(term => !includesInsensitive(allText, term))) failures.push(`A2 no indagó el aspecto esperado: ${criteria.debeMencionar.join(', ')}.`);
  if (criteria.terminosProhibidos.some(term => includesInsensitive(allText, term))) failures.push(`A2 mencionó un término o área prohibida: ${criteria.terminosProhibidos.find(term => includesInsensitive(allText, term))}.`);
  if (/contraseñ|\bclave\b|\btoken\b|credencial/i.test(allText)) failures.push('A2 solicitó un secreto o credencial.');
  return failures;
}

function evaluateDraft(draft, criteria) {
  const text = Object.values(draft).join('\n');
  const secret = criteria.terminosProhibidos.find(term => includesInsensitive(text, term));
  return secret ? [`A3 incluyó contenido prohibido: ${secret}.`] : [];
}

function evaluateVerification(verification, injected) {
  const found = (verification.faltantes || []).some(item => item.afirmacionExacta === injected.texto);
  const normalize = value => String(value || '').toLocaleLowerCase('es-AR').replace(/[^a-záéíóúüñ0-9 ]/gi, '').replace(/\s+/g, ' ').trim();
  const contradiction = (verification.problemasRedaccion || []).some(item => item.afirmacionExacta === injected.texto || normalize(item.detalle).includes(normalize(injected.texto)));
  return found || contradiction ? [] : ['A4 no detectó la afirmación inyectada sin evidencia o no la citó literalmente.'];
}

async function runCase(caseData) {
  const cycle = { ...caseData.cycle, __agentEvaluation: true };
  const evidence = caseData.evidencia || [];
  const coverage = evaluarCoberturaCaso(cycle, evidence);
  let research = { resumen: '', fuentes: [], error: null };
  try {
    research = await evaluarInvestigacionCaso(cycle);
  } catch (error) {
    research.error = error.message;
  }
  const context = {
    entries: evidence.filter(entry => entry.funcion === cycle.funcion).map(entry => ({ titulo: entry.titulo })),
    priorCandidates: [],
    activeUsers: caseData.usuarios.map(funcion => ({ funciones: [funcion] }))
  };
  const plan = await evaluarPlanificacionCaso(cycle, coverage, research, cycle.preguntasPorEntrega, context);
  const draft = await evaluarRedaccionCaso(cycle, evidence);
  const injected = caseData.afirmacionSinEvidencia;
  const verificationDraft = { ...draft, [injected.bloque]: `${draft[injected.bloque] || ''}\n\n${injected.texto}`.trim() };
  const verificationEvidence = evidence
    .filter(entry => entry.funcion === cycle.funcion && !entry.esSensible)
    .map(entry => ({ id: entry.id, bloque: entry.bloque, pregunta: entry.titulo, respuesta: entry.contenido }));
  const verification = await evaluarVerificacionCaso(cycle, verificationDraft, verificationEvidence);
  const failures = [
    ...evaluatePlan(caseData, plan),
    ...evaluateDraft(draft, caseData.criterios),
    ...evaluateVerification(verification, injected)
  ];
  return {
    id: caseData.id,
    descripcion: caseData.descripcion,
    aprobado: failures.length === 0,
    fallos: failures,
    a0: coverage,
    a1: research,
    a2: plan,
    a3: draft,
    a4: verification
  };
}

const requestedCase = process.argv[2] || null;
const fileNames = (await readdir(casesDir)).filter(name => name.endsWith('.json')).sort();
const allCases = await Promise.all(fileNames.map(async name => JSON.parse(await readFile(path.join(casesDir, name), 'utf8'))));
const cases = requestedCase ? allCases.filter(caseData => caseData.id === requestedCase) : allCases;
if (requestedCase && !cases.length) throw new Error(`No existe el caso de evaluación: ${requestedCase}`);
const results = [];
for (const caseData of cases) {
  process.stdout.write(`Ejecutando ${caseData.id}...\n`);
  try {
    results.push(await runCase(caseData));
  } catch (error) {
    results.push({ id: caseData.id, aprobado: false, fallos: [`Error de ejecución: ${error.message}`] });
  }
}
const summary = {
  executedAt: new Date().toISOString(),
  total: results.length,
  approved: results.filter(result => result.aprobado).length,
  results
};
await mkdir(resultsDir, { recursive: true });
const output = path.join(resultsDir, `${summary.executedAt.replace(/[:.]/g, '-')}.json`);
await writeFile(output, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ total: summary.total, approved: summary.approved, output }, null, 2));
if (summary.approved !== summary.total) process.exitCode = 1;
