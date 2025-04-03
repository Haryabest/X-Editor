/**
 * Прямая настройка распознавания типов TypeScript в Monaco Editor
 */

/**
 * Полностью отключает сообщения об ошибках для TypeScript-специфичных конструкций
 */
export function setupTypeScriptDirect(): void {
  if (!window.monaco || !window.monaco.languages || !window.monaco.languages.typescript) {
    console.error('Monaco TypeScript API не доступен, настройка невозможна');
    return;
  }
  
  try {
    // 1. Заменяем функцию проверки, которая определяет, является ли файл TypeScript файлом
    const originalIsTypeScriptFile = window.monaco.languages.typescript._fileIsTypescript;
    
    // Переопределяем эту функцию, чтобы она всегда возвращала true для .ts и .tsx файлов
    if (typeof originalIsTypeScriptFile === 'function') {
      window.monaco.languages.typescript._fileIsTypescript = function(filename) {
        if (!filename) return false;
        
        const lowerFileName = filename.toLowerCase();
        return lowerFileName.endsWith('.ts') || 
               lowerFileName.endsWith('.tsx') || 
               lowerFileName.endsWith('.d.ts') ||
               // Вызываем оригинальную функцию как запасной вариант
               originalIsTypeScriptFile(filename);
      };
      
      console.log('Переопределена функция проверки TypeScript файлов');
    }
    
    // 2. Явно настраиваем компилятор TypeScript с наиболее либеральными настройками
    const compilerOptions = {
      allowJs: true,
      allowNonTsExtensions: true,
      allowSyntheticDefaultImports: true,
      checkJs: false, // Отключаем проверку JavaScript
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      isolatedModules: true,
      jsx: window.monaco.languages.typescript.JsxEmit.React,
      module: window.monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: window.monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      noEmit: true,
      noImplicitAny: false, // Отключаем проверку implicitAny
      removeComments: false,
      resolveJsonModule: true,
      skipLibCheck: true,
      strict: false, // Отключаем строгий режим
      suppressExcessPropertyErrors: true, // Подавляем ошибки лишних свойств
      suppressImplicitAnyIndexErrors: true, // Подавляем ошибки индексов
      target: window.monaco.languages.typescript.ScriptTarget.ESNext
    };
    
    window.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
    
    // 3. Полностью отключаем диагностику для определенных кодов ошибок
    const diagnosticsOptions = {
      noSemanticValidation: false, // Не отключаем полностью семантическую валидацию
      noSyntaxValidation: false,   // Не отключаем полностью синтаксическую валидацию
      noSuggestionDiagnostics: false,
      diagnosticCodesToIgnore: [
        // TypeScript-специфичные конструкции
        8006, // 'interface' declarations can only be used in TypeScript files
        8008, // Type aliases can only be used in TypeScript files
        8009, // The 'readonly' modifier can only be used in TypeScript files
        8010, // Type annotations can only be used in TypeScript files
        8013, // Non-null assertions can only be used in TypeScript files
        
        // Ошибки модулей
        2307, // Cannot find module 'X'
        2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
        7016,  // Could not find a declaration file for module 'X'
        
        // Другие частые ошибки
        2304, // Cannot find name 'X'
        2339, // Property 'X' does not exist on type 'Y'
        2322, // Type 'X' is not assignable to type 'Y'
        2345, // Argument of type 'X' is not assignable to parameter of type 'Y'
        2741, // Property 'X' is missing in type 'Y' but required in type 'Z'
        2532  // Object is possibly 'undefined'
      ]
    };
    
    window.monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
    window.monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(diagnosticsOptions);
    
    // 4. Регистрируем расширения файлов для TypeScript и TSX
    const languages = window.monaco.languages.getLanguages();
    const hasTypeScript = languages.some(lang => lang.id === 'typescript');
    const hasTypeScriptReact = languages.some(lang => lang.id === 'typescriptreact');
    
    if (!hasTypeScript) {
      window.monaco.languages.register({
        id: 'typescript',
        extensions: ['.ts', '.d.ts'],
        aliases: ['TypeScript', 'ts', 'typescript']
      });
    }
    
    if (!hasTypeScriptReact) {
      window.monaco.languages.register({
        id: 'typescriptreact',
        extensions: ['.tsx'],
        aliases: ['TypeScript React', 'tsx', 'typescriptreact']
      });
    }
    
    // 5. Добавляем обработчик для моделей, чтобы правильно определить язык
    window.monaco.editor.onDidCreateModel(model => {
      const uri = model.uri.toString();
      const fileName = uri.split('/').pop() || '';
      const lowerFileName = fileName.toLowerCase();
      
      if (lowerFileName.endsWith('.ts') && !lowerFileName.endsWith('.d.ts')) {
        window.monaco.editor.setModelLanguage(model, 'typescript');
      } else if (lowerFileName.endsWith('.tsx')) {
        window.monaco.editor.setModelLanguage(model, 'typescriptreact');
      } else if (lowerFileName.endsWith('.d.ts')) {
        window.monaco.editor.setModelLanguage(model, 'typescript');
      }
    });
    
    // 6. Применяем настройки ко всем существующим моделям
    const models = window.monaco.editor.getModels();
    for (const model of models) {
      const uri = model.uri.toString();
      const fileName = uri.split('/').pop() || '';
      const lowerFileName = fileName.toLowerCase();
      
      if (lowerFileName.endsWith('.ts') && !lowerFileName.endsWith('.d.ts')) {
        window.monaco.editor.setModelLanguage(model, 'typescript');
      } else if (lowerFileName.endsWith('.tsx')) {
        window.monaco.editor.setModelLanguage(model, 'typescriptreact');
      } else if (lowerFileName.endsWith('.d.ts')) {
        window.monaco.editor.setModelLanguage(model, 'typescript');
      }
    }
    
    console.log('Настройка TypeScript успешно применена');
  } catch (error) {
    console.error('Ошибка при настройке TypeScript:', error);
  }
} 