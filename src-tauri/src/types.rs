use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct FileItem {
    pub name: String,
    pub is_directory: bool,
    pub path: String,
}
