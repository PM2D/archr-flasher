// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod disk;
mod flash;
mod github;
mod panels;

use disk::DiskInfo;
use panels::Panel;
use github::ReleaseInfo;

#[tauri::command]
fn get_panels(console: &str) -> Vec<Panel> {
    panels::get_panels(console)
}

#[tauri::command]
fn list_disks() -> Vec<DiskInfo> {
    disk::list_removable_disks()
}

#[tauri::command]
async fn check_latest_release() -> Result<ReleaseInfo, String> {
    github::get_latest_release().await
}

#[tauri::command]
async fn flash_image(
    app: tauri::AppHandle,
    image_path: String,
    device: String,
    panel_dtb: String,
    panel_id: String,
    variant: String,
) -> Result<String, String> {
    // Stage 1: Write image to SD card
    let app_clone = app.clone();
    let device_clone = device.clone();
    let image_path_clone = image_path.clone();

    tokio::task::spawn_blocking(move || {
        flash::write_image(&app_clone, &image_path_clone, &device_clone)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))??;

    // Stage 2: Post-flash configuration (inject DTB, panel.txt, variant)
    let device_clone = device.clone();
    tokio::task::spawn_blocking(move || {
        flash::post_flash_configure(&device_clone, &panel_dtb, &panel_id, &variant)
    })
    .await
    .map_err(|e| format!("Task error: {}", e))??;

    Ok("Flash complete".into())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_panels,
            list_disks,
            check_latest_release,
            flash_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
