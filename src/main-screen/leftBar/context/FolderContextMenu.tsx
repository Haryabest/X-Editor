import React from 'react';
import { invoke } from '@tauri-apps/api/core';

import "./style.css";

interface FolderContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onCreateFolder: (path: string) => void;
  onCreateFile: (path: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  x,
  y,
  path,
  onClose,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete
}) => {
  
  // Открыть папку в проводнике
  const handleOpenInExplorer = async () => {
    try {
      await invoke('open_in_explorer', { path });
      onClose();
    } catch (error) {
      console.error('Ошибка при открытии в проводнике:', error);
    }
  };
  
  // Открыть в терминале
  const handleOpenInTerminal = async () => {
    try {
      // Отправляем событие с указанием пути для перехода
      document.dispatchEvent(new CustomEvent('terminal-cd', { 
        detail: { path } 
      }));
      
      // Открываем терминал, если он не открыт
      document.dispatchEvent(new CustomEvent('terminal-show'));
      
      onClose();
    } catch (error) {
      console.error('Ошибка при открытии в терминале:', error);
    }
  };
  
  // Копировать путь
  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(path);
      onClose();
    } catch (error) {
      console.error('Ошибка при копировании пути:', error);
    }
  };
  
  // Копировать относительный путь
  const handleCopyRelativePath = async () => {
    try {
      // Получаем корень проекта через Tauri API
      const projectRoot = await invoke('get_project_root', { currentFilePath: path }) as string;
      
      if (!projectRoot) {
        throw new Error('Не удалось определить корень проекта');
      }
      
      let relativePath = path;
      
      // Проверяем, содержится ли путь проекта в пути файла
      if (path.startsWith(projectRoot)) {
        // Вырезаем корень проекта из пути файла, чтобы получить относительный путь
        relativePath = path.substring(projectRoot.length);
        
        // Удаляем начальные слэши или бэкслэши, если они есть
        relativePath = relativePath.replace(/^[/\\]+/, '');
      }
      
      await navigator.clipboard.writeText(relativePath);
      onClose();
    } catch (error) {
      console.error('Ошибка при копировании относительного пути:', error);
    }
  };
  
  return (
    <div
      className="context-menu-left"
      style={{ top: y, left: x, position: 'fixed', zIndex: 1000 }}
      onClick={onClose}
    >
      <button onClick={(e) => { e.stopPropagation(); onCreateFolder(path); }}>
        Новая папка <span className="shortcut">Ctrl+Shift+N</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Новый файл <span className="shortcut">Ctrl+N</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); handleOpenInExplorer(); }}>
        Открыть в проводнике <span className="shortcut">Ctrl+E</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); handleOpenInTerminal(); }}>
        Открыть в терминале <span className="shortcut">Ctrl+T</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}>
        Найти в папке <span className="shortcut">Ctrl+F</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}>
        Вырезать <span className="shortcut">Ctrl+X</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}>
        Копировать <span className="shortcut">Ctrl+C</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onClose(); }}>
        Вставить <span className="shortcut">Ctrl+V</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); handleCopyPath(); }}>
        Скопировать путь <span className="shortcut">Ctrl+Shift+C</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); handleCopyRelativePath(); }}>
        Скопировать относительный путь <span className="shortcut">Ctrl+Alt+C</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); onRename(path); }}>
        Переименовать <span className="shortcut">F2</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(path); }}>
        Удалить <span className="shortcut">Del</span>
      </button>
    </div>
  );
};

export default FolderContextMenu;