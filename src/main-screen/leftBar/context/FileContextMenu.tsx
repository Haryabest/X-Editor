import React from 'react';

interface FileContextMenuProps {
  x: number;
  y: number;
  path: string;
  onClose: () => void;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({ x, y, onClose }) => {
  return (
    <div
      className="context-menu-left2"
      style={{ top: y, left: x, position: 'fixed', zIndex: 1000 }}
      onClick={onClose}
    >
      <button>
        Открыть сбоку <span className="shortcut">Ctrl+Shift+O</span>
      </button>
      <button>
        Открыть в проводнике <span className="shortcut">Ctrl+E</span>
      </button>
      <button>
        Открыть в терминале <span className="shortcut">Ctrl+T</span>
      </button>
      <button>
        Вырезать <span className="shortcut">Ctrl+X</span>
      </button>
      <button>
        Копировать <span className="shortcut">Ctrl+C</span>
      </button>
      <button>
        Копировать путь <span className="shortcut">Ctrl+Shift+C</span>
      </button>
      <button>
        Копировать относительный путь <span className="shortcut">Ctrl+Alt+C</span>
      </button>
      <button>
        Переименовать <span className="shortcut">F2</span>
      </button>
      <button>
        Удалить <span className="shortcut">Del</span>
      </button>
    </div>
  );
};

export default FileContextMenu;