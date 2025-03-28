import { useState, useEffect } from 'react';
import { FileItem } from './types';
import { configureMonaco } from './monaco-config';
import { setCurrentProject } from './main-screen/centerContainer/monacoConfig';

import TopToolbar from './main-screen/top-toolbar/toolbar';
import FileManager from './main-screen/leftBar/FileManager';
import CenterContainer from './main-screen/centerContainer/centerContainer';
import Terminal from './main-screen/terminal/terminal';
import BottomToolbar from './main-screen/bottom-toolbar/bottomBar';
import TopbarEditor from './main-screen/topbar-editor/TopbarEditor';
import LeftToolBar from './main-screen/lefttoolbar/LeftToolBar';

import './App.css';

interface UIFileItem extends FileItem {
  icon?: string;
  type?: string;
  isDirectory?: boolean;
  content?: string;
}

interface IssueInfo {
  filePath: string;
  fileName: string;
  issues: {
    severity: 'error' | 'warning' | 'info';
    message: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    source?: string;
    code?: string;
  }[];
}

function App() {
  const [leftPanelWidth, setLeftPanelWidth] = useState(250);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentFiles, setCurrentFiles] = useState<UIFileItem[]>([]);
  const [openedFiles, setOpenedFiles] = useState<UIFileItem[]>([]);
  const [monaco, setMonaco] = useState<any>(null);
  const [lastOpenedFolder, setLastOpenedFolder] = useState<string | null>(null);
  
  const [editorInfo, setEditorInfo] = useState({
    errors: 0,
    warnings: 0,
    language: 'plaintext',
    encoding: 'UTF-8',
    cursorInfo: {
      line: 1,
      column: 1,
      totalChars: 0
    }
  });
  const [issues, setIssues] = useState<IssueInfo[]>([]);

  const MIN_LEFT_PANEL_WIDTH = 150;
  const COLLAPSE_THRESHOLD = 50;
  const MAX_LEFT_PANEL_WIDTH = 400;
  const MIN_TERMINAL_HEIGHT = 60;
  const MAX_TERMINAL_HEIGHT = 500;

  useEffect(() => {
    if (monaco) {
      configureMonaco(openedFiles);
    }
  }, [monaco, openedFiles]);

  useEffect(() => {
    if (selectedFolder) {
      setCurrentProject(selectedFolder);
    }
  }, [selectedFolder]);

  const handleSetSelectedFile = (filePath: string | null) => {
    if (filePath && !openedFiles.some(file => file.path === filePath)) {
      const file = currentFiles.find(f => f.path === filePath);
      if (file) {
        console.log('Adding file to openedFiles:', file);
        setOpenedFiles(prev => [...prev, { ...file, isFolder: false, expanded: false, loaded: true }]);
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

  const handleCreateFile = () => {
    const newFile: UIFileItem = {
      name: 'Без названия 1',
      path: `untitled-${Date.now()}`,
      isFolder: false,
    };
    setOpenedFiles(prev => [...prev, newFile]);
    setSelectedFile(newFile.path);
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

  const toggleFileExplorer = () => {
    setIsLeftPanelVisible(!isLeftPanelVisible);
  };

  const handleIssueClick = (filePath: string, line: number, column: number) => {
    if (!openedFiles.some(file => file.path === filePath)) {
      const fileName = filePath.split(/[\\/]/).pop() || '';
      setOpenedFiles(prev => [...prev, { name: fileName, path: filePath, isFolder: false }]);
    }
    
    handleSetSelectedFile(filePath);
  };

  // Функции для изменения масштаба
  const handleZoomIn = () => {
    // Логика теперь в CenterContainer
  };

  const handleZoomOut = () => {
    // Логика теперь в CenterContainer
  };

  return (
    <div className="app-container">
      <TopToolbar 
        currentFiles={currentFiles.map(file => ({
          ...file, 
          icon: file.isFolder ? 'folder' : 'file',
          isFolder: file.isFolder || false
        }))} 
        setSelectedFile={handleSetSelectedFile}
        selectedFolder={selectedFolder}
        onZoomIn={handleZoomIn} // Передаем функцию в TopToolbar
        onZoomOut={handleZoomOut} // Передаем функцию в TopToolbar
      />

      <div className="main-content">
        <LeftToolBar 
          onToggleFileExplorer={toggleFileExplorer} 
          isFileExplorerOpen={isLeftPanelVisible} 
        />
        
        {isLeftPanelVisible ? (
          <div className="left-panel" style={{ width: leftPanelWidth }}>
            <FileManager
              selectedFolder={selectedFolder}
              setSelectedFile={handleSetSelectedFile}
              setSelectedFolder={setSelectedFolder} // Добавьте эту строку
              setCurrentFiles={(files) => setCurrentFiles(files as unknown as UIFileItem[])}
            />
            <div className="horizontal-resizer" onMouseDown={handleHorizontalDrag} />
          </div>
        ) : (
          <button className="restore-button left" onClick={() => setIsLeftPanelVisible(true)}>
            ➤
          </button>
        )}

        <div className="center-and-terminal">
          <div className="monaco-editor-container">
            <div className="editor-container">
              {openedFiles.length > 0 && (
                <TopbarEditor
                  openedFiles={openedFiles.map(file => ({...file, icon: file.isFolder ? 'folder' : 'file'}))}
                  activeFile={selectedFile}
                  setSelectedFile={handleSetSelectedFile}
                  closeFile={handleCloseFile}
                />
              )}
              <CenterContainer
                selectedFile={selectedFile}
                openedFiles={openedFiles}
                setOpenedFiles={setOpenedFiles}
                handleCreateFile={handleCreateFile}
                setSelectedFolder={setSelectedFolder}
                selectedFolder={selectedFolder}
                onEditorInfoChange={setEditorInfo}
                onIssuesChange={setIssues}
                handleFileSelect={setSelectedFile}
                onZoomIn={handleZoomIn} // Передаем функцию в CenterContainer
                onZoomOut={handleZoomOut} // Передаем функцию в CenterContainer
              />
            </div>
          </div>

          {isTerminalVisible ? (
            <div className="terminal-container" style={{ height: terminalHeight }}>
              <div className="vertical-resizer" onMouseDown={handleVerticalDrag} />
              <Terminal 
                terminalHeight={terminalHeight} 
                issues={issues} 
                onIssueClick={handleIssueClick}
              />
            </div>
          ) : (
            <button className="restore-button bottom" onClick={handleRestoreTerminal}>
              ▲
            </button>
          )}
        </div>
      </div>

      <BottomToolbar editorInfo={editorInfo} />
    </div>
  );
}

export default App;