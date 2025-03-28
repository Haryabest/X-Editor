// main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{command};
use std::process::Command;

mod commands;
mod types;
mod reading;

use tauri::Manager;
use std::sync::Arc;
use commands::terminal::PtyState;

#[command]
fn spawn_new_process() -> Result<(), String> {
    // Замените "my-app" на имя вашего бинарника (из tauri.conf.json -> package -> productName)
    let mut cmd = Command::new("xeditor")
        .spawn()
        .map_err(|e| e.to_string())?;

    println!("Spawned new process with PID: {}", cmd.id());
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
            spawn_new_process,
            commands::window_commands::close_window,
            commands::window_commands::minimize_window,
            commands::window_commands::toggle_maximize,
            commands::file_operations::create_file,
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
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

