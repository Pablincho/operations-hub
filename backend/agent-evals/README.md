# Banco de evaluación de agentes de manuales

Estos escenarios son datos ficticios y versionados. Permiten medir el efecto de
un cambio de prompt, modelo o validador sin crear ciclos, manuales ni entradas
en la base de datos.

Cada caso define un catálogo cerrado de puestos, evidencia confirmada y
criterios de aceptación. El runner ejecuta A0, A1, A2, A3 y A4 con los mismos
prompts de producción. A1 consulta la web en vivo; por eso sus fuentes se
registran como observación y no se evalúan como una respuesta determinista.

Ejecutar desde `backend`:

```sh
node scripts/run-agent-evals.js
```

El resultado se escribe en `agent-evals/results/` (ignorado por Git). Los
escenarios en `cases/` sí se versionan. Un caso no se considera aprobado por
una respuesta literal: se comprueba foco, bloque, catálogo de áreas, seguridad,
respaldo de evidencia y capacidad de A4 para detectar una afirmación inyectada
sin evidencia.
