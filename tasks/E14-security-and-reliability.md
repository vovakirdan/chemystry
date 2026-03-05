# Epic 14: Security and Reliability

Обязательное условие для всех задач: строгое соблюдение [Project Rules](./00-project-rules.md).

## E14-T01 Применить least-privilege для Tauri capabilities

**Приоритет:** P0 (security blocker).

**Статус:** pending.

**Проблема:** Избыточные Tauri capabilities расширяют поверхность атаки и повышают риск несанкционированного доступа к файловой системе/IPC.

**Контекст:** Desktop-приложение импортирует файлы и выполняет IPC-команды, поэтому baseline безопасности должен быть зафиксирован до расширения функционала. Зависимости: E01-T02, E12-T04.

**Что сделать (пошагово):**

1. Составить threat model для desktop-приложения: активы, доверенные границы, атакующие, каналы входа, вероятности и impact.
2. Зафиксировать capabilities matrix в формате `command -> capability -> scope -> justification -> owner -> risk`.
3. Провести инвентаризацию фактически используемых Tauri API и удалить неиспользуемые permissions.
4. Разделить capabilities для dev/prod профилей без расширения production-разрешений.
5. Добавить security checklist для ревью capability-изменений (обязательный пункт PR).
6. Привязать каждую capability к конкретному use-case из PRD/эпиков.

**Технические ограничения:**

- Только принцип least-privilege; wildcard-разрешения запрещены.
- Любое новое разрешение добавляется только с письменным обоснованием риска и rollback-планом.
- Capability-конфиги должны храниться в VCS и проходить peer review.
- Матрица должна быть двусторонне трассируемой: из capability в use-case и обратно.

**Тестирование (обязательные наборы + команды):**

- Набор: статическая валидация конфигурации и lint.
- Команды: `cd app && npm run rust:fmt:check`; `cd app && npm run rust:clippy`.
- Набор: unit/integration проверки guard-логики для capability-bound команд.
- Команды: `cd app && npm run rust:test`; `cd app && cargo test --manifest-path src-tauri/Cargo.toml capabilities -- --nocapture`.
- Набор: smoke-проверка запуска приложения с production capability профилем.
- Команда: `cd app && npm run build`.

**Критерии приемки:**

1. Threat model оформлен и согласован с владельцами backend/frontend.
2. Capabilities matrix создана и покрывает 100% IPC-команд и файловых операций.
3. В production конфиге отсутствуют неиспользуемые или избыточные разрешения.
4. Security checklist обязателен для любого PR, где меняются capabilities.

**Артефакты результата:**

- `app/docs/security/threat-model.md`.
- `app/docs/security/capabilities-matrix.md`.
- `app/src-tauri/capabilities/*.json` (или эквивалентные capability-конфиги).
- `app/docs/security/security-checklist.md`.

## E14-T02 Настроить строгий CSP и запрет нежелательных remote ресурсов

**Приоритет:** P0 (security blocker).

**Статус:** pending.

**Проблема:** Отсутствие строгой CSP повышает риск XSS/инъекций и загрузки непроверенных remote ресурсов.

**Контекст:** Приложение должно работать под жесткой production CSP без отключений для обхода ошибок. Зависимость: E14-T01.

**Что сделать (пошагово):**

1. Подготовить документ CSP policy с целевыми директивами для production и допустимыми отличиями для dev.
2. Явно задать директивы `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `frame-src`, `object-src`, `base-uri`.
3. Запретить remote script/style источники, если нет критичного и обоснованного исключения.
4. Добавить журнал согласованных исключений CSP с owner, сроком и причиной.
5. Включить проверку CSP в QA smoke: приложение должно запускаться и выполнять ключевые флоу без CSP-ошибок.
6. Зафиксировать процедуру внесения изменений в CSP (через PR и security review).

**Технические ограничения:**

- Запрещено отключать CSP в production.
- Все исключения оформляются как временные с датой пересмотра.
- Inline script/style допускаются только при доказанной необходимости и контролируемом nonce/hash подходе.
- CSP должна быть совместима с текущими Tauri/WebView ограничениями.

**Тестирование (обязательные наборы + команды):**

- Набор: сборка и запуск frontend под production-конфигом CSP.
- Команды: `cd app && npm run build`; `cd app && npm run preview`.
- Набор: frontend smoke/regression для пользовательских флоу под CSP.
- Команда: `cd app && npm run test`.
- Набор: e2e-проверка блокировки нежелательных remote ресурсов.
- Команда: `cd app && npx playwright test tests/e2e/specs/security-csp-smoke.spec.ts`.

**Критерии приемки:**

1. CSP policy документирована и утверждена.
2. Production CSP задана явно и запрещает ненужные remote источники.
3. Ключевые пользовательские сценарии работают без отключения CSP.
4. Для всех исключений есть owner, причина и срок ревизии.

**Артефакты результата:**

- `app/docs/security/csp-policy.md`.
- `app/src-tauri/tauri.conf.json` (или эквивалентный production CSP конфиг).
- `app/docs/security/csp-exceptions-register.md`.

## E14-T03 Усилить валидацию IPC payload и файловых путей

**Приоритет:** P0 (security/reliability blocker).

**Статус:** pending.

**Проблема:** Невалидные IPC payload и некорректные пути могут приводить к падениям, traversal-рискам и утечке внутренних деталей runtime.

**Контекст:** Основные точки входа данных в desktop-приложение — IPC и импорт файлов. Зависимости: E02-T02, E12-T04.

**Что сделать (пошагово):**

1. Составить IPC validation matrix: `command -> входные поля -> тип/ограничения -> нормализация -> expected error`.
2. Ввести единые DTO/схемы валидации для всех IPC-команд (обязательные поля, диапазоны, enum, лимиты длины).
3. Добавить централизованную нормализацию путей (canonicalization, запрет traversal, контроль разрешенных директорий).
4. Нормализовать ошибки: безопасные пользовательские сообщения без stack trace и внутренних путей.
5. Добавить негативные тесты для invalid payload/path traversal/oversized input.
6. Зафиксировать правило: новая IPC-команда не принимается без строки в matrix и тестов.

**Технические ограничения:**

- Валидация должна выполняться до бизнес-логики.
- Path validation должна быть кроссплатформенной (Linux/Windows/macOS).
- Ошибки должны быть детерминированными по коду/типу для QA-автоматизации.
- Запрещено раскрывать внутренние пути/структуры исключений в UI.

**Тестирование (обязательные наборы + команды):**

- Набор: unit-тесты схем валидации и нормализации путей.
- Команды: `cd app && npm run rust:test`; `cd app && cargo test --manifest-path src-tauri/Cargo.toml ipc_validation -- --nocapture`.
- Набор: integration-тесты IPC boundary (валидные и невалидные payload).
- Команда: `cd app && cargo test --manifest-path src-tauri/Cargo.toml ipc -- --nocapture`.
- Набор: frontend/regression для пользовательских ошибок импорта.
- Команда: `cd app && npm run test`.

**Критерии приемки:**

1. IPC validation matrix покрывает 100% публичных IPC-команд.
2. Все IPC-команды валидируют payload до выполнения бизнес-логики.
3. Path traversal и невалидные пути блокируются с безопасной ошибкой.
4. Негативные тесты на invalid payload/path проходят стабильно в CI.

**Артефакты результата:**

- `app/docs/security/ipc-validation-matrix.md`.
- `app/src-tauri/src/*` (валидация DTO и path guard).
- `app/src-tauri/tests/*` (негативные IPC/path тесты).

## E14-T04 Реализовать recovery-механизмы и smoke tests отказоустойчивости

**Приоритет:** P1.

**Статус:** pending.

**Проблема:** При сбоях импорта/симуляции пользователь теряет контекст работы, а приложение может оставаться в неконсистентном состоянии.

**Контекст:** MVP должен переживать ошибки парсинга и runtime-сбои без потери пользовательских данных. Зависимости: E14-T03, E10-T04.

**Что сделать (пошагово):**

1. Описать recovery playbooks для ключевых инцидентов: импорт с ошибкой, сбой симуляции, поврежденные входные данные, таймаут IPC.
2. Ввести безопасные fallback-состояния UI и backend (rollback до последнего консистентного snapshot).
3. Реализовать механизм soft-reset без перезапуска приложения.
4. Добавить телеметрию/логирование причин сбоя и результата recovery.
5. Добавить smoke-наборы отказоустойчивости для критических failure-сценариев.
6. Зафиксировать runbook для ручного воспроизведения и triage инцидентов.

**Технические ограничения:**

- Recovery не должен молча удалять пользовательские данные.
- Любой rollback должен быть явным и наблюдаемым в UI.
- Ошибки recovery не должны приводить к panic/crash.
- Smoke-наборы должны выполняться headless в CI.

**Тестирование (обязательные наборы + команды):**

- Набор: unit/integration тесты rollback и error boundary.
- Команды: `cd app && npm run rust:test`; `cd app && cargo test --manifest-path src-tauri/Cargo.toml recovery -- --nocapture`.
- Набор: frontend smoke для восстановления UI после ошибок.
- Команда: `cd app && npm run test`.
- Набор: e2e отказоустойчивости на ключевых сценариях.
- Команда: `cd app && npx playwright test tests/e2e/specs/recovery-smoke.spec.ts`.

**Критерии приемки:**

1. После сбоя симуляции UI возвращается в консистентное состояние без перезапуска.
2. После неуспешного импорта приложение продолжает работу и сохраняет предыдущие данные.
3. Recovery playbooks покрывают минимум 4 класса инцидентов и доступны QA/Support.
4. Smoke-набор отказоустойчивости проходит в CI.

**Артефакты результата:**

- `app/docs/reliability/recovery-playbooks.md`.
- `app/docs/reliability/incident-triage-runbook.md`.
- `app/tests/e2e/specs/recovery-smoke.spec.ts`.
- `app/src-tauri/tests/*` и `app/src/**/*` (fallback/recovery тесты и реализация).

## Non-Regression Gate (E14)

Перед переводом любой задачи E14 в `done` обязательно выполнить и приложить результаты:

1. [`cd app && npm run rust:fmt:check`](../app/package.json)
2. [`cd app && npm run rust:clippy`](../app/package.json)
3. [`cd app && npm run rust:test`](../app/package.json)
4. [`cd app && npm run lint`](../app/package.json)
5. [`cd app && npm run test`](../app/package.json)
6. [`cd app && npm run build`](../app/package.json)
7. [`cd app && npx playwright test`](../app/tests/e2e/README.md)
8. [`cd app && cargo test --manifest-path src-tauri/Cargo.toml ipc_validation -- --nocapture`](../app/src-tauri/Cargo.toml)
9. [`cd app && cargo test --manifest-path src-tauri/Cargo.toml recovery -- --nocapture`](../app/src-tauri/Cargo.toml)

Ссылка на общий baseline проверок: [Quality Gate в Project Rules](./00-project-rules.md#7-quality-gate-обязателен-перед-merge).
