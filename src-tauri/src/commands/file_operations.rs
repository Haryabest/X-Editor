use std::fs;
use std::path::Path;
use tauri::command;
use std::io::Write;

#[command]
pub fn create_file(path: String) -> Result<(), String> {
    println!("Attempting to create file at: {}", path);
    let file_path = Path::new(&path);
    
    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            println!("Parent directory doesn't exist, creating: {}", parent.display());
            fs::create_dir_all(parent).map_err(|e| {
                format!("Failed to create parent directory: {}", e)
            })?;
        }
    }
    
    // Create a file with explicit UTF-8 encoding and write an empty string
    let mut file = match fs::File::create(file_path) {
        Ok(file) => {
            println!("File created successfully: {}", path);
            file
        },
        Err(e) => {
            let error_msg = format!("Ошибка при создании файла: {} (path: {})", e, path);
            println!("{}", error_msg);
            return Err(error_msg);
        },
    };
    
    // Ensure UTF-8 BOM is written for empty files
    match file.write_all("".as_bytes()) {
        Ok(_) => {
            println!("File initialized with empty content: {}", path);
            Ok(())
        },
        Err(e) => {
            let error_msg = format!("Ошибка при инициализации файла: {} (path: {})", e, path);
            println!("{}", error_msg);
            Err(error_msg)
        },
    }
}

#[command]
pub fn create_folder(path: String) -> Result<(), String> {
    println!("Attempting to create folder at: {}", path);
    let folder_path = Path::new(&path);
    
    if folder_path.exists() {
        let error_msg = format!("Папка уже существует: {}", path);
        println!("{}", error_msg);
        return Err(error_msg);
    }
    
    match fs::create_dir_all(folder_path) {
        Ok(_) => {
            println!("Folder created successfully: {}", path);
            Ok(())
        },
        Err(e) => {
            let error_msg = format!("Ошибка при создании папки: {} (path: {})", e, path);
            println!("{}", error_msg);
            Err(error_msg)
        },
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
pub fn check_path_exists(path: String, check_type: Option<String>) -> Result<bool, String> {
    let path = Path::new(&path);
    
    match check_type.as_deref() {
        Some("directory") => Ok(path.exists() && path.is_dir()),
        Some("file") => Ok(path.exists() && path.is_file()),
        Some(invalid_type) => Err(format!("Invalid check type: {}", invalid_type)),
        None => Ok(path.exists())
    }
}