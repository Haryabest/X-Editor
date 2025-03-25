# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

# X-Editor

Редактор кода на основе Monaco Editor с поддержкой TypeScript, JSX и различных языков программирования.

## Особенности

- Полная поддержка TypeScript и JSX/TSX
- Интеграция с Monaco Editor
- Подсветка синтаксиса для различных языков
- Автозавершение кода
- Проверка ошибок и предупреждений

## Установка

```bash
# Клонирование репозитория
git clone https://github.com/your-username/x-editor.git
cd x-editor

# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev
```

## Запуск тестов Monaco Editor

X-Editor содержит набор тестов для проверки корректной работы Monaco Editor с различными типами файлов. Это особенно полезно для отладки поддержки TypeScript и JSX/TSX.

### Способы запуска тестов:

1. **Через URL-параметр**:
   ```
   http://localhost:3000/?test=monaco
   ```

2. **Через кнопку тестирования** (доступна только в режиме разработки):
   В правом верхнем углу редактора появится кнопка "Запустить тесты Monaco".

3. **Вручную открыв тестовые файлы**:
   ```
   src/monaco-tests/TypeScriptTest.ts
   src/monaco-tests/ReactComponentTest.tsx
   src/monaco-tests/JsxComponentTest.jsx
   src/monaco-tests/SmartAnalyzerTest.ts
   ```

### Содержимое тестов

Тесты включают в себя различные сценарии использования TypeScript, React и JSX, такие как:

- Базовые типы и интерфейсы TypeScript
- React компоненты с использованием TypeScript
- JSX/TSX синтаксис и обработка ошибок
- Проверка умного анализатора кода

### Устранение проблем

Если вы столкнетесь с проблемами в работе Monaco Editor, обратитесь к документации в файле `src/monaco-tests/TROUBLESHOOTING.md`, где описаны распространенные проблемы и способы их решения.

## Структура проекта

```
src/
├── monaco-config/          # Конфигурация Monaco Editor
│   ├── index.ts            # Основная конфигурация
│   ├── auto-types.ts       # Автоматическое определение типов
│   ├── jsx-types.ts        # Поддержка JSX/TSX
│   ├── types-manager.ts    # Управление типами
│   └── language-detector.ts # Определение языков
├── monaco-tests/           # Тесты для Monaco Editor
│   ├── TypeScriptTest.ts   # Тесты TypeScript
│   ├── ReactComponentTest.tsx # Тесты React с TypeScript
│   ├── JsxComponentTest.jsx # Тесты JSX без TypeScript
│   ├── SmartAnalyzerTest.ts # Тесты анализатора кода
│   └── README.md           # Документация по тестам
├── main-screen/            # Компоненты основного интерфейса
└── ...
```

## Лицензия

MIT
