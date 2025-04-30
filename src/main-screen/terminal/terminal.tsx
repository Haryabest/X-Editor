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

// Обновляем объявление глобальных интерфейсов
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
      
      // Если есть specific filePath, обновляем только его
      if (filePath) {
        console.log(`Обновление маркеров для конкретного файла: ${filePath}`);
      }
      
      // Принудительно получаем новую диагностику
      try {
        if (typeof window !== "undefined" && (window as any).getPythonDiagnostics) {
          const freshDiagnostics = (window as any).getPythonDiagnostics();
          console.log('Получена свежая диагностика:', freshDiagnostics);
          
          // Принудительное обновление компонента
          setFilterSeverity(current => current === 'all' ? 'error' : 'all');
        }
      } catch (e) {
        console.error('Ошибка при обновлении диагностики:', e);
      }
    };

    const handleDiagnosticsUpdated = (event: Event) => {
      console.log('Получено событие diagnostics-updated');
      
      // Получаем данные события, если они есть
      const customEvent = event as CustomEvent<{uri: string, markers: any[]}>;
      const { uri, markers } = customEvent.detail;
      
      console.log(`Обновление диагностики для файла: ${uri}, маркеров: ${markers.length}`);
      
      // Переключаем вкладку на проблемы если есть маркеры
      if (markers && markers.length > 0 && activeTab !== "issues") {
        console.log("Есть проблемы, переключаем на вкладку проблем");
        setActiveTab("issues");
      }
      
      // Обновляем компонент для отображения новых проблем
      setTimeout(() => {
        // Принудительное обновление компонента
        setFilterSeverity(current => current === 'all' ? 'error' : 'all');
      }, 100);
    };
    
    document.addEventListener('markers-updated', handleMarkersUpdated);
    document.addEventListener('diagnostics-updated', handleDiagnosticsUpdated);
    
    return () => {
      document.removeEventListener('markers-updated', handleMarkersUpdated);
      document.removeEventListener('diagnostics-updated', handleDiagnosticsUpdated);
    };
  }, [activeTab]);

  // Модифицируем функцию getAllPythonDiagnostics в window для очистки устаревших проблем
  useEffect(() => {
    // Сохраняем оригинальную функцию
    const originalGetPythonDiagnostics = (window as any).getPythonDiagnostics;
    
    if (originalGetPythonDiagnostics) {
      // Переопределяем функцию для фильтрации проблем
      (window as any).getPythonDiagnostics = () => {
        // Получаем все диагностики из оригинальной функции
        const allDiagnostics = originalGetPythonDiagnostics();
        
        if (!Array.isArray(allDiagnostics) || allDiagnostics.length === 0) {
          return [];
        }
        
        console.log(`Получено ${allDiagnostics.length} файлов с диагностикой`);
        
        // Проверяем, существуют ли еще файлы с проблемами
        const filteredDiagnostics = allDiagnostics.filter((diag: IssueInfo) => {
          if (!diag || !diag.filePath) return false;
          
          // Проверяем, существует ли модель для этого URI
          if (window.monaco && window.monaco.editor) {
            const models = window.monaco.editor.getModels();
            
            // Проверяем, совпадает ли путь с какой-либо моделью
            const modelExists = models.some((model: any) => {
              if (!model || !model.uri) return false;
              
              const modelUri = model.uri.toString();
              const normalizedModelUri = modelUri.replace(/\\/g, '/');
              const normalizedDiagPath = diag.filePath.replace(/\\/g, '/');
              
              return normalizedModelUri === normalizedDiagPath || 
                    normalizedModelUri.endsWith(normalizedDiagPath) || 
                    normalizedDiagPath.endsWith(normalizedModelUri);
            });
            
            if (modelExists) {
              console.log(`Найдена активная модель для файла: ${diag.fileName}`);
              return true;
            }
          }
          
          // Если нет активных моделей, но есть проблемы - сохраняем их
          if (diag.issues && diag.issues.length > 0) {
            console.log(`Сохраняем проблемы для файла ${diag.fileName} без активной модели`);
            return true;
          }
          
          return false;
        });
        
        console.log(`Отфильтровано ${filteredDiagnostics.length} из ${allDiagnostics.length} файлов с проблемами`);
        return filteredDiagnostics;
      };
    }
    
    return () => {
      // Восстанавливаем оригинальную функцию при размонтировании
      if (originalGetPythonDiagnostics) {
        (window as any).getPythonDiagnostics = originalGetPythonDiagnostics;
      }
    };
  }, []);

  // Улучшаем обработчик событий обновления маркеров
  useEffect(() => {
    const handleMonacoMarkersChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{filePath: string, markers: any[], owner: string}>;
      const { filePath, markers, owner } = customEvent.detail;
      
      console.log(`Получено событие monaco-markers-changed для ${filePath}, маркеров: ${markers?.length || 0}`);
      
      // Форсируем обновление проблем после изменения маркеров
      setTimeout(() => {
        if (typeof window !== "undefined" && (window as any).getPythonDiagnostics) {
          try {
            const diagData = (window as any).getPythonDiagnostics();
            console.log('Обновление проблем после изменения маркеров:', diagData?.length || 0);
            
            // Обновляем состояние для ререндера компонента
            setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
          } catch (e) {
            console.error('Ошибка при обновлении проблем:', e);
          }
        }
      }, 100);
    };
    
    // Подписываемся на событие изменения маркеров Monaco
    document.addEventListener('monaco-markers-changed', handleMonacoMarkersChanged);
    
    return () => {
      document.removeEventListener('monaco-markers-changed', handleMonacoMarkersChanged);
    };
  }, []);

  // Прослушивание события смены модели в Monaco
  useEffect(() => {
    // Обработчик события смены модели
    const handleModelChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{filePath: string}>;
      const filePath = customEvent.detail.filePath;
      
      // Сохраняем путь к последнему активному файлу
      window.lastActiveFilePath = filePath;
      
      // Отправляем событие изменения активного файла
      const fileChangedEvent = new CustomEvent('active-file-changed', {
        detail: { filePath }
      });
      document.dispatchEvent(fileChangedEvent);
    };
    
    // Подписка на событие смены модели
    document.addEventListener('monaco-model-changed', handleModelChanged);
    
    return () => {
      document.removeEventListener('monaco-model-changed', handleModelChanged);
    };
  }, []);

  // Функция для проверки всех открытых редакторов на наличие ошибок
  useEffect(() => {
    const checkAllEditorsForErrors = () => {
      if (!window.monaco || !window.monaco.editor) return;
      
      console.log('Проверка всех редакторов на наличие ошибок...');
      
      try {
        // Получаем все модели
        const models = window.monaco.editor.getModels();
        console.log(`Найдено ${models.length} моделей редактора`);
        
        // Для каждой модели получаем маркеры
        let totalErrors = 0;
        
        models.forEach((model: any) => {
          if (!model || model.isDisposed()) return;
          
          const uri = model.uri.toString();
          const allMarkers = window.monaco.editor.getModelMarkers({ resource: model.uri });
          
          if (allMarkers && allMarkers.length > 0) {
            console.log(`Модель ${uri} имеет ${allMarkers.length} маркеров`);
            totalErrors += allMarkers.length;
          }
        });
        
        console.log(`Всего найдено ${totalErrors} ошибок/предупреждений в редакторе`);
        
        if (totalErrors > 0) {
          // Обновляем отображение вкладки проблем
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
        }
      } catch (error) {
        console.error('Ошибка при проверке редакторов:', error);
      }
    };
    
    // Запускаем проверку при первой загрузке и периодически
    const intervalId = setInterval(checkAllEditorsForErrors, 5000);
    
    // Также запускаем при переключении на вкладку проблем
    const handleDocumentClick = () => {
      if (activeTab === 'issues') {
        checkAllEditorsForErrors();
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    
    // Очистка при размонтировании
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [activeTab]);

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

  // Измененяю useEffect для отображения проблем сразу при запуске
  useEffect(() => {
    // Объявляем функцию для тестовой инициализации проблем
    function initializeProblemsFromMonaco() {
      logProblems('Инициализация проблем из Monaco');
      
      if (!window.monaco || !window.monaco.editor) {
        logProblems('Monaco не доступен, пропускаем инициализацию проблем');
        return;
      }
      
      try {
        // Получаем все модели
        const models = window.monaco.editor.getModels();
        logProblems(`Найдено ${models.length} моделей Monaco`);
        
        // Проверяем есть ли маркеры для моделей
        let anyIssues = false;
        
        models.forEach((model: any) => {
          if (model && model.uri) {
            const uri = model.uri.toString();
            const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
            
            if (markers && markers.length > 0) {
              anyIssues = true;
              logProblems(`Найдено ${markers.length} маркеров для ${uri}`, markers);
              
              // Автоматически разворачиваем файлы с ошибками
              setExpandedFiles(prev => {
                const newSet = new Set(prev);
                newSet.add(uri);
                return newSet;
              });
            }
          }
        });
        
        // Если найдены проблемы, переключаемся на вкладку проблем
        if (anyIssues && activeTab !== 'issues') {
          logProblems('Переключаемся на вкладку проблем, так как найдены маркеры');
          setActiveTab('issues');
        }
      } catch (error) {
        console.error('Ошибка при инициализации проблем из Monaco:', error);
      }
    }
    
    // Запускаем инициализацию проблем
    setTimeout(initializeProblemsFromMonaco, 1000);
    
    // Запускаем функцию повторно через 5 секунд для надежности
    setTimeout(initializeProblemsFromMonaco, 5000);
    
    // Интервал для регулярной проверки проблем
    const intervalId = setInterval(initializeProblemsFromMonaco, 10000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Функция для отображения проблем с улучшенным кешированием 
  const renderIssues = () => {
    logProblems('Вызов renderIssues для отображения проблем');
    
    // Принудительно получаем все проблемы из Monaco прямо перед отрисовкой
    let freshIssues: IssueInfo[] = [];
    
    try {
      // Проверяем, есть ли проблемы в pythonDiagnosticsStore
      if (window.pythonDiagnosticsStore) {
        logProblems('Проверяем проблемы в pythonDiagnosticsStore напрямую');
        
        Object.entries(window.pythonDiagnosticsStore).forEach(([uri, markers]) => {
          if (Array.isArray(markers) && markers.length > 0) {
            logProblems(`Найдено ${markers.length} маркеров в pythonDiagnosticsStore для ${uri}`);
            
            const fileName = uri.split(/[\\/]/).pop() || uri;
            
            freshIssues.push({
              filePath: uri,
              fileName,
              issues: markers.map((marker: any) => ({
                severity: marker.severity === 1 ? 'error' : 
                         marker.severity === 2 ? 'warning' : 'info',
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || 0,
                column: marker.startColumn || 0,
                endLine: marker.endLineNumber || 0,
                endColumn: marker.endColumn || 0,
                source: 'python'
              }))
            });
          }
        });
        
        logProblems(`Найдено ${freshIssues.length} файлов с проблемами в pythonDiagnosticsStore`);
      }
      
      // Если не нашли проблемы в pythonDiagnosticsStore, проверяем lastKnownMarkers
      if (freshIssues.length === 0 && window.lastKnownMarkers && Object.keys(window.lastKnownMarkers).length > 0) {
        logProblems('Получаем проблемы из lastKnownMarkers');
        
        Object.entries(window.lastKnownMarkers).forEach(([uri, markers]) => {
          if (markers && markers.length > 0) {
            const fileName = uri.split(/[\\/]/).pop() || uri;
            
            freshIssues.push({
              filePath: uri,
              fileName,
              issues: markers.map((marker: any) => ({
                severity: marker.severity === 1 ? 'error' : 
                         marker.severity === 2 ? 'warning' : 'info',
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
        
        logProblems(`Найдено ${freshIssues.length} файлов с проблемами в lastKnownMarkers`);
      }
      
      // Если не нашли проблемы в кешах, пробуем получить напрямую из Monaco
      if (freshIssues.length === 0 && window.monaco && window.monaco.editor) {
        logProblems('Получаем проблемы напрямую из Monaco');
        
        // Проверяем все маркеры, включая inmemory модели
        const allMarkers = window.monaco.editor.getModelMarkers();
        logProblems(`Получено ${allMarkers.length} маркеров напрямую из Monaco`, allMarkers);
        
        // Специальная обработка для inmemory моделей
        const inMemoryMarkers = allMarkers.filter((m: any) => m.resource.toString().includes('inmemory'));
        if (inMemoryMarkers.length > 0) {
          logProblems(`Найдено ${inMemoryMarkers.length} маркеров для inmemory моделей`);
          
          // Группируем маркеры по URI
          const markersMap = new Map<string, any[]>();
          inMemoryMarkers.forEach((marker: any) => {
            const uri = marker.resource.toString();
            if (!markersMap.has(uri)) {
              markersMap.set(uri, []);
            }
            markersMap.get(uri)?.push(marker);
            
            // Сохраняем маркеры в lastKnownMarkers для будущего использования
            if (!window.lastKnownMarkers) {
              window.lastKnownMarkers = {};
            }
            if (!window.lastKnownMarkers[uri]) {
              window.lastKnownMarkers[uri] = [];
            }
            window.lastKnownMarkers[uri].push(marker);
          });
          
          // Добавляем inmemory маркеры в результаты
          markersMap.forEach((markers, uri) => {
            const fileName = uri.split(/[\\/]/).pop() || uri;
            freshIssues.push({
              filePath: uri,
              fileName,
              issues: markers.map((marker: any) => ({
                severity: marker.severity === 1 ? 'error' : 
                         marker.severity === 2 ? 'warning' : 'info',
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || 0,
                column: marker.startColumn || 0,
                endLine: marker.endLineNumber || 0,
                endColumn: marker.endColumn || 0,
                source: 'monaco-editor'
              }))
            });
          });
        }
        
        // Обработка обычных файловых моделей
        const models = window.monaco.editor.getModels();
        models.forEach((model: any) => {
          if (!model || !model.uri) return;
          
          const uri = model.uri.toString();
          
          // Пропускаем inmemory модели, так как они уже обработаны выше
          if (uri.includes('inmemory')) return;
          
          const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
          if (markers && markers.length > 0) {
            logProblems(`Найдено ${markers.length} маркеров для ${uri}`);
            
            const fileName = uri.split(/[\\/]/).pop() || uri;
            freshIssues.push({
              filePath: uri,
              fileName,
              issues: markers.map((marker: any) => ({
                severity: marker.severity === 1 ? 'error' : 
                         marker.severity === 2 ? 'warning' : 'info',
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || 0,
                column: marker.startColumn || 0,
                endLine: marker.endLineNumber || 0,
                endColumn: marker.endColumn || 0,
                source: marker.source || 'monaco-editor'
              }))
            });
            
            // Сохраняем маркеры в lastKnownMarkers
            if (!window.lastKnownMarkers) {
              window.lastKnownMarkers = {};
            }
            window.lastKnownMarkers[uri] = markers;
          }
        });
      }
      
      // Пробуем получить диагностики через getPythonDiagnostics
      if (freshIssues.length === 0 && window.getPythonDiagnostics) {
        logProblems('Получаем диагностики через getPythonDiagnostics');
        
        try {
          const pythonDiagnostics = window.getPythonDiagnostics();
          if (Array.isArray(pythonDiagnostics) && pythonDiagnostics.length > 0) {
            logProblems(`Получено ${pythonDiagnostics.length} файлов с диагностикой из getPythonDiagnostics`);
            
            // Добавляем Python диагностики в результаты
            freshIssues = [...freshIssues, ...pythonDiagnostics];
          }
        } catch (error) {
          logProblems('Ошибка при получении Python диагностик:', error);
        }
      }
      
      // Если проблемы всё ещё не найдены, используем проблемы из пропсов
      if (freshIssues.length === 0 && props.issues && props.issues.length > 0) {
        logProblems('Используем проблемы из пропсов', props.issues);
        freshIssues = props.issues;
      }
      
      // Логируем итоговое количество найденных проблем
      const totalIssueCount = freshIssues.reduce((total, file) => total + file.issues.length, 0);
      logProblems(`Итоговое количество проблем: ${totalIssueCount} в ${freshIssues.length} файлах`);
      
      // Если нашли проблемы, принудительно обновляем глобальное состояние
      if (freshIssues.length > 0 && window.forceDiagnosticsRefresh) {
        logProblems('Принудительное обновление диагностики через глобальную функцию');
        window.forceDiagnosticsRefresh();
      }
    } catch (error) {
      console.error('Ошибка при получении маркеров:', error);
    }
    
    // Фильтруем проблемы по настройкам отображения
    const filteredIssues = freshIssues.length > 0 ? 
      freshIssues.filter(i => {
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
        
        // Возвращаем true только если остались проблемы после фильтрации
        return filteredFileIssues.length > 0;
      }) : 
      getFilteredIssues();
    
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
          // Обновляем состояние для ререндера компонента
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
          
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
      
      // Запускаем обновление через небольшую задержку
      setTimeout(() => {
        if (typeof window !== "undefined" && window.pythonDiagnosticsStore) {
          // Считаем общее количество проблем
          let totalProblems = 0;
          
          Object.values(window.pythonDiagnosticsStore).forEach((markers: any) => {
            if (Array.isArray(markers)) {
              totalProblems += markers.length;
            }
          });
          
          console.log(`Общее количество обновленных проблем: ${totalProblems}`);
          
          // Перерисовываем компонент
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
        }
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

  // Добавляем обработчик события refresh-problems-panel
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
          
          // Проверяем, есть ли ошибки
          const hasErrors = allMarkers.some((m: any) => m.severity === 1);
          
          // Если есть ошибки и активна не вкладка проблем, переключаемся на нее
          if (hasErrors && activeTab !== 'issues') {
            logProblemMessage('Обнаружены ошибки, переключаемся на вкладку проблем');
            setActiveTab('issues');
          }
          
          // Обновляем интерфейс
          setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
          
          return hasErrors;
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
      
      // Запускаем повторный сбор маркеров с задержкой для надежности
      setTimeout(() => {
        collectAllMarkers();
      }, 300);
    };
    
    document.addEventListener('refresh-problems-panel', handleRefreshProblemsPanel);
    
    return () => {
      document.removeEventListener('refresh-problems-panel', handleRefreshProblemsPanel);
    };
  }, [activeTab]);

  // Добавляем функцию handleTabClick
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
      
      // Небольшая задержка для уверенности в получении актуальных данных
      setTimeout(() => {
        // Заставляем компонент перерисоваться после получения данных
        setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
        
        // Отправляем событие обновления проблем для компонентов, подписанных на него
        document.dispatchEvent(new CustomEvent('force-update-problems'));
        
        // Автоматически разворачиваем файлы с ошибками
        if (window.lastKnownMarkers) {
          Object.entries(window.lastKnownMarkers).forEach(([uri, markers]) => {
            if (Array.isArray(markers) && markers.length > 0 && markers.some((m: any) => m.severity === 1)) {
              if (!expandedFiles.has(uri)) {
                setExpandedFiles(prev => {
                  const newSet = new Set(prev);
                  newSet.add(uri);
                  return newSet;
                });
              }
            }
          });
        }
      }, 300);
    }
  };

  return (
    <div className="terminal-container" style={{ height: terminalHeight || 200 }}>
      <div className="terminal-resizer" onMouseDown={handleVerticalDrag}>
        <GripHorizontal size={16} />
      </div>

      <div className="tab-header">
          <button
          className={`tab ${activeTab === "terminal" ? "active" : ""}`}
          onClick={() => handleTabClick('terminal')}
          >
            Терминал
          </button>
          <button
          className={`tab ${activeTab === "issues" ? "active" : ""}`}
          onClick={() => handleTabClick('issues')}
        >
          Проблемы
        </button>
        {activeTab === "issues" && (
          <button 
            className="refresh-button" 
            title="Обновить проблемы"
            onClick={() => {
              logProblemMessage('Нажата кнопка обновления проблем');
              if (window.forceDiagnosticsRefresh) {
                window.forceDiagnosticsRefresh();
                // Заставляем компонент перерисоваться
                  setFilterSeverity(prev => prev === 'all' ? 'error' : 'all');
              }
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              marginLeft: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <RefreshCw size={14} color="#888" />
          </button>
        )}
        
        <div className="tab-controls">
          {activeTab === "issues" ? (
            <>
              <button
                className={`filter-toggle ${showIssueFilters ? "active" : ""}`}
                onClick={() => setShowIssueFilters(!showIssueFilters)}
                title="Показать/скрыть фильтры"
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

      <div className="tab-content" style={{ 
        display: 'flex', 
        flexDirection: 'column',
        flex: '1 1 auto',
        height: 'calc(100% - 38px)', // Updated to match new tab height
        overflow: 'hidden'
      }}>
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