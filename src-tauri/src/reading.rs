use std::path::Path;
use tauri::AppHandle;

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    // Проверяем, существует ли файл
    let path = Path::new(&path);
    if !path.exists() {
        return Err(format!("Файл '{}' не существует", path.display()));
    }
    
    // Читаем файл с явным указанием UTF-8 кодировки
    let content = std::fs::read(path)
        .map_err(|err| format!("Не удалось открыть файл: {}", err))?;
    
    // Декодируем содержимое как UTF-8
    String::from_utf8(content)
        .map_err(|err| format!("Файл содержит некорректные UTF-8 символы: {}", err))
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    match std::fs::read(path) {
        Ok(data) => Ok(data),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn stream_video(_app: AppHandle, path: String) -> Result<String, String> {
    // Проверяем существование файла
    let video_path = Path::new(&path);
    if !video_path.exists() {
        return Err(format!("Видео файл не найден: {}", path));
    }
    
    // Для стриминга видео мы просто возвращаем путь, так как мы будем использовать HTML5 video element
    // для просмотра видео из локального файла
    Ok(path)
}
