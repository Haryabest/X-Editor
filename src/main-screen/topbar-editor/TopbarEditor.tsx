import React from 'react';
import { X } from 'lucide-react';
import { FileItem } from '../../types'; // Импортируем из общего типа

import './TopbarEditor.css';

interface TopbarEditorProps {
  openedFiles: FileItem[];
  activeFile: string | null;
  setSelectedFile: (filePath: string | null) => void;
  closeFile: (filePath: string) => void;
}

const TopbarEditor: React.FC<TopbarEditorProps> = ({ openedFiles, activeFile, setSelectedFile, closeFile }) => {
  const activeFilePath = openedFiles.find(file => file.path === activeFile)?.path || '';

  return (
    <div className="te-container">
      <div className="te-file-tabs">
        {openedFiles.map((file) => (
          <div
            key={file.path}
            className={`te-file-tab ${activeFile === file.path ? 'te-active' : ''}`}
          >
            <span className="te-file-icon">
              {file.icon || '📄'} {/* Используем ReactNode или дефолтный символ */}
            </span>
            <button
              className="te-file-name-btn"
              onClick={() => setSelectedFile(file.path)}
            >
              {file.name}
            </button>
            <button
              className="te-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      {activeFile && (
        <div className="te-file-path">
          {activeFilePath}
        </div>
      )}
    </div>
  );
};

export default TopbarEditor;