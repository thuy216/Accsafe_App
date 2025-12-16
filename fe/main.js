const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn, exec, execSync } = require("child_process");
const fs = require("fs");

let mainWindow;
const profileProcesses = {}; // Lưu trữ child processes theo profileId
const profilePids = {}; // Lưu trữ PID của child processes theo profileId

// --- UTILITY FUNCTIONS ---

// Lấy đường dẫn script test2.js
function getScriptPath() {
  if (app.isPackaged) {
    // Production: resources/code_test_nhan/test2.js
    const scriptPath = path.join(
      process.resourcesPath,
      "code_test_nhan",
      "test2.js"
    );
    console.log(`[getScriptPath] Packaged mode - Script path: ${scriptPath}`);
    console.log(`[getScriptPath] Resources path: ${process.resourcesPath}`);
    return scriptPath;
  } else {
    // Development: code_test_nhan/test2.js (từ root project)
    const scriptPath = path.join(__dirname, "..", "code_test_nhan", "test2.js");
    console.log(
      `[getScriptPath] Development mode - Script path: ${scriptPath}`
    );
    return scriptPath;
  }
}

// Lấy đường dẫn Chrome executable
function getChromeBinPath() {
  if (app.isPackaged) {
    // Production: resources/Chrome-bin/chrome.exe
    return path.join(process.resourcesPath, "Chrome-bin", "chrome.exe");
  } else {
    // Development: Chrome-bin/chrome.exe (từ root project)
    return path.join(__dirname, "..", "Chrome-bin", "chrome.exe");
  }
}

// Kiểm tra file có tồn tại không
function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (e) {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    frame: false, // Tắt khung viền mặc định của Windows/Mac
    titleBarStyle: "hidden", // Ẩn thanh tiêu đề hệ thống
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Cho phép dùng require('electron') ở frontend
      devTools: true,
    },
    autoHideMenuBar: true,
    icon: app.isPackaged
      ? path.join(__dirname, "logo.png")
      : path.join(__dirname, "..", "public", "logo.png"),
  });

  // Load app từ Vite server (dev) hoặc file tĩnh (prod)
  const loadURL = () => {
    if (app.isPackaged) {
      // Production: Load từ file tĩnh
      const indexPath = path.join(__dirname, "dist", "index.html");
      console.log(`[Main Process] Loading from file: ${indexPath}`);
      mainWindow.loadFile(indexPath).catch((err) => {
        console.error(`[Main Process] Failed to load file: ${err.message}`);
      });
    } else {
      // Development: Load từ Vite dev server
      const url = "http://localhost:5173";
      console.log(`[Main Process] Loading URL: ${url}`);
      mainWindow.loadURL(url).catch((err) => {
        console.error(`[Main Process] Failed to load URL: ${err.message}`);
        // Retry after 2 seconds
        setTimeout(() => {
          console.log("[Main Process] Retrying to load URL...");
          loadURL();
        }, 2000);
      });
    }
  };

  loadURL();

  // Log khi page loaded
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[Main Process] Frontend page loaded successfully");
  });

  // Log khi page failed to load
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[Main Process] Failed to load page: ${errorCode} - ${errorDescription}`
      );
      console.error(`[Main Process] URL: ${validatedURL}`);
      if (errorCode === -106) {
        // ERR_INTERNET_DISCONNECTED or similar
        console.log("[Main Process] Retrying in 3 seconds...");
        setTimeout(() => {
          loadURL();
        }, 3000);
      }
    }
  );

  // Log errors từ frontend
  mainWindow.webContents.on("console-message", (event, level, message) => {
    if (level >= 2) {
      // Error hoặc warning
      console.log(`[Frontend ${level === 2 ? "WARN" : "ERROR"}]:`, message);
    }
  });

  // Log DOM ready
  mainWindow.webContents.on("dom-ready", () => {
    console.log("[Main Process] DOM ready");
  });

  // DevTools chỉ mở khi development mode (không mở trong production)
  // Để mở DevTools thủ công: Ctrl+Shift+I hoặc F12
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  console.log("[Main Process] Electron app ready");

  // Bước 1: Kill tất cả Chrome processes cũ từ session trước
  killAllChromeProcesses();

  // Bước 2: Tạo window
  createWindow();
  console.log("[Main Process] Window created");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Kill processes cũ trước khi tạo window mới
      killAllChromeProcesses();
      createWindow();
    }
  });

  // Bước 3: Reset tất cả profiles về stopped khi app khởi động
  // (Vì khi app tắt, tất cả processes đã bị kill, nên status phải quay về stopped)
  // Đợi một chút để window load xong
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send("profile-status", {
        action: "reset-all",
        status: "stopped",
      });
      console.log(
        "[Main Process] Sent reset-all signal to frontend - all profiles reset to stopped"
      );
    }
  }, 1000);
});

// Hàm kill Chrome processes cho một profile cụ thể
function killChromeProcessesForProfile(profileId) {
  if (process.platform !== "win32") return;

  const scriptPath = getScriptPath();
  const userDataDir = path.join(
    path.dirname(scriptPath),
    `ruyi_live_${profileId}`
  );
  const userDataDirName = `ruyi_live_${profileId}`;
  const escapedUserDataDir = userDataDir.replace(/\\/g, "\\\\");

  console.log(
    `[*] Killing Chrome processes for profile ${profileId} only (not affecting other profiles)...`
  );

  try {
    // Cách 1: Kill Chrome processes với user data dir name trong command line
    try {
      execSync(
        `taskkill /F /FI "COMMANDLINE eq *${userDataDirName}*" /T 2>nul`,
        {
          timeout: 5000,
          stdio: "ignore",
        }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 2: Kill Chrome processes với full path của user data dir
    try {
      execSync(
        `taskkill /F /FI "COMMANDLINE eq *${escapedUserDataDir}*" /T 2>nul`,
        { timeout: 5000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 3: Kill bằng wmic với user data dir name
    try {
      execSync(
        `wmic process where "name='chrome.exe' and CommandLine like '%${userDataDirName}%'" delete 2>nul`,
        { timeout: 5000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 4: Kill bằng wmic với full path
    try {
      execSync(
        `wmic process where "name='chrome.exe' and CommandLine like '%${escapedUserDataDir}%'" delete 2>nul`,
        { timeout: 5000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 5: Kill tất cả Chrome processes từ Chrome-bin có user data dir
    try {
      execSync(
        `wmic process where "name='chrome.exe' and ExecutablePath like '%Chrome-bin%' and CommandLine like '%${userDataDirName}%'" delete 2>nul`,
        { timeout: 5000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 6: Kill theo PID của child process (nếu có) - chỉ kill processes liên quan đến profile này
    if (profilePids[profileId]) {
      try {
        const parentPid = profilePids[profileId];
        // Kill tất cả child processes của parent process (Node.js script)
        execSync(`taskkill /F /T /PID ${parentPid} 2>nul`, {
          timeout: 5000,
          stdio: "ignore",
        });
        // Kill Chrome processes có parent process là PID này VÀ có user data dir của profile này
        // Đảm bảo chỉ kill Chrome processes của profile cụ thể, không ảnh hưởng profile khác
        execSync(
          `wmic process where "ParentProcessId=${parentPid} and name='chrome.exe' and CommandLine like '%${userDataDirName}%'" delete 2>nul`,
          { timeout: 5000, stdio: "ignore" }
        );
      } catch (e) {
        // Ignore
      }
    }

    // Cách 7: Đã loại bỏ - không kill tất cả Chrome processes vì có thể ảnh hưởng đến profile khác
    // Chỉ kill processes dựa trên user data dir cụ thể để đảm bảo an toàn khi chạy nhiều profile song song

    console.log(
      `[*] Finished killing Chrome processes for profile ${profileId}`
    );
  } catch (e) {
    console.error(
      `[ERROR] Error killing Chrome processes for profile ${profileId}:`,
      e.message
    );
  }
}

// Hàm kill tất cả processes và browsers
function killAllProfiles() {
  console.log("[*] Killing all profiles and browsers...");

  Object.keys(profileProcesses).forEach((profileId) => {
    const proc = profileProcesses[profileId];
    if (proc && !proc.killed) {
      try {
        // Kill child process (Node.js script)
        proc.kill("SIGTERM");

        // Đợi một chút rồi force kill nếu cần
        setTimeout(() => {
          if (proc && !proc.killed) {
            proc.kill("SIGKILL");
          }
        }, 1000);

        // Kill tất cả Chrome processes liên quan đến profile này
        // Tìm Chrome processes với user data dir của profile
        const userDataDir = path.join(
          __dirname,
          "..",
          "code_test_nhan",
          `ruyi_live_${profileId}`
        );

        // Trên Windows, kill Chrome processes (sử dụng hàm helper)
        killChromeProcessesForProfile(profileId);

        // Xóa user data directory
        if (fs.existsSync(userDataDir)) {
          try {
            fs.rmSync(userDataDir, { recursive: true, force: true });
            console.log(`[*] Đã xóa user data dir: ${userDataDir}`);
          } catch (e) {
            console.error(`[ERROR] Không thể xóa user data dir:`, e);
          }
        }
      } catch (e) {
        console.error(`[ERROR] Không thể kill process ${profileId}:`, e);
      }
    }
  });

  // Xóa tất cả keys
  for (const key in profileProcesses) {
    if (profileProcesses.hasOwnProperty(key)) {
      delete profileProcesses[key];
    }
  }

  // Kill tất cả Chrome processes còn sót lại (orphaned)
  killAllChromeProcesses();
}

// Hàm kill tất cả Chrome processes (orphaned) khi app khởi động hoặc tắt
function killAllChromeProcesses() {
  if (process.platform !== "win32") return;

  console.log("[*] Killing all orphaned Chrome processes...");
  try {
    const scriptPath = getScriptPath();
    const codeTestNhanDir = path.dirname(scriptPath);

    // Cách 1: Kill tất cả Chrome processes có user data dir ruyi_live
    try {
      execSync(
        `wmic process where "name='chrome.exe' and CommandLine like '%ruyi_live%'" delete 2>nul`,
        { timeout: 10000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 2: Kill tất cả Chrome processes từ Chrome-bin có user data dir
    try {
      execSync(
        `wmic process where "name='chrome.exe' and ExecutablePath like '%Chrome-bin%' and CommandLine like '%ruyi_live%'" delete 2>nul`,
        { timeout: 10000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 3: Kill tất cả Chrome processes có đường dẫn code_test_nhan trong command line
    try {
      const escapedPath = codeTestNhanDir.replace(/\\/g, "\\\\");
      execSync(
        `wmic process where "name='chrome.exe' and CommandLine like '%${escapedPath}%'" delete 2>nul`,
        { timeout: 10000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    // Cách 4: Kill tất cả Node.js processes đang chạy test2.js (orphaned)
    try {
      execSync(
        `wmic process where "name='node.exe' and CommandLine like '%test2.js%'" delete 2>nul`,
        { timeout: 10000, stdio: "ignore" }
      );
    } catch (e) {
      // Ignore
    }

    console.log("[*] Finished killing orphaned Chrome processes");
  } catch (e) {
    console.error(
      "[ERROR] Error killing orphaned Chrome processes:",
      e.message
    );
  }
}

// Kill tất cả khi app sắp quit
app.on("before-quit", (event) => {
  console.log(
    "[*] App is quitting, killing all profiles and resetting status..."
  );
  killAllProfiles();
  // Kill tất cả Chrome processes
  killAllChromeProcesses();

  // Gửi signal đến frontend để reset tất cả profiles về stopped
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send("profile-status", {
      action: "reset-all",
      status: "stopped",
    });
    console.log("[Main Process] Sent reset-all signal before quit");
  }

  // Đợi một chút để processes được kill và signal được gửi
  setTimeout(() => {
    // Cho phép app quit
  }, 1000);
});

app.on("window-all-closed", () => {
  // Kill tất cả child processes trước khi đóng app
  killAllProfiles();
  // Kill tất cả Chrome processes
  killAllChromeProcesses();

  // Gửi signal đến frontend để reset tất cả profiles về stopped
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
    mainWindow.webContents.send("profile-status", {
      action: "reset-all",
      status: "stopped",
    });
    console.log("[Main Process] Sent reset-all signal before window closed");
  }

  if (process.platform !== "darwin") app.quit();
});

// --- Xử lý sự kiện từ TitleBar Custom ---
ipcMain.on("minimize-window", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("maximize-window", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("close-window", () => {
  if (mainWindow) mainWindow.close();
});

// --- IPC HANDLER: START PROFILE ---
ipcMain.on("start-profile", async (event, profileData) => {
  const {
    id: profileId,
    name: profileName,
    userAgent,
    timezone,
    os,
    deviceType,
    hardware,
    proxyId,
    proxyString, // Lấy proxyString trực tiếp từ profileData
    url = "https://whoer.net", // Mặc định là whoer.net
  } = profileData;

  console.log(`[*] Starting Profile: ${profileName} (ID: ${profileId})`);

  // Bước 1: Kill Chrome processes cũ (orphaned) trước khi start
  // CHỈ kill processes của profile này, không ảnh hưởng profile khác đang chạy
  console.log(
    `[*] Step 1: Killing any existing Chrome processes for profile ${profileId} only...`
  );
  killChromeProcessesForProfile(profileId);

  // Đợi một chút để processes được kill
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Bước 2: Kiểm tra và cleanup process cũ nếu có
  console.log(
    `[*] Step 2: Checking for existing process for profile ${profileId}...`
  );
  if (profileProcesses[profileId]) {
    const proc = profileProcesses[profileId];
    if (!proc.killed) {
      console.log(
        `[WARN] Profile ${profileId} đã đang chạy, killing old process...`
      );
      try {
        proc.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!proc.killed) {
          proc.kill("SIGKILL");
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        killChromeProcessesForProfile(profileId);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`[ERROR] Error killing old process:`, e);
      }
    }
    // Xóa process cũ khỏi tracking
    delete profileProcesses[profileId];
    delete profilePids[profileId];
  }

  // Bước 3: Xóa user data directory cũ nếu còn tồn tại (tránh conflict)
  console.log(
    `[*] Step 3: Cleaning up user data directory for profile ${profileId}...`
  );
  const scriptPath = getScriptPath();
  const userDataDir = path.join(
    path.dirname(scriptPath),
    `ruyi_live_${profileId}`
  );

  // Cleanup đồng bộ để đảm bảo không có conflict
  if (fs.existsSync(userDataDir)) {
    try {
      // Kill Chrome processes trước khi xóa directory
      killChromeProcessesForProfile(profileId);

      // Đợi một chút để processes được kill
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Thử xóa user data dir nhiều lần nếu cần
      let retries = 3;
      while (retries > 0 && fs.existsSync(userDataDir)) {
        try {
          fs.rmSync(userDataDir, { recursive: true, force: true });
          console.log(`[*] Đã xóa user data dir cũ: ${userDataDir}`);
          break;
        } catch (e) {
          retries--;
          if (retries > 0) {
            console.log(
              `[WARN] Không thể xóa user data dir, retrying... (${retries} attempts left)`
            );
            // Kill lại Chrome processes và đợi thêm
            killChromeProcessesForProfile(profileId);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } else {
            console.error(
              `[WARN] Không thể xóa user data dir cũ sau nhiều lần thử:`,
              e
            );
          }
        }
      }
    } catch (e) {
      console.error(`[WARN] Error cleaning up old user data dir:`, e);
    }
  }

  // Đợi thêm một chút để đảm bảo cleanup hoàn tất
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Kiểm tra file script và Chrome (đã có scriptPath ở trên)
  const chromePath = getChromeBinPath();

  if (!checkFileExists(scriptPath)) {
    console.error(`[ERROR] Script không tồn tại: ${scriptPath}`);
    event.reply("profile-status", {
      profileId,
      status: "error",
      message: `Script không tồn tại: ${scriptPath}`,
    });
    return;
  }

  if (!checkFileExists(chromePath)) {
    console.error(`[ERROR] Chrome executable không tồn tại: ${chromePath}`);
    event.reply("profile-status", {
      profileId,
      status: "error",
      message: `Chrome executable không tồn tại: ${chromePath}`,
    });
    return;
  }

  console.log(`[*] Chrome Path: ${chromePath}`);

  // Xử lý timezone
  let realTimezone = timezone;
  if (timezone === "auto" || !timezone || timezone === "undefined") {
    realTimezone = "Asia/Ho_Chi_Minh"; // Fallback
    console.log(`[*] Set timezone to default: ${realTimezone}`);
  }

  // Build arguments cho test2.js
  const args = [
    "--profile-id",
    profileId,
    "--profile-name",
    profileName || "Profile",
    "--user-agent",
    userAgent || "",
    "--timezone",
    realTimezone,
    "--os",
    os || "windows",
    "--device-type",
    deviceType || "desktop",
    "--cpu-cores",
    String(hardware?.cpuCores || 8),
    "--ram",
    String(hardware?.ram || 16),
    "--gpu",
    hardware?.gpu || "NVIDIA GeForce RTX 3060",
    "--screen-res",
    hardware?.screenResolution || "1920x1080",
    "--canvas-noise",
    hardware?.canvasNoise ? "true" : "false",
    "--audio-noise",
    hardware?.audioContextNoise ? "true" : "false",
    "--webrtc-policy",
    hardware?.webRTCPolicy || "disable",
    "--url",
    url,
    "--chrome-path",
    chromePath,
  ];

  // Thêm proxy nếu có
  if (proxyString) {
    args.push("--proxy", proxyString);
    console.log(
      `[*] Using proxy: ${proxyString.split("@")[1] || proxyString} (masked)`
    );
  } else {
    console.log(`[*] No proxy configured for this profile`);
  }

  console.log(`[*] Script path: ${scriptPath}`);
  console.log(`[*] Arguments:`, args);

  // Sử dụng spawn để chạy Node.js script
  try {
    // Đảm bảo timezone không phải undefined
    console.log("=== DEBUG ===");
    console.log("Final timezone:", realTimezone);
    console.log("Script exists:", fs.existsSync(scriptPath));
    console.log("Chrome exists:", fs.existsSync(chromePath));

    // Sử dụng exec với command string để xử lý đường dẫn có khoảng trắng
    // Escape arguments để tránh lỗi command injection
    const escapedArgs = args.map((arg) => {
      if (typeof arg === "string") {
        // Escape quotes và backslashes, sau đó wrap trong quotes
        return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      }
      return String(arg);
    });

    // Tạo command string với scriptPath được quote
    const command = `node "${scriptPath
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')}" ${escapedArgs.join(" ")}`;

    console.log(`[*] Node command: ${command.substring(0, 200)}...`);

    const childProcess = exec(command, {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        NODE_PATH: path.dirname(scriptPath),
      },
      shell: true,
    });

    // Xử lý lỗi khi spawn
    childProcess.on("error", (error) => {
      console.error(`[ERROR] Failed to start process for ${profileId}:`, error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("profile-status", {
          profileId,
          status: "error",
          message: `Lỗi khi khởi động: ${error.message}`,
        });
      }
      delete profileProcesses[profileId];
      delete profilePids[profileId];
    });

    // Lưu process và PID
    profileProcesses[profileId] = childProcess;
    profilePids[profileId] = childProcess.pid;
    console.log(
      `[*] Profile ${profileId} started with PID: ${childProcess.pid}`
    );

    // Stream stdout
    childProcess.stdout.on("data", (data) => {
      const log = data.toString();
      console.log(`[${profileId}] ${log}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("profile-log", {
          profileId,
          log: log.trim(),
        });
      }
    });

    // Stream stderr
    childProcess.stderr.on("data", (data) => {
      const log = data.toString();
      console.error(`[${profileId}] ${log}`);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("profile-log", {
          profileId,
          log: log.trim(),
          isError: true,
        });
      }
    });

    // Gửi status về frontend ngay sau khi spawn thành công
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("profile-status", {
        profileId,
        status: "running",
        messageKey: "profileStarting",
      });
    }

    // Xử lý khi process exit
    childProcess.on("exit", (code, signal) => {
      console.log(
        `[*] Profile ${profileId} đã dừng (code: ${code}, signal: ${signal})`
      );
      delete profileProcesses[profileId];
      delete profilePids[profileId];

      // Chỉ kill Chrome processes nếu process exit với lỗi nghiêm trọng
      // Không kill nếu exit code là 0 (normal exit) hoặc signal là SIGTERM/SIGINT (user stop)
      if (
        code !== 0 &&
        code !== null &&
        signal !== "SIGTERM" &&
        signal !== "SIGINT"
      ) {
        console.log(
          `[WARN] Process exit với lỗi (code: ${code}), killing Chrome processes...`
        );
        killChromeProcessesForProfile(profileId);
      } else {
        console.log(
          `[*] Process exit bình thường (code: ${code}, signal: ${signal}), không kill Chrome processes`
        );
      }

      // Xóa user data directory
      const userDataDir = path.join(
        path.dirname(scriptPath),
        `ruyi_live_${profileId}`
      );
      if (fs.existsSync(userDataDir)) {
        try {
          fs.rmSync(userDataDir, { recursive: true, force: true });
          console.log(`[*] Đã xóa user data dir: ${userDataDir}`);
        } catch (e) {
          console.error(`[ERROR] Không thể xóa user data dir:`, e);
        }
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("profile-status", {
          profileId,
          status: "stopped",
          messageKey: code === 0 ? "profileStopped" : null,
          message:
            code !== 0 ? `Profile stopped with error (code: ${code})` : null,
        });
      }
    });

    // Gửi status về frontend (duplicate - đã gửi ở trên)
  } catch (error) {
    console.error(`[ERROR] Exception khi spawn process:`, error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("profile-status", {
        profileId,
        status: "error",
        message: `Lỗi: ${error.message}`,
      });
    }
  }
});

// --- IPC HANDLER: STOP PROFILE ---
ipcMain.on("stop-profile", (event, profileId) => {
  console.log(`[*] Stopping Profile: ${profileId}`);

  const proc = profileProcesses[profileId];
  if (!proc || proc.killed) {
    // Profile không có process đang chạy (có thể đã bị kill khi app tắt)
    // Chỉ cần kill Chrome processes còn sót lại và update status
    console.log(
      `[INFO] Profile ${profileId} không có process đang chạy, cleaning up Chrome processes...`
    );
    killChromeProcessesForProfile(profileId);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("profile-status", {
        profileId,
        status: "stopped",
        // Không gửi messageKey "profileNotRunning" - chỉ update status thầm lặng
      });
    }
    return;
  }

  try {
    const scriptPath = getScriptPath();
    const userDataDir = path.join(
      path.dirname(scriptPath),
      `ruyi_live_${profileId}`
    );
    const userDataDirName = `ruyi_live_${profileId}`;

    // Bước 1: Kill child process (Node.js script)
    console.log(`[*] Killing child process for profile ${profileId}...`);
    proc.kill("SIGTERM");

    // Bước 2: Kill Chrome processes ngay lập tức (sử dụng hàm helper)
    killChromeProcessesForProfile(profileId);

    // Bước 3: Đợi một chút rồi force kill child process nếu cần
    setTimeout(() => {
      if (proc && !proc.killed) {
        console.log(
          `[*] Force killing child process for profile ${profileId}...`
        );
        proc.kill("SIGKILL");
      }

      // Kill lại Chrome processes một lần nữa để đảm bảo
      killChromeProcessesForProfile(profileId);
    }, 2000);

    // Bước 4: Xóa user data directory (đợi một chút để processes được kill)
    setTimeout(() => {
      if (fs.existsSync(userDataDir)) {
        try {
          fs.rmSync(userDataDir, { recursive: true, force: true });
          console.log(`[*] Đã xóa user data dir: ${userDataDir}`);
        } catch (e) {
          console.error(`[ERROR] Không thể xóa user data dir:`, e);
          // Thử lại sau 1 giây nữa
          setTimeout(() => {
            try {
              fs.rmSync(userDataDir, { recursive: true, force: true });
              console.log(`[*] Đã xóa user data dir (lần 2): ${userDataDir}`);
            } catch (e2) {
              console.error(`[ERROR] Vẫn không thể xóa user data dir:`, e2);
            }
          }, 1000);
        }
      }
    }, 500);

    // Bước 5: Xóa khỏi profileProcesses và gửi status
    delete profileProcesses[profileId];
    delete profilePids[profileId];

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("profile-status", {
        profileId,
        status: "stopped",
        messageKey: "profileStopped",
      });
    }
  } catch (e) {
    console.error(`[ERROR] Không thể stop profile ${profileId}:`, e);

    // Vẫn cố gắng kill Chrome processes ngay cả khi có lỗi
    killChromeProcessesForProfile(profileId);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("profile-status", {
        profileId,
        status: "error",
        message: `Lỗi khi dừng profile: ${e.message}`,
      });
    }
  }
});