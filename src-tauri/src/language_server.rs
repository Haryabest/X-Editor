use std::process::{Command, Stdio};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;
use ws::{listen, Message};

#[tauri::command]
pub async fn start_language_server(app: tauri::AppHandle) -> Result<(), String> {
    let port = 8080;
    let app_handle = Arc::new(Mutex::new(app));

    // Запускаем typescript-language-server
    let mut child = Command::new("npx")
        .args(&["typescript-language-server", "--stdio"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start language server: {}", e))?;

    let child_stdin = child.stdin.take().unwrap();
    let child_stdout = child.stdout.take().unwrap();

    tokio::spawn(async move {
        listen(format!("127.0.0.1:{}", port), |out| {
            let app_handle = Arc::clone(&app_handle);
            let mut stdin = child_stdin.try_clone().unwrap();
            let mut stdout = child_stdout.try_clone().unwrap();

            let handler = move |msg: Message| {
                if let Ok(text) = msg.as_text() {
                    use std::io::Write;
                    writeln!(&mut stdin, "{}", text).unwrap();
                    stdin.flush().unwrap();

                    let mut buffer = [0; 1024];
                    if let Ok(size) = stdout.read(&mut buffer) {
                        let response = String::from_utf8_lossy(&buffer[..size]);
                        out.send(response.to_string())?;
                    }
                }
                Ok(())
            };

            handler
        }).unwrap();
    });

    println!("Language Server started on ws://127.0.0.1:{}", port);
    Ok(())
}