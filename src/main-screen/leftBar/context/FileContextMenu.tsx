import React from 'react';

interface FileContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({ x, y, path, onClose }) => {
  return (
    <div
      className="context-menu"
      style={{
        top: y,
        left: x,
        position: 'fixed',
        zIndex: 1000,
        background: 'red', // Яркий фон для видимости
      }}
      onClick={onClose}
    >
      <button onClick={(e) => e.stopPropagation()}>
        Это меню для файла: {path}
      </button>
    </div>
  );
};

export default FileContextMenu;