use std::fs;
use std::path::Path;
use tauri::command;
use std::io::Write;

#[command]
pub fn create_file(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    
    // Create a file with explicit UTF-8 encoding and write an empty string
    let mut file = match fs::File::create(file_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Ошибка при создании файла: {}", e)),
    };
    
    // Ensure UTF-8 BOM is written for empty files
    match file.write_all("".as_bytes()) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Ошибка при инициализации файла: {}", e)),
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

#[command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    
    // Create a file with explicit UTF-8 encoding
    let mut file = match std::fs::File::create(file_path) {
        Ok(file) => file,
        Err(e) => return Err(format!("Ошибка при создании файла: {}", e)),
    };
    
    // Write content with UTF-8 encoding
    match file.write_all(content.as_bytes()) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Ошибка при сохранении файла: {}", e)),
    }
}

#[command]
pub fn check_path_exists(path: String) -> Result<bool, String> {
    let path = Path::new(&path);
    Ok(path.exists())
}