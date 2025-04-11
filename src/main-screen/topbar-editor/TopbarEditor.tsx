import React, { useState, useEffect } from 'react';
import { getFileIcon } from '../leftBar/fileIcons';
import FileTabContextMenu from './FileTabContextMenu';
import { invoke } from '@tauri-apps/api/core';
import { Pin, PinOff, Play } from 'lucide-react';

import './TopbarEditor.css';

// Extend the base interface with properties required by SortableJS
interface FileItem {
  name: string;
  path: string;
  icon: string;
  isFolder?: boolean;
  isPinned?: boolean;
  isModified?: boolean;
}

interface TopbarEditorProps {
  openedFiles: FileItem[];
  activeFile: string | null;
  setSelectedFile: (filePath: string | null) => void;
  closeFile: (filePath: string) => void;
  modifiedFiles?: Set<string>;
  onPreviewHtml?: (filePath: string) => void;
}

const TopbarEditor: React.FC<TopbarEditorProps> = ({
  openedFiles,
  activeFile,
  setSelectedFile,
  closeFile,
  modifiedFiles = new Set(),
  onPreviewHtml
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    filePath: string;
  } | null>(null);
  
  const [orderedFiles, setOrderedFiles] = useState<FileItem[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<Set<string>>(new Set());
  
  // Проверяем, является ли файл HTML
  const isHtmlFile = (filePath: string) => {
    return filePath?.toLowerCase().endsWith('.html') || filePath?.toLowerCase().endsWith('.htm');
  };
  
  // Обновляем orderedFiles когда меняется openedFiles или modifiedFiles
  useEffect(() => {
    if (openedFiles && openedFiles.length === 0) {
      setOrderedFiles([]);
      return;
    }
    
    if (orderedFiles.length === 0 && openedFiles && openedFiles.length > 0) {
      // Initial load
      setOrderedFiles([...openedFiles].map(file => ({
        ...file,
        isModified: modifiedFiles.has(file.path)
      })));
    } else {
      // Update while preserving order
      const existingPaths = new Set(orderedFiles.map(file => file.path));
      const newFiles = openedFiles.filter(file => !existingPaths.has(file.path));
      
      // Remove files that no longer exist in openedFiles
      const currentPaths = new Set(openedFiles.map(file => file.path));
      const updatedOrderedFiles = orderedFiles
        .filter(file => currentPaths.has(file.path))
        .map(file => ({
          ...file,
          isModified: modifiedFiles.has(file.path)
        }));
      
      // Добавляем новые файлы и помечаем модифицированные
      const newFilesWithModified = newFiles.map(file => ({
        ...file,
        isModified: modifiedFiles.has(file.path)
      }));
      
      // Сортируем так, чтобы закрепленные файлы были в начале
      const sortedFiles = [...updatedOrderedFiles, ...newFilesWithModified].sort((a, b) => {
        const isPinnedA = pinnedFiles.has(a.path);
        const isPinnedB = pinnedFiles.has(b.path);
        
        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;
        return 0;
      });
      
      setOrderedFiles(sortedFiles);
    }
  }, [openedFiles, pinnedFiles, modifiedFiles]);

  // Make sure activeFilePath is correctly calculated and doesn't cause issues
  const activeFilePath = openedFiles.find(file => file.path === activeFile)?.path || '';
  
  // Ensure we have some content to display in the status bar
  const activeFileName = activeFile ? activeFile.split(/[\/\\]/).pop() : '';
  
  // Log for debugging
  useEffect(() => {
    console.log('TopbarEditor rendered with openedFiles:', openedFiles?.length);
    console.log('ActiveFile:', activeFile);
  }, [openedFiles, activeFile]);
  
  // Check if the component is visible for debugging
  useEffect(() => {
    const element = document.querySelector('.topbar-editor');
    console.log('TopbarEditor element exists:', !!element);
  }, []);
  
  // Функция для переключения статуса закрепления
  const togglePin = (filePath: string) => {
    setPinnedFiles(prev => {
      const newPinnedFiles = new Set(prev);
      if (newPinnedFiles.has(filePath)) {
        newPinnedFiles.delete(filePath);
      } else {
        newPinnedFiles.add(filePath);
      }
      return newPinnedFiles;
    });
  };
  
  // Функция для открытия HTML предпросмотра
  const handlePreviewHtml = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>, filePath: string) => {
    e.stopPropagation();
    if (onPreviewHtml) {
      onPreviewHtml(filePath);
    }
  };
  
  // Функции для контекстного меню
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>, filePath: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      filePath
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleCloseTab = () => {
    if (contextMenu) {
      closeFile(contextMenu.filePath);
      handleCloseContextMenu();
    }
  };

  const handleCloseOthers = () => {
    if (contextMenu) {
      const currentFile = contextMenu.filePath;
      openedFiles.forEach(file => {
        if (file.path !== currentFile) {
          closeFile(file.path);
        }
      });
      handleCloseContextMenu();
    }
  };

  const handleCloseRight = () => {
    if (contextMenu) {
      const currentIndex = orderedFiles.findIndex(file => file.path === contextMenu.filePath);
      orderedFiles.slice(currentIndex + 1).forEach(file => {
        closeFile(file.path);
      });
      handleCloseContextMenu();
    }
  };

  const handleCloseLeft = () => {
    if (contextMenu) {
      const currentIndex = orderedFiles.findIndex(file => file.path === contextMenu.filePath);
      orderedFiles.slice(0, currentIndex).forEach(file => {
        closeFile(file.path);
      });
      handleCloseContextMenu();
    }
  };

  const handleCloseAll = () => {
    openedFiles.forEach(file => {
      closeFile(file.path);
    });
    handleCloseContextMenu();
  };

  const handleCloseSaved = () => {
    // TODO: Implement close saved files logic
    handleCloseContextMenu();
  };

  const handleCopyPath = async () => {
    if (contextMenu) {
      try {
        await navigator.clipboard.writeText(contextMenu.filePath);
        handleCloseContextMenu();
        alert('Путь скопирован в буфер обмена');
      } catch (err) {
        console.error('Ошибка при копировании пути: ', err);
      }
    }
  };
  
  const handleCopyRelativePath = async () => {
    if (contextMenu) {
      try {
        // Получаем корень проекта через Tauri API
        const projectRoot = await invoke('get_project_root', { 
          currentFilePath: contextMenu.filePath
        }) as string;
        
        if (!projectRoot) {
          throw new Error('Не удалось определить корень проекта');
        }
        
        let relativePath = contextMenu.filePath;
        
        // Проверяем, содержится ли путь проекта в пути файла
        if (contextMenu.filePath.startsWith(projectRoot)) {
          // Вырезаем корень проекта из пути файла, чтобы получить относительный путь
          relativePath = contextMenu.filePath.substring(projectRoot.length);
          
          // Удаляем начальные слэши или бэкслэши, если они есть
          relativePath = relativePath.replace(/^[/\\]+/, '');
        }
        
        await navigator.clipboard.writeText(relativePath);
        handleCloseContextMenu();
        alert('Относительный путь скопирован в буфер обмена');
      } catch (err) {
        console.error('Ошибка при копировании относительного пути: ', err);
      }
    }
  };
  
  const handleOpenInExplorer = async () => {
    if (contextMenu) {
      try {
        await invoke('open_in_explorer', { path: contextMenu.filePath });
        handleCloseContextMenu();
      } catch (err) {
        console.error('Ошибка при открытии в проводнике: ', err);
      }
    }
  };
  
  const handlePin = () => {
    if (contextMenu) {
      togglePin(contextMenu.filePath);
      handleCloseContextMenu();
    }
  };

  return (
    <div className="topbar-editor" style={{ zIndex: 1000, position: 'relative' }}>      
      <div className="tabs-container">
        {orderedFiles.length > 0 ? (
          orderedFiles.map((file) => {
            const isPinned = pinnedFiles.has(file.path);
            const isModified = file.isModified || modifiedFiles.has(file.path);
            const showPreviewButton = isHtmlFile(file.path) && onPreviewHtml;
            
            return (
              <div
                key={file.path}
                className={`tab ${activeFile === file.path ? 'active' : ''} ${isPinned ? 'pinned' : ''} ${isModified ? 'modified' : ''}`}
                onClick={() => setSelectedFile(file.path)}
                onContextMenu={(e) => handleContextMenu(e, file.path)}
                data-path={file.path}
              >
                <span className="tab-icon">
                  {file.isFolder ? '📁' : getFileIcon(file.path)}
                </span>
                {isPinned && (
                  <button
                    className="pin-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(file.path);
                    }}
                    title="Открепить"
                  >
                    <Pin size={14} strokeWidth={2} />
                  </button>
                )}
                <span className="tab-name">
                  {file.name}
                  {isModified && <span className="tab-modified-indicator">●</span>}
                </span>
                
                <button
                  className="close-tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFile(file.path);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        ) : (
          <div className="empty-tabs-message">Нет открытых файлов</div>
        )}
      </div>

      {/* Preview button placed outside of tabs */}
      {activeFile && isHtmlFile(activeFile) && onPreviewHtml && (
        <button
          className="preview-button-standalone"
          onClick={(e) => onPreviewHtml(activeFile)}
          title="Предпросмотр HTML"
        >
          <Play size={16} strokeWidth={2} />
        </button>
      )}
      
      {/* Строка статуса */}
      <div className="status-bar">
        <div className="file-path">
          {activeFilePath}
        </div>
      </div>
      
      {contextMenu && (
        <FileTabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onCloseTab={handleCloseTab}
          onCloseOthers={handleCloseOthers}
          onCloseRight={handleCloseRight}
          onCloseLeft={handleCloseLeft}
          onCloseAll={handleCloseAll}
          onCloseSaved={handleCloseSaved}
          onCopyPath={handleCopyPath}
          onCopyRelativePath={handleCopyRelativePath}
          onOpenInExplorer={handleOpenInExplorer}
          onPin={handlePin}
          filePath={contextMenu.filePath}
          relativePath={''}
          isPinned={pinnedFiles.has(contextMenu.filePath)}
        />
      )}
    </div>
  );
};

export default TopbarEditor;