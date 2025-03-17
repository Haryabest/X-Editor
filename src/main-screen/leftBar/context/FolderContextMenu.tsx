import React from 'react';

import "./style.css";

interface FolderContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
  onCreateFolder: (path: string) => Promise<void>;
  onCreateFile: (path: string) => Promise<void>;
}

const FolderContextMenu: React.FC<FolderContextMenuProps> = ({
  x,
  y,
  path,
  onClose,
  onCreateFolder,
  onCreateFile,
}) => {
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
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Открыть в проводнике <span className="shortcut">Ctrl+E</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Открыть в терминале <span className="shortcut">Ctrl+T</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Найти в папке <span className="shortcut">Ctrl+F</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Вырезать <span className="shortcut">Ctrl+X</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Копировать <span className="shortcut">Ctrl+C</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Вставить <span className="shortcut">Ctrl+V</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Скопировать путь <span className="shortcut">Ctrl+Shift+C</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Скопировать относительный путь <span className="shortcut">Ctrl+Alt+C</span>
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Переименовать <span className="shortcut">F2</span>
      </button>
      <button onClick={(e) => { e.stopPropagation(); onCreateFile(path); }}>
        Удалить <span className="shortcut">Del</span>
      </button>
    </div>
  );
};

export default FolderContextMenu;