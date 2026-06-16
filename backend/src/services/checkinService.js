import { generarPreguntasIA } from './openaiService.js';

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
  'Administración y Finanzas': [
    { pregunta: '¿Cuál es el proceso de seguimiento contable de una empresa del grupo paso a paso?', bloque: 'B4' },
    { pregunta: '¿Cómo detectás si hay un desvío en los estados contables?', bloque: 'B4' },
    { pregunta: '¿Qué pasos seguís para autorizar un pago?', bloque: 'B4' },
    { pregunta: '¿Cuál es el límite de importe que podés autorizar sin escalar?', bloque: 'B2' },
    { pregunta: '¿Cómo verificás que una factura es correcta antes de autorizarla?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás una venta de hacienda en el sistema?', bloque: 'B4' },
    { pregunta: '¿Qué documentación generás en cada venta de hacienda?', bloque: 'B4' },
    { pregunta: '¿Cómo controlás que las ventas de hacienda estén correctamente liquidadas?', bloque: 'B4' },
    { pregunta: '¿Qué informes mensuales generás y a quién se los entregás?', bloque: 'B5' },
    { pregunta: '¿Cómo coordinás con Tesorería cuando autorizás un pago?', bloque: 'B5' },
    { pregunta: '¿Cómo hacés el cierre mensual de cada empresa?', bloque: 'B4' },
    { pregunta: '¿Qué herramientas usás para llevar el seguimiento de varias empresas a la vez?', bloque: 'B6' },
    { pregunta: '¿Cómo accedés a Albor y qué módulos usás?', bloque: 'B6' },
    { pregunta: '¿Qué pasa si encontrás un error en un estado contable ya cerrado?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás las diferencias de cambio si hay operaciones en USD?', bloque: 'B4' },
    { pregunta: '¿Qué información le reportás al Gerente y con qué frecuencia?', bloque: 'B5' },
    { pregunta: '¿Cómo archivás la documentación de cada empresa?', bloque: 'B6' },
    { pregunta: '¿Qué hacés cuando hay una discrepancia entre lo registrado y lo que informa el área?', bloque: 'B4' },
    { pregunta: '¿Cómo coordinás con el estudio contable externo si lo hay?', bloque: 'B5' },
    { pregunta: '¿Qué es lo más importante que no puede quedar sin hacer en una semana?', bloque: 'B2' }
  ],
  'Operaciones Agropecuarias': [
    { pregunta: '¿Cómo iniciás el proceso de compra de hacienda: quién lo solicita y cómo?', bloque: 'B4' },
    { pregunta: '¿Qué datos registrás de cada compra de hacienda?', bloque: 'B4' },
    { pregunta: '¿Cómo controlás los insumos agrícolas que entran y salen del campo?', bloque: 'B4' },
    { pregunta: '¿Qué proveedores de insumos agrícolas trabajan con Don Emilio?', bloque: 'B5' },
    { pregunta: '¿Cómo registrás una compra de granos paso a paso?', bloque: 'B4' },
    { pregunta: '¿Cómo seguís una entrega de granos desde el acuerdo hasta la entrega final?', bloque: 'B4' },
    { pregunta: '¿Qué documentación te exigís para cerrar una operación de compra/venta?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás las operaciones en el sistema?', bloque: 'B6' },
    { pregunta: '¿Qué reportes generás para el Gerente sobre las operaciones agropecuarias?', bloque: 'B5' },
    { pregunta: '¿Cómo coordinás con los consignatarios o acopiadores?', bloque: 'B5' },
    { pregunta: '¿Qué pasa si hay una diferencia entre lo pactado y lo entregado?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás el seguimiento de insumos en múltiples campos?', bloque: 'B4' },
    { pregunta: '¿Qué información necesitás tener actualizada antes de cerrar una compra?', bloque: 'B4' },
    { pregunta: '¿Cómo coordinás con Tesorería para los pagos de hacienda o granos?', bloque: 'B5' },
    { pregunta: '¿Qué temporadas del año son más críticas para tu función?', bloque: 'B2' },
    { pregunta: '¿Cómo llevás el registro de existencias de hacienda?', bloque: 'B4' },
    { pregunta: '¿Qué controles hacés sobre las entregas para evitar errores?', bloque: 'B4' },
    { pregunta: '¿Cómo archivás la documentación de cada operación?', bloque: 'B6' },
    { pregunta: '¿Qué sistemas externos (plataformas, portales) usás para operar?', bloque: 'B6' },
    { pregunta: '¿Cuál es el proceso más complejo de tu función y por qué?', bloque: 'B2' }
  ],
  Impositivo: [
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
  'Administrativo Junior': [
    { pregunta: '¿Cómo organizás el orden de tus tareas al inicio del día?', bloque: 'B4' },
    { pregunta: '¿Cómo procesás una factura que llega a la empresa?', bloque: 'B4' },
    { pregunta: '¿Qué tipo de archivos o carpetas digitales mantenés ordenados?', bloque: 'B6' },
    { pregunta: '¿Cómo hacés un trámite en AFIP o en organismos públicos?', bloque: 'B4' },
    { pregunta: '¿Qué reportes o planillas completás regularmente?', bloque: 'B4' },
    { pregunta: '¿Cómo manejás pedidos urgentes de otras áreas?', bloque: 'B4' },
    { pregunta: '¿Qué herramientas digitales usás para tu trabajo diario?', bloque: 'B6' },
    { pregunta: '¿Cómo registrás una operación en Albor?', bloque: 'B6' },
    { pregunta: '¿A quién escala cuando tenés una duda que no podés resolver solo?', bloque: 'B5' },
    { pregunta: '¿Qué información archivás y durante cuánto tiempo?', bloque: 'B6' },
    { pregunta: '¿Cómo comunicás novedades al área de Tesorería?', bloque: 'B5' },
    { pregunta: '¿Qué tareas hacés de soporte al área de Administración y Finanzas?', bloque: 'B2' },
    { pregunta: '¿Cómo manejás los vencimientos de trámites o presentaciones?', bloque: 'B4' },
    { pregunta: '¿Qué hacés cuando recibís una solicitud que no sabés cómo resolver?', bloque: 'B4' },
    { pregunta: '¿Cómo ordenás la documentación física de la empresa?', bloque: 'B6' },
    { pregunta: '¿Qué tareas repetitivas hacés que podrían automatizarse?', bloque: 'B4' },
    { pregunta: '¿Cómo aprendiste las tareas que hacés actualmente?', bloque: 'B3' },
    { pregunta: '¿Qué conocimientos o herramientas te resultaron más difíciles de aprender?', bloque: 'B3' },
    { pregunta: '¿Cómo coordinás con el área de RRHH?', bloque: 'B5' },
    { pregunta: '¿Qué haría que el trabajo sea más eficiente en tu puesto?', bloque: 'B2' }
  ],
  RRHH: [
    { pregunta: '¿Cuál es el proceso completo para incorporar un empleado nuevo?', bloque: 'B4' },
    { pregunta: '¿Cómo gestionás el alta en AFIP de un empleado nuevo?', bloque: 'B4' },
    { pregunta: '¿Qué documentación le pedís a un empleado al ingresar?', bloque: 'B4' },
    { pregunta: '¿Cómo se calcula y procesa una liquidación de sueldo?', bloque: 'B4' },
    { pregunta: '¿Qué hacés cuando un empleado pide licencia médica?', bloque: 'B4' },
    { pregunta: '¿Cómo controlás las vacaciones de todo el personal?', bloque: 'B4' },
    { pregunta: '¿Qué pasa cuando hay una desvinculación: cuál es el proceso paso a paso?', bloque: 'B4' },
    { pregunta: '¿Cómo presentás las cargas sociales mensualmente?', bloque: 'B4' },
    { pregunta: '¿Qué convenio aplica a cada tipo de empleado de la empresa?', bloque: 'B3' },
    { pregunta: '¿Cómo manejás los accidentes laborales y la ART?', bloque: 'B4' },
    { pregunta: '¿Cómo llevás el registro de asistencias?', bloque: 'B4' },
    { pregunta: '¿Qué reportes de RRHH generás mensualmente y a quién?', bloque: 'B5' },
    { pregunta: '¿Cómo coordinás con el área contable para el pago de sueldos?', bloque: 'B5' },
    { pregunta: '¿Qué sistema de RRHH usás y qué módulos?', bloque: 'B6' },
    { pregunta: '¿Cómo comunicás novedades o cambios normativos al personal?', bloque: 'B5' },
    { pregunta: '¿Cómo manejás el aguinaldo: plazos, cálculo y documentación?', bloque: 'B4' },
    { pregunta: '¿Qué herramientas usás para mantener actualizado el legajo de cada empleado?', bloque: 'B6' },
    { pregunta: '¿Cómo gestionás los préstamos o anticipos a empleados?', bloque: 'B4' },
    { pregunta: '¿Qué controles hacés para asegurar el cumplimiento laboral?', bloque: 'B4' },
    { pregunta: '¿Cuáles son las tareas de RRHH que más riesgo legal implican?', bloque: 'B2' }
  ],
  'Administrativo El Coro': [
    { pregunta: '¿Cuáles son las operaciones propias de El Coro que administrás?', bloque: 'B2' },
    { pregunta: '¿Cómo procesás facturas y documentación en El Coro?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás las operaciones de El Coro en el sistema central?', bloque: 'B4' },
    { pregunta: '¿Con qué frecuencia te comunicás con la administración central?', bloque: 'B5' },
    { pregunta: '¿Qué información reportás diariamente o semanalmente a la administración?', bloque: 'B5' },
    { pregunta: '¿Qué decisiones podés tomar vos directamente y cuáles escalás?', bloque: 'B2' },
    { pregunta: '¿Cómo manejás el efectivo o caja chica en El Coro?', bloque: 'B4' },
    { pregunta: '¿Qué controles de stock o inventario hacés?', bloque: 'B4' },
    { pregunta: '¿Cómo coordinás las entregas o retiros en El Coro?', bloque: 'B4' },
    { pregunta: '¿Qué herramientas digitales tenés disponibles en El Coro?', bloque: 'B6' },
    { pregunta: '¿Cómo archivás la documentación física en El Coro?', bloque: 'B6' },
    { pregunta: '¿Qué pasa cuando hay una diferencia entre lo registrado y lo real?', bloque: 'B4' },
    { pregunta: '¿Cómo coordinás con Tesorería cuando necesitás fondos?', bloque: 'B5' },
    { pregunta: '¿Qué tareas hacés que son únicas de El Coro respecto a la oficina central?', bloque: 'B2' },
    { pregunta: '¿Cómo manejás las relaciones con proveedores o clientes locales?', bloque: 'B5' },
    { pregunta: '¿Qué información necesitás de la administración central para operar?', bloque: 'B5' },
    { pregunta: '¿Cómo reportás novedades urgentes a Danilo o al área correspondiente?', bloque: 'B5' },
    { pregunta: '¿Qué controles hacés al cierre de cada día o semana?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás operaciones de hacienda o granos desde El Coro?', bloque: 'B4' },
    { pregunta: '¿Qué mejorarías en el flujo de información entre El Coro y la administración central?', bloque: 'B2' }
  ]
};

export const INITIAL_QUESTIONS = {
  Tesorería: [
    { pregunta: '¿Cuántas cuentas bancarias manejás y en qué banco está cada una?', bloque: 'B6' },
    { pregunta: '¿Cómo se llama el sistema contable que usás y cómo ingresás a él?', bloque: 'B6' },
    { pregunta: '¿Con qué frecuencia realizás pagos a proveedores (diario, semanal)?', bloque: 'B4' },
    { pregunta: '¿Quién autoriza los pagos después de que vos los ejecutés?', bloque: 'B5' },
    { pregunta: '¿Qué plataformas digitales usás para operar (homebanking, Interbanking, etc.)?', bloque: 'B6' },
    { pregunta: 'Retención de impuestos al pagar proveedores: ¿cuáles aplicás y en qué casos?', bloque: 'B4' },
    { pregunta: '¿Manejás fondos en USD? ¿Cómo operás con ellos?', bloque: 'B4' },
    { pregunta: '¿Con qué frecuencia conciliás las cuentas bancarias?', bloque: 'B4' },
    { pregunta: '¿Cuál es el monto de caja chica y quién puede usarla?', bloque: 'B2' },
    { pregunta: '¿Con quién coordinás más seguido en tu trabajo diario (contador, gerente, otros)?', bloque: 'B5' }
  ],
  'Administración y Finanzas': [
    { pregunta: '¿Qué empresas del grupo llevás en tus seguimientos contables?', bloque: 'B2' },
    { pregunta: '¿Qué sistema usás para los seguimientos contables?', bloque: 'B6' },
    { pregunta: '¿Qué tipos de pagos requieren tu autorización y cuál es el límite de importe?', bloque: 'B2' },
    { pregunta: '¿Cómo te llegan las solicitudes de autorización de pagos?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás las ventas de hacienda y en qué sistema?', bloque: 'B4' },
    { pregunta: '¿Con qué frecuencia hacés el seguimiento de cada empresa?', bloque: 'B4' },
    { pregunta: '¿A quién reportás los estados contables y con qué periodicidad?', bloque: 'B5' },
    { pregunta: '¿Qué herramientas digitales usás para tu trabajo diario?', bloque: 'B6' },
    { pregunta: '¿Con quién coordinás más seguido dentro de la empresa?', bloque: 'B5' },
    { pregunta: '¿Cuál es la tarea más crítica en tiempo dentro de tu función?', bloque: 'B2' }
  ],
  'Operaciones Agropecuarias': [
    { pregunta: '¿Cómo es el proceso de compra de hacienda: quién decide y cómo lo registrás?', bloque: 'B4' },
    { pregunta: '¿Qué insumos agrícolas seguís y cómo controlás el stock?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás las compras y ventas de granos?', bloque: 'B4' },
    { pregunta: '¿Qué sistemas usás para el seguimiento de operaciones agropecuarias?', bloque: 'B6' },
    { pregunta: '¿Cómo coordinás las entregas de hacienda o granos?', bloque: 'B4' },
    { pregunta: '¿Con qué proveedores o consignatarios trabajás habitualmente?', bloque: 'B5' },
    { pregunta: '¿Qué información le reportás a Danilo y con qué frecuencia?', bloque: 'B5' },
    { pregunta: '¿Qué documentación manejás en cada operación de compra/venta?', bloque: 'B4' },
    { pregunta: '¿Cómo registrás las operaciones en Albor u otro sistema?', bloque: 'B6' },
    { pregunta: '¿Cuál es la mayor complejidad de tu función en el día a día?', bloque: 'B2' }
  ],
  Impositivo: [
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
  'Administrativo Junior': [
    { pregunta: '¿Cuáles son tus principales tareas administrativas diarias?', bloque: 'B2' },
    { pregunta: '¿Qué sistemas usás para tu trabajo?', bloque: 'B6' },
    { pregunta: '¿Qué tipo de documentos procesás o archivás habitualmente?', bloque: 'B4' },
    { pregunta: '¿A quién le reportás tu trabajo y cómo?', bloque: 'B5' },
    { pregunta: '¿Cómo manejás el ingreso y registro de facturas?', bloque: 'B4' },
    { pregunta: '¿Qué tareas de soporte hacés para otras áreas?', bloque: 'B2' },
    { pregunta: '¿Cómo organizás tu agenda y prioridades del día?', bloque: 'B4' },
    { pregunta: '¿Qué información manejás que sea sensible o confidencial?', bloque: 'B3' },
    { pregunta: '¿Cómo coordinás con Tesorería o Administración cuando necesitás algo?', bloque: 'B5' },
    { pregunta: '¿Qué te resulta más complejo de tu puesto actualmente?', bloque: 'B3' }
  ],
  RRHH: [
    { pregunta: '¿Cuántos empleados tiene la empresa y en cuántas locaciones?', bloque: 'B2' },
    { pregunta: '¿Qué sistema usás para la gestión de RRHH?', bloque: 'B6' },
    { pregunta: '¿Qué convenios colectivos aplican al personal?', bloque: 'B3' },
    { pregunta: '¿Cómo es el proceso de incorporación de un empleado nuevo?', bloque: 'B4' },
    { pregunta: '¿Quién liquida los sueldos y cómo coordinás con esa persona?', bloque: 'B5' },
    { pregunta: '¿Qué trámites ante AFIP o el ministerio hacés vos directamente?', bloque: 'B4' },
    { pregunta: '¿Cómo gestionás las licencias, vacaciones y ausencias?', bloque: 'B4' },
    { pregunta: '¿Qué reportes de RRHH generás y para quién?', bloque: 'B5' },
    { pregunta: '¿Qué herramientas digitales usás para comunicarte con el personal?', bloque: 'B6' },
    { pregunta: '¿Cuál es la gestión de RRHH que más tiempo te demanda?', bloque: 'B2' }
  ],
  'Administrativo El Coro': [
    { pregunta: '¿Cuáles son tus principales tareas administrativas en El Coro?', bloque: 'B2' },
    { pregunta: '¿Qué sistemas usás para tu trabajo?', bloque: 'B6' },
    { pregunta: '¿Qué tipo de documentos o registros manejás habitualmente?', bloque: 'B4' },
    { pregunta: '¿Cómo coordinás con la administración central de la empresa?', bloque: 'B5' },
    { pregunta: '¿Qué operaciones propias de El Coro administrás?', bloque: 'B2' },
    { pregunta: '¿Cómo registrás las operaciones en el sistema?', bloque: 'B4' },
    { pregunta: '¿Con qué frecuencia te comunicás con las otras áreas de administración?', bloque: 'B5' },
    { pregunta: '¿Qué información reportás a Danilo o a la administración central?', bloque: 'B5' },
    { pregunta: '¿Qué herramientas o accesos específicos tenés para operar desde El Coro?', bloque: 'B6' },
    { pregunta: '¿Cuál es la mayor diferencia entre tu trabajo y el del Administrativo Junior?', bloque: 'B3' }
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

export async function generarPreguntas(funcion, prevAnswers = [], crossAreaRefs = []) {
  const answeredQs = new Set(prevAnswers.map(p => p.pregunta));
  const base = BASE_QUESTIONS[funcion] || [];
  const fallback = base.filter(q => !answeredQs.has(q.pregunta)).slice(0, 3);

  const bloqueObjetivo = bloqueConMenosCobertura(prevAnswers);

  try {
    const questions = await generarPreguntasIA(funcion, prevAnswers, bloqueObjetivo, crossAreaRefs);
    if (Array.isArray(questions) && questions.length === 3) {
      return questions; // [{pregunta, bloque}]
    }
    return fallback.length >= 3 ? fallback : base.slice(0, 3);
  } catch {
    return fallback.length >= 3 ? fallback : base.slice(0, 3);
  }
}
