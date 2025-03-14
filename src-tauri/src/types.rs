use serde::{Deserialize, Serialize};
use std::path::Path;
use std::fs;

#[derive(Serialize, Deserialize, Debug)]
pub struct FileItem {
    pub name: String,
    pub is_directory: bool,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileItem>>,
}

// Рекурсивная функция для чтения директории
fn read_directory(path: &Path) -> std::io::Result<FileItem> {
    let metadata = fs::metadata(path)?;
    let is_directory = metadata.is_dir();
    
    let mut children = None;
    
    if is_directory {
        let mut dir_entries = Vec::new();
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let child_path = entry.path();
            dir_entries.push(read_directory(&child_path)?);
        }
        children = Some(dir_entries);
    }

    Ok(FileItem {
        name: path.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        is_directory,
        path: path.to_string_lossy().into_owned(),
        children,
    })
}

#[tauri::command]
pub async  fn get_directory_tree(path: String) -> Result<FileItem, String> {
    let root_path = Path::new(&path);
    read_directory(root_path)
        .map_err(|e| e.to_string())
}