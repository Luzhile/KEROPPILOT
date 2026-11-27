#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod secret;

use tauri::Manager;

fn position_main_window(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) {
        let work = monitor.work_area();
        let inner = window.inner_size()?;
        let outer = window.outer_size()?;
        let available_width = work
            .size
            .width
            .saturating_sub(outer.width.saturating_sub(inner.width));
        let available_height = work
            .size
            .height
            .saturating_sub(outer.height.saturating_sub(inner.height));

        let scale = monitor.scale_factor();
        window.set_min_size(Some(tauri::PhysicalSize::new(
            ((380.0 * scale).round() as u32).min(available_width),
            ((560.0 * scale).round() as u32).min(available_height),
        )))?;
        window.set_size(tauri::PhysicalSize::new(
            inner.width.min(available_width),
            inner.height.min(available_height),
        ))?;

        window.set_position(tauri::PhysicalPosition::new(
            work.position.x + work.size.width.saturating_sub(window.outer_size()?.width) as i32,
            work.position.y,
        ))?;
    }
    window.show()
}

#[tauri::command]
fn read_api_key(app: tauri::AppHandle) -> Result<secret::StoredKey, String> {
    secret::read_key(&app)
}

#[tauri::command]
fn save_api_key(app: tauri::AppHandle, key: String) -> Result<secret::StoredKey, String> {
    secret::save_key(&app, &key)
}

#[tauri::command]
fn delete_api_key(app: tauri::AppHandle) -> Result<(), String> {
    secret::delete_key(&app)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_api_key,
            save_api_key,
            delete_api_key
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                position_main_window(&window)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("ChatPilot could not start");
}
