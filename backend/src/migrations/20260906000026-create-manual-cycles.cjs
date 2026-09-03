'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ManualCycles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      organizacionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Organizaciones', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      funcion: { type: Sequelize.STRING, allowNull: false },
      numero: { type: Sequelize.INTEGER, allowNull: false },
      ocupanteId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT'
      },
      supervisorId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT'
      },
      estado: { type: Sequelize.STRING, allowNull: false, defaultValue: 'configuracion' },
      temas: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      orientacion: { type: Sequelize.TEXT, allowNull: true },
      proximosTemas: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      proximaOrientacion: { type: Sequelize.TEXT, allowNull: true },
      configProximoCiclo: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      heredarOrientacion: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      preguntasPorEntrega: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      frecuencia: { type: Sequelize.STRING, allowNull: false, defaultValue: 'diaria' },
      intervaloDias: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      objetivoPreguntas: { type: Sequelize.INTEGER, allowNull: true },
      requiereAprobacionPreguntas: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      esLegacy: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      iniciadoEn: { type: Sequelize.DATE, allowNull: true },
      relevamientoCerradoEn: { type: Sequelize.DATE, allowNull: true },
      completadoEn: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addConstraint('ManualCycles', {
      fields: ['organizacionId', 'funcion', 'numero'],
      type: 'unique',
      name: 'manual_cycles_org_function_number_unique'
    });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "manual_cycles_one_open_per_function_unique"
      ON "ManualCycles" ("organizacionId", "funcion")
      WHERE estado <> 'completado'
    `);

    await queryInterface.createTable('ManualAgentRuns', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      cicloId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'ManualCycles', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      organizacionId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Organizaciones', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      fase: { type: Sequelize.STRING, allowNull: false },
      estado: { type: Sequelize.STRING, allowNull: false, defaultValue: 'ejecutando' },
      modelo: { type: Sequelize.STRING, allowNull: true },
      entrada: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      salida: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      error: { type: Sequelize.TEXT, allowNull: true },
      iniciadoEn: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      finalizadoEn: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('ManualQuestions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      cicloId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'ManualCycles', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      organizacionId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Organizaciones', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      texto: { type: Sequelize.TEXT, allowNull: false },
      bloque: { type: Sequelize.STRING, allowNull: false, defaultValue: 'B4' },
      tema: { type: Sequelize.STRING, allowNull: true },
      objetivo: { type: Sequelize.TEXT, allowNull: true },
      origen: { type: Sequelize.STRING, allowNull: false, defaultValue: 'agente' },
      prioridad: { type: Sequelize.STRING, allowNull: false, defaultValue: 'normal' },
      estado: { type: Sequelize.STRING, allowNull: false, defaultValue: 'propuesta' },
      orden: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      fuentes: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      aprobadaPor: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },
      aprobadaEn: { type: Sequelize.DATE, allowNull: true },
      checkinSessionId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'CheckinSessions', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    for (const table of ['CheckinSessions', 'KnowledgeEntries', 'Manuales']) {
      await queryInterface.addColumn(table, 'cicloId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'ManualCycles', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      });
    }

    // Todo el historial previo se conserva como ciclo 1. Si el ocupante se autoaprueba,
    // queda como supervisor de compatibilidad para que el puesto directivo no se bloquee.
    await queryInterface.sequelize.query(`
      WITH posiciones AS (
        SELECT DISTINCT "organizacionId", funcion FROM "KnowledgeEntries"
        UNION
        SELECT DISTINCT "organizacionId", funcion FROM "Manuales"
        UNION
        SELECT DISTINCT u."organizacionId", s.funcion
        FROM "CheckinSessions" s JOIN "Usuarios" u ON u.id = s."usuarioId"
      ), resueltas AS (
        SELECT p."organizacionId", p.funcion,
          COALESCE(
            (SELECT u0.id FROM "Usuarios" u0
             WHERE u0.id::text = o.config->'primaryOccupants'->>p.funcion AND u0.activo = true
             LIMIT 1),
            (SELECT k."usuarioId" FROM "KnowledgeEntries" k
             WHERE k."organizacionId" = p."organizacionId" AND k.funcion = p.funcion
             ORDER BY k."createdAt" ASC LIMIT 1),
            (SELECT m."usuarioId" FROM "Manuales" m
             WHERE m."organizacionId" = p."organizacionId" AND m.funcion = p.funcion
             ORDER BY m."createdAt" DESC LIMIT 1),
            (SELECT s."usuarioId" FROM "CheckinSessions" s JOIN "Usuarios" us ON us.id = s."usuarioId"
             WHERE us."organizacionId" = p."organizacionId" AND s.funcion = p.funcion
             ORDER BY s."createdAt" ASC LIMIT 1)
          ) AS "ocupanteId"
        FROM posiciones p
        JOIN "Organizaciones" o ON o.id = p."organizacionId"
      )
      INSERT INTO "ManualCycles" (
        id, "organizacionId", funcion, numero, "ocupanteId", "supervisorId", estado,
        temas, "heredarOrientacion", "preguntasPorEntrega", frecuencia, "intervaloDias",
        "requiereAprobacionPreguntas", "esLegacy", "iniciadoEn", "createdAt", "updatedAt"
      )
      SELECT md5(random()::text || clock_timestamp()::text)::uuid,
        r."organizacionId", r.funcion, 1, r."ocupanteId",
        COALESCE(u."supervisorId", r."ocupanteId"),
        CASE
          WHEN EXISTS (SELECT 1 FROM "Manuales" m WHERE m."organizacionId" = r."organizacionId" AND m.funcion = r.funcion AND m.estado = 'en_revision') THEN 'en_revision'
          WHEN EXISTS (SELECT 1 FROM "Manuales" m WHERE m."organizacionId" = r."organizacionId" AND m.funcion = r.funcion AND m.estado = 'vigente') THEN 'completado'
          ELSE 'relevamiento'
        END,
        '[]'::jsonb, true, 3, 'diaria', 1, false, true, NOW(), NOW(), NOW()
      FROM resueltas r
      JOIN "Usuarios" u ON u.id = r."ocupanteId"
      WHERE r."ocupanteId" IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE "KnowledgeEntries" k SET "cicloId" = c.id
      FROM "ManualCycles" c
      WHERE c.numero = 1 AND c."organizacionId" = k."organizacionId" AND c.funcion = k.funcion
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Manuales" m SET "cicloId" = c.id
      FROM "ManualCycles" c
      WHERE c.numero = 1 AND c."organizacionId" = m."organizacionId" AND c.funcion = m.funcion
    `);
    await queryInterface.sequelize.query(`
      UPDATE "CheckinSessions" s SET "cicloId" = c.id
      FROM "Usuarios" u, "ManualCycles" c
      WHERE u.id = s."usuarioId" AND c.numero = 1
        AND c."organizacionId" = u."organizacionId" AND c.funcion = s.funcion
    `);

    // Permite cerrar un ciclo y comenzar el siguiente el mismo día sin confundir sus sesiones.
    await queryInterface.removeIndex('CheckinSessions', 'checkin_sessions_user_function_date_unique');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "checkin_sessions_user_function_date_cycle_unique"
      ON "CheckinSessions" ("usuarioId", funcion, fecha, COALESCE("cicloId", '00000000-0000-0000-0000-000000000000'::uuid))
    `);

    await queryInterface.addIndex('ManualQuestions', ['cicloId', 'estado', 'orden'], { name: 'manual_questions_cycle_status_order' });
    await queryInterface.addIndex('ManualAgentRuns', ['cicloId', 'createdAt'], { name: 'manual_agent_runs_cycle_created' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('CheckinSessions', 'checkin_sessions_user_function_date_cycle_unique');
    // Si hubiera dos ciclos del mismo puesto iniciados el mismo día, conservamos la sesión
    // más reciente antes de restaurar la restricción histórica.
    await queryInterface.sequelize.query(`
      DELETE FROM "CheckinSessions" a USING "CheckinSessions" b
      WHERE a."usuarioId" = b."usuarioId" AND a.funcion = b.funcion AND a.fecha = b.fecha
        AND (a."createdAt" < b."createdAt" OR (a."createdAt" = b."createdAt" AND a.id < b.id))
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "checkin_sessions_user_function_date_unique"
      ON "CheckinSessions" ("usuarioId", funcion, fecha)
    `);
    for (const table of ['Manuales', 'KnowledgeEntries', 'CheckinSessions']) {
      await queryInterface.removeColumn(table, 'cicloId');
    }
    await queryInterface.dropTable('ManualQuestions');
    await queryInterface.dropTable('ManualAgentRuns');
    await queryInterface.dropTable('ManualCycles');
  }
};
