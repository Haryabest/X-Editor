import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import './style.css';

const XTermTerminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon>(new FitAddon());
  const commandBuffer = useRef<string>('');
  const [currentDir, setCurrentDir] = useState('~');
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef<number>(-1);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(10);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startDragY = useRef(0);
  const startScrollPos = useRef(0);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  const themeColors = {
    ps: '\x1b[1;33m',
    dir: '\x1b[1;34m',
    prompt: '\x1b[1;37m',
    reset: '\x1b[0m'
  };

  const getCurrentDir = async () => {
    try {
      const dir = await invoke<string>("get_current_dir");
      setCurrentDir(dir);
      return dir;
    } catch (error) {
      console.error('Error getting directory:', error);
      return '~';
    }
  };

  const updatePrompt = async () => {
    const dir = await getCurrentDir();
    return `\r\n${themeColors.ps}PS ${themeColors.dir}${dir}${themeColors.prompt}>${themeColors.reset} `;
  };

  const updateScroll = () => {
    if (!terminal.current || !scrollbarRef.current) return;

    const totalLines = terminal.current.buffer.active.length;
    const visibleLines = terminal.current.rows;
    
    if (totalLines <= visibleLines) {
      setScrollHeight(100);
      setScrollPosition(0);
      return;
    }

    const thumbHeight = Math.max(20, (visibleLines / totalLines) * 100);
    const maxScroll = totalLines - visibleLines;
    const currentScroll = terminal.current.buffer.active.viewportY;
    const scrollPos = (currentScroll / maxScroll) * (100 - thumbHeight);

    setScrollHeight(thumbHeight);
    setScrollPosition(scrollPos);
  };

  const handleScrollbarDrag = (e: MouseEvent) => {
    if (!dragging.current || !terminal.current || !scrollbarRef.current) return;

    const rect = scrollbarRef.current.getBoundingClientRect();
    const scrollbarHeight = rect.height;
    const thumbHeightPx = (scrollHeight / 100) * scrollbarHeight;
    const maxScrollPx = scrollbarHeight - thumbHeightPx;
    
    const y = e.clientY - rect.top;
    const newY = Math.max(0, Math.min(y - thumbHeightPx / 2, maxScrollPx));
    const scrollPercent = newY / maxScrollPx;

    const totalLines = terminal.current.buffer.active.length;
    const visibleLines = terminal.current.rows;
    const maxTerminalScroll = totalLines - visibleLines;
    const targetLine = Math.floor(scrollPercent * maxTerminalScroll);

    terminal.current.scrollToLine(targetLine);
    setScrollPosition((newY / scrollbarHeight) * 100);
  };

  const handleScrollbarClick = (e: React.MouseEvent) => {
    if (!terminal.current || !scrollbarRef.current || dragging.current) return;

    const rect = scrollbarRef.current.getBoundingClientRect();
    const scrollbarHeight = rect.height;
    const thumbHeightPx = (scrollHeight / 100) * scrollbarHeight;
    const maxScrollPx = scrollbarHeight - thumbHeightPx;
    
    const y = e.clientY - rect.top;
    const newY = Math.max(0, Math.min(y - thumbHeightPx / 2, maxScrollPx));
    const scrollPercent = newY / maxScrollPx;

    const totalLines = terminal.current.buffer.active.length;
    const visibleLines = terminal.current.rows;
    const maxTerminalScroll = totalLines - visibleLines;
    const targetLine = Math.floor(scrollPercent * maxTerminalScroll);

    terminal.current.scrollToLine(targetLine);
    setScrollPosition((newY / scrollbarHeight) * 100);
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#45fce4',
        selectionBackground: 'rgba(255,255,255,0.1)'
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      scrollback: 1000,
      convertEol: true
    });

    terminal.current.loadAddon(fitAddon.current);
    terminal.current.open(terminalRef.current);
    fitAddon.current.fit();

    updatePrompt().then(prompt => {
      terminal.current?.write(prompt);
      updateScroll();
    });

    // Create ResizeObserver to handle container resizing
    resizeObserver.current = new ResizeObserver(() => {
      if (terminal.current) {
        fitAddon.current.fit();
        updateScroll();
      }
    });

    // Observe the terminal container
    if (terminalRef.current) {
      resizeObserver.current.observe(terminalRef.current);
    }

    const handleData = async (data: string) => {
      const code = data.charCodeAt(0);

      if (data === '\x1b[A') {
        if (historyIndex.current < commandHistory.current.length - 1) {
          historyIndex.current++;
          commandBuffer.current = commandHistory.current[historyIndex.current] || '';
          terminal.current?.write('\x1b[2K\r');
          updatePrompt().then(prompt => {
            terminal.current?.write(prompt + commandBuffer.current);
          });
        }
        return;
      } else if (data === '\x1b[B') {
        if (historyIndex.current > 0) {
          historyIndex.current--;
          commandBuffer.current = commandHistory.current[historyIndex.current] || '';
          terminal.current?.write('\x1b[2K\r');
          updatePrompt().then(prompt => {
            terminal.current?.write(prompt + commandBuffer.current);
          });
        } else {
          historyIndex.current = -1;
          commandBuffer.current = '';
          terminal.current?.write('\x1b[2K\r');
          updatePrompt().then(prompt => {
            terminal.current?.write(prompt);
          });
        }
        return;
      }

      if (code === 13) {
        const command = commandBuffer.current.trim();
        commandBuffer.current = '';
        historyIndex.current = -1;

        if (command) {
          commandHistory.current.unshift(command);
          terminal.current?.writeln('');

          try {
            if (command === 'cls' || command === 'clear') {
              terminal.current?.clear();
              updatePrompt().then(prompt => {
                terminal.current?.write(prompt);
              });
            } else {
              const result = await invoke<string>("execute_command", { command });
              terminal.current?.writeln(result.replace(/\r?\n/g, '\r\n'));
            }
          } catch (error) {
            terminal.current?.writeln(`\x1b[1;31mError: ${error}\x1b[0m`);
          }
        }

        updatePrompt().then(prompt => {
          terminal.current?.write(prompt);
          terminal.current?.scrollToBottom();
          updateScroll();
        });
      } else if (code === 127) {
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1);
          terminal.current?.write('\x1b[D \x1b[D');
        }
      } else if (code >= 32) {
        commandBuffer.current += data;
        terminal.current?.write(data);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!thumbRef.current) return;
      dragging.current = true;
      startDragY.current = e.clientY;
      startScrollPos.current = scrollPosition;
      thumbRef.current.style.transition = 'none';
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!thumbRef.current) return;
      dragging.current = false;
      thumbRef.current.style.transition = 'top 0.1s';
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (terminal.current) {
        const delta = e.deltaY > 0 ? 1 : -1;
        terminal.current.scrollLines(delta * 3);
        updateScroll();
      }
    };

    terminal.current.onData(handleData);
    terminal.current.onScroll(updateScroll);
    terminalRef.current.addEventListener('wheel', handleWheel);
    thumbRef.current?.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleScrollbarDrag);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      terminal.current?.dispose();
      resizeObserver.current?.disconnect();
      terminalRef.current?.removeEventListener('wheel', handleWheel);
      thumbRef.current?.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleScrollbarDrag);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-buttons">
          <span className="close"></span>
          <span className="minimize"></span>
          <span className="expand"></span>
        </div>
      </div>
      <div className="terminal-content">
        <div ref={terminalRef} className="xterm-container" />
        <div 
          ref={scrollbarRef} 
          className="custom-scrollbar"
          onClick={handleScrollbarClick}
        >
          <div
            ref={thumbRef}
            className="scrollbar-thumb"
            style={{
              height: `${scrollHeight}%`,
              top: `${scrollPosition}%`,
              transition: dragging.current ? 'none' : 'top 0.1s'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default XTermTerminal;