use std::path::{Path, PathBuf};
use std::env;
use std::process::Command;

#[tauri::command]
pub fn tauri_current_dir() -> Result<String, String> {
    match env::current_dir() {
        Ok(path) => Ok(path.to_string_lossy().to_string()),
        Err(e) => Err(format!("Не удалось получить текущую директорию: {}", e))
    }
}

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

#[tauri::command]
pub fn get_import_suggestions(
    project_root: &str,
    current_file: &str,
    line_content: &str,
    _position: serde_json::Value,
) -> Result<Vec<serde_json::Value>, String> {
    use std::path::Path;
    use std::fs;
    
    let mut suggestions = Vec::new();
    
    // Определяем текущую директорию
    let _current_dir = Path::new(current_file).parent().unwrap_or(Path::new(""));
    
    // Проверяем, является ли это строкой импорта
    if line_content.contains("import") || line_content.contains("require") {
        // Получаем все файлы в проекте
        let mut project_files = Vec::new();
        if let Ok(entries) = fs::read_dir(project_root) {
            for entry in entries.flatten() {
                if let Some(path) = entry.path().to_str().map(|s| s.to_string()) {
                    if path.ends_with(".ts") || path.ends_with(".tsx") || 
                       path.ends_with(".js") || path.ends_with(".jsx") {
                        project_files.push(path);
                    }
                }
            }
        }
        
        // Добавляем node_modules
        let node_modules_path = Path::new(project_root).join("node_modules");
        if node_modules_path.exists() {
            if let Ok(entries) = fs::read_dir(node_modules_path) {
                for entry in entries.flatten() {
                    if let Some(path) = entry.path().to_str().map(|s| s.to_string()) {
                        project_files.push(path);
                    }
                }
            }
        }
        
        // Формируем подсказки
        for file_path in project_files {
            let relative_path = if file_path.starts_with(project_root) {
                file_path[project_root.len()..].trim_start_matches('/').to_string()
            } else {
                file_path.clone()
            };
            
            let label = Path::new(&relative_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or(&relative_path)
                .to_string();
            
            let detail = format!("Import from {}", relative_path);
            let insert_text = format!("\"{}\"", relative_path);
            
            suggestions.push(serde_json::json!({
                "label": label,
                "detail": detail,
                "insertText": insert_text,
                "documentation": format!("Import from {}", relative_path)
            }));
        }
    }
    
    Ok(suggestions)
}

#[tauri::command]
pub fn get_git_info(project_root: &str) -> Result<serde_json::Value, String> {
    let mut info = serde_json::json!({
        "current_branch": "",
        "changes": [],
        "status": "clean"
    });

    // Проверяем, является ли директория Git репозиторием
    let repo_check = Command::new("git")
        .args(&["rev-parse", "--is-inside-work-tree"])
        .current_dir(project_root)
        .output();
    
    if let Err(e) = repo_check {
        return Err(format!("Ошибка проверки Git репозитория: {}", e));
    }
    
    let repo_check = repo_check.unwrap();
    if !repo_check.status.success() {
        return Err("Указанная директория не является Git репозиторием".to_string());
    }

    // Получаем текущую ветку
    if let Ok(output) = Command::new("git")
        .args(&["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(project_root)
        .output() {
        if let Ok(branch) = String::from_utf8(output.stdout) {
            info["current_branch"] = serde_json::Value::String(branch.trim().to_string());
        }
    }

    // Получаем статус изменений
    if let Ok(output) = Command::new("git")
        .args(&["status", "--porcelain"])
        .current_dir(project_root)
        .output() {
        if let Ok(status) = String::from_utf8(output.stdout) {
            let changes: Vec<serde_json::Value> = status
                .lines()
                .map(|line| {
                    let mut parts = line.split_whitespace();
                    let status = parts.next().unwrap_or("");
                    let path = parts.next().unwrap_or("");
                    serde_json::json!({
                        "status": status,
                        "path": path
                    })
                })
                .collect();
            
            // Определяем статус перед перемещением
            let is_empty = changes.is_empty();
            info["status"] = serde_json::Value::String(
                if is_empty { "clean" } else { "dirty" }.to_string()
            );
            
            // Перемещаем changes после использования
            info["changes"] = serde_json::Value::Array(changes);
        }
    }

    Ok(info)
}

#[tauri::command]
pub fn get_git_branches(project_root: &str) -> Result<Vec<String>, String> {
    // Получаем список всех веток в репозитории (локальных и удалённых)
    let output = Command::new("git")
        .args(&["branch", "--all"])
        .current_dir(project_root)
        .output()
        .map_err(|e| format!("Ошибка выполнения команды git branch: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Ошибка получения списка веток: {}", error));
    }

    let branches_output = String::from_utf8(output.stdout)
        .map_err(|e| format!("Ошибка декодирования вывода команды: {}", e))?;

    // Форматируем вывод, убирая * и whitespace перед именем текущей ветки
    let branches: Vec<String> = branches_output
        .lines()
        .map(|line| line.trim().trim_start_matches('*').trim().to_string())
        .filter(|branch| !branch.is_empty() && !branch.starts_with("remotes/"))
        .collect();

    Ok(branches)
}

#[tauri::command]
pub fn switch_git_branch(project_root: &str, branch_name: &str) -> Result<bool, String> {
    // Проверяем, что у нас нет незакоммиченных изменений
    let status_output = Command::new("git")
        .args(&["status", "--porcelain"])
        .current_dir(project_root)
        .output()
        .map_err(|e| format!("Не удалось проверить статус Git: {}", e))?;

    if !status_output.status.success() {
        let error = String::from_utf8_lossy(&status_output.stderr);
        return Err(format!("Ошибка проверки Git статуса: {}", error));
    }

    let has_changes = !String::from_utf8_lossy(&status_output.stdout).trim().is_empty();
    
    if has_changes {
        // Есть незакоммиченные изменения, спрашиваем пользователя что делать
        // В данном случае, просто возвращаем ошибку
        return Err("Есть незакоммиченные изменения. Закоммитьте или стэшните изменения перед переключением ветки.".to_string());
    }

    // Переключаемся на указанную ветку
    let checkout_output = Command::new("git")
        .args(&["checkout", branch_name])
        .current_dir(project_root)
        .output()
        .map_err(|e| format!("Ошибка при переключении ветки: {}", e))?;

    if !checkout_output.status.success() {
        let error = String::from_utf8_lossy(&checkout_output.stderr);
        return Err(format!("Не удалось переключиться на ветку {}: {}", branch_name, error));
    }

    Ok(true)
}

#[tauri::command]
pub fn git_command(project_root: &str, command: &str, args: Vec<String>) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(project_root)
        .arg(command);

    // Добавляем все аргументы
    for arg in args {
        cmd.arg(arg);
    }

    let output = cmd.output()
        .map_err(|e| format!("Ошибка выполнения git команды: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(stdout)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Ошибка git команды: {}", stderr))
    }
} 