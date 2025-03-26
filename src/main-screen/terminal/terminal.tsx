import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import "xterm/css/xterm.css";
import { invoke } from '@tauri-apps/api/core';
import { listen } from "@tauri-apps/api/event";
import { 
  Minimize, 
  Eraser,
  RefreshCw,
  Search,
  SlidersHorizontal
} from "lucide-react";
import "./style.css";

interface XTermTerminalProps {
  terminalHeight?: number;
}

const XTermTerminal: React.FC<XTermTerminalProps> = ({ terminalHeight }) => {
  const [activeTab, setActiveTab] = useState<"terminal" | "issues">("terminal");
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const [isProcessRunning, setIsProcessRunning] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [showIssueFilters, setShowIssueFilters] = useState(false);

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

        const term = new Terminal({
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

  // Обработчик поиска в проблемах
  const handleIssueSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIssueSearch(e.target.value);
  };

  // Переключение отображения фильтров
  const toggleIssueFilters = () => {
    setShowIssueFilters(!showIssueFilters);
  };

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
                <Eraser size={16} />
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
                <Minimize size={16} />
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
                  onChange={handleIssueSearch}
                />
              </div>
              <button
                className="action-button"
                onClick={toggleIssueFilters}
                title="Фильтры проблем"
              >
                <SlidersHorizontal size={16} />
              </button>
              <button
                className="action-button"
                onClick={() => console.log("Обновить проблемы")}
                title="Обновить список проблем"
              >
                <RefreshCw size={16} />
              </button>
              <button
                className="action-button"
                onClick={hideTerminalPanel}
                title="Скрыть панель"
              >
                <Minimize size={16} />
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
            display: activeTab === "issues" ? "flex" : "none"
          }}
        >
          {showIssueFilters && (
            <div className="issues-filters">
              <div className="filter-option">
                <input type="checkbox" id="errors" />
                <label htmlFor="errors">Ошибки</label>
              </div>
              <div className="filter-option">
                <input type="checkbox" id="warnings" />
                <label htmlFor="warnings">Предупреждения</label>
              </div>
              <div className="filter-option">
                <input type="checkbox" id="info" />
                <label htmlFor="info">Информация</label>
              </div>
            </div>
          )}
          
          <div className="issues-content">
            <p>Здесь будет отображаться список проблем.</p>
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

export default XTermTerminal;