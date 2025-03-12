use std::fs;
use std::path::Path;
use tauri::command;

#[command]
pub fn create_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    match fs::File::create(file_path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Ошибка при создании файла: {}", e)),
    }
}

#[command]
pub fn create_folder(path: String) -> Result<(), String> {
    let folder_path = Path::new(&path);
    if folder_path.exists() {
        return Err("Папка уже существует".to_string());
    }
    match fs::create_dir_all(folder_path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Ошибка при создании папки: {}", e)),
    }
}
