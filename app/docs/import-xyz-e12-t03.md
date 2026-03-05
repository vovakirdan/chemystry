# XYZ Import + Bond Inference (E12-T03)

## Что реализовано
- Добавлена IPC-команда `import_xyz_v1` (Rust backend + TS contracts/client).
- Добавлен parser `app/src-tauri/src/adapters/io/xyz.rs` для `.xyz` файлов:
  - поддержка формата записи `N`, `title/comment`, далее `N` строк атомов `<symbol> <x> <y> <z>`;
  - поддержка нескольких XYZ-записей подряд в одном файле;
  - contextual parse errors с контекстом `file`, `record`, `line`.
- Для каждой XYZ-записи рассчитываются:
  - `formula` по atom counts,
  - `molar_mass_g_mol` по таблице атомных масс,
  - inferred bonds по расстояниям и ковалентным радиусам,
  - confidence score для каждой inferred связи в диапазоне `[0, 1]`,
  - summary confidence (`avgConfidence`, `minConfidence`) и количество inferred bonds.
- Импорт в storage выполняется атомарно через batch insert (`create_substances_batch`):
  - при ошибке любой записи откатывается весь batch,
  - duplicate handling по паре `(name, formula)` против БД и внутри файла.
- В Library UI добавлена кнопка `Import XYZ` (`data-testid="library-import-xyz-button"`) и hidden input `accept=".xyz"`.
- В success notification для XYZ отображаются количество импортов и confidence summary.
- В UI добавлены предупреждения, что XYZ bond inference носит эвристический характер.

## Inference algorithm (MVP)
- Для каждой пары атомов в записи:
  - вычисляется евклидово расстояние `d`;
  - берется сумма ковалентных радиусов `r = r1 + r2`;
  - пара считается bonded, если `d <= 1.25 * r` и `d >= 0.35 Å`.
- Confidence оценивается по близости `d` к `r`:
  - `confidence = clamp(1 - abs((d / r) - 1) / 0.35, 0, 1)`.
- Для записи вычисляются summary метрики:
  - `inferredBondCount`,
  - `avgConfidence` (среднее по inferred связям),
  - `minConfidence` (минимум по inferred связям),
  - если связей нет, summary confidence = `0`.

## Ограничения
- Это геометрическая эвристика, а не полноценная химическая реконструкция структуры.
- Не учитываются:
  - формальные заряды,
  - валентные/резонансные ограничения,
  - порядок связи (single/double/triple),
  - состояние среды и квантово-химические эффекты.
- Результаты inference должны считаться вспомогательными и требовать ручной валидации для граничных случаев.
- Для элементов без явно заданного ковалентного радиуса используется fallback-значение радиуса (MVP-допущение).

## Manual QA checklist
1. Открыть `Library` и проверить наличие кнопки `Import XYZ`.
2. Импортировать валидный `.xyz` с одной записью (например вода) и убедиться, что:
   - появился success notification с количеством импортов,
   - в notification есть confidence summary,
   - вещество добавлено в Library с source `imported`.
3. Импортировать `.xyz` с несколькими записями и проверить `importedCount` и список новых веществ.
4. Импортировать сломанную запись (например неполная atom line) и проверить import error с `file`, `record`, `line`.
5. Проверить rollback: спровоцировать конфликт на второй записи и убедиться, что batch не частично записался.
6. Во время импорта убедиться, что controls в Library (включая import кнопки) отключены (`importing` state).
7. Убедиться, что отображается предупреждение о heuristic nature XYZ inference.
