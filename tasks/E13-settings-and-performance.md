# Epic 13: Settings and Performance Management

Обязательное условие для всех задач: строгое соблюдение [Project Rules](./00-project-rules.md).

## E13-T01 Реализовать экран настроек и профили точности

**Приоритет:** P1.

**Статус:** OPEN.

**Проблема:** Без формализованных профилей точности пользователь не может управлять компромиссом между стабильностью, скоростью и воспроизводимостью; это ведет к хаотичным настройкам и непредсказуемым результатам.

**Контекст/архитектурные рамки:**

- UI-слой настроек: `app/src/features/right-panel/*` и новый модуль `app/src/features/settings/*`.
- Runtime state симуляции: `app/src/features/simulation/simulationLoop.ts`, `app/src/features/simulation/particleModel.ts`.
- IPC/DTO для runtime settings: `app/src/shared/contracts/ipc/v1.ts`, `app/src/shared/contracts/ipc/client.ts`, `app/src-tauri/src/adapters/ipc/v1.rs`.
- Persistence профиля в сценарии и локальном storage: `app/src-tauri/src/adapters/storage/repository.rs`.

**Зависимости:** E03-T04.

**Что сделать:**

1. Определить профильные пресеты `Balanced`, `High Precision`, `Custom` с явными значениями параметров (passes, target FPS, particle limit, deterministic compatibility).
2. Реализовать UI экрана/модалки настроек с выбором профиля и предпросмотром влияния на производительность.
3. Ввести runtime-переключение профиля без перезапуска с атомарным обновлением параметров.
4. Добавить правила совместимости профилей с deterministic mode (если включен в E10-T04): без сброса seed и с предсказуемым поведением.
5. Реализовать предупреждения для рискованных профилей при ожидаемой просадке FPS и росте latency.
6. Добавить lightweight profiling summary в UI (текущий FPS, frame time, simulation step time) для прозрачности выбора профиля.
7. Сохранить профиль в сценарии и в локальном persistent storage, восстановление при старте/загрузке сценария.
8. Обновить документацию по профилям, их ограничениям и рекомендациям использования.

**Технические ограничения:**

- Переключение профиля не должно вызывать freeze UI дольше 1 кадра.
- Дефолтный профиль всегда `Balanced`; fallback на него обязателен при невалидных данных.
- Профильные значения должны использовать единый источник констант, а не дублироваться в UI и backend.
- Изменение профиля должно быть наблюдаемым в telemetry/profiling логах.
- При включенном deterministic режиме нельзя неявно менять seed/реплей-параметры.

**Тестирование:**

- Unit: `settingsProfiles.test.ts` на маппинг профилей в runtime-конфиг и fallback.
- Unit: `settingsValidation.test.ts` на совместимость профиля с deterministic режимом.
- Integration: `settingsRuntimeSync.integration.test.ts` на live-обновление параметров без перезапуска.
- E2E: `tests/e2e/specs/settings-profiles.spec.ts` на переключение профилей и предупреждения.
- Manual: проверка восстановления профиля после перезапуска и после загрузки сохраненного сценария.
- Конкретные прогоны: `cd app && npm run lint`, `cd app && npm run test`, `cd app && npm run rust:test`, `cd app && npx playwright test tests/e2e/specs/settings-profiles.spec.ts`.

**Критерии приемки:**

1. Экран настроек содержит `Balanced`, `High Precision`, `Custom` и по умолчанию активен `Balanced`.
2. Переключение профиля обновляет runtime-параметры без перезапуска приложения.
3. Рискованные комбинации показывают предупреждение о влиянии на FPS/latency.
4. Текущие профили и ключевые performance-метрики доступны пользователю в UI.
5. Профиль корректно сохраняется и восстанавливается между сессиями.
6. Поведение deterministic mode не нарушается переключением профиля.

**Артефакты результата:**

- `app/src/features/settings/SettingsPanel.tsx`
- `app/src/features/settings/settingsProfiles.ts`
- `app/src/features/settings/settingsProfiles.test.ts`
- `app/src/features/settings/settingsRuntimeSync.integration.test.ts`
- `app/src/features/simulation/simulationLoop.ts`
- `app/src/shared/contracts/ipc/v1.ts`
- `app/src-tauri/src/adapters/ipc/v1.rs`
- `app/tests/e2e/specs/settings-profiles.spec.ts`
- `app/docs/settings-profiles.md`

**Definition of Done:**

- Выполнены критерии приемки и требования [Project Rules](./00-project-rules.md) (включая quality gate из раздела 7 и DoD из раздела 8).
- Обязательный non-regression: существующие пользовательские флоу (редактор реакции, симуляция, импорт/экспорт) продолжают работать при профиле `Balanced`.

## E13-T02 Добавить пользовательские лимиты FPS и количества частиц

**Приоритет:** P1.

**Статус:** OPEN.

**Проблема:** Без пользовательских hard limits приложение может уходить в нестабильную нагрузку на слабом железе, а результаты симуляции и UX становятся непредсказуемыми.

**Контекст/архитектурные рамки:**

- UI-контролы лимитов: `app/src/features/settings/*`.
- Применение лимитов в runtime: `app/src/features/simulation/simulationLoop.ts`, `app/src/features/center-panel/createThreeSceneRuntime.ts`.
- Контракты и хранение: `app/src/shared/contracts/ipc/v1.ts`, `app/src-tauri/src/adapters/ipc/v1.rs`, `app/src-tauri/src/adapters/storage/repository.rs`.
- Профили и дефолты: связь с `E13-T01`.

**Зависимости:** E13-T01, E10-T01.

**Что сделать:**

1. Определить безопасные диапазоны лимитов (`fpsLimit`, `particleLimit`) и причины выбора диапазонов.
2. Реализовать UI-ввод лимитов (slider + numeric input) с мгновенной валидацией и понятными сообщениями.
3. Добавить clamp/fallback-логику на frontend и backend, чтобы исключить рассинхрон.
4. Применить `fpsLimit` в simulation loop и renderer без jitter и накопления lag.
5. Применить `particleLimit` как реальный hard cap генерации/обновления частиц с детерминированным правилом отбора.
6. Добавить telemetry-события, когда лимит сработал (throttle/dropped particles), и вывести это в UI.
7. Сохранить лимиты в local persistent storage и в payload сценария.
8. Обновить документацию по диапазонам и влиянию лимитов на производительность и точность.

**Технические ограничения:**

- Невалидные значения не должны попадать в runtime: только валидация + clamp.
- Применение `fpsLimit` не должно ломать state-машину `running/paused/stopped`.
- При достижении `particleLimit` поведение должно быть детерминированным и повторяемым.
- Изменение лимитов в рантайме не должно вызывать долгих reallocation spikes.
- Диапазоны лимитов должны быть централизованы и покрыты тестами.

**Тестирование:**

- Unit: `settingsLimitsValidation.test.ts` на диапазоны, clamp и сериализацию.
- Unit: `simulationLoop.fpsLimit.test.ts` на корректное ограничение частоты кадров.
- Integration: `particleLimit.integration.test.ts` на hard cap и детерминированный отбор.
- E2E: `tests/e2e/specs/settings-limits.spec.ts` на ввод лимитов и фактическое применение в UI.
- Manual: проверка на высоких/низких лимитах, включая восстановление из сохраненного сценария.
- Конкретные прогоны: `cd app && npm run lint`, `cd app && npm run test`, `cd app && npm run rust:test`, `cd app && npx playwright test tests/e2e/specs/settings-limits.spec.ts`.

**Критерии приемки:**

1. Пользователь может задать `target FPS` и `particle limit` в безопасных диапазонах.
2. Значения валидируются, сохраняются и восстанавливаются без потери.
3. Simulation loop и renderer реально соблюдают заданные лимиты.
4. Срабатывания лимитов логируются и отображаются в UI.
5. При одинаковых входах и лимитах поведение ограничения частиц воспроизводимо.
6. Режимы и профили из E13-T01 остаются совместимыми с ручными лимитами.

**Артефакты результата:**

- `app/src/features/settings/SettingsLimits.tsx`
- `app/src/features/settings/settingsLimitsValidation.ts`
- `app/src/features/settings/settingsLimitsValidation.test.ts`
- `app/src/features/simulation/simulationLoop.ts`
- `app/src/features/simulation/simulationLoop.fpsLimit.test.ts`
- `app/src/features/simulation/particleLimit.integration.test.ts`
- `app/src/shared/contracts/ipc/v1.ts`
- `app/src-tauri/src/adapters/ipc/v1.rs`
- `app/tests/e2e/specs/settings-limits.spec.ts`
- `app/docs/settings-performance-limits.md`

**Definition of Done:**

- Выполнены критерии приемки и требования [Project Rules](./00-project-rules.md) (включая quality gate из раздела 7 и DoD из раздела 8).
- Обязательный non-regression: при дефолтных лимитах не ухудшается текущая стабильность и визуальная корректность симуляции.

## E13-T03 Внедрить adaptive quality и performance budgets

**Приоритет:** P1.

**Статус:** OPEN.

**Проблема:** Без управляемой деградации качества приложение при нагрузке начинает фризить; нужен предсказуемый механизм адаптации на основе измеримых budget-лимитов.

**Контекст/архитектурные рамки:**

- Runtime profiling и адаптация: `app/src/features/simulation/*`, `app/src/features/center-panel/*`.
- Параметры качества и политики деградации: `app/src/features/settings/*`.
- IPC и storage для сохранения adaptive state: `app/src/shared/contracts/ipc/v1.ts`, `app/src-tauri/src/adapters/ipc/v1.rs`, `app/src-tauri/src/adapters/storage/repository.rs`.
- E2E/bench сценарии: `app/tests/e2e/specs/*`, baseline fixtures в `app/assets/*`.

**Зависимости:** E13-T02, E09-T03.

**Что сделать:**

1. Реализовать runtime profiler с метриками `renderMs`, `simulationMs`, `ipcMs`, `frameMs`, `fps` (rolling windows 120 и 600 кадров).
2. Зафиксировать performance budgets для baseline: `render<=8ms`, `simulation<=6ms`, `ipc<=2ms` при целевом `60 FPS`.
3. Внедрить адаптивную лестницу качества (например 4 уровня) с четкими действиями на каждом уровне.
4. Добавить hysteresis/anti-flap политику: понижение после серии нарушений budget, повышение после устойчивого окна стабильности.
5. Для deterministic mode ограничить auto-адаптацию только визуальными параметрами, не меняя физические параметры модели.
6. Ввести hard safety limits по памяти/частицам и fallback-переход в безопасный профиль при превышении.
7. Логировать каждое авто-снижение качества с причиной, временем и затронутыми budget-метриками.
8. Отобразить в UI текущий quality level, active budgets и историю последних авто-решений.
9. Провести валидацию на baseline железе (16GB RAM / 8 cores / 4GB VRAM) и зафиксировать профили в документации.

**Технические ограничения:**

- Adaptive quality не должен менять пользовательские данные и сценарии.
- Авто-переключения должны быть детерминированными при одинаковых метриках на входе policy.
- Частота авто-переключений ограничена (cooldown), чтобы избежать oscillation.
- Профайлер не должен вносить заметный overhead в production режиме.
- Любое снижение качества должно быть обратимо при восстановлении производительности.

**Тестирование:**

- Unit: `performancePolicy.test.ts` на budgets, hysteresis и переходы между quality-level.
- Unit: `runtimeProfiler.test.ts` на корректность rolling windows и агрегатов.
- Integration: `adaptiveQuality.integration.test.ts` на деградацию/восстановление под синтетической нагрузкой.
- E2E: `tests/e2e/specs/adaptive-quality.spec.ts` на видимость авто-решений и UX-предупреждений.
- Manual: валидация на baseline машине и на более слабой конфигурации с фиксацией метрик.
- Конкретные прогоны: `cd app && npm run lint`, `cd app && npm run test`, `cd app && npm run rust:test`, `cd app && npx playwright test tests/e2e/specs/adaptive-quality.spec.ts`.

**Критерии приемки:**

1. Стратегия adaptive quality активируется при нарушении budget и снимается при стабилизации.
2. Performance budgets заданы численно и доступны в runtime-метриках.
3. На baseline железе budgets подтверждены воспроизводимыми прогонами.
4. Каждое авто-снижение качества логируется и показывается пользователю.
5. В deterministic mode не меняются физические параметры симуляции через adaptive policy.
6. Приложение деградирует плавно, без зависаний и без потери данных.

**Артефакты результата:**

- `app/src/features/simulation/runtimeProfiler.ts`
- `app/src/features/simulation/runtimeProfiler.test.ts`
- `app/src/features/settings/performancePolicy.ts`
- `app/src/features/settings/performancePolicy.test.ts`
- `app/src/features/simulation/adaptiveQuality.integration.test.ts`
- `app/src/features/center-panel/createThreeSceneRuntime.ts`
- `app/src/shared/contracts/ipc/v1.ts`
- `app/src-tauri/src/adapters/ipc/v1.rs`
- `app/tests/e2e/specs/adaptive-quality.spec.ts`
- `app/docs/performance-budgets.md`

**Definition of Done:**

- Выполнены критерии приемки и требования [Project Rules](./00-project-rules.md) (включая quality gate из раздела 7 и DoD из раздела 8).
- Обязательный non-regression: без включения adaptive режима приложение сохраняет текущее качество рендера и стабильность симуляции на прежнем уровне.
