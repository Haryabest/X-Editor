use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tokio::fs;
use futures::future::join_all;

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

        // Собираем все записи в директории
        while let Some(entry) = read_dir.next_entry().await? {
            dir_entries.push(entry);
        }

        println!("Found {} entries in directory: {:?}", dir_entries.len(), path);

        // Обрабатываем только первый уровень вложенности
        let futures = dir_entries.into_iter().map(|entry| {
            let child_path = entry.path();
            let child_path_clone = child_path.clone();
            println!("Processing entry: {:?}", child_path);
            async move {
                let result = read_directory(child_path_clone, true).await; // shallow = true для вложенных
                if let Err(e) = &result {
                    eprintln!("Error processing entry {:?}: {}", child_path, e);
                }
                result
            }
        });

        let results: Vec<std::io::Result<FileItem>> = join_all(futures).await;
        let mut processed_children = Vec::new();
        for result in results {
            match result {
                Ok(child) => processed_children.push(child),
                Err(e) => eprintln!("Error reading directory entry: {}", e),
            }
        }
        children = Some(processed_children);
    }

    Ok(FileItem {
        name: path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        is_directory,
        path: path.to_string_lossy().into_owned(),
        children,
    })
}

#[tauri::command]
pub async fn get_directory_tree(path: String) -> Result<FileItem, String> {
    let root_path = PathBuf::from(path);
    println!("Starting get_directory_tree for {:?}", root_path);
    let result = read_directory(root_path, false).await.map_err(|e| {
        println!("Error in get_directory_tree: {}", e);
        e.to_string()
    });
    println!("Finished get_directory_tree");
    result
}

#[tauri::command]
pub async fn get_subdirectory(path: String) -> Result<FileItem, String> {
    let subdir_path = PathBuf::from(path);
    println!("Loading subdirectory for {:?}", subdir_path);
    let result = read_directory(subdir_path, false).await.map_err(|e| {
        println!("Error loading subdirectory: {}", e);
        e.to_string()
    });
    println!("Finished loading subdirectory");
    result
}