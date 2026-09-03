'use strict';

// La migración 20260906000026 creó los ciclos, pero su backfill hace JOIN contra
// "Organizaciones" y no insertó nada: todos los datos reales apuntan a un organizacionId
// que no existe en esa tabla (quedó colgado cuando se eliminó la tabla duplicada
// "Organizacions" y initOrganizacion() recreó la organización con un id nuevo).
// Sin ciclos, el check-in y la generación del manual quedan bloqueados, y crear un ciclo
// desde la app falla por FK. Acá reparamos la organización y volvemos a correr el backfill.
module.exports = {
  async up(queryInterface) {
    // 1. Caso simple y esperado: una sola organización y un solo organizacionId en uso,
    // que no coincide con el de la tabla. Se realinea el id del row existente.
    await queryInterface.sequelize.query(`
      UPDATE "Organizaciones" o
      SET id = referencia."organizacionId", "updatedAt" = NOW()
      FROM (SELECT DISTINCT "organizacionId" FROM "Usuarios") referencia
      WHERE (SELECT COUNT(*) FROM "Organizaciones") = 1
        AND (SELECT COUNT(DISTINCT "organizacionId") FROM "Usuarios") = 1
        AND NOT EXISTS (SELECT 1 FROM "Organizaciones" x WHERE x.id = referencia."organizacionId")
    `);

    // 2. Red de seguridad para cualquier otro organizacionId huérfano (escenario multi-org):
    // se crea la organización faltante en vez de dejar datos inalcanzables.
    await queryInterface.sequelize.query(`
      INSERT INTO "Organizaciones" (id, nombre, slug, config, "createdAt", "updatedAt")
      SELECT DISTINCT u."organizacionId",
        'Organización ' || left(u."organizacionId"::text, 8),
        'org-' || left(u."organizacionId"::text, 8),
        '{}'::jsonb, NOW(), NOW()
      FROM "Usuarios" u
      WHERE NOT EXISTS (SELECT 1 FROM "Organizaciones" o WHERE o.id = u."organizacionId")
    `);

    // 3. Backfill de ciclos legacy (mismo criterio que 20260906000026, ahora sí con JOIN
    // que matchea). Idempotente: no toca puestos que ya tengan un ciclo.
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
        temas, "proximosTemas", "configProximoCiclo", "heredarOrientacion",
        "preguntasPorEntrega", frecuencia, "intervaloDias",
        "requiereAprobacionPreguntas", "esLegacy", "iniciadoEn", "createdAt", "updatedAt"
      )
      SELECT gen_random_uuid(),
        r."organizacionId", r.funcion, 1, r."ocupanteId",
        COALESCE(u."supervisorId", r."ocupanteId"),
        CASE
          WHEN EXISTS (SELECT 1 FROM "Manuales" m WHERE m."organizacionId" = r."organizacionId" AND m.funcion = r.funcion AND m.estado = 'en_revision') THEN 'en_revision'
          WHEN EXISTS (SELECT 1 FROM "Manuales" m WHERE m."organizacionId" = r."organizacionId" AND m.funcion = r.funcion AND m.estado = 'vigente') THEN 'completado'
          ELSE 'relevamiento'
        END,
        '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, true, 3, 'diaria', 1, false, true, NOW(), NOW(), NOW()
      FROM resueltas r
      JOIN "Usuarios" u ON u.id = r."ocupanteId"
      WHERE r."ocupanteId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "ManualCycles" c
          WHERE c."organizacionId" = r."organizacionId" AND c.funcion = r.funcion
        )
    `);

    // 4. Enganchar el historial al ciclo 1, solo donde todavía no tiene ciclo asignado.
    await queryInterface.sequelize.query(`
      UPDATE "KnowledgeEntries" k SET "cicloId" = c.id
      FROM "ManualCycles" c
      WHERE c.numero = 1 AND c."organizacionId" = k."organizacionId" AND c.funcion = k.funcion
        AND k."cicloId" IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Manuales" m SET "cicloId" = c.id
      FROM "ManualCycles" c
      WHERE c.numero = 1 AND c."organizacionId" = m."organizacionId" AND c.funcion = m.funcion
        AND m."cicloId" IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE "CheckinSessions" s SET "cicloId" = c.id
      FROM "Usuarios" u, "ManualCycles" c
      WHERE u.id = s."usuarioId" AND c.numero = 1
        AND c."organizacionId" = u."organizacionId" AND c.funcion = s.funcion
        AND s."cicloId" IS NULL
    `);
  },

  async down() {
    // No se revierte: deshacer la reparación volvería a dejar los datos apuntando a una
    // organización inexistente. Los ciclos legacy se eliminan con el down de 20260906000026.
  }
};
