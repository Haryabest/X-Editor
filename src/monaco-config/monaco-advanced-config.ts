// Защита моделей от закрытия при TypeScript валидации
function applyTypeScriptModelProtection() {
  try {
    if (!window.monaco || !window.monaco.languages || !window.monaco.languages.typescript) {
      console.log('[Monaco-Config] Monaco еще не инициализирован, откладываем защиту TypeScript моделей');
      setTimeout(applyTypeScriptModelProtection, 500);
      return;
    }
    
    console.log('[Monaco-Config] Применяем защиту моделей для TypeScript');
    
    // Защищаем метод setCompilerOptions, который используется для валидации TypeScript
    const originalSetCompilerOptions = window.monaco.languages.typescript.typescriptDefaults.setCompilerOptions;
    window.monaco.languages.typescript.typescriptDefaults.setCompilerOptions = function(...args) {
      console.log('[Monaco-Config] Вызван setCompilerOptions, проверяем все модели на наличие isDisposed');
      
      // Проверяем все модели перед применением
      const allModels = window.monaco.editor.getModels();
      for (const model of allModels) {
        if (!model) continue;
        
        // Добавляем метод isDisposed всем моделям, если его еще нет
        if (typeof model.isDisposed !== 'function') {
          model.isDisposed = function() {
            return false; // Всегда возвращаем false, чтобы модель считалась активной
          };
          console.log(`[Monaco-Config] Добавлен isDisposed методу модели: ${model.uri.toString()}`);
        }
        
        // Защищаем от закрытия
        if (!model.__protectedAgainstTSValidation) {
          const originalDispose = model.dispose.bind(model);
          model.dispose = function() {
            console.log(`[Monaco-Config] Предотвращено закрытие модели при TypeScript валидации: ${model.uri.toString()}`);
            return false; // Возвращаем false вместо закрытия
          };
          model.__protectedAgainstTSValidation = true;
        }
      }
      
      // Вызываем оригинальный метод с аргументами
      console.log('[Monaco-Config] Применяем TypeScript конфигурацию');
      try {
        const result = originalSetCompilerOptions.apply(this, args);
        console.log('[Monaco-Config] TypeScript configuration completed successfully');
        return result;
      } catch (error) {
        console.error('[Monaco-Config] Ошибка при применении TypeScript конфигурации:', error);
        return false;
      }
    };
    
    console.log('[Monaco-Config] Защита TypeScript моделей успешно установлена');
  } catch (error) {
    console.error('[Monaco-Config] Ошибка при установке защиты TypeScript моделей:', error);
  }
}

// Запускаем защиту при загрузке модуля
applyTypeScriptModelProtection(); 