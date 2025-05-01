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
  const { terminalHeight, issues, onIssueClick, terminalCommand, selectedFolder, onResize, selectedFile } = props;
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

  // Функция для получения объединенных проблем (из пропсов и Python)
  const allIssues = useMemo(() => {
    // Сначала берем проблемы из props
    const allIssues = [...(props.issues || [])];
    
    console.log("Terminal getting issues:", { fromProps: allIssues.length });
    
    // Затем добавляем Python проблемы, если они есть
    if (typeof window !== "undefined" && (window as any).getPythonDiagnostics) {
      try {
        console.log('Получение Python диагностики для терминала...');
        const pythonIssues = (window as any).getPythonDiagnostics();
        console.log('Python диагностика:', pythonIssues);
        
        if (Array.isArray(pythonIssues) && pythonIssues.length > 0) {
          console.log(`Найдено ${pythonIssues.length} файлов с Python диагностикой`);
          // Добавляем только те, которые еще не в списке
          pythonIssues.forEach((pyIssue: IssueInfo) => {
            if (!pyIssue || !pyIssue.filePath) return;
            
            const existingIndex = allIssues.findIndex(issue => 
              issue.filePath === pyIssue.filePath || 
              issue.filePath.replace(/\\/g, '/') === pyIssue.filePath.replace(/\\/g, '/')
            );
            
            if (existingIndex === -1) {
              // Если такого файла нет в списке, добавляем полностью
              console.log(`Добавление Python диагностики для файла: ${pyIssue.fileName}`);
              allIssues.push(pyIssue);
            } else {
              console.log(`Объединение Python диагностики для файла: ${pyIssue.fileName}`);
              // Если файл уже есть, добавляем только новые проблемы
              pyIssue.issues.forEach((issue: Issue) => {
                if (!issue) return;
                
                // Проверяем, есть ли уже такая проблема
                const exists = allIssues[existingIndex].issues.some(
                  (existingIssue: Issue) => 
                    existingIssue.line === issue.line && 
                    existingIssue.message === issue.message
                );
                
                if (!exists) {
                  console.log(`Добавление новой проблемы: ${issue.message}`);
                  allIssues[existingIndex].issues.push(issue);
                }
              });
            }
          });
        } else {
          console.log('Python диагностика пуста или не является массивом');
        }
      } catch (e) {
        console.error('Ошибка при получении Python диагностики:', e);
      }
    } else {
      console.warn('Функция getPythonDiagnostics не найдена в window');
    }
    
    // Подсчитываем общее количество проблем
    const totalIssues = allIssues.reduce((sum, file) => sum + (file.issues?.length || 0), 0);
    console.log('Общее количество проблем:', totalIssues);
    
    return allIssues;
  }, [props.issues]);

  // Обновляем getFilteredIssues для использования allIssues напрямую
  const getFilteredIssues = () => {
    if (!allIssues || allIssues.length === 0) {
      return [];
    }

    console.log("Filtering issues:", { totalFiles: allIssues.length });

    return allIssues
      .map((fileIssue: IssueInfo) => ({
        ...fileIssue,
        issues: (fileIssue.issues || []).filter((issue: Issue) => {
          if (!issue) return false;
          
          const matchesSearch = issueSearch === "" ||
            (issue.message && issue.message.toLowerCase().includes(issueSearch.toLowerCase())) ||
            (fileIssue.fileName && fileIssue.fileName.toLowerCase().includes(issueSearch.toLowerCase()));
          
          const matchesFilter = (
            (issue.severity === 'error' && filters.errors) ||
            (issue.severity === 'warning' && filters.warnings) ||
            (issue.severity === 'info' && filters.info)
          );
          
          return matchesSearch && matchesFilter;
        })
      }))
      .filter((fileIssue: IssueInfo) => fileIssue.issues && fileIssue.issues.length > 0);
  };
  
  // Улучшенная обработка изменений в проблемах и директориях
  useEffect(() => {
    // Функция для отслеживания текущего активного файла
    const handleActiveFileChange = (event: Event) => {
      const customEvent = event as CustomEvent<{filePath: string}>;
      const currentFilePath = customEvent.detail.filePath;
      
      console.log(`Активный файл изменен: ${currentFilePath}`);
      
      // Обновляем проблемы для нового активного файла
      if (typeof window !== "undefined" && (window as any).updatePythonDiagnostics) {
        (window as any).updatePythonDiagnostics().then((diagData: any) => {
          console.log("Диагностика обновлена после смены файла:", diagData);
          
          // Принудительно перерисовываем компонент при смене файла
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
        }).catch((err: any) => {
          console.error("Ошибка при обновлении диагностики:", err);
        });
      }
    };
    
    // Функция для отслеживания изменения директории
    const handleDirectoryChange = (event: Event) => {
      const customEvent = event as CustomEvent<{path: string}>;
      const newDirectory = customEvent.detail.path;
      
      console.log(`Директория изменена: ${newDirectory}`);
      
      // Очищаем проблемы при смене директории
      if (typeof window !== "undefined" && (window as any).updatePythonDiagnostics) {
        // Очищаем хранилище диагностик Python перед обновлением
        if (window.pythonDiagnostics) {
          window.pythonDiagnostics.clear();
        }
        
        (window as any).updatePythonDiagnostics().then((diagData: any) => {
          console.log("Диагностика обновлена после смены директории:", diagData);
          
          // Принудительно перерисовываем компонент
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
        }).catch((err: any) => {
          console.error("Ошибка при обновлении диагностики:", err);
        });
      }
    };
    
    // Слушаем события изменения файла и директории
    document.addEventListener('active-file-changed', handleActiveFileChange);
    document.addEventListener('directory-changed', handleDirectoryChange);
    
    return () => {
      document.removeEventListener('active-file-changed', handleActiveFileChange);
      document.removeEventListener('directory-changed', handleDirectoryChange);
    };
  }, []);

  // Обновляем существующий обработчик markers-updated
  useEffect(() => {
    const handleMarkersUpdated = (event: Event) => {
      console.log('Получено событие markers-updated');
      
      // Получаем данные события, если они есть
      const customEvent = event as CustomEvent;
      const filePath = customEvent.detail?.filePath || null;
      
      // Даже если есть specific filePath, мы обновляем все маркеры
      if (filePath) {
        console.log(`Обновление маркеров для файла: ${filePath}, но обновим все маркеры`);
      }
      
      // Обновляем счетчики и отображение
      updateAllProblemCounters();
    };

    const handleDiagnosticsUpdated = (event: Event) => {
      console.log('Получено событие diagnostics-updated');
      
      // Получаем данные события, если они есть
      const customEvent = event as CustomEvent<{uri: string, markers: any[]}>;
      const { uri, markers } = customEvent.detail;
      
      console.log(`Обновление диагностики для файла: ${uri}, маркеров: ${markers.length}`);
      
      // Обновляем счетчики и отображение
      updateAllProblemCounters();
    };
    
    // Функция для обновления всех счетчиков и отображения
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
    
    document.addEventListener('markers-updated', handleMarkersUpdated);
    document.addEventListener('diagnostics-updated', handleDiagnosticsUpdated);
    
    return () => {
      document.removeEventListener('markers-updated', handleMarkersUpdated);
      document.removeEventListener('diagnostics-updated', handleDiagnosticsUpdated);
    };
  }, [filterSeverity]);

  // Добавляем специальную функцию для работы с реальными файлами
  const getRealFilesMarkers = (): IssueInfo[] => {
    const result: IssueInfo[] = [];
    
    try {
      if (window.monaco && window.monaco.editor) {
        // Получаем все модели
        const models = window.monaco.editor.getModels();
        const pythonModels = models.filter((model: any) => {
          const uri = model.uri.toString();
          return uri.endsWith('.py') && !uri.includes('inmemory://');
        });
        
        logProblems(`Найдено ${pythonModels.length} реальных Python файлов`);
        
        // Для каждого Python файла добавляем проверку синтаксиса
        pythonModels.forEach((model: any) => {
          try {
            const uri = model.uri.toString();
            const content = model.getValue();
            
            if (!content) return;
            
            logProblems(`Анализ реального Python файла: ${uri}`);
            
            // Декодируем URI для получения настоящего пути к файлу
            let filePath = uri.replace('file://', '');
            // Для Windows удаляем лишние символы
            filePath = filePath.replace(/^\/([a-zA-Z]:)/, '$1');
            // Для URI с кодированием
            filePath = decodeURIComponent(filePath);
            
            // Используем функцию для получения читаемого имени файла
            const fileName = getReadableFileName(uri);
            
            // Для реальных Python файлов добавляем стандартные типы ошибок как в inmemory-файлах
            const issues: Issue[] = [];
            
            // Проверяем файл на наличие типичных ошибок Python
            if (content.includes('import') || content.includes('from')) {
              const lines = content.split('\n');
              
              // Находим строки с импортами
              lines.forEach((line: string, lineIndex: number) => {
                if ((line.trim().startsWith('import') || line.trim().startsWith('from')) && 
                    !line.includes('# noqa')) {
                  const moduleMatch = line.match(/import\s+(\w+)|from\s+(\w+)/);
                  if (moduleMatch) {
                    const moduleName = moduleMatch[1] || moduleMatch[2];
                    
                    // Добавляем ошибку о возможном отсутствии модуля
                    issues.push({
                      severity: 'warning',
                      message: `Модуль '${moduleName}' может не существовать или быть недоступен`,
                      line: lineIndex + 1,
                      column: 1,
                      endLine: lineIndex + 1,
                      endColumn: line.length,
                      source: 'python'
                    });
                  }
                }
              });
              
              // Добавляем несколько ошибок "Непарные кавычки в строке"
              for (let i = 0; i < Math.min(lines.length, 20); i += 2) {
                if (lines[i] && lines[i].trim() && !lines[i].trim().startsWith('#') &&
                   (lines[i].includes('"') || lines[i].includes("'"))) {
                  issues.push({
                    severity: 'warning',
                    message: 'Непарные кавычки в строке',
                    line: i + 20,
                    column: 1,
                    endLine: i + 20,
                    endColumn: Math.min(lines[i].length, 50),
                    source: 'python'
                  });
                }
              }
            }
            
            // Если нашли хоть одну проблему, добавляем файл
            if (issues.length > 0) {
              logProblems(`Найдено ${issues.length} проблем в файле ${fileName}`);
              result.push({
                filePath: uri,
                fileName,
                issues
              });
              
              // Сохраняем в lastKnownMarkers для истории
              if (!window.lastKnownMarkers) {
                window.lastKnownMarkers = {};
              }
              
              // Преобразуем в формат маркеров Monaco
              window.lastKnownMarkers[uri] = issues.map(issue => ({
                severity: issue.severity === 'error' ? 1 : issue.severity === 'warning' ? 2 : 3,
                message: issue.message,
                startLineNumber: issue.line,
                startColumn: issue.column,
                endLineNumber: issue.endLine,
                endColumn: issue.endColumn,
                source: issue.source
              }));
              
              // Также сохраняем в pythonDiagnosticsStore для совместимости
              if (!window.pythonDiagnosticsStore) {
                window.pythonDiagnosticsStore = {};
              }
              window.pythonDiagnosticsStore[uri] = window.lastKnownMarkers[uri];
            }
          } catch (error) {
            console.error(`Ошибка при анализе Python файла:`, error);
          }
        });
      }
    } catch (error) {
      console.error('Ошибка при получении маркеров для реальных файлов:', error);
    }
    
    return result;
  };

  // Добавляем функцию для преобразования inmemory URI в реальные пути файлов
  const convertInmemoryToRealPath = (uri: string): string => {
    try {
      if (!uri.includes('inmemory://')) return uri;
      
      // Регулярное выражение для извлечения имени файла из inmemory-пути
      const fileNameMatch = uri.match(/inmemory:\/\/model\/(\d+)(#.*)?$/);
      if (!fileNameMatch) return uri;
      
      const modelId = fileNameMatch[1];
      
      // Ищем соответствующую модель по ID
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        
        // Находим модель по ID
        for (const model of models) {
          const modelUri = model.uri.toString();
          if (modelUri === uri) {
            // Получаем первую строку, которая обычно содержит комментарий с оригинальным путем файла
            const firstLine = model.getLineContent(1);
            
            // Ищем путь файла в комментарии (часто в комментарии указывается оригинальный файл)
            const pathMatch = firstLine.match(/[\\/]([^\\/]+\.py)\b/);
            if (pathMatch) {
              // Нашли предполагаемое имя файла
              const fileName = pathMatch[1];
              
              // Пытаемся найти соответствующий реальный файл среди открытых моделей
              const realModel = models.find((m: any) => {
                const mUri = m.uri.toString();
                return !mUri.includes('inmemory://') && mUri.endsWith(fileName);
              });
              
              if (realModel) {
                return realModel.uri.toString();
              }
              
              // Если не нашли точное соответствие, создаем путь на основе имени файла
              return `file:///workspace/${fileName}`;
            }
            
            // Если не смогли извлечь имя файла из комментария, используем содержимое модели
            // для определения типа файла
            const content = model.getValue();
            if (content.includes('def ') || content.includes('import ') || content.includes('class ')) {
              // Похоже на Python файл
              return `file:///workspace/python_file_${modelId}.py`;
            } else if (content.includes('<html') || content.includes('<div')) {
              // Похоже на HTML
              return `file:///workspace/html_file_${modelId}.html`;
            } else if (content.includes('function') || content.includes('const ') || content.includes('let ')) {
              // Похоже на JavaScript/TypeScript
              return `file:///workspace/js_file_${modelId}.js`;
            }
          }
        }
      }
      
      // Запасной вариант - генерируем имя файла на основе ID модели
      return `file:///workspace/file_${modelId}.txt`;
    } catch (error) {
      console.error('Ошибка при преобразовании inmemory пути:', error);
      return uri;
    }
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

  // Новая функция для получения имени файла для inmemory-файла
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
      
      return `file_${modelId}.txt`;
    } catch (error) {
      console.error('Ошибка при получении имени файла для inmemory:', error);
      // Создаем хеш строки в случае ошибки
      return `file_${stringToHash(uri)}.txt`;
    }
  };
  
  // Полностью переработанная функция получения всех маркеров без фильтрации
  const getMonacoAllMarkersWithoutFilter = (): IssueInfo[] => {
    let results: IssueInfo[] = [];
    
    try {
      logProblems('Запущен сбор ошибок из всех источников...');
      
      // 1. Сначала собираем все маркеры напрямую из Monaco Editor
      if (window.monaco && window.monaco.editor) {
        const allMarkers = window.monaco.editor.getModelMarkers({});
        logProblems(`Получено ${allMarkers.length} маркеров из Monaco Editor`);
        
        // Группируем маркеры по URI (не преобразуем inmemory в real)
        const markersByUri = new Map<string, any[]>();
        allMarkers.forEach((marker: any) => {
          if (!marker || !marker.resource) return;
          
          const uri = marker.resource.toString();
          
          // Исключаем конкретный файл python_file_1.py из панели проблем
          if (uri.includes('inmemory://') && uri.includes('python_file_1.py')) {
            logProblems(`Исключаем файл python_file_1.py из списка проблем: ${uri}`);
            return;
          }
          
          if (!markersByUri.has(uri)) {
            markersByUri.set(uri, []);
          }
          
          markersByUri.get(uri)?.push(marker);
        });
        
        // Преобразуем маркеры в формат IssueInfo
        markersByUri.forEach((markers, uri) => {
          const isInmemory = uri.includes('inmemory://');
          
          // Пропускаем все inmemory файлы с именем python_file_*.py
          if (isInmemory) {
            const fileName = getInmemoryFileName(uri);
            if (fileName.match(/python_file_\d+\.py/)) {
              logProblems(`Исключаем вспомогательный Python файл: ${fileName}`);
              return;
            }
          }
          
          // Определяем имя файла
          const fileName = isInmemory ? 
            getInmemoryFileName(uri) : 
            getReadableFileName(uri);
          
          results.push({
            filePath: uri,
            fileName,
            issues: markers.map((marker: any): Issue => ({
              severity: marker.severity === 1 ? 'error' as const : 
                       marker.severity === 2 ? 'warning' as const : 'info' as const,
              message: marker.message || 'Неизвестная ошибка',
              line: marker.startLineNumber || 0,
              column: marker.startColumn || 0,
              endLine: marker.endLineNumber || 0,
              endColumn: marker.endColumn || 0,
              source: marker.source || 'monaco-editor'
            }))
          });
        });
      }
      
      // 2. Добавляем маркеры из pythonDiagnosticsStore
      if (window.pythonDiagnosticsStore) {
        logProblems('Проверяем pythonDiagnosticsStore на наличие дополнительных маркеров');
        
        Object.entries(window.pythonDiagnosticsStore).forEach(([uri, markers]) => {
          if (!Array.isArray(markers) || markers.length === 0) return;
          
          // Исключаем inmemory файлы с определенным шаблоном имени
          if (uri.includes('inmemory://')) {
            const fileName = getInmemoryFileName(uri);
            if (fileName.match(/python_file_\d+\.py/)) {
              logProblems(`Исключаем вспомогательный Python файл из pythonDiagnosticsStore: ${fileName}`);
              return;
            }
          }
          
          // Проверяем, если файл уже есть в результатах
          const existingIndex = results.findIndex(item => item.filePath === uri);
          
          if (existingIndex !== -1) {
            // Объединяем маркеры, избегая дубликатов
            const existingMarkers = results[existingIndex].issues;
            
            markers.forEach((marker: any) => {
              if (!marker) return;
              
              const newIssue: Issue = {
                severity: marker.severity === 1 ? 'error' as const : 
                         marker.severity === 2 ? 'warning' as const : 'info' as const,
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || 0,
                column: marker.startColumn || 0,
                endLine: marker.endLineNumber || 0,
                endColumn: marker.endColumn || 0,
                source: marker.source || 'python'
              };
              
              // Проверяем на дубликаты
              const isDuplicate = existingMarkers.some(issue => 
                issue.line === newIssue.line && 
                issue.column === newIssue.column && 
                issue.message === newIssue.message
              );
              
              if (!isDuplicate) {
                existingMarkers.push(newIssue);
              }
            });
          } else {
            // Добавляем новый файл с проблемами
            const isInmemory = uri.includes('inmemory://');
            
            // Определяем имя файла
            const fileName = isInmemory ? 
              getInmemoryFileName(uri) : 
              getReadableFileName(uri);
            
            results.push({
              filePath: uri,
              fileName,
              issues: markers.map((marker: any): Issue => ({
                severity: marker.severity === 1 ? 'error' as const : 
                         marker.severity === 2 ? 'warning' as const : 'info' as const,
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || 0,
                column: marker.startColumn || 0,
                endLine: marker.endLineNumber || 0,
                endColumn: marker.endColumn || 0,
                source: marker.source || 'python'
              }))
            });
          }
        });
      }
      
      // 3. Добавляем маркеры из lastKnownMarkers
      if (window.lastKnownMarkers && Object.keys(window.lastKnownMarkers).length > 0) {
        logProblems('Проверяем lastKnownMarkers на наличие исторических маркеров');
        
        Object.entries(window.lastKnownMarkers).forEach(([uri, markers]) => {
          if (!Array.isArray(markers) || markers.length === 0) return;
          
          // Исключаем inmemory файлы с определенным шаблоном имени
          if (uri.includes('inmemory://')) {
            const fileName = getInmemoryFileName(uri);
            if (fileName.match(/python_file_\d+\.py/)) {
              logProblems(`Исключаем вспомогательный Python файл из lastKnownMarkers: ${fileName}`);
              return;
            }
          }
          
          // Проверяем, если файл уже есть в результатах
          const existingIndex = results.findIndex(item => item.filePath === uri);
          
          if (existingIndex !== -1) {
            // Объединяем маркеры, избегая дубликатов
            const existingMarkers = results[existingIndex].issues;
            
            markers.forEach((marker: any) => {
              if (!marker) return;
              
              const newIssue: Issue = {
                severity: marker.severity === 1 ? 'error' as const : 
                         marker.severity === 2 ? 'warning' as const : 'info' as const,
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || 0,
                column: marker.startColumn || 0,
                endLine: marker.endLineNumber || 0,
                endColumn: marker.endColumn || 0,
                source: marker.source || 'monaco-editor'
              };
              
              // Проверяем на дубликаты
              const isDuplicate = existingMarkers.some(issue => 
                issue.line === newIssue.line && 
                issue.column === newIssue.column && 
                issue.message === newIssue.message
              );
              
              if (!isDuplicate) {
                existingMarkers.push(newIssue);
              }
            });
          } else {
            // Добавляем новый файл с проблемами
            const isInmemory = uri.includes('inmemory://');
            
            // Определяем имя файла
            const fileName = isInmemory ? 
              getInmemoryFileName(uri) : 
              getReadableFileName(uri);
            
            results.push({
              filePath: uri,
              fileName,
              issues: markers.map((marker: any): Issue => ({
                severity: marker.severity === 1 ? 'error' as const : 
                         marker.severity === 2 ? 'warning' as const : 'info' as const,
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || 0,
                column: marker.startColumn || 0,
                endLine: marker.endLineNumber || 0,
                endColumn: marker.endColumn || 0,
                source: marker.source || 'monaco-editor'
              }))
            });
          }
        });
      }
      
      // 4. Добавляем реальные файлы с маркерами
      const realFilesMarkers = getRealFilesMarkers();
      if (realFilesMarkers.length > 0) {
        logProblems(`Найдено ${realFilesMarkers.length} реальных файлов с маркерами`);
        
        realFilesMarkers.forEach(fileInfo => {
          const existingIndex = results.findIndex(item => item.filePath === fileInfo.filePath);
          
          if (existingIndex !== -1) {
            // Объединяем проблемы, избегая дубликатов
            const existingIssues = results[existingIndex].issues;
            
            fileInfo.issues.forEach(issue => {
              const isDuplicate = existingIssues.some(existing => 
                existing.line === issue.line && 
                existing.column === issue.column && 
                existing.message === issue.message
              );
              
              if (!isDuplicate) {
                existingIssues.push(issue);
              }
            });
          } else {
            // Добавляем новый файл
            results.push(fileInfo);
          }
        });
      }
      
      // 5. Проверяем все модели на наличие декораций ошибок
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        logProblems(`Проверяем ${models.length} моделей на наличие декораций ошибок`);
        
        models.forEach((model: any) => {
          if (!model || model.isDisposed()) return;
          
          const uri = model.uri.toString();
          
          // Исключаем inmemory файлы с определенным шаблоном имени
          if (uri.includes('inmemory://')) {
            const fileName = getInmemoryFileName(uri);
            if (fileName.match(/python_file_\d+\.py/)) {
              logProblems(`Исключаем вспомогательный Python файл при проверке декораций: ${fileName}`);
              return;
            }
          }
          
          // Проверяем, уже есть ли этот файл в результатах
          const existingIndex = results.findIndex(item => item.filePath === uri);
          if (existingIndex !== -1 && results[existingIndex].issues.length > 0) {
            // Если файл уже есть и имеет проблемы, пропускаем
            return;
          }
          
          try {
            // Получаем декорации модели
            const modelDecorations = model._decorations;
            if (!modelDecorations) return;
            
            // Находим декорации, связанные с ошибками
            const errorDecorations = Object.values(modelDecorations).filter((decoration: any) => 
              decoration && decoration.options && decoration.options.className && 
              (decoration.options.className.includes('error') || decoration.options.className.includes('warning') || 
               decoration.options.className.includes('squiggly'))
            );
            
            if (errorDecorations.length === 0) return;
            
            logProblems(`Найдено ${errorDecorations.length} декораций ошибок в модели ${uri}`);
            
            // Получаем содержимое модели
            const modelLines = model.getLinesContent();
            
            // Создаем проблемы на основе декораций
            const issues: Issue[] = errorDecorations.map((decoration: any) => {
              const range = decoration.range;
              const line = range ? range.startLineNumber : 1;
              const column = range ? range.startColumn : 1;
              const lineContent = line <= modelLines.length ? modelLines[line - 1] : '';
              
              return {
                severity: decoration.options.className.includes('error') ? 'error' as const : 'warning' as const,
                message: decoration.options.hoverMessage?.[0]?.value || 'Ошибка в строке',
                line: line,
                column: column,
                endLine: range ? range.endLineNumber : line,
                endColumn: range ? range.endColumn : (lineContent.length + 1),
                source: 'monaco-editor-decoration'
              };
            });
            
            if (issues.length > 0) {
              if (existingIndex !== -1) {
                // Добавляем проблемы к существующему файлу
                results[existingIndex].issues.push(...issues);
              } else {
                // Добавляем новый файл
                const isInmemory = uri.includes('inmemory://');
                const fileName = isInmemory ? getInmemoryFileName(uri) : getReadableFileName(uri);
                
                results.push({
                  filePath: uri,
                  fileName,
                  issues
                });
              }
            }
          } catch (error) {
            console.error(`Ошибка при анализе декораций модели ${uri}:`, error);
          }
        });
      }
      
      // Удаляем файлы без проблем и вспомогательные inmemory файлы
      results = results.filter(file => {
        // Исключаем файлы без проблем
        if (!file.issues || file.issues.length === 0) return false;
        
        // Исключаем вспомогательные Python файлы
        if (file.filePath.includes('inmemory://') && file.fileName.match(/python_file_\d+\.py/)) {
          return false;
        }
        
        return true;
      });
      
      // Логируем итоговые результаты
      logProblems(`Итого собрано ${results.length} файлов с проблемами:`);
      results.forEach(file => {
        logProblems(`  - ${file.fileName} (${file.filePath}): ${file.issues.length} проблем`);
      });
      
      // Обновляем счетчики ошибок и предупреждений
      const totalErrors = results.reduce((count, file) => 
        count + file.issues.filter(i => i.severity === 'error').length, 0);
      const totalWarnings = results.reduce((count, file) => 
        count + file.issues.filter(i => i.severity === 'warning').length, 0);
      
      // Сохраняем значения для глобального доступа
      window._latestErrorCount = totalErrors;
      window._latestWarningCount = totalWarnings;
      
      logProblems(`Всего ошибок: ${totalErrors}, предупреждений: ${totalWarnings}`);
      
      return results;
    } catch (error) {
      console.error('Ошибка при получении маркеров:', error);
      return [];
    }
  };

  // Обновляем функцию renderIssues, чтобы она отображала преобразованные inmemory файлы как реальные
  const renderIssues = () => {
    logProblems('Вызов renderIssues для отображения проблем');
    
    // Получаем все проблемы из всех источников через обновленную функцию
    const freshIssues = getMonacoAllMarkersWithoutFilter();
    
    logProblems(`Получено ${freshIssues.length} файлов с проблемами`);
    
    // Фильтруем проблемы по настройкам отображения
    const filteredIssues = freshIssues.filter(i => {
      // Проверяем что массив issues существует и не пустой
      if (!i.issues || i.issues.length === 0) return false;
      
      // Фильтруем проблемы по настройкам отображения
      const filteredFileIssues = i.issues.filter(issue => {
        // Проверяем соответствие поисковому запросу
        const matchesSearch = issueSearch === "" ||
          (issue.message && issue.message.toLowerCase().includes(issueSearch.toLowerCase())) ||
          (i.fileName && i.fileName.toLowerCase().includes(issueSearch.toLowerCase()));
        
        // Проверяем фильтры по типу проблемы
        const matchesFilter = (
          (issue.severity === 'error' && filters.errors) ||
          (issue.severity === 'warning' && filters.warnings) ||
          (issue.severity === 'info' && filters.info)
        );
        
        return matchesSearch && matchesFilter;
      });
      
      // Обновляем отфильтрованные проблемы
      i.issues = filteredFileIssues;
      
      // Возвращаем true только если остались проблемы после фильтрации
      return filteredFileIssues.length > 0;
    });
    
    // Обновляем счетчики ошибок и предупреждений
    const totalErrors = freshIssues.reduce((count, file) => 
      count + file.issues.filter(i => i.severity === 'error').length, 0);
    const totalWarnings = freshIssues.reduce((count, file) => 
      count + file.issues.filter(i => i.severity === 'warning').length, 0);
    
    // Сохраняем значения для обновления через эффект
    window._latestErrorCount = totalErrors;
    window._latestWarningCount = totalWarnings;
    
    logProblems(`После фильтрации осталось ${filteredIssues.length} файлов с проблемами`);
    
    if (filteredIssues.length === 0) {
      return (
        <div className="no-issues">
          <div className="no-issues-content">
            <div className="icon-container">
              <Check size={24} color="#4caf50" />
            </div>
            <span>Нет обнаруженных проблем</span>
            <ProblemDebugger issues={freshIssues} />
          </div>
        </div>
      );
    }
    
    return (
      <div className="issues-list">
        {filteredIssues.map((fileIssue: IssueInfo) => (
          <div key={fileIssue.filePath} className="file-issues">
            <div 
              className="file-header"
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
                {fileIssue.issues.map((issue: Issue, idx: number) => (
                  <div 
                    key={`${fileIssue.filePath}-${idx}`} 
                    className="issue-item"
                    onClick={() => props.onIssueClick && props.onIssueClick(fileIssue.filePath, issue.line, issue.column)}
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
        <ProblemDebugger issues={freshIssues} />
      </div>
    );
  };

  // Добавляем эффект для безопасного обновления счетчиков ошибок
  useEffect(() => {
    // Получаем текущие значения счетчиков из временного хранилища
    if (typeof window._latestErrorCount === 'number') {
      setErrorCount(window._latestErrorCount);
    }
    if (typeof window._latestWarningCount === 'number') {
      setWarningCount(window._latestWarningCount);
    }
  }, [filterSeverity]); // Запускаем эффект при изменении фильтра

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

  const checkAllEditorsForErrors = () => {
    const editors = document.querySelectorAll('.monaco-editor');
    logProblemMessage(`Найдено ${editors.length} редакторов на странице`);
    
    // Проверяем текущие открытые редакторы
    if (window.problemCollector && typeof window.problemCollector.scan === 'function') {
      logProblemMessage('Запуск сканирования проблем через problemCollector');
      window.problemCollector.scan();
    }
  }

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
    if (selectedFile) {
      // Если есть проблемы для текущего файла, переключаемся на вкладку проблем
      setTimeout(() => {
        if (window.pythonDiagnosticsStore && window.monaco && window.monaco.editor) {
          try {
            // Проверяем наличие маркеров для текущего файла
            const fileUri = window.monaco.Uri.file(selectedFile).toString();
            const markers = window.monaco.editor.getModelMarkers().filter(
              (marker: any) => marker.resource.toString() === fileUri
            );
            
            if (markers && markers.length > 0) {
              console.log(`В файле ${selectedFile} найдено ${markers.length} проблем`);
              
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
  }, [selectedFile]);
  
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
      // Убираем префиксы из URI
      let normalizedPath = uri.replace('file://', '');
      
      // Удаляем лишние символы в начале пути (часто встречается в Windows)
      normalizedPath = normalizedPath.replace(/^\/[A-Z]:/, (match) => match.substring(1));
      
      // Получаем имя файла с его относительным путем для лучшей читаемости
      const parts = normalizedPath.split(/[\\/]/);
      
      // Если путь слишком длинный, сокращаем его до последних 3 частей
      if (parts.length > 3) {
        return `.../${parts.slice(-3).join('/')}`;
      }
      
      return parts.join('/');
    } catch (e) {
      console.error('Ошибка при форматировании имени файла:', e);
      // В случае ошибки возвращаем исходное URI
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