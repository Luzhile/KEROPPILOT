//! DPAPI-backed storage for the DeepSeek API key.
//!
//! The key never lands on disk in plain text: Windows DPAPI encrypts it for the
//! current Windows user, so copying the file to another account or machine does
//! not expose it. The webview only receives the key in memory while the app runs.

use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use windows_sys::Win32::Foundation::LocalFree;
use windows_sys::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
};

const KEY_FILE: &str = "deepseek.key";
const ENV_VAR: &str = "DEEPSEEK_API_KEY";
const MAX_KEY_LEN: usize = 512;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredKey {
    pub key: Option<String>,
    pub source: &'static str,
}

fn key_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join(KEY_FILE))
        .map_err(|cause| format!("无法定位应用配置目录：{cause}"))
}

fn blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
    CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    }
}

fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    // SAFETY: both blobs point at live slices for the duration of the call and
    // the output buffer is released through LocalFree below.
    unsafe {
        let input = blob(data);
        let mut output = CRYPT_INTEGER_BLOB::default();
        let ok = CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        );
        if ok == 0 {
            return Err(format!(
                "Windows DPAPI 加密失败：{}",
                std::io::Error::last_os_error()
            ));
        }
        let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as _);
        Ok(bytes)
    }
}

fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    // SAFETY: see protect(); decrypted data is also freed with LocalFree.
    unsafe {
        let input = blob(data);
        let mut output = CRYPT_INTEGER_BLOB::default();
        let ok = CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        );
        if ok == 0 {
            return Err(format!(
                "已保存的 API Key 无法用当前 Windows 账户解密：{}",
                std::io::Error::last_os_error()
            ));
        }
        let bytes = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as _);
        Ok(bytes)
    }
}

fn normalize_key(value: &str) -> String {
    value.chars().filter(|ch| !ch.is_whitespace()).take(MAX_KEY_LEN).collect()
}

fn read_stored(path: &Path) -> Result<Option<String>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let encrypted = fs::read(path).map_err(|cause| format!("读取 API Key 失败：{cause}"))?;
    if encrypted.is_empty() {
        return Ok(None);
    }
    let decrypted = unprotect(&encrypted)?;
    let key = String::from_utf8(decrypted)
        .map_err(|_| "已保存的 API Key 不是有效的文本，请重新保存。".to_string())?;
    let key = normalize_key(&key);
    Ok((!key.is_empty()).then_some(key))
}

pub fn read_key(app: &AppHandle) -> Result<StoredKey, String> {
    let path = key_path(app)?;
    if let Some(key) = read_stored(&path)? {
        return Ok(StoredKey {
            key: Some(key),
            source: "file",
        });
    }
    let env_key = std::env::var(ENV_VAR).map(|value| normalize_key(&value)).unwrap_or_default();
    if env_key.is_empty() {
        Ok(StoredKey {
            key: None,
            source: "none",
        })
    } else {
        Ok(StoredKey {
            key: Some(env_key),
            source: "env",
        })
    }
}

pub fn save_key(app: &AppHandle, value: &str) -> Result<StoredKey, String> {
    let key = normalize_key(value);
    if key.is_empty() {
        return Err("API Key 不能为空。".to_string());
    }
    if key.len() < 12 {
        return Err("API Key 长度不足，请检查是否完整复制。".to_string());
    }
    let path = key_path(app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "无法定位 API Key 目录。".to_string())?;
    fs::create_dir_all(directory).map_err(|cause| format!("创建配置目录失败：{cause}"))?;
    let encrypted = protect(key.as_bytes())?;
    fs::write(&path, encrypted).map_err(|cause| format!("写入 API Key 失败：{cause}"))?;
    Ok(StoredKey {
        key: Some(key),
        source: "file",
    })
}

pub fn delete_key(app: &AppHandle) -> Result<(), String> {
    let path = key_path(app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|cause| format!("删除 API Key 失败：{cause}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_key_strips_whitespace_and_caps_length() {
        assert_eq!(normalize_key(" sk-abc\n123\t"), "sk-abc123");
        assert_eq!(normalize_key(&"a".repeat(600)).len(), MAX_KEY_LEN);
    }

    #[test]
    fn dpapi_roundtrip_matches_the_current_windows_user() {
        let secret = "sk-test-1234567890abcdef";
        let encrypted = protect(secret.as_bytes()).expect("DPAPI should encrypt");
        assert_ne!(encrypted, secret.as_bytes());
        let decrypted = unprotect(&encrypted).expect("DPAPI should decrypt");
        assert_eq!(String::from_utf8(decrypted).unwrap(), secret);
    }
}
