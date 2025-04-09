import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { invoke } from '@tauri-apps/api/core';

import "./style.css";

interface FileContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onOpenInSidebar?: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onSetSelectedFile?: (path: string) => void;
  workspaceRoot?: string;
  onSetTerminalPath?: (path: string) => void;
  onCreateFile?: (path: string) => void;
  onCreateDirectory?: (path: string) => void;
  ext?: string;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({ 
  x, 
  y, 
  path, 
  onClose,
  onOpenInSidebar,
  onRename,
  onDelete,
  onSetSelectedFile,
  workspaceRoot = "",
  onSetTerminalPath,
  onCreateFile,
  onCreateDirectory,
  ext
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Функция обработки клика вне меню
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Функция обработки клавиатурных событий
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Ctrl+O - открыть в сайдбаре
      if (e.ctrlKey && e.shiftKey && e.key === 'O') {
        handleOpenInSidebar(e);
        return;
      }

      // F2 - переименовать
      if (e.key === 'F2') {
        handleRename(e);
        return;
      }

      // Delete - удалить
      if (e.key === 'Delete') {
        handleDelete(e);
        return;
      }

      // Ctrl+E - открыть в проводнике
      if (e.ctrlKey && e.key === 'e') {
        handleOpenInExplorer(e);
        return;
      }

      // Ctrl+T - открыть в терминале
      if (e.ctrlKey && e.key === 't') {
        handleOpenInTerminal(e);
        return;
      }

      // Ctrl+X - вырезать
      if (e.ctrlKey && e.key === 'x') {
        handleCut(e);
        return;
      }

      // Ctrl+C - копировать
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'c') {
        handleCopy(e);
        return;
      }

      // Ctrl+Shift+C - копировать путь
      if (e.ctrlKey && e.shiftKey && !e.altKey && e.key === 'c') {
        handleCopyPath(e);
        return;
      }

      // Ctrl+Alt+C - копировать относительный путь
      if (e.ctrlKey && !e.shiftKey && e.altKey && e.key === 'c') {
        handleCopyRelativePath(e);
        return;
      }

      // Alt+N или Ctrl+N - создать файл
      if ((e.altKey || e.ctrlKey) && !e.shiftKey && (e.key === "n" || e.key === "N")) {
        handleCreateFile(e);
        return;
      }

      // Alt+D - создать папку
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        handleCreateDirectory(e);
        return;
      }
      
      // Ctrl+Shift+N - создать папку
      if (e.ctrlKey && e.shiftKey && !e.altKey && (e.key === 'N' || e.key === 'n')) {
        handleCreateDirectory(e);
        return;
      }
    };

    // Добавляем обработчики событий
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Фокусируем меню для обработки клавиатурных событий
    if (menuRef.current) {
      menuRef.current.focus();
    }

    // Удаляем обработчики при размонтировании
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, path, workspaceRoot, onCreateFile, onCreateDirectory, onRename, onDelete, onSetTerminalPath]);

  // Функция для копирования текста в буфер обмена
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text to clipboard', err);
    }
  };

  // Обработчики действий
  const handleOpenInSidebar = (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    if (onOpenInSidebar) {
      onOpenInSidebar(path);
    } else if (onSetSelectedFile) {
      onSetSelectedFile(path);
    }
    onClose();
  };

  const handleOpenInExplorer = async (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    try {
      await invoke('open_in_explorer', { path });
    } catch (error) {
      console.error('Failed to open in explorer:', error);
    }
    onClose();
  };

  const handleOpenInTerminal = (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    if (onSetTerminalPath) {
      onSetTerminalPath(path);
    }
    onClose();
  };

  const handleCut = async (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    try {
      // Сохраняем информацию о том, что это операция вырезания
      localStorage.setItem('clipboard-action', 'cut');
      localStorage.setItem('clipboard-path', path);
      // Для совместимости с системным буфером обмена
      await copyToClipboard(path);
    } catch (error) {
      console.error('Failed to cut file:', error);
    }
    onClose();
  };

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    try {
      // Сохраняем информацию о том, что это операция копирования
      localStorage.setItem('clipboard-action', 'copy');
      localStorage.setItem('clipboard-path', path);
      // Для совместимости с системным буфером обмена
      await copyToClipboard(path);
    } catch (error) {
      console.error('Failed to copy file:', error);
    }
    onClose();
  };

  const handleCopyPath = async (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    try {
      await copyToClipboard(path);
    } catch (error) {
      console.error('Failed to copy path:', error);
    }
    onClose();
  };

  const handleCopyRelativePath = async (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    try {
      // Если задан корень рабочего пространства, получаем относительный путь
      let relativePath = path;
      if (workspaceRoot) {
        relativePath = path.replace(workspaceRoot, '').replace(/^[\/\\]/, '');
      }
      await copyToClipboard(relativePath);
    } catch (error) {
      console.error('Failed to copy relative path:', error);
    }
    onClose();
  };

  const handleRename = (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    if (onRename) {
      onRename(path);
    }
    onClose();
  };

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    if (onDelete) {
      onDelete(path);
    }
    onClose();
  };

  const handleCreateFile = (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    if (onCreateFile) {
      onCreateFile(path);
    }
    onClose();
  };

  const handleCreateDirectory = (e: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    if (e instanceof MouseEvent) e.stopPropagation();
    if (onCreateDirectory) {
      onCreateDirectory(path);
    }
    onClose();
  };

  // Создаем контент меню
  const menuContent = (
    <div
      ref={menuRef}
      className="context-menu-left2"
      style={{ 
        top: y, 
        left: x, 
        position: 'fixed', 
        zIndex: 2147483647 // Максимально возможный z-index
      }}
      tabIndex={0} // Добавлено для возможности получать фокус
    >
      <button onClick={handleOpenInSidebar}>
        Открыть сбоку <span className="shortcut">Ctrl+Shift+O</span>
      </button>
      <button onClick={handleOpenInExplorer}>
        Открыть в проводнике <span className="shortcut">Ctrl+E</span>
      </button>
      <button onClick={handleOpenInTerminal}>
        Открыть в терминале <span className="shortcut">Ctrl+T</span>
      </button>
      <div className="seperator"></div>
      <button onClick={handleCut}>
        Вырезать <span className="shortcut">Ctrl+X</span>
      </button>
      <button onClick={handleCopy}>
        Копировать <span className="shortcut">Ctrl+C</span>
      </button>
      <div className="seperator"></div>
      <button onClick={handleCopyPath}>
        Копировать путь <span className="shortcut">Ctrl+Shift+C</span>
      </button>
      <button onClick={handleCopyRelativePath}>
        Копировать относительный путь <span className="shortcut">Ctrl+Alt+C</span>
      </button>
      <div className="seperator"></div>
      <button onClick={handleRename}>
        Переименовать <span className="shortcut">F2</span>
      </button>
      <button onClick={handleDelete}>
        Удалить <span className="shortcut">Del</span>
      </button>
      <button onClick={handleCreateFile}>
        Создать файл <span className="shortcut">Alt+N</span>
      </button>
      <button onClick={handleCreateDirectory}>
        Создать папку <span className="shortcut">Alt+D</span>
      </button>
    </div>
  );

  // Используем портал для рендеринга меню в конец body
  return ReactDOM.createPortal(menuContent, document.body as Element);
};

export default FileContextMenu;