import React from 'react';
import { 
  X, 
} from 'lucide-react';

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
  onCopyPath: () => void;
  onCopyRelativePath: () => void;
  onOpenInExplorer: () => void;
  onPin: () => void;
}

const FileTabContextMenu: React.FC<FileTabContextMenuProps> = ({
  x,
  y,
  onCloseTab,
  onCloseOthers,
  onCloseRight,
  onCloseLeft,
  onCloseAll,
  onCloseSaved,
  onCopyPath,
  onCopyRelativePath,
  onOpenInExplorer,
  onPin
}) => {
  return (
    <div 
      className="file-tab-context-menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000
      }}
    >
      <div className="context-menu-section">
        <button onClick={onCloseTab}>
          <X size={14} />
          <span>Закрыть</span>
        </button>
        <button onClick={onCloseOthers}>
          <span>Закрыть другие</span>
        </button>
        <button onClick={onCloseRight}>
          <span>Закрыть справа</span>
        </button>
        <button onClick={onCloseLeft}>
          <span>Закрыть слева</span>
        </button>
        <button onClick={onCloseAll}>
          <span>Закрыть все</span>
        </button>
        <button onClick={onCloseSaved}>
          <span>Закрыть сохраненные</span>
        </button>
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-section">
        <button onClick={onCopyPath}>
          <span>Копировать путь</span>
        </button>
        <button onClick={onCopyRelativePath}>
          <span>Копировать относительный путь</span>
        </button>
        <button onClick={onOpenInExplorer}>
          <span>Открыть в проводнике</span>
        </button>
        <button onClick={onPin}>
          <span>Закрепить</span>
        </button>
      </div>
    </div>
  );
};

export default FileTabContextMenu; 