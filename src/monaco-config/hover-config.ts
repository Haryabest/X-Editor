/**
 * Конфигурация для hover-подсказок Monaco Editor
 * Этот файл настраивает отображение подсказок при наведении на элементы кода
 */

/**
 * Настраивает отображение hover-подсказок в Monaco Editor
 * @param monaco Экземпляр Monaco Editor
 */
export function configureHover(monaco: any): void {
  try {
    // Проверяем, доступен ли редактор Monaco
    if (!monaco || !monaco.editor) {
      console.warn('Monaco Editor не инициализирован для настройки hover');
      return;
    }

    // Устанавливаем глобальные опции для всех редакторов по умолчанию
    monaco.editor.EditorOptions.hover.defaultValue = {
      enabled: true,
      delay: 300,
      sticky: true,
      above: false // Отключаем принудительное отображение выше текста
    };

    // Создаем HTML элемент для перехвата стилей hover-подсказок
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .monaco-hover {
        position: absolute !important;
        z-index: 50 !important;
        transform: none !important;
        max-width: 500px !important;
      }
      
      .monaco-hover-content {
        max-height: 300px !important;
        overflow-y: auto !important;
      }
      
      /* Убираем фиксированное позиционирование снизу экрана */
      .monaco-editor .overflowingContentWidget {
        position: absolute !important;
        bottom: auto !important;
        max-height: none !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
        border: 1px solid #3c3c3c !important;
      }
    `;
    document.head.appendChild(styleElement);

    console.log('Конфигурация hover-подсказок Monaco Editor настроена успешно');
  } catch (error) {
    console.error('Ошибка при настройке hover-подсказок:', error);
  }
} 