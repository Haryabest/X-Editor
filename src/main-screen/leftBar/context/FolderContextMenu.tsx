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
      className="context-menu"
      style={{ top: y, left: x, position: 'fixed', zIndex: 1000 }}
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCreateFolder(path);
        }}
      >
        Новая папка
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCreateFile(path);
        }}
      >
        Новый файл
      </button>
      {/* Добавьте свои дополнительные пункты меню здесь */}
    </div>
  );
};

export default FolderContextMenu;