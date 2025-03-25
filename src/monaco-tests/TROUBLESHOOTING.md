# Устранение проблем с Monaco Editor

Этот документ содержит рекомендации по решению распространенных проблем при работе с Monaco Editor, TypeScript, JSX и TSX файлами.

## Распространенные проблемы и их решения

### 1. Белый экран или ошибка при открытии TypeScript/TSX файлов

**Симптомы:**
- Редактор не загружается или показывает белый экран
- В консоли ошибка вида "Cannot read properties of null"

**Решения:**
- Убедитесь, что настройки компилятора TypeScript корректны в файле `src/monaco-config/types-manager.ts`
- Проверьте, что в `configureMonaco` не создаются дублирующиеся модели
- Добавьте в лог информацию об инициализации редактора для отладки

```typescript
// src/main-screen/centerContainer/centerContainer.tsx
// Добавьте логирование в функцию onMount:
const onMount = (editor, monaco) => {
  console.log("Monaco editor mounted");
  // остальной код
};
```

### 2. Ошибки в JSX/TSX синтаксисе

**Симптомы:**
- Подсвечиваются ошибки для нормального JSX синтаксиса
- Не распознаются компоненты и атрибуты JSX

**Решения:**
- Проверьте, что JSX опции правильно настроены:

```typescript
monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  jsx: monaco.languages.typescript.JsxEmit.React,
  jsxFactory: 'React.createElement',
  jsxFragmentFactory: 'React.Fragment',
  // остальные опции
});
```

- Убедитесь, что в `jsx-types.ts` корректно определен тип React.Element

### 3. Проблемы с типами в React компонентах

**Симптомы:**
- Не распознаются props компонентов
- Ложные ошибки для атрибутов HTML-элементов

**Решения:**
- Проверьте, что типы React корректно загружаются в `auto-types.ts`
- Убедитесь, что определены правильные интерфейсы для JSX атрибутов
- Проверьте список игнорируемых диагностических кодов

### 4. Проблемы с производительностью

**Симптомы:**
- Редактор работает медленно
- Высокая загрузка CPU

**Решения:**
- Уменьшите область проверки типов в больших файлах
- Используйте задержку для валидации (debounce)
- Отключите ненужные проверки в диагностических опциях

```typescript
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
  noSuggestionDiagnostics: true, // отключаем подсказки для увеличения производительности
});
```

## Отладка и поиск ошибок

### Шаги для отладки:

1. **Включите отладочные инструменты**

```javascript
import { enableMonacoDebugTools } from './monaco-tests/integration';

// В вашей инициализационной функции:
enableMonacoDebugTools();
```

2. **Проверьте загруженные модели**

В консоли браузера:
```javascript
window.monacoDebug.getModels().forEach(model => console.log(model.uri.toString()));
```

3. **Проверьте маркеры (ошибки)**

```javascript
window.monacoDebug.getMarkers();
```

4. **Проверьте опции компилятора TypeScript**

```javascript
window.monacoDebug.getTsCompilerOptions();
```

### Логирование диагностики

Добавьте следующий код для логирования всех диагностических сообщений:

```typescript
// Функция для отладки диагностики
function logDiagnostics() {
  const markers = monaco.editor.getModelMarkers({});
  console.log('Все диагностические сообщения:', markers);
  
  // Группировка по кодам ошибок
  const errorCounts = {};
  markers.forEach(marker => {
    const code = marker.code;
    errorCounts[code] = (errorCounts[code] || 0) + 1;
  });
  
  console.log('Статистика по кодам ошибок:', errorCounts);
}

// Вызывайте эту функцию после загрузки файла
setTimeout(logDiagnostics, 3000);
```

## Работа с кодами ошибок TypeScript

### Важные коды ошибок и их значение

| Код   | Описание | Игнорировать? |
|-------|----------|---------------|
| 2669  | Augmentations for the global scope can only be directly nested | Да |
| 2307  | Cannot find module | Иногда |
| 7026  | JSX element implicitly has type 'any' | Да в JSX/TSX |
| 2322  | Type assignment error | Нет |
| 8006  | 'module' declarations can only be used in TypeScript files | Да в JSX/TSX |
| 8010  | Type annotations can only be used in TypeScript files | Да в JSX/TSX |
| 2304  | Cannot find name | Иногда |
| 1005  | '>' expected | Нет, критичная |
| 1003  | Identifier expected | Нет, критичная |
| 17008 | JSX element has no corresponding closing tag | Нет, критичная |

### Добавление новых кодов ошибок для игнорирования

Если вы идентифицировали код ошибки, который нужно игнорировать, добавьте его следующим образом:

```typescript
// src/monaco-config/index.ts
// В функции setupSmartCodeAnalyzer или другой функции, настраивающей диагностику
monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  diagnosticCodesToIgnore: [
    // Существующие коды
    2669,
    // ... другие коды
    // Новый код для игнорирования
    YOUR_NEW_CODE
  ]
});
```

## Расширение тестов

Если вы создаете новые тестовые файлы, добавьте их в список TEST_FILES в `test-runner.js`:

```javascript
const TEST_FILES = [
  'src/monaco-tests/TypeScriptTest.ts',
  'src/monaco-tests/ReactComponentTest.tsx',
  'src/monaco-tests/JsxComponentTest.jsx',
  'src/monaco-tests/SmartAnalyzerTest.ts',
  // Добавьте ваш новый файл:
  'src/monaco-tests/YourNewTest.ts'
];
``` 