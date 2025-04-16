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
    }, 2000); // Обновляем каждые 2 секунды
    
    // Сохраняем ID интервала для последующей очистки
    editor._errorUpdateInterval = errorUpdateInterval;
    
    // Очищаем интервал при размонтировании редактора
    editor.onDidDispose(() => {
      if (editor._errorUpdateInterval) {
        clearInterval(editor._errorUpdateInterval);
        editor._errorUpdateInterval = null;
      }
    });
    
    // Обновляем декорации при изменении модели
    editor.onDidChangeModel(() => {
      if (window.setupErrorDecorations) {
        setTimeout(() => {
          if (window.setupErrorDecorations) {
            window.setupErrorDecorations(editor);
          }
        }, 500);
      }
    });
    
    // Также обновляем декорации при изменении содержимого
    editor.onDidChangeModelContent(() => {
      if (window.setupErrorDecorations) {
        setTimeout(() => {
          if (window.setupErrorDecorations) {
            window.setupErrorDecorations(editor);
          }
        }, 1000); // Более длинная задержка для изменений контента
      }
    });
    
    // Принудительно обновляем все декорации по интервалу
    const decorationsUpdateInterval = setInterval(() => {
      if (window.forceUpdateAllDecorations) {
        window.forceUpdateAllDecorations();
      }
    }, 5000); // Каждые 5 секунд обновляем все декорации
    
    // Сохраняем ID интервала для последующей очистки
    editor._decorationsUpdateInterval = decorationsUpdateInterval;
    
    // Очищаем интервал при размонтировании редактора
    editor.onDidDispose(() => {
      if (editor._decorationsUpdateInterval) {
        clearInterval(editor._decorationsUpdateInterval);
        editor._decorationsUpdateInterval = null;
      }
    });
  }
  
  // Вызываем оригинальный обработчик, если он был
  if (props.onMount) {
    props.onMount(editor, monaco);
  }
};

// Добавляем типы для window
declare global {
  interface Window {
    monaco: any;
    setupErrorDecorations?: (editor: any) => void;
    forceUpdateAllDecorations?: () => void;
  }
}

export default EditorManager; 