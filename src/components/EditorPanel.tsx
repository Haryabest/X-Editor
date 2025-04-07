import React from 'react';
import TopbarEditor from '../main-screen/topbar-editor/TopbarEditor';
import CenterContainer from '../main-screen/centerContainer/centerContainer';
import { FileItem } from '../types';
import './EditorPanel.css';

// Расширение интерфейса FileItem для внутреннего использования в компоненте
interface ExtendedFileItem extends FileItem {
  icon?: string;
}

interface EditorPanelProps {
  openedFiles: ExtendedFileItem[];
  activeFile: string | null;
  setSelectedFile: (filePath: string | null) => void;
  closeFile: (filePath: string) => void;
  handleCreateFile: () => void;
  selectedFolder: string | null;
  setSelectedFolder: (path: string | null) => void;
  onEditorInfoChange?: (info: any) => void;
  onIssuesChange?: (issues: any) => void;
  onDebugStart?: (filePath: string) => void;
  onSplitEditor?: (filePath: string) => void;
  setOpenedFiles: (files: ExtendedFileItem[] | ((prev: ExtendedFileItem[]) => ExtendedFileItem[])) => void;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  openedFiles,
  activeFile,
  setSelectedFile,
  closeFile,
  handleCreateFile,
  selectedFolder,
  setSelectedFolder,
  onEditorInfoChange,
  onIssuesChange,
  onDebugStart,
  onSplitEditor,
  setOpenedFiles
}) => {
  // Создаем ref для передачи редактору
  const editorRef = React.useRef<any>(null);

  return (
    <div className="editor-panel">
      {openedFiles.length > 0 && (
        <TopbarEditor
          openedFiles={openedFiles.map(file => ({
            ...file,
            icon: file.icon || (file.isFolder ? 'folder' : 'file')
          }))}
          activeFile={activeFile}
          setSelectedFile={setSelectedFile}
          closeFile={closeFile}
          onDebugStart={onDebugStart}
          onSplitEditor={onSplitEditor}
        />
      )}
      <CenterContainer
        setSelectedFolder={setSelectedFolder}
        selectedFile={activeFile}
        openedFiles={openedFiles.map(file => ({
          ...file,
          icon: file.icon || (file.isFolder ? 'folder' : 'file')
        }))}
        setOpenedFiles={setOpenedFiles}
        handleCreateFile={handleCreateFile}
        selectedFolder={selectedFolder}
        handleFileSelect={setSelectedFile}
        editorRef={editorRef}
        onEditorInfoChange={onEditorInfoChange}
        onIssuesChange={onIssuesChange}
        onDebugStart={onDebugStart}
        onSplitEditor={onSplitEditor}
      />
    </div>
  );
};

export default EditorPanel; 