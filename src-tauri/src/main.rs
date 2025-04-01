// main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Window};
use std::process::Command;

mod commands;
mod types;
mod reading;
mod modules;

use tauri::Manager;
use std::sync::Arc;
use commands::terminal::PtyState;

// Используем функции из модуля modules.rs
use crate::modules::{
  resolve_module_path, get_project_root, file_exists, 
  get_import_suggestions, get_git_info, tauri_current_dir,
  get_git_branches, switch_git_branch, git_command
};

#[tauri::command]
fn get_args() -> Vec<String> {
    std::env::args().collect()
}
#[tauri::command]
fn new_folder(path: String) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(&["/C", "start", "", exe.to_str().unwrap(), "--path", &path, "--no-devtools"])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        Command::new(exe)
            .arg("--path")
            .arg(path)
            .arg("--no-devtools")
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn close_current_window(window: Window) {
    window.close().unwrap();
}

#[tauri::command]
fn create_new_file1(path: String) -> Result<(), String> {
    std::fs::File::create(&path)
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

#[tauri::command]
fn toggle_fullscreen(window: tauri::Window) {
    if let Ok(is_fullscreen) = window.is_fullscreen() {
        // Переключаем состояние полноэкранного режима
        if let Err(err) = window.set_fullscreen(!is_fullscreen) {
            eprintln!("Ошибка при переключении полноэкранного режима: {:?}", err);
        }
    }
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
            commands::terminal::change_directory,
            resolve_module_path,
            get_project_root,
            file_exists,
            get_import_suggestions,
            get_git_info,
            tauri_current_dir,
            get_git_branches,
            switch_git_branch,
            git_command,
            toggle_fullscreen
        ])
        .setup(|app| {
            let args = std::env::args().collect::<Vec<String>>();
            
            // Открываем devtools только если нет флага --no-devtools
            #[cfg(debug_assertions)]
            if !args.contains(&"--no-devtools".to_string()) {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}