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
      <button onClick={(e) => {e.stopPropagation();onCreateFolder(path);}}>
        Новая папка
      </button>
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Новый файл
      </button>
      <div className="seperator"></div>
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Открыть в проводнике
      </button>
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Открыть в терминале
      </button>
      <div className="seperator"></div>

      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Найти в папке
      </button>
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Вырезать
      </button>
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Копировать
      </button>     
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Вставить
      </button>
      <div className="seperator"></div>

      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Скопировать путь
      </button>
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Скопировать относительный путь
      </button>
      <div className="seperator"></div>

      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Переименовать
      </button>
      <button onClick={(e) => {e.stopPropagation();onCreateFile(path);}}>
        Удалить
      </button>

      {/* Добавьте свои дополнительные пункты меню здесь */}
    </div>
  );
};

export default FolderContextMenu;