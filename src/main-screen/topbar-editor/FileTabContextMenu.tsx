import React, { useEffect, useRef } from 'react';

interface FileTabContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCloseTab: () => void;
  onCloseOthers: () => void;
  onCloseRight: () => void;
  onCloseLeft: () => void;
  onCloseAll: () => void;
  onCloseSaved: () => void;
  filePath: string;
  relativePath: string;
  onPin: () => void;
  onCopyPath: () => Promise<void>;       // Добавлено
  onCopyRelativePath: () => Promise<void>; // Добавлено
  onOpenInExplorer: () => Promise<void>;  // Добавлено
  isPinned: boolean;
}


const FileTabContextMenu: React.FC<FileTabContextMenuProps> = ({
  x,
  y,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseRight,
  onCloseLeft,
  onCloseAll,
  onCloseSaved,
  onPin,
  onCopyPath,
  onCopyRelativePath,
  onOpenInExplorer,
  isPinned
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="file-tab-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        borderRadius: 10
      }}
    >
      <div className="context-menu-section">
        <button onClick={onCloseAll}><span>Закрыть все</span></button>
        <button onClick={onCloseLeft}><span>Закрыть слева</span></button>
        <button onClick={onCloseOthers}><span>Закрыть другие</span></button>
        <button onClick={onCloseRight}><span>Закрыть справа</span></button>
        <button onClick={onCloseSaved}><span>Закрыть сохранённые</span></button>
        <button onClick={onCloseTab}><span>Закрыть</span></button>
      </div>

      <div className="context-menu-divider" />

      <div className="context-menu-section">
        <button onClick={onCopyPath}>
          <span className="menu-item-with-icon">
            Копировать путь
          </span>
        </button>
        <button onClick={onCopyRelativePath}>
          <span className="menu-item-with-icon">
            Копировать относительный путь
          </span>
        </button>
        <button onClick={onOpenInExplorer}>
          <span className="menu-item-with-icon">
            Открыть в проводнике
          </span>
        </button>
        <div className="context-menu-divider" />
        <button onClick={onPin}>
          {isPinned ? (
            <span className="menu-item-with-icon">
              Открепить
            </span>
          ) : (
            <span className="menu-item-with-icon">
              Закрепить
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default FileTabContextMenu;
