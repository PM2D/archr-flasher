use serde::{Deserialize, Serialize};

const REPO_API: &str = "https://api.github.com/repos/archr-linux/Arch-R/releases/latest";
const IMAGE_PREFIX: &str = "ArchR-R36S-no-panel-";

#[derive(Debug, Clone, Serialize)]
pub struct ReleaseInfo {
    pub version: String,
    pub image_name: String,
    pub download_url: String,
    pub size_bytes: u64,
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    assets: Vec<GithubAsset>,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

pub async fn get_latest_release() -> Result<ReleaseInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("archr-flasher")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let release: GithubRelease = client
        .get(REPO_API)
        .send()
        .await
        .map_err(|e| format!("GitHub API error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    // Find the no-panel image asset
    let asset = release
        .assets
        .iter()
        .find(|a| a.name.starts_with(IMAGE_PREFIX) && a.name.ends_with(".img.xz"))
        .ok_or("No no-panel image found in latest release")?;

    Ok(ReleaseInfo {
        version: release.tag_name,
        image_name: asset.name.clone(),
        download_url: asset.browser_download_url.clone(),
        size_bytes: asset.size,
    })
}
