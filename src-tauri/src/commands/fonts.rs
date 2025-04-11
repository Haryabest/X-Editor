use tauri::command;
use std::collections::HashSet;
use winapi::um::wingdi::EnumFontFamiliesExA;
use winapi::um::wingdi::LOGFONTA;
use winapi::um::winuser::{GetDC, ReleaseDC};
use winapi::um::winuser::GetDesktopWindow;
use std::ffi::CStr;
use std::os::raw::c_int;

// Global variable to store fonts during enumeration
static mut FONT_NAMES: Option<HashSet<String>> = None;

// Callback function for font enumeration
unsafe extern "system" fn enum_font_callback(
    logfont: *const LOGFONTA,
    _: *const winapi::um::wingdi::TEXTMETRICA,
    _: winapi::shared::minwindef::DWORD,
    param: winapi::shared::minwindef::LPARAM,
) -> c_int {
    let font_set = &mut *(param as *mut HashSet<String>);
    let logfont = &*logfont;
    
    // Convert the face name to a Rust string
    let face_name = CStr::from_ptr(logfont.lfFaceName.as_ptr() as *const i8)
        .to_string_lossy()
        .into_owned();
    
    // Add to the set if not empty
    if !face_name.is_empty() {
        font_set.insert(face_name);
    }
    
    // Continue enumeration
    1
}

#[command]
pub fn get_system_fonts() -> Vec<String> {
    unsafe {
        // Create a new HashSet to store font names
        let mut fonts = HashSet::new();
        
        // Get device context for the desktop window
        let hdc = GetDC(GetDesktopWindow());
        if hdc.is_null() {
            return Vec::new();
        }
        
        // Create and initialize a LOGFONTA structure
        let mut logfont: LOGFONTA = std::mem::zeroed();
        logfont.lfCharSet = 1; // DEFAULT_CHARSET
        
        // Enumerate font families
        EnumFontFamiliesExA(
            hdc,
            &mut logfont,
            Some(enum_font_callback),
            &mut fonts as *mut HashSet<String> as winapi::shared::minwindef::LPARAM,
            0,
        );
        
        // Release the device context
        ReleaseDC(GetDesktopWindow(), hdc);
        
        // Convert the HashSet to a Vec and sort it
        let mut font_vec: Vec<String> = fonts.into_iter().collect();
        font_vec.sort();
        
        font_vec
    }
} 