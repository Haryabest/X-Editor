import { WebSocketServer } from "ws"
import { spawn } from "child_process"

// Start TypeScript Language Server process
const serverProcess = spawn("npx", ["typescript-language-server", "--stdio"], {
  shell: true,
  stdio: ["pipe", "pipe", "pipe"],
})

// Logging for serverProcess
serverProcess.stdout.on("data", (data) => {
  console.log("TypeScript Language Server stdout:", data.toString())
})

serverProcess.stderr.on("data", (data) => {
  console.error("TypeScript Language Server stderr:", data.toString())
})

serverProcess.on("close", (code) => {
  console.log(`TypeScript Language Server process exited with code ${code}`)
})

// Create WebSocket server
const wss = new WebSocketServer({ port: 3000 })

wss.on("connection", (ws) => {
  console.log("WebSocket connection established")

  ws.on("message", (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString())
      console.log("Received message from client:", JSON.stringify(parsedMessage, null, 2))

      // Forward message to TypeScript Language Server
      const messageString = JSON.stringify(parsedMessage) + "\r\n"
      serverProcess.stdin.write(messageString)
    } catch (error) {
      console.error("Error processing message:", error)
    }
  })

  // Forward TypeScript Language Server responses to client
  const responseHandler = (data) => {
    try {
      const messages = data.toString().split("\r\n").filter(Boolean)

      for (const message of messages) {
        try {
          const parsedMessage = JSON.parse(message)
          console.log("Sending message to client:", JSON.stringify(parsedMessage, null, 2))

          // Only send if the connection is still open
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify(parsedMessage))
          }
        } catch (error) {
          console.error("Error parsing server message:", error, message)
        }
      }
    } catch (error) {
      console.error("Error processing server response:", error)
    }
  }

  serverProcess.stdout.on("data", responseHandler)

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
  })

  ws.on("close", () => {
    console.log("WebSocket connection closed")
    // Remove the response handler when the connection is closed
    serverProcess.stdout.removeListener("data", responseHandler)
  })
})

// Handle server shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...")
  serverProcess.kill()
  wss.close()
  process.exit(0)
})

console.log("WebSocket server is running on ws://localhost:3000")

