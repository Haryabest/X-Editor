import React, { useState, useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { invoke } from '@tauri-apps/api/core';
import { listen } from "@tauri-apps/api/event";
import { RefreshCw, Search, ChevronRight, ChevronDown, File, AlertCircle, AlertTriangle, Info , X} from "lucide-react";
import { getFileIcon } from "../leftBar/fileIcons";
import { AiOutlineClear } from "react-icons/ai";
import { FaFilter } from "react-icons/fa";

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
}

const Terminal: React.FC<XTermTerminalProps> = (props) => {
  const { terminalHeight, issues, onIssueClick, terminalCommand } = props;
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
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Consolas, "Courier New", monospace',
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
          resizeObserver.observe(terminalRef.current);
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
  }, [activeTab]);

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

  // Функция для фильтрации проблем
  const getFilteredIssues = () => {
    if (!issues) return [];
    
    return issues
      .map(fileIssue => ({
        ...fileIssue,
        issues: fileIssue.issues.filter(issue => {
          const matchesSearch = issueSearch === "" ||
            issue.message.toLowerCase().includes(issueSearch.toLowerCase()) ||
            fileIssue.fileName.toLowerCase().includes(issueSearch.toLowerCase());
          
          const matchesFilter = (
            (issue.severity === 'error' && filters.errors) ||
            (issue.severity === 'warning' && filters.warnings) ||
            (issue.severity === 'info' && filters.info)
          );

          return matchesSearch && matchesFilter;
        })
      }))
      .filter(fileIssue => fileIssue.issues.length > 0);
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

  // Функция для отображения проблем
  const renderIssues = () => {
    const filteredIssues = getFilteredIssues();
    
    return (
      <div className="issues-list">
        {filteredIssues.map(fileIssue => (
          <div key={fileIssue.filePath} className="file-issues">
            <div 
              className="file-header"
              onClick={() => toggleFileExpand(fileIssue.filePath)}
            >
              {expandedFiles.has(fileIssue.filePath) ? 
                <ChevronDown size={16} /> : 
                <ChevronRight size={16} />
              }
              {getFileIcon(fileIssue.fileName) || <File size={16} />}
              <span className="file-name">{fileIssue.fileName}</span>
              <span className="issues-count">
                {fileIssue.issues.length}
              </span>
            </div>
            
            {expandedFiles.has(fileIssue.filePath) && (
              <div className="issue-items">
                {fileIssue.issues.map((issue, index) => (
                  <div 
                    key={index} 
                    className="issue-item"
                    onClick={() => onIssueClick?.(fileIssue.filePath, issue.line, issue.column)}
                    style={{ cursor: 'pointer' }}
                  >
                    {getSeverityIcon(issue.severity)}
                    <div className="issue-details">
                      <div className="issue-message">{issue.message}</div>
                      <div className="issue-location">
                        Строка {issue.line}, Столбец {issue.column}
                        {issue.source && <span className="issue-source"> [{issue.source}]</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {filteredIssues.length === 0 && (
          <div className="no-issues">
            {issueSearch ? "Нет результатов поиска" : "Проблем не найдено"}
          </div>
        )}
      </div>
    );
  };

  // Add a new useEffect to listen for custom terminal command events
  useEffect(() => {
    // Handler for custom terminal commands
    const handleTerminalCommand = (event: Event) => {
      const customEvent = event as CustomEvent<{command: string}>;
      const { command } = customEvent.detail;
      
      switch (command) {
        case 'clear':
          clearTerminal();
          break;
        case 'settings':
          // Handle terminal settings
          console.log('Terminal settings requested');
          // Show a settings modal or toggle a settings view
          break;
        case 'restart':
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

  return (
    <div className="terminal-container">
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
                onClick={hideTerminalPanel}
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
                onClick={hideTerminalPanel}
                title="Скрыть панель"
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tab-content">
        {/* Вкладка терминала */}
        <div 
          className="terminal"
          style={{ 
            display: activeTab === "terminal" ? "block" : "none"
          }}
        >
          {activeTab === "terminal" && (
            <div 
              ref={terminalRef} 
              style={{ 
                width: "100%",
                height: "100%"
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
              <div className="filter-option">
                <input 
                  type="checkbox" 
                  id="errors" 
                  checked={filters.errors}
                  onChange={(e) => setFilters(prev => ({ ...prev, errors: e.target.checked }))}
                />
                <label htmlFor="errors">Ошибки</label>
              </div>
              <div className="filter-option">
                <input 
                  type="checkbox" 
                  id="warnings" 
                  checked={filters.warnings}
                  onChange={(e) => setFilters(prev => ({ ...prev, warnings: e.target.checked }))}
                />
                <label htmlFor="warnings">Предупреждения</label>
              </div>
              <div className="filter-option">
                <input 
                  type="checkbox" 
                  id="info" 
                  checked={filters.info}
                  onChange={(e) => setFilters(prev => ({ ...prev, info: e.target.checked }))}
                />
                <label htmlFor="info">Информация</label>
              </div>
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