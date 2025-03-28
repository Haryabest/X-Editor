// main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{command};
use std::process::Command;

mod commands;
mod types;
mod reading;
mod modules;

use tauri::Manager;
use std::sync::Arc;
use commands::terminal::PtyState;

#[tauri::command]
fn get_args() -> Vec<String> {
    std::env::args().collect()
}

#[tauri::command]
fn close_current_window() {
    // Увеличиваем задержку до 1 секунды
    std::thread::sleep(std::time::Duration::from_secs(1));
    std::process::exit(0);
}


#[tauri::command]
fn create_new_file1(path: String) -> Result<(), String> {
    std::fs::File::create(&path)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn new_folder(path: String) -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?;
    
    // Добавляем флаг для Windows
    #[cfg(target_os = "windows")]
    let status = Command::new("cmd")
        .args(&["/C", "start", "xeditor", "--path", &path])
        .status()
        .map_err(|e| e.to_string())?;
    
    #[cfg(not(target_os = "windows"))]
    let status = Command::new(exe)
        .arg("--path")
        .arg(path)
        .status()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn spawn_new_process(path: String) -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|e| e.to_string())?;
    
    Command::new(exe)
        .arg("--path")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(PtyState {
            master: Arc::new(tauri::async_runtime::Mutex::new(None)),
            writer: Arc::new(tauri::async_runtime::Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            get_args,
            new_folder,
            create_new_file1,
            spawn_new_process,
            close_current_window,
            commands::window_commands::close_window,
            commands::window_commands::minimize_window,
            commands::window_commands::toggle_maximize,
            commands::file_operations::create_folder,
            commands::file_operations::save_file,
            commands::file_operations::check_path_exists,
            types::get_directory_tree,
            types::get_subdirectory,
            reading::read_text_file,
            reading::read_binary_file,
            reading::stream_video,
            commands::terminal::start_process,
            commands::terminal::send_input,
            commands::terminal::resize_pty,
            modules::resolve_module_path,
            modules::get_project_root,
            modules::file_exists
        ])
        .setup(|app| {
            let args = std::env::args().collect::<Vec<String>>();
            if let Some(path) = args.iter().skip(1).find(|arg| !arg.starts_with('-')) {
                println!("Opening folder: {}", path);
            }
            
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            Ok::<(), Box<dyn std::error::Error>>(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}