#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod terminal; // Подключаем модуль терминала

use commands::{window_commands, file_operations}; // Импортируем подмодули
use terminal::execute_command; // Функция выполнения команд в терминале

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init()) // Подключаем файловую систему
        .plugin(tauri_plugin_dialog::init()) // Подключаем диалоговые окна
        .invoke_handler(tauri::generate_handler![
            window_commands::close_window,
            window_commands::minimize_window,
            window_commands::toggle_maximize,
            file_operations::create_file, // Добавляем обработчик для создания файлов
            file_operations::create_folder, // Добавляем обработчик для создания файлов
            execute_command // Добавляем терминал
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
