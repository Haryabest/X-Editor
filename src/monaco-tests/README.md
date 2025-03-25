# Тесты для Monaco Editor

Этот набор тестов предназначен для проверки корректной работы Monaco Editor с различными типами файлов (TypeScript, TSX, JSX) и правильной обработки ошибок.

## Содержимое

Тестовый набор включает:

- `TypeScriptTest.ts` - Базовые тесты TypeScript синтаксиса
- `ReactComponentTest.tsx` - Тесты для React/JSX в TypeScript
- `JsxComponentTest.jsx` - Тесты для чистого JSX без TypeScript
- `SmartAnalyzerTest.ts` - Тесты для проверки умного анализатора ошибок
- `test-runner.js` - Скрипт для запуска тестов
- `test-utils.js` - Утилиты для тестирования
- `integration.js` - Интеграционные тесты
- `index.html` - HTML-страница для запуска тестов в браузере

## Как запустить тесты

1. Запустите приложение X-Editor:
   ```
   npm run dev
   ```

2. Откройте URL в браузере:
   ```
   http://localhost:3000/src/monaco-tests/index.html
   ```

3. Используйте интерфейс для тестирования - выберите файл, затем нажмите кнопку "Анализировать ошибки"

## Тестируемые сценарии

### TypeScript тесты

- Базовые типы (string, number, boolean)
- Интерфейсы и пользовательские типы
- Функции с типизацией и дженериками
- Промисы и асинхронные функции
- Ошибка типа в строке `const errorString: string = 123;`
- Ошибка отсутствующего свойства в `const errorUser: User = {...}`
- Ошибка неверного числа аргументов в `add(1)`
- Ошибка несоответствия типа `const errorRole: UserRole = "manager";`

### React/TSX тесты

- Функциональные компоненты с типизацией
- Интерфейсы для props
- Использование хуков (useState, useEffect)
- Классовые компоненты с состоянием
- Пропущенные обязательные props
- Неправильные типы props
- Использование фрагментов
- Self-closing теги
- Типизация внутри JSX

### JSX тесты

- Базовые JSX-компоненты
- Компоненты с props
- Использование хуков
- Классовые компоненты
- Смешанный JSX (условия, списки, spread-операторы)

### Тесты умного анализатора ошибок

- Критические синтаксические ошибки (должны отображаться)
- Важные логические ошибки (должны отображаться)
- Проверка кодов ошибок, которые должны игнорироваться
- Проверка правильной работы JSX в TypeScript-файлах
- Глобальные объявления и их обработка
- Стандартные синтаксические конструкции

## Коды ошибок

Следующие коды ошибок должны игнорироваться в JSX/TSX контексте:

- 8006 - 'module' declarations can only be used in TypeScript files
- 8010 - Type annotations can only be used in TypeScript files
- 2669 - Augmentations for the global scope can only be directly nested in external modules
- 1046 - Top-level declarations in .d.ts files must start with declare or export
- 2307 - Cannot find module or its corresponding type declarations
- 7031 - Binding element implicitly has an 'any' type
- 1161 - Unterminated regular expression literal

## Ожидаемые результаты

При работе с Monaco Editor, мы ожидаем следующего поведения:

1. Критические синтаксические ошибки (например, несбалансированные скобки) должны отображаться
2. Важные логические ошибки (например, вызов несуществующего метода) должны отображаться
3. Технические ошибки, связанные с JSX в TS-файлах, должны игнорироваться
4. Компоненты с правильно типизированными props должны работать без ошибок
5. Специфические для JSX конструкции (фрагменты, самозакрывающиеся теги) должны работать

## Отладка

Если вы видите неожиданные ошибки:

1. Проверьте, что Monaco Editor правильно настроен для соответствующего типа файла
2. Убедитесь, что все необходимые типы для React загружены
3. Проверьте, правильно ли настроены диагностические опции (noSemanticValidation, diagnosticCodesToIgnore)
4. Используйте умный анализатор ошибок для фильтрации ложных срабатываний

## Учет статистики ошибок

Вы можете использовать скрипт для учета статистики по кодам ошибок:

```javascript
const errorCounts = {};
markers.forEach(marker => {
  const code = marker.code;
  errorCounts[code] = (errorCounts[code] || 0) + 1;
});
console.log('Статистика по кодам ошибок:', errorCounts);
```

## Известные проблемы

- JSX синтаксис в .ts файлах вызывает ошибки компиляции
- Некоторые коды ошибок могут изменяться в разных версиях TypeScript
- Диагностика ошибок может работать иначе для разных типов файлов

## Решение проблем

### Ошибки не отображаются
1. **Причина**: Monaco Editor может кэшировать состояние и настройки проверки типов
2. **Решение**: 
   - Обновите страницу
   - Подождите 1-2 секунды после загрузки файла перед анализом ошибок
   - Внесите небольшое изменение в код (например, добавьте пробел)

### Возникают неожиданные ошибки
Некоторые коды ошибок должны игнорироваться:
- 2307: Cannot find module (ошибки импорта несуществующих модулей)
- 8006: 'module' declarations can only be used in TypeScript files
- 8010: Type annotations can only be used in TypeScript files
- 2688: Cannot find type definition file
- 1039: Initializers are not allowed in ambient contexts
- 2792: Cannot find module 'next'. Did you mean to set the 'moduleResolution' option to 'nodenext'
- 1183: An implementation cannot be declared in ambient contexts
- 1254: A 'const' initializer in an ambient context must be a string or numeric literal
- 2695: Left side of comma operator is unused and has no side effects
- 2365: Operator '<' cannot be applied to types 'boolean' and 'number'
- 2714: The expression of an export assignment must be an identifier or qualified name in an ambient context
- 2552: Cannot find name 'body'. Did you mean 'Body'?
- 2362: The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type
- 2503: Cannot find namespace 'React'
- 2363: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type
- 18004: No value exists in scope for the shorthand property 'x'. Either declare one or provide an initializer

### При работе с основным редактором
Если в основном приложении возникают ошибки:
1. Проверьте игнорируемые коды ошибок в `src/monaco-config/index.ts`
2. Убедитесь, что список кодов в `centerContainer.tsx` обновлен
3. Для устранения белого экрана в редакторе, попробуйте добавить задержку перед включением проверки типов:
   ```javascript
   // Сначала отключаем все проверки
   monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
     noSemanticValidation: true,
     noSyntaxValidation: true
   });
   
   // Затем включаем с задержкой
   setTimeout(() => {
     monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
       noSemanticValidation: false,
       noSyntaxValidation: false,
       diagnosticCodesToIgnore: [...список кодов...]
     });
   }, 1000);
   ```

## Коды ошибок TypeScript

Список часто встречающихся кодов ошибок:

- **2322**: Type 'X' is not assignable to type 'Y'
- **2554**: Expected N arguments, but got M
- **2741**: Property 'X' is missing in type '{...}' but required in type 'Y'
- **2307**: Cannot find module 'X' or its corresponding type declarations
- **2688**: Cannot find type definition file for 'X'
- **1039**: Initializers are not allowed in ambient contexts
- **2792**: Cannot find module 'next' (проблема с moduleResolution)
- **1183**: An implementation cannot be declared in ambient contexts
- **1254**: A 'const' initializer in an ambient context must be a string or numeric literal
- **2695**: Left side of comma operator is unused and has no side effects
- **2365**: Operator '<' cannot be applied to types 'boolean' and 'number'
- **2714**: The expression of an export assignment must be an identifier or qualified name in an ambient context
- **2552**: Cannot find name 'body'. Did you mean 'Body'?
- **2362**: The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type
- **2503**: Cannot find namespace 'React'
- **2363**: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type
- **18004**: No value exists in scope for the shorthand property 'x'. Either declare one or provide an initializer

## Обновление тестов

Если требуется добавить новые тесты:
1. Создайте новый файл с соответствующим расширением
2. Добавьте его в список в файле `index.html`
3. Обновите описание в README
4. Обновите файл с тестовым содержимым в соответствующем .js файле 