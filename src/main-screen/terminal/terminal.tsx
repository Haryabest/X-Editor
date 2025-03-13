import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';

const XTermTerminal: React.FC = () => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const terminal = useRef<Terminal | null>(null);
    const fitAddon = useRef(new FitAddon());
    const commandBuffer = useRef('');
    const commandHistory = useRef<string[]>([]);
    const historyIndex = useRef(-1);
    const resizeLineRef = useRef<HTMLDivElement>(null);
    const isResizing = useRef(false);

    const getPrompt = async () => {
        try {
            const dir = await invoke<string>("get_current_dir");
            return `\x1b[1;33mPS \x1b[1;34m${dir}\x1b[1;37m> \x1b[0m`;
        } catch {
            return `\x1b[1;33mPS \x1b[1;34m~\x1b[1;37m> \x1b[0m`;
        }
    };

    const writePrompt = async () => {
        if (!terminal.current) return;
        try {
            const prompt = await getPrompt();
            terminal.current.write('\x1b[2K\r'); // Clear entire line
            terminal.current.write(prompt);
            terminal.current.focus();
        } catch (error) {
            console.error('Prompt error:', error);
        }
    };

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
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
            allowProposedApi: true
        });

        const fitAddonInstance = new FitAddon();
        term.loadAddon(fitAddonInstance);
        term.open(terminalRef.current);
        fitAddonInstance.fit();

        const resizeObserver = new ResizeObserver(() => {
            fitAddonInstance.fit();
            term.scrollToBottom();
        });
        resizeObserver.observe(terminalRef.current);

        term.onData(async (data) => {
            const code = data.charCodeAt(0);

            if (data === '\x1b[A') {
                if (commandHistory.current.length === 0) return;
                historyIndex.current = Math.min(
                    historyIndex.current + 1,
                    commandHistory.current.length - 1
                );
                commandBuffer.current = commandHistory.current[historyIndex.current];
                term.write('\x1b[2K\x1b[G');
                term.write(await getPrompt());
                term.write(commandBuffer.current);
            }
            else if (data === '\x1b[B') {
                historyIndex.current = Math.max(historyIndex.current - 1, -1);
                commandBuffer.current = historyIndex.current >= 0
                    ? commandHistory.current[historyIndex.current]
                    : '';
                term.write('\x1b[2K\x1b[G');
                term.write(await getPrompt());
                term.write(commandBuffer.current);
            }
            else if (code === 13) {
                const command = commandBuffer.current.trim();
                commandBuffer.current = '';
                historyIndex.current = -1;
                term.write('\r\n');

                if (command) {
                    commandHistory.current.unshift(command);
                    try {
                        if (command === 'cls' || command === 'clear') {
                            term.clear();
                        } else {
                            const result = await invoke<string>("execute_command", { command });
                            term.write('\x1b[2K\r'); // Clear before output
                            term.write(result.replace(/\r?\n/g, '\r\n') + '\r\n');
                        }
                    } catch (error) {
                        term.write(`\x1b[31mError: ${error}\x1b[0m\r\n`);
                    }
                }
                writePrompt();
            }
            else if (code === 127) {
                if (commandBuffer.current.length > 0) {
                    commandBuffer.current = commandBuffer.current.slice(0, -1);
                    term.write('\x1b[D \x1b[D');
                }
            }
            else if (code >= 32) {
                commandBuffer.current += data;
                term.write(data);
            }
        });

        const handleMouseDown = (e: MouseEvent) => {
            isResizing.current = true;
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current || !terminalRef.current) return;
            const newHeight = window.innerHeight - e.clientY - 20;
            terminalRef.current.style.height = `${Math.max(100, newHeight)}px`;
        };

        const handleMouseUp = () => {
            isResizing.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        if (resizeLineRef.current) {
            resizeLineRef.current.addEventListener('mousedown', handleMouseDown);
        }

        writePrompt();

        terminal.current = term;

        return () => {
            resizeObserver.disconnect();
            term.dispose();
            if (resizeLineRef.current) {
                resizeLineRef.current.removeEventListener('mousedown', handleMouseDown);
            }
        };
    }, []);

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: 'calc(100% - 20px)',
            padding: 0,
            boxSizing: 'border-box'
        }}>
            <div
                ref={terminalRef}
                style={{
                    width: '100%',
                    height: '100%',
                    padding: '0px',
                    boxSizing: 'border-box'
                }}
            />

            <div
                ref={resizeLineRef}
                style={{
                    position: 'absolute',
                    bottom: '-5px',
                    left: 0,
                    right: 0,
                    height: '10px',
                    cursor: 'ns-resize',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    zIndex: 100
                }}
            />
        </div>
    );
};

export default XTermTerminal;
