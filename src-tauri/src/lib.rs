// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde_json::json;

const START_MARKER: &str = "# clusterbanned start";
const END_MARKER: &str = "# clusterbanned end";

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn read_hosts_file() -> Result<String, String> {
    let paths = ["C:\\Windows\\System32\\drivers\\etc\\hosts", "/etc/hosts"];
    for p in paths {
        if let Ok(s) = std::fs::read_to_string(p) {
            return Ok(s);
        }
    }
    Err("hosts file not found or unreadable".into())
}

fn parse_blocked_domains_from_text(text: &str) -> Vec<String> {
    let mut set = std::collections::BTreeSet::new();
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let parts: Vec<_> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            for p in &parts[1..] {
                let d = p.to_lowercase();
                if d.contains('.') {
                    set.insert(d);
                }
            }
        }
    }
    set.into_iter().collect()
}

#[tauri::command]
fn read_blocked_domains() -> Result<Vec<String>, String> {
    let text = read_hosts_file()?;
    Ok(parse_blocked_domains_from_text(&text))
}

#[tauri::command]
fn check_hosts_consistency(selections: serde_json::Value) -> Result<serde_json::Value, String> {
    let text = match read_hosts_file() {
        Ok(t) => t,
        Err(_) => return Ok(json!({ "available": false, "mismatch": false, "blocked": [] })),
    };
    let hosts_set: std::collections::BTreeSet<String> =
        parse_blocked_domains_from_text(&text).into_iter().collect();

    // selections is expected to be a map of region -> { domain: bool }
    let mut mismatch = false;

    if let serde_json::Value::Object(map) = selections {
        for (_region, val) in map {
            if let serde_json::Value::Object(domain_map) = val {
                for (domain, enabled_val) in domain_map {
                    let enabled = match enabled_val {
                        serde_json::Value::Bool(b) => b,
                        _ => true,
                    };
                    let hosts_blocked = hosts_set.contains(&domain.to_lowercase());
                    if hosts_blocked != !enabled {
                        mismatch = true;
                        break;
                    }
                }
            }
            if mismatch {
                break;
            }
        }
    }

    Ok(json!({ "available": true, "mismatch": mismatch, "blocked": hosts_set }))
}

#[tauri::command]
fn update_hosts_block(blocked_domains: Vec<String>) -> Result<(), String> {
    // try to find an accessible hosts path and write the block
    let paths = ["C:\\Windows\\System32\\drivers\\etc\\hosts", "/etc/hosts"];

    for p in paths {
        if let Ok(mut content) = std::fs::read_to_string(p) {
            // remove existing block
            let re = regex::Regex::new(&format!(
                "{}[\\s\\S]*?{}",
                regex::escape(START_MARKER),
                regex::escape(END_MARKER)
            ))
            .map_err(|e| e.to_string())?;
            content = re.replace_all(&content, "").to_string();

            // append new block
            let mut block = String::new();
            block.push_str(START_MARKER);
            block.push('\n');
            for d in &blocked_domains {
                block.push_str(&format!("0.0.0.0 {}\n", d));
            }
            block.push_str(END_MARKER);
            if !content.ends_with('\n') {
                content.push('\n');
            }
            content.push_str(&block);
            // try write
            if std::fs::write(p, content).is_ok() {
                return Ok(());
            }
        }
    }
    Err("failed to write hosts (permission or file missing)".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            read_blocked_domains,
            check_hosts_consistency,
            update_hosts_block
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
