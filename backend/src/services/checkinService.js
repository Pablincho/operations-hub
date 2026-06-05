import { generarPreguntasIA } from './openaiService.js';

export const FUNCIONES = ['Tesorería', 'Impuestos', 'Sueldos', 'Autorizaciones'];

// B2 = Funciones y responsabilidades
// B3 = Perfil del puesto
// B4 = Procesos y procedimientos
// B5 = Relaciones e interfaces
// B6 = Herramientas y sistemas

export const BASE_QUESTIONS = {
  Tesorería: [
    { pregunta: '¿Cuál es el primer paso para pagar una factura a un proveedor?', bloque: 'B4' },
    { pregunta: '¿Qué datos necesitás tener del proveedor antes de hacer una transferencia?', bloque: 'B4' },
    { pregunta: '¿Qué cuentas bancarias usás y para qué tipo de pagos va cada una?', bloque: 'B6' },
    { pregunta: '¿Cómo entrás al homebanking y qué pasos seguís para hacer una transferencia?', bloque: 'B4' },
    { pregunta: '¿Qué verificás antes de confirmar un pago?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás el pago en Albor una vez realizado?', bloque: 'B4' },
    { pregunta: '¿A quién le enviás el comprobante y cómo?', bloque: 'B5' },
    { pregunta: '¿Cómo hacés la conciliación bancaria diaria?', bloque: 'B4' },
    { pregunta: '¿Qué hacés cuando encontrás una diferencia en la conciliación?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás la caja chica y cuándo pedís reposición?', bloque: 'B2' },
    { pregunta: '¿Qué comprobantes exigís para cada gasto de caja chica?', bloque: 'B4' },
    { pregunta: '¿Cómo verificás facturas vencidas de clientes?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás una cobranza cuando entra el pago?', bloque: 'B4' },
    { pregunta: '¿Qué hacés al cierre mensual paso a paso?', bloque: 'B4' },
    { pregunta: '¿Cuándo entregás el informe de flujo de caja y a quién?', bloque: 'B5' },
    { pregunta: '¿Qué retenciones aplicás y en qué casos?', bloque: 'B4' },
    { pregunta: '¿Cómo distinguís un pago de hacienda de uno de granos en Albor?', bloque: 'B4' },
    { pregunta: '¿Qué pasa si el proveedor no está dado de alta? ¿Cómo lo cargás?', bloque: 'B4' },
    { pregunta: '¿Cómo operás con pagos en USD si los hay?', bloque: 'B4' },
    { pregunta: '¿Qué información guardás de cada operación y dónde?', bloque: 'B6' }
  ],
  Impuestos: [
    { pregunta: '¿Qué impuestos presentás mensualmente y en qué orden?', bloque: 'B2' },
    { pregunta: '¿Cuáles son las fechas de vencimiento de cada impuesto mensual?', bloque: 'B4' },
    { pregunta: '¿Cómo entrás a AFIP y qué hacés primero?', bloque: 'B4' },
    { pregunta: '¿Cómo presentás el IVA mensual paso a paso?', bloque: 'B4' },
    { pregunta: '¿Cómo liquidás y presentás Ganancias?', bloque: 'B4' },
    { pregunta: '¿Qué es el impuesto al agua y cómo se abona?', bloque: 'B4' },
    { pregunta: '¿Qué impuestos provinciales presentás y cuándo?', bloque: 'B2' },
    { pregunta: '¿Cómo usás Albor para la gestión impositiva?', bloque: 'B6' },
    { pregunta: '¿Qué información necesitás tener lista antes de cada presentación?', bloque: 'B4' },
    { pregunta: '¿Cómo generás el VEP para pagar impuestos?', bloque: 'B4' },
    { pregunta: '¿Qué hacés si una presentación tiene error?', bloque: 'B4' },
    { pregunta: '¿Cuáles son los vencimientos anuales más importantes?', bloque: 'B4' },
    { pregunta: '¿Cómo presentás el impuesto a las ganancias anual?', bloque: 'B4' },
    { pregunta: '¿Qué declaraciones juradas anuales hacés y cuándo?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás las retenciones sufridas y las compensaciones?', bloque: 'B4' },
    { pregunta: '¿Qué documentación archivás de cada presentación?', bloque: 'B6' },
    { pregunta: '¿Cómo accedés a Interbanking para pagar impuestos?', bloque: 'B6' },
    { pregunta: '¿Qué contraseñas y usuarios usás para cada sistema impositivo?', bloque: 'B6' },
    { pregunta: '¿Cómo controlás que todos los vencimientos del mes estén cubiertos?', bloque: 'B4' },
    { pregunta: '¿Qué hacés si hay un vencimiento un feriado o fin de semana?', bloque: 'B4' }
  ],
  Sueldos: [
    { pregunta: '¿Cuándo se liquidan los sueldos y cuál es el proceso?', bloque: 'B4' },
    { pregunta: '¿Qué sistema usás para liquidar sueldos?', bloque: 'B6' },
    { pregunta: '¿Cómo cargás las novedades del mes (licencias, ausencias, horas extra)?', bloque: 'B4' },
    { pregunta: '¿Cómo generás los recibos de sueldo?', bloque: 'B4' },
    { pregunta: '¿Cómo se pagan los sueldos: transferencia, efectivo u otro?', bloque: 'B4' },
    { pregunta: '¿Qué cargas sociales presentás y cuándo?', bloque: 'B2' },
    { pregunta: '¿Cómo presentás el F931 en AFIP?', bloque: 'B4' },
    { pregunta: '¿Qué es el SIPA y cómo lo gestionás?', bloque: 'B4' },
    { pregunta: '¿Cómo calculás las vacaciones y qué documentación generás?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás un aguinaldo paso a paso?', bloque: 'B4' },
    { pregunta: '¿Qué hacés cuando hay una incorporación de personal nueva?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás una baja de personal?', bloque: 'B4' },
    { pregunta: '¿Qué archivos o reportes generás al cerrar la liquidación mensual?', bloque: 'B6' },
    { pregunta: '¿A quién le reportás la liquidación y en qué formato?', bloque: 'B5' },
    { pregunta: '¿Cómo se manejan los anticipos de sueldo?', bloque: 'B4' },
    { pregunta: '¿Qué convenio colectivo aplica y cómo impacta en la liquidación?', bloque: 'B3' },
    { pregunta: '¿Cómo registrás los sueldos en Albor?', bloque: 'B6' },
    { pregunta: '¿Qué pasa si hay un error en la liquidación ya pagada?', bloque: 'B4' },
    { pregunta: '¿Cómo controlás que todos los empleados estén dados de alta en AFIP?', bloque: 'B4' },
    { pregunta: '¿Qué documentación pedís a un empleado nuevo para darlo de alta?', bloque: 'B4' }
  ],
  Autorizaciones: [
    { pregunta: '¿Qué pagos requieren tu autorización y cuáles no?', bloque: 'B2' },
    { pregunta: '¿Cuál es el límite de importe para autorizar sin consultar a Danilo?', bloque: 'B2' },
    { pregunta: '¿Cómo recibís las solicitudes de pago para autorizar?', bloque: 'B4' },
    { pregunta: '¿Qué verificás antes de autorizar un pago?', bloque: 'B4' },
    { pregunta: '¿Cómo confirmás que una factura fue recibida y aprobada por el área?', bloque: 'B4' },
    { pregunta: '¿Dónde registrás las autorizaciones que otorgás?', bloque: 'B6' },
    { pregunta: '¿Qué hacés si detectás una factura con datos incorrectos?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás una solicitud urgente fuera del proceso normal?', bloque: 'B4' },
    { pregunta: '¿Qué pasa si el proveedor no está dado de alta?', bloque: 'B4' },
    { pregunta: '¿Cómo comunicás al tesorero que un pago está autorizado?', bloque: 'B5' },
    { pregunta: '¿Qué documentación archivás de cada autorización?', bloque: 'B6' },
    { pregunta: '¿Cómo controlás que no se dupliquen pagos?', bloque: 'B4' },
    { pregunta: '¿Qué criterios usás para priorizar pagos cuando hay restricción de fondos?', bloque: 'B4' },
    { pregunta: '¿Cómo reportás a Danilo los pagos autorizados del mes?', bloque: 'B5' },
    { pregunta: '¿Qué tipos de gastos nunca autorizás sin aprobación superior?', bloque: 'B2' },
    { pregunta: '¿Cómo manejás las autorizaciones de pagos en USD?', bloque: 'B4' },
    { pregunta: '¿Qué pasa si el responsable de área no puede aprobar una factura?', bloque: 'B4' },
    { pregunta: '¿Cómo auditás pagos ya realizados?', bloque: 'B4' },
    { pregunta: '¿Cuál es el proceso para una compra nueva con proveedor nuevo?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás conflictos entre lo autorizado y lo pagado?', bloque: 'B4' }
  ]
};

export const INITIAL_QUESTIONS = {
  Tesorería: [
    { pregunta: '¿Cuántas cuentas bancarias manejás y en qué banco está cada una?', bloque: 'B6' },
    { pregunta: '¿Cómo se llama el sistema contable que usás y cómo ingresás a él?', bloque: 'B6' },
    { pregunta: '¿Con qué frecuencia realizás pagos a proveedores (diario, semanal)?', bloque: 'B4' },
    { pregunta: '¿Quién autoriza los pagos antes de que vos los ejecutés?', bloque: 'B5' },
    { pregunta: '¿Qué plataformas digitales usás para operar (homebanking, Interbanking, etc.)?', bloque: 'B6' },
    { pregunta: '¿Retención de impuestos al pagar proveedores: ¿cuáles aplicás y en qué casos?', bloque: 'B4' },
    { pregunta: '¿Manejás fondos en USD? ¿Cómo operás con ellos?', bloque: 'B4' },
    { pregunta: '¿Con qué frecuencia conciliás las cuentas bancarias?', bloque: 'B4' },
    { pregunta: '¿Cuál es el monto de caja chica y quién puede usarla?', bloque: 'B2' },
    { pregunta: '¿Con quién coordinás más seguido en tu trabajo diario (contador, gerente, otros)?', bloque: 'B5' }
  ],
  Impuestos: [
    { pregunta: '¿Cuáles son los impuestos que presentás mensualmente?', bloque: 'B2' },
    { pregunta: '¿Cuáles son los sistemas que usás para presentar (AFIP, Rentas, otros)?', bloque: 'B6' },
    { pregunta: '¿Cómo ingresás a AFIP: con clave fiscal o a través de un estudio?', bloque: 'B6' },
    { pregunta: '¿Usás Albor para exportar datos impositivos? ¿Cómo?', bloque: 'B6' },
    { pregunta: '¿Quién te revisa o aprueba las presentaciones antes de enviarlas?', bloque: 'B5' },
    { pregunta: '¿Cuáles son los vencimientos que más te preocupan o son más críticos?', bloque: 'B4' },
    { pregunta: '¿Presentás impuestos provinciales además de nacionales? ¿Cuáles?', bloque: 'B2' },
    { pregunta: '¿Manejás declaraciones juradas anuales? ¿Cuáles son las más complejas?', bloque: 'B4' },
    { pregunta: '¿Cómo pagás los impuestos: VEP, débito automático, Interbanking?', bloque: 'B4' },
    { pregunta: '¿Con quién coordinás cuando tenés una duda técnica impositiva?', bloque: 'B5' }
  ],
  Sueldos: [
    { pregunta: '¿Cuántos empleados liquidás y bajo qué convenio laboral?', bloque: 'B3' },
    { pregunta: '¿Qué sistema usás para liquidar sueldos?', bloque: 'B6' },
    { pregunta: '¿Cuándo es el cierre de novedades cada mes y quién te las informa?', bloque: 'B4' },
    { pregunta: '¿Cómo pagás los sueldos: transferencia bancaria, efectivo u otro?', bloque: 'B4' },
    { pregunta: '¿Presentás el F931 vos mismo o lo hace el contador?', bloque: 'B4' },
    { pregunta: '¿Manejás ART, obra social y sindicato? ¿Cuáles son?', bloque: 'B2' },
    { pregunta: '¿Cómo registrás los sueldos en Albor?', bloque: 'B6' },
    { pregunta: '¿Qué pasa cuando hay una incorporación nueva? ¿Cuáles son los primeros pasos?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás las vacaciones y el aguinaldo en la liquidación?', bloque: 'B4' },
    { pregunta: '¿Con quién coordinás más seguido para cerrar la liquidación mensual?', bloque: 'B5' }
  ],
  Autorizaciones: [
    { pregunta: '¿Qué tipos de pagos requieren tu autorización y cuáles no?', bloque: 'B2' },
    { pregunta: '¿Cuál es el monto límite para autorizar sin consultar a Danilo?', bloque: 'B2' },
    { pregunta: '¿Cómo te llegan las solicitudes de autorización (mail, sistema, papel)?', bloque: 'B4' },
    { pregunta: '¿Qué verificás antes de autorizar un pago?', bloque: 'B4' },
    { pregunta: '¿Cómo confirmás que la factura fue recibida y aprobada por el área solicitante?', bloque: 'B4' },
    { pregunta: '¿Dónde quedá registrada cada autorización que otorgás?', bloque: 'B6' },
    { pregunta: '¿Cómo avisás al tesorero que un pago está autorizado?', bloque: 'B5' },
    { pregunta: '¿Qué hacés si detectás una factura incorrecta o sospechosa?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás autorizaciones urgentes fuera del proceso normal?', bloque: 'B4' },
    { pregunta: '¿Con quién coordinás más seguido en tu función de autorización?', bloque: 'B5' }
  ]
};

// Determina qué bloque tiene menos cobertura para enfocar las preguntas del día
function bloqueConMenosCobertura(prevAnswers) {
  const bloques = ['B2', 'B3', 'B4', 'B5', 'B6'];
  const counts = Object.fromEntries(bloques.map(b => [b, 0]));
  for (const a of prevAnswers) {
    if (a.bloque && counts[a.bloque] !== undefined) counts[a.bloque]++;
  }
  return bloques.reduce((min, b) => counts[b] < counts[min] ? b : min, bloques[0]);
}

export async function generarPreguntas(funcion, prevAnswers = []) {
  const answeredQs = new Set(prevAnswers.map(p => p.pregunta));
  const base = BASE_QUESTIONS[funcion] || [];
  const fallback = base.filter(q => !answeredQs.has(q.pregunta)).slice(0, 3);

  const bloqueObjetivo = bloqueConMenosCobertura(prevAnswers);

  try {
    const questions = await generarPreguntasIA(funcion, prevAnswers, bloqueObjetivo);
    if (Array.isArray(questions) && questions.length === 3) {
      return questions; // [{pregunta, bloque}]
    }
    return fallback.length >= 3 ? fallback : base.slice(0, 3);
  } catch {
    return fallback.length >= 3 ? fallback : base.slice(0, 3);
  }
}
