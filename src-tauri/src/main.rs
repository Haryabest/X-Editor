#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod terminal;
mod types;
mod reading;

use commands::{window_commands, file_operations};
use terminal::{execute_command, get_current_dir, send_input, has_active_process};
use tauri::Manager;

// New command to get window position
#[tauri::command]
fn get_window_position(window: tauri::Window) -> Result<(i32, i32), String> {
  match window.outer_position() {
      Ok(pos) => Ok((pos.x, pos.y)),
      Err(e) => Err(e.to_string())
  }
}

// New command to get window size
#[tauri::command]
fn get_window_size(window: tauri::Window) -> Result<(u32, u32), String> {
  match window.outer_size() {
      Ok(size) => Ok((size.width, size.height)),
      Err(e) => Err(e.to_string())
  }
}

fn main() {
  tauri::Builder::default()
      .plugin(tauri_plugin_fs::init())
      .plugin(tauri_plugin_dialog::init())
      .invoke_handler(tauri::generate_handler![
          window_commands::close_window,
          window_commands::minimize_window,
          window_commands::toggle_maximize,
          file_operations::create_file,
          file_operations::create_folder,
          types::get_directory_tree,
          types::get_subdirectory,
          reading::read_text_file,
          reading::read_binary_file,
          reading::stream_video,
          execute_command,
          get_current_dir,
          send_input,
          has_active_process,
          get_window_position,
          get_window_size
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

