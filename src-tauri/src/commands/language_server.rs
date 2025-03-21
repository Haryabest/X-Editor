// use std::process::{Command, Stdio};
// use std::io::{self, BufRead, BufReader};
// use tauri::{Emitter, Manager};

// #[tauri::command]
// pub fn file_exists(path: String) -> bool {
//     std::path::Path::new(&path).exists()
// }

// #[tauri::command]
// pub async fn run_command(
//     command: String,
//     args: Vec<String>,
//     cwd: String,
//     window: tauri::Window,
// ) -> Result<(), String> {
//     let mut cmd = Command::new(&command);
//     cmd.args(&args).current_dir(&cwd);

//     // Захватываем stdout и stderr
//     cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

//     let mut child = cmd.spawn().map_err(|e| e.to_string())?;

//     // Чтение stdout в реальном времени
//     let stdout = child.stdout.take().unwrap();
//     let stdout_reader = BufReader::new(stdout);
//     let stdout_handle = tokio::spawn(async move {
//         for line in stdout_reader.lines() {
//             if let Ok(line) = line {
//                 let _ = window.emit("command_output", line);
//             }
//         }
//     });

//     // Чтение stderr в реальном времени
//     let stderr = child.stderr.take().unwrap();
//     let stderr_reader = BufReader::new(stderr);
//     let stderr_handle = tokio::spawn(async move {
//         for line in stderr_reader.lines() {
//             if let Ok(line) = line {
//                 let _ = window.emit("command_error", line);
//             }
//         }
//     });

//     // Ожидание завершения команды
//     let status = child.wait().map_err(|e| e.to_string())?;

//     // Ожидание завершения потоков чтения
//     let _ = stdout_handle.await;
//     let _ = stderr_handle.await;

//     if status.success() {
//         Ok(())
//     } else {
//         Err(format!("Command failed with status: {}", status))
//     }
// }
