mod image_handler;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("Starting Tauri application...");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            image_handler::load_image_as_base64,
            image_handler::convert_path_to_url,
            image_handler::convert_to_asset_url,
            image_handler::get_temp_dir,
            image_handler::write_text_file,
            image_handler::open_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}