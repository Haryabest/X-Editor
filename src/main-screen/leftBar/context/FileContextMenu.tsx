import React from 'react';

interface FileContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({ x, y, path, onClose }) => {
  return (
    <div className="context-menu-left2" style={{ top: y,left: x,position: 'fixed',zIndex: 1000,}}onClick={onClose}>
     <button>Открыть сбоку</button>
     <button>Открыть в проводнике</button>
     <button>Открыть в терминале</button>
     <button>Вырезать</button>
     <button>Копировать</button>
     <button>Копировать путь</button>
     <button>Копировать относительный путь</button>
     <button>Переименовать</button>
     <button>Удалить</button>
    </div>
  );
};

export default FileContextMenu;