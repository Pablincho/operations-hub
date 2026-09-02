'use strict';

module.exports = {
  async up(queryInterface) {
    // Los índices únicos de abajo fallarían si ya existen filas duplicadas de antes de
    // esta corrección (justo las condiciones de carrera que este mismo diff cierra), así
    // que primero deduplicamos.

    // CheckinSessions: entre duplicados por (usuarioId, funcion, fecha), nos quedamos con
    // la sesión completada si hay una, y si no con la más nueva.
    await queryInterface.sequelize.query(`
      DELETE FROM "CheckinSessions" a
      USING "CheckinSessions" b
      WHERE a."usuarioId" = b."usuarioId"
        AND a."funcion" = b."funcion"
        AND a."fecha" = b."fecha"
        AND (
          (a."completado" = false AND b."completado" = true)
          OR (a."completado" = b."completado" AND a."createdAt" < b."createdAt")
          OR (a."completado" = b."completado" AND a."createdAt" = b."createdAt" AND a."id" < b."id")
        )
    `);

    // Manuales: entre duplicados no-obsoletos por (organizacionId, funcion), nos quedamos
    // con el de mejor estado (vigente > en_revision > borrador) y archivamos el resto como
    // 'obsoleto' en vez de borrarlos, para no perder contenido ni historial.
    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY "organizacionId", "funcion"
            ORDER BY
              CASE estado WHEN 'vigente' THEN 0 WHEN 'en_revision' THEN 1 WHEN 'borrador' THEN 2 ELSE 3 END,
              "generadoEn" DESC NULLS LAST,
              "createdAt" DESC,
              id DESC
          ) AS rn
        FROM "Manuales"
        WHERE estado <> 'obsoleto'
      )
      UPDATE "Manuales" m
      SET estado = 'obsoleto'
      FROM ranked r
      WHERE m.id = r.id AND r.rn > 1
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "checkin_sessions_user_function_date_unique"
      ON "CheckinSessions" ("usuarioId", "funcion", "fecha")
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "manuales_one_active_per_function_unique"
      ON "Manuales" ("organizacionId", "funcion")
      WHERE "estado" <> 'obsoleto'
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('CheckinSessions', 'checkin_sessions_user_function_date_unique');
    await queryInterface.removeIndex('Manuales', 'manuales_one_active_per_function_unique');
  }
};
