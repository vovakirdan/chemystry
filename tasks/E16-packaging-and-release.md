# Epic 16: Packaging and MVP Release

Обязательное условие для всех задач: строгое соблюдение [Project Rules](./00-project-rules.md).

## E16-T01 Настроить кроссплатформенные release сборки

**Приоритет:** P0 (release blocker).

**Статус:** pending.

**Проблема:** Без формализованного release pipeline кроссплатформенная поставка MVP нестабильна и плохо воспроизводима.

**Контекст:** MVP должен поставляться для Linux/Windows/macOS с предсказуемыми артефактами и минимальным ручным вмешательством. Зависимости: E01-T05, E15-T04.

**Что сделать (пошагово):**

1. Реализовать CI release pipeline с матрицей платформ: `ubuntu-latest`, `windows-latest`, `macos-latest`.
2. Зафиксировать версии toolchain (Node, Rust, Tauri CLI) и использовать lockfiles (`package-lock.json`, `Cargo.lock`).
3. Добавить этапы: install -> lint/test -> build -> package -> upload artifacts -> checksums.
4. Ввести reproducible build правила: фиксированные env-параметры, стабильные входные артефакты, запрет локальных ручных шагов.
5. Добавить проверку воспроизводимости: две независимые сборки одного commit дают совпадающие checksums (кроме ожидаемых платформенных метаданных).
6. Зафиксировать naming convention артефактов: `cheMystry-vX.Y.Z-<platform>-<arch>`.

**Технические ограничения:**

- Pipeline должен быть полностью headless и запускаться без локальных секретов разработчика.
- Для release веток запрещены плавающие версии зависимостей.
- Любой platform-specific шаг должен быть описан и автоматизирован в CI.
- Воспроизводимость проверяется на чистом окружении.

**Тестирование (обязательные наборы + команды):**

- Набор: baseline quality checks перед упаковкой.
- Команды: `cd app && npm run lint`; `cd app && npm run test`; `cd app && npm run rust:test`; `cd app && npm run build`.
- Набор: сборка release-артефактов Tauri.
- Команда: `cd app && npm run tauri build`.
- Набор: проверка воспроизводимости сборки и checksums.
- Команды: `cd app && sha256sum src-tauri/target/release/bundle/**/*`; `cd app && sha256sum dist/**/*`.

**Критерии приемки:**

1. CI собирает release артефакты минимум для Linux/Windows и документированно для macOS.
2. Выполняется reproducibility-проверка и сохраняются checksums.
3. Артефакты имеют корректные имена с версией, платформой и архитектурой.
4. Release pipeline запускается без локальных ручных действий.

**Артефакты результата:**

- `.github/workflows/release.yml`.
- `app/src-tauri/target/release/bundle/*` (или опубликованные CI артефакты).
- `app/dist/*`.
- `app/docs/release/reproducible-builds.md`.
- `app/docs/release/artifact-naming.md`.

## E16-T02 Провести финальный MVP quality gate

**Приоритет:** P0 (release blocker).

**Статус:** pending.

**Проблема:** Без единого release gate нельзя гарантировать, что релиз проходит обязательные проверки функционала, безопасности и надежности.

**Контекст:** Перед публикацией `v1.0.0` нужен централизованный gate со статусом pass/fail и блокировкой релиза при критичных нарушениях. Зависимость: E16-T01.

**Что сделать (пошагово):**

1. Собрать release gate checklist, включающий проверки из `00-project-rules.md`, E14 и E15.
2. Добавить обязательные security/QA разделы: threat model актуален, capabilities/CSP/IPC/recovery документы обновлены, coverage пороги соблюдены.
3. Внедрить формальный критерий блокировки релиза: любой критичный fail => release stop.
4. Назначить owner-ов на каждый блок gate и SLA на устранение блокеров.
5. Добавить автоматическую публикацию сводного gate-репорта в CI.
6. Включить проверку non-regression набора как отдельный обязательный этап pipeline.

**Технические ограничения:**

- Gate должен быть бинарным: `pass` или `fail`, без "условно pass".
- Исключения допускаются только с письменным waiver и сроком закрытия.
- Проверки gate должны быть воспроизводимы локально и в CI одинаковыми командами.
- История решений gate должна быть сохранена для аудита.

**Тестирование (обязательные наборы + команды):**

- Набор: полный quality gate проекта.
- Команды: `cd app && npm run rust:fmt:check`; `cd app && npm run rust:clippy`; `cd app && npm run rust:test`; `cd app && npm run lint`; `cd app && npm run test`; `cd app && npm run build`; `cd app && npx playwright test`.
- Набор: контроль coverage policy.
- Команды: `cd app && npm run test -- --coverage`; `cd app && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --workspace --fail-under-lines 80`.
- Набор: проверка release checklist и статуса блокеров.
- Команда: `cd app && rg -n "PASS|FAIL|BLOCKER" docs/release/release-gate-checklist.md`.

**Критерии приемки:**

1. Выполнены все обязательные проверки из Project Rules и дополнительных gate-требований E14/E15.
2. Release gate checklist содержит явный статус pass/fail по каждому пункту.
3. При наличии критичного fail релиз блокируется автоматически.
4. Сформирован аудитный отчет о прохождении quality gate.

**Артефакты результата:**

- `app/docs/release/release-gate-checklist.md`.
- `app/docs/release/release-gate-report.md`.
- `.github/workflows/release.yml` (этап gate).
- `app/docs/release/waivers.md` (если применимо).

## E16-T03 Подготовить release notes, quick-start и выпустить v1.0.0

**Приоритет:** P1.

**Статус:** pending.

**Проблема:** Без качественной релизной документации и корректного процесса подписи/нотаризации выпуск `v1.0.0` непрозрачен для пользователей и рискован юридически/операционно.

**Контекст:** Финальный релиз должен содержать release notes, quick-start, подписанные артефакты и documented ограничения MVP. Зависимость: E16-T02.

**Что сделать (пошагово):**

1. Подготовить release notes с ключевыми фичами, изменениями, ограничениями и known issues.
2. Обновить quick-start guide для Linux/Windows/macOS с проверкой целостности артефактов.
3. Описать и выполнить signing/notarization процесс:
   - Windows: code signing сертификат и проверка подписи.
   - macOS: Developer ID подпись, notarization, stapling.
   - Linux: checksums + подпись release manifest (где применимо).
4. Опубликовать релиз `v1.0.0` с артефактами, checksums и инструкцией верификации.
5. Проверить соответствие фактического релиза release gate отчету.
6. Зафиксировать post-release checklist и rollback notes.

**Технические ограничения:**

- Нельзя публиковать неподписанные релизные артефакты для платформ, где подпись обязательна.
- Release notes обязаны явно отражать известные ограничения MVP.
- Quick-start должен быть проверяемым "с нуля" на чистой машине.
- Все release metadata (тег, checksum, подписи) должны быть консистентны.

**Тестирование (обязательные наборы + команды):**

- Набор: pre-release regression.
- Команды: `cd app && npm run lint`; `cd app && npm run test`; `cd app && npm run rust:test`; `cd app && npx playwright test`; `cd app && npm run tauri build`.
- Набор: проверка подписи/нотаризации и checksums.
- Команды: `cd app && shasum -a 256 src-tauri/target/release/bundle/**/*`; `codesign --verify --deep --strict <path-to-macos-app>`; `spctl --assess --type execute <path-to-macos-app>`.
- Набор: проверка release notes и quick-start на полноту.
- Команда: `cd app && rg -n "Known issues|Ограничения|Verification|Checksum" README.md docs/release`.

**Критерии приемки:**

1. Подготовлены и опубликованы release notes/CHANGELOG с ограничениями MVP.
2. Quick-start обновлен и подтвержден на чистом окружении.
3. Для релизных артефактов выполнены signing/notarization шаги и опубликованы checksums.
4. Выпущен тег/релиз `v1.0.0` с комплектом артефактов и инструкциями верификации.

**Артефакты результата:**

- `app/CHANGELOG.md`.
- `app/README.md` и `app/docs/release/quick-start.md`.
- `app/docs/release/signing-and-notarization.md`.
- Git tag/release `v1.0.0` с приложенными артефактами и checksums.

## Non-Regression Gate (E16)

Перед переводом любой задачи E16 в `done` обязательно выполнить и приложить результаты:

1. [`cd app && npm run rust:fmt:check`](../app/package.json)
2. [`cd app && npm run rust:clippy`](../app/package.json)
3. [`cd app && npm run rust:test`](../app/package.json)
4. [`cd app && npm run lint`](../app/package.json)
5. [`cd app && npm run test`](../app/package.json)
6. [`cd app && npm run build`](../app/package.json)
7. [`cd app && npm run tauri build`](../app/package.json)
8. [`cd app && npm run test -- --coverage`](../app/package.json)
9. [`cd app && cargo llvm-cov --manifest-path src-tauri/Cargo.toml --workspace --fail-under-lines 80`](../app/src-tauri/Cargo.toml)
10. [`cd app && npx playwright test`](../app/tests/e2e/README.md)
11. [`cd app && sha256sum src-tauri/target/release/bundle/**/*`](../app/src-tauri/Cargo.toml)

Ссылка на общий baseline проверок: [Quality Gate в Project Rules](./00-project-rules.md#7-quality-gate-обязателен-перед-merge).
