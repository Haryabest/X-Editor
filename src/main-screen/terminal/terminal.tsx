import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { WebglAddon } from "xterm-addon-webgl";
import "xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./style.css";

interface TerminalInstance {
  id: string;
  name: string;
  terminal: Terminal | null;
  fitAddon: FitAddon | null;
  isProcessRunning: boolean;
  unlisten: (() => void) | null;
  ref: HTMLDivElement | null;
}

const XTermTerminal: React.FC = () => {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"terminal" | "issues">("terminal");
  const [nextTerminalId, setNextTerminalId] = useState(1);

  // Initialize first terminal on mount
  useEffect(() => {
    if (terminals.length === 0) {
      addNewTerminal();
    }
  }, []);

  const addNewTerminal = () => {
    const newTerminalId = `term-${nextTerminalId}`;
    const newTerminalName = `Terminal ${nextTerminalId}`;
    
    const newTerminal: TerminalInstance = {
      id: newTerminalId,
      name: newTerminalName,
      terminal: null,
      fitAddon: null,
      isProcessRunning: false,
      unlisten: null,
      ref: null
    };

    setTerminals([...terminals, newTerminal]);
    setActiveTerminalId(newTerminalId);
    setNextTerminalId(nextTerminalId + 1);
  };

  const removeTerminal = (id: string) => {
    if (terminals.length <= 1) return; // Don't remove the last terminal

    const terminalToRemove = terminals.find(t => t.id === id);
    if (!terminalToRemove) return;

    // Clean up resources
    if (terminalToRemove.unlisten) terminalToRemove.unlisten();
    if (terminalToRemove.terminal) terminalToRemove.terminal.dispose();

    const newTerminals = terminals.filter(t => t.id !== id);
    setTerminals(newTerminals);

    // If we're removing the active terminal, select another one
    if (activeTerminalId === id) {
      setActiveTerminalId(newTerminals.length > 0 ? newTerminals[newTerminals.length - 1].id : null);
    }
  };

  const resizeTerminal = async (terminal: TerminalInstance) => {
    if (!terminal.fitAddon || !terminal.terminal) return;

    try {
      terminal.fitAddon.fit();
      const { rows, cols } = terminal.terminal;
      await invoke("resize_pty", { rows, cols }).catch((err) => {
        console.error("Failed to resize PTY:", err);
      });
    } catch (e) {
      console.error("Failed to fit terminal:", e);
    }
  };

  const startTerminalProcess = async (terminal: TerminalInstance) => {
    if (!terminal.terminal || terminal.isProcessRunning) return;

    try {
      terminal.terminal.write("\r\n\x1b[33mStarting terminal process...\x1b[0m\r\n");

      await invoke("start_process");
      setTerminals(terminals.map(t => 
        t.id === terminal.id ? { ...t, isProcessRunning: true } : t
      ));

      await resizeTerminal(terminal);

      terminal.terminal.write("\r\n\x1b[32mProcess started successfully\x1b[0m\r\n");
    } catch (err) {
      console.error("Failed to start process:", err);
      if (terminal.terminal) {
        terminal.terminal.write(`\r\n\x1b[31mFailed to start terminal process: ${err}\x1b[0m\r\n`);
      }
      setTerminals(terminals.map(t => 
        t.id === terminal.id ? { ...t, isProcessRunning: false } : t
      ));
    }
  };

  // Initialize terminal when added or becomes active
  useEffect(() => {
    const initializeTerminal = async (terminal: TerminalInstance) => {
      if (!terminal.ref || terminal.terminal) return;

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
      const webgl = new WebglAddon();

      term.loadAddon(fit);
      term.loadAddon(webLinks);
      term.loadAddon(unicode11);
      term.loadAddon(webgl);

      term.unicode.activeVersion = '11';

      term.open(terminal.ref);

      await new Promise((resolve) => setTimeout(resolve, 100));
      fit.fit();

      term.onData((data) => {
        invoke("send_input", { input: data }).catch((err) => {
          console.error("Failed to send input:", err);
          term.write(`\r\n\x1b[31mError: ${err}\x1b[0m\r\n`);
        });
      });

      const unlisten = await listen<string>("pty-output", (event) => {
        if (term) {
          term.write(event.payload);
        }
      });

      // Update the terminal instance
      setTerminals(terminals.map(t => 
        t.id === terminal.id ? { 
          ...t, 
          terminal: term, 
          fitAddon: fit, 
          unlisten: unlisten as () => void 
        } : t
      ));

      await startTerminalProcess({ ...terminal, terminal: term, fitAddon: fit });
    };

    if (activeTerminalId) {
      const terminal = terminals.find(t => t.id === activeTerminalId);
      if (terminal) {
        initializeTerminal(terminal).catch(console.error);
      }
    }
  }, [activeTerminalId]);

  // Handle window resize for active terminal
  useEffect(() => {
    const handleResize = () => {
      if (activeTerminalId) {
        const terminal = terminals.find(t => t.id === activeTerminalId);
        if (terminal) {
          resizeTerminal(terminal).catch(console.error);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTerminalId, terminals]);

  const getActiveTerminal = () => {
    return terminals.find(t => t.id === activeTerminalId);
  };

  return (
    <div className="terminal-container">
      <div className="tab-buttons">
        <div className="left-tabs">
          <button
            onClick={() => setActiveTab("terminal")}
            className={`tab-button ${activeTab === "terminal" ? "active" : "inactive"}`}
          >
            Терминал
          </button>
          <button
            onClick={() => setActiveTab("issues")}
            className={`tab-button ${activeTab === "issues" ? "active" : "inactive"}`}
          >
            Проблемы
          </button>
        </div>
        
        <div className="right-actions">
          {activeTab === "terminal" ? (
            <>
              <div className="terminal-tabs">
                {terminals.map(term => (
                  <div 
                    key={term.id} 
                    className={`terminal-tab ${activeTerminalId === term.id ? 'active' : ''}`}
                    onClick={() => setActiveTerminalId(term.id)}
                  >
                    <span>{term.name}</span>
                    {terminals.length > 1 && (
                      <button 
                        className="close-tab"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeTerminal(term.id);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  className="add-terminal"
                  onClick={addNewTerminal}
                  title="Добавить новый терминал"
                >
                  +
                </button>
              </div>
              
              <div className="terminal-actions">
                <button
                  className="action-button"
                  onClick={() => getActiveTerminal()?.terminal?.clear()}
                  title="Очистить терминал"
                >
                  🧹 Очистить
                </button>
                <button
                  className="action-button"
                  onClick={() => {
                    const term = getActiveTerminal();
                    if (term) startTerminalProcess(term);
                  }}
                  title="Перезапустить процесс"
                >
                  🔄 Перезапустить
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className="action-button"
                onClick={() => console.log("Обновить проблемы")}
                title="Обновить список проблем"
              >
                🔄 Обновить
              </button>
              <button
                className="action-button"
                onClick={() => console.log("Фильтровать проблемы")}
                title="Фильтровать проблемы"
              >
                ⚙️ Фильтры
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tab-content">
        {activeTab === "terminal" ? (
          <>
            {terminals.map(term => (
              <div
                key={term.id}
                ref={el => {
                  if (el && !term.ref) {
                    setTerminals(terminals.map(t => 
                      t.id === term.id ? { ...t, ref: el } : t
                    ));
                  }
                }}
                className="terminal"
                style={{ 
                  display: activeTerminalId === term.id ? "block" : "none",
                  height: "100%"
                }}
              />
            ))}
          </>
        ) : (
          <div className="issues-tab">
            <p>Здесь будет отображаться список проблем.</p>
          </div>
        )}
      </div>

      {activeTab === "terminal" && getActiveTerminal() && (
        <div
          className={`status-indicator ${getActiveTerminal()?.isProcessRunning ? "running" : "stopped"}`}
          title={getActiveTerminal()?.isProcessRunning ? "Process running" : "Process not running"}
        />
      )}
    </div>
  );
};

export default XTermTerminal;
