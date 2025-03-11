#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri;
use commands::window_commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            window_commands::close_window,
            window_commands::minimize_window,
            window_commands::toggle_maximize
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}