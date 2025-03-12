#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod terminal;  // Подключаем модуль terminal

use tauri;
use commands::window_commands;
use terminal::execute_command; // Импортируем функцию execute_command из terminal.rs

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            window_commands::close_window,
            window_commands::minimize_window,
            window_commands::toggle_maximize,
            execute_command // Добавляем команду для выполнения команд в терминале
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
