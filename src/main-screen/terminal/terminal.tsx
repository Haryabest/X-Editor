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

// Обновляем объявление глобальных интерфейсов с добавлением новых свойств
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
  }
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
                
                // Создаем объект проблемы
                const issue: Issue = {
                  severity,
                  message: marker.message || 'Неизвестная ошибка',
                  line: marker.startLineNumber || 0,
                  column: marker.startColumn || 0,
                  endLine: marker.endLineNumber || 0,
                  endColumn: marker.endColumn || 0,
                  source: marker.source || 'monaco-editor'
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
      
      // Переключаем на вкладку проблем, если есть проблемы
      const hasIssues = (window.pythonDiagnosticsStore && Object.values(window.pythonDiagnosticsStore).some(
        markers => Array.isArray(markers) && markers.length > 0
      ));
      
      if (hasIssues && activeTab !== "issues") {
        console.log('Обнаружены проблемы, переключаем на вкладку проблем');
      setActiveTab("issues");
      }
      
      // Принудительно обновляем диагностику
      if (typeof window !== "undefined") {
        try {
          // Обновляем счетчики ошибок/предупреждений
          const { errors, warnings } = updateErrorCounters();
          window._latestErrorCount = errors;
          window._latestWarningCount = warnings;
          
          // Триггерим обновление состояния через setTimeout
          setTimeout(() => {
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
          }, 100);
          
          // Разворачиваем все файлы с ошибками
          if (window.pythonDiagnosticsStore) {
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
              
              // Если есть ошибки, переключаемся на вкладку проблем
              setTimeout(() => {
                setActiveTab("issues");
                
                // Принудительно перерисовываем компонент
                setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
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

  // Функция для проверки всех открытых редакторов на наличие ошибок
  const checkAllEditorsForErrors = () => {
    try {
      logProblems('Принудительная проверка всех открытых редакторов на наличие ошибок');
      
      // Получаем все модели из Monaco редактора
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        logProblems(`Найдено ${models.length} моделей для проверки ошибок`);
        
        models.forEach((model: any) => {
          try {
            const uri = model.uri.toString();
            if (uri.endsWith('.py')) {
              // Для Python файлов запускаем проверку диагностики
              if (window.forcePythonCheck) {
                logProblems(`Запуск принудительной проверки Python файла: ${uri}`);
                window.forcePythonCheck(uri);
              }
            }
            
            // Форсируем получение маркеров для модели
            const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
            logProblems(`Получено ${markers.length} маркеров для модели ${uri}`);
            
            // Принудительно запрашиваем маркеры у языковых сервисов
            if (window.monaco.editor.getModelMarkers) {
              const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
              
              // Добавляем открытый файл в список проверенных файлов
              if (!window.openedFiles) {
                window.openedFiles = new Set<string>();
              }
              
              const realPath = getActualFileFromInmemory(uri) || uri;
              window.openedFiles.add(realPath);
              
              logProblems(`Добавлен файл ${realPath} в список открытых файлов`);
            }
          } catch (e) {
            console.error('Ошибка при проверке модели на ошибки:', e);
          }
        });
      }
      
      // Обновляем отображение проблем после проверки всех файлов
      updateAllProblemCounters();
      setIssuesUpdated(prev => prev + 1);
    } catch (error) {
      console.error('Ошибка при проверке всех редакторов:', error);
    }
  };
  
  // Инициализация редактора и начальная загрузка проблем
  useEffect(() => {
    // Инициализируем кэш ошибок и список открытых файлов, если их еще нет
    if (!window.errorsCache) {
      window.errorsCache = {};
    }
    
    if (!window.openedFiles) {
      window.openedFiles = new Set<string>();
    }
    
    // Добавляем обработчик события изменения активного файла
    window.addEventListener('active-file-changed', handleActiveFileChange);
    
    // Добавляем обработчик события открытия файла
    window.addEventListener('file-opened', (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.filePath) {
        const filePath = customEvent.detail.filePath;
        
        // Добавляем файл в список открытых файлов
        if (!window.openedFiles) {
          window.openedFiles = new Set<string>();
        }
        
        window.openedFiles.add(filePath);
        logProblems(`Добавлен новый файл в список открытых: ${filePath}`);
        
        // Принудительно запрашиваем проверку на ошибки для всех открытых файлов
        // Это обеспечит отображение ошибок из всех открытых файлов
        setTimeout(() => {
          checkAllEditorsForErrors();
        }, 500);
      }
    });
    
    // Добавляем обработчик события закрытия файла
    window.addEventListener('file-closed', (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.filePath) {
        const filePath = customEvent.detail.filePath;
        
        logProblems(`Закрыт файл: ${filePath}`);
        
        // Удаляем файл из списка открытых файлов
        if (window.openedFiles) {
          window.openedFiles.delete(filePath);
          logProblems(`Удален файл из списка открытых: ${filePath}`);
        }
        
        // Удаляем файл из кэша ошибок
        if (window.errorsCache && window.errorsCache[filePath]) {
          delete window.errorsCache[filePath];
          logProblems(`Удален файл из кэша ошибок: ${filePath}`);
        }
        
        // Проверяем и удаляем все связанные с файлом ошибки
        // Это важно для inmemory-файлов, которые могут иметь разные URI
        if (window.errorsCache) {
          Object.keys(window.errorsCache).forEach(key => {
            const issueInfo = window.errorsCache[key];
            // Проверяем совпадение имени файла (без пути)
            const closedFileName = filePath.split(/[\/\\]/).pop();
            const cachedFileName = issueInfo.fileName;
            
            if (closedFileName === cachedFileName) {
              delete window.errorsCache[key];
              logProblems(`Удален связанный файл из кэша ошибок: ${key}`);
            }
          });
        }
        
        // Очищаем любые Python-диагностики для этого файла
        if (window.pythonDiagnosticsStore) {
          Object.keys(window.pythonDiagnosticsStore).forEach(uri => {
            if (uri !== '_fileMapping' && (uri.includes(filePath) || window.pythonDiagnosticsStore._fileMapping?.[uri] === filePath)) {
              delete window.pythonDiagnosticsStore[uri];
              logProblems(`Удалены Python-диагностики для файла: ${uri}`);
              
              // Также удаляем запись из маппинга, если есть
              if (window.pythonDiagnosticsStore._fileMapping) {
                Object.keys(window.pythonDiagnosticsStore._fileMapping).forEach(inmemoryUri => {
                  if (window.pythonDiagnosticsStore._fileMapping[inmemoryUri] === filePath) {
                    delete window.pythonDiagnosticsStore._fileMapping[inmemoryUri];
                    logProblems(`Удален маппинг для файла: ${inmemoryUri} -> ${filePath}`);
                  }
                });
              }
            }
          });
        }
        
        // Если файл был последним активным, очищаем это состояние
        if (window.lastActiveFilePath === filePath) {
          window.lastActiveFilePath = undefined;
        }
        
        // Обновляем отображение проблем
        setIssuesUpdated(prev => prev + 1);
        
        // Обновляем счетчики ошибок для нижнего тулбара
        updateErrorCountersForStatusBar();
      }
    });
    
    // При монтировании компонента проверяем все открытые редакторы на наличие ошибок
    setTimeout(() => {
      checkAllEditorsForErrors();
      // Обновляем счетчики ошибок для нижнего тулбара
      updateErrorCountersForStatusBar();
    }, 1000);
    
    // Устанавливаем интервал для периодической проверки всех редакторов
    const intervalId = setInterval(() => {
      checkAllEditorsForErrors();
      // Обновляем счетчики ошибок для нижнего тулбара
      updateErrorCountersForStatusBar();
    }, 10000); // Проверяем каждые 10 секунд
    
    return () => {
      window.removeEventListener('active-file-changed', handleActiveFileChange);
      clearInterval(intervalId);
    };
  }, []);

  // Функция для отправки обновленных счетчиков ошибок в нижний тулбар
  const updateErrorCountersForStatusBar = () => {
    try {
      // Подсчитываем общее количество ошибок и предупреждений
      let totalErrors = 0;
      let totalWarnings = 0;
      
      // Подсчитываем ошибки из кэша
      if (window.errorsCache) {
        Object.values(window.errorsCache).forEach((issueInfo) => {
          if (issueInfo && issueInfo.issues) {
            totalErrors += issueInfo.issues.filter(issue => issue.severity === 'error').length;
            totalWarnings += issueInfo.issues.filter(issue => issue.severity === 'warning').length;
          }
        });
      }
      
      // Создаем и отправляем событие markers-updated для нижнего тулбара
      const event = new CustomEvent('markers-updated', {
        detail: {
          errorCount: totalErrors,
          warningCount: totalWarnings
        }
      });
      
      document.dispatchEvent(event);
      
      // Также сохраняем данные в глобальные переменные для доступа из других компонентов
      window._latestErrorCount = totalErrors;
      window._latestWarningCount = totalWarnings;
      
      logProblems(`Отправка счетчиков ошибок в тулбар: ${totalErrors} ошибок, ${totalWarnings} предупреждений`);
    } catch (error) {
      console.error('Ошибка при обновлении счетчиков ошибок для нижнего тулбара:', error);
    }
  };

  // Модифицируем функцию handleActiveFileChange для правильной обработки смены активного файла
  const handleActiveFileChange = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail && customEvent.detail.filePath) {
      const filePath = customEvent.detail.filePath;
      
      // Логируем активный файл
      logProblems(`Активирован файл: ${filePath}`);
      
      // Сохраняем путь к последнему активному файлу
      window.lastActiveFilePath = filePath;
      
      // Добавляем файл в список открытых файлов
      if (!window.openedFiles) {
        window.openedFiles = new Set<string>();
      }
      
      window.openedFiles.add(filePath);
      
      // Если у нас файл Python, вызываем принудительную проверку
      if (filePath.endsWith('.py') && window.forcePythonCheck) {
        logProblems(`Запуск принудительной проверки Python для активного файла`);
        window.forcePythonCheck(filePath);
      }
      
      // Принудительно запрашиваем проверку на ошибки для ВСЕХ открытых файлов
      // чтобы обновить и отобразить ошибки из всех файлов
      setTimeout(() => {
        checkAllEditorsForErrors();
      }, 300);
      
      // Меняем состояние, чтобы вызвать повторный рендеринг
      setActiveFile(filePath);
    }
  };

  // Добавляем слушатель события show-problems-tab
  useEffect(() => {
    const handleShowProblemsTab = () => {
      console.log('Получено событие show-problems-tab, переключаемся на вкладку проблем');
      // Переключаемся на вкладку проблем
      setActiveTab('issues');
    };
    
    document.addEventListener('show-problems-tab', handleShowProblemsTab);
    
    return () => {
      document.removeEventListener('show-problems-tab', handleShowProblemsTab);
    };
  }, []);

  // Чтобы обновлять панель проблем при открытии файла с ошибками, 
  // добавляем эффект следящий за selectedFile в пропсах
  useEffect(() => {
    const selectedFilePath = props.selectedFile as string; // Приводим к типу string, т.к. мы уже проверили ниже
    if (selectedFilePath && selectedFilePath.trim() !== '') {
      // Если есть проблемы для текущего файла, переключаемся на вкладку проблем
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
              
              // Если есть ошибки (не только предупреждения), автоматически 
              // переключаемся на вкладку проблем
              if (markers.some((m: any) => m.severity === 1)) {
                console.log('Найдены ошибки, переключаемся на вкладку проблем');
                setActiveTab('issues');
              }
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
    // Функция для проверки маркеров
    const checkMarkers = () => {
      if (activeTab === 'issues' && window.monaco && window.monaco.editor) {
        try {
          // Получаем все маркеры
          const markers = window.monaco.editor.getModelMarkers();
          if (markers && markers.length > 0) {
            console.log(`Найдено ${markers.length} маркеров в редакторе`);
            // Триггерим перерисовку компонента
            setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
          }
        } catch (error) {
          console.error('Ошибка при проверке маркеров:', error);
        }
      }
    };
    
    // Проверяем маркеры каждые 2 секунды
    const intervalId = setInterval(checkMarkers, 2000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeTab]);

  // Исправляем обработчик события refresh-problems-panel
  useEffect(() => {
    const handleRefreshProblemsPanel = (event: Event) => {
      logProblemMessage('Получено событие refresh-problems-panel');
      
      // Принудительно получаем все маркеры из Monaco
      const collectAllMarkers = () => {
      if (!window.monaco || !window.monaco.editor) return;
        
        try {
          // Получаем все маркеры из Monaco
          const allMarkers = window.monaco.editor.getModelMarkers();
          logProblemMessage(`Получено ${allMarkers.length} маркеров из Monaco`);
          
          // Группируем маркеры по URI
          const markersMap = new Map<string, any[]>();
          allMarkers.forEach((marker: any) => {
            if (marker && marker.resource) {
              const uri = marker.resource.toString();
              if (!markersMap.has(uri)) {
                markersMap.set(uri, []);
              }
              markersMap.get(uri)?.push(marker);
            }
          });
          
          // Обновляем lastKnownMarkers
          if (!window.lastKnownMarkers) {
            window.lastKnownMarkers = {};
          }
          
          // Записываем маркеры в глобальное хранилище
          markersMap.forEach((markers, uri) => {
            window.lastKnownMarkers[uri] = markers;
          });
          
          // Обновляем счетчики ошибок/предупреждений
          const { errors, warnings } = updateErrorCounters();
          window._latestErrorCount = errors;
          window._latestWarningCount = warnings;
          
          // Триггерим обновление состояния через setTimeout
          setTimeout(() => {
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
          }, 100);
          
          return allMarkers.some((m: any) => m.severity === 1);
      } catch (error) {
          console.error('Ошибка при получении маркеров:', error);
          return false;
      }
    };
    
      // Запускаем сбор маркеров
      collectAllMarkers();
    
      // Если активна вкладка проблем, обновляем её содержимое
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
  }, [activeTab]);

  // Исправляем функцию handleTabClick
  const handleTabClick = (tab: "issues" | "terminal") => {
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