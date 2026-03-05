# Epic 12: Import/Export Pipeline

Обязательное условие для всех задач: строгое соблюдение [Project Rules](./00-project-rules.md).

## E12-T01 Реализовать импорт SDF/MOL

**Статус:** done (2026-03-05).

**Контекст:** SDF/MOL — основной формат структуры для MVP.

**Зависимости:** E04-T04.

**Критерии приемки:**

1. Пользователь может импортировать SDF/MOL через desktop file picker.
2. Импортированные вещества и структуры сохраняются в локальную БД.
3. Ошибки парсинга возвращаются с контекстом файла.

**Условия:**

- Парсер должен работать в безопасном режиме без произвольного выполнения кода.

## E12-T02 Реализовать импорт SMILES

**Статус:** done (2026-03-05).

**Контекст:** SMILES нужен как популярный обменный формат для ввода структур.

**Зависимости:** E12-T01.

**Критерии приемки:**

1. Поддержан импорт `.smi`/SMILES-строк.
2. После импорта структура доступна в библиотеке веществ.
3. Некорректные строки SMILES обрабатываются с понятной диагностикой.

**Условия:**

- Результаты импорта должны быть совместимы с модулем визуализации.

## E12-T03 Реализовать импорт XYZ и inference связей

**Статус:** done (2026-03-05).

**Контекст:** XYZ содержит координаты, но обычно не хранит явные связи.

**Зависимости:** E12-T01.

**Критерии приемки:**

1. Поддержан импорт XYZ с извлечением атомов и координат.
2. Реализован алгоритм inference связей на основе расстояний/радиусов.
3. Для inferred bonds публикуется confidence score.

**Условия:**

- Ограничения inference должны быть задокументированы в UI и docs.

## E12-T04 Реализовать безопасный pipeline импорта

**Приоритет:** P0.

**Статус:** OPEN.

**Проблема:** Импорт — основной внешний вход данных; без жестких security-рамок и формальных partial import semantics высок риск падений, переполнения ресурсов и неконсистентного состояния каталога.

**Контекст/архитектурные рамки:**

- Парсеры форматов: `app/src-tauri/src/adapters/io/sdf_mol.rs`, `app/src-tauri/src/adapters/io/smiles.rs`, `app/src-tauri/src/adapters/io/xyz.rs`.
- IPC-граница и нормализация ошибок: `app/src-tauri/src/adapters/ipc/v1.rs`, `app/src/shared/contracts/ipc/v1.ts`, `app/src/shared/contracts/ipc/client.ts`.
- Persistence и запись импортированных сущностей: `app/src-tauri/src/adapters/storage/repository.rs`.
- UI-диагностика и предупреждения: `app/src/features/substance-library/*`.

**Зависимости:** E12-T01, E12-T02, E12-T03.

**Что сделать:**

1. Зафиксировать import security policy: allowlist расширений, лимиты размера, лимиты записей, лимиты длины строки, timeout на парсинг.
2. Вынести общий security guard для импорта (валидация `fileName`, нормализация, запрет control chars/path traversal payload).
3. Добавить deadline-aware парсинг с прерыванием по timeout и нормализованной ошибкой `IMPORT_TIMEOUT`.
4. Ввести единый контракт partial import: `status=success|partial|failed`, `importedCount`, `skippedCount`, `failedCount`, `warnings[]`.
5. Определить атомарность на уровне записи: валидные записи сохраняются, невалидные пропускаются с warning; crash/panic недопустимы.
6. Гарантировать детерминированный порядок warnings (по `recordIndex`) и стабильные error codes для автоматических проверок.
7. Добавить backend-аудит событий импорта (начало/конец/partial/fail) без утечки чувствительных деталей.
8. Расширить UI: явная маркировка partial импорта, таблица предупреждений, быстрый доступ к проблемным записям.
9. Задокументировать security и partial semantics в `app/docs/import-security.md` и `app/docs/import-partial-semantics.md`.

**Технические ограничения:**

- Безопасные лимиты по умолчанию: не менее одного file-size guard и одного parse-timeout guard на каждый импорт.
- Никакого выполнения динамического кода, shell-команд или сетевых запросов в pipeline импорта.
- Все входные ошибки нормализуются в публичные коды без stack trace и внутренних путей.
- Partial import не должен ломать консистентность БД: каждая запись либо сохранена полностью, либо не сохранена.
- Контракт partial должен быть обратно совместимым для существующего клиента IPC.

**Тестирование:**

- Unit: тесты security guard на расширения, размер, control chars, traversal-паттерны.
- Unit: тесты формирования partial response и стабильности `warnings`/`status`.
- Integration: смешанный файл (валидные + невалидные записи) возвращает `partial` и корректные counts.
- Integration: oversized/timeout сценарии возвращают безопасные ошибки без паники.
- E2E: `tests/e2e/specs/import-security.spec.ts` (UI показывает partial и детальные warnings).
- Manual: импорт валидного, частично валидного и заведомо вредоносного фикстурного набора.
- Конкретные прогоны: `cd app && npm run lint`, `cd app && npm run test`, `cd app && npm run rust:test`, `cd app && npx playwright test tests/e2e/specs/import-security.spec.ts`.

**Критерии приемки:**

1. Для каждого формата действуют лимиты размера/времени и корректная нормализация входных данных.
2. Partial import реализован единообразно для SDF/MOL, SMILES и XYZ.
3. При частичном успехе сохраняются только валидные записи, пользователь получает полный список warning.
4. Любая ошибка импорта возвращается как нормализованный `CommandError` без crash.
5. Security regression тесты покрывают path/payload edge-cases и проходят стабильно.
6. Семантика partial import зафиксирована в документации и IPC-контракте.

**Артефакты результата:**

- `app/src-tauri/src/adapters/io/mod.rs`
- `app/src-tauri/src/adapters/io/import_guard.rs`
- `app/src-tauri/src/adapters/io/sdf_mol.rs`
- `app/src-tauri/src/adapters/io/smiles.rs`
- `app/src-tauri/src/adapters/io/xyz.rs`
- `app/src-tauri/src/adapters/ipc/v1.rs`
- `app/src/shared/contracts/ipc/v1.ts`
- `app/src/shared/contracts/ipc/client.ts`
- `app/tests/e2e/specs/import-security.spec.ts`
- `app/docs/import-security.md`
- `app/docs/import-partial-semantics.md`

**Definition of Done:**

- Выполнены критерии приемки и требования [Project Rules](./00-project-rules.md) (включая quality gate из раздела 7 и DoD из раздела 8).
- Обязательный non-regression: существующие успешные кейсы импорта SDF/MOL, SMILES, XYZ остаются рабочими и не меняют публичный API без версии.

## E12-T05 Реализовать экспорт SDF/MOL и SMILES

**Приоритет:** P0.

**Статус:** OPEN.

**Проблема:** Экспорт обязателен для MVP; без формального round-trip контракта и частичного экспорта с прогнозируемой семантикой пользователь рискует потерей данных и невалидными файлами при обмене.

**Контекст/архитектурные рамки:**

- Backend-адаптеры форматов и сериализация: `app/src-tauri/src/adapters/io/*`.
- IPC-команды экспорта и DTO: `app/src-tauri/src/adapters/ipc/v1.rs`, `app/src/shared/contracts/ipc/v1.ts`, `app/src/shared/contracts/ipc/client.ts`.
- Источник данных для экспорта: `app/src-tauri/src/adapters/storage/repository.rs` и текущий scenario state.
- UI-флоу экспорта и показ предупреждений: `app/src/features/substance-library/*`, `app/src/features/right-panel/*`.
- Документация контракта: `app/docs/import-export-roundtrip.md`.

**Зависимости:** E12-T01, E12-T02, E08-T04.

**Что сделать:**

1. Реализовать export-команды для SDF/MOL и SMILES с единым response-контрактом и нормализованными ошибками.
2. Добавить сериализаторы форматов с deterministic ordering записей (стабильный порядок по `id`/`name`).
3. Ввести partial export semantics: `status=success|partial|failed` и `warnings[]` для неподдержанных/поврежденных сущностей.
4. Определить жесткий round-trip contract (`import -> export -> import`) и явно разделить strict invariants и допустимые отклонения.
5. Добавить security-рамки экспорта: контроль максимального размера output, экранирование/очистка небезопасных символов, запрет path injection в именах.
6. Поддержать экспорт из двух источников: выбранный сценарий и библиотека веществ.
7. Реализовать интеграционные round-trip тесты для SDF/MOL и SMILES на фиксированном наборе образцов.
8. Добавить UI-представление partial export warnings и явный статус результата экспорта.
9. Задокументировать round-trip contracts, ограничения форматов и примеры в `app/docs/import-export-roundtrip.md`.

**Технические ограничения:**

- Экспорт не должен зависеть от платформы: LF line endings, UTF-8, стабильная сортировка.
- Round-trip contract обязателен: для поддержанных полей сохраняются идентичные значения или документированная нормализация.
- Для SMILES допускается текстовая нормализация строки, но не потеря химической сущности по контрактным метрикам.
- Partial export не блокирует весь процесс: валидные записи экспортируются, невалидные попадают в `warnings`.
- Размер output ограничен и валидируется до передачи в UI.

**Тестирование:**

- Unit: тесты сериализаторов SDF/MOL и SMILES, включая escape/sanitize кейсы.
- Integration: round-trip тесты `SDF->import->export->import` и `SMILES->import->export->import` с проверкой контрактов.
- Integration: partial export тест на смешанном наборе данных (`status=partial` + warning list).
- E2E: `tests/e2e/specs/export-roundtrip.spec.ts` на экспорт из UI и повторный импорт.
- Manual: проверка открытия экспортированных файлов во внешнем химическом viewer и обратного импорта.
- Конкретные прогоны: `cd app && npm run lint`, `cd app && npm run test`, `cd app && npm run rust:test`, `cd app && npx playwright test tests/e2e/specs/export-roundtrip.spec.ts`.

**Критерии приемки:**

1. Экспорт SDF/MOL и SMILES доступен из библиотеки веществ и сценария.
2. Частичный экспорт корректно возвращает `status=partial` и детальный список предупреждений.
3. Round-trip tests проходят по задокументированным strict/delta контрактам.
4. Ошибки экспорта нормализованы и не приводят к падению приложения.
5. Минимально необходимые метаданные включены в экспорт и восстанавливаются при повторном импорте.
6. Ограничения и гарантии round-trip опубликованы в документации.

**Артефакты результата:**

- `app/src-tauri/src/adapters/io/mod.rs`
- `app/src-tauri/src/adapters/io/export_sdf_mol.rs`
- `app/src-tauri/src/adapters/io/export_smiles.rs`
- `app/src-tauri/src/adapters/ipc/v1.rs`
- `app/src/shared/contracts/ipc/v1.ts`
- `app/src/shared/contracts/ipc/client.ts`
- `app/tests/e2e/specs/export-roundtrip.spec.ts`
- `app/assets/export-samples/`
- `app/docs/import-export-roundtrip.md`

**Definition of Done:**

- Выполнены критерии приемки и требования [Project Rules](./00-project-rules.md) (включая quality gate из раздела 7 и DoD из раздела 8).
- Обязательный non-regression: существующие сценарии импорта/хранения/расчетов не меняют поведение после добавления экспорта, кроме явно задокументированных контрактных нормализаций.
