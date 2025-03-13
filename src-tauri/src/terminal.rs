use std::process::{Command, Stdio};
use std::path::{PathBuf, Path};
use tauri::command;
use encoding_rs::{IBM866, WINDOWS_1251, UTF_8};
use winapi::um::consoleapi::GetConsoleOutputCP;
use dunce;

#[command]
pub fn execute_command(command: String) -> Result<String, String> {
    let mut parts = command.split_whitespace();
    let cmd = parts.next().unwrap_or("");

    if cmd == "cd" {
        let path = parts.next().unwrap_or("~");
        let current_dir = std::env::current_dir()
            .map_err(|e| format!("Current directory error: {}", e))?;

        let new_path = if path == "~" {
            dirs::home_dir().ok_or("Home directory not found")?
        } else {
            let path = Path::new(path);
            if path.is_absolute() {
                path.to_path_buf()
            } else {
                current_dir.join(path)
            }
        };

        let canonical_path = dunce::canonicalize(&new_path)
            .map_err(|e| format!("Path error: {}", e))?;

        std::env::set_current_dir(&canonical_path)
            .map_err(|e| format!("cd error: {}", e))?;

        return Ok(clean_unc_path(canonical_path));
    }

    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
    } else {
        Command::new("sh")
            .arg("-c")
            .arg(&command)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
    }.map_err(|e| format!("Command execution failed: {}", e))?;

    let stdout = decode_with_codepage(&output.stdout);
    let stderr = decode_with_codepage(&output.stderr);

    Ok(format!("{}{}", stdout, stderr))
}

fn clean_unc_path(path: PathBuf) -> String {
    dunce::simplified(&path)
        .to_string_lossy()
        .replace(r"\\?\", "")
        .replace(r"\\.\", "")
        .replace("\\\\?\\", "")
        .replace(r"\\?\UNC\", "\\")
        .replace('/', "\\")
        .trim_start_matches("\\\\")
        .to_string()
}

fn decode_with_codepage(bytes: &[u8]) -> String {
    let codepage = unsafe { GetConsoleOutputCP() };
    let encoding = match codepage {
        65001 => UTF_8,
        866 => IBM866,
        1251 => WINDOWS_1251,
        _ => WINDOWS_1251,
    };

    let (text, _, _) = encoding.decode(bytes);
    text.into_owned()
}

#[command]
pub fn get_current_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| clean_unc_path(dunce::canonicalize(p.clone()).unwrap_or(p)))
        .map_err(|e| e.to_string())
}
