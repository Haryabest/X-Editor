/**
 * Регистрирует функции отображения ошибок в глобальном объекте window
 */

/**
 * Настраивает отображение ошибок для редактора Monaco
 * @param editor Экземпляр редактора Monaco
 */
export function setupErrorDecorations(editor: any): void {
  try {
    if (!editor || !editor.getModel || !editor.getModel()) {
      console.warn('Невозможно настроить декорации ошибок: редактор или модель отсутствуют');
      return;
    }
    
    // Получаем модель редактора
    const model = editor.getModel();
    const uri = model.uri.toString();
    
    // Устанавливаем glyphMargin = true для отображения иконок ошибок
    editor.updateOptions({ 
      glyphMargin: true,
      lineNumbers: 'on',
      minimap: { enabled: true }
    });
    
    // Получаем маркеры ошибок для модели
    const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
    console.log(`Получено ${markers.length} маркеров для модели ${uri}`);
    
    // Добавляем CSS стили для отображения ошибок если их еще нет
    addErrorStyles();
    
    // Очищаем старые декорации, если они есть
    if (editor._errorDecorationIds) {
      editor.deltaDecorations(editor._errorDecorationIds, []);
      editor._errorDecorationIds = [];
    }
    
    if (editor._errorLineDecorationIds) {
      editor.deltaDecorations(editor._errorLineDecorationIds, []);
      editor._errorLineDecorationIds = [];
    }
    
    // Если нет маркеров, просто очищаем декорации и выходим
    if (!markers || markers.length === 0) {
      return;
    }
    
    try {
      // Создаем декорации для каждого маркера
      const errorDecorations = markers.map((marker: any) => {
        const isError = marker.severity === window.monaco.MarkerSeverity.Error;
        const isWarning = marker.severity === window.monaco.MarkerSeverity.Warning;
        
        // Определяем класс для декорации
        let className, glyphClassName, inlineClassName;
        if (isError) {
          className = 'error-decoration';
          glyphClassName = 'error-glyph';
          inlineClassName = 'squiggly-error';
        } else if (isWarning) {
          className = 'warning-decoration';
          glyphClassName = 'warning-glyph';
          inlineClassName = 'squiggly-warning';
        } else {
          className = 'info-decoration';
          glyphClassName = 'info-glyph';
          inlineClassName = 'squiggly-info';
        }
        
        return {
          range: new window.monaco.Range(
            marker.startLineNumber,
            marker.startColumn,
            marker.endLineNumber,
            marker.endColumn
          ),
          options: {
            className: className,
            hoverMessage: { value: marker.message },
            inlineClassName: inlineClassName,
            glyphMarginClassName: glyphClassName,
            stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            overviewRuler: {
              color: isError ? 'red' : isWarning ? 'orange' : 'blue',
              position: window.monaco.editor.OverviewRulerLane.Right
            }
          }
        };
      });
      
      // Применяем новые декорации
      editor._errorDecorationIds = editor.deltaDecorations([], errorDecorations);
      
      // Добавляем подсветку строк с ошибками/предупреждениями
      const lineDecorations = markers.map((marker: any) => {
        const isError = marker.severity === window.monaco.MarkerSeverity.Error;
        return {
          range: new window.monaco.Range(
            marker.startLineNumber,
            1,
            marker.startLineNumber,
            model.getLineMaxColumn(marker.startLineNumber)
          ),
          options: {
            isWholeLine: true,
            className: isError ? 'current-line-error' : 'current-line-warning',
            stickiness: window.monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        };
      });
      
      // Применяем декорации строк
      editor._errorLineDecorationIds = editor.deltaDecorations([], lineDecorations);
      
      // Принудительно перерисовываем редактор
      setTimeout(() => {
        editor.render(true);
        editor.layout();
      }, 100);
    } catch (err) {
      console.error('Ошибка при создании декораций:', err);
    }
  } catch (error) {
    console.error('Ошибка при настройке декораций:', error);
  }
}

/**
 * Принудительно обновляет декорации ошибок во всех редакторах
 */
export function forceUpdateAllDecorations(): void {
  try {
    console.log('Принудительное обновление всех декораций ошибок');
    const editors = window.monaco.editor.getEditors();
    
    if (editors && editors.length > 0) {
      console.log(`Найдено ${editors.length} редакторов для обновления декораций`);
      
      editors.forEach((editor: any) => {
        if (editor && editor.getModel && editor.getModel()) {
          setupErrorDecorations(editor);
        }
      });
    } else {
      console.log('Не найдено редакторов для обновления декораций');
    }
  } catch (error) {
    console.error('Ошибка при обновлении всех декораций:', error);
  }
}

/**
 * Добавляет стили для отображения ошибок в DOM
 */
function addErrorStyles(): void {
  if (!document.getElementById('error-styles-forced')) {
    const styles = document.createElement('style');
    styles.id = 'error-styles-forced';
    styles.innerHTML = `
      /* Улучшенные стили для отображения ошибок */
      .monaco-editor .squiggly-error {
        background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%23ff1212'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
        border-bottom: 2px wavy #ff0000 !important;
      }
      .monaco-editor .squiggly-warning {
        background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%23ffa500'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
        border-bottom: 2px wavy #ffa500 !important;
      }
      .monaco-editor .squiggly-info {
        background: url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%206%203'%20enable-background%3D'new%200%200%206%203'%20height%3D'3'%20width%3D'6'%3E%3Cg%20fill%3D'%2375beff'%3E%3Cpolygon%20points%3D'5.5%2C0%202.5%2C3%201.1%2C3%204.1%2C0'%2F%3E%3Cpolygon%20points%3D'4%2C0%206%2C2%206%2C0.6%205.4%2C0'%2F%3E%3Cpolygon%20points%3D'0%2C2%201%2C3%202.4%2C3%200%2C0.6'%2F%3E%3C%2Fg%3E%3C%2Fsvg%3E") repeat-x bottom left !important;
        border-bottom: 2px wavy #75beff !important;
      }
      
      /* Стили для заметных ошибок и предупреждений */
      .monaco-editor .error-decoration {
        background-color: rgba(255, 0, 0, 0.2) !important;
        border-left: 4px solid red !important;
      }
      .monaco-editor .warning-decoration {
        background-color: rgba(255, 166, 0, 0.2) !important;
        border-left: 4px solid orange !important;
      }
      
      /* Стили для гильфов (значков на полях) */
      .monaco-editor .error-glyph {
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="red"/><path d="M8 4v5M8 11v1" stroke="white" stroke-width="1.5" /></svg>') !important;
        background-size: cover !important;
        margin-left: 5px !important;
      }
      .monaco-editor .warning-glyph {
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M7.5 2L1 13h13L7.5 2z" fill="orange"/><path d="M7.5 6v4M7.5 12v1" stroke="white" stroke-width="1.5" /></svg>') !important;
        background-size: cover !important;
        margin-left: 5px !important;
      }
      
      /* Добавляем подсветку строк */
      .current-line-error {
        background-color: rgba(255, 0, 0, 0.1) !important;
      }
      .current-line-warning {
        background-color: rgba(255, 165, 0, 0.1) !important;
      }
    `;
    document.head.appendChild(styles);
  }
}

// Добавляем типы для window
declare global {
  interface Window {
    monaco: any;
    setupErrorDecorations?: (editor: any) => void;
    forceUpdateAllDecorations?: () => void;
  }
}

// Регистрируем функции в глобальной области видимости
if (typeof window !== 'undefined') {
  window.setupErrorDecorations = setupErrorDecorations;
  window.forceUpdateAllDecorations = forceUpdateAllDecorations;
  console.log('✅ Зарегистрированы функции обработки ошибок в редакторе');
} 