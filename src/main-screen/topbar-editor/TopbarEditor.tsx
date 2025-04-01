import React, { useState } from 'react';
import { getFileIcon } from '../leftBar/fileIcons';
import FileTabContextMenu from './FileTabContextMenu';
import { invoke } from '@tauri-apps/api/core';

import './TopbarEditor.css';

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
  const activeFilePath = openedFiles.find(file => file.path === activeFile)?.path || '';
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
      const currentIndex = openedFiles.findIndex(file => file.path === contextMenu.filePath);
      openedFiles.slice(currentIndex + 1).forEach(file => {
        closeFile(file.path);
      });
      handleCloseContextMenu();
    }
  };

  const handleCloseLeft = () => {
    if (contextMenu) {
      const currentIndex = openedFiles.findIndex(file => file.path === contextMenu.filePath);
      openedFiles.slice(0, currentIndex).forEach(file => {
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
      await invoke('copy_to_clipboard', { text: contextMenu.filePath });
      handleCloseContextMenu();
    }
  };

  const handleCopyRelativePath = async () => {
    if (contextMenu) {
      // TODO: Implement relative path calculation
      handleCloseContextMenu();
    }
  };

  const handleOpenInExplorer = async () => {
    if (contextMenu) {
      await invoke('open_in_explorer', { path: contextMenu.filePath });
      handleCloseContextMenu();
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
        {openedFiles.map((file) => (
          <div
            key={file.path}
            className={`tab ${activeFile === file.path ? 'active' : ''}`}
            onClick={() => setSelectedFile(file.path)}
            onContextMenu={(e) => handleContextMenu(e, file.path)}
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
      {activeFile && (
        <div className="file-path">
          {activeFilePath}
        </div>
      )}
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
        />
      )}
    </div>
  );
};

export default TopbarEditor;