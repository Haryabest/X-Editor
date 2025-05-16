// @ts-nocheck
import React, { useState, useEffect, useRef, createContext } from 'react';
import { FileItem } from './types';
import { configureMonaco } from './monaco-config/index';
import { setCurrentProject } from './main-screen/centerContainer/monacoConfig';
import { invoke } from '@tauri-apps/api/core';

import TopToolbar from './main-screen/top-toolbar/toolbar';
import FileManager from './main-screen/leftBar/FileManager';
import CenterContainer from './main-screen/centerContainer/centerContainer';
import Terminal from './main-screen/terminal/terminal';
import BottomToolbar from './main-screen/bottom-toolbar/bottomBar';
import TopbarEditor from './main-screen/topbar-editor/TopbarEditor';
import LeftToolBar from './main-screen/lefttoolbar/LeftToolBar';
import { GitChanges } from './main-screen/lefttoolbar/GitChanges';
import Repositories from './main-screen/lefttoolbar/repositories/Repositories';
import AboutModal from './components/about/AboutModal';
import DocumentationModal from './components/documentation/DocumentationModal';
import Settings from './main-screen/lefttoolbar/settings/Settings';
import { initializeSettings, getUISettings, saveUISettings } from './utils/settingsManager';

import './App.css';

// Компонент для уведомлений
const Notification = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning' | 'info'; onClose: () => void }) => {
  const backgroundColor = {
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3'
  }[type];

  return (
    <div 
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        backgroundColor,
        color: 'white',
        padding: '12px 20px',
        borderRadius: '4px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: '400px'
      }}
    >
      <span>{message}</span>
      <button 
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          marginLeft: '16px',
          cursor: 'pointer',
          fontSize: '18px'
        }}
      >
        &times;
      </button>
    </div>
  );
};

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

interface GitInfo {
  current_branch: string;
  status: string;
}

// Create a context for sharing font size across components
export const FontSizeContext = createContext({
  fontSize: 14,
  setFontSize: () => {}
});

function App() {
  // Initialize all settings
  useEffect(() => {
    initializeSettings();
  }, []);
  
  // Get UI settings from settings manager
  const uiSettings = getUISettings();
  
  // Initialize UI state from settings
  const [leftPanelWidth, setLeftPanelWidth] = useState(uiSettings.leftPanelWidth);
  const [terminalHeight, setTerminalHeight] = useState(uiSettings.terminalHeight);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(uiSettings.isLeftPanelVisible);
  const [isTerminalVisible, setIsTerminalVisible] = useState(uiSettings.isTerminalVisible);
  const [activeLeftPanel, setActiveLeftPanel] = useState(uiSettings.activeLeftPanel);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentFiles, setCurrentFiles] = useState<UIFileItem[]>([]);
  const [openedFiles, setOpenedFiles] = useState<UIFileItem[]>([]);
  const [monaco, setMonaco] = useState<any>(null);
  const [lastOpenedFolder, setLastOpenedFolder] = useState<string | null>(uiSettings.lastOpenedFolder);
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('editor-font-size');
    return saved ? parseInt(saved, 10) : 14;
  });
  
  // Состояние для уведомлений
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const editorRef = useRef<{ 
    selectAll: () => void; 
    deselect: () => void;
    invertSelection: () => void;
    selectParagraph: () => void;
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [gitInfo, setGitInfo] = useState<GitInfo>({
    current_branch: '---',
    status: 'none'
  });
  const [shouldRefreshFiles, setShouldRefreshFiles] = useState(false);

  const MIN_LEFT_PANEL_WIDTH = 150;
  const COLLAPSE_THRESHOLD = 50;
  const MAX_LEFT_PANEL_WIDTH = 400;
  const MIN_TERMINAL_HEIGHT = 60;
  const MAX_TERMINAL_HEIGHT = 500;

  // Save UI settings when they change
  useEffect(() => {
    saveUISettings({
      leftPanelWidth,
      terminalHeight,
      isLeftPanelVisible,
      isTerminalVisible,
      activeLeftPanel,
      lastOpenedFolder
    });
  }, [
    leftPanelWidth,
    terminalHeight,
    isLeftPanelVisible,
    isTerminalVisible,
    activeLeftPanel,
    lastOpenedFolder
  ]);
  
  // Load last opened folder if available
  useEffect(() => {
    const savedFolder = uiSettings.lastOpenedFolder;
    if (savedFolder) {
      // Check if the folder exists
      invoke('file_exists', { path: savedFolder })
        .then((exists: boolean) => {
          if (exists) {
            setSelectedFolder(savedFolder);
          }
        })
        .catch(error => {
          console.error('Error checking folder existence:', error);
        });
    }
  }, []);

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
        } else if (e.key === 'p' || e.key === 'P') {
          if (!e.altKey && !e.shiftKey) {  // Не перехватываем Ctrl+Shift+P или другие комбинации
            e.preventDefault();
            editorRef.current?.selectParagraph();
          }
        } else if (e.key === 'i' || e.key === 'I') {
          if (e.shiftKey) {  // Для комбинации Shift+Ctrl+I
            e.preventDefault();
            editorRef.current?.invertSelection();
          }
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
    console.log('Setting selected file:', filePath);
    
    // If null, just clear selection
    if (!filePath) {
      setSelectedFile(null);
      return;
    }
    
    // Update selected file regardless of whether it exists in openedFiles
    setSelectedFile(filePath);
    
    // Add to openedFiles if not already there
    if (!openedFiles.some(file => file.path === filePath)) {
      // Try to find the file in currentFiles
      const fileFromCurrent = currentFiles.find(f => f.path === filePath);
      
      if (fileFromCurrent) {
        // File is in currentFiles, add to openedFiles
        console.log('Adding file from currentFiles to openedFiles:', fileFromCurrent);
        setOpenedFiles(prev => [...prev, { ...fileFromCurrent, expanded: false, loaded: true }]);
      } else {
        // Create a new file entry based on the path
        const fileName = filePath.split(/[\\/]/).pop() || 'unknown';
        console.log('Creating file object for:', filePath, 'with name:', fileName);
        
        // Verify file exists before adding
        invoke('file_exists', { path: filePath })
          .then((exists: boolean) => {
            if (exists) {
              console.log('File exists, adding to openedFiles');
              const newFile = {
                name: fileName,
                path: filePath,
                isFolder: false,
                icon: '',
                expanded: false,
                loaded: true
              };
              
              setOpenedFiles(prev => [...prev, newFile]);
            } else {
              console.error('File does not exist:', filePath);
              alert(`Файл не существует: ${filePath}`);
              setSelectedFile(null);
            }
          })
          .catch(error => {
            console.error('Error checking file existence:', error);
          });
      }
    }
  };

  const handleCloseFile = (filePath: string) => {
    console.log('Closing file:', filePath);
    
    // Remove from openedFiles
    setOpenedFiles(prev => prev.filter(file => file.path !== filePath));
    
    // If this was the selected file, select another one or clear selection
    if (selectedFile === filePath) {
      // Find index of current file
      const fileIndex = openedFiles.findIndex(file => file.path === filePath);
      
      if (openedFiles.length > 1) {
        // If there are other files, select one of them
        if (fileIndex > 0) {
          // Select previous file if possible
          setSelectedFile(openedFiles[fileIndex - 1].path);
        } else {
          // Otherwise select the next file
          setSelectedFile(openedFiles[1].path);
        }
      } else {
        // No other files, clear selection
        setSelectedFile(null);
      }
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
        // Force fit the terminal after resize
        document.dispatchEvent(new CustomEvent('terminal-resize'));
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

  // Слушатель для уведомлений
  useEffect(() => {
    const handleShowNotification = (event: CustomEvent<{
      message: string;
      type: 'success' | 'error' | 'warning' | 'info';
      duration?: number;
    }>) => {
      const { message, type, duration = 5000 } = event.detail;
      
      console.log(`Показываем уведомление: ${message} (${type})`);
      setNotification({ message, type });
      
      // Автоматически скрываем через указанное время
      setTimeout(() => {
        setNotification(null);
      }, duration);
    };
    
    document.addEventListener('show-notification', handleShowNotification as EventListener);
    
    return () => {
      document.removeEventListener('show-notification', handleShowNotification as EventListener);
    };
  }, []);

  // Добавим useEffect для прямого получения маркеров из Monaco при запуске
  useEffect(() => {
    // Функция для обнаружения и отображения всех проблем в редакторе
    const discoverAndDisplayProblems = () => {
      console.log("Сканирование проблем в редакторе...");
      
      if (!window.monaco || !window.monaco.editor) {
        console.warn("Monaco не доступен, пропускаем сканирование проблем");
        return;
      }
      
      try {
        // Получаем все модели (открытые файлы в редакторе)
        const models = window.monaco.editor.getModels();
        console.log(`Найдено ${models.length} моделей редактора`);
        
        // Проверяем модели на наличие маркеров
        let newIssues: IssueInfo[] = [];
        let anyErrors = false;
        
        // Проходим по всем моделям и собираем маркеры
        models.forEach(model => {
          if (!model || !model.uri) return;
          
          const uri = model.uri.toString();
          const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
          
          if (markers && markers.length > 0) {
            const fileName = uri.split(/[\\/]/).pop() || '';
            console.log(`Файл ${fileName} имеет ${markers.length} маркеров`);
            
            // Создаем объект с проблемами для этого файла
            const fileIssues: IssueInfo = {
              filePath: uri,
              fileName,
              issues: markers.map(marker => ({
                severity: marker.severity === 1 ? 'error' : 
                         marker.severity === 2 ? 'warning' : 'info',
                message: marker.message,
                line: marker.startLineNumber,
                column: marker.startColumn,
                endLine: marker.endLineNumber,
                endColumn: marker.endColumn,
                source: marker.source || 'monaco-editor',
                code: marker.code?.toString()
              }))
            };
            
            newIssues.push(fileIssues);
            
            // Проверяем наличие ошибок (не только предупреждений)
            if (markers.some(m => m.severity === 1)) {
              anyErrors = true;
            }
            
            // Сохраняем маркеры в глобальное хранилище для доступа из компонента Terminal
            if (!window.pythonDiagnosticsStore) {
              window.pythonDiagnosticsStore = {};
            }
            window.pythonDiagnosticsStore[uri] = markers;
          }
        });
        
        // Обновляем состояние issues только если действительно нашли проблемы
        if (newIssues.length > 0) {
          console.log(`Всего найдено ${newIssues.length} файлов с проблемами`);
          setIssues(newIssues);
          
          // Если есть ошибки, показываем терминал и переключаем на вкладку проблем
          if (anyErrors && !isTerminalVisible) {
            console.log("Обнаружены ошибки, показываем терминал");
            handleRestoreTerminal();
            
            // Отправляем событие для переключения на вкладку проблем
            setTimeout(() => {
              document.dispatchEvent(new CustomEvent('show-problems-tab'));
            }, 500);
          }
          
          // Отправляем событие обновления проблем
          document.dispatchEvent(new CustomEvent('problems-updated'));
        }
      } catch (error) {
        console.error("Ошибка при сканировании проблем:", error);
      }
    };
    
    // Сканируем проблемы при первом запуске
    setTimeout(discoverAndDisplayProblems, 1000);
    
    // Периодически проверяем на наличие новых проблем
    const intervalId = setInterval(discoverAndDisplayProblems, 3000);
    
    // Также проверяем проблемы при изменениях в файлах
    const handleModelContentChanged = () => {
      // Используем debounce, чтобы не проверять слишком часто
      setTimeout(discoverAndDisplayProblems, 500);
    };
    
    // Подписываемся на события изменения содержимого редактора
    if (window.monaco && window.monaco.editor) {
      // Правильный способ подписки на изменения контента моделей
      // onDidChangeModelContent - это не функция, а событие у конкретных моделей
      const setupModelListeners = () => {
        const models = window.monaco.editor.getModels();
        models.forEach(model => {
          // Подписываемся на события изменения контента для каждой модели
          model.onDidChangeContent(() => {
            setTimeout(discoverAndDisplayProblems, 500);
          });
        });
      };
      
      // Первоначальная настройка для существующих моделей
      setupModelListeners();
      
      // Также подписываемся на создание новых моделей
      window.monaco.editor.onDidCreateModel(model => {
        model.onDidChangeContent(() => {
          setTimeout(discoverAndDisplayProblems, 500);
        });
      });
    }
    
    return () => {
      clearInterval(intervalId);
    };
  }, [isTerminalVisible]);

  // Listen for open-folder events
  useEffect(() => {
    const handleOpenFolder = (event: CustomEvent) => {
      console.log("Open folder event received", event.detail);
      const { path } = event.detail;
      
      if (path) {
        // Set the selected folder to the path provided
        setSelectedFolder(path);
        setActiveLeftPanel('explorer');
        
        // Ensure the left panel is visible
        if (!isLeftPanelVisible) {
          setIsLeftPanelVisible(true);
        }
        
        // Save as last opened folder
        if (setLastOpenedFolder) {
          setLastOpenedFolder(path);
        }
      }
    };
    
    document.addEventListener('open-folder', handleOpenFolder as EventListener);
    
    return () => {
      document.removeEventListener('open-folder', handleOpenFolder as EventListener);
    };
  }, [isLeftPanelVisible]);

  // Functions to open/close modals
  const openAboutModal = () => setIsAboutModalOpen(true);
  const closeAboutModal = () => setIsAboutModalOpen(false);
  const openDocModal = () => setIsDocModalOpen(true);
  const closeDocModal = () => setIsDocModalOpen(false);
  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  const handleViewChange = (viewName: string) => {
    setActiveLeftPanel(viewName);
    if (!isLeftPanelVisible) {
      setIsLeftPanelVisible(true);
    }
  };

  // Обработчик изменения Git информации
  const handleGitInfoChange = (updatedGitInfo: GitInfo) => {
    // Обновляем gitInfo в App
    setGitInfo(updatedGitInfo);
    
    // Устанавливаем флаг для обновления списка файлов
    setShouldRefreshFiles(true);
  };
  
  // Эффект для обновления списка файлов при смене ветки
  useEffect(() => {
    if (shouldRefreshFiles && selectedFolder) {
      console.log('Обновляем список файлов после смены ветки');
      
      // Сбрасываем флаг
      setShouldRefreshFiles(false);
      
      // Инициируем перезагрузку списка файлов
      const refreshFiles = async () => {
        try {
          // Получаем содержимое директории напрямую через tauri
          const files = await invoke('get_directory_tree', { path: selectedFolder });
          
          // Обновляем текущие файлы
          if (files && files.children) {
            setCurrentFiles(files.children as UIFileItem[]);
          }
        } catch (error) {
          console.error('Ошибка при обновлении списка файлов:', error);
        }
      };
      
      refreshFiles();
    }
  }, [shouldRefreshFiles, selectedFolder]);

  // Обновляем gitInfo при изменении selectedFolder
  useEffect(() => {
    const updateGitInfo = async () => {
      if (selectedFolder) {
        try {
          const info = await invoke('get_git_info', { projectRoot: selectedFolder });
          setGitInfo(info as GitInfo);
        } catch (error) {
          console.error('Error getting git info:', error);
          setGitInfo({ current_branch: '---', status: 'none' });
        }
      } else {
        setGitInfo({ current_branch: '---', status: 'none' });
      }
    };

    updateGitInfo();
  }, [selectedFolder]);

  // Функция для преобразования списка issues в объект для FileManager
  const getFileIssuesMap = (issues: IssueInfo[]) => {
    const issuesMap: { [filePath: string]: { errors: number, warnings: number } } = {};
    
    issues.forEach(issueInfo => {
      if (!issueInfo.issues || issueInfo.issues.length === 0) return;
      
      const errors = issueInfo.issues.filter(issue => issue.severity === 'error').length;
      const warnings = issueInfo.issues.filter(issue => issue.severity === 'warning').length;
      
      if (errors > 0 || warnings > 0) {
        issuesMap[issueInfo.filePath] = { errors, warnings };
      }
    });
    
    return issuesMap;
  };

  // Expose Python diagnostic functions globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // Import the functions dynamically to avoid TS errors
        import('./main-screen/centerContainer/python-lsp-starter').then(module => {
          console.log('🐍 Exposing Python diagnostic functions globally');
          
          // Используем встроенный анализатор вместо LSP
          (window as any).forcePythonDiagnosticsUpdate = module.forcePythonDiagnosticsUpdate;
          (window as any).updateAllPythonDiagnostics = module.updateAllPythonDiagnostics;
          
          // Эти функции не нужны при использовании встроенного анализатора
          // (window as any).isPythonLSPConnected = module.isPythonLSPConnected;
          // (window as any).initializePythonLSP = module.initializePythonLSP;
          
          // Add a helper function to refresh diagnostics for the current file
          (window as any).refreshCurrentFileDiagnostics = () => {
            if (selectedFile && selectedFile.endsWith('.py')) {
              console.log('🐍 Refreshing diagnostics for current Python file:', selectedFile);
              
              // Предпочитаем использовать глобальную функцию обновления диагностики,
              // которая будет использовать встроенный анализатор mockPythonDiagnostics
              if (typeof (window as any).updatePythonDiagnostics === 'function') {
                (window as any).updatePythonDiagnostics(selectedFile);
                return true;
              } else if (typeof module.forcePythonDiagnosticsUpdate === 'function') {
                module.forcePythonDiagnosticsUpdate(selectedFile);
                return true;
              }
            }
            return false;
          };
          
          // Добавляем функцию getPythonDiagnostics для доступа к текущим маркерам
          (window as any).getPythonDiagnostics = () => {
            if ((window as any).pythonDiagnosticsStore) {
              // Приводим маркеры к формату, который ожидает интерфейс
              const allDiagnostics = [];
              try {
                const models = window.monaco?.editor.getModels() || [];
                for (const model of models) {
                  const uri = model.uri.toString();
                  if (uri.endsWith('.py')) {
                    const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
                    if (markers && markers.length > 0) {
                      const fileName = uri.split('/').pop() || '';
                      
                      allDiagnostics.push({
                        filePath: uri,
                        fileName,
                        issues: markers.map(marker => ({
                          severity: marker.severity === 1 ? 'error' : 
                                   marker.severity === 2 ? 'warning' : 'info',
                          message: marker.message,
                          line: marker.startLineNumber,
                          column: marker.startColumn,
                          endLine: marker.endLineNumber,
                          endColumn: marker.endColumn,
                          source: marker.source || 'python-lint',
                          code: marker.code
                        }))
                      });
                    }
                  }
                }
              } catch (error) {
                console.error('Ошибка при получении Python диагностики:', error);
              }
              return allDiagnostics;
            }
            return [];
          };
        }).catch(err => {
          console.error('Failed to import Python LSP module:', err);
        });
      } catch (error) {
        console.error('Error exposing Python diagnostic functions:', error);
      }
    }
  }, [selectedFile]);

  return (
    <FontSizeContext.Provider value={{ 
      fontSize: editorFontSize, 
      setFontSize: () => {
        // Reread font size from localStorage
        const saved = localStorage.getItem('editor-font-size');
        if (saved) {
          const size = parseInt(saved, 10);
          if (size && !isNaN(size)) {
            setEditorFontSize(size);
          }
        }
      } 
    }}>
      <div className="app-container">
        <TopToolbar
          currentFiles={currentFiles}
          setSelectedFile={handleSetSelectedFile}
          selectedFile={selectedFile}
          selectedFolder={selectedFolder}
          lastOpenedFolder={lastOpenedFolder}
          currentContent={openedFiles.find(f => f.path === selectedFile)?.content}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onCreateNewFile={() => handleCreateFile()}
          onSelectAll={() => editorRef.current?.selectAll()}
          onDeselect={() => editorRef.current?.deselect()}
          onInvertSelection={() => editorRef.current?.invertSelection()}
          onSelectParagraph={() => editorRef.current?.selectParagraph()}
          onExpandSelection={() => editorRef.current?.expandSelection()}
          onShowTerminal={openTerminal}
          onOpenConsole={openTerminal}
          onClearConsole={() => document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'clear' } }))}
          onCloseConsole={toggleTerminal}
          onConsoleSettings={() => document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'settings' } }))}
          onOpenSettings={openSettings}
          onOpenAboutModal={openAboutModal}
          onOpenDocModal={openDocModal}
          onRunPythonDiagnostics={() => {
            window.updateAllPythonDiagnostics && window.updateAllPythonDiagnostics();
            document.dispatchEvent(new CustomEvent('notification', { 
              detail: { 
                message: 'Python диагностика запущена', 
                type: 'info',
                duration: 3000 
              } 
            }));
          }}
        />

        <div className="main-content">
          <LeftToolBar 
            onToggleFileExplorer={() => setIsLeftPanelVisible(!isLeftPanelVisible)} 
            isFileExplorerOpen={isLeftPanelVisible}
            onChangeView={handleViewChange}
            activeView={activeLeftPanel}
          />
          
          <div className="mainwindow-container">
            {isLeftPanelVisible ? (
              <div
                className="left-panel visible"
                style={{ width: leftPanelWidth }}
              >
                <div className="horizontal-resizer" onMouseDown={handleHorizontalDrag} />
                {activeLeftPanel === 'explorer' && (
                  <FileManager
                    selectedFolder={selectedFolder}
                    setSelectedFile={handleSetSelectedFile}
                    setSelectedFolder={setSelectedFolder}
                    setCurrentFiles={(files) => setCurrentFiles(files as unknown as UIFileItem[])}
                    selectedFile={selectedFile}
                    gitChanges={gitInfo.changes}
                    fileIssues={getFileIssuesMap(issues)}
                  />
                )}
                {activeLeftPanel === 'git' && (
                  <GitChanges selectedFolder={selectedFolder} />
                )}
                {activeLeftPanel === 'repositories' && (
                  <Repositories isVisible={true} />
                )}
              </div>
            ) : (
              <button className="restore-button left" onClick={() => setIsLeftPanelVisible(true)}>
                ➤
              </button>
            )}

            <div className="center-and-terminal">
              <div className="monaco-editor-container">
                <div className="editor-container">
                  {console.log('Rendering TopbarEditor with:', { 
                    openedFilesLength: openedFiles?.length,
                    openedFiles,
                    selectedFile
                  })}
                  <TopbarEditor
                    openedFiles={openedFiles}
                    activeFile={selectedFile}
                    setSelectedFile={handleSetSelectedFile}
                    closeFile={handleCloseFile}
                    modifiedFiles={editorRef.current?.getModifiedFiles ? new Set(editorRef.current.getModifiedFiles()) : new Set()}
                    onPreviewHtml={editorRef.current?.openHtmlPreview}
                  />
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
                    onInvertSelection={() => editorRef.current?.invertSelection()}
                    onSelectParagraph={() => editorRef.current?.selectParagraph()}
                    onExpandSelection={() => editorRef.current?.expandSelection()}
                  />
                </div>
                {isTerminalVisible && (
                  <Terminal 
                    terminalHeight={terminalHeight}
                    selectedFolder={selectedFolder}
                    selectedFile={selectedFile}
                    issues={issues}
                    onIssueClick={handleIssueClick}
                    onResize={(newHeight) => setTerminalHeight(newHeight)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <BottomToolbar 
          editorInfo={editorInfo}
          gitInfo={gitInfo} 
          selectedFolder={selectedFolder}
          onGitInfoChange={handleGitInfoChange}
        />
        
        {/* Modal components */}
        <AboutModal isOpen={isAboutModalOpen} onClose={closeAboutModal} />
        <DocumentationModal isOpen={isDocModalOpen} onClose={closeDocModal} />
        <Settings isVisible={isSettingsOpen} onClose={closeSettings} />
        
        {/* Notification component */}
        {notification && (
          <Notification 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
      </div>
    </FontSizeContext.Provider>
  );
}

export default App;