use base64::{engine::general_purpose, Engine as _};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::command;

// Функция для определения MIME-типа по расширению файла
fn get_mime_type(path: &Path) -> String {
    let extension = match path.extension() {
        Some(ext) => ext.to_string_lossy().to_lowercase(),
        None => return "application/octet-stream".to_string(),
    };
    
    match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "tiff" | "tif" => "image/tiff",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "mkv" => "video/x-matroska",
        _ => "application/octet-stream",
    }.to_string()
}

// Функция для конвертации пути в URL
#[command]
pub fn convert_path_to_url(path: &str) -> Result<String, String> {
    println!("Rust: convert_path_to_url called with path: {}", path);
    
    // Нормализуем путь (исправляем слеши для Windows)
    let normalized_path = path.replace('\\', "/");
    println!("Rust: Normalized path: {}", normalized_path);
    
    // Создаем PathBuf для файловых операций
    let path_buf = PathBuf::from(&normalized_path);
    
    // Проверяем существование файла
    if !path_buf.exists() {
        let error_msg = format!("Файл не найден: {}", normalized_path);
        println!("Rust: Error - {}", error_msg);
        return Err(error_msg);
    }
    
    // Формируем URL в формате file://
    let file_url = format!("file://{}", normalized_path);
    println!("Rust: File URL created: {}", file_url);
    
    Ok(file_url)
}

// Функция для конвертации пути в URL с протоколом asset
#[command]
pub fn convert_to_asset_url(path: &str) -> Result<String, String> {
    println!("Rust: convert_to_asset_url called with path: {}", path);
    
    // Нормализуем путь (исправляем слеши для Windows)
    let normalized_path = path.replace('\\', "/");
    println!("Rust: Normalized path: {}", normalized_path);
    
    // Создаем PathBuf для файловых операций
    let path_buf = std::path::PathBuf::from(&normalized_path);
    
    // Проверяем существование файла
    if !path_buf.exists() {
        let error_msg = format!("Файл не найден: {}", normalized_path);
        println!("Rust: Error - {}", error_msg);
        return Err(error_msg);
    }
    
    // Создаем asset URL (это абсолютный путь с протоколом asset://)
    // В Tauri протокол asset:// обычно используется для безопасного доступа к файлам
    let asset_url = format!("asset://{}", normalized_path);
    println!("Rust: Asset URL created: {}", asset_url);
    
    Ok(asset_url)
}

#[command]
pub fn load_image_as_base64(path: &str) -> Result<String, String> {
    println!("Rust: load_image_as_base64 called with path: {}", path);
    
    // Нормализуем путь (исправляем слеши для Windows)
    let normalized_path = path.replace('\\', "/");
    println!("Rust: Normalized path: {}", normalized_path);
    
    // Создаем PathBuf для файловых операций
    let path_buf = PathBuf::from(&normalized_path);
    
    // Проверяем существование файла
    if !path_buf.exists() {
        let error_msg = format!("Файл не найден: {}", normalized_path);
        println!("Rust: Error - {}", error_msg);
        return Err(error_msg);
    }
    
    // Определяем MIME-тип файла
    let mime_type = get_mime_type(&path_buf);
    
    // Читаем файл в буфер
    let mut file = match File::open(&path_buf) {
        Ok(f) => f,
        Err(e) => {
            let error_msg = format!("Ошибка при открытии файла: {}", e);
            println!("Rust: Error - {}", error_msg);
            return Err(error_msg);
        }
    };
    
    let mut buffer = Vec::new();
    if let Err(e) = file.read_to_end(&mut buffer) {
        let error_msg = format!("Ошибка при чтении файла: {}", e);
        println!("Rust: Error - {}", error_msg);
        return Err(error_msg);
    }
    
    if buffer.is_empty() {
        let error_msg = "Файл пуст".to_string();
        println!("Rust: Error - {}", error_msg);
        return Err(error_msg);
    }
    
    println!("Rust: Successfully read {} bytes", buffer.len());
    
    // Кодируем в base64
    let base64_encoded = general_purpose::STANDARD.encode(&buffer);
    println!("Rust: Successfully encoded to base64, length: {}", base64_encoded.len());
    
    // Формируем data URL
    let data_url = format!("data:{};base64,{}", mime_type, base64_encoded);
    println!("Rust: Data URL created, total length: {}", data_url.len());
    
    // Проверяем начало data URL (для диагностики)
    if data_url.len() > 50 {
        println!("Rust: Data URL starts with: {}", &data_url[0..50]);
    }
    
    Ok(data_url)
}

// Функция для получения временной директории
#[command]
pub fn get_temp_dir() -> Result<String, String> {
    println!("Rust: get_temp_dir called");
    
    let temp_dir = match std::env::temp_dir().to_str() {
        Some(dir) => dir.to_string(),
        None => {
            let error_msg = "Не удалось получить путь к временной директории".to_string();
            println!("Rust: Error - {}", error_msg);
            return Err(error_msg);
        }
    };
    
    println!("Rust: Temp directory: {}", temp_dir);
    Ok(temp_dir)
}

// Функция для записи текстового файла
#[command]
pub fn write_text_file(path: &str, content: &str) -> Result<(), String> {
    println!("Rust: write_text_file called with path: {}", path);
    
    // Нормализуем путь
    let normalized_path = path.replace('\\', "/");
    println!("Rust: Normalized path: {}", normalized_path);
    
    // Создаем папку, если не существует
    let path_buf = PathBuf::from(&normalized_path);
    if let Some(parent) = path_buf.parent() {
        if !parent.exists() {
            if let Err(e) = std::fs::create_dir_all(parent) {
                let error_msg = format!("Ошибка при создании директории: {}", e);
                println!("Rust: Error - {}", error_msg);
                return Err(error_msg);
            }
        }
    }
    
    // Записываем файл
    let mut file = match File::create(&path_buf) {
        Ok(f) => f,
        Err(e) => {
            let error_msg = format!("Ошибка при создании файла: {}", e);
            println!("Rust: Error - {}", error_msg);
            return Err(error_msg);
        }
    };
    
    if let Err(e) = file.write_all(content.as_bytes()) {
        let error_msg = format!("Ошибка при записи в файл: {}", e);
        println!("Rust: Error - {}", error_msg);
        return Err(error_msg);
    }
    
    println!("Rust: Successfully wrote {} bytes to file", content.len());
    Ok(())
}

// Функция для открытия файла во внешней программе
#[command]
pub fn open_file(path: &str) -> Result<(), String> {
    println!("Rust: open_file called with path: {}", path);
    
    // Нормализуем путь
    let normalized_path = path.replace('\\', "/");
    println!("Rust: Normalized path: {}", normalized_path);
    
    // Проверяем существование файла
    let path_buf = PathBuf::from(&normalized_path);
    if !path_buf.exists() {
        let error_msg = format!("Файл не найден: {}", normalized_path);
        println!("Rust: Error - {}", error_msg);
        return Err(error_msg);
    }
    
    // Открываем файл с помощью системного обработчика
    match open::that(&normalized_path) {
        Ok(_) => {
            println!("Rust: Successfully opened file with system handler");
            Ok(())
        },
        Err(e) => {
            let error_msg = format!("Ошибка при открытии файла: {}", e);
            println!("Rust: Error - {}", error_msg);
            Err(error_msg)
        }
    }
} 