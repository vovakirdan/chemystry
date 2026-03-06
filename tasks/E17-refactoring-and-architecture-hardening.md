# Epic 17: Refactoring and Architecture Hardening

Обязательное условие для всех задач: строгое соблюдение [Project Rules](./00-project-rules.md).

## E17-T01 Модульная декомпозиция `app/src-tauri/src/adapters/ipc/v1.rs`

**Приоритет:** P0 (critical).

**Статус:** done.

**Проблема/Контекст:** `app/src-tauri/src/adapters/ipc/v1.rs` совмещает DTO-контракты, валидацию, маппинг, обработку ошибок, хендлеры команд и тесты в одном файле (~4500 строк). Это повышает стоимость изменений и риск регрессий в IPC.

**Что сделать (пошагово):**

1. Зафиксировать текущий public API команд `*_v1` (имена, сигнатуры, категории/коды ошибок) как инвариант для рефакторинга.
2. Перейти к directory-модулю `app/src-tauri/src/adapters/ipc/v1/` и оставить `mod.rs` как тонкий слой публичных экспортов.
3. Выполнить декомпозицию в целевую структуру:
   - `app/src-tauri/src/adapters/ipc/v1/contract.rs`
   - `app/src-tauri/src/adapters/ipc/v1/validation/common.rs`
   - `app/src-tauri/src/adapters/ipc/v1/validation/substances.rs`
   - `app/src-tauri/src/adapters/ipc/v1/validation/imports.rs`
   - `app/src-tauri/src/adapters/ipc/v1/validation/scenarios.rs`
   - `app/src-tauri/src/adapters/ipc/v1/mapping/catalog.rs`
   - `app/src-tauri/src/adapters/ipc/v1/mapping/scenarios.rs`
   - `app/src-tauri/src/adapters/ipc/v1/errors.rs`
   - `app/src-tauri/src/adapters/ipc/v1/commands/system.rs`
   - `app/src-tauri/src/adapters/ipc/v1/commands/substances.rs`
   - `app/src-tauri/src/adapters/ipc/v1/commands/presets.rs`
   - `app/src-tauri/src/adapters/ipc/v1/commands/imports.rs`
   - `app/src-tauri/src/adapters/ipc/v1/commands/scenarios.rs`
   - `app/src-tauri/src/adapters/ipc/v1/tests.rs`
4. Ограничить видимость helper-функций до `pub(crate)`/private и убрать неявные cross-module зависимости.
5. Добавить `Intent:`-комментарии перед нетривиальными валидаторами и эвристиками нормализации payload.
6. Обновить точки подключения модуля в адаптере IPC (без изменения внешнего контракта).

**Технические ограничения:**

- Нельзя менять `CONTRACT_VERSION_V1`, имена tauri-команд и сериализованные поля API.
- Нельзя менять текущие error category/code, кроме отдельно задокументированных bugfix.
- Нельзя ослаблять входную валидацию или удалять существующие checks.
- Каждый новый файл должен соответствовать лимитам размера из Project Rules.

**Тестирование (unit/integration/e2e):**

- Unit: покрыть новые модули `validation/*`, `mapping/*`, `errors.rs` существующими и добавленными тестами.
- Integration: проверить end-to-end вызовы tauri-команд внутри rust-тестов IPC-модуля.
- E2E: для затронутых импорт/сценарий команд прогнать smoke-флоу UI (если меняется поведение на границе frontend/backend).
- **Обязательный non-regression gate:** `cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check` + `cargo clippy --manifest-path app/src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` + `cargo test --manifest-path app/src-tauri/Cargo.toml`.

**Критерии приемки:**

1. `v1.rs` преобразован в directory-модуль, и логика разнесена по целевой структуре.
2. Публичные IPC-функции `*_v1` сохраняют совместимость по сигнатурам и форматам ответов.
3. Нет новых модулей выше hard limit без ADR.
4. В нетривиальных валидаторах/эвристиках присутствуют `Intent:`-комментарии.
5. Non-regression gate проходит полностью.

**Артефакты результата (пути файлов/директорий):**

- `app/src-tauri/src/adapters/ipc/v1/mod.rs`
- `app/src-tauri/src/adapters/ipc/v1/`

## E17-T02 Декомпозиция `app/src/App.tsx`

**Приоритет:** P0 (critical).

**Статус:** done.

**Проблема/Контекст:** `app/src/App.tsx` содержит одновременно orchestration UI, бизнес-правила валидации, persistence в localStorage, lifecycle симуляции и экспорт расчетов (~3500 строк). Это усложняет сопровождение и снижает изоляцию unit-тестов.

**Что сделать (пошагово):**

1. Выделить `App.tsx` в роль UI-orchestrator и убрать из него вычислительную/валидационную логику.
2. Разнести логику в целевую структуру:
   - `app/src/app/validation/launchValidation.ts`
   - `app/src/app/simulation/lifecycle.ts`
   - `app/src/app/calculations/signature.ts`
   - `app/src/app/environment/rewind.ts`
   - `app/src/app/persistence/scenarioHistoryStorage.ts`
   - `app/src/app/persistence/environmentRewindStorage.ts`
   - `app/src/app/persistence/leftPanelStorage.ts`
   - `app/src/app/lib/exportCalculationSummary.ts`
3. Перевести `App.tsx` на импорт этих модулей и оставить в файле только композицию state/effects/props.
4. Сохранить или явно реэкспортировать тестируемые публичные функции (`buildLaunchValidationModel`, `applySimulationLifecycleCommand`, `createCalculationInputSignature`, `isCalculationSummaryStale`, `anchorEnvironmentRewindStack`, `rewindEnvironmentStep`, parsers localStorage).
5. Добавить `Intent:`-комментарии для нетривиальных правил валидации и simulation lifecycle переходов.

**Технические ограничения:**

- Нельзя ломать `default export App` и текущую точку входа `app/src/main.tsx`.
- Нельзя менять стабильные `data-testid`/UI-селекторы без обновления тестов и явной причины.
- Нельзя дублировать доменную логику между новыми модулями; общий код выносить в `app/src/app/lib/*`.
- Размер `App.tsx` после декомпозиции должен быть существенно ниже hard limit.

**Тестирование (unit/integration/e2e):**

- Unit: добавить/обновить тесты для `launchValidation`, `lifecycle`, `rewind`, `signature`.
- Integration: сохранить и обновить `app/src/App.test.tsx` как интеграционную проверку контейнера.
- E2E: smoke по критичному сценарию `builder -> launch -> save/load scenario`.
- **Обязательный non-regression gate:** `npm run lint` + `npm run test -- src/App.test.tsx` + `npm run build`.

**Критерии приемки:**

1. `App.tsx` выполняет роль orchestrator и не содержит bulk-логики валидации/парсинга/эвристик.
2. Целевая структура модулей создана и используется.
3. Все публичные утилиты, на которые опираются тесты, доступны через стабильные импорты.
4. Нет функциональных регрессий в управлении запуском симуляции и истории сценариев.
5. Non-regression gate проходит полностью.

**Артефакты результата (пути файлов/директорий):**

- `app/src/App.tsx`
- `app/src/app/validation/launchValidation.ts`
- `app/src/app/simulation/lifecycle.ts`
- `app/src/app/calculations/signature.ts`
- `app/src/app/environment/rewind.ts`
- `app/src/app/persistence/`
- `app/src/app/lib/exportCalculationSummary.ts`

## E17-T03 Декомпозиция `app/src-tauri/src/adapters/storage/repository.rs`

**Приоритет:** P0 (critical).

**Статус:** planned.

**Проблема/Контекст:** `repository.rs` перегружен CRUD-операциями, парсингом JSON payload, seeding baseline-данных, файловыми операциями и тестами (~3100 строк). Высокий риск скрытых side-effects при правках хранения данных.

**Что сделать (пошагово):**

1. Перевести `repository.rs` в directory-модуль `repository/` с `mod.rs`.
2. Разнести ответственность по целевой структуре:
   - `app/src-tauri/src/adapters/storage/repository/entities.rs`
   - `app/src-tauri/src/adapters/storage/repository/substances.rs`
   - `app/src-tauri/src/adapters/storage/repository/presets.rs`
   - `app/src-tauri/src/adapters/storage/repository/scenarios.rs`
   - `app/src-tauri/src/adapters/storage/repository/seed.rs`
   - `app/src-tauri/src/adapters/storage/repository/parsers.rs`
   - `app/src-tauri/src/adapters/storage/repository/file_ops.rs`
   - `app/src-tauri/src/adapters/storage/repository/sqlite_helpers.rs`
   - `app/src-tauri/src/adapters/storage/repository/tests.rs`
3. Зафиксировать транзакционные границы и не менять SQL-модели/миграции в рамках этой задачи.
4. Добавить `Intent:`-комментарии для нетривиального JSON parsing и атомарной замены файла БД.
5. Проверить, что публичный API `StorageRepository` остался обратно совместимым для IPC-слоя.

**Технические ограничения:**

- Нельзя менять схему базы и миграции.
- Нельзя менять семантику atomic replace/validate sqlite file.
- Нельзя ухудшать диагностические сообщения `StorageError`.
- Нельзя оставлять новые модули выше hard limit без ADR.

**Тестирование (unit/integration/e2e):**

- Unit: тесты для `parsers.rs`, `sqlite_helpers.rs`, `file_ops.rs`.
- Integration: существующие репозиторные тесты на CRUD/seed/import сценарии.
- E2E: прогон smoke-цепочки сохранения/загрузки сценария через UI при изменении контрактной поверхности.
- **Обязательный non-regression gate:** `cargo fmt --manifest-path app/src-tauri/Cargo.toml -- --check` + `cargo clippy --manifest-path app/src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` + `cargo test --manifest-path app/src-tauri/Cargo.toml`.

**Критерии приемки:**

1. Монолит `repository.rs` декомпозирован в целевую структуру directory-модуля.
2. API `StorageRepository` и поведение транзакций/ошибок не изменены.
3. Критичные парсеры и file operations имеют явные `Intent:`-комментарии.
4. Нет новых модулей выше hard limit без ADR.
5. Non-regression gate проходит полностью.

**Артефакты результата (пути файлов/директорий):**

- `app/src-tauri/src/adapters/storage/repository/mod.rs`
- `app/src-tauri/src/adapters/storage/repository/`

## E17-T04 Декомпозиция `app/src/shared/contracts/ipc/client.ts`

**Приоритет:** P1 (high).

**Статус:** planned.

**Проблема/Контекст:** `client.ts` объединяет invoke-layer, парсеры payload, нормализацию ошибок и feature-flag fallback (~1400 строк). Это делает изменения в одном контракте рискованными для остальных команд.

**Что сделать (пошагово):**

1. Разделить `client.ts` на API-слой и модули парсинга/ошибок.
2. Ввести целевую структуру:
   - `app/src/shared/contracts/ipc/client/index.ts`
   - `app/src/shared/contracts/ipc/client/requestId.ts`
   - `app/src/shared/contracts/ipc/client/errors.ts`
   - `app/src/shared/contracts/ipc/client/guards.ts`
   - `app/src/shared/contracts/ipc/client/parsers/substances.ts`
   - `app/src/shared/contracts/ipc/client/parsers/presets.ts`
   - `app/src/shared/contracts/ipc/client/parsers/imports.ts`
   - `app/src/shared/contracts/ipc/client/parsers/scenarios.ts`
   - `app/src/shared/contracts/ipc/client/featureFlags.ts`
3. Оставить `app/src/shared/contracts/ipc/client.ts` как совместимый barrel/re-export слой на время миграции импортов.
4. Добавить `Intent:`-комментарии в нетривиальные парсеры alias-полей и в normalization fallback ошибок.
5. Поддержать строгую типизацию без `any` и сохранить текущий контракт возвращаемых DTO.

**Технические ограничения:**

- Нельзя менять имена экспортируемых публичных API-функций клиента без миграционного слоя.
- Нельзя изменять user-facing error mapping без явно заданного требования.
- Нельзя размазывать parser-логику обратно в UI-компоненты.
- Нельзя ослаблять runtime-проверки payload.

**Тестирование (unit/integration/e2e):**

- Unit: выделенные parser-тесты по доменам (`substances`, `imports`, `scenarios`, `presets`).
- Integration: сохранить и расширить `app/src/shared/contracts/ipc/client.test.ts` для invoke/error pipelines.
- E2E: не требуется отдельный новый сценарий, если публичный интерфейс клиента не изменен.
- **Обязательный non-regression gate:** `npm run lint` + `npm run test -- src/shared/contracts/ipc/client.test.ts` + `npm run build`.

**Критерии приемки:**

1. `client.ts` разделен на модули по ответственности, совместимость импортов сохранена.
2. Парсеры и error-normalization изолированы и покрыты тестами.
3. Все команды IPC клиента возвращают данные в прежнем формате.
4. Нетривиальные преобразования имеют `Intent:`-комментарии.
5. Non-regression gate проходит полностью.

**Артефакты результата (пути файлов/директорий):**

- `app/src/shared/contracts/ipc/client.ts`
- `app/src/shared/contracts/ipc/client/`

## E17-T05 Декомпозиция `app/src/features/left-panel/LeftPanelSkeleton.tsx`

**Приоритет:** P1 (high).

**Статус:** planned.

**Проблема/Контекст:** `LeftPanelSkeleton.tsx` одновременно содержит rendering трех вкладок, форматтеры, формы, placeholder-состояния и локальные view helpers (~1300 строк). Это снижает читаемость и усложняет тестирование отдельных сценариев по вкладкам.

**Что сделать (пошагово):**

1. Выделить presentational-компоненты и утилиты из `LeftPanelSkeleton.tsx`.
2. Сформировать целевую структуру:
   - `app/src/features/left-panel/LeftPanelSkeleton.tsx` (тонкий orchestrator)
   - `app/src/features/left-panel/components/LeftPanelTabs.tsx`
   - `app/src/features/left-panel/components/LeftPanelPlaceholder.tsx`
   - `app/src/features/left-panel/components/library/LibraryTab.tsx`
   - `app/src/features/left-panel/components/library/SubstanceEditorForm.tsx`
   - `app/src/features/left-panel/components/builder/BuilderTab.tsx`
   - `app/src/features/left-panel/components/presets/PresetsTab.tsx`
   - `app/src/features/left-panel/formatters.ts`
   - `app/src/features/left-panel/view-model.ts`
3. Сохранить стабильные `data-testid`, роли и интерактивные селекторы, используемые тестами.
4. Добавить `Intent:`-комментарии в местах нетривиального formatting/parsing (например обработка временных меток и UI-эвристик отображения).
5. Уточнить границы между компонентами: передавать готовый view-model, избегать скрытой бизнес-логики внутри JSX.

**Технические ограничения:**

- Нельзя ломать контракты `LeftPanelSkeletonProps` без параллельной миграции всех вызовов.
- Нельзя менять поведение disabled/loading/error состояний вкладок.
- Нельзя удалять существующие пользовательские подсказки/validation blocks без эквивалентной замены.
- Нельзя оставлять новые модули выше hard limit без ADR.

**Тестирование (unit/integration/e2e):**

- Unit/component: покрыть `LibraryTab`, `BuilderTab`, `PresetsTab`, `SubstanceEditorForm`.
- Integration: обновить `app/src/features/left-panel/LeftPanelSkeleton.test.tsx` для проверки end-to-end рендера контейнера.
- E2E: smoke-проверка базовых действий в левой панели (фильтр, выбор, сохранение/загрузка сценария).
- **Обязательный non-regression gate:** `npm run lint` + `npm run test -- src/features/left-panel/LeftPanelSkeleton.test.tsx` + `npm run build`.

**Критерии приемки:**

1. `LeftPanelSkeleton.tsx` стал orchestration-компонентом без длинных inline helper-блоков.
2. Вкладки/формы вынесены в отдельные модули по целевой структуре.
3. Стабильные тестовые селекторы и accessibility-атрибуты сохранены.
4. Нетривиальные format/heuristic места снабжены `Intent:`-комментариями.
5. Non-regression gate проходит полностью.

**Артефакты результата (пути файлов/директорий):**

- `app/src/features/left-panel/LeftPanelSkeleton.tsx`
- `app/src/features/left-panel/components/`
- `app/src/features/left-panel/formatters.ts`
- `app/src/features/left-panel/view-model.ts`
