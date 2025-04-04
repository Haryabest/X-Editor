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
  filePath,
  relativePath,
  onPin,
  onCopyPath,
  onCopyRelativePath,
  onOpenInExplorer
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
        <button onClick={onCopyPath}><span>Копировать путь</span></button>
        <button onClick={onCopyRelativePath}><span>Копировать относительный путь</span></button>
        <button onClick={onOpenInExplorer}><span>Открыть в проводнике</span></button>
        <div className="context-menu-divider" />
        <button onClick={onPin}><span>Закрепить</span></button>
      </div>
    </div>
  );
};

export default FileTabContextMenu;
