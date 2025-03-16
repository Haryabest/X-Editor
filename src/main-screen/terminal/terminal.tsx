import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Unicode11Addon } from "xterm-addon-unicode11";
import { WebglAddon } from "xterm-addon-webgl";
import "xterm/css/xterm.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./style.css"; // Импортируем стили

const XTermTerminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isProcessRunning, setIsProcessRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"terminal" | "issues">("terminal");

  // Function to resize the terminal and notify the backend
  const resizeTerminal = async () => {
    if (fitAddon.current && terminal.current) {
      try {
        fitAddon.current.fit();
        const { rows, cols } = terminal.current;
        await invoke("resize_pty", { rows, cols }).catch((err) => {
          console.error("Failed to resize PTY:", err);
        });
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }
    }
  };

  // Function to start the terminal process
  const startTerminalProcess = async () => {
    if (!terminal.current || isProcessRunning) return;

    try {
      terminal.current.write("\r\n\x1b[33mStarting terminal process...\x1b[0m\r\n");

      await invoke("start_process");
      setIsProcessRunning(true);

      await resizeTerminal();

      terminal.current.write("\r\n\x1b[32mProcess started successfully\x1b[0m\r\n");
    } catch (err) {
      console.error("Failed to start process:", err);
      if (terminal.current) {
        terminal.current.write(`\r\n\x1b[31mFailed to start terminal process: ${err}\x1b[0m\r\n`);
      }
      setIsProcessRunning(false);
    }
  };

  useEffect(() => {
    const initTerminal = async () => {
      if (!terminalRef.current || terminal.current) return;

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
        scrollback: 5000, // Увеличиваем буфер скролла
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

      terminal.current = term;
      fitAddon.current = fit;

      term.open(terminalRef.current);

      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        fit.fit();
      } catch (e) {
        console.error("Failed to fit terminal:", e);
      }

      term.onData((data) => {
        invoke("send_input", { input: data }).catch((err) => {
          console.error("Failed to send input:", err);
          term.write(`\r\n\x1b[31mError: ${err}\x1b[0m\r\n`);
        });
      });

      const resizeObserver = new ResizeObserver(() => {
        resizeTerminal().catch(console.error);
      });

      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current);
      }

      const unlisten = await listen<string>("pty-output", (event) => {
        if (terminal.current) {
          terminal.current.write(event.payload);
        }
      });

      unlistenRef.current = unlisten;
      setIsReady(true);

      await startTerminalProcess();

      return () => {
        resizeObserver.disconnect();
        if (unlistenRef.current) {
          unlistenRef.current();
        }
        if (terminal.current) {
          terminal.current.dispose();
        }
      };
    };

    initTerminal().catch(console.error);
  }, []);

  return (
    <div className="terminal-container">
      {/* Кнопки переключения */}
      <div className="tab-buttons">
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

      {/* Контейнер терминала */}
      <div className="tab-content">
        <div
          ref={terminalRef}
          className="terminal"
          style={{ display: activeTab === "terminal" ? "block" : "none" }}
        />
        {activeTab === "issues" && (
          <div className="issues-tab">
            <p>Здесь будет отображаться список проблем.</p>
          </div>
        )}
      </div>

      {/* Индикатор состояния процесса */}
      <div
        className={`status-indicator ${isProcessRunning ? "running" : "stopped"}`}
        title={isProcessRunning ? "Process running" : "Process not running"}
      />
    </div>
  );
};

export default XTermTerminal;