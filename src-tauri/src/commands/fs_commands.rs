use std::path::{Path, PathBuf};
use std::fs;
use tauri::command;
use walkdir::WalkDir;
use std::collections::HashSet;
use std::process::Command;

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
pub fn fs_get_project_root(current_file_path: &str) -> String {
    // Начинаем с текущей директории процесса
    let mut current_dir = std::env::current_dir().unwrap_or_default();
    
    println!("Получение корня проекта для пути: {}", current_file_path);
    
    // Если передан путь к файлу, пытаемся использовать его
    if !current_file_path.is_empty() {
        // Нормализуем путь (заменяем обратные слеши на прямые) для корректной работы на Windows
        let normalized_path = current_file_path.replace("\\", "/");
        
        println!("Нормализованный путь: {}", normalized_path);
        
        // Если путь начинается с буквы диска Windows (например, C:/)
        if let Some(c) = normalized_path.chars().next() {
            if c.is_ascii_alphabetic() && normalized_path.len() > 1 && normalized_path.chars().nth(1) == Some(':') {
                // Создаем PathBuf из Windows пути
                let path = Path::new(&normalized_path);
                
                // Если это директория, используем её
                if path.exists() {
                    if path.is_dir() {
                        current_dir = path.to_path_buf();
                        println!("Установлена текущая директория (директория): {}", current_dir.display());
                    } else if let Some(parent) = path.parent() {
                        // Если это файл, используем его родительскую директорию
                        current_dir = parent.to_path_buf();
                        println!("Установлена текущая директория (из файла): {}", current_dir.display());
                    }
                } else {
                    println!("Путь не существует, определяем тип: {}", normalized_path);
                    
                    // Проверяем, похоже ли это на путь к файлу (есть точка в последнем компоненте)
                    let is_likely_file = normalized_path.split('/').last().map_or(false, |last| last.contains('.'));
                    
                    if is_likely_file {
                        // Если это похоже на файл, берем родительскую директорию
                        let path_buf = PathBuf::from(&normalized_path);
                        if let Some(parent) = path_buf.parent() {
                            current_dir = parent.to_path_buf();
                            println!("Путь похож на файл, используем родительскую директорию: {}", current_dir.display());
                        }
                    } else {
                        // Если это не похоже на файл, пробуем использовать как директорию
                        current_dir = PathBuf::from(&normalized_path);
                        println!("Путь похож на директорию, используем её: {}", current_dir.display());
                    }
                }
            }
        } 
        // Если это Unix путь, начинающийся с /
        else if normalized_path.starts_with("/") {
            let path = Path::new(&normalized_path);
            if path.exists() {
                if path.is_dir() {
                    current_dir = path.to_path_buf();
                    println!("Установлена текущая директория (Unix директория): {}", current_dir.display());
                } else if let Some(parent) = path.parent() {
                    current_dir = parent.to_path_buf();
                    println!("Установлена текущая директория (из Unix файла): {}", current_dir.display());
                }
            } else {
                println!("Unix путь не существует, определяем тип: {}", normalized_path);
                
                // Проверяем, похоже ли это на путь к файлу (есть точка в последнем компоненте)
                let is_likely_file = normalized_path.split('/').last().map_or(false, |last| last.contains('.'));
                
                if is_likely_file {
                    // Если это похоже на файл, берем родительскую директорию
                    let path_buf = PathBuf::from(&normalized_path);
                    if let Some(parent) = path_buf.parent() {
                        current_dir = parent.to_path_buf();
                        println!("Unix путь похож на файл, используем родительскую директорию: {}", current_dir.display());
                    }
                } else {
                    // Если это не похоже на файл, пробуем использовать как директорию
                    current_dir = PathBuf::from(&normalized_path);
                    println!("Unix путь похож на директорию, используем её: {}", current_dir.display());
                }
            }
        } 
        // Специальная обработка для относительных путей
        else if normalized_path.contains("./") || !normalized_path.contains('/') {
            println!("Обрабатываем относительный путь: {}", normalized_path);
            
            // Преобразуем относительный путь в абсолютный, начиная от текущей директории
            let mut path_buf = current_dir.clone();
            
            // Обработка сложных множественных относительных путей (./../, ../../)
            if normalized_path.contains("../") {
                println!("Обработка многоуровневого относительного пути: {}", normalized_path);
                
                // Подсчитываем количество переходов на уровень вверх
                let parent_count = normalized_path.matches("../").count();
                println!("Найдено {} переходов вверх", parent_count);
                
                // Делаем копию пути для разбора
                let mut target_dir = current_dir.clone();
                
                // Поднимаемся на необходимое количество уровней вверх
                for _ in 0..parent_count {
                    if !target_dir.pop() {
                        println!("Достигнут корень файловой системы, прерываем подъем");
                        break;
                    }
                }
                
                println!("Директория после подъема: {}", target_dir.display());
                
                // Получаем часть пути после последнего ../
                let rest_path = normalized_path.split("../").last().unwrap_or("");
                println!("Оставшаяся часть пути: {}", rest_path);
                
                // Если после серии ../ есть еще путь, добавляем его
                if !rest_path.is_empty() {
                    target_dir.push(rest_path);
                }
                
                // Проверяем получившийся путь
                if target_dir.exists() {
                    if target_dir.is_dir() {
                        current_dir = target_dir;
                        println!("Установлена директория после обработки множественных ../: {}", current_dir.display());
                    } else if let Some(parent) = target_dir.parent() {
                        current_dir = parent.to_path_buf();
                        println!("Путь после обработки ../ указывает на файл, используем родительскую директорию: {}", current_dir.display());
                    }
                } else {
                    // Проверяем тип неизвестного пути
                    let is_likely_file = rest_path.contains('.');
                    
                    if is_likely_file && rest_path.contains('/') {
                        // Если похоже на путь к файлу в поддиректории, берем директорию
                        if let Some(parent) = target_dir.parent() {
                            current_dir = parent.to_path_buf();
                            println!("Путь после обработки ../ похож на файл в поддиректории: {}", current_dir.display());
                        }
                    } else if is_likely_file {
                        // Если похоже на файл без поддиректорий
                        if let Some(parent) = target_dir.parent() {
                            current_dir = parent.to_path_buf();
                        } else {
                            current_dir = target_dir;
                        }
                        println!("Путь после обработки ../ похож на файл: {}", current_dir.display());
                    } else {
                        // Если не похоже на файл, используем как директорию
                        current_dir = target_dir;
                        println!("Путь после обработки ../ похож на директорию: {}", current_dir.display());
                    }
                }
            } else {
                // Обработка обычных путей (./ или файл/директория)
                path_buf.push(normalized_path.clone());
                
                if path_buf.exists() {
                    if path_buf.is_dir() {
                        current_dir = path_buf;
                        println!("Установлена текущая директория (относительная директория): {}", current_dir.display());
                    } else if let Some(parent) = path_buf.parent() {
                        current_dir = parent.to_path_buf();
                        println!("Установлена текущая директория (из относительного файла): {}", current_dir.display());
                    }
                } else {
                    println!("Относительный путь не существует, определяем тип: {}", normalized_path);
                    
                    // Проверяем, похоже ли это на путь к файлу (есть точка в последнем компоненте)
                    let is_likely_file = normalized_path.split('/').last().map_or(false, |last| last.contains('.'));
                    
                    if is_likely_file {
                        // Если это похоже на файл, берем родительскую директорию
                        if let Some(parent) = path_buf.parent() {
                            current_dir = parent.to_path_buf();
                            println!("Относительный путь похож на файл, используем родительскую директорию: {}", current_dir.display());
                        }
                    }
                }
            }
        }
    }
    
    println!("Итоговая текущая директория перед поиском корня проекта: {}", current_dir.display());
    
    // Поиск маркеров проекта - поднимаемся вверх по дереву каталогов,
    // ищем маркеры типа package.json, .git и т.д.
    let mut root_dir = current_dir.clone();
    let project_markers = [
        "package.json", 
        ".git", 
        "tsconfig.json", 
        "next.config.js", 
        "next.config.ts",
        "vite.config.js",
        "vite.config.ts"
    ];
    
    // Глубина поиска вверх, чтобы избежать бесконечного цикла
    let max_depth = 10;
    let mut depth = 0;
    
    loop {
        depth += 1;
        
        // Ограничение глубины поиска
        if depth > max_depth {
            println!("Достигнута максимальная глубина поиска корня проекта");
            root_dir = current_dir.clone();
            break;
        }
        
        // Проверяем наличие маркеров в текущей директории
        let found_marker = project_markers.iter().any(|marker| {
            let marker_path = root_dir.join(marker);
            let exists = marker_path.exists();
            if exists {
                println!("Найден маркер проекта: {}", marker_path.display());
            }
            exists
        });
        
        if found_marker {
            // Нашли маркер - это корень проекта
            println!("Найден корень проекта: {}", root_dir.display());
            break;
        }
        
        // Поднимаемся на уровень выше
        if !root_dir.pop() {
            // Больше некуда подниматься, используем текущую директорию
            println!("Не удалось найти корень проекта, используем текущую директорию");
            root_dir = current_dir.clone();
            break;
        }
    }
    
    // Нормализуем пути для возврата в Windows-формате
    let root_path = root_dir.to_string_lossy().to_string().replace("\\", "/");
    let current_path = current_dir.to_string_lossy().to_string().replace("\\", "/");
    
    println!("Итоговый корень проекта: {}", root_path);
    println!("Текущая директория файла: {}", current_path);
    
    // Возвращаем корень проекта и текущую директорию, используя специальный разделитель,
    // который не будет конфликтовать с Windows-путями вида C:/
    format!("{}###{}", root_path, current_path)
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
/// Оптимизированная версия со значительно улучшенным сканированием
#[command]
pub fn get_importable_files(root_path: &str) -> Vec<DirEntry> {
    let mut entries = Vec::new();
    let path_obj = Path::new(root_path);
    
    if !path_obj.exists() || !path_obj.is_dir() {
        println!("Путь не существует или не является директорией: {}", root_path);
        return entries;
    }

    println!("Сканирование директории для импортов: {}", root_path);
    
    // Игнорируем директории, которые обычно содержат много файлов, но не нужны для импортов
    let ignore_dirs = ["node_modules", ".git", "dist", "build", ".next", "out", 
                      ".cache", ".idea", ".vscode", ".github", "coverage", ".DS_Store"];
    
    // Расширения файлов, которые мы хотим включить
    let valid_extensions = ["js", "jsx", "ts", "tsx", "vue", "svelte", "json", "css", "scss", 
                           "sass", "less", "md", "mdx", "svg", "png", "jpg", "jpeg", "gif", 
                           "webp", "woff", "woff2", "ttf", "otf", "eot"];
    
    // Конвертируем root_path в абсолютный путь
    let absolute_root_path = if path_obj.is_absolute() {
        path_obj.to_path_buf()
    } else {
        // Если путь относительный, преобразуем его в абсолютный
        if let Ok(current_dir) = std::env::current_dir() {
            current_dir.join(path_obj)
        } else {
            path_obj.to_path_buf()
        }
    };
    
    let root_path_str = absolute_root_path.to_string_lossy().to_string();
    println!("Абсолютный путь корня проекта: {}", root_path_str);
    
    for entry in WalkDir::new(&absolute_root_path)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path();
            
            // Проверяем, является ли путь директорией
            if path.is_dir() {
                // Игнорируем определенные директории
                let dir_name = path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                
                !ignore_dirs.iter().any(|&ignore| dir_name == ignore)
            } else {
                true
            }
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        // Получаем абсолютный путь
        let path_str = path.to_string_lossy().to_string();
        let is_dir = path.is_dir();
        
        // Если это не директория, проверяем расширение
        if !is_dir {
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            
            if !valid_extensions.contains(&ext.as_str()) {
                continue;
            }
        }

        // Нормализуем путь: используем форвард-слеши даже на Windows и удаляем root_path из начала
        let mut normalized_path = path_str.replace("\\", "/");
        
        // Если путь начинается с root_path, удаляем префикс для создания относительного пути
        if let Some(rel_path) = normalized_path.strip_prefix(&root_path_str) {
            // Удаляем начальный слеш, если есть
            let clean_path = rel_path.trim_start_matches('/');
            normalized_path = clean_path.to_string();
        } else {
            // Если путь не начинается с root_path, пытаемся найти общий префикс
            // и создать относительный путь
            let root_parts: Vec<&str> = root_path_str.split('/').collect();
            let path_parts: Vec<&str> = normalized_path.split('/').collect();
            
            // Находим количество общих компонентов пути
            let mut common_parts = 0;
            for (i, (root_part, path_part)) in root_parts.iter().zip(path_parts.iter()).enumerate() {
                if root_part == path_part {
                    common_parts = i + 1;
                } else {
                    break;
                }
            }
            
            if common_parts > 0 {
                // Берем путь относительно общего префикса
                normalized_path = path_parts[common_parts..].join("/");
            }
        }
        
        entries.push(DirEntry {
            path: normalized_path,
            is_dir,
        });
    }
    
    println!("Найдено {} файлов и директорий для импорта", entries.len());
    entries
}

/// Получает список npm пакетов на основе package.json
#[command]
pub fn get_npm_packages(project_root: &str) -> Vec<String> {
    let mut packages = Vec::new();
    let mut seen = HashSet::new();
    
    // Путь к package.json
    let package_json_path = Path::new(project_root).join("package.json");
    
    if !package_json_path.exists() {
        println!("package.json не найден в {}", project_root);
        return packages;
    }
    
    // Читаем содержимое package.json
    match fs::read_to_string(&package_json_path) {
        Ok(content) => {
            // Парсим JSON
            match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(json) => {
                    // Извлекаем зависимости
                    let dep_types = ["dependencies", "devDependencies", "peerDependencies"];
                    
                    for dep_type in dep_types.iter() {
                        if let Some(deps) = json[dep_type].as_object() {
                            for (pkg_name, _) in deps {
                                if !seen.contains(pkg_name) {
                                    seen.insert(pkg_name.clone());
                                    packages.push(pkg_name.clone());
                                }
                            }
                        }
                    }
                },
                Err(e) => {
                    println!("Ошибка парсинга package.json: {}", e);
                }
            }
        },
        Err(e) => {
            println!("Ошибка чтения package.json: {}", e);
        }
    }
    
    // Сортируем пакеты по алфавиту
    packages.sort();
    
    println!("Найдено {} npm пакетов в package.json", packages.len());
    packages
}

/// Получает информацию о текущем файле редактора
#[command]
pub fn editor_get_current_file_path() -> serde_json::Value {
    // В этой реализации мы просто возвращаем информацию о текущей директории
    let current_dir = std::env::current_dir().unwrap_or_default();
    let current_dir_str = current_dir.to_string_lossy().to_string().replace("\\", "/");
    
    println!("Запрошен путь к текущему файлу редактора, возвращаем текущую директорию: {}", current_dir_str);
    
    // Создаем объект JSON с путем к текущей директории
    serde_json::json!({
        "filePath": current_dir_str,
        "exists": std::path::Path::new(&current_dir_str).exists(),
        "isDirectory": true
    })
}

/// Получает все файлы в указанной директории (рекурсивно)
#[command]
pub fn get_all_files_in_directory(directory: &str) -> Vec<String> {
    println!("Сканирование директории для получения всех файлов: {}", directory);
    
    let mut files = Vec::new();
    let path_obj = Path::new(directory);
    
    if !path_obj.exists() || !path_obj.is_dir() {
        println!("Путь не существует или не является директорией: {}", directory);
        return files;
    }
    
    // Игнорируем определенные директории
    let ignore_dirs = ["node_modules", ".git", "dist", "build", ".next", "out", 
                      ".cache", ".idea", ".vscode", ".github", "coverage", ".DS_Store"];
    
    for entry in WalkDir::new(directory)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path();
            
            // Проверяем, является ли путь директорией
            if path.is_dir() {
                // Игнорируем определенные директории
                let dir_name = path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("");
                
                !ignore_dirs.iter().any(|&ignore| dir_name == ignore)
            } else {
                true
            }
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        
        // Исключаем директории, добавляем только файлы
        if !path.is_dir() {
            let path_str = path.to_string_lossy().to_string().replace("\\", "/");
            files.push(path_str);
        }
    }
    
    println!("Найдено {} файлов в директории {}", files.len(), directory);
    files
}

/// Получает установленные pip-пакеты из системы
#[command]
pub fn get_pip_packages() -> Vec<PipPackage> {
    let mut packages = Vec::new();
    
    // Запускаем команду pip list --format=json
    let output = Command::new("pip")
        .args(&["list", "--format=json"])
        .output()
        .unwrap_or_else(|e| {
            println!("Не удалось выполнить pip list: {}", e);
            std::process::Command::new("python")
                .args(&["-m", "pip", "list", "--format=json"])
                .output()
                .unwrap_or_else(|e| {
                    println!("Не удалось выполнить python -m pip list: {}", e);
                    // Create an Output structure with a dummy exit status
                    let failed_output = std::process::Output {
                        // Use process::Command to get a real ExitStatus instead of trying to create one
                        status: Command::new("exit").status().unwrap_or_else(|_| {
                            std::process::exit(1);
                        }),
                        stdout: Vec::new(),
                        stderr: Vec::new(),
                    };
                    failed_output
                })
        });
    
    if output.status.success() {
        // Преобразуем вывод в строку
        let json_str = String::from_utf8_lossy(&output.stdout);
        
        // Парсим JSON
        match serde_json::from_str::<Vec<PipPackage>>(&json_str) {
            Ok(pip_packages) => {
                packages = pip_packages;
                println!("Найдено {} pip пакетов", packages.len());
            },
            Err(e) => {
                println!("Ошибка парсинга pip list: {}", e);
            }
        }
    } else {
        // Вывод ошибки
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("Ошибка при выполнении pip list: {}", stderr);
    }
    
    packages
}

// Добавим структуру для pip пакетов
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PipPackage {
    pub name: String,
    pub version: String,
} 