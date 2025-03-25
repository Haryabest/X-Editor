import { Monaco } from '@monaco-editor/react';
import { configureTypes } from './types-manager';
import { setupAutoTypes } from './auto-types';
import { configureJSXTypes } from './jsx-types';
import { FileItem } from '../types';

/**
 * Умный анализатор кода, который определяет, какие ошибки показывать
 */
function setupSmartCodeAnalyzer(monaco: Monaco) {
  // Эти коды ошибок важны и всегда должны отображаться, даже в JSX
  const criticalErrorCodes = [
    // Критические синтаксические ошибки
    1002, // Неожиданный конец файла
    1012, // Требуется точка
    1014, // Точка с запятой требуется
    1035, // Недопустимая стрелочная функция
    1068, // Неожиданная фигурная скобка
    
    // Важные логические ошибки
    2440, // Тип не является конструируемым
    2448, // Декларация не найдена
    2451, // Не может быть назначен
    2420, // Свойство не существует в типе
    2554, // Неверные аргументы функции
    2575, // Нет значения по умолчанию для параметра
    
    // Другие важные ошибки
    2391, // Дублирование имен
    2322, // Несоответствие типов
    2349, // Не имеет конструктора
    2307, // Не удается найти модуль (важно, хотя мы его игнорируем в JSX контексте)
  ];
  
  // Отслеживаем создание моделей
  monaco.editor.onDidCreateModel((model) => {
    // Получаем информацию о языке
    const languageId = model.getLanguageId();
    
    // Анализируем содержимое модели
    const content = model.getValue();
    const isJsxFile = model.uri.path.endsWith('.tsx') || model.uri.path.endsWith('.jsx') || content.includes('</');
    
    // Настраиваем параметры диагностики в зависимости от типа файла
    if (languageId === 'typescript' || languageId === 'javascript') {
      // Базовый набор игнорируемых кодов
      const ignoredCodes = [
        2669, 1046, 2307, 7031, 1161, 2304, 7026, 7006,
        2740, 2339, 2531, 2786, 2605, 8006, 8010
      ];
      
      // Если файл содержит JSX, игнорируем дополнительные коды
      if (isJsxFile) {
        ignoredCodes.push(
          1005, 1003, 17008, 2693, 1109, 1128, 1434, 1136, 1110
        );
      }
      
      // Применяем настройки
      if (languageId === 'typescript') {
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: true,
          diagnosticCodesToIgnore: ignoredCodes
        });
      } else {
        monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: true,
          diagnosticCodesToIgnore: ignoredCodes
        });
      }
    }
  });
}

/**
 * Проверка синтаксиса JSX/TSX для уменьшения ложных срабатываний
 */
function setupCustomJsxValidator(monaco: Monaco) {
  // Регистрируем собственный провайдер маркеров для TypeScript
  monaco.editor.onDidCreateModel((model) => {
    if (model.getLanguageId() === 'typescript' || model.getLanguageId() === 'javascript') {
      // Анализируем содержимое модели на предмет JSX
      const content = model.getValue();
      const isJsxFile = model.uri.path.endsWith('.tsx') || model.uri.path.endsWith('.jsx') || content.includes('</');
      
      if (isJsxFile) {
        // Для JSX файлов отключаем стандартные проверки синтаксиса
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          noSuggestionDiagnostics: true,
          diagnosticCodesToIgnore: [
            2669, 1046, 2307, 7031, 1161, 2304, 7026, 2322, 7006,
            2740, 2339, 2531, 2786, 2605, 1005, 1003, 17008, 2693, 1109,
            1128, 1434, 1136, 1110, 8006, 8010
          ]
        });
      }
    }
  });
}

export async function configureMonaco(
  monaco: Monaco, 
  openedFiles: FileItem[], 
  selectedFolder: string | null,
  supportedTextExtensions: string[],
  getLanguageFromExtension: (filePath: string) => string
) {
  try {
    // Базовая конфигурация типов - это главное, что мы делаем здесь
    configureTypes(monaco);
    
    // Добавляем продвинутые типы для JSX/TSX
    configureJSXTypes(monaco);
    
    // Настройка автоматического определения типов на основе импортов
    await setupAutoTypes(monaco, openedFiles);

    // Настраиваем собственный валидатор JSX/TSX
    setupCustomJsxValidator(monaco);
    
    // Настраиваем умный анализатор кода
    setupSmartCodeAnalyzer(monaco);

    // Настройка виртуальной файловой системы
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
    
    // Настройка специальных опций для TypeScript
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      ...monaco.languages.typescript.typescriptDefaults.getCompilerOptions(),
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: 'React.createElement',
      jsxFragmentFactory: 'React.Fragment',
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowJs: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true
    });
    
    // Отключаем лишнюю валидацию для повышения производительности
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      diagnosticCodesToIgnore: [
        2669, // Augmentations for the global scope can only be directly nested
        1046, // Top-level declarations in .d.ts files must start with 'declare' or 'export'
        2307, // Cannot find module
        7031, // Initializers are not allowed in ambient contexts
        1161, // Unterminated regular expression literal
        2304, // Cannot find name (HTML elements)
        7026, // JSX element implicitly has type 'any'
        2322, // Type assignment error
        7006, // Parameter implicitly has an 'any' type
        2740,  // Type 'string | undefined' is missing the following properties
        2339,  // Property does not exist on type
        2531,  // Object is possibly 'null'
        2786,  // 'x' cannot be used as a JSX component
        2605,  // JSX element type 'x' is not a constructor function
        1005,  // '>' expected.
        1003,  // Identifier expected.
        17008, // JSX element 'x' has no corresponding closing tag.
        2693,  // 'x' only refers to a type, but is being used as a value here.
        1109,  // Expression expected.
        1128,  // Declaration or statement expected.
        1434,  // Unexpected keyword or identifier.
        1136,  // Property assignment expected.
        1110,  // Type expected.
        8006,  // 'module' declarations can only be used in TypeScript files.
        8010   // Type annotations can only be used in TypeScript files.
      ]
    });
    
    // Настраиваем анализатор с дополнительными опциями
    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    
    // Мы НЕ создаем модели здесь, так как они будут созданы при монтировании редактора
    // Это предотвращает конфликты и ошибки "getFullModelRange of null"
    
    // Настройка отображения полного пути модуля при наведении
    monaco.languages.registerHoverProvider('typescript', {
      provideHover: (model, position) => {
        const wordInfo = model.getWordAtPosition(position);
        if (!wordInfo) return null;
        
        const lineContent = model.getLineContent(position.lineNumber);
        const importMatch = lineContent.match(/import[\s\S]*?['"]([^'"]+)['"]/);
        
        if (importMatch) {
          const modulePath = importMatch[1];
          
          let fullPath = '';
          if (modulePath.startsWith('.')) {
            if (selectedFolder) {
              fullPath = `${selectedFolder}/${modulePath.replace(/^\.\//, '')}`;
            } else {
              fullPath = modulePath;
            }
          } else {
            fullPath = `node_modules/${modulePath}`;
          }
          
          return {
            contents: [
              { value: `**Модуль:** \`${modulePath}\`` },
              { value: `**Полный путь:** \`${fullPath}\`` }
            ]
          };
        }
        
        return null;
      }
    });
    
    // Настройка такая же для JavaScript
    monaco.languages.registerHoverProvider('javascript', {
      provideHover: (model, position) => {
        const wordInfo = model.getWordAtPosition(position);
        if (!wordInfo) return null;
        
        const lineContent = model.getLineContent(position.lineNumber);
        const importMatch = lineContent.match(/import[\s\S]*?['"]([^'"]+)['"]/);
        
        if (importMatch) {
          const modulePath = importMatch[1];
          
          let fullPath = '';
          if (modulePath.startsWith('.')) {
            if (selectedFolder) {
              fullPath = `${selectedFolder}/${modulePath.replace(/^\.\//, '')}`;
            } else {
              fullPath = modulePath;
            }
          } else {
            fullPath = `node_modules/${modulePath}`;
          }
          
          return {
            contents: [
              { value: `**Модуль:** \`${modulePath}\`` },
              { value: `**Полный путь:** \`${fullPath}\`` }
            ]
          };
        }
        
        return null;
      }
    });
    
    // Настройка для JSON файлов
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: true,
      schemas: [],
      enableSchemaRequest: true,
      schemaRequest: 'warning'
    });
  } catch (error) {
    console.error('Error configuring Monaco:', error);
  }
} 
