# Epic 15: Test Coverage and QA

Обязательное условие для всех задач: строгое соблюдение [Project Rules](./00-project-rules.md).

## E15-T01 Сформировать тестовую матрицу и coverage policy

**Приоритет:** P0.

**Статус:** pending.

**Проблема:** Без единой тестовой матрицы и формализованной coverage policy команда не видит пробелы покрытия и системно пропускает регрессии.

**Контекст:** Нужна явная стратегия тестирования по слоям `Rust domain`, `frontend`, `IPC`, `e2e`, плюс правила стабилизации тестов в CI. Зависимости: E08-T04, E10-T04, E12-T05.

**Что сделать (пошагово):**

1. Сформировать тестовую матрицу `модуль -> тип теста -> критичность -> владелец -> частота прогона`.
2. Зафиксировать coverage policy с минимальными порогами:
   - Rust общий line coverage >= 80%.
   - Rust критичные модули (`calculation`, `simulation`, `validation`, `import`) >= 90%.
   - Frontend общий statements >= 75%, branches >= 65%.
   - Frontend критичные фичи (`Builder`, `Environment`, `Results`) statements >= 85%, branches >= 75%.
3. Описать anti-flaky policy: deterministic seed, запрет `sleep`-ожиданий без условия, ограничение retries, quarantine-процесс.
4. Определить release smoke-набор с фиксированным списком сценариев и owner.
5. Добавить правила интерпретации coverage метрик, чтобы не допускать low-value тестов.

**Технические ограничения:**

- Coverage-порог ниже указанных значений запрещен без согласованного exception.
- Анти-flaky правила обязательны для всех новых test suites.
- При временной изоляции flaky-теста должен быть создан issue с дедлайном возврата.
- Политика должна быть применима и локально, и в CI.

**Тестирование (обязательные наборы + команды):**

- Набор: проверка базовых QA-команд.
- Команды: `cd app && npm run lint`; `cd app && npm run test`; `cd app && npm run rust:test`.
- Набор: сбор coverage-отчетов.
- Команды: `cd app && npm run test -- --coverage`; `cd app && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --workspace --lcov --output-path coverage/rust.lcov`.
- Набор: smoke e2e для подтверждения матрицы критичных флоу.
- Команда: `cd app && npx playwright test`.

**Критерии приемки:**

1. В `docs/testing-strategy.md` есть полная матрица unit/integration/e2e по ключевым модулям.
2. Coverage policy содержит минимальные пороги по Rust и frontend (как минимум значения из раздела "Что сделать").
3. Anti-flaky policy зафиксирована и обязательна для CI.
4. Сформирован и утвержден release smoke-набор.

**Артефакты результата:**

- `app/docs/testing-strategy.md`.
- `app/docs/qa/coverage-policy.md`.
- `app/docs/qa/anti-flaky-policy.md`.
- `app/docs/qa/release-smoke-suite.md`.

## E15-T02 Добавить unit/integration тесты Rust-домена

**Приоритет:** P0.

**Статус:** pending.

**Проблема:** Доменная логика расчетов и симуляции наиболее подвержена критичным регрессиям и требует плотного покрытия.

**Контекст:** Основные риски находятся в `calculation`, `validation`, `simulation loop`, а также в ошибках границ входных данных. Зависимость: E15-T01.

**Что сделать (пошагово):**

1. Добавить unit-тесты для расчетных и валидационных модулей с проверкой граничных условий.
2. Добавить integration-тесты для ключевых сценариев simulation loop.
3. Ввести deterministic test mode (фиксированный seed, контролируемые источники времени/рандома).
4. Добавить негативные тесты для ошибочных входных данных и отказоустойчивости.
5. Подключить сбор rust coverage и проверку порогов в CI.
6. Обновить документацию по тестам Rust-домена и трассировку до требований PRD.

**Технические ограничения:**

- Тесты должны быть детерминированными и не зависеть от внешней среды.
- Запрещены хрупкие проверки строковых сообщений, если есть устойчивые коды ошибок.
- Каждый критичный доменный модуль должен иметь как positive, так и negative сценарии.
- Покрытие для критичных Rust-модулей должно соответствовать policy (>= 90%).

**Тестирование (обязательные наборы + команды):**

- Набор: quality baseline Rust.
- Команды: `cd app && npm run rust:fmt:check`; `cd app && npm run rust:clippy`; `cd app && npm run rust:test`.
- Набор: integration regression по simulation loop.
- Команда: `cd app && cargo test --manifest-path src-tauri/Cargo.toml simulation -- --nocapture`.
- Набор: coverage контроль Rust.
- Команда: `cd app && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --workspace --fail-under-lines 80`.

**Критерии приемки:**

1. Unit-тестами покрыты calculation и validation модули.
2. Integration-тесты покрывают ключевые сценарии simulation loop.
3. Тесты стабильны в CI и не классифицируются как flaky.
4. Coverage Rust соответствует policy: общий >= 80%, критичные модули >= 90%.

**Артефакты результата:**

- `app/src-tauri/src/domain/**/*` (тесты рядом с модулями).
- `app/src-tauri/tests/*` (integration тесты).
- `app/coverage/rust.lcov` или эквивалентный coverage отчет.
- `app/docs/qa/rust-test-matrix.md`.

## E15-T03 Добавить unit/component тесты frontend

**Приоритет:** P1.

**Статус:** pending.

**Проблема:** Без поведенческих unit/component тестов UI-слои теряют устойчивость, а регрессии всплывают поздно.

**Контекст:** Критичны пользовательские флоу в `Builder`, `Environment`, `Results` и сценарии валидации ввода. Зависимости: E15-T01, E03-T04.

**Что сделать (пошагово):**

1. Настроить/уточнить `Vitest` конфигурацию для unit/component тестов с отчетом coverage.
2. Добавить поведенческие тесты ключевых компонентов через Testing Library подход.
3. Покрыть сценарии: ввод данных, валидация, переключение профилей, отображение ошибок.
4. Добавить фикстуры и тестовые хелперы для повторно используемых сценариев.
5. Включить контроль coverage-порогов frontend в CI.
6. Добавить anti-flaky практики: fake timers где нужно, ожидания по событию, запрет произвольных таймаутов.

**Технические ограничения:**

- Тестировать только наблюдаемое поведение, не внутренние реализации.
- Селекторы должны быть устойчивыми (`data-testid`/роль/текст по правилам QA).
- Тесты не должны зависеть от внешней сети и случайности.
- Coverage для критичных UI-фич должен соответствовать policy (statements >= 85%, branches >= 75%).

**Тестирование (обязательные наборы + команды):**

- Набор: frontend baseline.
- Команды: `cd app && npm run lint`; `cd app && npm run test`; `cd app && npm run build`.
- Набор: coverage frontend.
- Команда: `cd app && npm run test -- --coverage`.
- Набор: targeted regression для критичных UI флоу.
- Команда: `cd app && npm run test -- src/features`.

**Критерии приемки:**

1. `Vitest` покрывает ключевые компоненты и пользовательские сценарии.
2. Тестируются ввод, валидация и переключение профилей.
3. В CI формируется coverage отчет frontend.
4. Coverage frontend соответствует policy: общий statements >= 75%/branches >= 65%, критичные фичи >= 85%/75%.

**Артефакты результата:**

- `app/src/**/*.test.ts` и `app/src/**/*.test.tsx`.
- `app/vitest.config.ts`.
- `app/coverage/` (frontend отчеты).
- `app/docs/qa/frontend-test-matrix.md`.

## E15-T04 Добавить E2E smoke/regression набор на Playwright

**Приоритет:** P0.

**Статус:** pending.

**Проблема:** Отсутствие E2E-regression набора не позволяет гарантировать целостность ключевых пользовательских потоков перед релизом.

**Контекст:** Нужны стабильные headless e2e тесты на целостные флоу MVP. Зависимости: E15-T01, E12-T05.

**Что сделать (пошагово):**

1. Подготовить Playwright конфигурацию под headless CI и артефакты падений (trace/video/screenshot).
2. Реализовать минимум 3 сценария: `manual build run`, `import/export`, `settings profile`.
3. Внедрить стабильные селекторы и page-object слой для снижения flaky-рисков.
4. Настроить anti-flaky контроль: deterministic test data, запрет жестких sleep, ограниченный retry policy.
5. Добавить CI job и публикацию e2e артефактов при падении.
6. Описать процедуру triage для flaky/failing e2e.

**Технические ограничения:**

- Сценарии должны быть независимы и идемпотентны.
- Любой retry выше 1 в CI запрещен без отдельного обоснования.
- При падении обязательно сохранять trace/video/screenshot.
- E2E должны проходить в headless режиме на чистом окружении.

**Тестирование (обязательные наборы + команды):**

- Набор: запуск smoke e2e.
- Команда: `cd app && npx playwright test`.
- Набор: запуск regression e2e по критичным сценариям.
- Команда: `cd app && npx playwright test tests/e2e/specs`.
- Набор: проверка артефактов падений и отчета.
- Команды: `cd app && npx playwright show-report`; `cd app && ls -la test-results`.

**Критерии приемки:**

1. Реализовано минимум 3 e2e-сценария из обязательного списка.
2. E2E стабильно выполняются headless в CI.
3. При падениях сохраняются trace/video/screenshot.
4. Anti-flaky требования зафиксированы и соблюдаются.

**Артефакты результата:**

- `app/tests/e2e/playwright.config.ts`.
- `app/tests/e2e/specs/*.spec.ts`.
- `app/test-results/` и `app/playwright-report/`.
- `app/docs/qa/e2e-test-plan.md`.

## Non-Regression Gate (E15)

Перед переводом любой задачи E15 в `done` обязательно выполнить и приложить результаты:

1. [`cd app && npm run rust:fmt:check`](../app/package.json)
2. [`cd app && npm run rust:clippy`](../app/package.json)
3. [`cd app && npm run rust:test`](../app/package.json)
4. [`cd app && npm run lint`](../app/package.json)
5. [`cd app && npm run test`](../app/package.json)
6. [`cd app && npm run test -- --coverage`](../app/package.json)
7. [`cd app && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --workspace --fail-under-lines 80`](../app/src-tauri/Cargo.toml)
8. [`cd app && npx playwright test`](../app/tests/e2e/README.md)
9. [`cd app && npm run build`](../app/package.json)

Ссылка на общий baseline проверок: [Quality Gate в Project Rules](./00-project-rules.md#7-quality-gate-обязателен-перед-merge).
