# Epic 10: Simulation Core (Semi-Realistic Physics)

Обязательное условие для всех задач: строгое соблюдение [Project Rules](./00-project-rules.md).

## E10-T01 Реализовать simulation loop и time-step manager

**Статус:** done (2026-03-05).

**Контекст:** Без устойчивого simulation loop нельзя гарантировать повторяемое поведение.

**Зависимости:** E02-T02, E09-T01.

**Критерии приемки:**

1. Реализован цикл симуляции с фиксированным или гибридным шагом времени.
2. Есть явное управление состояниями `running/paused/stopped`.
3. Синхронизация кадров в UI не вызывает накопления uncontrollable lag.

**Условия:**

- Логика шага симуляции отделена от рендера.

## E10-T02 Реализовать базовую модель частиц и взаимодействий

**Статус:** done (2026-03-05).

**Контекст:** Для MVP нужна полуреалистичная модель, пригодная для образовательных сценариев.

**Зависимости:** E10-T01.

**Критерии приемки:**

1. Реализованы базовые столкновения и взаимодействия частиц.
2. Поддержана минимальная кинетика реакции для MVP классов.
3. Добавлены интеграционные тесты на стабильность шагов модели.

**Условия:**

- Модель должна быть параметризуема для будущего роста точности.

## E10-T03 Реализовать влияние температуры, давления и газовой среды

**Приоритет:** P0.

**Статус:** OPEN.

**Проблема:** Контролы условий среды уже есть, но без детерминированной и ограниченной по диапазонам модели их влияние на кинетику/столкновения остается непрозрачным и плохо воспроизводимым в тестах.

**Контекст/архитектурные рамки:**

- Горячий путь симуляции: `app/src/features/simulation/particleModel.ts`, `app/src/features/simulation/simulationLoop.ts`.
- Передача параметров среды и метрик в UI: `app/src/shared/contracts/ipc/v1.ts`, `app/src/shared/contracts/ipc/client.ts`.
- Граница backend-команд и валидации DTO: `app/src-tauri/src/adapters/ipc/v1.rs`.
- Документация модели и допущений: `app/docs/model-assumptions.md`.

**Зависимости:** E10-T02, E11-T01.

**Что сделать:**

1. Зафиксировать математическую модель влияния `temperatureK`, `pressureAtm`, `medium` на вероятность реакций, damping и лимит скорости частиц.
2. Вынести вычисление environmental factors в чистую функцию `resolveEnvironmentFactors(...)` с детерминированным результатом при одинаковом входе.
3. Ввести жесткие validated limits для среды (`temperatureK`, `pressureAtm`) и явный clamp с reason-кодами.
4. Применить factors в шаге симуляции так, чтобы дополнительная стоимость была линейной (`O(n)`) и без новых `O(n^2)` проходов.
5. Расширить step-метрики: `temperatureFactor`, `pressureFactor`, `mediumFactor`, `environmentCalcMs`, `isClamped`.
6. Пробросить эти метрики и warning-сигналы до UI и панели метрик без прямой бизнес-логики в React-компонентах.
7. Добавить profiling-ассерты для hot path: вычисление влияния среды не выходит за согласованный budget на baseline.
8. Обновить `app/docs/model-assumptions.md` с диапазонами, формулами и известными ограничениями модели.

**Технические ограничения:**

- Внутренние единицы: `K` и `atm`; преобразования выполнять один раз на входе.
- Расчет факторов среды должен быть чистым (без `Date`, `Math.random`, чтения внешнего состояния).
- Дополнительные аллокации в simulation step должны быть исключены или сведены к минимуму.
- Лимиты должны быть централизованы в коде как константы, а не захардкожены в UI.
- Профилирование: `environmentCalcMs` не более 2 ms на 10k частиц на baseline конфигурации.

**Тестирование:**

- Unit: `particleModel.environment.test.ts` на формулы, clamp, reason-коды, граничные значения.
- Integration: `simulationLoop.environment.integration.test.ts` на влияние `T/P/medium` на метрики и state за N тиков.
- E2E: `tests/e2e/specs/environment-conditions.spec.ts` на сценарий изменения условий из UI и отображение предупреждений.
- Manual: прогон на 3 сценариях (gas/liquid/vacuum) с визуальной проверкой изменения динамики и числовых метрик.
- Конкретные прогоны: `cd app && npm run lint`, `cd app && npm run test`, `cd app && npm run rust:test`, `cd app && npx playwright test tests/e2e/specs/environment-conditions.spec.ts`.

**Критерии приемки:**

1. Изменение `T/P/medium` стабильно влияет на simulation state по документированным формулам.
2. Для входов вне validated limits используется clamp, а пользователь видит предупреждение с reason-кодом.
3. При фиксированных `seed/input/delta` эффект среды воспроизводим между запусками.
4. Метрики влияния среды доступны в runtime и отображаются в UI.
5. Для каждого фактора есть baseline non-regression тест.
6. Модель и ограничения задокументированы в `model-assumptions.md`.

**Артефакты результата:**

- `app/src/features/simulation/particleModel.ts`
- `app/src/features/simulation/simulationLoop.ts`
- `app/src/features/simulation/particleModel.environment.test.ts`
- `app/src/features/simulation/simulationLoop.environment.integration.test.ts`
- `app/src/shared/contracts/ipc/v1.ts`
- `app/docs/model-assumptions.md`
- `app/tests/e2e/specs/environment-conditions.spec.ts`

**Definition of Done:**

- Выполнены критерии приемки и требования [Project Rules](./00-project-rules.md) (включая quality gate из раздела 7 и DoD из раздела 8).
- Обязательный non-regression: существующие тесты симуляции/импорта/сценариев проходят без ухудшения поведения при выключенном влиянии среды.

## E10-T04 Реализовать deterministic mode и confidence indicators

**Приоритет:** P1.

**Статус:** OPEN.

**Проблема:** Без строгого deterministic mode невозможно надежно сравнивать результаты между прогонами, а без confidence indicators пользователь не понимает границы валидности полуреалистичной модели.

**Контекст/архитектурные рамки:**

- Симуляционный runtime и шаг интеграции: `app/src/features/simulation/simulationLoop.ts`, `app/src/features/simulation/particleModel.ts`.
- Контракты состояния/настроек: `app/src/shared/contracts/ipc/v1.ts`, `app/src/shared/contracts/ipc/client.ts`.
- Граница backend DTO/сохранения сценария: `app/src-tauri/src/adapters/ipc/v1.rs`, `app/src-tauri/src/adapters/storage/repository.rs`.
- UI отображение предупреждений и confidence: `app/src/features/right-panel/*`, `app/src/features/center-panel/*`.

**Зависимости:** E10-T03.

**Что сделать:**

1. Ввести runtime-флаг deterministic mode с параметрами `enabled`, `seed`, `replayHashVersion`.
2. Реализовать единый seeded PRNG для simulation step и убрать неуправляемые источники случайности.
3. Зафиксировать стабильный порядок обхода частиц/пар (по `id`/индексу), чтобы исключить недетерминизм от порядка итерации.
4. Определить стратегию квантования/округления float-значений для сравнения state между прогонами.
5. Добавить расчет `stateHash` на каждом N-м тике для replay-проверки и автотестов.
6. Реализовать confidence model (`confidenceScore`, `approximationFlags`, `outOfValidatedLimits`) на основе диапазонов модели и качества входных данных.
7. Отобразить в UI: текущий режим deterministic, seed, confidence score и предупреждения по validated limits.
8. Ввести profiling сравнение deterministic vs normal mode и зафиксировать допустимый overhead.
9. Задокументировать ограничения deterministic режима и трактовку confidence в `app/docs/model-assumptions.md`.

**Технические ограничения:**

- В deterministic режиме запрещено использовать wall-clock время для вычислений модели.
- Порядок коллекций в hot path должен быть стабильным и независимым от платформенных особенностей.
- Совместимость сохраненных сценариев: seed и флаг deterministic хранятся в runtime settings.
- Confidence indicator должен быть explainable: каждый warning содержит машинный код причины.
- Performance limit: deterministic mode допускает не более 15% overhead относительно normal mode на baseline.

**Тестирование:**

- Unit: `deterministicRng.test.ts`, `stateHash.test.ts`, `confidenceIndicators.test.ts`.
- Integration: `simulationDeterministic.integration.test.ts` (20 повторов с одинаковым seed -> одинаковый hash/state).
- Integration: `simulationNonDeterministic.integration.test.ts` (разные seed -> различимые траектории по hash).
- E2E: `tests/e2e/specs/deterministic-mode.spec.ts` на включение режима, ввод seed и UI-индикаторы confidence.
- Manual: воспроизведение одного сценария 3 раза с одинаковым seed и 3 раза с разными seed.
- Конкретные прогоны: `cd app && npm run lint`, `cd app && npm run test`, `cd app && npm run rust:test`, `cd app && npx playwright test tests/e2e/specs/deterministic-mode.spec.ts`.

**Критерии приемки:**

1. При одинаковом `seed/input/config` deterministic mode выдает совпадающий `stateHash` на контрольных тиках.
2. Confidence indicators публикуются в результате симуляции и содержат explainable reason-коды.
3. UI показывает предупреждение при выходе за validated limits модели.
4. Seed и режим deterministic сохраняются/восстанавливаются вместе со сценарием.
5. Нагрузочный профиль deterministic mode укладывается в согласованный overhead budget.
6. Добавлены regression-тесты на воспроизводимость и индикаторы достоверности.

**Артефакты результата:**

- `app/src/features/simulation/particleModel.ts`
- `app/src/features/simulation/simulationLoop.ts`
- `app/src/features/simulation/deterministicRng.ts`
- `app/src/features/simulation/simulationDeterministic.integration.test.ts`
- `app/src/features/simulation/confidenceIndicators.test.ts`
- `app/src/shared/contracts/ipc/v1.ts`
- `app/src-tauri/src/adapters/ipc/v1.rs`
- `app/docs/model-assumptions.md`
- `app/tests/e2e/specs/deterministic-mode.spec.ts`

**Definition of Done:**

- Выполнены критерии приемки и требования [Project Rules](./00-project-rules.md) (включая quality gate из раздела 7 и DoD из раздела 8).
- Обязательный non-regression: existing сценарии и симуляционные тесты дают прежний результат при `deterministic=false`.
