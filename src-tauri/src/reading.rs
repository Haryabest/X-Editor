use tauri::command;
use std::fs;
use std::path::PathBuf;
use base64::prelude::*;
use tauri::AppHandle;
use tiny_http::{Server, Response, Header};
use std::thread;
use std::net::{SocketAddr, Ipv4Addr};

#[command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    println!("Reading text file: {:?}", path); // Отладка
    match fs::read_to_string(&path) {
        Ok(content) => {
            println!("Text file read successfully, length: {}", content.len());
            Ok(content)
        },
        Err(e) => Err(format!("Failed to read text file: {}", e)),
    }
}

#[command]
pub async fn read_binary_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    println!("Reading binary file: {:?}", path); // Отладка
    match fs::read(&path) {
        Ok(bytes) => {
            let base64_content = BASE64_STANDARD.encode(&bytes);
            println!("Binary file read successfully, base64 length: {}", base64_content.len());
            Ok(base64_content)
        },
        Err(e) => Err(format!("Failed to read binary file: {}", e)),
    }
}

#[command]
pub async fn stream_video(app: AppHandle, path: String) -> Result<String, String> {
    let path = PathBuf::from(&path);
    println!("Streaming video from: {:?}", path); // Отладка
    if !path.exists() {
        println!("File does not exist: {:?}", path);
        return Err(format!("File does not exist: {:?}", path));
    }

    // Пробуем найти свободный порт в диапазоне
    let mut port = 50000;
    let server = loop {
        let addr = format!("127.0.0.1:{}", port);
        println!("Trying to bind server to: {}", addr); // Отладка
        match Server::http(&addr) {
            Ok(server) => {
                println!("Server bound successfully to port: {}", port);
                break server;
            },
            Err(_) if port < 51000 => {
                port += 1;
                continue;
            },
            Err(e) => {
                println!("Failed to start server: {}", e);
                return Err(format!("Failed to start server: {}", e));
            },
        }
    };

    let url = format!("http://127.0.0.1:{}", port);
    println!("Streaming URL: {}", url); // Отладка

    // Запускаем сервер в отдельном потоке
    thread::spawn(move || {
        println!("Server thread started for: {:?}", path); // Отладка
        for request in server.incoming_requests() {
            println!("Received request: {:?}", request); // Отладка
            let file = match fs::File::open(&path) {
                Ok(file) => file,
                Err(e) => {
                    println!("Failed to open file in thread: {}", e);
                    let response = Response::from_string(format!("Failed to open file: {}", e))
                        .with_status_code(500);
                    let _ = request.respond(response);
                    return;
                }
            };

            let content_type = match path.extension().and_then(|s| s.to_str()) {
                Some("mp4") => "video/mp4",
                Some("avi") => "video/x-msvideo",
                Some("mov") => "video/quicktime",
                Some("webm") => "video/webm",
                Some("mkv") => "video/x-matroska",
                _ => "application/octet-stream",
            };

            let response = Response::from_file(file)
                .with_header(Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap())
                .with_header(Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap());

            match request.respond(response) {
                Ok(()) => println!("Response sent successfully"),
                Err(e) => println!("Failed to send response: {}", e),
            }
        }
        println!("Server thread exiting"); // Отладка
    });

    Ok(url)
}