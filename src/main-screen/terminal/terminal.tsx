"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

const XTermTerminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)
  const fitAddon = useRef(new FitAddon())
  const commandBuffer = useRef("")
  const commandHistory = useRef<string[]>([])
  const historyIndex = useRef(-1)
  const resizeLineRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)
  const [inputMode, setInputMode] = useState(false)
  const [hasActiveProcess, setHasActiveProcess] = useState(false)

  const getPrompt = async () => {
    try {
      const dir = await invoke<string>("get_current_dir")
      return `\x1b[1;33mPS \x1b[1;34m${dir}\x1b[1;37m> \x1b[0m`
    } catch {
      return `\x1b[1;33mPS \x1b[1;34m~\x1b[1;37m> \x1b[0m`
    }
  }

  const writePrompt = async () => {
    if (!terminal.current) return
    try {
      const prompt = await getPrompt()
      terminal.current.write("\x1b[2K\r") // Clear entire line
      terminal.current.write(prompt)
      terminal.current.focus()
    } catch (error) {
      console.error("Prompt error:", error)
    }
  }

  const sendInput = async (input: string) => {
    if (!hasActiveProcess) {
      if (terminal.current) {
        terminal.current.write("\r\n\x1b[31mError: No active process to send input to\x1b[0m\r\n")
        setInputMode(false)
        writePrompt()
      }
      return false
    }

    try {
      await invoke("send_input", { input })
      return true
    } catch (error) {
      console.error("Failed to send input:", error)
      if (terminal.current) {
        terminal.current.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`)
      }
      setInputMode(false)
      writePrompt()
      return false
    }
  }

  // Check if there's an active process
  const checkActiveProcess = async () => {
    try {
        const active = await invoke<boolean>("has_active_process");
        // Добавим логирование состояний
        setHasActiveProcess(active);
        return active;
    } catch (error) {
        console.error("Failed to check active process:", error);
        setHasActiveProcess(false);
        return false;
    }
};

  useEffect(() => {
    const interval = setInterval(() => {
        checkActiveProcess();
    }, 1000);
    if (!terminalRef.current) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#45fce4",
        selectionBackground: "rgba(255,255,255,0.1)",
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      scrollback: 1000,
      allowProposedApi: true,
    })

    const fitAddonInstance = new FitAddon()
    term.loadAddon(fitAddonInstance)
    term.open(terminalRef.current)
    fitAddonInstance.fit()

    const resizeObserver = new ResizeObserver(() => {
      fitAddonInstance.fit()
      term.scrollToBottom()
    })
    resizeObserver.observe(terminalRef.current)

    term.onData(async (data) => {
      const code = data.charCodeAt(0)

      // If in input mode, send input directly to the process
      if (inputMode) {
        if (code === 13) {
          // Enter key
          term.write("\r\n")
          const success = await sendInput(commandBuffer.current)
          if (success) {
            commandBuffer.current = ""
          }
          return
        } else if (code === 27) {
          // Escape key - exit input mode
          setInputMode(false)
          commandBuffer.current = ""
          term.write("\r\n\x1b[33mExited input mode\x1b[0m\r\n")
          writePrompt()
          return
        } else if (code === 127) {
          // Backspace
          if (commandBuffer.current.length > 0) {
            commandBuffer.current = commandBuffer.current.slice(0, -1)
            term.write("\x1b[D \x1b[D")
          }
          return
        } else if (code >= 32) {
          // Printable characters
          commandBuffer.current += data
          term.write(data)
          return
        }
        return
      }

      // Normal command mode
      if (data === "\x1b[A") {
        // Up arrow
        if (commandHistory.current.length === 0) return
        historyIndex.current = Math.min(historyIndex.current + 1, commandHistory.current.length - 1)
        commandBuffer.current = commandHistory.current[historyIndex.current]
        term.write("\x1b[2K\x1b[G")
        term.write(await getPrompt())
        term.write(commandBuffer.current)
      } else if (data === "\x1b[B") {
        // Down arrow
        historyIndex.current = Math.max(historyIndex.current - 1, -1)
        commandBuffer.current = historyIndex.current >= 0 ? commandHistory.current[historyIndex.current] : ""
        term.write("\x1b[2K\x1b[G")
        term.write(await getPrompt())
        term.write(commandBuffer.current)
      } else if (code === 13) {
        // Enter key
        const command = commandBuffer.current.trim()
        commandBuffer.current = ""
        historyIndex.current = -1
        term.write("\r\n")

        if (command) {
          commandHistory.current.unshift(command)
          try {
            if (command === "cls" || command === "clear") {
              term.clear()
              writePrompt()
            } else {
              // All commands are now treated as potentially interactive
              const result = await invoke<string>("execute_command", {
                command,
                realtime: true,
              })

              if (result.trim()) {
                term.write(result.replace(/\r?\n/g, "\r\n") + "\r\n")
              }

              // Check if there's an active process after command execution
              const active = await checkActiveProcess()

              // If there's an active process, set input mode
              if (active) {
                setInputMode(true)
                commandBuffer.current = ""
              } else {
                writePrompt()
              }
            }
          } catch (error) {
            term.write(`\x1b[31mError: ${error}\x1b[0m\r\n`)
            writePrompt()
          }
        } else {
          writePrompt()
        }
      } else if (code === 127) {
        // Backspace
        if (commandBuffer.current.length > 0) {
          commandBuffer.current = commandBuffer.current.slice(0, -1)
          term.write("\x1b[D \x1b[D")
        }
      } else if (code >= 32) {
        // Printable characters
        commandBuffer.current += data
        term.write(data)
      }
    })

    // Setup event listener for terminal output using the proper Tauri API
    let unlistenFn: (() => void) | undefined
    let unlistenProcessFn: (() => void) | undefined

    const setupListeners = async () => {
      try {
        // Listen for terminal output
        unlistenFn = await listen("terminal-output", (event) => {
          if (term && event.payload) {
            term.write(String(event.payload).replace(/\r?\n/g, "\r\n"))

            // Check if the output contains a prompt-like string that might indicate
            // the process is waiting for input
            const payload = String(event.payload)
            if (
              payload.includes("?") ||
              payload.includes("input") ||
              payload.includes("select") ||
              payload.includes("choose")
            ) {
              checkActiveProcess().then((active) => {
                if (active) {
                  setInputMode(true)
                  commandBuffer.current = ""
                }
              })
            }
          }
        })

        // Listen for process state changes
        unlistenProcessFn = await listen("process-state", (event) => {
          if (event.payload) {
            const state = event.payload as { active: boolean }
            setHasActiveProcess(state.active)

            // If process ended, exit input mode
            if (!state.active && inputMode) {
              setInputMode(false)
              if (term) {
                term.write("\r\n\x1b[33mProcess completed\x1b[0m\r\n")
                writePrompt()
              }
            }
          }
        })

        // Initial check for active process
        await checkActiveProcess()
      } catch (err) {
        console.error("Failed to set up listeners:", err)
      }
    }

    setupListeners()

    const handleMouseDown = (e: MouseEvent) => {
      isResizing.current = true
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !terminalRef.current) return
      const newHeight = window.innerHeight - e.clientY - 20
      terminalRef.current.style.height = `${Math.max(100, newHeight)}px`
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }

    if (resizeLineRef.current) {
      resizeLineRef.current.addEventListener("mousedown", handleMouseDown)
    }

    writePrompt()

    terminal.current = term

    return () => {
      if (unlistenFn) unlistenFn()
      if (unlistenProcessFn) unlistenProcessFn()
      resizeObserver.disconnect()
      term.dispose()
      if (resizeLineRef.current) {
        resizeLineRef.current.removeEventListener("mousedown", handleMouseDown)
      }
    }
  }, [inputMode, hasActiveProcess])

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "calc(100% - 20px)",
        padding: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        ref={terminalRef}
        style={{
          width: "100%",
          height: "100%",
          padding: "0px",
          boxSizing: "border-box",
        }}
      />

      <div
        ref={resizeLineRef}
        style={{
          position: "absolute",
          bottom: "-5px",
          left: 0,
          right: 0,
          height: "10px",
          cursor: "ns-resize",
          backgroundColor: "rgba(255,255,255,0.1)",
          zIndex: 100,
        }}
      />

      {inputMode && (
        <div
          style={{
            position: "absolute",
            bottom: "-25px",
            left: 0,
            right: 0,
            padding: "2px 5px",
            backgroundColor: "#2d2d2d",
            color: "#45fce4",
            fontSize: "12px",
            borderTop: "1px solid #444",
          }}
        >
          Input Mode: Type your input and press Enter to send (ESC to cancel)
        </div>
      )}
    </div>
  )
}

export default XTermTerminal

