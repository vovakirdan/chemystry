# cheMystry Task Pack

Этот каталог содержит **детализированные задачи для исполнения** от первого рабочего коммита до релиза MVP.

## Обязательные правила

Перед началом любой задачи обязательно прочитать: [00-project-rules.md](./00-project-rules.md)

Правила в `00-project-rules.md` обязательны для каждой задачи без исключений.

## Структура пакета

- [E01-bootstrap-and-tooling.md](./E01-bootstrap-and-tooling.md)
- [E02-architecture-and-contracts.md](./E02-architecture-and-contracts.md)
- [E03-ui-shell.md](./E03-ui-shell.md)
- [E04-data-model-and-storage.md](./E04-data-model-and-storage.md)
- [E05-substances-and-presets.md](./E05-substances-and-presets.md)
- [E06-manual-reaction-builder.md](./E06-manual-reaction-builder.md)
- [E07-units-and-validation.md](./E07-units-and-validation.md)
- [E08-calculation-engine.md](./E08-calculation-engine.md)
- [E09-3d-scene-and-camera.md](./E09-3d-scene-and-camera.md)
- [E10-simulation-core.md](./E10-simulation-core.md)
- [E11-environment-and-what-if.md](./E11-environment-and-what-if.md)
- [E12-import-export.md](./E12-import-export.md)
- [E13-settings-and-performance.md](./E13-settings-and-performance.md)
- [E14-security-and-reliability.md](./E14-security-and-reliability.md)
- [E15-test-coverage-and-qa.md](./E15-test-coverage-and-qa.md)
- [E16-packaging-and-release.md](./E16-packaging-and-release.md)
- [POST-MVP-backlog.md](./POST-MVP-backlog.md)

## Как исполнять

1. Идти по эпикам по порядку `E01 -> E16`.
2. Внутри эпика выполнять задачи в порядке `T01, T02...`, если не указано иное.
3. Перед закрытием задачи проверить все acceptance criteria и quality gate.

## Формат задачи

Каждая задача содержит:

- `Контекст`: зачем задача нужна.
- `Зависимости`: что должно быть сделано до начала.
- `Критерии приемки`: проверяемый результат.
- `Условия`: ограничения и обязательные требования.

## Объем

- MVP задач: 63
- Post-MVP задач: 6
- Всего: 69
