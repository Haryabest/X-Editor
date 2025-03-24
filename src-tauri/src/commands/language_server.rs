// use std::path::Path;
// use serde::{Deserialize, Serialize};
// use tauri::State;
// use tower_lsp::lsp_types::{
//     CompletionItem, Position, TextDocumentIdentifier, TextDocumentPositionParams,
//     CompletionParams, CompletionContext, WorkDoneProgressParams, PartialResultParams,
// };
// use std::sync::Mutex;

// #[derive(Debug, Serialize, Deserialize)]
// pub struct CompletionPosition {
//     line: u32,
//     character: u32,
// }

// #[derive(Debug, Serialize, Deserialize)]
// pub struct CompletionResponse {
//     label: String,
//     kind: u32,
//     insert_text: String,
// }

// impl From<CompletionItem> for CompletionResponse {
//     fn from(item: CompletionItem) -> Self {
//         CompletionResponse {
//             label: item.label,
//             kind: item.kind.map(|k| k.into()).unwrap_or(1),
//             insert_text: item.insert_text.unwrap_or_else(|| item.label.clone()),
//         }
//     }
// }

// pub struct LanguageServerState {
//     typescript_client: Mutex<Option<tower_lsp::Client>>,
//     rust_client: Mutex<Option<tower_lsp::Client>>,
//     python_client: Mutex<Option<tower_lsp::Client>>,
//     go_client: Mutex<Option<tower_lsp::Client>>,
// }

// #[tauri::command]
// pub async fn get_typescript_completions(
//     state: State<'_, LanguageServerState>,
//     path: String,
//     position: CompletionPosition,
// ) -> Result<Vec<CompletionResponse>, String> {
//     if let Some(client) = state.typescript_client.lock().unwrap().as_ref() {
//         let text_document_position = TextDocumentPositionParams {
//             text_document: TextDocumentIdentifier {
//                 uri: tower_lsp::lsp_types::Url::from_file_path(Path::new(&path))
//                     .map_err(|_| "Invalid path")?,
//             },
//             position: Position::new(position.line, position.character),
//         };

//         let params = CompletionParams {
//             text_document_position,
//             work_done_progress_params: WorkDoneProgressParams::default(),
//             partial_result_params: PartialResultParams::default(),
//             context: None,
//         };

//         match client.request::<tower_lsp::lsp_types::request::Completion>(params).await {
//             Ok(Some(completion_response)) => {
//                 let items = match completion_response {
//                     tower_lsp::lsp_types::CompletionResponse::Array(items) => items,
//                     tower_lsp::lsp_types::CompletionResponse::List(list) => list.items,
//                 };
//                 Ok(items.into_iter().map(CompletionResponse::from).collect())
//             }
//             Ok(None) => Ok(vec![]),
//             Err(e) => Err(e.to_string()),
//         }
//     } else {
//         Ok(vec![])
//     }
// }

// #[tauri::command]
// pub async fn get_rust_completions(
//     state: State<'_, LanguageServerState>,
//     path: String,
//     position: CompletionPosition,
// ) -> Result<Vec<CompletionResponse>, String> {
//     if let Some(client) = state.rust_client.lock().unwrap().as_ref() {
//         let text_document_position = TextDocumentPositionParams {
//             text_document: TextDocumentIdentifier {
//                 uri: tower_lsp::lsp_types::Url::from_file_path(Path::new(&path))
//                     .map_err(|_| "Invalid path")?,
//             },
//             position: Position::new(position.line, position.character),
//         };

//         let params = CompletionParams {
//             text_document_position,
//             work_done_progress_params: WorkDoneProgressParams::default(),
//             partial_result_params: PartialResultParams::default(),
//             context: None,
//         };

//         match client.request::<tower_lsp::lsp_types::request::Completion>(params).await {
//             Ok(Some(completion_response)) => {
//                 let items = match completion_response {
//                     tower_lsp::lsp_types::CompletionResponse::Array(items) => items,
//                     tower_lsp::lsp_types::CompletionResponse::List(list) => list.items,
//                 };
//                 Ok(items.into_iter().map(CompletionResponse::from).collect())
//             }
//             Ok(None) => Ok(vec![]),
//             Err(e) => Err(e.to_string()),
//         }
//     } else {
//         Ok(vec![])
//     }
// }

// #[tauri::command]
// pub async fn get_python_completions(
//     state: State<'_, LanguageServerState>,
//     path: String,
//     position: CompletionPosition,
// ) -> Result<Vec<CompletionResponse>, String> {
//     if let Some(client) = state.python_client.lock().unwrap().as_ref() {
//         let text_document_position = TextDocumentPositionParams {
//             text_document: TextDocumentIdentifier {
//                 uri: tower_lsp::lsp_types::Url::from_file_path(Path::new(&path))
//                     .map_err(|_| "Invalid path")?,
//             },
//             position: Position::new(position.line, position.character),
//         };

//         let params = CompletionParams {
//             text_document_position,
//             work_done_progress_params: WorkDoneProgressParams::default(),
//             partial_result_params: PartialResultParams::default(),
//             context: None,
//         };

//         match client.request::<tower_lsp::lsp_types::request::Completion>(params).await {
//             Ok(Some(completion_response)) => {
//                 let items = match completion_response {
//                     tower_lsp::lsp_types::CompletionResponse::Array(items) => items,
//                     tower_lsp::lsp_types::CompletionResponse::List(list) => list.items,
//                 };
//                 Ok(items.into_iter().map(CompletionResponse::from).collect())
//             }
//             Ok(None) => Ok(vec![]),
//             Err(e) => Err(e.to_string()),
//         }
//     } else {
//         Ok(vec![])
//     }
// }

// #[tauri::command]
// pub async fn get_go_completions(
//     state: State<'_, LanguageServerState>,
//     path: String,
//     position: CompletionPosition,
// ) -> Result<Vec<CompletionResponse>, String> {
//     if let Some(client) = state.go_client.lock().unwrap().as_ref() {
//         let text_document_position = TextDocumentPositionParams {
//             text_document: TextDocumentIdentifier {
//                 uri: tower_lsp::lsp_types::Url::from_file_path(Path::new(&path))
//                     .map_err(|_| "Invalid path")?,
//             },
//             position: Position::new(position.line, position.character),
//         };

//         let params = CompletionParams {
//             text_document_position,
//             work_done_progress_params: WorkDoneProgressParams::default(),
//             partial_result_params: PartialResultParams::default(),
//             context: None,
//         };

//         match client.request::<tower_lsp::lsp_types::request::Completion>(params).await {
//             Ok(Some(completion_response)) => {
//                 let items = match completion_response {
//                     tower_lsp::lsp_types::CompletionResponse::Array(items) => items,
//                     tower_lsp::lsp_types::CompletionResponse::List(list) => list.items,
//                 };
//                 Ok(items.into_iter().map(CompletionResponse::from).collect())
//             }
//             Ok(None) => Ok(vec![]),
//             Err(e) => Err(e.to_string()),
//         }
//     } else {
//         Ok(vec![])
//     }
// }