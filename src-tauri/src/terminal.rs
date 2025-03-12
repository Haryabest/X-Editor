use std::process::{Command, Stdio};
use tauri::command;

#[command]
pub fn execute_command(command: String) -> Result<String, String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command]) // Выполняем команду через cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
    } else {
        Command::new("sh")
            .arg("-c")
            .arg(&command) // Для Linux/macOS используем sh
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
    };

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Ok(format!("{}{}", stdout, stderr))
        }
        Err(e) => Err(format!("Ошибка выполнения: {}", e)),
    }
}
