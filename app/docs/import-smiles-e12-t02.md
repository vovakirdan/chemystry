# SMILES Import (E12-T02)

## Что реализовано
- Добавлена IPC-команда `import_smiles_v1` (Rust backend + TS IPC contracts/client).
- Добавлен parser `app/src-tauri/src/adapters/io/smiles.rs` для `.smi` payload:
  - каждая непустая и не-комментарий строка (`# ...`) обрабатывается как отдельная запись,
  - формат строки: `<smiles> [name...]`.
- Для каждой записи формируется substance payload:
  - `name`: из строки или fallback `Imported SMILES <n>`,
  - `smiles`: исходный SMILES токен,
  - `formula` и `molar_mass_g_mol`: расчет по явным атомным символам из SMILES,
  - `phase_default`: `solid`,
  - `source_type`: `imported`.
- Импорт выполняется атомарно через `create_substances_batch`.
- Duplicate handling соответствует E12-T01: проверка по паре `(name, formula)` против БД и внутри файла.
- Добавлена кнопка Library `data-testid="library-import-smiles-button"`.
- Добавлен отдельный hidden file input для SMILES c `accept=".smi,.smiles,.txt"`.
- UI интегрирован в существующий mutation state `importing` и notifications.

## Ограничения MVP parser
- Валидация SMILES ограничена MVP-правилами:
  - token не пустой,
  - только разрешенный набор символов,
  - баланс `()` и `[]`.
- Формула и молярная масса считаются как приближение только по явным атомам, без полной химической интерпретации:
  - implicit H и валентность не вычисляются,
  - wildcard/сложные конструкции вне поддержки приводят к controlled parse error.
- При ошибке возвращается import error с контекстом `file`, `record`, `line`.

## Manual QA checklist
1. Открыть `Library`, убедиться в наличии кнопки `Import SMILES`.
2. Импортировать валидный `.smi` файл с несколькими строками и optional name.
3. Проверить уведомление об успешно импортированном количестве веществ.
4. Проверить, что новые вещества появились в Library с source `imported` и phase `solid`.
5. Проверить, что у импортированных веществ сохранен SMILES и рассчитаны formula/molar mass (MVP approximation).
6. Импортировать файл с ошибкой (например, `Qq ...` или несбалансированные скобки) и проверить ошибку с `file`, `record`, `line`.
7. Во время импорта убедиться, что import кнопки отключены (через `importing` state).
