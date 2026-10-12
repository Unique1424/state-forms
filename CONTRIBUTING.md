# Contributing Guidelines

## Commit Messages

Проект использует [Conventional Commits](https://www.conventionalcommits.org/) для структурированных коммит-сообщений.

### Формат

```
<type>: <description>

[optional body]

[optional footer]
```

### Типы коммитов

- `feat` — новая функциональность
- `fix` — исправление бага
- `docs` — изменения в документации
- `style` — форматирование кода (без изменения логики)
- `refactor` — рефакторинг кода
- `perf` — улучшение производительности
- `test` — добавление или изменение тестов
- `chore` — рутинные задачи (зависимости, конфигурация)
- `ci` — изменения в CI/CD
- `build` — изменения в сборке

### Примеры

```bash
feat: добавлена статистика департамента
fix: исправлена ошибка загрузки форм в Safari
docs: обновлен README с инструкцией по установке
refactor: разделен server.js на модули
chore: обновлены зависимости до последних версий
```

## Git Workflow

### Ветки

- `main` — production-ready код
- `staging` — тестирование перед production
- `feature/<name>` — разработка новых фич
- `hotfix/<name>` — срочные исправления

### Процесс разработки

1. **Создайте feature-ветку от staging:**
   ```bash
   git checkout staging
   git pull origin staging
   git checkout -b feature/new-feature
   ```

2. **Внесите изменения и коммитьте согласно Conventional Commits:**
   ```bash
   git add .
   git commit -m "feat: добавлена новая фича"
   ```

3. **Отправьте в staging для тестирования:**
   ```bash
   git push origin feature/new-feature
   # Создайте PR/MR в staging
   ```

4. **После тестирования и одобрения:**
   ```bash
   git checkout main
   git merge staging
   git tag v1.x.x -m "Release 1.x.x: описание"
   git push origin main --tags
   ```

### Hotfix процесс

Для срочных исправлений в production:

```bash
git checkout main
git checkout -b hotfix/critical-bug
# исправьте баг
git commit -m "fix: исправлен критический баг"
git checkout main
git merge hotfix/critical-bug
git tag v1.x.y
git push origin main --tags
# не забудьте смержить в staging
git checkout staging
git merge main
git push origin staging
```

## Code Review

- Все изменения проходят через Pull Request
- Минимум 1 аппрува перед merge
- CI/CD должен пройти успешно
- Следуйте стандартам проекта

## Тестирование

Перед коммитом убедитесь:
- [ ] Код запускается без ошибок
- [ ] Нет lint ошибок
- [ ] Новая функциональность протестирована
- [ ] Не сломаны существующие фичи
