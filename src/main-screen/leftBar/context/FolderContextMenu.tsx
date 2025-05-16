import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { invoke } from '@tauri-apps/api/core';
import CreateFolderModal from '../../../components/modal/CreateFolderModal';

import "./style.css";

interface FolderContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onCreateFile?: (path: string) => void;
  onCreateDirectory?: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  workspaceRoot?: string;
  onSetTerminalPath?: (path: string) => void;
  onReloadDirectory?: () => void;
}

const FolderContextMenu: React.FC<FolderContextMenuProps> = ({ 
  x, 
  y, 
  path, 
  onClose,
  onCreateFile,
  onCreateDirectory,
  onRename,
  onDelete,
  workspaceRoot = "",
  onSetTerminalPath,
  onReloadDirectory
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Добавляем слушатель событий при монтировании
    document.addEventListener('mousedown', handleClickOutside);
    
    // Добавляем обработчик клавиатурных событий
    const handleKeyDown = (event: KeyboardEvent) => {
      // Предотвращаем стандартное поведение для нужных сочетаний
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        case 'e':
        case 'E':
          if (event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            handleOpenInExplorer(event);
          }
          break;
        case 't':
        case 'T':
          if (event.ctrlKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            handleOpenInTerminal(event);
          }
          break;
        case 'n':
        case 'N':
          if ((event.ctrlKey && !event.shiftKey && !event.altKey) || 
              (event.altKey && !event.ctrlKey && !event.shiftKey)) {
            // Для Ctrl+N или Alt+N (но не для обоих одновременно)
            event.preventDefault();
            handleCreateFile(event);
          } else if ((event.ctrlKey && event.shiftKey && !event.altKey) || 
                    (event.altKey && !event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'd')) {
            // Для Ctrl+Shift+N или Alt+D
            event.preventDefault();
            handleCreateDirectory();
          }
          break;
        case 'c':
        case 'C':
          if (event.ctrlKey && event.shiftKey && !event.altKey) {
            event.preventDefault();
            handleCopyPath(event);
          } else if (event.ctrlKey && !event.shiftKey && event.altKey) {
            event.preventDefault();
            handleCopyRelativePath(event);
          }
          break;
        case 'F2':
          event.preventDefault();
          handleRename(event);
          break;
        case 'Delete':
          event.preventDefault();
          handleDelete(event);
          break;
        case 'd':
        case 'D':
          if (event.altKey && !event.ctrlKey && !event.shiftKey) {
            event.preventDefault();
            handleCreateDirectory();
          }
          break;
        default:
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Устанавливаем фокус на элемент меню
    if (menuRef.current) {
      menuRef.current.focus();
    }
    
    // Очищаем слушатели при размонтировании
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Функция для копирования текста в буфер обмена
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy text to clipboard', err);
    }
  };

  // Обработчики действий
  const handleOpenInExplorer = (event: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    event.stopPropagation();
    invoke("open_in_explorer", { path });
    onClose();
  };

  const handleOpenInTerminal = (event: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    event.stopPropagation();
    if (onSetTerminalPath) {
      onSetTerminalPath(path);
    }
    onClose();
  };

  const handleCreateFile = (event: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    event.stopPropagation();
    if (onCreateFile) {
      onCreateFile(path);
    }
    onClose();
  };

  const handleCreateDirectory = () => {
    setIsCreateFolderModalOpen(true);
    onClose();
  };

  const handleConfirmCreateFolder = async (folderName: string) => {
    try {
      if (!path || !folderName) return;
      
      // Полный путь новой папки
      const newFolderPath = `${path}/${folderName}`;
      
      // Вызываем функцию создания папки
      await invoke("create_folder", {
        path: newFolderPath
      });
      
      console.log(`Создана новая папка: ${newFolderPath}`);
      
      // Обновляем директорию если есть обработчик
      if (onReloadDirectory) {
        onReloadDirectory();
      }
    } catch (error) {
      console.error('Ошибка при создании папки:', error);
      try {
        // Показываем ошибку пользователю
        await invoke('show_error_message', { 
          title: 'Ошибка', 
          message: `Ошибка при создании папки: ${error}`
        });
      } catch (e) {
        console.error('Не удалось показать сообщение об ошибке:', e);
      }
    }
  };

  const handleCopyPath = (event: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    event.stopPropagation();
    navigator.clipboard.writeText(path);
    onClose();
  };

  const handleCopyRelativePath = (event: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    event.stopPropagation();
    const relativePath = path.replace(workspaceRoot, "").replace(/\\/g, "/");
    navigator.clipboard.writeText(relativePath.startsWith("/") ? relativePath.slice(1) : relativePath);
    onClose();
  };

  const handleRename = (event: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    event.stopPropagation();
    if (onRename) {
      onRename(path);
    }
    onClose();
  };

  const handleDelete = (event: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
    event.stopPropagation();
    if (onDelete) {
      onDelete(path);
    }
    onClose();
  };

  // Создаем контент меню
  const menuContent = (
    <>
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
        <button onClick={handleOpenInExplorer}>
          Открыть в проводнике <span className="shortcut">Ctrl+E</span>
        </button>
        <button onClick={handleOpenInTerminal}>
          Открыть в терминале <span className="shortcut">Ctrl+T</span>
        </button>
        <div className="seperator"></div>
        <button onClick={handleCreateFile}>
          Новый файл <span className="shortcut">Ctrl+N / Alt+N</span>
        </button>
        <button onClick={handleCreateDirectory}>
          Новая папка <span className="shortcut">Ctrl+Shift+N / Alt+D</span>
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
      </div>
      
      {/* Модальное окно создания папки */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onConfirm={handleConfirmCreateFolder}
      />
    </>
  );

  // Используем портал для рендеринга меню в конец body
  return ReactDOM.createPortal(menuContent, document.body as Element);
};

export default FolderContextMenu;