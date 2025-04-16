import React, { useRef, useEffect } from 'react';

// Объявляем интерфейс для пропсов компонента
interface EditorManagerProps {
  value?: string;
  language?: string;
  theme?: string;
  onChange?: (value: string) => void;
  editorRef?: React.RefObject<any>;
  onMount?: (editor: any, monaco: any) => void;
}

/**
 * Компонент для управления редактором Monaco Editor
 */
const EditorManager: React.FC<EditorManagerProps> = (props) => {
  const localEditorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Создаем редактор при монтировании компонента
  useEffect(() => {
    if (containerRef.current && !localEditorRef.current && window.monaco) {
      const editor = window.monaco.editor.create(containerRef.current, {
        value: props.value || '',
        language: props.language || 'javascript',
        theme: props.theme || 'vs-dark',
        automaticLayout: true,
        glyphMargin: true, // Включаем отображение глифов для ошибок
        minimap: { enabled: true }
      });
      
      localEditorRef.current = editor;
      
      // Вызываем handleEditorDidMount с созданным редактором
      handleEditorDidMount(editor, window.monaco, props);
      
      // Обработчик изменений значения
      editor.onDidChangeModelContent(() => {
        if (props.onChange) {
          props.onChange(editor.getValue());
        }
      });
      
      // Инициализация - обновляем декорации для всех файлов один раз при загрузке
      if (window.setupAllErrorDecorations && typeof window.setupAllErrorDecorations === 'function') {
        setTimeout(() => {
          window.setupAllErrorDecorations();
        }, 1000);
      }
      
      // Очистка редактора при размонтировании
      return () => {
        if (localEditorRef.current) {
          localEditorRef.current.dispose();
          localEditorRef.current = null;
        }
      };
    }
  }, [props.value, props.language, props.theme, props.onChange]);
  
  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

/**
 * Обработчик монтирования редактора
 */
const handleEditorDidMount = (
  editor: any, 
  monaco: any,
  props: EditorManagerProps
) => {
  // Если есть внешний ref для редактора, присваиваем ему экземпляр редактора
  if (props.editorRef) {
    props.editorRef.current = editor;
  }
  
  // Настраиваем отображение ошибок
  if (window.setupErrorDecorations) {
    // Вызываем сразу при монтировании
    window.setupErrorDecorations(editor);
    
    // И затем по таймеру с интервалом
    const errorUpdateInterval = setInterval(() => {
      if (window.setupErrorDecorations && editor && editor.getModel()) {
        window.setupErrorDecorations(editor);
      } else if (!editor || !editor.getModel()) {
        clearInterval(errorUpdateInterval);
      }
    }, 5000); // Обновляем каждые 5 секунд
    
    // Сохраняем ID интервала для последующей очистки
    editor._errorUpdateInterval = errorUpdateInterval;
    
    // Очищаем интервал при размонтировании редактора
    editor.onDidDispose(() => {
      if (editor._errorUpdateInterval) {
        clearInterval(editor._errorUpdateInterval);
        editor._errorUpdateInterval = null;
      }
      if (editor._modelChangeDisposable) {
        editor._modelChangeDisposable.dispose();
        editor._modelChangeDisposable = null;
      }
    });
    
    // Обработчик смены модели - важно для переключения между файлами
    editor._modelChangeDisposable = editor.onDidChangeModel(() => {
      // При смене модели сначала собираем все маркеры
      if (window.setupAllErrorDecorations && typeof window.setupAllErrorDecorations === 'function') {
        setTimeout(() => {
          window.setupAllErrorDecorations();
        }, 300);
      } 
      // Резервный вариант, если функция setupAllErrorDecorations недоступна
      else if (window.setupErrorDecorations && typeof window.setupErrorDecorations === 'function') {
        setTimeout(() => {
          window.setupErrorDecorations(editor);
        }, 500);
      }
    });
  }
  
  // Принудительно обновляем все декорации для всех редакторов по интервалу
  if (window.forceUpdateAllDecorations) {
    const decorationsInterval = setInterval(() => {
      if (window.forceUpdateAllDecorations) {
        window.forceUpdateAllDecorations();
      }
    }, 10000); // Каждые 10 секунд
    
    // Сохраняем ID интервала
    editor._decorationsInterval = decorationsInterval;
    
    // Очищаем интервал при размонтировании редактора
    editor.onDidDispose(() => {
      if (editor._decorationsInterval) {
        clearInterval(editor._decorationsInterval);
        editor._decorationsInterval = null;
      }
    });
  }
  
  // Вызываем оригинальный обработчик, если он был
  if (props.onMount) {
    props.onMount(editor, monaco);
  }
  
  // Подписываемся на событие активации редактора
  editor.onDidFocusEditorWidget(() => {
    // При получении фокуса обновляем все декорации
    if (window.setupAllErrorDecorations && typeof window.setupAllErrorDecorations === 'function') {
      window.setupAllErrorDecorations();
    } else if (window.forceUpdateAllDecorations) {
      window.forceUpdateAllDecorations();
    }
  });
};

// Добавляем типы для window
declare global {
  interface Window {
    monaco: any;
    setupErrorDecorations?: (editor: any) => void;
    setupAllErrorDecorations?: () => void;
    forceUpdateAllDecorations?: () => void;
  }
}

export default EditorManager; 