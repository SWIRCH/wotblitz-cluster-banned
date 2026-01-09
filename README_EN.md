# World of Tanks Blitz Cluster Banned

![ClasterBanned](https://github.com/SWIRCH/clusterbanned/blob/main/public/banner.png)

<div align="center">
  
![Tauri](https://img.shields.io/badge/Tauri-2.x-FFC131?style=for-the-badge&logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)

**Manage connections to World of Tanks Blitz game servers**

</div>

## 🌎 Translations/Переводы

[Russian](/README.md)
[English](/README_EN.md)

## 📋 Table of Contents

- [🌟 Features](#-features)
- [🎮 Supported Regions](#-supported-regions)
- [🛠 Technologies](#-technologies)
- [📦 Installation](#-installation)
- [🚀 Usage](#-usage)

## 🌟 Features

### 🎯 Main Functions

- **Smart Server Blocking** - Selective disabling of unwanted game clusters
- **Dual Protection** - Combined blocking via hosts file and Windows firewall
- **Automatic Synchronization** - Maintain consistency between settings and actual system state
- **Backup System** - Create hosts file backups with configurable retention
- **Ping Monitoring** - Check latency to servers for optimal connection selection

### 🛡 Blocking Levels

1. **Hosts File** - Traditional domain redirection method
2. **Windows Firewall** - Network-level blocking by IP addresses (more reliable)
3. **Combined Mode** - Simultaneous application of both methods

### 🎨 Interface

- **Intuitive UI** - Modern interface with animation support
- **Multi-regional** - Support for all WoT Blitz game regions
- **Themes & Wallpapers** - Random game event wallpapers
- **Real-time Status** - Monitoring of blocking status and network latency

## 🎮 Supported Regions

| Region            | Servers   | Location                             |
| ----------------- | --------- | ------------------------------------ |
| **Europe**        | 5 servers | Amsterdam, Frankfurt, Warsaw, Almaty |
| **Russia**        | 6 servers | Moscow, Krasnoyarsk, Yekaterinburg   |
| **Asia**          | 3 servers | Singapore, Tokyo                     |
| **North America** | 3 servers | Chicago, Virginia, California        |

## 🛠 Technologies

### Backend (Rust/Tauri)

- **Tauri 2.x** - Modern framework for creating desktop applications
- **Rust** - Safe and performant systems language
- **Windows Firewall API** - Direct firewall rule management
- **File System** - Work with system files (hosts)

### Frontend (TypeScript/React)

- **React 18** - Library for building user interfaces
- **TypeScript** - Typed JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Headless UI** - Accessible UI components

## 📦 Installation

### Quick Installation

Go to [releases](https://github.com/SWIRCH/clusterbanned/releases), find the installer you need: `clusterbanned_x.x.x_x64-setup.exe` or `clusterbanned_x.x.x_x64_en-US.msi`, open it, specify the path, and enjoy.

### Build Application Yourself

### Requirements

- **Windows 10/11** (64-bit)
- **Node.js** 18+ and **npm**
- **Rust** and **Cargo** (installed automatically via rustup)
- **Visual Studio Build Tools** (for Windows)

```bash
# Clone repository
git clone https://github.com/SWIRCH/clusterbanned.git
cd clusterbanned

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build release version
npm run tauri build
```

## 🚀 Usage

### First launch

- Run the application as an administrator to access the system files
- Select the game region in the top menu
- Set up the necessary servers for blocking
