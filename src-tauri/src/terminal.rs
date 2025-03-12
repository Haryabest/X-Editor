// terminal.rs
use std::process::{Command, Stdio};
use std::path::PathBuf;
use tauri::command;
use encoding_rs::{IBM866, WINDOWS_1251, UTF_8};
use winapi::um::consoleapi::GetConsoleCP;

#[command]
pub fn execute_command(command: String) -> Result<String, String> {
    let mut parts = command.split_whitespace();
    let cmd = parts.next().unwrap_or("");
    let args = parts.collect::<Vec<_>>();

    if cmd == "cd" {
        let path = args.first().map(|s| *s).unwrap_or("~");
        let new_path = if path == "~" {
            dirs::home_dir().ok_or("Home directory not found".to_string())
        } else {
            PathBuf::from(path).canonicalize().map_err(|e| e.to_string())
        }?;

        std::env::set_current_dir(&new_path)
            .map_err(|e| format!("cd error: {}", e))?;
            
        return Ok(String::new());
    }

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("Command execution failed: {}", e))?
    } else {
        Command::new("sh")
            .arg("-c")
            .arg(&command)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("Command execution failed: {}", e))?
    };

    let stdout = decode_with_codepage(&output.stdout);
    let stderr = decode_with_codepage(&output.stderr);
    
    Ok(format!("{}{}", stdout, stderr))
}

#[command]
pub fn get_current_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

fn decode_with_codepage(bytes: &[u8]) -> String {
    if cfg!(target_os = "windows") {
        let codepage = unsafe { GetConsoleCP() };
        let encoding = match codepage {
            65001 => UTF_8,
            866 => IBM866,
            _ => WINDOWS_1251,
        };
        
        let (decoded, _, _) = encoding.decode(bytes);
        decoded.into_owned()
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}