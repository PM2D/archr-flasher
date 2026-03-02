fn main() {
    #[allow(unused_mut)]
    let mut attrs = tauri_build::Attributes::new();

    // On Windows: embed admin manifest so the app requests UAC elevation at
    // startup (like Rufus). This eliminates the need for runtime PowerShell
    // elevation and prevents visible console windows during flash operations.
    #[cfg(windows)]
    {
        let windows = tauri_build::WindowsAttributes::new()
            .app_manifest(include_str!("admin.manifest"));
        attrs = attrs.windows_attributes(windows);
    }

    tauri_build::try_build(attrs).expect("failed to run build");
}
