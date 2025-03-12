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
  const inputRef = useRef<HTMLInputElement>(null);

  // ANSI цвета
  const themeColors = {
    dir: '\x1b[1;34m',     // Синий для директории
    prompt: '\x1b[1;32m',  // Зеленый для промпта
    reset: '\x1b[0m'
  };

  // Получение текущей директории
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

  // Обновление приглашения
  const updatePrompt = async () => {
    const dir = await getCurrentDir();
    return `${themeColors.dir}${dir}${themeColors.prompt} $ ${themeColors.reset}`;
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
      fontFamily: '"Courier New", monospace',
      scrollback: 100,
      convertEol: true
    });

    try {
      terminal.current.loadAddon(fitAddon.current);
      fitAddon.current.fit();
    } catch (error) {
      console.error('Error initializing addons:', error);
    }

    terminal.current.open(terminalRef.current);
    
    // Инициализация приглашения
    updatePrompt().then(prompt => {
      terminal.current?.write(prompt);
    });

    const handleData = async (data: string) => {
      const code = data.charCodeAt(0);
      
      if (code === 13 || code === 10) { // Enter
        const command = commandBuffer.current.trim();
        commandBuffer.current = '';
        
        if (command) {
          terminal.current?.writeln('');
          try {
            const result = await invoke<string>("execute_command", { command });
            terminal.current?.writeln(result);
          } catch (error) {
            terminal.current?.writeln(`\x1b[1;31mError: ${error}\x1b[0m`);
          }
        }
        
        // Обновление приглашения
        const newPrompt = await updatePrompt();
        terminal.current?.write(newPrompt);
      }
      else if (code === 127) { // Backspace
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1);
          terminal.current?.write('\x1B[D \x1B[D');
        }
      }
      else {
        commandBuffer.current += data;
        terminal.current?.write(data);
      }
    };

    const dataListener = terminal.current.onData(handleData);
    const resizeHandler = () => fitAddon.current?.fit();
    window.addEventListener('resize', resizeHandler);

    return () => {
      dataListener.dispose();
      terminal.current?.dispose();
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  return (
    <div className="terminal">
      <div className="terminal-content">
        <div ref={terminalRef} className="xterm-container" />
      </div>
    </div>
  );
};

export default XTermTerminal;