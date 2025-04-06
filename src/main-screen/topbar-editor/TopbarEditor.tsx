import React, { useState, useEffect } from 'react';
import { getFileIcon } from '../leftBar/fileIcons';
import FileTabContextMenu from './FileTabContextMenu';
import { invoke } from '@tauri-apps/api/core';
import { Pin } from 'lucide-react';

import './TopbarEditor.css';

// Extend the base interface with properties required by SortableJS
interface FileItem {
  name: string;
  path: string;
  icon: string;
  isFolder?: boolean;
  isPinned?: boolean;
}

interface TopbarEditorProps {
  openedFiles: FileItem[];
  activeFile: string | null;
  setSelectedFile: (filePath: string | null) => void;
  closeFile: (filePath: string) => void;
}

const TopbarEditor: React.FC<TopbarEditorProps> = ({
  openedFiles,
  activeFile,
  setSelectedFile,
  closeFile
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    filePath: string;
  } | null>(null);
  
  const [orderedFiles, setOrderedFiles] = useState<FileItem[]>([]);
  const [pinnedFiles, setPinnedFiles] = useState<Set<string>>(new Set());
  
  // Обновляем orderedFiles когда меняется openedFiles
  useEffect(() => {
    if (orderedFiles.length === 0) {
      // Initial load
      setOrderedFiles([...openedFiles]);
    } else {
      // Update while preserving order
      const existingPaths = new Set(orderedFiles.map(file => file.path));
      const newFiles = openedFiles.filter(file => !existingPaths.has(file.path));
      
      // Remove files that no longer exist in openedFiles
      const currentPaths = new Set(openedFiles.map(file => file.path));
      const updatedOrderedFiles = orderedFiles.filter(file => currentPaths.has(file.path));
      
      // Сортируем так, чтобы закрепленные файлы были в начале
      const sortedFiles = [...updatedOrderedFiles, ...newFiles].sort((a, b) => {
        const isPinnedA = pinnedFiles.has(a.path);
        const isPinnedB = pinnedFiles.has(b.path);
        
        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;
        return 0;
      });
      
      setOrderedFiles(sortedFiles);
    }
  }, [openedFiles, pinnedFiles]);

  const activeFilePath = openedFiles.find(file => file.path === activeFile)?.path || '';
  
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
    <div className="topbar-editor">      
      <div className="tabs-container">
        {orderedFiles.map((file) => {
          const isPinned = pinnedFiles.has(file.path);
          return (
            <div
              key={file.path}
              className={`tab ${activeFile === file.path ? 'active' : ''} ${isPinned ? 'pinned' : ''}`}
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
              <span className="tab-name">{file.name}</span>
              
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
        })}
      </div>
      
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