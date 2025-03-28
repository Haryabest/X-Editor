use std::path::{Path, PathBuf};

#[tauri::command]
pub fn resolve_module_path(project_root: &str, module_name: &str) -> Result<String, String> {
    // Проверяем является ли модуль алиасом
    let module_path = if module_name.starts_with("@/") || module_name.starts_with("@\\") {
        // Обрабатываем алиасы (@/components/...)
        let module_without_alias = module_name.replace("@/", "").replace("@\\", "");
        format!("{}/src/{}", project_root, module_without_alias)
    } else if module_name.starts_with("./") || module_name.starts_with(".\\") {
        // Относительный путь
        format!("{}/{}", project_root, module_name.replace("./", "").replace(".\\", ""))
    } else if module_name.contains(':') || module_name.contains('\\') || module_name.contains('/') {
        // Уже абсолютный или путь с протоколом
        module_name.to_string()
    } else {
        // Предполагаем, что это npm пакет
        format!("{}/node_modules/{}", project_root, module_name)
    };

    // Нормализуем путь для текущей OS
    let normalized_path = module_path.replace('/', &std::path::MAIN_SEPARATOR.to_string());
    
    // Проверяем существование файла с различными расширениями
    let extensions = [
        "", ".ts", ".tsx", ".js", ".jsx", ".json", 
        "/index.ts", "/index.tsx", "/index.js", "/index.jsx"
    ];
    
    for ext in extensions.iter() {
        let test_path = format!("{}{}", normalized_path, ext);
        if Path::new(&test_path).exists() {
            return Ok(test_path);
        }
    }
    
    // Файл не найден, но возвращаем предполагаемый путь
    Ok(normalized_path)
}

#[tauri::command]
pub fn get_project_root(current_file_path: &str) -> Result<String, String> {
    // Находим корень проекта на основе текущего пути
    let path = PathBuf::from(current_file_path);
    
    // Маркеры, определяющие корень проекта
    let project_markers = [
        "package.json", "tsconfig.json", ".git", "src", "node_modules"
    ];
    
    // Поднимаемся вверх по директориям, пока не найдем маркер
    let mut current_dir = path.clone();
    if !current_dir.is_dir() {
        current_dir = match current_dir.parent() {
            Some(dir) => dir.to_path_buf(),
            None => return Err("Не удалось определить директорию файла".to_string())
        };
    }
    
    // Проверяем не более 10 уровней вверх
    for _ in 0..10 {
        for marker in project_markers.iter() {
            let marker_path = current_dir.join(marker);
            if marker_path.exists() {
                return Ok(current_dir.to_string_lossy().to_string());
            }
        }
        
        // Поднимаемся на уровень выше
        match current_dir.parent() {
            Some(parent) => current_dir = parent.to_path_buf(),
            None => break
        }
    }
    
    // Не удалось найти корень проекта
    Err("Не удалось определить корень проекта".to_string())
}

#[tauri::command]
pub fn file_exists(file_path: &str) -> bool {
    Path::new(file_path).exists()
} 