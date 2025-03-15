use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Window;
use tokio::fs;

#[derive(Serialize, Deserialize, Debug)]
pub struct FileItem {
    pub name: String,
    pub is_directory: bool,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileItem>>,
}

async fn read_directory(path: PathBuf, shallow: bool) -> std::io::Result<FileItem> {
    let metadata = fs::metadata(&path).await?;
    let is_directory = metadata.is_dir();
    let mut children = None;

    if is_directory && !shallow {
        let mut dir_entries = Vec::new();
        let mut read_dir = fs::read_dir(&path).await?;

        while let Some(entry) = read_dir.next_entry().await? {
            let child_path = entry.path();
            dir_entries.push(FileItem {
                name: child_path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
                is_directory: child_path.is_dir(),
                path: child_path.to_string_lossy().into_owned(),
                children: None, // Не загружаем содержимое поддиректорий сразу
            });
        }

        children = Some(dir_entries);
    }

    Ok(FileItem {
        name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        is_directory,
        path: path.to_string_lossy().into_owned(),
        children,
    })
}

#[tauri::command]
pub async fn get_directory_tree(path: String, _window: Window) -> Result<FileItem, String> {
    let root_path = PathBuf::from(path);
    read_directory(root_path, false).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_subdirectory(path: String) -> Result<FileItem, String> {
    let subdir_path = PathBuf::from(path);
    read_directory(subdir_path, false).await.map_err(|e| e.to_string())
}