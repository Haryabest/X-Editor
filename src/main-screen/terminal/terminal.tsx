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
}

const Terminal: React.FC<XTermTerminalProps> = (props) => {
  const { terminalHeight, issues, onIssueClick, terminalCommand, selectedFolder, onResize } = props;
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
  
  // Добавляем слушатель для обновлений маркеров Python
  useEffect(() => {
    const handleMarkersUpdated = () => {
      // Принудительно обновляем компонент
      setFilterSeverity(current => current);
    };
    
    document.addEventListener('markers-updated', handleMarkersUpdated);
    
    return () => {
      document.removeEventListener('markers-updated', handleMarkersUpdated);
    };
  }, []);

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

  // Функция для отображения проблем
  const renderIssues = () => {
    const filteredIssues = getFilteredIssues();
    
    if (filteredIssues.length === 0) {
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
      </div>
    );
  };

  // Add a new useEffect to listen for custom terminal command events
  useEffect(() => {
    // Handler for custom terminal commands
    const handleTerminalCommand = (event: Event) => {
      const customEvent = event as CustomEvent<{command: string}>;
      const { command } = customEvent.detail;
      
      console.log(`Received terminal command: ${command}`);
      
      switch (command) {
        case 'clear':
          console.log('Clearing terminal');
          clearTerminal();
          break;
        case 'settings':
          console.log('Opening terminal settings');
          // Open settings through the left toolbar settings button
          const settingsButton = document.querySelector('.left-toolbar .bottom-buttons button:last-child');
          if (settingsButton) {
            console.log('Clicking settings button');
            (settingsButton as HTMLButtonElement).click();
            
            // After a short delay, switch to the Terminal tab
            setTimeout(() => {
              console.log('Switching to Terminal tab');
              // Look for the terminal tab by text content
              const terminalTabs = Array.from(document.querySelectorAll('.settings-sidebar .sidebar-item'));
              const terminalTab = terminalTabs.find(tab => tab.textContent?.trim() === 'Терминал');
              
              if (terminalTab) {
                (terminalTab as HTMLDivElement).click();
              } else {
                console.log('Terminal tab not found');
              }
            }, 100);
          } else {
            console.log('Settings button not found');
          }
          break;
        case 'restart':
          console.log('Restarting terminal process');
          restartTerminalProcess();
          break;
        default:
          console.log(`Unknown terminal command: ${command}`);
          break;
      }
    };

    // Add event listener for the terminal container
    const terminalContainer = document.querySelector('.terminal-container') as HTMLElement | null;
    if (terminalContainer) {
      terminalContainer.addEventListener('terminal-command', handleTerminalCommand);
    }
    
    // Also listen at document level (fallback)
    document.addEventListener('terminal-command', handleTerminalCommand);

    // Cleanup function
    return () => {
      if (terminalContainer) {
        terminalContainer.removeEventListener('terminal-command', handleTerminalCommand);
      }
      document.removeEventListener('terminal-command', handleTerminalCommand);
    };
  }, []);

  // Handle closing the terminal panel
  const closeTerminal = () => {
    console.log("Closing terminal panel");
    document.dispatchEvent(new Event('terminal-close'));
  };

  // Следим за изменением выбранной директории и меняем текущую директорию терминала
  useEffect(() => {
    if (selectedFolder && isProcessRunning) {
      (async () => {
        try {
          console.log(`Changing terminal directory to: ${selectedFolder}`);
          
          // Вызываем функцию change_directory из Rust
          await invoke('change_directory', { path: selectedFolder });
          
          // Отображаем сообщение в терминале
          if (terminal.current) {
            terminal.current.write(`\r\n\x1b[32mDirectory changed to: \x1b[33m${selectedFolder}\x1b[0m\r\n`);
            
            // Обновляем приглашение командной строки
            await invoke('send_input', { input: '\r' });
          }
        } catch (error) {
          console.error('Error changing directory:', error);
          if (terminal.current) {
            terminal.current.write(`\r\n\x1b[31mFailed to change directory: ${error}\x1b[0m\r\n`);
          }
        }
      })();
    }
  }, [selectedFolder, isProcessRunning]);

  // Функция для обновления настроек уже открытого терминала
  const updateTerminalSettings = useCallback(() => {
    if (terminal.current) {
      // Обновляем настройки существующего терминала
      const options = {
        fontSize: terminalSettings.fontSize,
        fontFamily: terminalSettings.fontFamily,
        cursorStyle: terminalSettings.cursorStyle,
        cursorBlink: terminalSettings.cursorBlink
      };
      
      // Применяем новые настройки
      terminal.current.options.fontSize = options.fontSize;
      terminal.current.options.fontFamily = options.fontFamily;
      terminal.current.options.cursorBlink = options.cursorBlink;
      terminal.current.options.cursorStyle = options.cursorStyle as any;
      
      // Перерисовываем терминал с новыми настройками
      terminal.current.refresh(0, terminal.current.rows - 1);
      
      // Обновляем размер после изменения шрифта
      setTimeout(() => {
        if (fitAddon.current) {
          fitAddon.current.fit();
          // Информируем Rust о новом размере
          const { rows, cols } = terminal.current!;
          invoke("resize_pty", { rows, cols }).catch(err => {
            console.error("Failed to resize PTY after settings change:", err);
          });
        }
      }, 100);
    }
  }, [terminalSettings]);

  // Слушаем событие изменения настроек терминала
  useEffect(() => {
    const handleTerminalSettingsChange = () => {
      try {
        const savedTerminalSettings = localStorage.getItem('terminal-settings');
        if (savedTerminalSettings) {
          const parsedSettings = JSON.parse(savedTerminalSettings);
          
          // Обновляем локальное состояние
          setTerminalSettings(prevSettings => ({
            ...prevSettings,
            ...parsedSettings
          }));
        }
      } catch (error) {
        console.error('Ошибка при обновлении настроек терминала:', error);
      }
    };

    // Событие, которое будет вызвано при сохранении настроек
    window.addEventListener('terminal-settings-changed', handleTerminalSettingsChange);
    
    return () => {
      window.removeEventListener('terminal-settings-changed', handleTerminalSettingsChange);
    };
  }, []);
  
  // Применяем настройки при их изменении
  useEffect(() => {
    updateTerminalSettings();
  }, [terminalSettings, updateTerminalSettings]);

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
        setFilterSeverity(current => current);
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
                setFilterSeverity(current => current);
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

  return (
    <div className="terminal-container" style={{height: terminalHeight ? `${terminalHeight}px` : '200px', display: 'flex', flexDirection: 'column'}}>
      <div className="vertical-resizer" onMouseDown={handleVerticalDrag}>
        <GripHorizontal size={16} color="#666" style={{ margin: '0 auto', display: 'block' }} />
      </div>
      <div className="tab-buttons">
        <div className="left-tabs">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`tab-button ${activeTab === "terminal" ? "active" : ""}`}
          >
            Терминал
          </button>
          <button
            onClick={() => setActiveTab("issues")}
            className={`tab-button ${activeTab === "issues" ? "active" : ""}`}
          >
            Проблемы
          </button>
        </div>
        
        <div className="right-actions">
          {activeTab === "terminal" ? (
            <>
              <button
                className="action-button"
                onClick={clearTerminal}
                title="Очистить терминал"
              >
                <AiOutlineClear size={16} />
              </button>
              <button
                className="action-button"
                onClick={restartTerminalProcess}
                title="Перезапустить процесс"
              >
                <RefreshCw size={16} />
              </button>
              <button
                className="action-button"
                onClick={closeTerminal}
                title="Скрыть панель"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <>
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  className="issues-search-input" 
                  placeholder="Поиск проблем..." 
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                />
              </div>
              <button
                className="action-button"
                onClick={() => setShowIssueFilters(!showIssueFilters)}
                title="Фильтры проблем"
              >
                <FaFilter size={16} />
              </button>
              <button
                className="action-button"
                onClick={handleForcePythonDiagnostics}
                title="Обновить диагностику Python"
              >
                <FaPython size={14} />
              </button>
              <button
                className="action-button"
                onClick={closeTerminal}
                title="Скрыть панель"
              >
                <X size={16} />
              </button>
            </>
          )}
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