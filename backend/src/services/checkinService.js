import { generarPreguntasIA } from './openaiService.js';

export const FUNCIONES = ['Tesorería', 'Impuestos', 'Sueldos', 'Autorizaciones'];

export const BASE_QUESTIONS = {
  Tesorería: [
    '¿Cuál es el primer paso para pagar una factura a un proveedor?',
    '¿Qué datos necesitás tener del proveedor antes de hacer una transferencia?',
    '¿Qué cuentas bancarias usás y para qué tipo de pagos va cada una?',
    '¿Cómo entrás al homebanking y qué pasos seguís para hacer una transferencia?',
    '¿Qué verificás antes de confirmar un pago?',
    '¿Cómo registrás el pago en Albor una vez realizado?',
    '¿A quién le enviás el comprobante y cómo?',
    '¿Cómo hacés la conciliación bancaria diaria?',
    '¿Qué hacés cuando encontrás una diferencia en la conciliación?',
    '¿Cómo manejás la caja chica y cuándo pedís reposición?',
    '¿Qué comprobantes exigís para cada gasto de caja chica?',
    '¿Cómo verificás facturas vencidas de clientes?',
    '¿Cómo registrás una cobranza cuando entra el pago?',
    '¿Qué hacés al cierre mensual paso a paso?',
    '¿Cuándo entregás el informe de flujo de caja y a quién?',
    '¿Qué retenciones aplicás y en qué casos?',
    '¿Cómo distinguís un pago de hacienda de uno de granos en Albor?',
    '¿Qué pasa si el proveedor no está dado de alta? ¿Cómo lo cargás?',
    '¿Cómo operás con pagos en USD si los hay?',
    '¿Qué información guardás de cada operación y dónde?'
  ],
  Impuestos: [
    '¿Qué impuestos presentás mensualmente y en qué orden?',
    '¿Cuáles son las fechas de vencimiento de cada impuesto mensual?',
    '¿Cómo entrás a AFIP y qué hacés primero?',
    '¿Cómo presentás el IVA mensual paso a paso?',
    '¿Cómo liquidás y presentás Ganancias?',
    '¿Qué es el impuesto al agua y cómo se abona?',
    '¿Qué impuestos provinciales presentás y cuándo?',
    '¿Cómo usás Albor para la gestión impositiva?',
    '¿Qué información necesitás tener lista antes de cada presentación?',
    '¿Cómo generás el VEP para pagar impuestos?',
    '¿Qué hacés si una presentación tiene error?',
    '¿Cuáles son los vencimientos anuales más importantes?',
    '¿Cómo presentás el impuesto a las ganancias anual?',
    '¿Qué declaraciones juradas anuales hacés y cuándo?',
    '¿Cómo manejás las retenciones sufridas y las compensaciones?',
    '¿Qué documentación archivás de cada presentación?',
    '¿Cómo accedés a Interbanking para pagar impuestos?',
    '¿Qué contraseñas y usuarios usás para cada sistema impositivo?',
    '¿Cómo controlás que todos los vencimientos del mes estén cubiertos?',
    '¿Qué hacés si hay un vencimiento un feriado o fin de semana?'
  ],
  Sueldos: [
    '¿Cuándo se liquidan los sueldos y cuál es el proceso?',
    '¿Qué sistema usás para liquidar sueldos?',
    '¿Cómo cargás las novedades del mes (licencias, ausencias, horas extra)?',
    '¿Cómo generás los recibos de sueldo?',
    '¿Cómo se pagan los sueldos: transferencia, efectivo u otro?',
    '¿Qué cargas sociales presentás y cuándo?',
    '¿Cómo presentás el F931 en AFIP?',
    '¿Qué es el SIPA y cómo lo gestionás?',
    '¿Cómo calculás las vacaciones y qué documentación generás?',
    '¿Cómo manejás un aguinaldo paso a paso?',
    '¿Qué hacés cuando hay una incorporación de personal nueva?',
    '¿Cómo registrás una baja de personal?',
    '¿Qué archivos o reportes generás al cerrar la liquidación mensual?',
    '¿A quién le reportás la liquidación y en qué formato?',
    '¿Cómo se manejan los anticipos de sueldo?',
    '¿Qué convenio colectivo aplica y cómo impacta en la liquidación?',
    '¿Cómo registrás los sueldos en Albor?',
    '¿Qué pasa si hay un error en la liquidación ya pagada?',
    '¿Cómo controlás que todos los empleados estén dados de alta en AFIP?',
    '¿Qué documentación pedís a un empleado nuevo para darlo de alta?'
  ],
  Autorizaciones: [
    '¿Qué pagos requieren tu autorización y cuáles no?',
    '¿Cuál es el límite de importe para autorizar sin consultar a Danilo?',
    '¿Cómo recibís las solicitudes de pago para autorizar?',
    '¿Qué verificás antes de autorizar un pago?',
    '¿Cómo confirmás que una factura fue recibida y aprobada por el área?',
    '¿Dónde registrás las autorizaciones que otorgás?',
    '¿Qué hacés si detectás una factura con datos incorrectos?',
    '¿Cómo manejás una solicitud urgente fuera del proceso normal?',
    '¿Qué pasa si el proveedor no está dado de alta?',
    '¿Cómo comunicás al tesorero que un pago está autorizado?',
    '¿Qué documentación archivás de cada autorización?',
    '¿Cómo controlás que no se dupliquen pagos?',
    '¿Qué criterios usás para priorizar pagos cuando hay restricción de fondos?',
    '¿Cómo reportás a Danilo los pagos autorizados del mes?',
    '¿Qué tipos de gastos nunca autorizás sin aprobación superior?',
    '¿Cómo manejás las autorizaciones de pagos en USD?',
    '¿Qué pasa si el responsable de área no puede aprobar una factura?',
    '¿Cómo auditás pagos ya realizados?',
    '¿Cuál es el proceso para una compra nueva con proveedor nuevo?',
    '¿Cómo manejás conflictos entre lo autorizado y lo pagado?'
  ]
};

// 10 initial onboarding questions per function (fixed, asked once)
export const INITIAL_QUESTIONS = {
  Tesorería: [
    '¿Cuántas cuentas bancarias manejás y en qué banco está cada una?',
    '¿Cómo se llama el sistema contable que usás y cómo ingresás a él?',
    '¿Con qué frecuencia realizás pagos a proveedores (diario, semanal)?',
    '¿Quién autoriza los pagos antes de que vos los ejecutés?',
    '¿Qué plataformas digitales usás para operar (homebanking, Interbanking, etc.)?',
    '¿Retención de impuestos al pagar proveedores: ¿cuáles aplicás y en qué casos?',
    '¿Manejás fondos en USD? ¿Cómo operás con ellos?',
    '¿Con qué frecuencia conciliás las cuentas bancarias?',
    '¿Cuál es el monto de caja chica y quién puede usarla?',
    '¿Con quién coordinás más seguido en tu trabajo diario (contador, gerente, otros)?'
  ],
  Impuestos: [
    '¿Cuáles son los impuestos que presentás mensualmente?',
    '¿Cuáles son los sistemas que usás para presentar (AFIP, Rentas, otros)?',
    '¿Cómo ingresás a AFIP: con clave fiscal o a través de un estudio?',
    '¿Usás Albor para exportar datos impositivos? ¿Cómo?',
    '¿Quién te revisa o aprueba las presentaciones antes de enviarlas?',
    '¿Cuáles son los vencimientos que más te preocupan o son más críticos?',
    '¿Presentás impuestos provinciales además de nacionales? ¿Cuáles?',
    '¿Manejás declaraciones juradas anuales? ¿Cuáles son las más complejas?',
    '¿Cómo pagás los impuestos: VEP, débito automático, Interbanking?',
    '¿Con quién coordinás cuando tenés una duda técnica impositiva?'
  ],
  Sueldos: [
    '¿Cuántos empleados liquidás y bajo qué convenio laboral?',
    '¿Qué sistema usás para liquidar sueldos?',
    '¿Cuándo es el cierre de novedades cada mes y quién te las informa?',
    '¿Cómo pagás los sueldos: transferencia bancaria, efectivo u otro?',
    '¿Presentás el F931 vos mismo o lo hace el contador?',
    '¿Manejás ART, obra social y sindicato? ¿Cuáles son?',
    '¿Cómo registrás los sueldos en Albor?',
    '¿Qué pasa cuando hay una incorporación nueva? ¿Cuáles son los primeros pasos?',
    '¿Cómo manejás las vacaciones y el aguinaldo en la liquidación?',
    '¿Con quién coordinás más seguido para cerrar la liquidación mensual?'
  ],
  Autorizaciones: [
    '¿Qué tipos de pagos requieren tu autorización y cuáles no?',
    '¿Cuál es el monto límite para autorizar sin consultar a Danilo?',
    '¿Cómo te llegan las solicitudes de autorización (mail, sistema, papel)?',
    '¿Qué verificás antes de autorizar un pago?',
    '¿Cómo confirmás que la factura fue recibida y aprobada por el área solicitante?',
    '¿Dónde quedá registrada cada autorización que otorgás?',
    '¿Cómo avisás al tesorero que un pago está autorizado?',
    '¿Qué hacés si detectás una factura incorrecta o sospechosa?',
    '¿Cómo manejás autorizaciones urgentes fuera del proceso normal?',
    '¿Con quién coordinás más seguido en tu función de autorización?'
  ]
};

// Generate 3 daily questions adapted from previous answers (AI)
export async function generarPreguntas(funcion, prevAnswers = []) {
  const answeredQs = new Set(prevAnswers.map(p => p.pregunta));
  const base = BASE_QUESTIONS[funcion] || [];
  const fallback = base.filter(q => !answeredQs.has(q)).slice(0, 3);

  try {
    const questions = await generarPreguntasIA(funcion, prevAnswers);
    if (Array.isArray(questions) && questions.length === 3) {
      return questions;
    }
    return fallback.length >= 3 ? fallback : base.slice(0, 3);
  } catch {
    return fallback.length >= 3 ? fallback : base.slice(0, 3);
  }
}
