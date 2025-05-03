import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { invoke } from '@tauri-apps/api/core';
import { listen } from "@tauri-apps/api/event";
import { RefreshCw, Search, ChevronRight, ChevronDown, File, AlertCircle, AlertTriangle, Info , X, GripHorizontal, Check } from "lucide-react";
import { getFileIcon } from "../leftBar/fileIcons";
import { AiOutlineClear } from "react-icons/ai";
import { FaFilter, FaPython } from "react-icons/fa";
import { getTerminalSettings } from "../../utils/settingsManager";

import "./style.css";
import "xterm/css/xterm.css";

interface Issue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  source?: string;
  code?: string;
}

interface IssueInfo {
  filePath: string;
  fileName: string;
  issues: Issue[];
}

interface XTermTerminalProps {
  terminalHeight?: number;
  issues?: IssueInfo[];
  onIssueClick?: (filePath: string, line: number, column: number) => void;
  terminalCommand?: string | null;
  selectedFolder?: string | null;
  onResize?: (newHeight: number) => void;
  selectedFile?: string;
}

// Расширенное объявление глобальных интерфейсов
declare global {
  interface Window {
    pythonDiagnostics?: Map<string, IssueInfo>;
    problemCollector?: {
      scan: () => void;
    };
    lastKnownMarkers: Record<string, any[]>;
    forceDiagnosticsRefresh: () => void;
    monaco: typeof import("monaco-editor");
    pythonDiagnosticsStore?: any;
    _latestErrorCount?: number;
    _latestWarningCount?: number;
    lastActiveFilePath?: string;
    // Новые свойства для работы с Python диагностикой
    getPythonDiagnosticsForUri?: (uri: string) => any[];
    forcePythonCheck?: (uri: string) => void;
    // Кэш для хранения ошибок открытых файлов
    errorsCache: Record<string, IssueInfo>;
    // Список всех файлов, которые были открыты в течение сессии
    openedFiles: Set<string>;
    _renderIssuesErrorCount?: number;
    _renderIssuesWarningCount?: number;
    _errorsInCurrentFile?: number;
    _warningsInCurrentFile?: number;
    updateFileErrorIcon?: (filePath: string, iconType: 'error' | 'warning') => void;
    _lastKeyPressTime?: number;
    _isCurrentlyEditing?: boolean;
    _editingTimer?: ReturnType<typeof setTimeout>;
    clearFileMarkers?: (filePath: string) => void;
  }
}

// Интерфейс для моделей Monaco
interface MonacoModel {
  uri: { toString: () => string };
  getValue: () => string;
  isDisposed: () => boolean;
  onDidChangeContent: (listener: Function) => { dispose: () => void };
  _jsonContentHandlerAdded?: boolean;
}

// Добавлю константу для отладки
const DEBUG_PROBLEMS = true;
  
// Добавлю функцию логирования проблем для улучшенной отладки
function logProblems(message: string, data?: any) {
  if (DEBUG_PROBLEMS) {
    console.log(`⚠️ [Problems] ${message}`, data || '');
  }
}

// Добавлю компонент для явной отладки проблем, который будет отображаться в режиме разработки
const ProblemDebugger: React.FC<{ issues: IssueInfo[] }> = ({ issues }) => {
  if (!DEBUG_PROBLEMS) return null;
  
  const totalIssues = issues.reduce((acc, issue) => acc + issue.issues.length, 0);
  const hasErrors = issues.some(issue => issue.issues.some(i => i.severity === 'error'));
  
  return (
    <div style={{ 
      position: 'absolute', 
      bottom: '5px', 
      right: '5px',
      background: hasErrors ? '#FF000050' : '#00FF0050',
      padding: '2px 5px',
      borderRadius: '3px',
      fontSize: '10px',
      zIndex: 1000
    }}>
      {totalIssues} проблем ({issues.length} файлов)
    </div>
  );
};

const Terminal: React.FC<XTermTerminalProps> = (props) => {
  const { terminalHeight = 200, issues, onIssueClick, terminalCommand, selectedFolder, onResize, selectedFile } = props;
  const [activeTab, setActiveTab] = useState<"terminal" | "issues">("terminal");
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<XTerm | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const [isProcessRunning, setIsProcessRunning] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [showIssueFilters, setShowIssueFilters] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    errors: true,
    warnings: true,
    info: true
  });
  const [terminalSettings, setTerminalSettings] = useState(getTerminalSettings());
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [errorCount, setErrorCount] = useState<number>(0);
  const [warningCount, setWarningCount] = useState<number>(0);
  // Состояние для отслеживания наличия проблем
  const [hasProblems, setHasProblems] = useState<boolean>(false);
  // Состояние для принудительного обновления интерфейса при изменении проблем
  const [issuesUpdated, setIssuesUpdated] = useState<number>(0);
  // Добавляем новое состояние для отслеживания активного файла
  const [activeFile, setActiveFile] = useState<string>('');

  // Очистка терминала
  const clearTerminal = () => {
    if (terminal.current) {
      terminal.current.clear();
    }
  };

  // Скрыть всю панель терминала
  const hideTerminalPanel = () => {
    document.querySelector(".restore-button.bottom")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
  };

  // Handle the vertical resizing of the terminal
  const handleVerticalDrag = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    e.preventDefault();
    const startY = e.clientY;
    const currentHeight = terminalHeight || 200;
    
    const MIN_TERMINAL_HEIGHT = 60;
    const MAX_TERMINAL_HEIGHT = window.innerHeight * 0.8; // 80% of window height
    const COLLAPSE_THRESHOLD = 30;

    const onMouseMove = (moveEvent: MouseEvent) => {
      // For the terminal at the bottom, dragging up (negative delta) should increase height
      const delta = moveEvent.clientY - startY;
      let newHeight = currentHeight - delta; // Invert delta for intuitive behavior
      
      // Ensure terminal height stays within limits
      newHeight = Math.max(Math.min(newHeight, MAX_TERMINAL_HEIGHT), MIN_TERMINAL_HEIGHT);
      
      // If dragged to be very small, collapse it
      if (newHeight <= MIN_TERMINAL_HEIGHT + COLLAPSE_THRESHOLD && delta > 0) { // Changed delta condition
        // Trigger terminal close
        document.dispatchEvent(new Event('terminal-close'));
        // Clean up event listeners
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        return;
      }
      
      // Call the resize callback
      if (onResize) {
        onResize(newHeight);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      // Fit the terminal to the new size
      setTimeout(() => {
        resizeTerminal().catch(console.error);
      }, 100);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Функция изменения размера терминала
  const resizeTerminal = async () => {
    if (fitAddon.current && terminal.current) {
      try {
        fitAddon.current.fit();
        const { rows, cols } = terminal.current;
        await invoke("resize_pty", { rows, cols }).catch((err: Error) => {
          console.error("Failed to resize PTY:", err);
        });
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }
    }
  };

  // Запуск процесса в терминале
  const startTerminalProcess = async () => {
    if (!terminal.current || isProcessRunning) return;

    try {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
      
      if (terminal.current) {
        const { rows, cols } = terminal.current;
        
        terminal.current.write("\r\n\x1b[33mStarting terminal process...\x1b[0m\r\n");
        
        await invoke("start_process");
        await invoke("resize_pty", { rows, cols }).catch((err: Error) => {
          console.error("Failed to resize PTY:", err);
        });
        
        setIsProcessRunning(true);
        terminal.current.write("\r\n\x1b[32mProcess started successfully\x1b[0m\r\n");
      }
    } catch (err: unknown) {
      console.error("Failed to start process:", err);
      if (terminal.current) {
        terminal.current.write(`\r\n\x1b[31mFailed to start terminal process: ${err}\x1b[0m\r\n`);
      }
      setIsProcessRunning(false);
    }
  };

  // Перезапуск процесса в терминале
  const restartTerminalProcess = async () => {
    try {
      await invoke("kill_process").catch((err: Error) => {
        console.error("Failed to kill process:", err);
      });
      setIsProcessRunning(false);
      
      // После убийства процесса запускаем новый
      setTimeout(() => {
        startTerminalProcess();
      }, 500);
    } catch (err: unknown) {
      console.error("Error killing terminal process:", err);
    }
  };

  // Инициализация терминала
  useEffect(() => {
    const initTerminal = async () => {
      try {
        // Если терминал уже инициализирован, выходим
        if (terminal.current || !terminalRef.current) return;

        const term = new XTerm({
          cursorBlink: terminalSettings.cursorBlink,
          fontSize: terminalSettings.fontSize,
          fontFamily: terminalSettings.fontFamily,
          cursorStyle: terminalSettings.cursorStyle as any,
          theme: {
            background: "#1e1e1e",
            foreground: "#d4d4d4",
            cursor: "#45fce4",
            selectionBackground: "rgba(255,255,255,0.3)",
          },
          scrollback: 5000,
          convertEol: true,
          allowTransparency: true,
          windowsMode: true,
          allowProposedApi: true,
        });

        const fit = new FitAddon();
        const webLinks = new WebLinksAddon();
        const unicode11 = new Unicode11Addon();

        term.loadAddon(fit);
        term.loadAddon(webLinks);
        term.loadAddon(unicode11);

        term.unicode.activeVersion = '11';

        terminal.current = term;
        fitAddon.current = fit;

        if (terminalRef.current) {
          term.open(terminalRef.current);
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        fit.fit();

        term.onData((data) => {
          invoke("send_input", { input: data }).catch((err: Error) => {
            console.error("Failed to send input:", err);
            term.write(`\r\n\x1b[31mError: ${err}\x1b[0m\r\n`);
          });
        });

        // Наблюдатель за изменением размера
        const resizeObserver = new ResizeObserver(() => {
          resizeTerminal().catch(console.error);
        });

        if (terminalRef.current) {
          // Use type assertion to avoid the TypeScript error
          const element = terminalRef.current as unknown as Element;
          resizeObserver.observe(element);
        }

        // Слушатель вывода процесса
        const unlisten = await listen<string>("pty-output", (event) => {
          if (terminal.current) {
            terminal.current.write(event.payload);
          }
        });

        unlistenRef.current = unlisten;

        // Запускаем процесс после инициализации терминала
        await startTerminalProcess();

        // Функция очистки при размонтировании
        return () => {
          resizeObserver.disconnect();
          if (unlistenRef.current) {
            unlistenRef.current();
          }
          if (terminal.current) {
            terminal.current.dispose();
          }
        };
      } catch (error) {
        console.error("Error initializing terminal:", error);
      }
    };

    // Инициализируем терминал только если активная вкладка - "terminal"
    if (activeTab === "terminal") {
      initTerminal().catch(console.error);
    }
  }, [activeTab, terminalSettings]);

  // Эффект для обработки изменения вкладок
  useEffect(() => {
    if (activeTab !== "terminal") {
      // Если переключились с вкладки "terminal", уничтожаем терминал
      if (terminal.current) {
        console.log("Cleaning up terminal resources");
        try {
          // Сначала отключаем слушатель событий
          if (unlistenRef.current) {
            unlistenRef.current();
            unlistenRef.current = null;
          }
          
          // Затем освобождаем ресурсы терминала
          terminal.current.dispose();
        } catch (error) {
          console.error("Error disposing terminal:", error);
        } finally {
          // В любом случае обнуляем ссылки
          terminal.current = null;
          fitAddon.current = null;
        }
      }
    }
  }, [activeTab]);

  // Эффект для обработки изменения размера
  useEffect(() => {
    if (terminalHeight && activeTab === "terminal") {
      setTimeout(() => {
        resizeTerminal().catch(console.error);
      }, 100);
    }
  }, [terminalHeight, activeTab]);

  // Add an event listener for external resize events
  useEffect(() => {
    const handleTerminalResize = () => {
      resizeTerminal().catch(console.error);
    };
    
    document.addEventListener('terminal-resize', handleTerminalResize);
    
    return () => {
      document.removeEventListener('terminal-resize', handleTerminalResize);
    };
  }, []);

  const toggleFileExpand = (filePath: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  // Вспомогательная функция для создания хеша строки
  const stringToHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  // Функция для получения имени файла для inmemory-файла
  const getInmemoryFileName = (uri: string): string => {
    try {
      if (!uri.includes('inmemory://')) return 'unknown.txt';
      
      // Извлекаем ID модели из inmemory пути
      const modelIdMatch = uri.match(/inmemory:\/\/model\/(\d+)/);
      if (!modelIdMatch) return 'unknown.txt';
      
      const modelId = modelIdMatch[1];
      
      // Находим соответствующую модель по URI
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        const model = models.find((m: any) => m.uri.toString() === uri);
        
        if (model) {
          // Проверка на наличие связанного реального файла
          // Сначала проверяем pythonDiagnosticsStore для маппинга
          if (window.pythonDiagnosticsStore && window.pythonDiagnosticsStore._fileMapping) {
            const realFile = window.pythonDiagnosticsStore._fileMapping[uri];
            if (realFile) {
              // Извлекаем только имя файла из полного пути
              const fileNameMatch = realFile.match(/[\/\\]([^\/\\]+)$/);
              if (fileNameMatch && fileNameMatch[1]) {
                logProblems(`Найдено маппинг имени файла: ${fileNameMatch[1]}`);
                return fileNameMatch[1];
              }
            }
          }
          
          // Проверяем открытые файлы на совпадение содержимого
          // Получаем содержимое inmemory-модели
          const inmemoryContent = model.getValue();
          
          // Открытые файлы
          const openedFiles = Array.from(window.openedFiles || []);
          
          // Найти соответствующий открытый файл
          for (const filePath of openedFiles) {
            // Проверяем только Python файлы, если содержимое выглядит как Python
            if (inmemoryContent.includes('def ') || inmemoryContent.includes('import ') || inmemoryContent.includes('class ')) {
              if (filePath.endsWith('.py')) {
                // Получаем только имя файла без пути
                const fileNameMatch = filePath.match(/[\/\\]([^\/\\]+)$/);
                if (fileNameMatch && fileNameMatch[1]) {
                  // Проверяем активный файл
                  if (window.lastActiveFilePath === filePath) {
                    logProblems(`Используем активный Python файл: ${fileNameMatch[1]}`);
                    return fileNameMatch[1];
            } else {
                    // Проверяем совпадение содержимого
                    try {
                      const fileModel = models.find((m: any) => m.uri.toString().includes(filePath));
                      if (fileModel) {
                        const fileContent = fileModel.getValue();
                        // Если содержимое существенно совпадает
                        if (fileContent && inmemoryContent && 
                            (fileContent === inmemoryContent || 
                             fileContent.includes(inmemoryContent.substring(0, 100)) || 
                             inmemoryContent.includes(fileContent.substring(0, 100)))) {
                          logProblems(`Найдено совпадение содержимого с файлом: ${fileNameMatch[1]}`);
                          return fileNameMatch[1];
                        }
                      }
                    } catch (e) {
                      console.error('Ошибка при сравнении содержимого:', e);
                    }
                  }
                }
              }
            }
          }
          
          // Первая строка часто содержит комментарий с оригинальным именем файла
          try {
            const firstLine = model.getLineContent(1);
            
            // Ищем имя файла в комментарии
            const fileNameMatch = firstLine.match(/[\/\\]([^\/\\]+\.\w+)/);
            if (fileNameMatch) {
              return fileNameMatch[1]; // Возвращаем только имя файла
            }
            
            // Определяем тип файла по содержимому
            const content = model.getValue();
            if (content.includes('def ') || content.includes('import ') || content.includes('class ')) {
              // Для Python файлов проверяем активный файл
              if (window.lastActiveFilePath && window.lastActiveFilePath.endsWith('.py')) {
                const activePythonFile = window.lastActiveFilePath.split(/[\/\\]/).pop();
                if (activePythonFile) {
                  return activePythonFile; // Используем имя активного Python файла
                }
              }
              
              // Проверяем открытые вкладки
              const tabs = document.querySelectorAll('.tab-header .tab');
              for (let i = 0; i < tabs.length; i++) {
                const tabText = tabs[i].textContent || '';
                if (tabText.endsWith('.py')) {
                  return tabText; // Используем имя открытой вкладки Python
                }
              }
              
              return `python_file_${modelId}.py`;
            } else if (content.includes('<html') || content.includes('<div')) {
              return `html_file_${modelId}.html`;
            } else if (content.includes('function') || content.includes('const ') || content.includes('let ')) {
              return `js_file_${modelId}.js`;
        }
      } catch (e) {
            console.error('Ошибка при чтении содержимого модели:', e);
          }
        }
      }
      
      // Проверяем, есть ли у нас активный Python файл
      if (window.lastActiveFilePath && window.lastActiveFilePath.endsWith('.py')) {
        const fileName = window.lastActiveFilePath.split(/[\/\\]/).pop();
        if (fileName) {
          return fileName; // Используем имя активного файла
        }
      }
      
      return `file_${modelId}.txt`;
    } catch (error) {
      console.error('Ошибка при получении имени файла для inmemory:', error);
      // Создаем хеш строки в случае ошибки
      return `file_${stringToHash(uri)}.txt`;
    }
  };

  // Улучшенная функция получения реального пути файла для inmemory-модели
  const getActualFileFromInmemory = (inmemoryUri: string): string | null => {
    try {
      // Извлекаем текущее содержимое модели
      if (!window.monaco || !window.monaco.editor) return null;
      
      const models = window.monaco.editor.getModels();
      const model = models.find((m: any) => m.uri.toString() === inmemoryUri);
      if (!model) return null;
      
      // Если имеется информация о реальном файле в pythonDiagnosticsStore, используем ее
      if (window.pythonDiagnosticsStore && window.pythonDiagnosticsStore._fileMapping) {
        const mapping = window.pythonDiagnosticsStore._fileMapping[inmemoryUri];
        if (mapping) {
          logProblems(`Найдено сопоставление для ${inmemoryUri} -> ${mapping}`);
          return mapping;
        }
      }
      
      // Получаем первую строку, которая может содержать комментарий с путем файла
      try {
        const firstLine = model.getLineContent(1);
        const filePathMatch = firstLine.match(/\/\/\s*(.+\.\w+)/) || 
                              firstLine.match(/#\s*(.+\.\w+)/) ||
                              firstLine.match(/\/\*\s*(.+\.\w+)/);
        
        if (filePathMatch && filePathMatch[1]) {
          // Проверяем, существует ли такой файл среди открытых моделей
          const fileNameFromComment = filePathMatch[1].trim();
          const matchingModel = models.find((m: any) => {
            if (m.uri.toString().includes('inmemory://')) return false;
            return m.uri.toString().includes(fileNameFromComment);
          });
          
          if (matchingModel) {
            logProblems(`Найден файл по комментарию: ${matchingModel.uri.toString()}`);
            return matchingModel.uri.toString();
          }
        }
      } catch (error) {
        console.error('Ошибка при чтении первой строки модели:', error);
      }
      
      // Получаем путь активного файла
      const activeFile = window.lastActiveFilePath || props.selectedFile;
      if (!activeFile) return null;
      
      // Проверяем содержимое на совпадение с открытыми файлами
      const modelContent = model.getValue().trim();
      
      // Если модель почти пустая, используем активный файл
      if (modelContent.length < 10) {
        return activeFile;
      }
      
      const openFileModels = models.filter((m: any) => {
        return !m.uri.toString().includes('inmemory://') && !m.isDisposed();
      });
      
      // Ищем модель с наиболее похожим содержимым
      let bestMatch = null;
      let bestMatchScore = 0;
      
      for (const fileModel of openFileModels) {
        try {
          const fileContent = fileModel.getValue().trim();
          
          // Если содержимое идентично, это точное совпадение
          if (fileContent === modelContent) {
            logProblems(`Найдено полное совпадение содержимого с файлом: ${fileModel.uri.toString()}`);
            return fileModel.uri.toString();
          }
          
          // Если содержимое похоже (начинается или заканчивается одинаково или имеет общие уникальные строки)
          // вычисляем "оценку" совпадения
          let matchScore = 0;
          
          // Сравниваем первые 100 символов
          const modelPrefix = modelContent.substring(0, Math.min(100, modelContent.length));
          const filePrefix = fileContent.substring(0, Math.min(100, fileContent.length));
          if (modelPrefix === filePrefix) {
            matchScore += 10;
          }
          
          // Сравниваем последние 100 символов
          const modelSuffix = modelContent.substring(Math.max(0, modelContent.length - 100));
          const fileSuffix = fileContent.substring(Math.max(0, fileContent.length - 100));
          if (modelSuffix === fileSuffix) {
            matchScore += 10;
          }
          
          // Если нашли хорошее совпадение, сохраняем
          if (matchScore > bestMatchScore) {
            bestMatchScore = matchScore;
            bestMatch = fileModel.uri.toString();
          }
        } catch (error) {
          // Пропускаем модель при ошибке
          console.error(`Ошибка при сравнении с моделью ${fileModel.uri.toString()}:`, error);
        }
      }
      
      // Если нашли хорошее совпадение, возвращаем его
      if (bestMatch && bestMatchScore >= 10) {
        logProblems(`Найдено лучшее совпадение для ${inmemoryUri} -> ${bestMatch} (score=${bestMatchScore})`);
        return bestMatch;
      }
      
      // В противном случае используем активный файл
      logProblems(`Для ${inmemoryUri} используем активный файл: ${activeFile}`);
      return activeFile;
    } catch (error) {
      console.error('Ошибка при получении реального файла:', error);
      return null;
    }
  };

  // Обновляем эффект для инициализации кэша ошибок
  useEffect(() => {
    // Инициализируем глобальный кэш ошибок, если он еще не существует
    if (!window.errorsCache) {
      window.errorsCache = {};
    }
    // Инициализируем множество открытых файлов
    if (!window.openedFiles) {
      window.openedFiles = new Set<string>();
    }
    
    // Обработчик события смены активного файла
    const handleActiveFileChange = (event: Event) => {
      try {
      const customEvent = event as CustomEvent<{filePath: string}>;
        const filePath = customEvent.detail.filePath;
        logProblems(`Файл активирован: ${filePath}`);
        
        // Сохраняем в глобальной переменной предыдущее значение
        const previousActive = window.lastActiveFilePath;
        window.lastActiveFilePath = filePath;
        
        // Добавляем файл в список открытых файлов
        if (filePath) {
          window.openedFiles.add(filePath);
          
          // Принудительно обновляем маркеры для ЭТОГО КОНКРЕТНОГО файла
          if (window.monaco && window.monaco.editor) {
            setTimeout(() => {
              try {
                // Получаем URI модели для нового активного файла
                const fileUri = window.monaco.Uri.file(filePath).toString();
                
                // Создаём новый кэш ошибок, если необходимо
                if (!window.errorsCache) {
                  window.errorsCache = {};
                }
                
                // Очищаем кэш от моделей, которых больше не существует
                if (window.errorsCache) {
                  Object.keys(window.errorsCache).forEach(cachedUri => {
                    // Проверяем, существует ли еще такая модель
                    const modelExists = window.monaco.editor.getModels().some(
                      (m: any) => !m.isDisposed() && m.uri.toString() === cachedUri
                    );
                    
                    // Если модель больше не существует, удаляем её из кэша
                    if (!modelExists) {
                      delete window.errorsCache[cachedUri];
                      logProblems(`Удалены маркеры для несуществующей модели: ${cachedUri}`);
                    }
                  });
                }
                
                // Проверяем, есть ли модель для этого файла
                const model = window.monaco.editor.getModels().find(
                  (m: any) => m.uri.toString() === fileUri && !m.isDisposed()
                );
                
                if (model) {
                  // Получаем маркеры ТОЛЬКО для этой модели
                  const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
                  
                  if (markers && markers.length > 0) {
                    logProblems(`Найдено ${markers.length} маркеров для файла ${filePath}`);
                    
                    // Преобразуем маркеры в формат IssueInfo
                    const issues = markers.map((marker: any): Issue => ({
                      severity: marker.severity === 1 ? 'error' : 
                               marker.severity === 2 ? 'warning' : 'info',
                      message: marker.message || 'Неизвестная ошибка',
                      line: marker.startLineNumber || 0,
                      column: marker.startColumn || 0,
                      endLine: marker.endLineNumber || 0,
                      endColumn: marker.endColumn || 0,
                      source: marker.source || 'monaco-editor'
                    }));
                    
                    // Предотвращаем дублирование, создавая уникальный ключ для каждой проблемы
                    const uniqueIssues = new Map<string, Issue>();
                    issues.forEach((issue: Issue) => {
                      const key = `${issue.line}:${issue.column}:${issue.message}`;
                      uniqueIssues.set(key, issue);
                    });
                    
                    // Сохраняем в кэше только для этого файла
                    window.errorsCache[fileUri] = {
                      filePath: fileUri,
                      fileName: getReadableFileName(fileUri),
                      issues: Array.from(uniqueIssues.values())
                    };
                    
                    logProblems(`Кэшировано ${uniqueIssues.size} уникальных проблем для ${fileUri}`);
                  } else {
                    // Если для файла нет маркеров, очищаем его запись в кэше
                    if (window.errorsCache[fileUri]) {
                      delete window.errorsCache[fileUri];
                      logProblems(`Очищен кэш для файла без маркеров: ${fileUri}`);
                    }
                  }
                  
                  // Также проверяем Python диагностику для этого файла
                  if (filePath.endsWith('.py') && window.getPythonDiagnosticsForUri) {
                    try {
                      const pythonDiagnostics = window.getPythonDiagnosticsForUri(fileUri);
                      if (pythonDiagnostics && pythonDiagnostics.length > 0) {
                        logProblems(`Найдено ${pythonDiagnostics.length} Python диагностик для ${filePath}`);
                        
                        // Если нет записи в кэше, создаем её
                        if (!window.errorsCache[fileUri]) {
                          window.errorsCache[fileUri] = {
                            filePath: fileUri,
                            fileName: getReadableFileName(fileUri),
                            issues: []
                          };
                        }
                        
                        // Добавляем Python диагностики в кэш
                        pythonDiagnostics.forEach((diag: any) => {
                          if (!diag) return;
                          
                          const issue: Issue = {
                            severity: diag.severity || 'error',
                            message: diag.message || 'Неизвестная Python ошибка',
                            line: diag.line || 0,
                            column: diag.column || 0,
                            endLine: diag.endLine || diag.line || 0,
                            endColumn: diag.endColumn || diag.column || 0,
                            source: 'python'
                          };
                          
                          // Проверяем на дубликаты
                          const key = `${issue.line}:${issue.column}:${issue.message}`;
                          const existingIssues = window.errorsCache[fileUri].issues;
                          const isDuplicate = existingIssues.some(i => 
                            i.line === issue.line && 
                            i.column === issue.column && 
                            i.message === issue.message
                          );
                          
                          if (!isDuplicate) {
                            window.errorsCache[fileUri].issues.push(issue);
                          }
                        });
                      }
                    } catch (e) {
                      console.error('Ошибка при получении Python диагностики:', e);
                    }
                  }
                  
                  // Принудительно запрашиваем обновление отображения проблем
                  // Но только для моделей, которые реально существуют
                  setTimeout(() => {
                    logProblems('Принудительное обновление отображения проблем после смены файла');
                    updateAllProblemCounters();
                    setIssuesUpdated(prev => prev + 1);
                  }, 100);
                }
              } catch (error) {
                console.error('Ошибка при получении маркеров для нового активного файла:', error);
              }
            }, 300);
          }
        }
      } catch (error) {
        console.error('Ошибка при обработке события active-file-changed:', error);
      }
    };
    
    // Слушаем события открытия файла
    document.addEventListener('active-file-changed', handleActiveFileChange);
    
    return () => {
      document.removeEventListener('active-file-changed', handleActiveFileChange);
    };
  }, []);

  // Функция для принудительного обновления отображения проблем с полной изоляцией по моделям
  const forceUpdateProblemsDisplay = () => {
    try {
      // Получаем все текущие открытые модели
      const models = window.monaco?.editor.getModels() || [];
      
      // Очищаем глобальный кэш ошибок перед обновлением
      window.errorsCache = {};
      
      // Проходим по каждой модели и собираем её маркеры
      models.forEach((model: any) => {
        if (!model || model.isDisposed()) return;
        
        const uri = model.uri.toString();
        
        // Если это inmemory-модель, пропускаем
        if (uri.includes('inmemory://')) return;
        
        // Получаем маркеры ТОЛЬКО для этой модели
        const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
        
        if (markers && markers.length > 0) {
          // Преобразуем маркеры в формат IssueInfo
          const issues = markers.map((marker: any): Issue => ({
            severity: marker.severity === 1 ? 'error' : 
                     marker.severity === 2 ? 'warning' : 'info',
            message: marker.message || 'Неизвестная ошибка',
            line: marker.startLineNumber || 0,
            column: marker.startColumn || 0,
            endLine: marker.endLineNumber || 0,
            endColumn: marker.endColumn || 0,
            source: marker.source || 'monaco-editor'
          }));
          
          // Убеждаемся, что нет дубликатов
          const uniqueIssues = new Map<string, Issue>();
          issues.forEach((issue: Issue) => {
            const key = `${issue.line}:${issue.column}:${issue.message}`;
            uniqueIssues.set(key, issue);
          });
          
          // Сохраняем в кэше для этого файла
          window.errorsCache[uri] = {
            filePath: uri,
            fileName: getReadableFileName(uri),
            issues: Array.from(uniqueIssues.values())
          };
        }
      });
      
      // Принудительно обновляем отображение
      updateAllProblemCounters();
      
    } catch (error) {
      console.error('Ошибка при принудительном обновлении проблем:', error);
    }
  };
  
  // Функция создания уникального ключа для проблемы
  const createIssueKey = (issue: Issue, filePath: string): string => {
    return `${filePath}:${issue.line}:${issue.column}:${issue.message}`;
  };

  // Полностью переработанная функция получения всех маркеров без фильтрации
  const getMonacoAllMarkersWithoutFilter = (): IssueInfo[] => {
    let results: IssueInfo[] = [];
    
    try {
      logProblems('Запущен сбор ошибок из ВСЕХ открытых файлов...');
      
      // Получаем список всех открытых файлов
      const openedFiles = Array.from(window.openedFiles || []);
      logProblems(`Список открытых файлов (${openedFiles.length}): ${openedFiles.join(', ')}`);
      
      // ЧАСТЬ 1: Собираем маркеры из Monaco Editor для всех моделей
      if (window.monaco && window.monaco.editor) {
        // Получаем все модели из Monaco Editor
        const models = window.monaco.editor.getModels();
        logProblems(`В Monaco Editor найдено ${models.length} моделей`);
        
        // Получаем маркеры для КАЖДОЙ модели отдельно
        for (const model of models) {
          try {
            const uri = model.uri.toString();
            logProblems(`Проверка модели: ${uri}`);
            
            // Получаем маркеры для этой модели
            const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
            logProblems(`Получено ${markers.length} маркеров для модели ${uri}`);
            
            if (markers.length > 0) {
              // Определяем реальный путь файла
              let targetUri = uri;
              let fileName = uri.includes('inmemory://') ? null : getReadableFileName(uri);
              
              // Для inmemory-моделей ищем соответствующий реальный файл
              if (uri.includes('inmemory://')) {
                // Проверяем маппинг в pythonDiagnosticsStore
                if (window.pythonDiagnosticsStore && window.pythonDiagnosticsStore._fileMapping) {
                  const mappedFile = window.pythonDiagnosticsStore._fileMapping[uri];
                  if (mappedFile) {
                    targetUri = mappedFile;
                    fileName = getReadableFileName(mappedFile);
                    logProblems(`Найдено соответствие в fileMapping: ${uri} -> ${targetUri}`);
                  }
                }
                
                // Если маппинг не найден, ищем другие способы определения реального файла
                if (targetUri === uri) {
                  const realFile = getActualFileFromInmemory(uri);
                  if (realFile) {
                    targetUri = realFile;
                    fileName = getReadableFileName(realFile);
                    logProblems(`Найдено соответствие через getActualFileFromInmemory: ${uri} -> ${targetUri}`);
                  } else {
                    // Если файл Python, пробуем определить имя на основе контента и активного файла
                    const content = model.getValue();
                    if (content.includes('def ') || content.includes('import ') || content.includes('class ')) {
                      // Используем имя активного Python файла, если есть
                      if (window.lastActiveFilePath && window.lastActiveFilePath.endsWith('.py')) {
                        targetUri = window.lastActiveFilePath;
                        fileName = getReadableFileName(targetUri);
                        logProblems(`Используем активный Python файл для inmemory: ${targetUri}`);
                      } else {
                        // Генерируем простое имя файла
                        fileName = getInmemoryFileName(uri);
                        logProblems(`Генерируем имя файла для inmemory: ${fileName}`);
                      }
                    } else {
                      // Для не-Python файлов просто генерируем имя
                      fileName = getInmemoryFileName(uri);
                    }
                  }
                }
              }
              
              // Преобразуем маркеры в нужный формат
              const issues: Issue[] = [];
              markers.forEach((marker: any) => {
                // Определяем уровень серьезности
                let severity: 'error' | 'warning' | 'info' = 'info';
                
                if (marker.severity === 1 || marker.severity === 8) {
                  severity = 'error';
                } else if (marker.severity === 2 || marker.severity === 4) {
                  severity = 'warning';
                } else {
                  // Анализируем сообщение для определения серьезности
                  const message = marker.message?.toLowerCase() || '';
                  if (message.includes('error') || 
                      message.includes('ошибка') || 
                      message.includes('exception') || 
                      message.includes('fail') ||
                      message.includes('invalid')) {
                    severity = 'error';
                  } else if (message.includes('warning') || 
                            message.includes('предупреждение') || 
                            message.includes('warn')) {
                    severity = 'warning';
                  }
                }
                
                // Специальная обработка для JSON файлов
                let message = marker.message || 'Неизвестная ошибка';
                if (targetUri.toLowerCase().endsWith('.json')) {
                  // Улучшаем сообщения об ошибках для JSON файлов
                  if (message.includes('Expected') || message.includes('Unexpected')) {
                    // Заменяем технические термины на более понятные
                    message = message
                      .replace('Expected', 'Ожидается')
                      .replace('Unexpected', 'Неожиданный символ')
                      .replace('comma', 'запятая')
                      .replace('colon', 'двоеточие')
                      .replace('property name', 'имя свойства')
                      .replace('value', 'значение')
                      .replace('string', 'строка')
                      .replace('number', 'число')
                      .replace('boolean', 'логическое значение')
                      .replace('null', 'null')
                      .replace('end of file', 'конец файла')
                      .replace('object', 'объект')
                      .replace('array', 'массив');
                  }
                  
                  // Добавляем контекст для JSON ошибок
                  if (!message.includes('JSON')) {
                    message = `Ошибка JSON: ${message}`;
                  }
                }
                
                // Создаем объект проблемы
                const issue: Issue = {
                  severity,
                  message,
                  line: marker.startLineNumber || 0,
                  column: marker.startColumn || 0,
                  endLine: marker.endLineNumber || 0,
                  endColumn: marker.endColumn || 0,
                  source: marker.source || (targetUri.toLowerCase().endsWith('.json') ? 'json-validator' : 'monaco-editor')
                };
                
                issues.push(issue);
              });
              
              // Если есть проблемы и удалось определить имя файла, добавляем в результаты
              if (issues.length > 0 && fileName) {
                const fileIssue: IssueInfo = {
                  filePath: targetUri,
                  fileName,
                  issues
                };
                
                results.push(fileIssue);
                
                // Сохраняем в кэше
                window.errorsCache[targetUri] = fileIssue;
                
                logProblems(`Добавлен файл с маркерами: ${fileName} (${issues.length} проблем)`);
              }
            }
          } catch (e) {
            console.error('Ошибка при обработке модели:', e);
          }
        }
      }
      
      // ЧАСТЬ 2: Проверяем Python-диагностику
      if (window.pythonDiagnosticsStore) {
        logProblems('Проверяем Python-диагностику...');
        
        // Проходим по всем записям в pythonDiagnosticsStore
        Object.entries(window.pythonDiagnosticsStore).forEach(([uri, markers]) => {
          if (!Array.isArray(markers) || markers.length === 0 || uri === '_fileMapping') return;
          
          logProblems(`Найдена Python-диагностика для ${uri} (${markers.length} маркеров)`);
          
          // Определяем реальный путь файла
          let targetUri = uri;
          let fileName = null;
          
          // Ищем соответствие в fileMapping
          if (uri.includes('inmemory://') && window.pythonDiagnosticsStore._fileMapping) {
            const mappedFile = window.pythonDiagnosticsStore._fileMapping[uri];
            if (mappedFile) {
              targetUri = mappedFile;
              logProblems(`Найдено соответствие в fileMapping: ${uri} -> ${targetUri}`);
            }
          }
          
          // Если не нашли в маппинге, ищем другими способами
          if (targetUri === uri && uri.includes('inmemory://')) {
            const realFile = getActualFileFromInmemory(uri);
            if (realFile) {
              targetUri = realFile;
              logProblems(`Найдено соответствие через getActualFileFromInmemory: ${uri} -> ${targetUri}`);
            }
          }
          
          // Определяем имя файла
          if (uri.includes('inmemory://')) {
            // Для inmemory файлов
            if (targetUri !== uri) {
              // Если нашли соответствие, используем имя реального файла
              fileName = getReadableFileName(targetUri);
            } else {
              // Иначе генерируем имя
              fileName = getInmemoryFileName(uri);
            }
          } else {
            // Для обычных файлов просто используем имя
            fileName = getReadableFileName(targetUri);
          }
          
          // Проверяем, является ли это файлом Python
          if (fileName.includes('python_file_') && window.lastActiveFilePath && window.lastActiveFilePath.endsWith('.py')) {
            // Если это общее имя для Python и у нас есть активный Python файл, используем его
            fileName = getReadableFileName(window.lastActiveFilePath);
            targetUri = window.lastActiveFilePath;
            logProblems(`Используем активный Python файл для диагностики: ${fileName}`);
          }
          
          // Преобразуем маркеры в нужный формат
          const issues: Issue[] = [];
          
          markers.forEach((marker: any) => {
            if (!marker) return;
            
            // Определяем уровень серьезности
            let severity: 'error' | 'warning' | 'info' = 'info';
            
            if (marker.severity === 1 || marker.severity === 8) {
              severity = 'error';
            } else if (marker.severity === 2 || marker.severity === 4) {
              severity = 'warning';
            } else if (typeof marker.severity === 'string') {
              severity = marker.severity as any;
            } else {
              // Анализируем сообщение
              const message = marker.message?.toLowerCase() || '';
              if (message.includes('error') || 
                  message.includes('ошибка') || 
                  message.includes('exception') || 
                  message.includes('fail')) {
                severity = 'error';
              } else if (message.includes('warning') || 
                         message.includes('предупреждение')) {
                severity = 'warning';
              }
            }
            
            // Создаем объект проблемы
            const issue: Issue = {
              severity,
              message: marker.message || 'Неизвестная Python ошибка',
              line: marker.startLineNumber || marker.line || 0,
              column: marker.startColumn || marker.column || 0,
              endLine: marker.endLineNumber || marker.endLine || 0,
              endColumn: marker.endColumn || marker.endColumn || 0,
              source: marker.source || 'python-lsp'
            };
            
            issues.push(issue);
          });
          
          // Если есть проблемы и удалось определить имя файла, добавляем в результаты
          if (issues.length > 0 && fileName) {
            const fileIssue: IssueInfo = {
              filePath: targetUri,
              fileName,
              issues
            };
            
            // Проверяем, есть ли уже такой файл в результатах
            const existingIndex = results.findIndex(item => item.filePath === targetUri);
            
            if (existingIndex === -1) {
              // Если файла еще нет в результатах, добавляем
              results.push(fileIssue);
              logProblems(`Добавлен новый файл с Python проблемами: ${fileName} (${issues.length} проблем)`);
            } else {
              // Если файл уже есть, объединяем проблемы
              const existingIssues = results[existingIndex].issues;
              const uniqueKeys = new Set(existingIssues.map(i => `${i.line}:${i.column}:${i.message}`));
              
              // Добавляем только уникальные проблемы
              issues.forEach(issue => {
                const key = `${issue.line}:${issue.column}:${issue.message}`;
                if (!uniqueKeys.has(key)) {
                  existingIssues.push(issue);
                  uniqueKeys.add(key);
                }
              });
              
              logProblems(`Добавлены дополнительные Python проблемы к файлу ${fileName}`);
            }
            
            // Сохраняем в кэше
            window.errorsCache[targetUri] = {
              filePath: targetUri,
              fileName,
              issues: [...issues]
            };
          }
        });
      }
      
      // ЧАСТЬ 3: Добавляем все проблемы из кэша для открытых файлов
      logProblems('Проверяем кэш ошибок для всех открытых файлов...');
      
      // Проходим по всем открытым файлам
      for (const filePath of openedFiles) {
        if (window.errorsCache[filePath]) {
          const cachedIssues = window.errorsCache[filePath];
          
          // Проверяем, есть ли уже такой файл в результатах
          const existingIndex = results.findIndex(item => item.filePath === filePath);
          
          if (existingIndex === -1) {
            // Если файла еще нет в результатах, добавляем из кэша
            results.push(cachedIssues);
            logProblems(`Добавлен файл из кэша: ${cachedIssues.fileName} (${cachedIssues.issues.length} проблем)`);
          }
        }
      }
      
      // Удаляем дубликаты по filePath (одинаковые файлы)
      const uniqueResults: IssueInfo[] = [];
      const seenPaths = new Set<string>();
      
      for (const result of results) {
        if (!seenPaths.has(result.filePath)) {
          uniqueResults.push(result);
          seenPaths.add(result.filePath);
        }
      }
      
      // Обновляем результаты
      results = uniqueResults;
      
      // Подсчитываем общее количество ошибок и предупреждений
      const totalErrors = results.reduce((count, file) => 
        count + file.issues.filter(i => i.severity === 'error').length, 0);
      const totalWarnings = results.reduce((count, file) => 
        count + file.issues.filter(i => i.severity === 'warning').length, 0);
      
      // Сохраняем значения для глобального доступа
      window._latestErrorCount = totalErrors;
      window._latestWarningCount = totalWarnings;
      
      logProblems(`Итоговый результат: ${results.length} файлов с проблемами, ${totalErrors} ошибок, ${totalWarnings} предупреждений`);
      
      return results;
    } catch (error) {
      console.error('Ошибка при получении маркеров:', error);
      return [];
    }
  };

  // Обновляем функцию renderIssues, чтобы она корректно отображала проблемы
  const renderIssues = () => {
    logProblems('Вызов renderIssues для отображения проблем ВСЕХ открытых файлов');
    
    // Принудительно запрашиваем обновление маркеров
    // Это важно для гарантии актуальности данных
    if (window.monaco && window.monaco.editor) {
      try {
        const allMarkers = window.monaco.editor.getModelMarkers({});
        logProblems(`Получено ${allMarkers.length} маркеров для отображения`);
      } catch (error) {
        console.error('Ошибка при получении маркеров:', error);
      }
    }
    
    // Получаем все проблемы из всех источников через обновленную функцию
    const freshIssues = getMonacoAllMarkersWithoutFilter();
    
    logProblems(`Получено ${freshIssues.length} файлов с проблемами для отображения`);
    
    // Если нет проблем, показываем соответствующее сообщение
    if (freshIssues.length === 0) {
      return (
        <div className="no-issues">
          <div className="no-issues-content">
            <div className="icon-container">
              <Check size={24} color="#4caf50" />
            </div>
            <span>Нет обнаруженных проблем</span>
          </div>
        </div>
      );
    }
    
    // Фильтруем проблемы по настройкам отображения
    const filteredIssues = freshIssues
      .map(fileIssue => {
        // Создаем копию файла с проблемами
        const filteredFile = { ...fileIssue };
        
        // Фильтруем проблемы по поиску и настройкам
        filteredFile.issues = fileIssue.issues.filter(issue => {
          // Проверяем соответствие поисковому запросу
          const matchesSearch = issueSearch === "" ||
            (issue.message && issue.message.toLowerCase().includes(issueSearch.toLowerCase())) ||
            (fileIssue.fileName && fileIssue.fileName.toLowerCase().includes(issueSearch.toLowerCase()));
          
          // Проверяем фильтры по типу проблемы
          const matchesFilter = (
            (issue.severity === 'error' && filters.errors) ||
            (issue.severity === 'warning' && filters.warnings) ||
            (issue.severity === 'info' && filters.info)
          );
          
          return matchesSearch && matchesFilter;
        });
        
        return filteredFile;
      })
      .filter(fileIssue => fileIssue.issues.length > 0); // Оставляем только файлы с проблемами
    
    // Логируем результаты фильтрации
    logProblems(`После фильтрации осталось ${filteredIssues.length} файлов с проблемами`);
    
    // Подсчитываем общее количество ошибок и предупреждений
    const totalErrors = filteredIssues.reduce((count, file) => 
      count + file.issues.filter(i => i.severity === 'error').length, 0);
    const totalWarnings = filteredIssues.reduce((count, file) => 
      count + file.issues.filter(i => i.severity === 'warning').length, 0);
    
    // Сохраняем значения для глобального доступа
    window._latestErrorCount = totalErrors;
    window._latestWarningCount = totalWarnings;
    
    // ВАЖНО: Не обновляем счетчики здесь, так как это вызывает бесконечный рендеринг
    // Вместо этого сохраняем значения для использования в useEffect
    window._renderIssuesErrorCount = totalErrors;
    window._renderIssuesWarningCount = totalWarnings;
    
    logProblems(`Всего для отображения: ${totalErrors} ошибок, ${totalWarnings} предупреждений`);
    
    // Сортируем файлы так, чтобы сначала показывались файлы с ошибками
    filteredIssues.sort((a, b) => {
      const aHasErrors = a.issues.some(i => i.severity === 'error');
      const bHasErrors = b.issues.some(i => i.severity === 'error');
      
      if (aHasErrors && !bHasErrors) return -1;
      if (!aHasErrors && bHasErrors) return 1;
      return 0;
    });
    
    return (
      <div className="issues-list">
        {filteredIssues.map((fileIssue: IssueInfo) => (
          <div key={fileIssue.filePath} className="file-issues">
            <div 
              className={`file-header ${fileIssue.issues.some(i => i.severity === 'error') ? 'has-errors' : fileIssue.issues.some(i => i.severity === 'warning') ? 'has-warnings' : ''}`}
              onClick={() => toggleFileExpand(fileIssue.filePath)}
            >
              {expandedFiles.has(fileIssue.filePath) ? 
                <ChevronDown size={16} /> : 
                <ChevronRight size={16} />
              }
              <div className="file-icon">
                {getFileIcon(fileIssue.filePath)}
              </div>
              <div className="file-name">
                {fileIssue.fileName}
                {fileIssue.issues.some((issue: Issue) => issue.source === 'python-lsp') && (
                  <span className="python-badge">Python</span>
                )}
              </div>
              <div className="issue-counts">
                {fileIssue.issues.filter((i: Issue) => i.severity === 'error').length > 0 && (
                  <span className="error-count">
                    {fileIssue.issues.filter((i: Issue) => i.severity === 'error').length} <AlertCircle size={12} />
                  </span>
                )}
                {fileIssue.issues.filter((i: Issue) => i.severity === 'warning').length > 0 && (
                  <span className="warning-count">
                    {fileIssue.issues.filter((i: Issue) => i.severity === 'warning').length} <AlertTriangle size={12} />
                  </span>
                )}
              </div>
            </div>
            
            {expandedFiles.has(fileIssue.filePath) && (
              <div className="issue-details">
                {/* Сначала показываем ошибки, затем предупреждения */}
                {fileIssue.issues
                  .sort((a, b) => {
                    if (a.severity === 'error' && b.severity !== 'error') return -1;
                    if (a.severity !== 'error' && b.severity === 'error') return 1;
                    return 0;
                  })
                  .map((issue: Issue, idx: number) => (
                  <div 
                    key={`${fileIssue.filePath}-${idx}`} 
                    className={`issue-item ${issue.severity === 'error' ? 'error-item' : issue.severity === 'warning' ? 'warning-item' : 'info-item'}`}
                    onClick={() => {
                      if (props.onIssueClick) {
                        logProblems(`Клик по проблеме в файле ${fileIssue.filePath} (строка ${issue.line}, столбец ${issue.column})`);
                        props.onIssueClick(fileIssue.filePath, issue.line, issue.column);
                      }
                    }}
                  >
                    {getSeverityIcon(issue.severity)}
                    <div className="issue-message">{issue.message}</div>
                    <div className="issue-position">
                      строка {issue.line}, столбец {issue.column}
                      {issue.source && (
                        <span className="issue-source">
                          [{issue.source === 'python-lsp' ? 'Python LSP' : issue.source}]
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Добавляем эффект для обновления счетчиков ошибок и предупреждений
  useEffect(() => {
    // Обновляем счетчики из глобальных переменных, чтобы избежать бесконечного рендеринга
    if (typeof window._renderIssuesErrorCount === 'number' && 
        typeof window._renderIssuesWarningCount === 'number') {
      setErrorCount(window._renderIssuesErrorCount);
      setWarningCount(window._renderIssuesWarningCount);
    }
  }, [issuesUpdated]); // Запускаем эффект при изменении issuesUpdated

  // Исправляем функцию updateAllProblemCounters, чтобы избежать бесконечного цикла
  const updateAllProblemCounters = () => {
    // Обновляем счетчики ошибок/предупреждений
    const { errors, warnings } = updateErrorCounters();
    
    // Сохраняем текущие значения счетчиков в временном хранилище
    window._latestErrorCount = errors;
    window._latestWarningCount = warnings;
    
    // Безопасно обновляем состояние только один раз
            setTimeout(() => {
      setFilterSeverity(current => current === 'all' ? 'error' : 'all');
    }, 100);
  };

  // Исправляем функцию refreshAllProblems чтобы избежать прямого вызова обновления состояния
  const refreshAllProblems = () => {
    console.log('Принудительное обновление всех проблем');
    
    // Обновляем все модели Monaco
    if (window.monaco && window.monaco.editor) {
      try {
        const models = window.monaco.editor.getModels();
        models.forEach((model: any) => {
          if (model && !model.isDisposed()) {
            const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
            console.log(`Модель ${model.uri.toString()}: ${markers.length} маркеров`);
          }
        });
      } catch (error) {
        console.error('Ошибка при обновлении моделей:', error);
      }
    }
    
    // Запускаем диагностику Python
    if (window.forceDiagnosticsRefresh) {
      window.forceDiagnosticsRefresh();
    }
    
    // Обновляем счетчики ошибок/предупреждений
    const { errors, warnings } = updateErrorCounters();
    
    // Сохраняем текущие значения счетчиков в временном хранилище
    window._latestErrorCount = errors;
    window._latestWarningCount = warnings;
    
    // Безопасно обновляем состояние через setTimeout
        setTimeout(() => {
      setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
    }, 100);
  };

  // Исправляем функцию updateErrorCounters чтобы вернуть значения вместо прямого обновления состояния
  const updateErrorCounters = () => {
    try {
      let errors = 0;
      let warnings = 0;
      
      // 1. Сначала проверяем маркеры Monaco
      if (window.monaco && window.monaco.editor) {
        const monacoMarkers = window.monaco.editor.getModelMarkers();
        
        monacoMarkers.forEach((marker: any) => {
          if (marker.severity === 1) { // error
            errors++;
          } else if (marker.severity === 2) { // warning
            warnings++;
          }
        });
      }
      
      // 2. Затем проверяем Python диагностики
      if (typeof window !== "undefined" && (window as any).getPythonDiagnostics) {
        const diagData = (window as any).getPythonDiagnostics();
        
        if (Array.isArray(diagData)) {
          diagData.forEach((fileIssue: IssueInfo) => {
            if (fileIssue.issues) {
              fileIssue.issues.forEach((issue: Issue) => {
                if (issue.severity === 'error') {
                  errors++;
                } else if (issue.severity === 'warning') {
                  warnings++;
                }
              });
            }
          });
        }
      }
      
      // 3. Проверяем хранилище pythonDiagnosticsStore
      if (window.pythonDiagnosticsStore) {
        Object.values(window.pythonDiagnosticsStore).forEach((markers: any) => {
          if (Array.isArray(markers)) {
            markers.forEach((marker: any) => {
              if (marker.severity === 1) { // error
                errors++;
              } else if (marker.severity === 2) { // warning
                warnings++;
              }
            });
          }
        });
      }
      
      // Не обновляем состояние напрямую, а возвращаем значения
      return { errors, warnings };
    } catch (e) {
      console.error('Ошибка при обновлении счетчиков ошибок/предупреждений:', e);
    }
    
    return { errors: 0, warnings: 0 };
  };

  // Функция для закрытия панели терминала
  const closeTerminal = () => {
    console.log("Closing terminal panel");
    document.dispatchEvent(new Event('terminal-close'));
  };

  // Обновляем UI компонент фильтров
  const renderFilterControls = () => (
    <div className="terminal-filters">
      <input 
        type="text" 
        placeholder="Поиск проблем..."
        value={issueSearch}
        onChange={(e) => setIssueSearch(e.target.value)}
        className="issue-search"
      />
      <div className="filter-buttons">
        <button 
          className={`filter-btn ${filters.errors ? 'active' : ''}`}
          onClick={() => setFilters(prev => ({ ...prev, errors: !prev.errors }))}
        >
          <AlertCircle size={16} color={filters.errors ? "#ff5555" : "#888"} />
          <span>Ошибки</span>
        </button>
        <button 
          className={`filter-btn ${filters.warnings ? 'active' : ''}`}
          onClick={() => setFilters(prev => ({ ...prev, warnings: !prev.warnings }))}
        >
          <AlertTriangle size={16} color={filters.warnings ? "#ffaa33" : "#888"} />
          <span>Предупр.</span>
        </button>
        <button 
          className={`filter-btn ${filters.info ? 'active' : ''}`}
          onClick={() => setFilters(prev => ({ ...prev, info: !prev.info }))}
        >
          <Info size={16} color={filters.info ? "#33aaff" : "#888"} />
          <span>Инфо</span>
        </button>
      </div>
    </div>
  );

  // Функция обработки принудительного запуска диагностики Python
  const handleForcePythonDiagnostics = async () => {
    try {
      if (window && (window as any).updatePythonDiagnostics) {
        console.log("Принудительный запуск Python диагностики...");
        const result = await (window as any).updatePythonDiagnostics();
        console.log("Результат диагностики:", result);
        
        // Обновляем список проблем
        setFilterSeverity(current => current === 'all' ? 'error' : 'all');
      } else {
        console.error("Функция updatePythonDiagnostics недоступна");
        
        // Пробуем загрузить модуль register-python
        try {
          const registerPythonModule = await import('../../monaco-config/register-python');
          if (typeof registerPythonModule.registerPython === 'function') {
            console.log("Регистрация Python...");
            registerPythonModule.registerPython();
            
            setTimeout(async () => {
              if ((window as any).updatePythonDiagnostics) {
                const result = await (window as any).updatePythonDiagnostics();
                console.log("Результат диагностики после регистрации:", result);
                setFilterSeverity(current => current === 'all' ? 'error' : 'all');
              }
            }, 1000);
          }
        } catch (err) {
          console.error("Ошибка при импорте модуля register-python:", err);
        }
      }
    } catch (error) {
      console.error("Ошибка при запуске диагностики Python:", error);
    }
  };

  // Добавляем дополнительный обработчик для обработки force-update-problems
  useEffect(() => {
    const handleForceUpdateProblems = () => {
      console.log('Получено событие force-update-problems');
      
      // Проверяем наличие проблем, но НЕ переключаемся на вкладку проблем автоматически
      const hasIssues = (window.pythonDiagnosticsStore && Object.values(window.pythonDiagnosticsStore).some(
        markers => Array.isArray(markers) && markers.length > 0
      ));
      
      if (hasIssues) {
        console.log('Обнаружены проблемы, обновляем данные');
      }
      
      // Принудительно обновляем диагностику
      if (typeof window !== "undefined") {
        try {
          // Обновляем счетчики ошибок/предупреждений
          const { errors, warnings } = updateErrorCounters();
          window._latestErrorCount = errors;
          window._latestWarningCount = warnings;
          setErrorCount(errors);
          setWarningCount(warnings);
          
          // Триггерим обновление состояния через setTimeout
          setTimeout(() => {
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
          }, 100);
          
          // Разворачиваем все файлы с ошибками, если мы на вкладке проблем
          if (activeTab === 'issues' && window.pythonDiagnosticsStore) {
            const newExpandedFiles = new Set(expandedFiles);
            Object.keys(window.pythonDiagnosticsStore).forEach(uri => {
              const markers = window.pythonDiagnosticsStore[uri];
              if (Array.isArray(markers) && markers.some(m => m && typeof m === 'object' && m.severity === 1)) { // 1 = error
                newExpandedFiles.add(uri);
              }
            });
            setExpandedFiles(newExpandedFiles);
          }
        } catch (e) {
          console.error('Ошибка при обновлении проблем:', e);
        }
      }
    };
    
    // Реагируем на общее событие обновления проблем
    const handleProblemsUpdated = () => {
      console.log('Получено событие problems-updated');
      
      // Обновляем счетчики ошибок/предупреждений
      const { errors, warnings } = updateErrorCounters();
      window._latestErrorCount = errors;
      window._latestWarningCount = warnings;
      
      // Триггерим обновление состояния через setTimeout
      setTimeout(() => {
        setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
      }, 300);
    };
    
    document.addEventListener('force-update-problems', handleForceUpdateProblems);
    document.addEventListener('problems-updated', handleProblemsUpdated);
    
    return () => {
      document.removeEventListener('force-update-problems', handleForceUpdateProblems);
      document.removeEventListener('problems-updated', handleProblemsUpdated);
    };
  }, [activeTab, expandedFiles]);

  // Добавляем первичное получение проблем при загрузке компонента
  useEffect(() => {
    const initialLoadIssues = async () => {
      console.log('Первичная загрузка проблем...');
      
      // Проверяем наличие проблем в Monaco Editor
      if (window.monaco && window.monaco.editor) {
        try {
          const models = window.monaco.editor.getModels();
          
          if (models.length > 0) {
            console.log(`Найдено ${models.length} моделей с потенциальными проблемами`);
            
            // Проверяем каждую модель на наличие маркеров
            let totalMarkers = 0;
            
            models.forEach((model: any) => {
              if (model && model.uri) {
                const uri = model.uri.toString();
                const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
                
                if (markers && markers.length > 0) {
                  console.log(`Модель ${uri} имеет ${markers.length} маркеров`);
                  totalMarkers += markers.length;
                  
                  // Сохраняем маркеры в хранилище
                  if (!window.pythonDiagnosticsStore) {
                    window.pythonDiagnosticsStore = {};
                  }
                  window.pythonDiagnosticsStore[uri] = markers;
                  
                  // Разворачиваем файл с ошибками
                  if (markers.some((m: any) => m && typeof m === 'object' && m.severity === 1)) { // 1 = error
                    setExpandedFiles(prev => {
                      const newSet = new Set(prev);
                      newSet.add(uri);
                      return newSet;
                    });
                  }
                }
              }
            });
            
            if (totalMarkers > 0) {
              console.log(`Всего найдено ${totalMarkers} маркеров`);
              
              // Обновляем счетчики, но НЕ переключаемся на вкладку проблем автоматически
              setTimeout(() => {
                // Принудительно перерисовываем компонент
                setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
                
                // Обновляем счетчики
                const { errors, warnings } = updateErrorCounters();
                window._latestErrorCount = errors;
                window._latestWarningCount = warnings;
                setErrorCount(errors);
                setWarningCount(warnings);
              }, 500);
            }
          }
        } catch (error) {
          console.error('Ошибка при получении начальных проблем:', error);
        }
      }
    };
    
    // Запускаем с небольшой задержкой после загрузки компонента
    setTimeout(initialLoadIssues, 1000);
  }, []);

  // Утилитарные функции для проверки ошибок и логирования
  const logProblemMessage = (message: string) => {
    console.log(`[Problems Panel] ${message}`);
  }

  const checkAllModelsForMarkers = () => {
    const models = window.monaco?.editor.getModels() || [];
    logProblemMessage(`Найдено ${models.length} моделей Monaco`);
    
    models.forEach((model: any) => {
      const uri = model.uri.toString();
      const markers = window.monaco?.editor.getModelMarkers({ resource: model.uri }) || [];
      logProblemMessage(`Модель ${uri}: ${markers.length} маркеров`);
    });
  }

  // В начале файла добавляем функцию debounce для оптимизации частых вызовов
  // Добавим новую утилитарную функцию debounce
  function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number): (...args: Parameters<F>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    
    return function(this: any, ...args: Parameters<F>): void {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, waitFor);
    };
  }

  // Модифицируем функцию checkAllEditorsForErrors для добавления debounce
  const checkAllEditorsForErrors = () => {
    try {
      logProblems('Принудительная проверка всех открытых редакторов на наличие ошибок');
      
      // Получаем все модели из Monaco редактора
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        logProblems(`Найдено ${models.length} моделей для проверки ошибок`);
        
        // Используем переменную для отслеживания изменений
        let hasChanges = false;
        
        models.forEach((model: any) => {
          try {
            const uri = model.uri.toString();
            if (uri.endsWith('.py')) {
              // Для Python файлов запускаем проверку диагностики
              if (window.forcePythonCheck) {
                logProblems(`Запуск принудительной проверки Python файла: ${uri}`);
                window.forcePythonCheck(uri);
                hasChanges = true;
              }
            }
            
            // Форсируем получение маркеров для модели
            const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
            logProblems(`Получено ${markers.length} маркеров для модели ${uri}`);
            
            // Добавляем открытый файл в список проверенных файлов
            if (!window.openedFiles) {
              window.openedFiles = new Set<string>();
            }
            
            const realPath = getActualFileFromInmemory(uri) || uri;
            window.openedFiles.add(realPath);
            
            logProblems(`Добавлен файл ${realPath} в список открытых файлов`);
          } catch (e) {
            console.error('Ошибка при проверке модели на ошибки:', e);
          }
        });
        
        // Обновляем отображение проблем ТОЛЬКО если есть изменения
        if (hasChanges) {
          debouncedUpdateAllProblemCounters();
        }
      }
    } catch (error) {
      console.error('Ошибка при проверке всех редакторов:', error);
    }
  };

  // Модифицируем функцию handleActiveFileChange для предотвращения багов при переключении файлов
  const handleActiveFileChange = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.filePath) {
      const filePath = customEvent.detail.filePath;
      
      // Если файл не изменился или пустой путь, выходим
      if (!filePath || filePath.trim() === '' || window.lastActiveFilePath === filePath) {
        return;
      }
      
      // Сохраняем путь к последнему активному файлу
      const prevFile = window.lastActiveFilePath;
      window.lastActiveFilePath = filePath;
      
      // Добавляем файл в список открытых файлов ОДИН раз
      if (!window.openedFiles) {
        window.openedFiles = new Set<string>();
      }
      
      if (!window.openedFiles.has(filePath)) {
        window.openedFiles.add(filePath);
        logProblems(`Добавлен новый файл в список открытых: ${filePath}`);
      }
      
      // Обработка Python файлов - с задержкой для предотвращения тряски при переключении
      if (filePath.endsWith('.py')) {
        // Используем setTimeout для задержки проверки Python файлов
        debouncedPythonCheck(filePath);
      }
      
      // Обновляем activefile ТОЛЬКО ОДИН раз за событие
      // Это предотвратит множественные ререндеры компонента
      setActiveFile(prevFile !== filePath ? filePath : prevFile);
    }
  };

  // Стабильная функция обновления счетчиков с минимальным воздействием на состояние
  const stableUpdateCounters = (errors: number, warnings: number) => {
    // Обновляем глобальные переменные
    window._latestErrorCount = errors;
    window._latestWarningCount = warnings;
    
    // Обновляем состояние только если значения действительно изменились
    // и только через setTimeout для предотвращения частых перерисовок
    if (errors !== errorCount || warnings !== warningCount) {
      setTimeout(() => {
        setErrorCount(errors);
        setWarningCount(warnings);
      }, 500);
    }
  };

  // Заменяем ВСЕ предыдущие версии checkSingleFile одной оптимизированной функцией
  const improvedCheckSingleFile = (filePath: string) => {
    // Если файл не задан или пустой, выходим
    if (!filePath || filePath.trim() === '') return;
    
    try {
      if (window.monaco && window.monaco.editor) {
        const fileUri = window.monaco.Uri.file(filePath);
        
        // Проверка за пределами асинхронного контекста для большей надежности
        if (!fileUri) return;
        
        // Получаем модель явно только для этого файла
        const model = window.monaco.editor.getModels().find(
          (m: any) => {
            try {
              // Безопасная проверка - модель может быть невалидна
              return m && !m.isDisposed() && m.uri.toString() === fileUri.toString();
            } catch (e) {
              return false;
            }
          }
        );
        
        // Если модель не найдена или утилизирована, выходим
        if (!model || model.isDisposed()) return;
        
        // Получаем маркеры только для этой модели
        const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
        if (!markers) return;
        
        logProblems(`Проверка файла ${filePath}: ${markers.length} маркеров`);
        
        // Принимаем решение об обновлении счетчиков только при существенных изменениях
        if (markers.length > 0) {
          const errorCount = markers.filter((m: any) => m.severity === 1).length;
          const warningCount = markers.filter((m: any) => m.severity === 2).length;
          
          if (errorCount > 0 || warningCount > 0) {
            // Используем стабильный способ обновления счетчиков
            stableUpdateCounters(errorCount, warningCount);
          }
        }
      }
    } catch (error) {
      // Логируем ошибку но продолжаем работу для стабильности
      console.error('Ошибка при проверке файла (не критичная):', error);
    }
  };
  
  // Специальный дебаунсер для Python проверок с более длинной задержкой
  const debouncedPythonCheck = debounce((filePath: string) => {
    if (window.forcePythonCheck) {
      try {
        window.forcePythonCheck(filePath);
        
        // Даем время для проверки Python файла и только потом проверяем маркеры
        setTimeout(() => {
          // Проверяем маркеры только для этого конкретного файла
          improvedCheckSingleFile(filePath);
        }, 700);
      } catch (e) {
        console.error('Ошибка при проверке Python файла:', e);
      }
    }
  }, 500);

  // Создадим debounced версии функций для оптимизации
  const debouncedUpdateAllProblemCounters = debounce(() => {
    const { errors, warnings } = updateErrorCounters();
    window._latestErrorCount = errors;
    window._latestWarningCount = warnings;
    
    // Делаем ЕДИНИЧНОЕ обновление состояния
    setErrorCount(errors);
    setWarningCount(warnings);
    setIssuesUpdated(prev => prev + 1);
  }, 300);

  const debouncedUpdateErrorCounters = debounce(() => {
    const { errors, warnings } = updateErrorCounters();
    window._latestErrorCount = errors;
    window._latestWarningCount = warnings;
    
    // Делаем ЕДИНИЧНОЕ обновление состояния
    setErrorCount(errors);
    setWarningCount(warnings);
  }, 300);

  // Обновленная ссылка на новую функцию
  const debouncedCheckFile = debounce(improvedCheckSingleFile, 300);

  // Добавляем вспомогательную функцию updateFileIcon
  const updateFileIcon = (filePath: string, iconType: 'error' | 'warning') => {
    // Функция для обновления иконки файла в навигаторе
    // Безопасная обертка для будущей функциональности
    try {
      if (window.updateFileErrorIcon) {
        window.updateFileErrorIcon(filePath, iconType);
      }
    } catch (e) {
      console.error('Ошибка при обновлении иконки файла:', e);
    }
  };

  // Оптимизируем функцию checkMarkers, чтобы она обновляла состояние реже
  const checkMarkers = (monacoData: any, currentModel: any) => {
    if (!monacoData || !currentModel) return;
    
    try {
      const markers = monacoData.getModelMarkers({ resource: currentModel.uri });
      
      // Группируем маркеры по серьезности для избежания повторных вычислений
      const errors = markers.filter((m: any) => m.severity === 1);
      const warnings = markers.filter((m: any) => m.severity === 2);
      
      // Обновляем иконку файла, только если есть ошибки
      if (window.lastActiveFilePath && (errors.length > 0 || warnings.length > 0)) {
        updateFileIcon(window.lastActiveFilePath, errors.length > 0 ? 'error' : 'warning');
      }
      
      // Обновляем глобальные счетчики
      window._errorsInCurrentFile = errors.length;
      window._warningsInCurrentFile = warnings.length;
      
      // Обрабатываем каждый маркер только один раз
      if (errors.length > 0 || warnings.length > 0) {
        // Используем стабильный способ обновления счетчиков
        stableUpdateCounters(errors.length, warnings.length);
      }
    } catch (e) {
      console.error("Ошибка при проверке маркеров:", e);
    }
  };

  // Обновляем initialLoadIssues для использования стабильных функций
  const initialLoadIssues = (prevTab: string, forceUpdate: boolean = false) => {
    if (prevTab !== activeTab || forceUpdate) {
      try {
        // Используем improvedCheckSingleFile для проверки активного файла
        if (window.lastActiveFilePath) {
          improvedCheckSingleFile(window.lastActiveFilePath);
        }
        
        // Обновляем глобальные счетчики через дебаунсер
        debouncedUpdateAllProblemCounters();
      } catch (e) {
        console.error("Ошибка при загрузке проблем:", e);
      }
    }
  };

  // Добавляем новый оптимизированный обработчик обновления проблем
  const optimizedForceUpdateProblems = debounce((event: Event) => {
    try {
      // Пропускаем обновление во время активного редактирования
      if (window._isCurrentlyEditing === true) {
        return;
      }
      
      const customEvent = event as CustomEvent;
      const forceSwitchToIssues = customEvent.detail && customEvent.detail.switchToIssues === true;
      
      // Вместо проверки всех файлов сразу, используем отложенную проверку активного файла
      if (window.lastActiveFilePath) {
        improvedCheckSingleFile(window.lastActiveFilePath);
      }
      
      // Обновляем общие счетчики с дебаунсингом
      debouncedUpdateAllProblemCounters();
      
      // Переключаемся на вкладку Issues ТОЛЬКО если это явно запрошено и текущая вкладка не issues
      if (forceSwitchToIssues && activeTab !== "issues") {
        setActiveTab("issues");
      }
    } catch (e) {
      console.error("Ошибка при принудительном обновлении проблем:", e);
    }
  }, 300);
  
  // Заменим предыдущую реализацию handleForceUpdateProblems на новую
  useEffect(() => {
    document.addEventListener('force-update-problems', optimizedForceUpdateProblems);
    
    return () => {
      document.removeEventListener('force-update-problems', optimizedForceUpdateProblems);
    };
  }, [activeTab]);

  // Чтобы обновлять панель проблем при открытии файла с ошибками, 
  // но не переключаться автоматически с терминала на проблемы
  useEffect(() => {
    const selectedFilePath = props.selectedFile as string;
    if (selectedFilePath && selectedFilePath.trim() !== '') {
      // Если есть проблемы для текущего файла, обновляем данные,
      // но не переключаемся автоматически с вкладки терминала на проблемы
      setTimeout(() => {
        if (window.pythonDiagnosticsStore && window.monaco && window.monaco.editor) {
          try {
            // Проверяем наличие маркеров для текущего файла
            const fileUri = window.monaco.Uri.file(selectedFilePath).toString();
            const markers = window.monaco.editor.getModelMarkers().filter(
              (marker: any) => marker.resource.toString() === fileUri
            );
            
            if (markers && markers.length > 0) {
              console.log(`В файле ${selectedFilePath} найдено ${markers.length} проблем`);
              
              // Обновляем счетчики ошибок/предупреждений без переключения вкладки
              const { errors, warnings } = updateErrorCounters();
              window._latestErrorCount = errors;
              window._latestWarningCount = warnings;
              
              // Триггерим обновление состояния, но не меняем активную вкладку
              setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
            }
          } catch (error) {
            console.error('Ошибка при проверке маркеров для файла:', error);
          }
        }
      }, 300);
    }
  }, [props.selectedFile]);
  
  // Регулярная проверка маркеров для всех файлов
  useEffect(() => {
    // Используем улучшенную функцию для проверки маркеров
    const periodicCheckMarkersForAllFiles = () => {
      if (window.monaco && window.monaco.editor) {
        try {
          // Проверяем только если активна вкладка issues или мы не в режиме активной печати
          const shouldCheck = activeTab === 'issues' || 
                             (window.lastActiveFilePath && (Date.now() - (window._lastKeyPressTime || 0) > 2000));
          
          if (!shouldCheck) return;
          
          // Используем стабильный метод получения маркеров
          const allModels = window.monaco.editor.getModels();
          
          // Подсчитываем ошибки и предупреждения из всех моделей
          let totalErrors = 0;
          let totalWarnings = 0;
          
          // Проходим по каждой модели отдельно для избежания блокировки UI
          allModels.forEach((model: any) => {
            if (model && !model.isDisposed()) {
              try {
                // Получаем маркеры для конкретной модели
                const modelMarkers = window.monaco.editor.getModelMarkers({ resource: model.uri });
                
                // Проверяем каждый маркер
                modelMarkers.forEach((marker: any) => {
                  if (marker.severity === 1) { // Ошибка
                    totalErrors++;
                  } else if (marker.severity === 2) { // Предупреждение
                    totalWarnings++;
                  }
                });
                
                // Если это активный файл и у него есть ошибки, обновляем иконку
                if (window.lastActiveFilePath && model.uri.toString().includes(window.lastActiveFilePath)) {
                  const modelErrors = modelMarkers.filter((m: any) => m.severity === 1).length;
                  const modelWarnings = modelMarkers.filter((m: any) => m.severity === 2).length;
                  
                  if (modelErrors > 0 || modelWarnings > 0) {
                    updateFileIcon(window.lastActiveFilePath, modelErrors > 0 ? 'error' : 'warning');
                  }
                }
              } catch (e) {
                // Игнорируем ошибки для одиночной модели
              }
            }
          });
          
          // Проверяем, нужно ли обновлять счетчики
          if (totalErrors !== errorCount || totalWarnings !== warningCount) {
            stableUpdateCounters(totalErrors, totalWarnings);
          }
        } catch (error) {
          console.error('Ошибка при периодической проверке маркеров:', error);
        }
      }
    };
    
    // Проверяем маркеры каждые 2 секунды
    const intervalId = setInterval(periodicCheckMarkersForAllFiles, 2000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeTab, errorCount, warningCount]);

  // Исправляем обработчик события refresh-problems-panel для использования улучшенной функции
  useEffect(() => {
    const handleRefreshProblemsPanel = (event: Event) => {
      logProblemMessage('Получено событие refresh-problems-panel');
      
      // Принудительно получаем все маркеры из Monaco безопасным способом
      const safeCollectAllMarkers = () => {
        if (!window.monaco || !window.monaco.editor) return;
        
        try {
          // Безопасно получаем все модели
          const allModels = window.monaco.editor.getModels();
          let allMarkers: any[] = [];
          
          // Проходим по каждой модели отдельно
          allModels.forEach((model: any) => {
            if (model && !model.isDisposed()) {
              try {
                // Получаем маркеры для конкретной модели
                const modelMarkers = window.monaco.editor.getModelMarkers({ resource: model.uri });
                allMarkers = allMarkers.concat(modelMarkers);
                
                // Группируем маркеры по URI для хранения в глобальном объекте
                const uri = model.uri.toString();
                
                // Безопасно обновляем lastKnownMarkers
                if (!window.lastKnownMarkers) {
                  window.lastKnownMarkers = {};
                }
                
                window.lastKnownMarkers[uri] = modelMarkers;
              } catch (e) {
                // Игнорируем ошибки для одиночной модели
              }
            }
          });
          
          logProblemMessage(`Безопасно получено ${allMarkers.length} маркеров из Monaco`);
          
          // Обновляем счетчики ошибок/предупреждений только если есть маркеры
          if (allMarkers.length > 0) {
            // Считаем количество ошибок и предупреждений
            const errors = allMarkers.filter((m: any) => m.severity === 1).length;
            const warnings = allMarkers.filter((m: any) => m.severity === 2).length;
            
            // Обновляем глобальные переменные
            window._latestErrorCount = errors;
            window._latestWarningCount = warnings;
            
            // Обновляем состояние только если значения изменились
            if (errors !== errorCount || warnings !== warningCount) {
              // Используем отложенное обновление для предотвращения тряски интерфейса
              setTimeout(() => {
                setErrorCount(errors);
                setWarningCount(warnings);
                // Легкое обновление фильтра для инициирования перерисовки
                setFilterSeverity(prev => prev);
              }, 100);
            }
          }
          
          return allMarkers.some((m: any) => m.severity === 1);
        } catch (error) {
          console.error('Ошибка при безопасном получении маркеров:', error);
          return false;
        }
      };
      
      // Запускаем безопасный сбор маркеров
      safeCollectAllMarkers();
      
      // Если активна вкладка проблем, обновляем её содержимое принудительно
      if (activeTab === 'issues') {
        // Принудительно обновляем маркеры через глобальную функцию
        if (window.forceDiagnosticsRefresh) {
          window.forceDiagnosticsRefresh();
        }
      }
    };
    
    document.addEventListener('refresh-problems-panel', handleRefreshProblemsPanel);
    
    return () => {
      document.removeEventListener('refresh-problems-panel', handleRefreshProblemsPanel);
    };
  }, [activeTab, errorCount, warningCount]);

  // Исправляем функцию handleTabClick
  const handleTabClick = (tab: "issues" | "terminal") => {
    // Устанавливаем выбранную вкладку - это явное действие пользователя
    setActiveTab(tab);
    
    // При переключении на вкладку проблем, обновляем диагностику
    if (tab === 'issues') {
      logProblemMessage('Переключение на вкладку проблем');
      
      // Принудительно проверяем все редакторы на наличие ошибок
      logProblemMessage('Запуск проверки всех редакторов на ошибки');
      checkAllEditorsForErrors();
      
      // Проверяем наличие маркеров в Monaco
      logProblemMessage('Проверка наличия маркеров в Monaco');
      checkAllModelsForMarkers();
      
      // Запускаем обновление диагностики
      if (window.forceDiagnosticsRefresh) {
        logProblemMessage('Запуск принудительного обновления диагностики');
        window.forceDiagnosticsRefresh();
      }
      
      // Обновляем счетчики ошибок/предупреждений
      const { errors, warnings } = updateErrorCounters();
      window._latestErrorCount = errors;
      window._latestWarningCount = warnings;
      
      // Триггерим обновление состояния через setTimeout
      setTimeout(() => {
        setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
      }, 300);
      
      // Автоматически разворачиваем файлы с ошибками
      if (window.lastKnownMarkers) {
        const newExpandedFiles = new Set(expandedFiles);
        Object.entries(window.lastKnownMarkers).forEach(([uri, markers]) => {
          if (Array.isArray(markers) && markers.length > 0 && 
              markers.some((m: any) => m.severity === 1)) {
            newExpandedFiles.add(uri);
          }
        });
        setExpandedFiles(newExpandedFiles);
      }
    }
  };

  // Изменяем функцию получения пути к файлу для более корректного отображения имени файла
  const getReadableFileName = (uri: string): string => {
    try {
      // Обрабатываем URL-закодированные пути (например, /g%3A/errors.py)
      if (uri.includes('%')) {
        try {
          // Декодируем URI компонент
          uri = decodeURIComponent(uri);
        } catch (e) {
          console.error('Ошибка при декодировании URI:', e);
        }
      }
      
      // Проверяем наличие URL-схемы (file://)
      if (uri.startsWith('file://')) {
        // Удаляем схему URI
        uri = uri.replace(/^file:\/\/\//, '');
        
        // Для Windows-путей
        if (/^[a-zA-Z]:/.test(uri)) {
          // Ничего не делаем, это уже правильный путь
        } else {
          // Добавляем слеш в начало для Unix-путей
          uri = '/' + uri;
        }
      }
      
      // Получаем только имя файла (без пути)
      const match = uri.match(/([^/\\]+)$/);
      
      if (match) {
        // Вернуть только имя файла без пути
        return match[1];
      }
      
      // Если не удалось извлечь имя, вернуть последнюю часть пути
      const parts = uri.split(/[/\\]/);
      const lastPart = parts[parts.length - 1];
      
      // Если и это не сработало, вернуть весь URI
      return lastPart || uri;
      } catch (error) {
      console.error('Ошибка при получении имени файла из URI:', error);
      return uri;
    }
  };

  // Функция для получения иконки по типу проблемы
  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error':
        return <AlertCircle size={14} className="severity-icon error" />;
      case 'warning':
        return <AlertTriangle size={14} className="severity-icon warning" />;
      case 'info':
        return <Info size={14} className="severity-icon info" />;
    }
  };

  // Модифицируем useEffect для обработки события show-problems-tab,
  // чтобы избежать автоматического переключения
  useEffect(() => {
    const handleShowProblemsTab = () => {
      console.log('Получено событие show-problems-tab');
      
      // Переключаемся на вкладку проблем ТОЛЬКО если пользователь не находится 
      // на вкладке терминала, или если это явный запрос
      const event = window.event as CustomEvent | undefined;
      const forceSwitch = event?.detail?.force === true;
      
      if (forceSwitch) {
        console.log('Принудительное переключение на вкладку проблем');
        setActiveTab('issues');
        return;
      }
      
      // НЕ переключаемся автоматически, если уже активна вкладка терминала
      if (activeTab === 'terminal') {
        console.log('Вкладка терминала активна, игнорируем автоматическое переключение');
        return;
      }
      
      console.log('Переключаемся на вкладку проблем');
      setActiveTab('issues');
    };
    
    document.addEventListener('show-problems-tab', handleShowProblemsTab);
    
    return () => {
      document.removeEventListener('show-problems-tab', handleShowProblemsTab);
    };
  }, [activeTab]); // Добавляем activeTab в зависимости

  // Обновляем handleMarkerEvent для использования улучшенной функции
  const handleMarkerEvent = (event: Event) => {
    // Используем смещенный timeout для предотвращения конфликтов с другими обработчиками
    setTimeout(() => {
      if (window.lastActiveFilePath) {
        // Используем оптимизированную функцию для проверки файла
        improvedCheckSingleFile(window.lastActiveFilePath);
      }
      // Обновляем глобальные счетчики только при необходимости
      debouncedUpdateErrorCounters();
    }, 100);
  };

  // Обновляем handleForcePushProblem для использования улучшенной функции
  const handleForcePushProblem = (event: Event) => {
    // Используем смещенный timeout для предотвращения конфликтов с другими обработчиками
    setTimeout(() => {
      const customEvent = event as CustomEvent;
      
      if (customEvent.detail && customEvent.detail.filePath) {
        // Используем оптимизированную функцию для проверки файла
        improvedCheckSingleFile(customEvent.detail.filePath);
      } else if (window.lastActiveFilePath) {
        // Если нет конкретного файла, проверяем активный
        improvedCheckSingleFile(window.lastActiveFilePath);
      }
      
      // Обновляем глобальные счетчики только при необходимости
      debouncedUpdateErrorCounters();
    }, 100);
  };

  // Добавляем отслеживание времени последнего нажатия клавиши 
  // для оптимизации проверки маркеров во время активного ввода
  useEffect(() => {
    const handleKeyDown = () => {
      // Обновляем время последнего нажатия клавиши
      window._lastKeyPressTime = Date.now();
    };
    
    // Добавляем обработчик нажатия клавиш
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Добавляем обработчик событий изменения модели, чтобы отследить активную печать
  useEffect(() => {
    // Используем единый флаг вместо постоянного обновления времени
    let isEditingNow = false;
    let editingTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleModelContentChanged = (model: any) => {
      if (!model) return;
      
      try {
        const uri = model.uri.toString();
        const filePath = uri.replace(/^file:\/\/\//, '');
        
        // Добавляем обработчик изменения контента модели
        if (!model._contentChangedHandlerAdded) {
          model._contentChangedHandlerAdded = true;
          
          model.onDidChangeContent((event: any) => {
            // Устанавливаем флаг редактирования и запускаем таймер
            window._isCurrentlyEditing = true;
            logProblems(`Модель изменена: ${filePath}`);
            
            // Немедленно очищаем маркеры для измененной области
            clearMarkersForChangedContent(model, event.changes);
            
            // Сбрасываем таймер редактирования
            if (window._editingTimer) {
              clearTimeout(window._editingTimer);
            }
            
            // Устанавливаем таймер для сброса флага редактирования
            window._editingTimer = setTimeout(() => {
              window._isCurrentlyEditing = false;
              logProblems(`Редактирование завершено: ${filePath}`);
              
              // Проверяем маркеры для текущего файла
              checkSingleFile(filePath);
              
              // Обновляем панель проблем
              setTimeout(() => {
                forceUpdateProblemsDisplay();
                setIssuesUpdated(prev => prev + 1);
              }, 300);
            }, 1000);
          });
        }
      } catch (e) {
        console.error('Ошибка в handleModelContentChanged:', e);
      }
    };
    
      if (window.monaco && window.monaco.editor) {
      try {
        // Подписываемся только на события активной модели вместо всех моделей сразу
        const subscriptions: any[] = [];
        
        // Определяем интерфейс для модели Monaco
        interface IMonacoModel {
          uri: { toString: () => string };
          isDisposed: () => boolean;
          onDidChangeContent: (listener: Function) => { dispose: () => void };
        }
        
        // Слушаем события создания и изменения активной модели
        const onDidCreateModelSubscription = window.monaco.editor.onDidCreateModel((model: any) => {
          // Для новой модели добавляем слушатель изменений
          if (model && typeof model.onDidChangeContent === 'function') {
            const changeSubscription = model.onDidChangeContent(handleModelContentChanged);
            subscriptions.push(changeSubscription);
          }
        });
        
        // Изначально добавляем слушатели к существующим моделям
        window.monaco.editor.getModels().forEach((model: any) => {
          try {
            if (model && !model.isDisposed() && typeof model.onDidChangeContent === 'function') {
              const changeSubscription = model.onDidChangeContent(handleModelContentChanged);
              subscriptions.push(changeSubscription);
            }
          } catch (e) {
            // Игнорируем ошибки для отдельных моделей
          }
        });
        
        subscriptions.push(onDidCreateModelSubscription);
        
        return () => {
          // При размонтировании компонента отписываемся от всех событий
          subscriptions.forEach(sub => {
            try {
              if (sub && typeof sub.dispose === 'function') {
                sub.dispose();
            }
          } catch (e) {
              // Игнорируем ошибки при очистке
            }
          });
          
          // Очищаем таймер
          if (editingTimer) {
            clearTimeout(editingTimer);
          }
        };
      } catch (e) {
        console.error('Ошибка при подписке на события Monaco:', e);
      }
    }
  }, []);
  
  // Оптимизируем функцию периодической проверки маркеров
  useEffect(() => {
    // Значительно улучшенная функция для проверки маркеров
    const periodicCheckMarkersForAllFiles = debounce(() => {
      // Пропускаем проверку во время активного редактирования
      if (window._isCurrentlyEditing === true) {
        return;
      }
      
      if (window.monaco && window.monaco.editor) {
        try {
          // Проверяем только если активна вкладка issues или прошло достаточно времени с момента последнего ввода
          const shouldCheck = activeTab === 'issues' || 
                            (window.lastActiveFilePath && (Date.now() - (window._lastKeyPressTime || 0) > 3000));
          
          if (!shouldCheck) return;
          
          // Проверяем только активную модель вместо всех моделей
          if (window.lastActiveFilePath) {
            const activeModelUri = window.monaco.Uri.file(window.lastActiveFilePath);
            const activeModel = window.monaco.editor.getModel(activeModelUri);
            
            if (activeModel && !activeModel.isDisposed()) {
              try {
                // Получаем маркеры только для активной модели
                const modelMarkers = window.monaco.editor.getModelMarkers({ resource: activeModel.uri });
                
                // Обновляем счетчики только при реальных изменениях
                const modelErrors = modelMarkers.filter((m: any) => m.severity === 1).length;
                const modelWarnings = modelMarkers.filter((m: any) => m.severity === 2).length;
                
                if (modelErrors !== window._errorsInCurrentFile || 
                    modelWarnings !== window._warningsInCurrentFile) {
                  // Обновляем глобальные счетчики
                  window._errorsInCurrentFile = modelErrors;
                  window._warningsInCurrentFile = modelWarnings;
                  
                  // Обновляем иконку только при необходимости
                  if (modelErrors > 0 || modelWarnings > 0) {
                    updateFileIcon(window.lastActiveFilePath, modelErrors > 0 ? 'error' : 'warning');
                  }
                  
                  // Обновляем общие счетчики только при значительных изменениях
                  if (activeTab === 'issues') {
                    // Используем стабильный способ обновления
                    stableUpdateCounters(modelErrors, modelWarnings);
                  }
                }
              } catch (e) {
                // Игнорируем ошибки для отдельной модели
              }
            }
          }
        } catch (error) {
          console.error('Ошибка при периодической проверке маркеров:', error);
        }
      }
    }, 1000); // Проверяем только раз в секунду вместо 2 раз
    
    // Увеличиваем интервал проверки до 3 секунд для снижения нагрузки
    const intervalId = setInterval(periodicCheckMarkersForAllFiles, 3000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeTab, errorCount, warningCount]);

  // Улучшаем функцию для очистки маркеров при изменении содержимого файла
  const clearMarkersForFile = (filePath: string) => {
    if (!filePath || !window.monaco || !window.monaco.editor) return;
    
    try {
      // Получаем URI файла
      const fileUri = window.monaco.Uri.file(filePath);
      
      // Проверяем, есть ли модель для этого файла
      const model = window.monaco.editor.getModel(fileUri);
      if (!model) return;
      
      // Очищаем маркеры из кэша
      if (window.errorsCache) {
        const uriString = fileUri.toString();
        if (window.errorsCache[uriString]) {
          delete window.errorsCache[uriString];
          logProblems(`Очищен кэш ошибок для файла ${filePath}`);
        }
      }
      
      // Обновляем счетчики и форсируем перерисовку
      debouncedUpdateAllProblemCounters();
      setIssuesUpdated(prev => prev + 1);
    } catch (e) {
      console.error('Ошибка при очистке маркеров для файла:', e);
    }
  };

  // Добавляем подписку на события изменения маркеров в Monaco Editor
  useEffect(() => {
    if (window.monaco && window.monaco.editor && typeof window.monaco.editor.onDidChangeMarkers === 'function') {
      try {
        // Создаем обработчик события изменения маркеров
        const handleMarkersChanged = debounce(() => {
          // Очищаем кэш ошибок для текущего файла
          if (window.lastActiveFilePath && window.errorsCache) {
            const fileUri = window.monaco.Uri.file(window.lastActiveFilePath).toString();
            if (window.errorsCache[fileUri]) {
              delete window.errorsCache[fileUri];
              logProblems(`Очищен кэш ошибок для файла ${window.lastActiveFilePath} после изменения маркеров`);
            }
          }
          
          // Обновляем список проблем
          forceUpdateProblemsDisplay();
          
          // Обновляем счетчики ошибок через дебаунсер
          debouncedUpdateAllProblemCounters();
          
          // Форсируем перерисовку панели проблем
          setIssuesUpdated(prev => prev + 1);
        }, 300);
        
        // Подписываемся на событие изменения маркеров
        const disposable = window.monaco.editor.onDidChangeMarkers(handleMarkersChanged);
        
        return () => {
          if (disposable && typeof disposable.dispose === 'function') {
            disposable.dispose();
          }
        };
      } catch (e) {
        console.error('Ошибка при подписке на события изменения маркеров:', e);
      }
    }
  }, []);

  // Определяем интерфейс для события изменения модели
  interface ModelContentChangeEvent {
    model: {
      uri: { toString: () => string };
    };
  }
  
  // Улучшаем обработчик событий изменения модели для активной очистки маркеров
  useEffect(() => {
    const clearErrorsOnEdit = debounce((model: any) => {
      try {
        if (model && model.uri) {
          const uri = model.uri.toString();
          
          // Определяем путь к файлу
          let filePath = uri;
          if (uri.startsWith('file://')) {
            filePath = uri.replace(/^file:\/\/\//, '');
          }
          
          // Очищаем кэш ошибок для этого файла
          clearMarkersForFile(filePath);
          
          // Если это Python файл, запускаем проверку через 1 секунду
          // после изменения, чтобы дать время на завершение редактирования
          if (filePath.endsWith('.py') && window.forcePythonCheck) {
            setTimeout(() => {
              if (window.forcePythonCheck) {
                window.forcePythonCheck(filePath);
              }
              
              // Даем время на обработку и обновляем панель проблем
              setTimeout(() => {
                forceUpdateProblemsDisplay();
                setIssuesUpdated(prev => prev + 1);
              }, 300);
            }, 1000);
          }
        }
      } catch (e) {
        console.error('Ошибка при очистке ошибок для измененной модели:', e);
      }
    }, 500);
    
    if (window.monaco && window.monaco.editor && typeof window.monaco.editor.onDidChangeModelContent === 'function') {
      try {
        // Подписываемся на изменение содержимого всех моделей
        const disposable = window.monaco.editor.onDidChangeModelContent((event: ModelContentChangeEvent) => {
          // Получаем модель, которая изменилась
          const model = event.model;
          
          // Запускаем очистку ошибок для этой модели
          clearErrorsOnEdit(model);
        });
        
        return () => {
          if (disposable && typeof disposable.dispose === 'function') {
            disposable.dispose();
          }
        };
      } catch (e) {
        console.error('Ошибка при подписке на события изменения содержимого моделей:', e);
      }
    }
  }, []);

  // Добавляем функцию для принудительной очистки маркеров
  const forceMarkersClearForCurrentFile = () => {
    if (!window.monaco || !window.monaco.editor || !window.lastActiveFilePath) return;
    
    try {
      const fileUri = window.monaco.Uri.file(window.lastActiveFilePath);
      
      // Пытаемся очистить маркеры для текущего файла
      if (typeof window.monaco.editor.setModelMarkers === 'function') {
        // Очищаем все маркеры для модели (установка пустого массива)
        window.monaco.editor.setModelMarkers(
          window.monaco.editor.getModel(fileUri) || null, 
          'monaco-editor', 
          []
        );
        
        logProblems(`Принудительно очищены все маркеры для файла ${window.lastActiveFilePath}`);
      }
      
      // Очищаем кэш ошибок для этого файла
      if (window.errorsCache) {
        const uriString = fileUri.toString();
        if (window.errorsCache[uriString]) {
          delete window.errorsCache[uriString];
          logProblems(`Очищен кэш ошибок для файла ${window.lastActiveFilePath}`);
        }
      }
      
      // Обновляем счетчики и форсируем перерисовку
      updateAllProblemCounters();
      forceUpdateProblemsDisplay();
      setIssuesUpdated(prev => prev + 1);
    } catch (e) {
      console.error('Ошибка при принудительной очистке маркеров:', e);
    }
  };
  
  // Улучшаем обработчик события сохранения файла
  useEffect(() => {
    const handleFileSaved = (event: Event) => {
      try {
        const customEvent = event as CustomEvent;
        const filePath = customEvent.detail?.filePath;
        
        if (filePath) {
          logProblems(`Файл сохранен: ${filePath}, обновляем проблемы`);
          
          // Очищаем предыдущие ошибки для этого файла
          clearMarkersForFile(filePath);
          
          // Запускаем проверку для Python файлов
          if (filePath.endsWith('.py') && window.forcePythonCheck) {
            setTimeout(() => {
              if (window.forcePythonCheck) {
                window.forcePythonCheck(filePath);
                
                // После проверки принудительно обновляем панель проблем
                setTimeout(() => {
                  forceUpdateProblemsDisplay();
                  setIssuesUpdated(prev => prev + 1);
                }, 300);
              }
            }, 300);
          } else {
            // Для других файлов просто обновляем панель
            setTimeout(() => {
              forceUpdateProblemsDisplay();
              setIssuesUpdated(prev => prev + 1);
            }, 300);
          }
        }
      } catch (e) {
        console.error('Ошибка при обработке события сохранения файла:', e);
      }
    };
    
    // Подписываемся на событие сохранения файла
    document.addEventListener('file-saved', handleFileSaved);
    
    return () => {
      document.removeEventListener('file-saved', handleFileSaved);
    };
  }, []);

  // Добавляем обработчик события принудительной очистки ошибок
  useEffect(() => {
    const handleClearErrors = () => {
      forceMarkersClearForCurrentFile();
    };
    
    // Подписываемся на событие очистки ошибок
    document.addEventListener('clear-file-errors', handleClearErrors);
    
    return () => {
      document.removeEventListener('clear-file-errors', handleClearErrors);
    };
  }, []);

  // Функция очистки маркеров для измененного контента
  const clearMarkersForChangedContent = (model: any, changes: any[]) => {
    if (!model || !changes || !changes.length || !window.monaco) return;
    
    try {
      // Получаем текущие маркеры для модели
      const currentMarkers = window.monaco.editor.getModelMarkers({
        resource: model.uri
      });
      
      if (!currentMarkers || currentMarkers.length === 0) return;
      
      // Добавляем интерфейс для маркера
      interface MonacoMarker {
        startLineNumber: number;
        endLineNumber: number;
        startColumn: number;
        endColumn: number;
        severity: number;
        message: string;
        source?: string;
        code?: string;
      }
      
      // Проверяем для каждого изменения, какие маркеры затронуты
      const markersToKeep = currentMarkers.filter((marker: MonacoMarker) => {
        // Проверяем, находится ли маркер в измененной области
        for (const change of changes) {
          // Получаем диапазон измененного текста
          const startLineNumber = change.range.startLineNumber;
          const endLineNumber = change.range.endLineNumber;
          
          // Если маркер находится в диапазоне изменений, удаляем его
          if (marker.startLineNumber >= startLineNumber && 
              marker.endLineNumber <= endLineNumber) {
            return false;
          }
        }
        return true;
      });
      
      // Если некоторые маркеры были удалены, обновляем модель
      if (markersToKeep.length < currentMarkers.length) {
        // Очищаем все маркеры
        window.monaco.editor.setModelMarkers(model, 'monaco-editor', []);
        
        // Устанавливаем только те маркеры, которые не затронуты изменениями
        if (markersToKeep.length > 0) {
          window.monaco.editor.setModelMarkers(model, 'monaco-editor', markersToKeep);
        }
        
        // Обновляем кэш ошибок
        if (window.errorsCache) {
          const uriString = model.uri.toString();
          if (window.errorsCache[uriString]) {
            window.errorsCache[uriString] = markersToKeep;
          }
        }
        
        updateAllProblemCounters();
      }
    } catch (e) {
      console.error('Ошибка в clearMarkersForChangedContent:', e);
    }
  };

  // Добавляем новую функцию для проверки одного файла
  const checkSingleFile = (filePath: string) => {
    if (!filePath) return;
    
    try {
      // Если это Python файл, используем специальную проверку
      if (filePath.endsWith('.py') && window.forcePythonCheck) {
        window.forcePythonCheck(filePath);
      }
      
      // Получаем URI файла 
      if (window.monaco) {
        const uri = window.monaco.Uri.file(filePath);
        
        // Проверяем наличие модели
        const model = window.monaco.editor.getModel(uri);
        if (model) {
          // Вызываем проверку с правильным количеством аргументов
          improvedCheckSingleFile(filePath);
        }
      }
    } catch (e) {
      console.error(`Ошибка при проверке маркеров для файла ${filePath}:`, e);
    }
  };

  // Добавим специальную функцию для очистки JSON-ошибок
  const clearJsonErrorsForFile = (filePath: string) => {
    if (!filePath || !filePath.toLowerCase().endsWith('.json') || !window.monaco || !window.monaco.editor) return;

    try {
      // Получаем URI файла
      const fileUri = window.monaco.Uri.file(filePath);
      
      // Получаем модель для этого файла
      const model = window.monaco.editor.getModel(fileUri);
      if (!model) return;
      
      // Очищаем маркеры для JSON-модели
      window.monaco.editor.setModelMarkers(model, 'json', []);
      
      // Очищаем запись в кэше ошибок
      if (window.errorsCache) {
        const uriString = fileUri.toString();
        if (window.errorsCache[uriString]) {
          delete window.errorsCache[uriString];
          logProblems(`Очищены JSON-ошибки для файла ${filePath}`);
        }
      }
      
      // Проверяем, валиден ли JSON после правок
      try {
        const content = model.getValue();
        if (content.trim()) {
          JSON.parse(content);
          logProblems(`JSON файл ${filePath} валиден после правок`);
        }
      } catch (error: any) {
        // Если JSON невалиден, создаем понятное сообщение об ошибке
        const errorMessage = error && typeof error.message === 'string' ? error.message : 'Неизвестная ошибка';
        logProblems(`JSON файл ${filePath} остаётся невалидным: ${errorMessage}`);
      }
      
      // Обновляем счетчики ошибок и предупреждений
      debouncedUpdateAllProblemCounters();
      setIssuesUpdated(prev => prev + 1);
    } catch (e) {
      console.error('Ошибка при очистке JSON ошибок для файла:', e);
    }
  };

  // Улучшаем обработчик события изменения модели
  useEffect(() => {
    // Определяем тип для события изменения модели
    interface JsonModelContentChangeEvent {
      model: MonacoModel;
    }

    const handleModelContentChange = (event: JsonModelContentChangeEvent) => {
      const model = event.model;
      if (!model) return;
      
      try {
        const uri = model.uri.toString();
        
        // Проверяем, является ли файл JSON-файлом
        if (uri.toLowerCase().endsWith('.json')) {
          // Для JSON файлов используем специальную функцию очистки
          let filePath = uri;
          if (uri.startsWith('file://')) {
            filePath = uri.replace(/^file:\/\/\//, '');
          }
          
          // Очищаем текущие ошибки JSON
          clearJsonErrorsForFile(filePath);
          
          // Добавляем таймер для проверки валидности JSON после завершения редактирования
          setTimeout(() => {
            try {
              const content = model.getValue();
              if (content.trim()) {
                try {
                  // Пытаемся распарсить JSON
                  JSON.parse(content);
                  // Если успешно, очищаем маркеры
                  window.monaco.editor.setModelMarkers(model, 'json', []);
                } catch (error: any) {
                  // Если невалидно, добавляем улучшенный маркер ошибки
                  const errorMessage = typeof error.message === 'string' 
                    ? error.message
                        .replace('Expected', 'Ожидается')
                        .replace('Unexpected', 'Неожиданный символ')
                        .replace('comma', 'запятая')
                        .replace('colon', 'двоеточие')
                        .replace('property name', 'имя свойства')
                        .replace('value', 'значение')
                        .replace('string', 'строка')
                        .replace('number', 'число')
                        .replace('end of file', 'конец файла')
                    : 'Ошибка в синтаксисе JSON';
                  
                  // Создаем понятный маркер ошибки
                  const position = getJsonErrorPosition(content, error);
                  
                  const marker = {
                    severity: 1, // error
                    message: `Ошибка JSON: ${errorMessage}`,
                    startLineNumber: position.line,
                    startColumn: position.column,
                    endLineNumber: position.line,
                    endColumn: position.column + 1,
                    source: 'json-validator'
                  };
                  
                  window.monaco.editor.setModelMarkers(model, 'json', [marker]);
                }
              }
            } catch (e) {
              console.error('Ошибка при валидации JSON:', e);
            }
          }, 500);
        }
      } catch (e) {
        console.error('Ошибка при обработке изменения JSON модели:', e);
      }
    };
    
    // Подписываемся на изменение содержимого JSON-моделей
    if (window.monaco && window.monaco.editor) {
      try {
        // Получаем все JSON-модели
        const jsonModels = window.monaco.editor.getModels().filter(
          (model: any) => model.uri && model.uri.toString().toLowerCase().endsWith('.json')
        );
        
        // Добавляем обработчики изменений для всех JSON-моделей
        jsonModels.forEach((model: any) => {
          if (!model._jsonContentHandlerAdded && typeof model.onDidChangeContent === 'function') {
            model._jsonContentHandlerAdded = true;
            model.onDidChangeContent(() => handleModelContentChange({ model }));
          }
        });
        
        // Добавляем обработчик для новых моделей
        const disposable = window.monaco.editor.onDidCreateModel((model: any) => {
          if (model.uri && model.uri.toString().toLowerCase().endsWith('.json') && 
              !model._jsonContentHandlerAdded && typeof model.onDidChangeContent === 'function') {
            model._jsonContentHandlerAdded = true;
            model.onDidChangeContent(() => handleModelContentChange({ model }));
          }
        });
        
        return () => {
          if (disposable && typeof disposable.dispose === 'function') {
            disposable.dispose();
          }
        };
      } catch (e) {
        console.error('Ошибка при подписке на события JSON-моделей:', e);
      }
    }
  }, []);

  // Функция для определения позиции ошибки в JSON файле
  const getJsonErrorPosition = (content: string, error: any): { line: number, column: number } => {
    try {
      // Если это не объект ошибки или у него нет сообщения, используем первую строку
      if (!error || typeof error.message !== 'string') {
        return { line: 1, column: 1 };
      }

      // Пытаемся извлечь информацию о позиции из сообщения об ошибке
      const positionMatch = error.message.match(/at position (\d+)/);
      if (positionMatch && positionMatch[1]) {
        const position = parseInt(positionMatch[1], 10);
        
        // Определяем номер строки и столбца по позиции
        const lines = content.substring(0, position).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        
        return { line, column };
      }
      
      // Альтернативный способ - поиск строки с ошибкой
      const lineMatch = error.message.match(/at line (\d+) column (\d+)/);
      if (lineMatch && lineMatch[1] && lineMatch[2]) {
        return {
          line: parseInt(lineMatch[1], 10),
          column: parseInt(lineMatch[2], 10)
        };
      }
      
      // Если не удалось определить позицию, возвращаем первую строку
      return { line: 1, column: 1 };
    } catch (e) {
      console.error('Ошибка при определении позиции JSON ошибки:', e);
      return { line: 1, column: 1 };
    }
  };

  // Улучшенная функция для принудительного удаления маркеров у файла при изменении его содержимого
  const forceClearMarkersOnEdit = (filePath: string) => {
    if (!filePath || !window.monaco || !window.monaco.editor) return;
    
    try {
      // Получаем URI файла
      const fileUri = window.monaco.Uri.file(filePath);
      
      // Удаляем все маркеры для этого файла
      window.monaco.editor.setModelMarkers(
        window.monaco.editor.getModel(fileUri) || null,
        'monaco-editor',
        [] // Пустой массив маркеров
      );
      
      // Очищаем кэш ошибок для этого файла
      if (window.errorsCache && fileUri) {
        const uriString = fileUri.toString();
        if (window.errorsCache[uriString]) {
          delete window.errorsCache[uriString];
          logProblems(`Принудительно очищен кэш ошибок для файла ${filePath}`);
        }
      }
      
      // Помечаем файл как измененный, чтобы обновить его статус
      if (window.openedFiles && !window.openedFiles.has(filePath)) {
        window.openedFiles.add(filePath);
      }
      
      // Обновляем панель проблем
      debouncedUpdateAllProblemCounters();
      setIssuesUpdated(prev => prev + 1);
    } catch (e) {
      console.error('Ошибка при принудительной очистке маркеров:', e);
    }
  };

  // Оптимизированная функция для обработки изменения содержимого модели
  const handleModelContentChanged = debounce((model: any) => {
          if (!model || model.isDisposed()) return;
          
    try {
      // Получаем URI модели и путь к файлу
          const uri = model.uri.toString();
      let filePath = uri;
      if (uri.startsWith('file://')) {
        filePath = uri.replace(/^file:\/\/\//, '');
      }
      
      // Устанавливаем флаг редактирования
      window._isCurrentlyEditing = true;
      window._lastKeyPressTime = Date.now();
      
      // Сначала принудительно очищаем все маркеры для модели
      window.monaco.editor.setModelMarkers(model, 'monaco-editor', []);
      
      // Очищаем кэш ошибок для изменённого файла
      if (window.errorsCache) {
        if (window.errorsCache[uri]) {
          delete window.errorsCache[uri];
          logProblems(`Очищен кэш ошибок для файла ${filePath}`);
        }
        // Также проверяем альтернативный URI (c file://)
        const alternativeUri = uri.startsWith('file://') ? 
          uri.replace(/^file:\/\/\//, '') : 
          `file:///${uri}`;
        if (window.errorsCache[alternativeUri]) {
          delete window.errorsCache[alternativeUri];
        }
      }
      
      // Немедленно очищаем счетчики ошибок
      const totalErrors = 0;
      const totalWarnings = 0;
      
      // Обновляем глобальные переменные
      window._errorsInCurrentFile = 0;
      window._warningsInCurrentFile = 0;
      window._latestErrorCount = totalErrors;
      window._latestWarningCount = totalWarnings;
      
      // Обновляем общие счетчики ошибок
      setErrorCount(totalErrors);
      setWarningCount(totalWarnings);
      
      // Сбрасываем флаг редактирования через 2 секунды
      if (window._editingTimer) {
        clearTimeout(window._editingTimer);
      }
      
      window._editingTimer = setTimeout(() => {
        window._isCurrentlyEditing = false;
        
        // После завершения редактирования выполняем проверку маркеров
        setTimeout(() => {
          if (filePath) {
            // Проверяем, есть ли ошибки после редактирования
            checkSingleFile(filePath);
            
            // Для Python-файлов выполняем дополнительную проверку
            if (filePath.endsWith('.py') && window.forcePythonCheck) {
              window.forcePythonCheck(filePath);
            }
            
            // Принудительно обновляем панель проблем
            setTimeout(() => {
              forceUpdateProblemsDisplay();
              setIssuesUpdated(prev => prev + 1);
            }, 300);
          }
        }, 500);
      }, 2000);
      
    } catch (e) {
      console.error('Ошибка при обработке изменения содержимого:', e);
    }
  }, 100);

  // Улучшенная функция проверки маркеров для отдельного файла
  const enhancedCheckSingleFile = (filePath: string) => {
    if (!filePath) return;
    
    try {
      if (window.monaco && window.monaco.editor) {
        const fileUri = window.monaco.Uri.file(filePath);
        
        // Сначала принудительно очищаем маркеры для измененного файла
        const model = window.monaco.editor.getModel(fileUri);
        if (model) {
          // Проверяем, существуют ли еще маркеры для этого файла
          const markers = window.monaco.editor.getModelMarkers({ resource: fileUri });
          if (markers && markers.length > 0) {
            // Если содержимое файла изменилось, очищаем устаревшие маркеры
            if (window._isCurrentlyEditing) {
              window.monaco.editor.setModelMarkers(model, 'monaco-editor', []);
              
              // Очищаем кэш ошибок для этого файла
              if (window.errorsCache) {
                const uriString = fileUri.toString();
                if (window.errorsCache[uriString]) {
                  delete window.errorsCache[uriString];
                }
              }
              
              // Немедленно обновляем счетчики
              updateErrorCounters();
            }
          }
        }
      }
    } catch (e) {
      console.error('Ошибка при проверке маркеров для файла:', e);
    }
  };

  // Добавляем обработку события изменения для всех моделей
  useEffect(() => {
    if (window.monaco && window.monaco.editor) {
      try {
        // Подписываемся на событие изменения содержимого модели
        const disposable = window.monaco.editor.onDidChangeModelContent((event: any) => {
          if (!event || !event.model) return;
          
          // Получаем модель, для которой произошло изменение
          const model = event.model;
          
          // Запускаем оптимизированную функцию для обработки изменения
          handleModelContentChanged(model);
        });
        
        // Подписываемся на событие создания новой модели
        const createDisposable = window.monaco.editor.onDidCreateModel((model: any) => {
          if (!model) return;
          
          // Добавляем слушатель изменений для новой модели
          model.onDidChangeContent(() => {
            handleModelContentChanged(model);
          });
        });
        
        // Изначально подписываем все существующие модели
        window.monaco.editor.getModels().forEach((model: any) => {
          if (model && !model._contentChangeHandlerAdded) {
            model._contentChangeHandlerAdded = true;
            model.onDidChangeContent(() => {
              handleModelContentChanged(model);
            });
          }
        });
        
        return () => {
          // Очищаем слушатели при размонтировании компонента
          if (disposable && disposable.dispose) {
            disposable.dispose();
          }
          if (createDisposable && createDisposable.dispose) {
            createDisposable.dispose();
          }
        };
      } catch (e) {
        console.error('Ошибка при подписке на события изменения содержимого:', e);
      }
    }
  }, []);

  // Добавляем глобальную функцию для принудительной очистки маркеров
  useEffect(() => {
    // Регистрируем глобальную функцию для очистки маркеров
    if (typeof window !== 'undefined') {
      window.clearFileMarkers = (filePath: string) => {
        forceClearMarkersOnEdit(filePath);
      };
      
      // Добавляем обработчик события принудительной очистки маркеров
      const handleForceClearMarkers = (event: CustomEvent) => {
        const filePath = event.detail?.filePath;
        if (filePath) {
          forceClearMarkersOnEdit(filePath);
        } else if (window.lastActiveFilePath) {
          forceClearMarkersOnEdit(window.lastActiveFilePath);
        }
      };
      
      // Регистрируем обработчик события
      document.addEventListener('force-clear-markers', handleForceClearMarkers as EventListener);
      
    return () => {
        document.removeEventListener('force-clear-markers', handleForceClearMarkers as EventListener);
    };
    }
  }, []);

  return (
    <div className="terminal-container" style={{ height: terminalHeight || 200 }}>
      <div className="terminal-resizer" onMouseDown={handleVerticalDrag}>
        <GripHorizontal size={14} color="#888" />
      </div>

      <div className="tab-header">
          <button
          className={`tab ${activeTab === "terminal" ? "active" : ""}`}
          onClick={() => handleTabClick('terminal')}
          >
            Терминал
          </button>
          <button
          className={`tab ${activeTab === "issues" ? "active" : ""} ${errorCount > 0 ? "with-errors" : warningCount > 0 ? "with-warnings" : ""}`}
          onClick={() => handleTabClick('issues')}
          data-error-count={errorCount > 0 ? errorCount : ''}
          data-warning-count={errorCount === 0 && warningCount > 0 ? warningCount : ''}
        >
          Проблемы {errorCount > 0 ? `(${errorCount})` : warningCount > 0 ? `(${warningCount})` : ''}
        </button>
        
        {activeTab === "issues" && (
          <button 
            className="refresh-button" 
            title="Обновить проблемы во всех файлах"
            onClick={() => {
              logProblemMessage('Принудительное обновление всех проблем');
              refreshAllProblems();
            }}
          >
            <RefreshCw size={14} />
          </button>
        )}
        
        <div className="tab-controls">
          {activeTab === "issues" ? (
            <>
              <button
                title="Показать/скрыть фильтры"
                onClick={() => setShowIssueFilters(!showIssueFilters)}
              >
                <FaFilter size={14} />
              </button>
              <button
                title="Проверить ошибки Python"
                onClick={() => {
                  logProblemMessage('Нажата кнопка проверки Python');
                  if (typeof window !== "undefined" && window.forceDiagnosticsRefresh) {
                    window.forceDiagnosticsRefresh();
                  }
                }}
              >
                <FaPython size={14} />
              </button>
            </>
          ) : (
            <>
              <button
                title="Очистить терминал"
                onClick={clearTerminal}
              >
                <AiOutlineClear size={16} />
              </button>
            </>
          )}
              <button
                title="Скрыть панель"
            onClick={closeTerminal}
              >
            <X size={16} />
              </button>
        </div>
      </div>

      <div className="tab-content">
        {/* Вкладка терминала */}
        <div 
          className="terminal"
          style={{ 
            display: activeTab === "terminal" ? "block" : "none",
            height: '100%'
          }}
        >
          {activeTab === "terminal" && (
            <div 
              ref={terminalRef} 
              style={{ 
                width: "100%",
                height: "100%",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
            />
          )}
        </div>
        
        {/* Вкладка проблем */}
        <div 
          className="issues-tab"
          style={{ 
            display: activeTab === "issues" ? "flex" : "none",
            flexDirection: "column"
          }}
        >
          {showIssueFilters && (
            <div className="issues-filters">
              {renderFilterControls()}
            </div>
          )}
          
          <div className="issues-content">
            {renderIssues()}
          </div>
        </div>
      </div>
      
      <div
        className={`status-indicator ${isProcessRunning ? "running" : "stopped"}`}
        title={isProcessRunning ? "Process running" : "Process not running"}
      />
    </div>
  );
};

export default Terminal;