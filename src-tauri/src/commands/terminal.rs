use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::{
    io::{Read, Write},
    sync::Arc,
};
use tauri::{
    async_runtime::{spawn, Mutex},
    AppHandle, Emitter, State,
};

pub struct PtyState {
    pub master: Arc<Mutex<Option<Box<dyn portable_pty::MasterPty + Send>>>>,
    pub writer: Arc<Mutex<Option<Box<dyn Write + Send>>>>,
}

#[tauri::command]
pub async fn resize_pty(state: State<'_, PtyState>, rows: u16, cols: u16) -> Result<(), String> {
    if let Some(master) = state.master.lock().await.as_mut() {
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn start_process(state: State<'_, PtyState>, app: AppHandle) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new("powershell.exe");
    
    // Устанавливаем кодировку UTF-8 без хардкода начальной директории
    cmd.args(["-NoExit", "-Command", "chcp 65001"]);
    
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let master = pair.master;
    let mut reader = master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = master.take_writer().map_err(|e| e.to_string())?;

    *state.master.lock().await = Some(master);
    *state.writer.lock().await = Some(writer);

    let app_handle = app.clone();

    spawn(async move {
        let mut buffer = [0u8; 4096];
        loop {
            match reader.read(&mut buffer) {
                Ok(n) if n > 0 => {
                    let output = String::from_utf8_lossy(&buffer[..n]).to_string();
                    println!("Emitting output: {:?}", output);
                    app_handle.emit("pty-output", output).unwrap();
                }
                Ok(_) => {
                    eprintln!("EOF reached");
                    break;
                }
                Err(e) => {
                    eprintln!("Read error: {}", e);
                    break;
                }
            }
        }
    });

    spawn(async move {
        let status = child.wait();
        println!("Child process exited with status: {:?}", status);
    });

    Ok(())
}

#[tauri::command]
pub async fn send_input(state: State<'_, PtyState>, input: String) -> Result<(), String> {
    let mut writer_guard = state.writer.lock().await;
    if let Some(writer) = writer_guard.as_mut() {
        writer
            .write_all(input.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    } else {
        Err("PTY writer not initialized".to_string())
    }
}

#[tauri::command]
pub async fn change_directory(state: State<'_, PtyState>, path: String) -> Result<(), String> {
    let mut writer_guard = state.writer.lock().await;
    if let Some(writer) = writer_guard.as_mut() {
        // Экранируем путь, заключая его в двойные кавычки для правильной обработки пробелов
        let escaped_path = path.replace("/", "\\"); // Заменяем слеши для Windows
        let command = format!("Set-Location \"{}\"\r\n", escaped_path);
        
        writer
            .write_all(command.as_bytes())
            .map_err(|e| format!("Failed to change directory: {}", e))?;
        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    } else {
        Err("PTY writer not initialized".to_string())
    }
}

#[tauri::command]
pub async fn clear_terminal(state: State<'_, PtyState>) -> Result<(), String> {
    let mut writer_guard = state.writer.lock().await;
    if let Some(writer) = writer_guard.as_mut() {
        // Очистка экрана в PowerShell (ANSI escape sequence)
        writer
            .write_all("\x1b[2J\x1b[1;1H".as_bytes()) // Очищает экран и перемещает курсор в начало
            .map_err(|e| format!("Failed to clear terminal: {}", e))?;
        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    } else {
        Err("PTY writer not initialized".to_string())
    }
}

#[tauri::command]
pub async fn kill_process(state: State<'_, PtyState>) -> Result<(), String> {
    let mut writer_guard = state.writer.lock().await;
    if let Some(writer) = writer_guard.as_mut() {
        // Отправляем Ctrl+C для прерывания текущего процесса
        writer
            .write_all(&[0x03]) // 0x03 - код Ctrl+C
            .map_err(|e| format!("Failed to send kill signal: {}", e))?;
        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        
        // Небольшая пауза для обработки Ctrl+C
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        // Отправка Enter для запуска нового приглашения командной строки
        writer
            .write_all(b"\r\n")
            .map_err(|e| format!("Failed to send newline: {}", e))?;
        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        
        Ok(())
    } else {
        Err("PTY writer not initialized".to_string())
    }
}