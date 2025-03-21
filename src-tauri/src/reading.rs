use base64::prelude::*;
use std::fs;
use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::command;
use tauri::AppHandle;
use tiny_http::{Header, Response, Server};
use serde::{Deserialize, Serialize};

// Структура для возврата информации о проекте
#[derive(Serialize, Deserialize, Debug)]
pub struct ProjectInfo {
    has_package_json: bool,
    has_cargo_toml: bool,
    dependencies: Vec<String>,
    dev_dependencies: Vec<String>,
    path: String,
}

#[command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    println!("Reading text file: {:?}", path);
    match fs::read_to_string(&path) {
        Ok(content) => {
            println!("Text file read successfully, length: {}", content.len());
            Ok(content)
        }
        Err(e) => Err(format!("Failed to read text file: {}", e)),
    }
}

#[command]
pub async fn read_binary_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    println!("Reading binary file: {:?}", path);
    match fs::read(&path) {
        Ok(bytes) => {
            let base64_content = BASE64_STANDARD.encode(&bytes);
            println!(
                "Binary file read successfully, base64 length: {}",
                base64_content.len()
            );
            Ok(base64_content)
        }
        Err(e) => Err(format!("Failed to read binary file: {}", e)),
    }
}

#[tauri::command]
pub async fn file_exists(path: String) -> Result<bool, String> {
    let path = PathBuf::from(path);
    Ok(fs::metadata(&path).is_ok())
}

#[tauri::command]
pub async fn run_command(command: String, args: Vec<String>, cwd: String) -> Result<(), String> {
    println!(
        "Attempting to run command: {} with args: {:?} in cwd: {}",
        command, args, cwd
    );
    let output = StdCommand::new(&command)
        .args(&args)
        .current_dir(&cwd)
        .output()
        .map_err(|e| format!("Failed to execute '{}': {}", command, e))?;

    if output.status.success() {
        println!("Command '{}' executed successfully", command);
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "Command '{}' failed with error: {}",
            command, stderr
        ))
    }
}

#[command]
pub async fn stream_video(app: AppHandle, path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    println!("Streaming video from: {:?}", path);
    if !path.exists() {
        println!("File does not exist: {:?}", path);
        return Err(format!("File does not exist: {:?}", path));
    }

    let port_state = Arc::new(Mutex::new(50000));
    let server = loop {
        let addr = format!("127.0.0.1:{}", *port_state.lock().unwrap());
        println!("Trying to bind server to: {}", addr);
        match Server::http(&addr) {
            Ok(server) => {
                println!(
                    "Server bound successfully to port: {}",
                    *port_state.lock().unwrap()
                );
                break server;
            }
            Err(_) => {
                let mut port = port_state.lock().unwrap();
                if *port < 51000 {
                    *port += 1;
                } else {
                    return Err("Failed to find an available port".to_string());
                }
            }
        }
    };

    let url = format!("http://127.0.0.1:{}", *port_state.lock().unwrap());
    println!("Streaming URL: {}", url);

    let path_clone = path.clone();

    thread::spawn(move || {
        println!("Server thread started for: {:?}", path_clone);
        for request in server.incoming_requests() {
            println!("Received request: {:?}", request);
            let file = match fs::File::open(&path_clone) {
                Ok(file) => file,
                Err(e) => {
                    println!("Failed to open file in thread: {}", e);
                    let response = Response::from_string(format!("Failed to open file: {}", e))
                        .with_status_code(500);
                    let _ = request.respond(response);
                    return;
                }
            };

            let content_type = match path_clone.extension().and_then(|s| s.to_str()) {
                Some("mp4") => "video/mp4",
                Some("avi") => "video/x-msvideo",
                Some("mov") => "video/quicktime",
                Some("webm") => "video/webm",
                Some("mkv") => "video/x-matroska",
                _ => "application/octet-stream",
            };

            let response = Response::from_file(file)
                .with_header(
                    Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap(),
                )
                .with_header(Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap());

            match request.respond(response) {
                Ok(()) => println!("Response sent successfully"),
                Err(e) => println!("Failed to send response: {}", e),
            }
        }
        println!("Server thread exiting");
    });

    Ok(url)
}

#[tauri::command]
pub async fn analyze_project(folder_path: String) -> Result<ProjectInfo, String> {
    let package_json_path = format!("{}/package.json", folder_path);
    let mut has_package_json = false;
    let mut dependencies = Vec::new();
    let mut dev_dependencies = Vec::new();

    if let Ok(package_json_content) = fs::read_to_string(&package_json_path) {
        match serde_json::from_str::<serde_json::Value>(&package_json_content) {
            Ok(package_json) => {
                has_package_json = true;
                if let Some(deps) = package_json.get("dependencies").and_then(|v| v.as_object()) {
                    dependencies = deps.keys().map(|k| k.to_string()).collect();
                }
                if let Some(dev_deps) = package_json.get("devDependencies").and_then(|v| v.as_object()) {
                    dev_dependencies = dev_deps.keys().map(|k| k.to_string()).collect();
                }
            }
            Err(e) => println!("Failed to parse package.json: {}", e),
        }
    } else {
        println!("No package.json found at: {}", package_json_path);
    }

    let cargo_toml_path = format!("{}/Cargo.toml", folder_path);
    let has_cargo_toml = fs::metadata(&cargo_toml_path).is_ok();

    Ok(ProjectInfo {
        has_package_json,
        has_cargo_toml,
        dependencies,
        dev_dependencies,
        path: folder_path,
    })
}

#[tauri::command]
pub async fn install_dependencies(folder_path: String) -> Result<(), String> {
    let package_json_path = format!("{}/package.json", folder_path);
    if fs::metadata(&package_json_path).is_ok() {
        println!("Installing Node.js dependencies in: {}", folder_path);
        let output = StdCommand::new("npm")
            .args(&["install"])
            .current_dir(&folder_path)
            .output()
            .map_err(|e| format!("Failed to execute 'npm install': {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("npm install failed: {}", stderr));
        }
        println!("Node.js dependencies installed successfully");
    }

    let cargo_toml_path = format!("{}/Cargo.toml", folder_path);
    if fs::metadata(&cargo_toml_path).is_ok() {
        println!("Installing Rust dependencies in: {}", folder_path);
        let output = StdCommand::new("cargo")
            .args(&["build"])
            .current_dir(&folder_path)
            .output()
            .map_err(|e| format!("Failed to execute 'cargo build': {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("cargo build failed: {}", stderr));
        }
        println!("Rust dependencies built successfully");
    }

    Ok(())
}