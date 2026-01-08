// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Подключаем плагины (only fs)
        .plugin(tauri_plugin_fs::init())
        // Регистрируем команды
        .invoke_handler(tauri::generate_handler![
            ping_server,
            check_hosts_consistency,
            read_blocked_domains,
            clear_cluster_blocks,
            check_elevation,
            get_app_info,
            test_tauri,
            launch_game,
            debug_network,
            is_process_running,
            kill_process,
            clear_firewall_rules,
            get_firewall_rules,
            update_hosts_block,
            update_firewall_rules,
            update_cluster_rules,
        ])
        // Запускаем приложение
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Helpers for hosts management
use sysinfo::{PidExt, ProcessExt, System, SystemExt};

const START_MARKER: &str = "# clusterbanned start";
const END_MARKER: &str = "# clusterbanned end";

fn hosts_paths() -> [&'static str; 2] {
    ["C:\\Windows\\System32\\drivers\\etc\\hosts", "/etc/hosts"]
}

fn read_hosts_file_text() -> Result<String, String> {
    for p in hosts_paths() {
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
async fn debug_network(hostname: String) -> Result<serde_json::Value, String> {
    use std::net::ToSocketAddrs;
    use std::time::Instant;

    println!("[DEBUG] Testing network for: {}", hostname);

    let mut results = serde_json::json!({});

    // Тест 1: Простое DNS разрешение
    let dns_start = Instant::now();
    let dns_result = format!("{}:80", hostname).to_socket_addrs();
    let dns_time = dns_start.elapsed();

    match dns_result {
        Ok(addrs_iter) => {
            // Конвертируем итератор в вектор
            let addrs: Vec<std::net::SocketAddr> = addrs_iter.collect();
            let ips: Vec<String> = addrs.iter().take(3).map(|a| a.ip().to_string()).collect();

            results["dns"] = serde_json::json!({
                "success": true,
                "ips": ips,
                "time_ms": dns_time.as_millis()
            });
            println!("[DEBUG] DNS resolved: {:?}", ips);

            // Тест 2: Попробовать TCP на первый IP
            if let Some(first_ip) = ips.get(0) {
                let ports = vec![80, 443, 8080, 8443];
                let mut tcp_tests = Vec::new();

                for port in ports {
                    let addr = format!("{}:{}", first_ip, port);
                    let tcp_start = Instant::now();

                    // Парсим адрес
                    if let Ok(socket_addr) = addr.parse::<std::net::SocketAddr>() {
                        match std::net::TcpStream::connect_timeout(
                            &socket_addr,
                            std::time::Duration::from_millis(2000),
                        ) {
                            Ok(_) => {
                                let time = tcp_start.elapsed();
                                tcp_tests.push(serde_json::json!({
                                    "port": port,
                                    "success": true,
                                    "time_ms": time.as_millis()
                                }));
                                println!("[DEBUG] TCP connected to {}:{}", first_ip, port);
                            }
                            Err(e) => {
                                let time = tcp_start.elapsed();
                                tcp_tests.push(serde_json::json!({
                                    "port": port,
                                    "success": false,
                                    "error": e.to_string(),
                                    "time_ms": time.as_millis()
                                }));
                                println!("[DEBUG] TCP failed to {}:{} - {}", first_ip, port, e);
                            }
                        }
                    } else {
                        tcp_tests.push(serde_json::json!({
                            "port": port,
                            "success": false,
                            "error": "Failed to parse socket address",
                            "time_ms": 0
                        }));
                    }
                }
                results["tcp"] = serde_json::json!(tcp_tests);
            }
        }
        Err(e) => {
            results["dns"] = serde_json::json!({
                "success": false,
                "error": e.to_string(),
                "time_ms": dns_time.as_millis()
            });
            println!("[DEBUG] DNS failed: {}", e);
        }
    }

    // Тест 3: Системная команда (если DNS не работает)
    #[cfg(windows)]
    {
        let cmd_start = Instant::now();
        let output = std::process::Command::new("cmd")
            .args(&["/C", "ping", "-n", "1", &hostname])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                results["system_ping"] = serde_json::json!({
                    "success": out.status.success(),
                    "exit_code": out.status.code().unwrap_or(-1),
                    "stdout": stdout.to_string(),
                    "stderr": stderr.to_string(),
                    "time_ms": cmd_start.elapsed().as_millis()
                });
                println!("[DEBUG] System ping output: {}", stdout);
            }
            Err(e) => {
                results["system_ping"] = serde_json::json!({
                    "success": false,
                    "error": e.to_string(),
                    "time_ms": cmd_start.elapsed().as_millis()
                });
                println!("[DEBUG] System ping failed: {}", e);
            }
        }
    }

    #[cfg(not(windows))]
    {
        // Для Linux/Mac
        let cmd_start = Instant::now();
        let output = std::process::Command::new("ping")
            .args(&["-c", "1", &hostname])
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                results["system_ping"] = serde_json::json!({
                    "success": out.status.success(),
                    "exit_code": out.status.code().unwrap_or(-1),
                    "stdout": stdout.to_string(),
                    "stderr": stderr.to_string(),
                    "time_ms": cmd_start.elapsed().as_millis()
                });
                println!("[DEBUG] System ping output: {}", stdout);
            }
            Err(e) => {
                results["system_ping"] = serde_json::json!({
                    "success": false,
                    "error": e.to_string(),
                    "time_ms": cmd_start.elapsed().as_millis()
                });
                println!("[DEBUG] System ping failed: {}", e);
            }
        }
    }

    Ok(results)
}

// Команда 1: Проверка ping (не блокирующая, выполняется в blocking-пуле с таймаутом)
#[tauri::command]
async fn ping_server(
    hostname: String,
    timeout_ms: Option<u64>,
    _port: Option<u16>,
) -> Result<serde_json::Value, String> {
    use std::process::Command;
    use std::time::Instant;

    println!("[TAURI] ping_server called for: {}", hostname);

    let start = Instant::now();
    let timeout_sec = (timeout_ms.unwrap_or(600) as f64 / 1000.0).ceil() as u64;

    #[cfg(windows)]
    let output = Command::new("ping")
        .args(&[
            "-n",
            "1",
            "-w",
            &(timeout_sec * 1000).to_string(),
            &hostname,
        ])
        .output();

    #[cfg(not(windows))]
    let output = Command::new("ping")
        .args(&["-c", "1", "-W", &timeout_sec.to_string(), &hostname])
        .output();

    match output {
        Ok(output) => {
            let elapsed = start.elapsed().as_millis() as u64;
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);

            if output.status.success() {
                // Парсим время из вывода
                if let Some(ping_time) = parse_ping_time(&stdout) {
                    Ok(serde_json::json!({
                        "ping": ping_time,
                        "status": "ok",
                        "method": "icmp",
                        "elapsed_ms": elapsed
                    }))
                } else {
                    // Если не удалось распарсить время
                    Ok(serde_json::json!({
                        "ping": elapsed,
                        "status": "ok_no_time",
                        "method": "icmp",
                        "output": stdout.to_string(),
                        "elapsed_ms": elapsed
                    }))
                }
            } else {
                // Проверяем тип ошибки
                let status = if stdout.contains("timed out") || stdout.contains("Request timed out")
                {
                    "timeout"
                } else if stdout.contains("Destination host unreachable") {
                    "unreachable"
                } else if stdout.contains("could not find host")
                    || stderr.contains("could not find host")
                {
                    "dns_error"
                } else {
                    "error"
                };

                Ok(serde_json::json!({
                    "ping": null,
                    "status": status,
                    "error": format!("{} - {}", stdout, stderr),
                    "elapsed_ms": elapsed
                }))
            }
        }
        Err(e) => {
            let elapsed = start.elapsed().as_millis() as u64;
            Ok(serde_json::json!({
                "ping": null,
                "status": "command_error",
                "error": e.to_string(),
                "elapsed_ms": elapsed
            }))
        }
    }
}

fn parse_ping_time(output: &str) -> Option<u64> {
    // Ищем строки типа "time=64ms" в выводе ping
    for line in output.lines() {
        let line = line.trim();

        // Формат Windows: "Reply from 92.223.31.134: bytes=32 time=64ms TTL=45"
        if let Some(pos) = line.find("time=") {
            let after_time = &line[pos + 5..];
            if let Some(end) = after_time.find("ms") {
                let time_str = &after_time[..end].trim();
                if let Ok(time) = time_str.parse::<u64>() {
                    return Some(time);
                }
            }
        }

        // Формат Linux: "64 bytes from ...: icmp_seq=1 ttl=45 time=63.8 ms"
        if let Some(pos) = line.find("time=") {
            let after_time = &line[pos + 5..];
            if let Some(end) = after_time.find(" ms") {
                let time_str = &after_time[..end].trim();
                if let Ok(time) = time_str.parse::<f64>() {
                    return Some(time as u64);
                }
            }
        }
    }

    None
}

// Команда 2: Проверка consistency hosts
#[tauri::command]
fn check_hosts_consistency(selections: serde_json::Value) -> Result<serde_json::Value, String> {
    println!("[TAURI] check_hosts_consistency called");

    match read_hosts_file_text() {
        Ok(text) => {
            let blocked = parse_blocked_domains_from_text(&text);
            let blocked_set: std::collections::BTreeSet<String> = blocked.iter().cloned().collect();

            // selections is expected to be a map of region -> { domain: bool }
            let mut mismatch = false;

            if let serde_json::Value::Object(map) = selections {
                'outer: for (_region, val) in map {
                    if let serde_json::Value::Object(domain_map) = val {
                        for (domain, enabled_val) in domain_map {
                            let enabled = match enabled_val {
                                serde_json::Value::Bool(b) => b,
                                _ => true,
                            };
                            let hosts_blocked = blocked_set.contains(&domain.to_lowercase());
                            if hosts_blocked != !enabled {
                                mismatch = true;
                                break 'outer;
                            }
                        }
                    }
                }
            }

            Ok(serde_json::json!({ "blocked": blocked, "mismatch": mismatch, "message": "ok" }))
        }
        Err(e) => Ok(serde_json::json!({ "blocked": [], "mismatch": false, "message": e })),
    }
}

// Команда: Проверить, запущен ли процесс с правами записи в hosts (проверка привилегий)
#[tauri::command]
fn check_elevation() -> Result<serde_json::Value, String> {
    println!("[TAURI] check_elevation called");
    let path = hosts_paths()
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .cloned()
        .unwrap_or(hosts_paths()[0]);

    match std::fs::OpenOptions::new()
        .write(true)
        .append(true)
        .open(path)
    {
        Ok(_) => Ok(serde_json::json!({"isAdmin": true, "path": path})),
        Err(e) => {
            Ok(serde_json::json!({"isAdmin": false, "path": path, "error": format!("{}", e)}))
        }
    }
}

// Команда 3: Обновление hosts (региональная поддержка и аккуратная работа с переводами строк)
#[tauri::command]
fn update_hosts_block(
    blocked_domains: Option<Vec<String>>,
    blockedDomains: Option<Vec<String>>,
    remove: Option<bool>,
    region: Option<String>,
    args: Option<serde_json::Value>,
    backup_saved: Option<bool>,
) -> Result<String, String> {
    // Prefer directly provided named params (matches Tauri's expected mapping)
    let mut blocked: Option<Vec<String>> = blocked_domains.or(blockedDomains);
    let backup_saved = backup_saved.unwrap_or(false);

    // If not provided, try to extract from the optional `args` wrapper
    if blocked.is_none() {
        if let Some(v) = args.as_ref() {
            let mut payload = v.clone();
            if let Some(inner) = payload.get("args") {
                payload = inner.clone();
            }
            if let Some(arr) = payload
                .get("blocked_domains")
                .or_else(|| payload.get("blockedDomains"))
            {
                if let Some(a) = arr.as_array() {
                    blocked = Some(
                        a.iter()
                            .filter_map(|x| x.as_str().map(|s| s.to_string()))
                            .collect(),
                    );
                } else {
                    return Err("blocked_domains must be an array of strings".into());
                }
            }
        }
    }

    let blocked_domains = match blocked {
        Some(v) => v,
        None => {
            return Err("command update_hosts_block missing required key blocked_domains".into())
        }
    };

    // Extract region if provided directly or via args wrapper
    let mut region_str: Option<String> = region;
    if region_str.is_none() {
        if let Some(v) = args.as_ref() {
            if let Some(inner) = v.get("args") {
                if let Some(r) = inner.get("region").and_then(|x| x.as_str()) {
                    region_str = Some(r.to_string());
                }
            }
            if region_str.is_none() {
                if let Some(r) = v.get("region").and_then(|x| x.as_str()) {
                    region_str = Some(r.to_string());
                }
            }
        }
    }

    println!(
        "[TAURI] update_hosts_block called with: {:?} region: {:?}",
        blocked_domains, region_str
    );

    // Find a hosts file path we can read (prefer the first existing), or default to the Windows path
    let path = hosts_paths()
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .cloned()
        .unwrap_or(hosts_paths()[0]);

    // Read original
    let original = std::fs::read_to_string(path)
        .map_err(|e| format!("failed to read hosts file ({}): {}", path, e))?;
    let mut content = original.clone();

    // Find existing block indices for the target region (if any). We allow multiple blocks, each may include a region tag on the START_MARKER line.
    let mut maybe_block_range: Option<(usize, usize)> = None;
    let mut idx = 0usize;
    while let Some(rel_start) = content[idx..].find(START_MARKER) {
        let start_idx = idx + rel_start;
        if let Some(rel_end) = content[start_idx..].find(END_MARKER) {
            let end_idx = start_idx + rel_end + END_MARKER.len();
            let first_line = content[start_idx..].lines().next().unwrap_or("");
            // parse optional region tag like "# clusterbanned start region:my_region"
            let mut block_region_tag: Option<String> = None;
            if let Some(pos) = first_line.find("region:") {
                let tag = first_line[pos + "region:".len()..]
                    .trim()
                    .split_whitespace()
                    .next()
                    .unwrap_or("")
                    .to_string();
                if !tag.is_empty() {
                    block_region_tag = Some(tag);
                }
            }

            if let Some(ref target) = region_str {
                if let Some(br) = &block_region_tag {
                    if br == target {
                        maybe_block_range = Some((start_idx, end_idx));
                        break;
                    }
                }
            } else {
                // No region specified: pick the first block found (back-compat)
                maybe_block_range = Some((start_idx, end_idx));
                break;
            }

            idx = end_idx; // continue searching
        } else {
            break;
        }
    }

    // Determine if this is a removal (unblock) operation: look at explicit 'remove' param or args wrapper
    let mut remove_flag = false;
    if let Some(b) = remove {
        remove_flag = b;
    } else if let Some(args_val) = &args {
        if let Some(inner) = args_val.get("args") {
            if let Some(r) = inner.get("remove") {
                remove_flag = r.as_bool().unwrap_or(false);
            }
        }
        if !remove_flag {
            if let Some(r) = args_val.get("remove") {
                remove_flag = r.as_bool().unwrap_or(false);
            }
        }
    }

    // If remove mode is requested, remove the supplied domains from the existing block (if present)
    if remove_flag {
        if maybe_block_range.is_none() {
            return Ok("No cluster entries to update".to_string());
        }
        let (start_idx, end_idx) = maybe_block_range.unwrap();
        let block_str = &content[start_idx..end_idx];
        let mut existing: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
        for line in block_str.lines() {
            let t = line.trim();
            if t == START_MARKER || t == END_MARKER || t.is_empty() {
                continue;
            }
            let parts: Vec<_> = t.split_whitespace().collect();
            if parts.len() >= 2 {
                existing.insert(parts[1].to_lowercase());
            }
        }

        let remove_set: std::collections::BTreeSet<String> =
            blocked_domains.iter().map(|s| s.to_lowercase()).collect();
        let remaining: Vec<String> = existing.difference(&remove_set).cloned().collect();

        if remaining.len() == existing.len() {
            return Ok("No matching entries to remove".to_string());
        }

        // Build replacement (empty => remove block)
        let replacement = if remaining.is_empty() {
            String::new()
        } else {
            let mut b = String::new();
            if let Some(ref r) = region_str {
                b.push_str(&format!("{} region:{}", START_MARKER, r));
            } else {
                b.push_str(START_MARKER);
            }
            b.push('\n');
            for d in &remaining {
                b.push_str(&format!("0.0.0.0 {}\n", d));
            }
            b.push_str(END_MARKER);
            b
        };

        // Replace the block in the content
        content.replace_range(start_idx..end_idx, &replacement);

        // Collapse excessive blank lines (prevent leftover double spacing)
        while content.contains("\n\n\n") {
            content = content.replace("\n\n\n", "\n\n");
        }
        
        if(backup_saved){
            // Backup original
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("failed to compute timestamp for backup: {}", e))?
                .as_secs();
            let backup_path = format!("{}.clusterbanned.bak.{}", path, ts);
            std::fs::write(&backup_path, original.as_bytes())
                .map_err(|e| format!("failed to write backup {}: {}", backup_path, e))?;
        }

        // Try to write new hosts content
        std::fs::write(path, content.as_bytes()).map_err(|e| {
            format!(
                "failed to write hosts file ({}): {}. Try running the app with elevated privileges",
                path, e
            )
        })?;

        if remaining.is_empty() {
            return Ok(format!("Removed clusterbanned block (wrote to {})", path));
        } else {
            return Ok(format!(
                "Removed {} entries, left {} entries (wrote to {})",
                remove_set.len() - remaining.len(),
                remaining.len(),
                path
            ));
        }
    }

    // Normal (blocking) path: remove existing block for this region (if any) and append new block for the given region
    let had_block = maybe_block_range.is_some();
    if let Some((start_idx, end_idx)) = maybe_block_range {
        content.replace_range(start_idx..end_idx, "");
        // collapse leftover multiple blanklines
        while content.contains("\n\n\n") {
            content = content.replace("\n\n\n", "\n\n");
        }
    }

    if !blocked_domains.is_empty() {
        // Build a region-tagged block (if region specified)
        let mut block = String::new();
        if let Some(ref r) = region_str {
            block.push_str(&format!("{} region:{}", START_MARKER, r));
        } else {
            block.push_str(START_MARKER);
        }
        block.push('\n');
        for d in &blocked_domains {
            block.push_str(&format!("0.0.0.0 {}\n", d));
        }
        block.push_str(END_MARKER);

        // Normalize spacing: trim trailing newlines from content and ensure exactly one blank line before block
        content = content.trim_end_matches('\n').to_string();
        content.push('\n');
        content.push('\n');
        content.push_str(&block);
        content.push('\n'); // ensure file ends with a single newline

        if(backup_saved){
            // Backup original
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("failed to compute timestamp for backup: {}", e))?
                .as_secs();
            let backup_path = format!("{}.clusterbanned.bak.{}", path, ts);
            std::fs::write(&backup_path, original.as_bytes())
                .map_err(|e| format!("failed to write backup {}: {}", backup_path, e))?;
        }

        // Try to write new hosts content
        std::fs::write(path, content.as_bytes()).map_err(|e| {
            format!(
                "failed to write hosts file ({}): {}. Try running the app with elevated privileges",
                path, e
            )
        })?;

        return Ok(format!(
            "Successfully blocked {} domains (wrote to {})",
            blocked_domains.len(),
            path
        ));
    } else if had_block {
        // We removed the existing block; this means we've unblocked everything for clusterbanned (for this region)
        
        if(backup_saved){
            // Backup original
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("failed to compute timestamp for backup: {}", e))?
                .as_secs();
            let backup_path = format!("{}.clusterbanned.bak.{}", path, ts);
            std::fs::write(&backup_path, original.as_bytes())
                .map_err(|e| format!("failed to write backup {}: {}", backup_path, e))?;
        }

        // Write content (block removed)
        std::fs::write(path, content.as_bytes()).map_err(|e| {
            format!(
                "failed to write hosts file ({}): {}. Try running the app with elevated privileges",
                path, e
            )
        })?;

        return Ok(format!("Removed clusterbanned block (wrote to {})", path));
    } else {
        // Nothing to do
        return Ok("No cluster entries to update".to_string());
    }
}

#[tauri::command]
fn update_firewall_rules(
    region_id: String,
    blocked_domains: Vec<String>,
    enable: bool, // true = блокировать, false = разблокировать
) -> Result<String, String> {
    println!("[TAURI] update_firewall_rules CALLED");
    println!("  region_id: '{}'", region_id);
    println!("  blocked_domains: {:?}", blocked_domains);
    println!("  enable: {}", enable);

    // Если параметры пустые, вернем ошибку сразу
    if region_id.is_empty() {
        println!("[TAURI] ERROR: region_id is empty!");
        return Err("region_id is empty".into());
    }

    #[cfg(windows)]
    {
        use serde_json::Value;

        println!(
            "[TAURI] update_firewall_rules called for region: {}, enable: {}",
            region_id, enable
        );

        // Получаем данные о кластерах из файла
        let clusters_data: Value =
            serde_json::from_str(include_str!("../../src/data/servers.json"))
                .map_err(|e| format!("Failed to parse servers.json: {}", e))?;

        let mut results = Vec::new();
        let mut total_ips_blocked = 0;

        if let Value::Array(regions) = &clusters_data["clusters"] {
            for region_data in regions {
                if region_data["id"].as_str() == Some(&region_id) {
                    if let Value::Array(clusters) = &region_data["clusters"] {
                        for cluster in clusters {
                            if let Some(domain) = cluster["domain"].as_str() {
                                let should_process = blocked_domains.contains(&domain.to_string());

                                if should_process {
                                    if let Value::Array(ips_array) = &cluster["ips"] {
                                        let ips: Vec<String> = ips_array
                                            .iter()
                                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                            .filter(|s| !s.is_empty())
                                            .collect();

                                        if !ips.is_empty() {
                                            match block_with_firewall(
                                                domain.to_string(),
                                                ips.clone(),
                                                enable,
                                            ) {
                                                Ok(msg) => {
                                                    results.push(format!("{}: {}", domain, msg));
                                                    total_ips_blocked += ips.len();
                                                }
                                                Err(e) => results.push(format!(
                                                    "Failed to {} {}: {}",
                                                    if enable { "block" } else { "unblock" },
                                                    domain,
                                                    e
                                                )),
                                            }
                                        } else {
                                            results.push(format!("No IPs found for {}", domain));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
            }
        }

        if results.is_empty() {
            Ok(format!(
                "No firewall rules {} for region {}",
                if enable { "added" } else { "removed" },
                region_id
            ))
        } else {
            let summary = format!(
                "{} {} IPs across {} domains",
                if enable { "Blocked" } else { "Unblocked" },
                total_ips_blocked,
                results.len()
            );
            results.insert(0, summary);
            Ok(results.join("\n"))
        }
    }

    #[cfg(not(windows))]
    {
        Ok("Firewall rules only supported on Windows".into())
    }
}

// Команда 4: Чтение заблокированных доменов
#[tauri::command]
fn read_blocked_domains() -> Result<Vec<String>, String> {
    println!("[TAURI] read_blocked_domains called");

    match read_hosts_file_text() {
        Ok(text) => Ok(parse_blocked_domains_from_text(&text)),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn update_cluster_rules(
    region_id: String,
    blocked_domains: Vec<String>,
    enable: bool, // true = блокировать, false = разблокировать
    use_hosts: bool,
    use_firewall: bool,
) -> Result<serde_json::Value, String> {
    println!(
        "[TAURI] update_cluster_rules called: region={}, enable={}, hosts={}, firewall={}",
        region_id, enable, use_hosts, use_firewall
    );

    let mut results = serde_json::json!({
        "success": true,
        "hosts": "",
        "firewall": ""
    });

    // 1. Обновляем hosts файл если нужно
    if use_hosts {
        match if enable {
            update_hosts_block(
                Some(blocked_domains.clone()),
                None,
                Some(false),
                Some(region_id.clone()),
                None,
                None,
            )
        } else {
            update_hosts_block(
                Some(blocked_domains.clone()),
                None,
                Some(true),
                Some(region_id.clone()),
                None,
                None,
            )
        } {
            Ok(msg) => results["hosts"] = serde_json::Value::String(msg),
            Err(e) => {
                results["success"] = serde_json::Value::Bool(false);
                results["hosts"] = serde_json::Value::String(format!("Error: {}", e));
            }
        }
    } else {
        results["hosts"] = serde_json::Value::String("Skipped".into());
    }

    // 2. Обновляем правила брандмауэра если нужно
    if use_firewall {
        match update_firewall_rules(region_id.clone(), blocked_domains.clone(), enable) {
            Ok(msg) => results["firewall"] = serde_json::Value::String(msg),
            Err(e) => {
                results["success"] = serde_json::Value::Bool(false);
                results["firewall"] = serde_json::Value::String(format!("Error: {}", e));
            }
        }
    } else {
        results["firewall"] = serde_json::Value::String("Skipped".into());
    }

    Ok(results)
}

// Команда 4.1: Очистить все блоки, созданные clusterbanned (не трогая остальное)
#[tauri::command]
fn clear_cluster_blocks(backup_saved: bool) -> Result<String, String> {
    println!("[TAURI] clear_cluster_blocks called");

    let mut messages = Vec::new();

    // 1. Очищаем hosts файл
    let path = hosts_paths()
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .cloned()
        .unwrap_or(hosts_paths()[0]);

    let original = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read hosts file ({}): {}", path, e))?;
    let mut content = original.clone();

    println!("[TAURI] Hosts file size: {} bytes", content.len());

    // Ищем ВСЕ блоки, начинающиеся с "# clusterbanned"
    let mut removed = 0usize;
    let mut position = 0;

    loop {
        // Ищем любое вхождение "# clusterbanned" (может быть с region tag)
        if let Some(start_idx) = content[position..].find("# clusterbanned") {
            let actual_start = position + start_idx;

            // Найдем конец этой строки
            let line_end = content[actual_start..]
                .find('\n')
                .map(|pos| actual_start + pos + 1)
                .unwrap_or(content.len());

            // Теперь ищем END_MARKER после этой строки
            if let Some(rel_end) = content[line_end..].find("# clusterbanned end") {
                let end_idx = line_end + rel_end + "# clusterbanned end".len();

                // Удаляем блок
                content.replace_range(actual_start..end_idx, "");
                removed += 1;

                println!(
                    "[TAURI] Removed block {} at position {}-{}",
                    removed, actual_start, end_idx
                );

                // Продолжаем поиск с той же позиции (так как content изменился)
                position = actual_start;
                continue;
            } else {
                // END_MARKER не найден, прерываем
                break;
            }
        }
        break;
    }

    // Убираем лишние пустые строки
    while content.contains("\n\n\n") {
        content = content.replace("\n\n\n", "\n\n");
    }

    // Убираем возможные пустые строки в начале/конце
    content = content.trim().to_string();
    if !content.ends_with('\n') {
        content.push('\n');
    }

    println!("[TAURI] Removed {} blocks total", removed);

    if removed > 0 {
        if backup_saved {
            // Backup original
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| format!("failed to compute timestamp for backup: {}", e))?
                .as_secs();
            let backup_path = format!("{}.clusterbanned.bak.{}", path, ts);

            println!("[TAURI] Creating backup: {}", backup_path);

            if let Err(e) = std::fs::write(&backup_path, original.as_bytes()) {
                messages.push(format!("Backup failed: {}", e));
            } else {
                messages.push(format!("Backup created: {}", backup_path));
            }
        }

        // Записываем обновленный файл
        println!("[TAURI] Writing updated hosts file to: {}", path);
        match std::fs::write(&path, content.as_bytes()) {
            Ok(_) => messages.push(format!(
                "Successfully removed {} block(s) from hosts",
                removed
            )),
            Err(e) => {
                let error_msg = format!("Failed to write hosts file ({}): {}. Try running the app with elevated privileges", path, e);
                println!("[TAURI] {}", error_msg);
                messages.push(error_msg);
            }
        }
    } else {
        messages.push("No clusterbanned blocks found in hosts".into());
        println!("[TAURI] No blocks found to remove");
    }

    // 2. Очищаем все правила брандмауэра
    #[cfg(windows)]
    {
        println!("[TAURI] Cleaning up firewall rules...");
        match clear_firewall_rules() {
            Ok(fw_msg) => {
                messages.push(fw_msg);
                println!("[TAURI] Firewall cleanup successful");
            }
            Err(e) => {
                let error_msg = format!("Firewall cleanup error: {}", e);
                messages.push(error_msg.clone());
                println!("[TAURI] {}", error_msg);
            }
        }
    }

    #[cfg(not(windows))]
    {
        messages.push("Firewall cleanup skipped (Windows only)".into());
    }

    let result = messages.join("\n");
    println!("[TAURI] clear_cluster_blocks result: {}", result);
    Ok(result)
}

// Команда 5: Получение информации о приложении
#[tauri::command]
fn get_app_info() -> Result<serde_json::Value, String> {
    let info = serde_json::json!({
        "name": "WoT Blitz Cluster Banned",
        "version": "0.1.0",
        "tauri_version": "2.x",
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    });

    Ok(info)
}

// Команда 6: Тестовая команда для проверки связи
#[tauri::command]
fn test_tauri() -> Result<String, String> {
    println!("[TAURI] test_tauri called - connection is working!");
    Ok("Tauri backend is working correctly! ✅".to_string())
}

// Launch a game via protocol (steam://rungameid/<id>) or platform default opener
#[tauri::command]
fn launch_game(appid: String) -> Result<String, String> {
    println!("[TAURI] launch_game called for appid: {}", appid);
    let uri = format!("steam://rungameid/{}", appid);
    // Platform-specific open
    #[cfg(target_os = "windows")]
    {
        // Use cmd start to honor URL schemes
        let res = std::process::Command::new("cmd")
            .args(&["/C", "start", "", &uri])
            .spawn();
        match res {
            Ok(_child) => Ok(uri),
            Err(e) => Err(format!("failed to launch {}: {}", uri, e)),
        }
    }

    #[cfg(target_os = "macos")]
    {
        let res = std::process::Command::new("open").arg(&uri).spawn();
        match res {
            Ok(_child) => Ok(uri),
            Err(e) => Err(format!("failed to launch {}: {}", uri, e)),
        }
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let res = std::process::Command::new("xdg-open").arg(&uri).spawn();
        match res {
            Ok(_child) => Ok(uri),
            Err(e) => Err(format!("failed to launch {}: {}", uri, e)),
        }
    }
}

// Check if a process with a name substring is running
#[tauri::command]
fn is_process_running(name: String) -> Result<bool, String> {
    println!("[TAURI] is_process_running called for: {}", name);
    let mut sys = sysinfo::System::new_all();
    sys.refresh_processes();
    let needle = name.to_lowercase();
    for (_pid, process) in sys.processes() {
        if process.name().to_lowercase().contains(&needle) {
            return Ok(true);
        }
        // Also check cmd line
        if let Some(cmd) = process.cmd().get(0) {
            if cmd.to_lowercase().contains(&needle) {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

// Kill process(es) matching name substring (best-effort)
#[tauri::command]
fn kill_process(name: String) -> Result<String, String> {
    println!("[TAURI] kill_process called for: {}", name);
    let mut sys = sysinfo::System::new_all();
    sys.refresh_processes();
    let needle = name.to_lowercase();
    let mut killed = 0usize;

    for (pid, process) in sys.processes() {
        if process.name().to_lowercase().contains(&needle)
            || process
                .cmd()
                .iter()
                .any(|s| s.to_lowercase().contains(&needle))
        {
            let pid_u = pid.as_u32();
            #[cfg(target_os = "windows")]
            {
                if let Ok(st) = std::process::Command::new("taskkill")
                    .args(&["/PID", &pid_u.to_string(), "/F"])
                    .status()
                {
                    if st.success() {
                        killed += 1;
                    }
                }
            }

            #[cfg(not(target_os = "windows"))]
            {
                if let Ok(st) = std::process::Command::new("kill")
                    .arg("-TERM")
                    .arg(pid_u.to_string())
                    .status()
                {
                    if st.success() {
                        killed += 1;
                    }
                }
            }
        }
    }

    Ok(format!("killed {} processes", killed))
}

#[tauri::command]
fn block_with_firewall(domain: String, ips: Vec<String>, enable: bool) -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::process::Command;

        let mut results = Vec::new();
        let rule_name = format!("WoT_Blitz_Block_{}", domain.replace(".", "_"));

        if enable {
            // Сначала удаляем существующее правило, если есть
            let _ = Command::new("netsh")
                .args(&[
                    "advfirewall",
                    "firewall",
                    "delete",
                    "rule",
                    &format!("name={}", rule_name),
                ])
                .output();

            // Блокируем каждый IP отдельно или все вместе
            let ips_str = ips.join(",");

            let output = Command::new("netsh")
                .args(&[
                    "advfirewall",
                    "firewall",
                    "add",
                    "rule",
                    &format!("name={}", rule_name),
                    "dir=out",
                    "action=block",
                    &format!("remoteip={}", ips_str),
                    "protocol=any",
                    "enable=yes",
                    "profile=any",
                ])
                .output()
                .map_err(|e| format!("Failed to create firewall rule: {}", e))?;

            if output.status.success() {
                results.push(format!(
                    "Firewall rule created for {} ({} IPs)",
                    domain,
                    ips.len()
                ));
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // Пробуем создать правила для каждого IP отдельно
                if stderr.contains("remoteip") {
                    for ip in ips {
                        let ip_rule_name = format!("{}_{}", rule_name, ip.replace(".", "_"));
                        let output = Command::new("netsh")
                            .args(&[
                                "advfirewall",
                                "firewall",
                                "add",
                                "rule",
                                &format!("name={}", ip_rule_name),
                                "dir=out",
                                "action=block",
                                &format!("remoteip={}", ip),
                                "protocol=any",
                                "enable=yes",
                                "profile=any",
                            ])
                            .output();

                        if let Ok(out) = output {
                            if out.status.success() {
                                results.push(format!("Blocked IP: {}", ip));
                            }
                        }
                    }
                } else {
                    return Err(format!("Failed to create firewall rule: {}", stderr));
                }
            }
        } else {
            // Удаляем правило
            let output = Command::new("netsh")
                .args(&[
                    "advfirewall",
                    "firewall",
                    "delete",
                    "rule",
                    &format!("name={}", rule_name),
                ])
                .output();

            // Также удаляем отдельные правила IP
            for ip in ips {
                let ip_rule_name = format!("{}_{}", rule_name, ip.replace(".", "_"));
                let _ = Command::new("netsh")
                    .args(&[
                        "advfirewall",
                        "firewall",
                        "delete",
                        "rule",
                        &format!("name={}", ip_rule_name),
                    ])
                    .output();
            }

            if let Ok(out) = output {
                if out.status.success() {
                    results.push(format!("Firewall rule removed for {}", domain));
                } else {
                    results.push(format!(
                        "Note: Firewall rule for {} may not have existed",
                        domain
                    ));
                }
            }
        }

        if results.is_empty() {
            Ok("No firewall changes made".into())
        } else {
            Ok(results.join("\n"))
        }
    }

    #[cfg(not(windows))]
    {
        Ok("Firewall rules only supported on Windows".into())
    }
}

#[tauri::command]
fn clear_firewall_rules() -> Result<String, String> {
    #[cfg(windows)]
    {
        use std::process::Command;

        let mut results = Vec::new();

        // Удаляем все правила, созданные нашим приложением
        let prefixes = ["WoT_Blitz_Block_", "WoT_Block_", "ClusterBanned_"];

        for prefix in prefixes {
            // Получаем список правил
            let output = Command::new("netsh")
                .args(&["advfirewall", "firewall", "show", "rule", "name=all"])
                .output();

            if let Ok(out) = output {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    if line.contains(prefix) {
                        if let Some(rule_name) = line.split("Rule Name:").nth(1) {
                            let rule_name = rule_name.trim();
                            let delete_output = Command::new("netsh")
                                .args(&[
                                    "advfirewall",
                                    "firewall",
                                    "delete",
                                    "rule",
                                    &format!("name={}", rule_name),
                                ])
                                .output();

                            if let Ok(del_out) = delete_output {
                                if del_out.status.success() {
                                    results.push(format!("Deleted rule: {}", rule_name));
                                }
                            }
                        }
                    }
                }
            }
        }

        if results.is_empty() {
            Ok("No firewall rules found to delete".into())
        } else {
            Ok(format!("Deleted {} firewall rules", results.len()))
        }
    }

    #[cfg(not(windows))]
    {
        Ok("Firewall rules only supported on Windows".into())
    }
}

#[tauri::command]
fn get_firewall_rules() -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        use std::process::Command;

        let output = Command::new("netsh")
            .args(&["advfirewall", "firewall", "show", "rule", "name=all"])
            .output()
            .map_err(|e| format!("Failed to get firewall rules: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut rules = Vec::new();

        for line in stdout.lines() {
            if line.contains("Rule Name:")
                && (line.contains("WoT_Blitz")
                    || line.contains("WoT_Block")
                    || line.contains("ClusterBanned"))
            {
                rules.push(line.trim().to_string());
            }
        }

        Ok(rules)
    }

    #[cfg(not(windows))]
    {
        Ok(vec!["Firewall rules only supported on Windows".into()])
    }
}
