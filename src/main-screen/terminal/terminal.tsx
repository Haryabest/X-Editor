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

  // Получаем истинное имя файла для inmemory модели
  const getActualFileFromInmemory = (inmemoryUri: string): string | null => {
    try {
      // Извлекаем текущее содержимое модели
      if (!window.monaco || !window.monaco.editor) return null;
      
      const models = window.monaco.editor.getModels();
      const model = models.find((m: any) => m.uri.toString() === inmemoryUri);
      if (!model) return null;
      
      // Получаем путь активного файла
      const activeFile = window.lastActiveFilePath || props.selectedFile;
      if (!activeFile) return null;
      
      // Если имеется информация о реальном файле в pythonDiagnosticsStore, используем ее
      if (window.pythonDiagnosticsStore && window.pythonDiagnosticsStore._fileMapping) {
        const mapping = window.pythonDiagnosticsStore._fileMapping[inmemoryUri];
        if (mapping) return mapping;
      }
      
      // Если модель больше не связана с activeFile, пробуем найти реальный файл, с которым она связана
      // Проверяем совпадение содержимого с открытыми файлами
      const openFileModels = models.filter((m: any) => !m.uri.toString().includes('inmemory://'));
      for (const fileModel of openFileModels) {
        if (fileModel.getValue().trim() === model.getValue().trim()) {
          return fileModel.uri.toString();
        }
      }
      
      // В противном случае используем активный файл
      return activeFile;
    } catch (error) {
      console.error('Ошибка при получении реального файла:', error);
      return null;
    }
  };

  // Полностью переработанная функция получения всех маркеров без фильтрации
  const getMonacoAllMarkersWithoutFilter = (): IssueInfo[] => {
    let results: IssueInfo[] = [];
    
    try {
      logProblems('Запущен сбор ошибок из всех источников...');
      
      // Глобальный маппинг inmemory файлов к реальным файлам
      const inmemoryToRealMapping = new Map<string, string>();
      
      // 1. Сбор всех моделей Monaco для дальнейшего анализа
      const allModels: any[] = [];
      if (window.monaco && window.monaco.editor) {
        const models = window.monaco.editor.getModels();
        logProblems(`Найдено ${models.length} моделей в Monaco Editor`);
        allModels.push(...models);
        
        // Строим маппинг inmemory к реальным файлам
        models.forEach(model => {
          if (model && !model.isDisposed() && model.uri.toString().includes('inmemory://')) {
            const realFile = getActualFileFromInmemory(model.uri.toString());
            if (realFile) {
              inmemoryToRealMapping.set(model.uri.toString(), realFile);
              logProblems(`Сопоставление: ${model.uri.toString()} -> ${realFile}`);
            }
          }
        });
      }
      
      // 2. Сначала собираем все маркеры напрямую из Monaco Editor
      if (window.monaco && window.monaco.editor) {
        // Получаем ВСЕ маркеры без фильтрации
        const allMarkers = window.monaco.editor.getModelMarkers({});
        logProblems(`Получено ${allMarkers.length} маркеров из Monaco Editor напрямую`);
        
        // Логируем уровни серьезности маркеров для диагностики
        const severityCounts = { error: 0, warning: 0, info: 0, other: 0 };
        allMarkers.forEach((marker: any) => {
          if (marker.severity === 1) severityCounts.error++;
          else if (marker.severity === 2) severityCounts.warning++;
          else if (marker.severity === 4) severityCounts.info++;
          else severityCounts.other++;
        });
        logProblems(`Диагностика маркеров: error=${severityCounts.error}, warning=${severityCounts.warning}, info=${severityCounts.info}, other=${severityCounts.other}`);
        
        // Группируем маркеры по URI с учетом маппинга inmemory -> real
        const markersByUri = new Map<string, any[]>();
        allMarkers.forEach((marker: any) => {
          if (!marker || !marker.resource) return;
          
          const originalUri = marker.resource.toString();
          let targetUri = originalUri;
          
          // Преобразуем inmemory URI в real URI если возможно
          if (originalUri.includes('inmemory://')) {
            if (inmemoryToRealMapping.has(originalUri)) {
              targetUri = inmemoryToRealMapping.get(originalUri) || originalUri;
              logProblems(`Используем маппинг для маркера: ${originalUri} -> ${targetUri}`);
            } else {
              // Пробуем определить реальный файл для inmemory модели
              const realFile = getActualFileFromInmemory(originalUri);
              if (realFile) {
                targetUri = realFile;
                inmemoryToRealMapping.set(originalUri, realFile);
                logProblems(`Определен реальный файл для ${originalUri} -> ${realFile}`);
              }
            }
          }
          
          // Добавляем в соответствующую группу
          if (!markersByUri.has(targetUri)) {
            markersByUri.set(targetUri, []);
          }
          
          markersByUri.get(targetUri)?.push(marker);
        });
        
        // Преобразуем маркеры в формат IssueInfo
        markersByUri.forEach((markers, uri) => {
          // Определяем имя файла
          const fileName = getReadableFileName(uri);
          
          // Преобразуем маркеры, ГАРАНТИРУЯ правильное определение уровня серьезности
          const issues: Issue[] = markers.map((marker: any): Issue => {
            // Явное логирование оригинального маркера с уровнем серьезности
            console.log('Обработка маркера:', { 
              uri, 
              message: marker.message, 
              severity: marker.severity,
              line: marker.startLineNumber
            });
            
            let severity: 'error' | 'warning' | 'info' = 'info';
            
            // Преобразуем severity из числового формата
            if (marker.severity === 1 || marker.severity === 8) {
              severity = 'error';
            } else if (marker.severity === 2 || marker.severity === 4) {
              severity = 'warning';
            } else {
              // Если severity не определен, анализируем сообщение
              const message = marker.message?.toLowerCase() || '';
              if (message.includes('error') || 
                  message.includes('ошибка') || 
                  message.includes('exception') || 
                  message.includes('fail') ||
                  message.includes('invalid') ||
                  message.includes('синтаксическая') ||
                  message.includes('непарные кавычки')) {
                severity = 'error';
              } else if (message.includes('warning') || 
                         message.includes('предупреждение') || 
                         message.includes('warn')) {
                severity = 'warning';
              } else {
                severity = 'info';
              }
            }
            
            // Также анализируем сообщение для Python ошибок
            const message = marker.message?.toLowerCase() || '';
            if (message.includes('syntaxerror') || 
                message.includes('nameerror') || 
                message.includes('typeerror') || 
                message.includes('importerror') ||
                message.includes('indentationerror') ||
                message.includes('attributeerror') ||
                message.includes('отсутствует двоеточие') ||
                message.includes('непарные кавычки')) {
              severity = 'error';
            }
            
            return {
              severity,
              message: marker.message || 'Неизвестная ошибка',
              line: marker.startLineNumber || 0,
              column: marker.startColumn || 0,
              endLine: marker.endLineNumber || 0,
              endColumn: marker.endColumn || 0,
              source: marker.source || 'monaco-editor'
            };
          });
          
          // Логируем количество ошибок и предупреждений
          const errCount = issues.filter(i => i.severity === 'error').length;
          const warnCount = issues.filter(i => i.severity === 'warning').length;
          logProblems(`Файл ${fileName}: найдено ${errCount} ошибок и ${warnCount} предупреждений`);
          
          results.push({
            filePath: uri,
            fileName,
            issues
          });
        });
      }
      
      // 3. Проверяем Python Diagnostics Store на наличие маркеров
      if (window.pythonDiagnosticsStore) {
        logProblems('Проверяем pythonDiagnosticsStore на наличие дополнительных маркеров');
        
        Object.entries(window.pythonDiagnosticsStore).forEach(([uri, markers]) => {
          if (!Array.isArray(markers) || markers.length === 0 || uri === '_fileMapping') return;
          
          // Преобразуем inmemory URI в real URI если возможно
          let targetUri = uri;
          if (uri.includes('inmemory://')) {
            if (inmemoryToRealMapping.has(uri)) {
              targetUri = inmemoryToRealMapping.get(uri) || uri;
              logProblems(`Используем маппинг для Python диагностики: ${uri} -> ${targetUri}`);
            } else {
              // Пробуем определить реальный файл для inmemory модели
              const realFile = getActualFileFromInmemory(uri);
              if (realFile) {
                targetUri = realFile;
                inmemoryToRealMapping.set(uri, realFile);
                logProblems(`Определен реальный файл для Python диагностики ${uri} -> ${realFile}`);
              }
            }
          }
          
          // Проверяем, если файл уже есть в результатах
          const existingIndex = results.findIndex(item => item.filePath === targetUri);
          
          if (existingIndex !== -1) {
            // Объединяем маркеры, избегая дубликатов
            const existingMarkers = results[existingIndex].issues;
            
            markers.forEach((marker: any) => {
              if (!marker) return;
              
              // Определяем severity, преобразуя числовые коды
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
                    message.includes('непарные кавычки') ||
                    message.includes('синтаксическая')) {
                  severity = 'error';
                } else if (message.includes('warning') || 
                          message.includes('предупреждение')) {
                  severity = 'warning';
                }
              }
              
              const newIssue: Issue = {
                severity,
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || marker.line || 0,
                column: marker.startColumn || marker.column || 0,
                endLine: marker.endLineNumber || marker.endLine || 0,
                endColumn: marker.endColumn || marker.endColumn || 0,
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
            const fileName = getReadableFileName(targetUri);
            
            const issues = markers.map((marker: any): Issue => {
              // Определяем severity, преобразуя числовые коды
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
                    message.includes('непарные кавычки') ||
                    message.includes('синтаксическая')) {
                  severity = 'error';
                } else if (message.includes('warning') || 
                          message.includes('предупреждение')) {
                  severity = 'warning';
                }
              }
              
              return {
                severity,
                message: marker.message || 'Неизвестная ошибка',
                line: marker.startLineNumber || marker.line || 0,
                column: marker.startColumn || marker.column || 0,
                endLine: marker.endLineNumber || marker.endLine || 0,
                endColumn: marker.endColumn || marker.endColumn || 0,
                source: marker.source || 'python'
              };
            });
            
            results.push({
              filePath: targetUri,
              fileName,
              issues
            });
          }
        });
      }
      
      // Удаляем файлы без проблем
      results = results.filter(file => {
        // Исключаем файлы без проблем
        if (!file.issues || file.issues.length === 0) return false;
        
        return true;
      });
      
      // Логируем итоговые результаты с детализацией по ошибкам/предупреждениям
      logProblems(`Итого собрано ${results.length} файлов с проблемами:`);
      results.forEach(file => {
        const errCount = file.issues.filter(i => i.severity === 'error').length;
        const warnCount = file.issues.filter(i => i.severity === 'warning').length;
        logProblems(`  - ${file.fileName} (${file.filePath}): ${errCount} ошибок, ${warnCount} предупреждений`);
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
    
    // Обновляем все проблемы
    // ИСПРАВЛЕНИЕ: принудительно обновляем видимые маркеры
    if (window.monaco && window.monaco.editor) {
      try {
        const models = window.monaco.editor.getModels();
        for (const model of models) {
          if (model && !model.isDisposed()) {
            // Принудительно запрашиваем маркеры для каждой модели
            const markers = window.monaco.editor.getModelMarkers({ resource: model.uri });
            logProblems(`Модель ${model.uri.toString()}: ${markers.length} маркеров`);
            
            // Проверяем, есть ли среди маркеров ошибки и добавляем их в freshIssues
            if (markers.length > 0) {
              const uri = model.uri.toString();
              const isInmemory = uri.includes('inmemory://');
              
              // Пропускаем вспомогательные файлы
              if (isInmemory && getInmemoryFileName(uri).match(/python_file_\d+\.py/)) {
                continue;
              }
              
              // Определяем имя файла
              const fileName = isInmemory ? getInmemoryFileName(uri) : getReadableFileName(uri);
              
              // Проверяем, есть ли файл в списке
              const existingFileIndex = freshIssues.findIndex(item => item.filePath === uri);
              
              if (existingFileIndex === -1) {
                // Если файла нет в списке, добавляем его
                const newIssues = markers.map((marker: any): Issue => ({
                  severity: marker.severity === 1 ? 'error' as const : 
                           marker.severity === 2 ? 'warning' as const : 'info' as const,
                  message: marker.message || 'Неизвестная ошибка',
                  line: marker.startLineNumber || 0,
                  column: marker.startColumn || 0,
                  endLine: marker.endLineNumber || 0,
                  endColumn: marker.endColumn || 0,
                  source: marker.source || 'monaco-editor'
                }));
                
                // Добавляем только если есть проблемы
                if (newIssues.length > 0) {
                  freshIssues.push({
                    filePath: uri,
                    fileName,
                    issues: newIssues
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Ошибка при обновлении моделей:', error);
      }
    }
    
    // ИСПРАВЛЕНИЕ: добавляем проверку Python ошибок в текущем файле
    if (props.selectedFile) {
      try {
        // Принудительно запрашиваем диагностику Python, если доступно
        if (window.forcePythonCheck && props.selectedFile.endsWith('.py')) {
          logProblems(`Принудительная проверка Python для файла: ${props.selectedFile}`);
          window.forcePythonCheck(props.selectedFile);
        }
      } catch (error) {
        console.error('Ошибка при запросе Python диагностики:', error);
      }
    }
    
    // Фильтруем проблемы по настройкам отображения
    const filteredIssues = freshIssues.filter(i => {
      // Проверяем что массив issues существует и не пустой
      if (!i.issues || i.issues.length === 0) return false;
      
      // ИСПРАВЛЕНИЕ: Приоритезируем ошибки, чтобы они всегда отображались
      const hasErrors = i.issues.some(issue => issue.severity === 'error');
      
      // Фильтруем проблемы по настройкам отображения
      const filteredFileIssues = i.issues.filter(issue => {
        // Проверяем соответствие поисковому запросу
        const matchesSearch = issueSearch === "" ||
          (issue.message && issue.message.toLowerCase().includes(issueSearch.toLowerCase())) ||
          (i.fileName && i.fileName.toLowerCase().includes(issueSearch.toLowerCase()));
        
        // Проверяем фильтры по типу проблемы
        // ИСПРАВЛЕНИЕ: Всегда показываем ошибки независимо от фильтров
        const matchesFilter = (
          (issue.severity === 'error') || // Ошибки показываем всегда
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
    
    logProblems(`После фильтрации осталось ${filteredIssues.length} файлов с проблемами, общее количество ошибок: ${totalErrors}, предупреждений: ${totalWarnings}`);
    
    // ИСПРАВЛЕНИЕ: сортируем файлы, чтобы сначала показывались файлы с ошибками
    filteredIssues.sort((a, b) => {
      const aHasErrors = a.issues.some(i => i.severity === 'error');
      const bHasErrors = b.issues.some(i => i.severity === 'error');
      
      if (aHasErrors && !bHasErrors) return -1;
      if (!aHasErrors && bHasErrors) return 1;
      return 0;
    });
    
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
                {/* ИСПРАВЛЕНИЕ: сначала показываем ошибки, затем предупреждения */}
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