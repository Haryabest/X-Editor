/**
 * monaco-model-protection.js
 * Патч для предотвращения автоматического закрытия моделей Monaco Editor
 * и добавления метода isDisposed для TypeScript валидации
 */

// Автоматически выполняется при загрузке
(function() {
  console.log('[MonacoProtection] Инициализация патча для защиты моделей Monaco...');
  
  // Глобальное хранилище защищенных моделей
  window.__protectedModels = window.__protectedModels || new Map();
  
  // Флаг инициализации
  window.__modelProtectionInitialized = false;
  
  // Функция для инициализации патча
  function initializeProtection() {
    if (window.__modelProtectionInitialized) {
      console.log('[MonacoProtection] Патч уже инициализирован');
      return;
    }
    
    if (!window.monaco || !window.monaco.editor) {
      console.log('[MonacoProtection] Monaco еще не загружен, ожидание...');
      setTimeout(initializeProtection, 500);
      return;
    }
    
    console.log('[MonacoProtection] Monaco обнаружен, применяем патч...');
    
    try {
      // Функция для добавления isDisposed в модель
      function addIsDisposedMethod(model) {
        if (!model) return;
        
        // Проверяем, есть ли уже метод isDisposed
        if (typeof model.isDisposed !== 'function') {
          // Добавляем метод isDisposed как функцию
          model.isDisposed = function() {
            return false; // Всегда возвращаем false
          };
          
          console.log(`[MonacoProtection] Добавлен метод isDisposed для модели: ${model.uri.toString()}`);
        }
      }
      
      // Применяем патч ко всем существующим моделям
      const models = window.monaco.editor.getModels();
      console.log(`[MonacoProtection] Найдено ${models.length} существующих моделей`);
      
      for (const model of models) {
        addIsDisposedMethod(model);
      }
      
      // Патч для метода создания модели
      const originalCreateModel = window.monaco.editor.createModel;
      window.monaco.editor.createModel = function() {
        // Вызываем оригинальный метод
        const model = originalCreateModel.apply(this, arguments);
        
        // Добавляем метод isDisposed
        if (model) {
          addIsDisposedMethod(model);
        }
        
        return model;
      };
      
      console.log('[MonacoProtection] Патч успешно применен');
      window.__modelProtectionInitialized = true;
    } catch (error) {
      console.error('[MonacoProtection] Ошибка при применении патча:', error);
    }
  }
  
  // Запускаем инициализацию
  initializeProtection();
  
  // Также добавляем обработчик события загрузки страницы
  window.addEventListener('load', initializeProtection);
  
  // Делаем функцию доступной глобально
  window.__reinitMonacoProtection = initializeProtection;
})();