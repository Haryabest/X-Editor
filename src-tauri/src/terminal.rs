use std::path::{Path, PathBuf};
use std::sync::{Mutex, atomic::{AtomicPtr, Ordering}};
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::{command, Emitter, Window};
use encoding_rs::{IBM866, WINDOWS_1251, UTF_8};
use winapi::um::consoleapi::{GetConsoleOutputCP, ClosePseudoConsole};
use winapi::um::processthreadsapi::{
    InitializeProcThreadAttributeList,
    UpdateProcThreadAttribute
};
use winapi::um::handleapi::{CloseHandle, INVALID_HANDLE_VALUE};
use winapi::um::winbase::STARTUPINFOEXW;
use winapi::um::minwinbase::STILL_ACTIVE;
use winapi::shared::minwindef::{TRUE, FALSE};
use std::ffi::OsStr;
use dunce;
use std::ffi::c_void;
use std::os::windows::ffi::OsStrExt;
use std::io::Read;
#[cfg(target_os = "windows")]
static CURRENT_PROCESS: Mutex<Option<usize>> = Mutex::new(None);
#[cfg(target_os = "windows")]
static CONSOLE_HANDLE: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

const PSEUDOCONSOLE_CREATION_FLAGS_INHERIT_CURSOR: u32 = 0x00000001;
const PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE: usize = 0x00020016;

#[command]
pub fn has_active_process() -> bool {
    #[cfg(target_os = "windows")]
    {
        CURRENT_PROCESS.lock().unwrap().is_some()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[command]
pub fn execute_command(window: Window, command: String, realtime: Option<bool>) -> Result<String, String> {
    let mut parts = command.split_whitespace();
    let cmd = parts.next().unwrap_or("");

    if cmd == "cd" {
        return handle_cd_command(parts.next().unwrap_or("~"));
    }

    let should_stream = realtime.unwrap_or(false);

    #[cfg(target_os = "windows")]
    if should_stream {
        return execute_with_pty(window, command);
    }

    handle_regular_command(command, should_stream, window)
}

fn handle_cd_command(path: &str) -> Result<String, String> {
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

    Ok(clean_unc_path(canonical_path))
}

fn handle_regular_command(command: String, should_stream: bool, window: Window) -> Result<String, String> {
    let mut process_builder = if cfg!(target_os = "windows") {
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", &command])
            .current_dir(std::env::current_dir().unwrap())
            .env("PATH", get_extended_path())
            .env_remove("ELECTRON_RUN_AS_NODE");
        cmd
    } else {
        let mut sh = std::process::Command::new("sh");
        sh.arg("-c")
            .arg(&command)
            .current_dir(std::env::current_dir().unwrap())
            .env("PATH", get_extended_path());
        sh
    };

    process_builder.stdout(std::process::Stdio::piped());
    process_builder.stderr(std::process::Stdio::piped());
    process_builder.stdin(std::process::Stdio::piped());

    let process = process_builder.spawn()
        .map_err(|e| format!("Command execution failed: {}", e))?;

    if should_stream {
        handle_streaming_process(process, window)
    } else {
        handle_blocking_process(process)
    }
}

fn handle_streaming_process(mut process: std::process::Child, window: Window) -> Result<String, String> {
    let stdout = process.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = process.stderr.take().ok_or("Failed to capture stderr")?;

    let mut proc_guard = CURRENT_PROCESS.lock().unwrap();
    *proc_guard = Some(Box::into_raw(Box::new(process)) as usize);
    drop(proc_guard);

    window.emit("process-state", serde_json::json!({ "active": true }))
        .map_err(|e| e.to_string())?;

    spawn_output_handler(stdout, window.clone(), false);
    spawn_output_handler(stderr, window.clone(), true);

    Ok(String::new())
}

fn spawn_output_handler<T: Read + Send + 'static>(stream: T, window: Window, is_error: bool) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stream);
        let mut buffer = [0u8; 1024];
        loop {
            let bytes_read = match reader.read(&mut buffer) {
                Ok(0) => break, // EOF
                Ok(n) => n,
                Err(e) => {
                    eprintln!("Error reading stream: {}", e);
                    break;
                }
            };
            let decoded = decode_with_codepage(&buffer[..bytes_read]);
            let output = if is_error {
                format!("\x1b[31m{}\x1b[0m", decoded)
            } else {
                decoded
            };
            let _ = window.emit("terminal-output", output);
        }
    });
}

fn handle_blocking_process(process: std::process::Child) -> Result<String, String> {
    let output = process.wait_with_output()
        .map_err(|e| format!("Failed to wait for process: {}", e))?;

    let stdout = decode_with_codepage(&output.stdout);
    let stderr = decode_with_codepage(&output.stderr);
    Ok(format!("{}{}", stdout, stderr))
}

#[cfg(target_os = "windows")]
fn execute_with_pty(window: Window, command: String) -> Result<String, String> {
    use std::mem::{size_of, zeroed};
    use winapi::um::{namedpipeapi::CreatePipe, handleapi::SetHandleInformation, winbase::HANDLE_FLAG_INHERIT};
    use winapi::um::wincontypes::HPCON;
    use winapi::um::wincon::COORD;

    unsafe {
        let mut stdin_read = INVALID_HANDLE_VALUE;
        let mut stdin_write = INVALID_HANDLE_VALUE;
        let mut stdout_read = INVALID_HANDLE_VALUE;
        let mut stdout_write = INVALID_HANDLE_VALUE;

        let mut sa = zeroed::<winapi::um::minwinbase::SECURITY_ATTRIBUTES>();
        sa.nLength = size_of::<winapi::um::minwinbase::SECURITY_ATTRIBUTES>() as u32;
        sa.bInheritHandle = TRUE;

        if CreatePipe(&mut stdin_read, &mut stdin_write, &mut sa, 0) == 0 ||
           CreatePipe(&mut stdout_read, &mut stdout_write, &mut sa, 0) == 0 {
            return Err("Failed to create pipes".into());
        }

        SetHandleInformation(stdin_write, HANDLE_FLAG_INHERIT, 0);
        SetHandleInformation(stdout_read, HANDLE_FLAG_INHERIT, 0);

        let mut console_handle = std::ptr::null_mut();
        let coord = COORD { X: 80, Y: 30 };

        let result = winapi::um::consoleapi::CreatePseudoConsole(
            coord,
            stdin_read,
            stdout_write,
            PSEUDOCONSOLE_CREATION_FLAGS_INHERIT_CURSOR,
            &mut console_handle
        );

        if result != 0 {
            cleanup_handles(console_handle, stdin_read, stdin_write, stdout_read, stdout_write);
            return Err(format!("Failed to create pseudo console: {}", result));
        }

        CONSOLE_HANDLE.store(console_handle, Ordering::SeqCst);

        let mut size = 0;
        InitializeProcThreadAttributeList(std::ptr::null_mut(), 1, 0, &mut size);
        let mut attr_list = vec![0u8; size];
        let attr_list_ptr = attr_list.as_mut_ptr() as *mut _;

        if InitializeProcThreadAttributeList(attr_list_ptr, 1, 0, &mut size) == 0 {
            cleanup_handles(console_handle, stdin_read, stdin_write, stdout_read, stdout_write);
            return Err("Failed to initialize attribute list".into());
        }

        if UpdateProcThreadAttribute(
            attr_list_ptr,
            0,
            PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
            console_handle as *mut _,
            size_of::<HPCON>(),
            std::ptr::null_mut(),
            std::ptr::null_mut()
        ) == 0 {
            cleanup_handles(console_handle, stdin_read, stdin_write, stdout_read, stdout_write);
            return Err("Failed to update attribute list".into());
        }

        let mut startup_info: STARTUPINFOEXW = zeroed();
        startup_info.StartupInfo.cb = size_of::<STARTUPINFOEXW>() as u32;
        startup_info.lpAttributeList = attr_list_ptr;

        let mut process_info = zeroed::<winapi::um::processthreadsapi::PROCESS_INFORMATION>();

        let cmd_str = format!("cmd.exe /C {}", command);
        let mut cmd_wide: Vec<u16> = OsStr::new(&cmd_str).encode_wide().chain(Some(0)).collect();

        let success = winapi::um::processthreadsapi::CreateProcessW(
            std::ptr::null(),
            cmd_wide.as_mut_ptr(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            FALSE,
            winapi::um::winbase::EXTENDED_STARTUPINFO_PRESENT,
            std::ptr::null_mut(),
            std::ptr::null(),
            &mut startup_info.StartupInfo,
            &mut process_info
        );

        if success == 0 {
            cleanup_handles(console_handle, stdin_read, stdin_write, stdout_read, stdout_write);
            return Err("Failed to create process".into());
        }

        let mut proc_guard = CURRENT_PROCESS.lock().unwrap();
        *proc_guard = Some(process_info.hProcess as usize);
        CloseHandle(process_info.hThread);

        let stdout_read_usize = stdout_read as usize;
        let console_handle_usize = console_handle as usize;

        let window_for_output = window.clone();
        let window_for_monitor = window.clone();

        thread::spawn(move || {
            read_pipe_output(stdout_read_usize, window_for_output);
        });

        thread::spawn(move || {
            monitor_process(console_handle_usize, window_for_monitor);
        });

        Ok(String::new())
    }
}

#[cfg(target_os = "windows")]
unsafe fn cleanup_handles(
    console: winapi::um::wincontypes::HPCON,
    stdin_read: winapi::shared::ntdef::HANDLE,
    stdin_write: winapi::shared::ntdef::HANDLE,
    stdout_read: winapi::shared::ntdef::HANDLE,
    stdout_write: winapi::shared::ntdef::HANDLE,
) {
    if !console.is_null() {
        ClosePseudoConsole(console);
    }
    if stdin_read != INVALID_HANDLE_VALUE {
        CloseHandle(stdin_read);
    }
    if stdin_write != INVALID_HANDLE_VALUE {
        CloseHandle(stdin_write);
    }
    if stdout_read != INVALID_HANDLE_VALUE {
        CloseHandle(stdout_read);
    }
    if stdout_write != INVALID_HANDLE_VALUE {
        CloseHandle(stdout_write);
    }
}

#[cfg(target_os = "windows")]
unsafe fn read_pipe_output(pipe: usize, window: Window) {
    let pipe_handle = pipe as winapi::shared::ntdef::HANDLE;
    let mut buffer = [0u8; 4096];
    
    loop {
        let mut bytes_read = 0;
        let success = winapi::um::fileapi::ReadFile(
            pipe_handle,
            buffer.as_mut_ptr() as *mut _,
            buffer.len() as u32,
            &mut bytes_read,
            std::ptr::null_mut()
        );
        
        if success == 0 {
            let error = std::io::Error::last_os_error();
            if error.raw_os_error() != Some(winapi::shared::winerror::ERROR_BROKEN_PIPE as i32) {
                eprintln!("Read error: {}", error);
            }
            break;
        }
        
        let decoded = decode_with_codepage(&buffer[..bytes_read as usize]);
        let _ = window.emit("terminal-output", decoded.replace("\n", "\r\n"));
    }
    
    CloseHandle(pipe_handle);
}

#[cfg(target_os = "windows")]
fn monitor_process(console: usize, window: Window) {
    let console_handle = console as winapi::um::wincontypes::HPCON;
    
    loop {
        thread::sleep(std::time::Duration::from_millis(500));
        
        let proc_guard = CURRENT_PROCESS.lock().unwrap();
        if let Some(handle) = *proc_guard {
            let handle_ptr = handle as winapi::shared::ntdef::HANDLE;
            let mut exit_code = 0;
            let success = unsafe {
                winapi::um::processthreadsapi::GetExitCodeProcess(
                    handle_ptr,
                    &mut exit_code
                )
            };
            
            if success != 0 && exit_code != STILL_ACTIVE {
                unsafe {
                    CloseHandle(handle_ptr);
                    ClosePseudoConsole(console_handle);
                }
                let _ = window.emit("process-state", serde_json::json!({ "active": false }));
                break;
            }
        } else {
            break;
        }
    }
}

#[command]
pub fn send_input(input: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winapi::um::fileapi::WriteFile;
        use std::os::windows::io::AsRawHandle;

        let proc_guard = CURRENT_PROCESS.lock().unwrap();
        if let Some(handle) = *proc_guard {
            let handle = handle as winapi::shared::ntdef::HANDLE;
            let mut bytes_written = 0;
            let input_bytes = input + "\r";
            
            let success = unsafe {
                WriteFile(
                    handle,
                    input_bytes.as_ptr() as *const _,
                    input_bytes.len() as u32,
                    &mut bytes_written,
                    std::ptr::null_mut()
                )
            };

            if success == 0 {
                let error = std::io::Error::last_os_error();
                return Err(format!("Write error: {}", error));
            }
            return Ok(());
        }
    }
    Err("No active process to send input to".into())
}

fn get_extended_path() -> String {
    let mut paths = vec![std::env::var("PATH").unwrap_or_default()];
    
    if cfg!(target_os = "windows") {
        if let Some(home) = dirs::home_dir() {
            paths.push(format!("{}\\AppData\\Roaming\\npm", home.display()));
            paths.push("C:\\Program Files\\nodejs".into());
        }
    } else {
        paths.extend(["/usr/local/bin", "/usr/bin", "/bin"]
            .iter()
            .map(|s| s.to_string()));
        if let Some(home) = dirs::home_dir() {
            paths.push(format!("{}/.nvm/versions/node/*/bin", home.display()));
        }
    }
    
    paths.join(if cfg!(windows) { ";" } else { ":" })
}

fn clean_unc_path(path: PathBuf) -> String {
    dunce::simplified(&path)
        .to_string_lossy()
        .replace(r"\\?\", "")
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
    encoding.decode(bytes).0.into_owned()
}

#[command]
pub fn get_current_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| clean_unc_path(dunce::canonicalize(p.clone()).unwrap_or(p)))
        .map_err(|e| e.to_string())
}