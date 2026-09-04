'use strict';

// Limpia índices duplicados que dejó db.sync() y agrega los que faltan para los patrones
// de consulta reales del sistema de ciclos.
//
// Las 27 constraints "Usuarios_email_key1..27" las fue acumulando db.sync() en cada
// arranque mientras el modelo declaraba `unique: true` en email. Además de encarecer
// cada escritura, rompen lo que buscaba la migración 20260905000025: el índice parcial
// solo entre activos, para que desactivar a alguien libere su email. Con esas constraints
// vivas el email seguía bloqueado igual. El modelo ya no declara `unique: true`, así que
// no se vuelven a crear.

const INDICES_NUEVOS = [
  // El estado de cada ciclo se arma contando entradas por ciclo, no por función.
  ['KnowledgeEntries', 'knowledge_entries_ciclo_categoria', '("cicloId", categoria)'],
  // Las sesiones se buscan por ciclo y por estado de completado en cada check-in.
  ['CheckinSessions', 'checkin_sessions_ciclo_completado', '("cicloId", completado)'],
  ['Manuales', 'manuales_ciclo', '("cicloId")'],
  // El ocupante principal se resuelve leyendo los usuarios activos de la organización.
  ['Usuarios', 'usuarios_organizacion_activo', '("organizacionId", activo)'],
  ['Usuarios', 'usuarios_supervisor', '("supervisorId")']
];

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    // Antes de soltar las constraints hay que confirmar que el índice parcial existe:
    // es el que sigue garantizando emails únicos entre los usuarios activos.
    const [parcial] = await sequelize.query(
      `SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'Usuarios'
          AND indexname = 'usuarios_email_active_unique'`
    );
    if (!parcial.length) {
      throw new Error('Falta usuarios_email_active_unique. No se eliminan las constraints duplicadas de email.');
    }

    const [duplicadas] = await sequelize.query(
      `SELECT conname FROM pg_constraint
        WHERE conrelid = '"Usuarios"'::regclass AND contype = 'u'
          AND conname ~ '^Usuarios_email_key[0-9]*$'`
    );
    for (const { conname } of duplicadas) {
      await sequelize.query(`ALTER TABLE "Usuarios" DROP CONSTRAINT "${conname}"`);
    }
    console.log(`[migracion] Constraints únicas duplicadas de email eliminadas: ${duplicadas.length}`);

    // ManualCycles quedó con dos índices idénticos sobre (organizacionId, funcion, numero).
    // Se conserva el que respalda la constraint y se descarta el suelto.
    await sequelize.query('DROP INDEX IF EXISTS "manual_cycles_organizacion_id_funcion_numero"');

    for (const [tabla, nombre, columnas] of INDICES_NUEVOS) {
      await sequelize.query(`CREATE INDEX IF NOT EXISTS "${nombre}" ON "${tabla}" ${columnas}`);
    }

    // El planificador nunca había analizado Usuarios: estimaba 1 fila donde hay 11.
    await sequelize.query('ANALYZE "Usuarios", "KnowledgeEntries", "CheckinSessions", "ManualCycles", "ManualQuestions", "Manuales"');
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    for (const [, nombre] of INDICES_NUEVOS) {
      await sequelize.query(`DROP INDEX IF EXISTS "${nombre}"`);
    }
    await sequelize.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "manual_cycles_organizacion_id_funcion_numero"
         ON "ManualCycles" ("organizacionId", funcion, numero)`
    );
    // Las 27 constraints duplicadas de email no se recrean a propósito: eran un efecto
    // no deseado de db.sync(), no un requisito del esquema.
  }
};
