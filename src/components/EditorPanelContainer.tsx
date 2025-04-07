import React, { useState, useEffect, useRef } from 'react';
import EditorPanel from './EditorPanel';
import { FileItem } from '../types';
import { X } from 'lucide-react';
import './EditorPanel.css';

// Расширение интерфейса FileItem для внутреннего использования в компоненте
interface ExtendedFileItem extends FileItem {
  icon?: string;
}

type ActiveEditorType = 'primary' | 'secondary';

interface EditorPanelContainerProps {
  openedFiles: ExtendedFileItem[];
  activeFile: string | null;
  setSelectedFile: (filePath: string | null) => void;
  closeFile: (filePath: string) => void;
  handleCreateFile: () => void;
  selectedFolder: string | null;
  setSelectedFolder: (path: string | null) => void;
  onEditorInfoChange?: (info: any) => void;
  onIssuesChange?: (issues: any) => void;
  onDebugStart?: (filePath: string) => void;
  onSplitEditor?: (filePath: string) => void;
  isSplitView?: boolean;
  secondaryFile?: string | null;
  setOpenedFiles: (files: ExtendedFileItem[] | ((prev: ExtendedFileItem[]) => ExtendedFileItem[])) => void;
}

const EditorPanelContainer: React.FC<EditorPanelContainerProps> = ({
  openedFiles,
  activeFile,
  setSelectedFile,
  closeFile,
  handleCreateFile,
  selectedFolder,
  setSelectedFolder,
  onEditorInfoChange,
  onIssuesChange,
  onDebugStart,
  onSplitEditor,
  isSplitView: externalIsSplitView,
  secondaryFile: externalSecondaryFile,
  setOpenedFiles
}) => {
  // Используем локальные состояния с синхронизацией с пропсами
  const [secondaryFile, setSecondaryFile] = useState<string | null>(externalSecondaryFile || null);
  const [isSplitView, setIsSplitView] = useState(externalIsSplitView || false);
  const [activeEditor, setActiveEditor] = useState<ActiveEditorType>('primary');
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const secondaryRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [initialPos, setInitialPos] = useState(0);
  const [primaryWidth, setPrimaryWidth] = useState(50); // процент

  // Синхронизируем локальные состояния с пропсами
  useEffect(() => {
    if (externalSecondaryFile !== undefined) {
      setSecondaryFile(externalSecondaryFile);
    }
  }, [externalSecondaryFile]);
  
  useEffect(() => {
    if (externalIsSplitView !== undefined) {
      setIsSplitView(externalIsSplitView);
    }
  }, [externalIsSplitView]);

  // Закрыть второй редактор
  const handleCloseSecondaryEditor = () => {
    setIsSplitView(false);
    setSecondaryFile(null);
    setActiveEditor('primary');
    
    // Уведомляем родительский компонент об изменении режима разделения
    if (onSplitEditor && activeFile) {
      // Передаем текущий активный файл, чтобы родитель знал, какой файл остается активным
      onSplitEditor(activeFile);
    }
  };

  // Улучшенный обработчик для кнопки разделения
  const handleSplitEditor = (filePath: string) => {
    console.log(`EditorPanelContainer: Запрос на разделение с файлом ${filePath}`);
    
    // Устанавливаем режим разделения и выбираем файл для второго редактора
    setIsSplitView(true);
    setSecondaryFile(filePath);
    
    // Вызываем внешний обработчик, если он предоставлен
    if (onSplitEditor) {
      onSplitEditor(filePath);
    }
    
    // Если файл не открыт, добавляем его в список открытых файлов
    const fileExists = openedFiles.some(file => file.path === filePath);
    if (!fileExists) {
      // Получаем имя файла из пути
      const fileName = filePath.split(/[/\\]/).pop() || '';
      console.log(`Добавляем файл ${fileName} в список открытых файлов`);
      
      // Добавляем файл в список открытых с защитой от дублирования
      setOpenedFiles(prev => {
        // Проверяем, что файл ещё не добавлен (дополнительная защита)
        if (prev.some(file => file.path === filePath)) {
          console.log(`Файл ${filePath} уже существует в списке открытых файлов`);
          return prev;
        }
        
        return [...prev, { 
          name: fileName, 
          path: filePath,
          isFolder: false,
          icon: 'file',
        }];
      });
    }
    
    // Устанавливаем вторичный редактор как активный после разделения
    setActiveEditor('secondary');
  };
  
  // Обработчик для выбора файла в основном редакторе с дополнительной защитой
  const handlePrimaryFileSelect = (filePath: string | null) => {
    console.log(`EditorPanelContainer: Выбор файла ${filePath} в основном редакторе`);
    
    // Если путь валиден и файл не существует в списке, добавляем его
    if (filePath && !openedFiles.some(file => file.path === filePath)) {
      // Получаем имя файла из пути
      const fileName = filePath.split(/[/\\]/).pop() || '';
      console.log(`Автоматически добавляем файл ${fileName} в список открытых файлов`);
      
      // Безопасно добавляем файл в список открытых
      setOpenedFiles(prev => [...prev, { 
        name: fileName, 
        path: filePath,
        isFolder: false,
        icon: 'file',
      }]);
    }
    
    // Вызываем внешний обработчик выбора файла
    setSelectedFile(filePath);
    
    // Убеждаемся, что активный редактор - первичный
    setActiveEditor('primary');
  };
  
  // Обработчик для выбора файла во вторичном редакторе с дополнительной защитой
  const handleSecondaryFileSelect = (filePath: string | null) => {
    console.log(`EditorPanelContainer: Выбор файла ${filePath} во вторичном редакторе`);
    
    // Обновляем внутреннее состояние
    setSecondaryFile(filePath);
    
    // Если путь валиден и файл не существует в списке, добавляем его
    if (filePath && !openedFiles.some(file => file.path === filePath)) {
      // Получаем имя файла из пути
      const fileName = filePath.split(/[/\\]/).pop() || '';
      console.log(`Автоматически добавляем файл ${fileName} в список открытых файлов`);
      
      // Безопасно добавляем файл в список открытых
      setOpenedFiles(prev => [...prev, { 
        name: fileName, 
        path: filePath,
        isFolder: false,
        icon: 'file',
      }]);
    }
    
    // Убеждаемся, что активный редактор - вторичный
    setActiveEditor('secondary');
  };

  // Обработчики для изменения размера панелей
  const handleResizerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
    setInitialPos(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const delta = e.clientX - initialPos;
    const currentPrimaryWidth = primaryRef.current?.offsetWidth || 0;
    
    // Рассчитываем новую ширину в процентах
    const newPrimaryWidthPercent = ((currentPrimaryWidth + delta) / containerWidth) * 100;
    
    // Ограничиваем минимальную и максимальную ширину (20% - 80%)
    const boundedWidth = Math.min(Math.max(newPrimaryWidthPercent, 20), 80);
    
    setPrimaryWidth(boundedWidth);
    setInitialPos(e.clientX);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Добавляем и удаляем обработчики событий
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, initialPos]);

  // Устанавливаем ширину панелей
  useEffect(() => {
    if (primaryRef.current && primaryRef.current.style) {
      primaryRef.current.style.width = `${primaryWidth}%`;
    }
    
    if (secondaryRef.current && secondaryRef.current.style) {
      secondaryRef.current.style.width = `${100 - primaryWidth}%`;
    }
    
    if (resizerRef.current && resizerRef.current.style) {
      resizerRef.current.style.left = `${primaryWidth}%`;
    }
  }, [primaryWidth, isSplitView]);

  return (
    <div className={`editor-panel-container ${isSplitView ? 'split-view' : ''}`} ref={containerRef}>
      <div 
        className={`primary-editor ${activeEditor === 'primary' ? 'active-editor' : ''}`} 
        ref={primaryRef}
        onClick={() => setActiveEditor('primary')}
      >
        <EditorPanel 
          openedFiles={openedFiles}
          activeFile={activeFile}
          setSelectedFile={handlePrimaryFileSelect}
          closeFile={closeFile}
          handleCreateFile={handleCreateFile}
          selectedFolder={selectedFolder}
          setSelectedFolder={setSelectedFolder}
          onEditorInfoChange={onEditorInfoChange}
          onIssuesChange={onIssuesChange}
          onDebugStart={onDebugStart}
          onSplitEditor={handleSplitEditor}
          setOpenedFiles={setOpenedFiles}
        />
      </div>
      
      {isSplitView && (
        <div 
          className={`editor-resizer ${isResizing ? 'resizing' : ''}`} 
          ref={resizerRef}
          onMouseDown={handleResizerMouseDown}
        />
      )}
      
      {isSplitView && secondaryFile && (
        <div 
          className={`secondary-editor ${activeEditor === 'secondary' ? 'active-editor' : ''}`} 
          ref={secondaryRef}
          onClick={() => setActiveEditor('secondary')}
        >
          <button 
            className="close-secondary-button"
            onClick={handleCloseSecondaryEditor}
            title="Закрыть второй редактор"
          >
            <X size={16} />
          </button>
          <EditorPanel 
            openedFiles={openedFiles}
            activeFile={secondaryFile}
            setSelectedFile={handleSecondaryFileSelect}
            closeFile={closeFile}
            handleCreateFile={handleCreateFile}
            selectedFolder={selectedFolder}
            setSelectedFolder={setSelectedFolder}
            onEditorInfoChange={(info) => {
              // Для второго редактора мы игнорируем обновления информации
              console.log('Вторичная информация об редакторе:', info);
            }}
            onIssuesChange={(issues) => {
              // Для второго редактора мы можем игнорировать сообщения об ошибках
              console.log('Вторичные проблемы:', issues);
            }}
            onDebugStart={onDebugStart}
            onSplitEditor={handleSplitEditor}
            setOpenedFiles={setOpenedFiles}
          />
        </div>
      )}
    </div>
  );
};

export default EditorPanelContainer; 