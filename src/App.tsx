import { useState, useCallback } from 'react'; // Добавляем useCallback
import { FileItem } from './types';

import TopToolbar from './main-screen/top-toolbar/toolbar';
import FileManager from './main-screen/leftBar/FileManager';
import CenterContainer from './main-screen/centerContainer/centerContainer';
import Terminal from './main-screen/terminal/terminal';
import BottomToolbar from './main-screen/bottom-toolbar/bottomBar';
import TopbarEditor from './main-screen/topbar-editor/TopbarEditor';

import './App.css';

interface DependencyMetadata {
  dependencies: string[]; // Упрощаем до единого поля
}

function App() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentFiles, setCurrentFiles] = useState<FileItem[]>([]);
  const [openedFiles, setOpenedFiles] = useState<FileItem[]>([]);
  const [dependencyMetadata, setDependencyMetadata] = useState<DependencyMetadata>({
    dependencies: [],
  });

  const MIN_LEFT_PANEL_WIDTH = 150;
  const COLLAPSE_THRESHOLD = 50;
  const MAX_LEFT_PANEL_WIDTH = 400;
  const MIN_TERMINAL_HEIGHT = 60;
  const MAX_TERMINAL_HEIGHT = 500;

  const handleSetSelectedFile = (filePath: string | null) => {
    if (filePath && !openedFiles.some(file => file.path === filePath)) {
      const file = currentFiles.find(f => f.path === filePath);
      if (file) {
        console.log('Adding file to openedFiles:', file);
        setOpenedFiles(prev => [...prev, { ...file, is_directory: false, expanded: false, loaded: true }]);
      } else {
        console.log('File not found in currentFiles:', filePath);
      }
    }
    setSelectedFile(filePath);
  };

  const handleCloseFile = (filePath: string) => {
    const updatedFiles = openedFiles.filter(file => file.path !== filePath);
    setOpenedFiles(updatedFiles);
    if (selectedFile === filePath) {
      setSelectedFile(updatedFiles.length > 0 ? updatedFiles[updatedFiles.length - 1].path : null);
    }
  };

  const handleHorizontalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = startWidth + delta;

      if (newWidth <= MIN_LEFT_PANEL_WIDTH - COLLAPSE_THRESHOLD) {
        setIsLeftPanelVisible(false);
        document.removeEventListener('mousemove', onMouseMove);
      } else {
        setLeftPanelWidth(
          Math.min(Math.max(MIN_LEFT_PANEL_WIDTH, newWidth), MAX_LEFT_PANEL_WIDTH)
        );
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleVerticalDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      let newHeight = startHeight + delta;

      newHeight = Math.min(MAX_TERMINAL_HEIGHT, Math.max(MIN_TERMINAL_HEIGHT, newHeight));

      if (newHeight <= MIN_TERMINAL_HEIGHT + COLLAPSE_THRESHOLD) {
        setIsTerminalVisible(false);
        document.removeEventListener('mousemove', onMouseMove);
      } else {
        setTerminalHeight(newHeight);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleRestoreTerminal = () => {
    setIsTerminalVisible(true);
    setTerminalHeight(prev =>
      Math.min(MAX_TERMINAL_HEIGHT, Math.max(MIN_TERMINAL_HEIGHT, prev))
    );
  };

  // Мемоизируем onDependenciesDetected
  const onDependenciesDetected = useCallback((metadata: DependencyMetadata) => {
    setDependencyMetadata(metadata);
  }, [setDependencyMetadata]);

  return (
    <div className="app-container">
      <TopToolbar currentFiles={currentFiles} setSelectedFile={handleSetSelectedFile} />

      <div className="main-content">
        {isLeftPanelVisible ? (
          <div className="left-panel" style={{ width: leftPanelWidth }}>
            <FileManager
              selectedFolder={selectedFolder}
              setSelectedFile={handleSetSelectedFile}
              setCurrentFiles={setCurrentFiles} // Убрали приведение типов
              onDependenciesDetected={onDependenciesDetected} // Используем мемоизированную функцию
            />
            <div className="horizontal-resizer" onMouseDown={handleHorizontalDrag} />
          </div>
        ) : (
          <button className="restore-button left" onClick={() => setIsLeftPanelVisible(true)}>
            ➤
          </button>
        )}

        <div className="center-and-terminal">
          {openedFiles.length > 0 && (
            <TopbarEditor
              openedFiles={openedFiles}
              activeFile={selectedFile}
              setSelectedFile={handleSetSelectedFile}
              closeFile={handleCloseFile}
            />
          )}
          <div className="monaco-editor-container">
            <CenterContainer
              style={{ flex: 1 }}
              setSelectedFolder={setSelectedFolder}
              selectedFolder={selectedFolder} // Добавляем selectedFolder для автодополнения
              selectedFile={selectedFile}
              dependencyMetadata={dependencyMetadata}
              setDependencyMetadata={setDependencyMetadata}
              currentFiles={currentFiles}
            />
          </div>

          {isTerminalVisible ? (
            <div className="terminal-container" style={{ height: terminalHeight }}>
              <div className="vertical-resizer" onMouseDown={handleVerticalDrag} />
              <Terminal />
            </div>
          ) : (
            <button className="restore-button bottom" onClick={handleRestoreTerminal}>
              ▲
            </button>
          )}
        </div>
      </div>

      <BottomToolbar />
    </div>
  );
}

export default App;