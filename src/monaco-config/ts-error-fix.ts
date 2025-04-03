/**
 * Файл с функциями для прямого исправления ошибок TypeScript в Monaco Editor
 */

/**
 * Переопределяет обработку ошибок TypeScript в Monaco.
 * Эта функция должна вызываться ПОСЛЕ того, как Monaco полностью загружен.
 */
export function fixTypeScriptErrors(): void {
  if (!window.monaco || !window.monaco.editor) {
    console.error('Monaco не инициализирован, невозможно исправить ошибки TypeScript');
    return;
  }

  try {
    // Сохраняем оригинальную функцию установки маркеров
    const originalSetModelMarkers = window.monaco.editor.setModelMarkers;
    
    // Переопределяем функцию установки маркеров
    window.monaco.editor.setModelMarkers = function(model, owner, markers) {
      // Только для TypeScript-связанных владельцев маркеров
      if (owner === 'typescript' || owner === 'typescript-semantic' || owner === 'typescript-syntax') {
        // Фильтруем маркеры, удаляя ошибки с кодами 8006, 8008, 8009, 8010, 8013
        const errorsToIgnore = [8006, 8008, 8009, 8010, 8013];
        
        markers = markers.filter(marker => {
          // Если код ошибки есть в списке игнорируемых, отфильтровываем её
          if (marker.code) {
            // Код может быть числом, строкой или объектом с value
            const code = typeof marker.code === 'object' ? 
              parseInt(marker.code.value) : 
              (typeof marker.code === 'string' ? parseInt(marker.code) : marker.code);
            
            return !errorsToIgnore.includes(code);
          }
          return true;
        });
      }
      
      // Вызываем оригинальную функцию с отфильтрованными маркерами
      return originalSetModelMarkers.call(this, model, owner, markers);
    };
    
    // Добавляем функцию для просмотра диагностики
    window.logMonacoDiagnostics = function() {
      const models = window.monaco.editor.getModels();
      const allMarkers = [];
      const errorCounts = {};
      
      models.forEach(model => {
        const uri = model.uri;
        const markers = window.monaco.editor.getModelMarkers({ resource: uri });
        
        markers.forEach(marker => {
          allMarkers.push(marker);
          
          // Подсчитываем количество ошибок по кодам
          if (marker.code) {
            const code = typeof marker.code === 'object' ? 
              marker.code.value : 
              marker.code.toString();
            
            if (!errorCounts[code]) {
              errorCounts[code] = 1;
            } else {
              errorCounts[code]++;
            }
          }
        });
      });
      
      return { markers: allMarkers, errorCounts };
    };
    
    console.log('Переопределена обработка ошибок TypeScript в Monaco Editor');
    
    // Явно устанавливаем диагностические опции для TypeScript
    if (window.monaco.languages && window.monaco.languages.typescript) {
      // Объединяем настройки для TypeScript
      const tsDefaults = window.monaco.languages.typescript.typescriptDefaults;
      tsDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        diagnosticCodesToIgnore: [
          8006, // 'interface' declarations can only be used in TypeScript files
          8008, // Type aliases can only be used in TypeScript files
          8009, // The 'readonly' modifier can only be used in TypeScript files
          8010, // Type annotations can only be used in TypeScript files
          8013, // Non-null assertions can only be used in TypeScript files
          2307, // Cannot find module 'X'
          2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
          7016  // Could not find a declaration file for module 'X'
        ]
      });
      
      // Объединяем настройки для JavaScript
      const jsDefaults = window.monaco.languages.typescript.javascriptDefaults;
      jsDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        noSuggestionDiagnostics: false,
        diagnosticCodesToIgnore: [
          8006, // 'interface' declarations can only be used in TypeScript files
          8008, // Type aliases can only be used in TypeScript files
          8009, // The 'readonly' modifier can only be used in TypeScript files
          8010, // Type annotations can only be used in TypeScript files
          8013, // Non-null assertions can only be used in TypeScript files
          2307, // Cannot find module 'X'
          2792, // Cannot find module. Did you mean to set the 'moduleResolution' option to 'node'?
          7016  // Could not find a declaration file for module 'X'
        ]
      });
      
      console.log('Обновлены диагностические настройки TypeScript и JavaScript');
    }
    
    // Проверяем, правильно ли установлен язык для всех моделей
    forceCorrectLanguageForExistingModels();
  } catch (error) {
    console.error('Ошибка при исправлении ошибок TypeScript:', error);
  }
}

/**
 * Принудительно устанавливает правильный язык для существующих моделей на основе расширения файла
 */
function forceCorrectLanguageForExistingModels(): void {
  try {
    const models = window.monaco.editor.getModels();
    
    models.forEach(model => {
      const uri = model.uri.toString();
      const fileName = uri.split('/').pop() || '';
      
      // Выделяем расширение файла
      const lastDotIndex = fileName.lastIndexOf('.');
      const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex).toLowerCase() : '';
      
      // Явно устанавливаем язык на основе расширения
      if (ext === '.ts' && !fileName.endsWith('.d.ts')) {
        window.monaco.editor.setModelLanguage(model, 'typescript');
        console.log(`Принудительно установлен язык typescript для ${fileName}`);
      } else if (ext === '.tsx') {
        window.monaco.editor.setModelLanguage(model, 'typescriptreact');
        console.log(`Принудительно установлен язык typescriptreact для ${fileName}`);
      } else if (ext === '.d.ts') {
        window.monaco.editor.setModelLanguage(model, 'typescript');
        console.log(`Принудительно установлен язык typescript для ${fileName} (declaration file)`);
      } else if (ext === '.js') {
        window.monaco.editor.setModelLanguage(model, 'javascript');
      } else if (ext === '.jsx') {
        window.monaco.editor.setModelLanguage(model, 'javascriptreact');
      }
    });
    
    console.log('Принудительно установлен правильный язык для всех существующих моделей');
  } catch (error) {
    console.error('Ошибка при принудительной установке языка для моделей:', error);
  }
} 