import React, { useState, useEffect } from 'react';
import { getFileIcon } from '../leftBar/fileIcons';
import FileTabContextMenu from './FileTabContextMenu';
import { invoke } from '@tauri-apps/api/core';

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
      
      setOrderedFiles([...updatedOrderedFiles, ...newFiles]);
    }
  }, [openedFiles]);

  const activeFilePath = openedFiles.find(file => file.path === activeFile)?.path || '';
  
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
      const projectRoot = '/home/user/project'; // получи это динамически в будущем
      const relativePath = contextMenu.filePath.replace(projectRoot + '/', '');
      
      try {
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
      // TODO: Implement pin/unpin logic
      handleCloseContextMenu();
    }
  };

  return (
    <div className="topbar-editor">      
      <div className="tabs-container">
        {orderedFiles.map((file) => (
          <div
            key={file.path}
            className={`tab ${activeFile === file.path ? 'active' : ''}`}
            onClick={() => setSelectedFile(file.path)}
            onContextMenu={(e) => handleContextMenu(e, file.path)}
            data-path={file.path}
          >
            <span className="tab-icon">
              {file.isFolder ? '📁' : getFileIcon(file.path)}
            </span>
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
        ))}
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
                  onPin={handlePin} filePath={''} relativePath={''}        />
      )}
    </div>
  );
};

export default TopbarEditor;