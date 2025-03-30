// @ts-nocheck
import { useState, useEffect, useRef, createContext } from 'react';
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
import AboutModal from './components/about/AboutModal';
import DocumentationModal from './components/documentation/DocumentationModal';

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

// Create a context for sharing font size across components
export const FontSizeContext = createContext({
  fontSize: 14,
  setFontSize: () => {}
});

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
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('editor-font-size');
    return saved ? parseInt(saved, 10) : 14;
  });
  const editorRef = useRef<{ 
    selectAll: () => void; 
    deselect: () => void;
    invertSelection: () => void;
    expandSelection: () => void;
  }>(null);

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
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  const MIN_LEFT_PANEL_WIDTH = 150;
  const COLLAPSE_THRESHOLD = 50;
  const MAX_LEFT_PANEL_WIDTH = 400;
  const MIN_TERMINAL_HEIGHT = 60;
  const MAX_TERMINAL_HEIGHT = 500;

  // Функции для изменения масштаба
  const handleZoomIn = () => {
    console.log('App.tsx: handleZoomIn called');
    const newFontSize = Math.min(editorFontSize + 2, 32);
    setEditorFontSize(newFontSize);
    localStorage.setItem('editor-font-size', newFontSize.toString());
    
    // Apply to all editors directly
    setTimeout(() => {
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach(editor => {
            editor.updateOptions({ fontSize: newFontSize });
          });
        }
      }
    }, 0);
  };

  const handleZoomOut = () => {
    console.log('App.tsx: handleZoomOut called');
    const newFontSize = Math.max(editorFontSize - 2, 8);
    setEditorFontSize(newFontSize);
    localStorage.setItem('editor-font-size', newFontSize.toString());
    
    // Apply to all editors directly
    setTimeout(() => {
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach(editor => {
            editor.updateOptions({ fontSize: newFontSize });
          });
        }
      }
    }, 0);
  };

  const handleResetZoom = () => {
    console.log('App.tsx: handleResetZoom called');
    const defaultFontSize = 14;
    setEditorFontSize(defaultFontSize);
    localStorage.setItem('editor-font-size', defaultFontSize.toString());
    
    // Apply to all editors directly
    setTimeout(() => {
      if (window.monaco && window.monaco.editor) {
        const editors = window.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach(editor => {
            editor.updateOptions({ fontSize: defaultFontSize });
          });
        }
      }
    }, 0);
  };

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

  // Add global keyboard shortcuts for zooming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          handleZoomIn();
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          handleZoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          handleResetZoom();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetZoom]);

  // Get Monaco instance when it's available
  useEffect(() => {
    const checkMonaco = () => {
      if (window.monaco) {
        console.log('Monaco is now available on window');
        setMonaco(window.monaco);
      } else {
        console.log('Monaco not yet available, retrying in 1 second');
        setTimeout(checkMonaco, 1000);
      }
    };
    
    checkMonaco();
    
    return () => {
      // Clean up any timers if component unmounts
    };
  }, []);

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

  const handleHorizontalDrag = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
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

  const handleVerticalDrag = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      let newHeight = startHeight + delta;

      newHeight = Math.min(Math.max(newHeight, MIN_TERMINAL_HEIGHT), MAX_TERMINAL_HEIGHT);
      
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
    console.log("Restoring terminal, current visibility:", isTerminalVisible);
    // Force terminal to be visible regardless of previous state
    setIsTerminalVisible(true);
    // Ensure terminal has a reasonable height
    setTerminalHeight(prev => {
      // Set terminal to at least 200px height
      return Math.max(200, prev); 
    });
  };

  const handleIssueClick = (filePath: string, line: number, column: number) => {
    if (!openedFiles.some(file => file.path === filePath)) {
      const fileName = filePath.split(/[\\/]/).pop() || '';
      setOpenedFiles(prev => [...prev, { name: fileName, path: filePath, isFolder: false }]);
    }
    
    handleSetSelectedFile(filePath);
  };

  // More explicit terminal toggle function
  const toggleTerminal = () => {
    console.log("Toggling terminal, current state:", isTerminalVisible);
    if (isTerminalVisible) {
      console.log("Hiding terminal");
      setIsTerminalVisible(false);
    } else {
      console.log("Showing terminal");
      handleRestoreTerminal();
    }
  };

  // Explicit open terminal function
  const openTerminal = () => {
    console.log("Explicitly opening terminal");
    if (!isTerminalVisible) {
      console.log("Terminal was hidden, now showing it");
    }
    handleRestoreTerminal();
  };

  // Function to restart terminal process
  const restartTerminalProcess = () => {
    console.log("Restarting terminal process");
    document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'restart' } }));
  };

  // Listen for terminal close events
  useEffect(() => {
    const handleTerminalClose = () => {
      console.log("Terminal close event received");
      setIsTerminalVisible(false);
    };
    
    document.addEventListener('terminal-close', handleTerminalClose);
    
    return () => {
      document.removeEventListener('terminal-close', handleTerminalClose);
    };
  }, []);

  // Functions to open/close modals
  const openAboutModal = () => setIsAboutModalOpen(true);
  const closeAboutModal = () => setIsAboutModalOpen(false);
  const openDocModal = () => setIsDocModalOpen(true);
  const closeDocModal = () => setIsDocModalOpen(false);

  return (
    <FontSizeContext.Provider value={{ fontSize: editorFontSize, setFontSize: setEditorFontSize }}>
      <div className="app-container">
        <TopToolbar 
          currentFiles={currentFiles.map(file => ({
            ...file, 
            icon: file.isFolder ? 'folder' : 'file',
            isFolder: file.isFolder || false
          }))} 
          setSelectedFile={handleSetSelectedFile}
          selectedFolder={selectedFolder}
          selectedFile={selectedFile}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onSelectAll={() => editorRef.current?.selectAll()}
          onDeselect={() => editorRef.current?.deselect()}
          onInvertSelection={() => editorRef.current?.invertSelection()}
          onExpandSelection={() => editorRef.current?.expandSelection()}
          onOpenConsole={openTerminal}
          onClearConsole={() => document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'clear' } }))}
          onCloseConsole={() => setIsTerminalVisible(false)}
          onConsoleSettings={() => document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'settings' } }))}
          onOpenAboutModal={openAboutModal}
          onOpenDocModal={openDocModal}
        />

        <div className="main-content">
          <LeftToolBar 
            onToggleFileExplorer={() => setIsLeftPanelVisible(prev => !prev)}
            isFileExplorerOpen={isLeftPanelVisible}
          />
          
          <div className="mainwindow-container" style={{ height: '100%' }}>
            {/* Left panel with file explorer */}
            {isLeftPanelVisible ? (
              <div
                className="left-panel visible"
                style={{ width: leftPanelWidth }}
              >
                <div className="horizontal-resizer" onMouseDown={handleHorizontalDrag} />
                <FileManager
                  selectedFolder={selectedFolder}
                  setSelectedFile={handleSetSelectedFile}
                  setSelectedFolder={setSelectedFolder}
                  setCurrentFiles={(files) => setCurrentFiles(files as unknown as UIFileItem[])}
                />
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
                    editorRef={editorRef}
                    selectedFile={selectedFile}
                    openedFiles={openedFiles}
                    setOpenedFiles={setOpenedFiles}
                    handleCreateFile={handleCreateFile}
                    setSelectedFolder={setSelectedFolder}
                    selectedFolder={selectedFolder}
                    onEditorInfoChange={setEditorInfo}
                    onIssuesChange={setIssues}
                    handleFileSelect={setSelectedFile}
                    onSelectAll={() => editorRef.current?.selectAll()}
                    onDeselect={() => editorRef.current?.deselect()}
                  />
                </div>
              </div>

              {isTerminalVisible ? (
                <div className="terminal-container" style={{ 
                  height: terminalHeight,
                  minHeight: '200px', 
                  maxHeight: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#1e1e1e',
                  borderTop: '1px solid #303030',
                }}>
                  <div className="vertical-resizer" onMouseDown={handleVerticalDrag} />
                  <Terminal 
                    terminalHeight={terminalHeight - 5}
                    issues={issues} 
                    onIssueClick={handleIssueClick}
                  />
                </div>
              ) : (
                <button 
                  className="restore-button bottom" 
                  onClick={openTerminal}
                  style={{zIndex: 100}}
                >
                  ▲
                </button>
              )}
            </div>
          </div>
        </div>

        <BottomToolbar editorInfo={editorInfo} />
        
        {/* Modal components */}
        <AboutModal isOpen={isAboutModalOpen} onClose={closeAboutModal} />
        <DocumentationModal isOpen={isDocModalOpen} onClose={closeDocModal} />
      </div>
    </FontSizeContext.Provider>
  );
}

export default App;