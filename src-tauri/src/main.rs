// main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Window;
use std::process::Command;
use std::process::Stdio;
use tauri::Manager;

use tauri::command;
mod commands;
mod types;
mod reading;
mod modules;

use std::sync::Arc;
use commands::terminal::PtyState;

// Используем функции из модуля modules.rs
use crate::modules::{
  resolve_module_path, get_project_root, file_exists, 
  get_import_suggestions, get_git_info, tauri_current_dir,
  get_git_branches, switch_git_branch, git_command, get_all_files_in_directory
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

#[command]
fn open_in_explorer(path: String) {
    let path_obj = std::path::Path::new(&path);
    
    // Определяем путь к директории
    let dir_path = if path_obj.is_file() {
        // Если это файл, получаем его родительскую директорию
        path_obj.parent().unwrap_or(path_obj)
    } else {
        // Если это директория, используем как есть
        path_obj
    };
    
    // Логирование пути
    println!("Открытие проводника для директории: {}", dir_path.display());

    if cfg!(target_os = "windows") {
        // Для Windows открываем проводник, указывая директорию
        if let Err(e) = Command::new("explorer")
            .arg(dir_path.to_str().unwrap())
            .spawn() {
            eprintln!("Ошибка при открытии проводника: {}", e);
        } else {
            println!("Проводник успешно открыт на Windows");
        }
    } else if cfg!(target_os = "macos") {
        // Для macOS используем команду 'open'
        if let Err(e) = Command::new("open").arg(dir_path).spawn() {
            eprintln!("Ошибка при открытии проводника: {}", e);
        } else {
            println!("Проводник успешно открыт на macOS");
        }
    } else if cfg!(target_os = "linux") {
        // Для Linux используем команду 'xdg-open'
        if let Err(e) = Command::new("xdg-open").arg(dir_path).spawn() {
            eprintln!("Ошибка при открытии проводника: {}", e);
        } else {
            println!("Проводник успешно открыт на Linux");
        }
    } else {
        eprintln!("Неизвестная операционная система.");
    }
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

#[tauri::command]
fn git_clone_repository(url: String, target_path: String) -> Result<String, String> {
    // Проверяем, существует ли директория
    let target_dir = std::path::Path::new(&target_path);
    if target_dir.exists() {
        return Err(format!("Директория '{}' уже существует", target_path));
    }

    // Создаем родительскую директорию, если она не существует
    if let Some(parent) = target_dir.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Не удалось создать директорию: {}", e))?;
        }
    }

    // Запускаем git clone
    let output = Command::new("git")
        .args(&["clone", &url, &target_path])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Ошибка при запуске git clone: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("Ошибка при клонировании: {}", stderr));
    }

    // Возвращаем успешный результат
    Ok(format!("Репозиторий успешно клонирован в {}", target_path))
}

#[command]
fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[command]
fn delete_folder(path: String) -> Result<(), String> {
    std::fs::remove_dir_all(&path).map_err(|e| e.to_string())
}

#[command]
fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[command]
fn rename_folder(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
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
            open_in_explorer,
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
            toggle_fullscreen,
            git_clone_repository,
            delete_file,
            delete_folder,
            rename_file,
            rename_folder,
            get_all_files_in_directory,
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