# Hướng Dẫn Về Dữ Liệu Profile

## 📍 Vị Trí Lưu Trữ Dữ Liệu Profile

Khi bạn tạo profile trong app, dữ liệu được lưu trữ tại:

### 1. File Profiles (Dữ liệu Profile)

**Đường dẫn:** `server/profiles.json`

File này chứa tất cả các profile đã được tạo, bao gồm:

- Thông tin profile (tên, device type, OS, browser, user agent, timezone)
- Cấu hình hardware (CPU cores, RAM, GPU, screen resolution, noise settings)
- Proxy ID được gán cho profile
- User ID (email của người tạo)
- Trạng thái (status: stopped/running)
- Timestamps (createdAt, updatedAt)

### 2. File Database (Dữ liệu User)

**Đường dẫn:** `server/database.json`

File này chứa thông tin người dùng:

- Email
- Password (đã hash hoặc plain text)
- Tên người dùng
- Role (admin/user)

### 3. File Proxies (Dữ liệu Proxy)

**Đường dẫn:** `server/proxies.json`

File này chứa danh sách các proxy đã thêm vào hệ thống.

---

## 🔍 Cách Xem Dữ Liệu Profile

### Cách 1: Xem trực tiếp bằng Text Editor

1. Mở file `server/profiles.json` bằng Notepad, VS Code, hoặc bất kỳ text editor nào
2. File được format JSON, dễ đọc với cấu trúc:

```json
[
  {
    "userId": "admin@gmail.com",
    "name": "Profile Name",
    "deviceType": "desktop",
    "os": "windows",
    "browser": "chrome",
    "userAgent": "...",
    "timezone": "auto",
    "hardware": {
      "cpuCores": 8,
      "ram": 16,
      "gpu": "NVIDIA GeForce RTX 3060",
      "screenResolution": "1920x1080",
      "audioContextNoise": true,
      "canvasNoise": true,
      "webGLNoise": true,
      "webRTCPolicy": "disable"
    },
    "status": "stopped",
    "proxyId": "1765707680447",
    "id": "1765707758356",
    "createdAt": 1765707758357,
    "updatedAt": 1765712238129
  }
]
```

### Cách 2: Xem bằng PowerShell (Format đẹp)

```powershell
# Di chuyển vào thư mục server
cd "D:\ASM\DoAn\version3 - Copy\server"

# Xem toàn bộ profiles (format JSON đẹp)
Get-Content profiles.json | ConvertFrom-Json | ConvertTo-Json -Depth 10

# Xem danh sách tên profiles
Get-Content profiles.json | ConvertFrom-Json | Select-Object name, userId, status, createdAt

# Xem chi tiết một profile cụ thể (theo ID)
Get-Content profiles.json | ConvertFrom-Json | Where-Object { $_.id -eq "1765707758356" } | ConvertTo-Json -Depth 10

# Đếm số lượng profiles
(Get-Content profiles.json | ConvertFrom-Json).Count

# Xem profiles của một user cụ thể
Get-Content profiles.json | ConvertFrom-Json | Where-Object { $_.userId -eq "admin@gmail.com" } | Select-Object name, id, status
```

### Cách 3: Xem bằng Node.js Script

Tạo file `server/view-profiles.js`:

```javascript
const fs = require("fs");
const path = require("path");

const PROFILES_FILE = path.join(__dirname, "profiles.json");

try {
  const profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, "utf8"));

  console.log(`\n📊 Tổng số profiles: ${profiles.length}\n`);

  profiles.forEach((profile, index) => {
    console.log(`\n--- Profile ${index + 1} ---`);
    console.log(`ID: ${profile.id}`);
    console.log(`Tên: ${profile.name}`);
    console.log(`User: ${profile.userId}`);
    console.log(`Trạng thái: ${profile.status}`);
    console.log(
      `Device: ${profile.deviceType} | OS: ${profile.os} | Browser: ${profile.browser}`
    );
    console.log(`Timezone: ${profile.timezone}`);
    console.log(
      `Hardware: ${profile.hardware.cpuCores} cores, ${profile.hardware.ram}GB RAM`
    );
    console.log(`Proxy ID: ${profile.proxyId || "Không có"}`);
    console.log(
      `Tạo lúc: ${new Date(profile.createdAt).toLocaleString("vi-VN")}`
    );
    console.log(
      `Cập nhật: ${new Date(profile.updatedAt).toLocaleString("vi-VN")}`
    );
  });
} catch (error) {
  console.error("Lỗi đọc file:", error.message);
}
```

Chạy script:

```powershell
cd server
node view-profiles.js
```

### Cách 4: Xem trong App (Giao diện)

1. Mở app AccSafe
2. Đăng nhập với tài khoản của bạn
3. Vào tab **"Profiles"** hoặc **"Hồ sơ"**
4. Bạn sẽ thấy danh sách tất cả profiles của bạn
5. Click vào một profile để xem chi tiết

---

## 📝 Cấu Trúc Dữ Liệu Profile

Mỗi profile có cấu trúc như sau:

```typescript
{
  id: string;                    // ID duy nhất (timestamp)
  userId: string;                // Email của người tạo
  name: string;                  // Tên profile
  deviceType: "desktop" | "mobile";
  os: "windows" | "macos" | "linux" | "android" | "ios";
  browser: "chrome" | "firefox" | "safari" | "edge";
  userAgent: string;             // User agent string
  timezone: string;              // Timezone (hoặc "auto")
  hardware: {
    cpuCores: number;            // Số cores CPU
    ram: number;                 // RAM (GB)
    gpu: string;                 // Tên GPU
    screenResolution: string;    // Độ phân giải màn hình
    audioContextNoise: boolean;  // Bật noise cho audio
    canvasNoise: boolean;        // Bật noise cho canvas
    webGLNoise: boolean;         // Bật noise cho WebGL
    webRTCPolicy: string;        // WebRTC policy
  };
  status: "stopped" | "running"; // Trạng thái hiện tại
  proxyId?: string;              // ID của proxy được gán (optional)
  createdAt: number;             // Timestamp tạo
  updatedAt: number;             // Timestamp cập nhật
}
```

---

## 🛠️ Các Thao Tác Quản Lý

### Xem file bằng PowerShell (Quick View)

```powershell
# Xem nhanh
notepad "D:\ASM\DoAn\version3 - Copy\server\profiles.json"

# Hoặc với VS Code
code "D:\ASM\DoAn\version3 - Copy\server\profiles.json"
```

### Backup dữ liệu

```powershell
cd "D:\ASM\DoAn\version3 - Copy\server"
Copy-Item profiles.json "profiles_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
```

### Restore dữ liệu

```powershell
cd "D:\ASM\DoAn\version3 - Copy\server"
Copy-Item "profiles_backup_20240101_120000.json" profiles.json -Force
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Không chỉnh sửa trực tiếp file JSON khi app đang chạy** - Có thể gây mất dữ liệu hoặc lỗi
2. **Luôn backup trước khi chỉnh sửa** - Dữ liệu có thể bị mất nếu format JSON sai
3. **File được tự động tạo** - Nếu file không tồn tại, app sẽ tạo file mới khi có profile đầu tiên
4. **Encoding UTF-8** - File sử dụng UTF-8 encoding, đảm bảo editor hỗ trợ

---

## 📂 Các File Dữ Liệu Khác

- **`server/database.json`** - Dữ liệu người dùng (users)
- **`server/proxies.json`** - Dữ liệu proxy
- **`server/chats.json`** - Dữ liệu chat (nếu có)

Tất cả đều ở cùng thư mục `server/` và có cùng format JSON.
