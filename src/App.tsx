import React, { useState, useEffect, useRef, createContext, Dispatch, SetStateAction, Suspense, useCallback } from 'react';
import { FileItem } from './types';
import { configureMonaco } from './monaco-config/index';
import { setCurrentProject } from './main-screen/centerContainer/monacoConfig';
import { invoke } from '@tauri-apps/api/core';
import { fileScannerService, IssueInfo as FileScannerIssueInfo } from './main-screen/centerContainer/fileScannerService';
import { FontFamilyContext, DarkModeContext, FullScreenContext } from './context';
import { useAsyncInitialization } from './hooks/useAsyncInitialization';

import TopToolbar from './main-screen/top-toolbar/toolbar';
import FileManager from './main-screen/leftBar/FileManager';
import Terminal from './main-screen/terminal/terminal';
import BottomToolbar from './main-screen/bottom-toolbar/bottomBar';
import LeftToolBar from './main-screen/lefttoolbar/LeftToolBar';
import { GitChanges } from './main-screen/lefttoolbar/GitChanges';
import Repositories from './main-screen/lefttoolbar/repositories/Repositories';
import AboutModal from './components/about/AboutModal';
import DocumentationModal from './components/documentation/DocumentationModal';
import EditorPanelContainer from './components/EditorPanelContainer';

import './App.css';

export interface UIFileItem extends FileItem {
  icon: string;
  type?: string;
  isDirectory?: boolean;
  content?: string;
}

// Интерфейс для файлов в EditorPanelContainer
export interface ExtendedFileItem extends FileItem {
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
  changes?: GitChange[];
}

interface GitChange {
  path: string;
  status: string;
}

// Create a context for sharing font size across components
export const FontSizeContext = createContext<{
  fontSize: number;
  setFontSize: Dispatch<SetStateAction<number>>;
}>({
  fontSize: 14,
  setFontSize: () => {}
});

interface AppState {
  leftPanelWidth: number;
  terminalHeight: number;
  isLeftPanelVisible: boolean;
  isTerminalVisible: boolean;
  activeLeftPanel: string;
  selectedFolder: string | null;
  selectedFile: string | null;
  currentFiles: UIFileItem[];
  openedFiles: UIFileItem[];
  monaco: any;
  lastOpenedFolder: string | null;
  editorFontSize: number;
  editorRef: React.RefObject<{ 
    selectAll: () => void; 
    deselect: () => void;
    invertSelection: () => void;
    expandSelection: () => void;
  }>;
  editorInfo: {
    errors: number;
    warnings: number;
    language: string;
    encoding: string;
    cursorInfo: {
      line: number;
      column: number;
      totalChars: number;
    };
  };
  issues: IssueInfo[];
  isAboutModalOpen: boolean;
  isDocModalOpen: boolean;
  gitInfo: GitInfo;
  shouldRefreshFiles: boolean;
  isSplitView: boolean;
  secondaryFile: string | null;
  fileIssues: FileScannerIssueInfo[];
  totalErrors: number;
  totalWarnings: number;
  scanIntervalId?: NodeJS.Timeout;
}

function App() {
  const [state, setState] = useState<AppState>({
    leftPanelWidth: 250,
    terminalHeight: 200,
    isLeftPanelVisible: true,
    isTerminalVisible: true,
    activeLeftPanel: 'explorer',
    selectedFolder: null,
    selectedFile: null,
    currentFiles: [],
    openedFiles: [],
    monaco: null,
    lastOpenedFolder: null,
    editorFontSize: (() => {
      const saved = localStorage.getItem('editor-font-size');
      return saved ? parseInt(saved, 10) : 14;
    })(),
    editorRef: React.createRef(),
    editorInfo: {
      errors: 0,
      warnings: 0,
      language: 'plaintext',
      encoding: 'UTF-8',
      cursorInfo: {
        line: 1,
        column: 1,
        totalChars: 0
      }
    },
    issues: [],
    isAboutModalOpen: false,
    isDocModalOpen: false,
    gitInfo: {
      current_branch: '---',
      status: 'none',
      changes: []
    },
    shouldRefreshFiles: false,
    isSplitView: false,
    secondaryFile: null,
    fileIssues: [],
    totalErrors: 0,
    totalWarnings: 0,
  });

  const MIN_LEFT_PANEL_WIDTH = 150;
  const COLLAPSE_THRESHOLD = 50;
  const MAX_LEFT_PANEL_WIDTH = 400;
  const MIN_TERMINAL_HEIGHT = 60;
  const MAX_TERMINAL_HEIGHT = 500;

  // Добавляем состояния для результатов сканирования
  const [fileIssuesFromScanner, setFileIssuesFromScanner] = useState<FileScannerIssueInfo[]>([]);
  const [scannerErrorCount, setScannerErrorCount] = useState(0);
  const [scannerWarningCount, setScannerWarningCount] = useState(0);
  const [scanIntervalId, setScanIntervalId] = useState<NodeJS.Timeout | undefined>(undefined);

  // Функции для изменения масштаба
  const handleZoomIn = () => {
    console.log('App.tsx: handleZoomIn called');
    const newFontSize = Math.min(state.editorFontSize + 2, 32);
    setState(prev => ({ ...prev, editorFontSize: newFontSize }));
    localStorage.setItem('editor-font-size', newFontSize.toString());
    
    // Apply to all editors directly
    setTimeout(() => {
      if (state.monaco && state.monaco.editor) {
        const editors = state.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach((editor: any) => {
            editor.updateOptions({ fontSize: newFontSize });
          });
        }
      }
    }, 0);
  };

  const handleZoomOut = () => {
    console.log('App.tsx: handleZoomOut called');
    const newFontSize = Math.max(state.editorFontSize - 2, 8);
    setState(prev => ({ ...prev, editorFontSize: newFontSize }));
    localStorage.setItem('editor-font-size', newFontSize.toString());
    
    // Apply to all editors directly
    setTimeout(() => {
      if (state.monaco && state.monaco.editor) {
        const editors = state.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach((editor: any) => {
            editor.updateOptions({ fontSize: newFontSize });
          });
        }
      }
    }, 0);
  };

  const handleResetZoom = () => {
    console.log('App.tsx: handleResetZoom called');
    const defaultFontSize = 14;
    setState(prev => ({ ...prev, editorFontSize: defaultFontSize }));
    localStorage.setItem('editor-font-size', defaultFontSize.toString());
    
    // Apply to all editors directly
    setTimeout(() => {
      if (state.monaco && state.monaco.editor) {
        const editors = state.monaco.editor.getEditors();
        if (editors.length > 0) {
          editors.forEach((editor: any) => {
            editor.updateOptions({ fontSize: defaultFontSize });
          });
        }
      }
    }, 0);
  };

  useEffect(() => {
    if (state.monaco) {
      configureMonaco(state.openedFiles);
    }
  }, [state.monaco, state.openedFiles]);

  useEffect(() => {
    if (state.selectedFolder) {
      setCurrentProject(state.selectedFolder);
    }
  }, [state.selectedFolder]);

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
        setState(prev => ({ ...prev, monaco: window.monaco }));
        
        // Инициализируем сервис сканирования
        fileScannerService.initialize(window.monaco);
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
    setState(prev => ({ ...prev, selectedFile: filePath }));
  };

  const handleCloseFile = (filePath: string) => {
    const updatedFiles = state.openedFiles.filter(file => file.path !== filePath);
    setState(prev => ({
      ...prev,
      openedFiles: updatedFiles,
      selectedFile: updatedFiles.length > 0 ? updatedFiles[updatedFiles.length - 1].path : null
    }));
  };

  const handleCreateFile = () => {
    const newFile: UIFileItem = {
      name: 'Без названия 1',
      path: `untitled-${Date.now()}`,
      isFolder: false,
      icon: 'file', // Добавляем обязательное поле icon
      isDirectory: false, // Исправляем с is_directory на isDirectory
    };
    setState(prev => ({
      ...prev,
      openedFiles: [...prev.openedFiles, newFile],
      selectedFile: newFile.path
    }));
  };

  const handleHorizontalDrag = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = state.leftPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = startWidth + delta;

      if (newWidth <= MIN_LEFT_PANEL_WIDTH - COLLAPSE_THRESHOLD) {
        setState(prev => ({ ...prev, isLeftPanelVisible: false }));
        document.removeEventListener('mousemove', onMouseMove);
      } else {
        setState(prev => ({
          ...prev,
          leftPanelWidth: Math.min(Math.max(MIN_LEFT_PANEL_WIDTH, newWidth), MAX_LEFT_PANEL_WIDTH)
        }));
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
    const startHeight = state.terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      let newHeight = startHeight + delta;

      newHeight = Math.min(Math.max(newHeight, MIN_TERMINAL_HEIGHT), MAX_TERMINAL_HEIGHT);
      
      if (newHeight <= MIN_TERMINAL_HEIGHT + COLLAPSE_THRESHOLD) {
        setState(prev => ({ ...prev, isTerminalVisible: false }));
        document.removeEventListener('mousemove', onMouseMove);
      } else {
        setState(prev => ({ ...prev, terminalHeight: newHeight }));
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
    console.log("Restoring terminal, current visibility:", state.isTerminalVisible);
    // Force terminal to be visible regardless of previous state
    setState(prev => ({ ...prev, isTerminalVisible: true }));
    // Ensure terminal has a reasonable height
    setState(prev => ({
      ...prev,
      terminalHeight: Math.max(200, prev.terminalHeight)
    }));
  };

  const handleIssueClick = (filePath: string, line: number, column: number) => {
    // Выбираем файл
    handleSetSelectedFile(filePath);
    
    // В будущем можно добавить логику для перехода к конкретной строке в редакторе
    console.log(`Navigate to issue: ${filePath}:${line}:${column}`);
  };

  // More explicit terminal toggle function
  // @ts-ignore - функция будет использоваться в будущем
  const toggleTerminal = () => {
    console.log("Toggling terminal, current state:", state.isTerminalVisible);
    if (state.isTerminalVisible) {
      console.log("Hiding terminal");
      setState(prev => ({ ...prev, isTerminalVisible: false }));
    } else {
      console.log("Showing terminal");
      handleRestoreTerminal();
    }
  };

  // Explicit open terminal function
  const openTerminal = () => {
    console.log("Explicitly opening terminal");
    if (!state.isTerminalVisible) {
      console.log("Terminal was hidden, now showing it");
    }
    handleRestoreTerminal();
  };

  // Function to restart terminal process
  // @ts-ignore - функция будет использоваться в будущем
  const restartTerminalProcess = () => {
    console.log("Restarting terminal process");
    document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'restart' } }));
  };

  // Listen for terminal close events
  useEffect(() => {
    const handleTerminalClose = () => {
      console.log("Terminal close event received");
      setState(prev => ({ ...prev, isTerminalVisible: false }));
    };
    
    document.addEventListener('terminal-close', handleTerminalClose);
    
    return () => {
      document.removeEventListener('terminal-close', handleTerminalClose);
    };
  }, []);

  // Listen for open-folder events
  useEffect(() => {
    const handleOpenFolder = (event: Event) => {
      const customEvent = event as unknown as CustomEvent;
      console.log("Open folder event received", customEvent.detail);
      const { path } = customEvent.detail || {};
      
      if (path) {
        // Set the selected folder to the path provided
        setState(prev => ({
          ...prev,
          selectedFolder: path,
          activeLeftPanel: 'explorer',
          isLeftPanelVisible: true,
          lastOpenedFolder: path
        }));
      }
    };
    
    document.addEventListener('open-folder', handleOpenFolder as unknown as EventListener);
    
    return () => {
      document.removeEventListener('open-folder', handleOpenFolder as unknown as EventListener);
    };
  }, [state.isLeftPanelVisible]);

  // Functions to open/close modals
  const openAboutModal = () => setState(prev => ({ ...prev, isAboutModalOpen: true }));
  const closeAboutModal = () => setState(prev => ({ ...prev, isAboutModalOpen: false }));
  const openDocModal = () => setState(prev => ({ ...prev, isDocModalOpen: true }));
  const closeDocModal = () => setState(prev => ({ ...prev, isDocModalOpen: false }));

  const handleViewChange = (viewName: string) => {
    setState(prev => ({ ...prev, activeLeftPanel: viewName, isLeftPanelVisible: true }));
  };

  // Обработчик изменения Git информации
  const handleGitInfoChange = (updatedGitInfo: GitInfo) => {
    // Обновляем gitInfo в App
    setState(prev => ({ ...prev, gitInfo: updatedGitInfo, shouldRefreshFiles: true }));
  };
  
  // Эффект для обновления списка файлов при смене ветки
  useEffect(() => {
    if (state.shouldRefreshFiles && state.selectedFolder) {
      console.log('Обновляем список файлов после смены ветки');
      
      // Сбрасываем флаг
      setState(prev => ({ ...prev, shouldRefreshFiles: false }));
      
      // Инициируем перезагрузку списка файлов
      const refreshFiles = async () => {
        try {
          // Получаем содержимое директории напрямую через tauri
          const files = await invoke('get_directory_tree', { path: state.selectedFolder }) as any;
          
          // Обновляем текущие файлы
          if (files && files.children) {
            setState(prev => ({ ...prev, currentFiles: files.children as UIFileItem[] }));
          }
        } catch (error) {
          console.error('Ошибка при обновлении списка файлов:', error);
        }
      };
      
      refreshFiles();
    }
  }, [state.shouldRefreshFiles, state.selectedFolder]);

  // Обновляем gitInfo при изменении selectedFolder
  useEffect(() => {
    const updateGitInfo = async () => {
      if (state.selectedFolder) {
        try {
          const info = await invoke('get_git_info', { projectRoot: state.selectedFolder });
          setState(prev => ({ ...prev, gitInfo: info as GitInfo }));
        } catch (error) {
          console.error('Error getting git info:', error);
          setState(prev => ({ ...prev, gitInfo: { current_branch: '---', status: 'none', changes: [] } }));
        }
      } else {
        setState(prev => ({ ...prev, gitInfo: { current_branch: '---', status: 'none', changes: [] } }));
      }
    };

    updateGitInfo();
  }, [state.selectedFolder]);

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

  // Обработчик запуска отладки
  const handleDebugStart = (filePath: string) => {
    console.log('Запуск отладки для файла:', filePath);
    
    // Здесь будет логика для запуска отладки
    // Например, отправка команды на бэкенд через Tauri
    if (filePath) {
      const extension = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
      
      // Определяем действие в зависимости от типа файла
      let command = '';
      let args: string[] = [];
      
      switch (extension) {
        case 'js':
        case 'ts':
          command = 'node';
          args = [filePath];
          break;
        case 'py':
          command = 'python';
          args = [filePath];
          break;
        case 'html':
          // Для HTML файлов можно открыть в браузере
          invoke('open_in_browser', { path: filePath });
          return;
        default:
          console.log(`Отладка для файлов с расширением .${extension} не поддерживается`);
          return;
      }
      
      // Запускаем терминал, если он не открыт
      if (!state.isTerminalVisible) {
        setState(prev => ({ ...prev, isTerminalVisible: true }));
      }
      
      // Выполняем команду в терминале
      invoke('run_command_in_terminal', { 
        command, 
        args,
        cwd: state.selectedFolder || undefined 
      }).catch(err => {
        console.error('Ошибка запуска команды:', err);
      });
    }
  };
  
  // Обработчик разделения редактора
  const handleSplitEditor = (filePath: string) => {
    console.log(`App.tsx: Запрос на разделение редактора с файлом ${filePath}`);
    
    // Проверяем, не пытаемся ли мы разделить с тем же файлом, который уже активен
    if (state.selectedFile === filePath && state.isSplitView) {
      // Если да, то просто закрываем режим разделения
      setState(prev => ({ ...prev, isSplitView: false, secondaryFile: null }));
    } else {
      // Если режим разделения уже активен, просто меняем вторичный файл
      if (state.isSplitView) {
        setState(prev => ({ ...prev, secondaryFile: filePath }));
      } else {
        // Устанавливаем режим разделенного представления и вторичный файл
        setState(prev => ({ ...prev, isSplitView: true, secondaryFile: filePath }));
      }
    }
    
    // Определяем, есть ли файл в списке открытых
    const fileExists = state.openedFiles.some(file => file.path === filePath);
    console.log(`Файл ${filePath} ${fileExists ? 'найден' : 'не найден'} в списке открытых файлов`);
    
    // Если файл не открыт, добавляем его в список открытых файлов
    if (!fileExists) {
      // Получаем имя файла из пути
      const fileName = filePath.split(/[/\\]/).pop() || '';
      console.log(`Добавляем файл ${fileName} в список открытых файлов`);
      
      // Добавляем файл в список открытых
      const newFile: UIFileItem = {
        name: fileName, 
        path: filePath,
        isFolder: false,
        icon: 'file', // добавляем обязательное свойство
        isDirectory: false, // Исправляем с is_directory на isDirectory
      };
      setState(prev => ({ ...prev, openedFiles: [...prev.openedFiles, newFile] }));
    }
  };

  // Функция для конвертации UIFileItem в ExtendedFileItem
  const convertToExtendedFileItem = (files: UIFileItem[] | undefined): ExtendedFileItem[] => {
    // Защита от undefined массива
    if (!files || !Array.isArray(files)) {
      console.warn('convertToExtendedFileItem: files is undefined or not an array');
      return [];
    }
    
    // Фильтруем undefined элементы для дополнительной защиты
    return files.filter(file => file !== undefined).map(file => ({
      ...file,
      // Преобразование полей при необходимости
    }));
  };

  // Функция для сканирования папки
  const scanFolder = async (folderPath: string) => {
    console.log(`Scanning folder for issues: ${folderPath}`);
    
    try {
      const scanResult = await fileScannerService.scanDirectory(folderPath);
      
      setFileIssuesFromScanner(scanResult.allIssues);
      setScannerErrorCount(scanResult.errorCount);
      setScannerWarningCount(scanResult.warningCount);
      
      console.log(`Scan completed: ${scanResult.errorCount} errors, ${scanResult.warningCount} warnings`);
    } catch (error) {
      console.error('Error scanning folder for issues:', error);
    }
  };

  // Функция для планирования периодического сканирования
  const scheduleFolderScan = (folderPath: string) => {
    if (!folderPath) return;
    
    // Сканируем папку сразу
    scanFolder(folderPath);
    
    // Очищаем предыдущий интервал, если он был
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
    }
    
    // Устанавливаем новый интервал для периодического сканирования
    const intervalId = setInterval(() => {
      // Проверяем, что выбранная папка не изменилась
      if (state.selectedFolder === folderPath) {
        scanFolder(folderPath);
      } else {
        clearInterval(intervalId);
      }
    }, 60000); // Сканируем каждую минуту
    
    setScanIntervalId(intervalId);
  };

  // Добавляем эффект для очистки интервала при размонтировании
  useEffect(() => {
    return () => {
      if (scanIntervalId) {
        clearInterval(scanIntervalId);
      }
    };
  }, [scanIntervalId]);

  // Обновляем функцию проверки Monaco для инициализации сканера
  const checkMonaco = () => {
    if (window.monaco) {
      console.log('Monaco is now available on window');
      setState(prev => ({ ...prev, monaco: window.monaco }));
      
      // Инициализируем сервис сканирования
      fileScannerService.initialize(window.monaco);
    } else {
      console.log('Monaco not yet available, retrying in 1 second');
      setTimeout(checkMonaco, 1000);
    }
  };

  // Добавляем сканирование при изменении выбранной папки
  useEffect(() => {
    if (state.selectedFolder) {
      // Запускаем сканирование при изменении выбранной папки
      scheduleFolderScan(state.selectedFolder);
    }
  }, [state.selectedFolder]);

  // Добавим эффект для сканирования
  useEffect(() => {
    // Обработчик для запуска сканирования папки
    const handleScanFolder = async (event: CustomEvent) => {
      const { folderPath } = event.detail || {};
      if (folderPath) {
        try {
          console.log(`Scanning folder for issues: ${folderPath}`);
          const scanResult = await fileScannerService.scanDirectory(folderPath);
          
          setFileIssuesFromScanner(scanResult.allIssues);
          setScannerErrorCount(scanResult.errorCount);
          setScannerWarningCount(scanResult.warningCount);
          
          console.log(`Scan completed: ${scanResult.errorCount} errors, ${scanResult.warningCount} warnings`);
        } catch (error) {
          console.error('Error scanning folder:', error);
        }
      }
    };
    
    // Регистрируем обработчик события
    window.addEventListener('scan-folder', handleScanFolder as unknown as EventListener);
    
    // Очищаем при размонтировании
    return () => {
      window.removeEventListener('scan-folder', handleScanFolder as unknown as EventListener);
    };
  }, []);

  // Обработчик для сканирования файлов с корректной типизацией
  const handleScanFolder = useCallback(async (event: Event) => {
    const customEvent = event as unknown as CustomEvent;
    const { folderPath } = customEvent.detail || {};
    if (folderPath) {
      try {
        console.log(`Scanning folder for issues: ${folderPath}`);
        const scanResult = await fileScannerService.scanDirectory(folderPath);
        
        setFileIssuesFromScanner(scanResult.allIssues);
        setScannerErrorCount(scanResult.errorCount);
        setScannerWarningCount(scanResult.warningCount);
        
        console.log(`Scan completed: ${scanResult.errorCount} errors, ${scanResult.warningCount} warnings`);
      } catch (error) {
        console.error('Error scanning folder:', error);
      }
    }
  }, []);
  
  // Корректная типизация для addEventListener
  useEffect(() => {
    // Регистрируем обработчик события с корректной типизацией
    window.addEventListener('scan-folder', handleScanFolder as unknown as EventListener);
    
    // Очищаем при размонтировании
    return () => {
      window.removeEventListener('scan-folder', handleScanFolder as unknown as EventListener);
    };
  }, [handleScanFolder]);

  return (
    <FontSizeContext.Provider value={{ 
      fontSize: state.editorFontSize, 
      setFontSize: (size: React.SetStateAction<number>) => setState(prev => ({
        ...prev, 
        editorFontSize: typeof size === 'function' ? size(prev.editorFontSize) : size
      }))
    }}>
    <div className="app-container">
        <TopToolbar 
          currentFiles={(state.currentFiles || []).map(file => ({
            ...file, 
            icon: file.isFolder ? 'folder' : 'file',
            isFolder: file.isFolder || false
          }))} 
          setSelectedFile={handleSetSelectedFile}
          selectedFolder={state.selectedFolder}
          selectedFile={state.selectedFile}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onSelectAll={() => state.editorRef.current?.selectAll()}
          onDeselect={() => state.editorRef.current?.deselect()}
          onInvertSelection={() => state.editorRef.current?.invertSelection()}
          onExpandSelection={() => state.editorRef.current?.expandSelection()}
          onOpenConsole={openTerminal}
          onClearConsole={() => document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'clear' } }))}
          onCloseConsole={() => setState(prev => ({ ...prev, isTerminalVisible: false }))}
          onConsoleSettings={() => document.dispatchEvent(new CustomEvent('terminal-command', { detail: { command: 'settings' } }))}
          onOpenAboutModal={openAboutModal}
          onOpenDocModal={openDocModal}
        />

      <div className="main-content">
          <LeftToolBar 
            onToggleFileExplorer={() => setState(prev => ({ ...prev, isLeftPanelVisible: !prev.isLeftPanelVisible }))} 
            isFileExplorerOpen={state.isLeftPanelVisible}
            onChangeView={handleViewChange}
            activeView={state.activeLeftPanel}
          />
          
          <div className="mainwindow-container">
        {state.isLeftPanelVisible ? (
              <div
                className="left-panel visible"
                style={{ width: state.leftPanelWidth }}
              >
                <div className="horizontal-resizer" onMouseDown={handleHorizontalDrag} />
                {state.activeLeftPanel === 'explorer' && (
            <FileManager
              selectedFolder={state.selectedFolder}
              setSelectedFile={handleSetSelectedFile}
                    setSelectedFolder={(path) => setState(prev => ({ ...prev, selectedFolder: path }))}
                    setCurrentFiles={(files) => setState(prev => ({ ...prev, currentFiles: files as unknown as UIFileItem[] }))}
                    selectedFile={state.selectedFile}
                    gitChanges={state.gitInfo.changes || []}
                    fileIssues={getFileIssuesMap(state.issues)}
                  />
                )}
                {state.activeLeftPanel === 'git' && (
                  <GitChanges selectedFolder={state.selectedFolder} />
                )}
                {state.activeLeftPanel === 'repositories' && (
                  <Repositories isVisible={true} />
                )}
          </div>
        ) : (
          <button className="restore-button left" onClick={() => setState(prev => ({ ...prev, isLeftPanelVisible: true }))}>
            ➤
          </button>
        )}

        <div className="center-and-terminal">
              <div className="monaco-editor-container">
                <div className="editor-container">
                  <EditorPanelContainer
                    openedFiles={convertToExtendedFileItem(state.openedFiles)}
                    activeFile={state.selectedFile}
                    setSelectedFile={handleSetSelectedFile}
                    closeFile={handleCloseFile}
                    handleCreateFile={handleCreateFile}
                    selectedFolder={state.selectedFolder}
                    setSelectedFolder={(path) => setState(prev => ({ ...prev, selectedFolder: path }))}
                    onEditorInfoChange={(editorInfo) => {
                      if (editorInfo && typeof editorInfo === 'function') {
                        setState(editorInfo);
                      } else {
                        setState(prev => ({
                          ...prev,
                          editorInfo: {
                            ...prev.editorInfo,
                            ...(editorInfo?.editorInfo || {})
                          }
                        }));
                      }
                    }}
                    onIssuesChange={setState}
                    onDebugStart={handleDebugStart}
                    onSplitEditor={handleSplitEditor}
                    isSplitView={state.isSplitView}
                    secondaryFile={state.secondaryFile}
                    setOpenedFiles={(files) => {
                      if (Array.isArray(files)) {
                        // Конвертируем ExtendedFileItem[] в UIFileItem[]
                        const validFiles = files.filter(file => file !== undefined);
                        const convertedFiles = validFiles.map(file => ({
                          ...file,
                          icon: file.icon || 'file' // Убедимся, что icon всегда присутствует
                        } as UIFileItem));
                        
                        setState(prev => ({ ...prev, openedFiles: convertedFiles }));
                      } else if (typeof files === 'function') {
                        // Если это функция обновления
                        setState(prev => {
                          // Защита от undefined в openedFiles
                          const currentFiles = prev.openedFiles || [];
                          
                          try {
                            // Применяем функцию обновления
                            const updatedFiles = files(currentFiles);
                            
                            // Проверяем результат
                            if (!Array.isArray(updatedFiles)) {
                              console.warn('setOpenedFiles: функция не вернула массив');
                              return prev;
                            }
                            
                            // Фильтруем undefined элементы и добавляем значение по умолчанию для icon
                            const safeUpdatedFiles = updatedFiles
                              .filter(file => file !== undefined)
                              .map(file => ({
                                ...file,
                                icon: file.icon || 'file'
                              } as UIFileItem));
                            
                            return {
                              ...prev,
                              openedFiles: safeUpdatedFiles
                            };
                          } catch (error) {
                            console.error('Ошибка при обновлении открытых файлов:', error);
                            return prev;
                          }
                        });
                      } else {
                        console.warn('setOpenedFiles: неожиданный тип аргумента', typeof files);
                      }
                    }}
                  />
                </div>
                {state.isTerminalVisible && (
                  <Terminal 
                    terminalHeight={state.terminalHeight}
                    selectedFolder={state.selectedFolder}
                    issues={fileIssuesFromScanner}
                    onIssueClick={handleIssueClick}
                  />
                )}
          </div>
            </div>
          </div>
        </div>

        <div className="bottom-section-container">
          <BottomToolbar
            editorInfo={{
              errors: scannerErrorCount,
              warnings: scannerWarningCount,
              language: state.editorInfo?.language || 'plaintext',
              encoding: "UTF-8",
              cursorInfo: state.editorInfo?.cursorInfo || {},
              gitBranch: state.gitInfo?.current_branch || ''
            }}
            gitInfo={state.gitInfo || {}} 
            selectedFolder={state.selectedFolder}
            onGitInfoChange={handleGitInfoChange}
          />
        </div>
        
        {/* Modal components */}
        <AboutModal isOpen={state.isAboutModalOpen} onClose={closeAboutModal} />
        <DocumentationModal isOpen={state.isDocModalOpen} onClose={closeDocModal} />
      </div>
    </FontSizeContext.Provider>
  );
}

export default App;