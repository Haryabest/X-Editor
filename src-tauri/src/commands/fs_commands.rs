use std::path::{Path, PathBuf};
use std::fs;
use tauri::command;
use walkdir::WalkDir;

/// Структура для результата списка файлов
#[derive(serde::Serialize)]
pub struct DirEntry {
    #[serde(rename = "path")]
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
}

/// Получает корень проекта на основе текущего пути
#[command]
pub fn fs_get_project_root(_current_file_path: &str) -> String {
    let current_dir = std::env::current_dir().unwrap_or_default();
    current_dir.to_string_lossy().to_string()
}

/// Проверяет существование файла или директории
#[command]
pub fn fs_file_exists(file_path: &str) -> bool {
    Path::new(file_path).exists()
}

/// Получает список файлов и директорий для указанного пути
#[command]
pub fn list_dir(path: &str) -> Vec<DirEntry> {
    let mut entries = Vec::new();
    
    // Проверяем, существует ли директория
    let path_obj = Path::new(path);
    if !path_obj.exists() || !path_obj.is_dir() {
        return entries;
    }
    
    // Читаем содержимое директории
    if let Ok(dir_entries) = fs::read_dir(path) {
        for entry in dir_entries.filter_map(|e| e.ok()) {
            let path_str = entry.path().to_string_lossy().to_string();
            let is_dir = entry.path().is_dir();
            
            entries.push(DirEntry {
                path: path_str,
                is_dir,
            });
        }
    }
    
    entries
}

/// Рекурсивно сканирует директорию и возвращает все файлы
#[command]
pub fn scan_directory(path: &str, recursive: bool) -> Vec<DirEntry> {
    let mut entries = Vec::new();
    let path_obj = Path::new(path);
    
    if !path_obj.exists() || !path_obj.is_dir() {
        return entries;
    }
    
    // Если нужно рекурсивное сканирование, используем WalkDir
    if recursive {
        for entry in WalkDir::new(path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path_str = entry.path().to_string_lossy().to_string();
            let is_dir = entry.path().is_dir();
            
            entries.push(DirEntry {
                path: path_str,
                is_dir,
            });
        }
    } else {
        // Иначе просто читаем директорию
        entries = list_dir(path);
    }
    
    entries
}

/// Разрешает путь к модулю, учитывая алиасы
#[command]
pub fn fs_resolve_module_path(project_root: &str, module_name: &str) -> Option<String> {
    // Конвертируем в PathBuf для надежной работы с путями
    let root_path = PathBuf::from(project_root);
    
    // Проверяем, является ли путь относительным
    if module_name.starts_with("./") || module_name.starts_with("../") {
        // Просто возвращаем как есть, обработка относительных путей уже есть в JS
        return Some(module_name.to_string());
    }
    
    // Проверяем абсолютные пути или пути с алиасами
    if module_name.starts_with("/") {
        // Создаем полный путь
        let full_path = root_path.join(&module_name[1..]);
        return Some(full_path.to_string_lossy().to_string());
    }
    
    // Для алиаса @src
    if module_name.starts_with("@src/") {
        // Заменяем @src на {project_root}/src
        let src_path = root_path.join("src").join(&module_name[5..]);
        return Some(src_path.to_string_lossy().to_string());
    }
    
    // Для других случаев просто возвращаем исходный путь
    Some(module_name.to_string())
}

/// Получает список файлов JavaScript/TypeScript для импорта
#[command]
pub fn get_importable_files(root_path: &str) -> Vec<DirEntry> {
    let mut entries = Vec::new();
    let path_obj = Path::new(root_path);
    
    if !path_obj.exists() || !path_obj.is_dir() {
        println!("Путь не существует или не является директорией: {}", root_path);
        return entries;
    }

    println!("Сканирование директории для импортов: {}", root_path);
    
    for entry in WalkDir::new(root_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        let is_dir = path.is_dir();
        
        // Пропускаем node_modules и .git директории
        if path_str.contains("node_modules") || path_str.contains(".git") {
            if is_dir {
                // Отключаем сканирование этих директорий
                continue;
            }
        }
        
        // Проверяем расширение для файлов
        if !is_dir {
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if !["js", "jsx", "ts", "tsx", "vue", "svelte"].contains(&ext) {
                continue;
            }
        }

        // Используем Posix-стиль путей даже на Windows
        let normalized_path = path_str.replace("\\", "/");
        
        entries.push(DirEntry {
            path: normalized_path,
            is_dir,
        });
    }
    
    println!("Найдено {} файлов и директорий для импорта", entries.len());
    entries
} 