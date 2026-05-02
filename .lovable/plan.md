
# Deduplicación del Banco de Preguntas

## Qué se hace

Agregar una "huella digital" (hash) a cada pregunta del banco. Si la misma pregunta ya existe para el mismo docente, no se duplica.

## Cambios

### 1. Migración SQL

Agregar columna `content_hash` (text, not null) a `question_bank` con un índice único sobre `(user_id, content_hash)`. Esto garantiza a nivel de base de datos que no puede haber dos preguntas iguales del mismo docente.

```sql
ALTER TABLE public.question_bank ADD COLUMN content_hash text;
UPDATE public.question_bank SET content_hash = md5(question_data::text);
ALTER TABLE public.question_bank ALTER COLUMN content_hash SET NOT NULL;
CREATE UNIQUE INDEX uq_question_bank_user_hash ON public.question_bank (user_id, content_hash);
```

### 2. Modificar `src/lib/question-bank.ts`

- Agregar función `computeHash(question)` que genera un hash determinista basado en `type + prompt + opciones/statements` (los campos que definen la identidad de la pregunta, ignorando el ID).
- Cambiar el insert para incluir `content_hash` y usar `onConflict: 'user_id,content_hash'` con comportamiento de ignorar duplicados (upsert que no actualiza nada).

### 3. Actualizar tipo `QuestionBankRow`

Agregar `content_hash: string` a la interfaz.

## Archivos afectados

| Archivo | Cambio |
|---------|--------|
| Nueva migración SQL | Agregar columna + índice único |
| `src/lib/question-bank.ts` | Hash + upsert sin duplicados |
