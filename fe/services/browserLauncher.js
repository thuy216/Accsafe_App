const { spawn, exec } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { HttpProxyAgent } = require("http-proxy-agent");

// Store running Chrome processes by profile ID
const runningProcesses = new Map(); // profileId -> { process, userDataDir, chromePath }

/**
 * Parse proxy config từ ProxyItem
 */
const parseProxyConfig = (proxy) => {
  if (proxy.username && proxy.password) {
    return {
      ip: proxy.ip,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      server: `http://${proxy.ip}:${proxy.port}`,
      url: `http://${proxy.username}:${proxy.password}@${proxy.ip}:${proxy.port}`,
    };
  }
  return null;
};

/**
 * Check proxy IP, timezone và location (giống test.py)
 */
const getProxyInfo = async (proxyUrl) => {
  console.log(`[*] Checking Proxy: ${proxyUrl.split("@")[1] || proxyUrl}...`);

  // Giống Python: proxies = {"http": proxy_url, "https": proxy_url}
  const proxies = {
    http: proxyUrl,
    https: proxyUrl,
  };

  // Danh sách các API để thử (nếu cái này chết thì thử cái kia) - giống test.py
  const apis = [
    { url: "http://ip-api.com/json", timezoneKey: "timezone" }, // Ưu tiên 1: Lấy được cả Timezone
    { url: "https://api.ipify.org?format=json" }, // Ưu tiên 2: Chỉ lấy IP
  ];

  for (const api of apis) {
    try {
      console.log(`    -> Thử kết nối: ${api.url}`);

      // Thử với HttpsProxyAgent/HttpProxyAgent trước (cách mới)
      try {
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        const httpAgent = new HttpProxyAgent(proxyUrl);
        const resp = await axios.get(api.url, {
          httpAgent: httpAgent,
          httpsAgent: httpsAgent,
          timeout: 8000, // Giảm timeout từ 15s xuống 8s để tăng tốc độ
        });

        if (resp.status === 200) {
          const data = resp.data;
          const ip = data.query || data.ip;
          let timezone = "Asia/Ho_Chi_Minh";
          if (api.timezoneKey && data[api.timezoneKey]) {
            timezone = data[api.timezoneKey];
          }

          // Location logic từ ip-api.com
          let location = "";
          if (data.country && data.city) {
            location = `${data.country} - ${data.city}`;
          } else if (data.country) {
            location = data.country;
          }

          console.log(
            `    [OK] IP: ${ip} | Timezone: ${timezone} | Location: ${
              location || "Unknown"
            }`
          );
          return { ip, timezone, location };
        }
      } catch (agentError) {
        // Fallback: thử với axios proxy option (giống Python requests)
        console.log(
          `    [WARN] Agent method failed, trying axios proxy option...`
        );
        const resp = await axios.get(api.url, {
          proxy: proxies,
          timeout: 8000, // Giảm timeout từ 15s xuống 8s để tăng tốc độ
        });

        if (resp.status === 200) {
          const data = resp.data;
          const ip = data.query || data.ip;
          let timezone = "Asia/Ho_Chi_Minh";
          if (api.timezoneKey && data[api.timezoneKey]) {
            timezone = data[api.timezoneKey];
          }

          let location = "";
          if (data.country && data.city) {
            location = `${data.country} - ${data.city}`;
          } else if (data.country) {
            location = data.country;
          }

          console.log(
            `    [OK] IP: ${ip} | Timezone: ${timezone} | Location: ${
              location || "Unknown"
            }`
          );
          return { ip, timezone, location };
        }
      }
    } catch (error) {
      const errorMsg = error.message || "";
      const errorCode = error.code || "";

      // Log chi tiết lỗi
      if (errorCode === "ECONNREFUSED" || errorMsg.includes("ECONNREFUSED")) {
        console.log(
          `    [ERR Check IP] connect ECONNREFUSED - Proxy không thể kết nối`
        );
      } else if (errorCode === "ETIMEDOUT" || errorMsg.includes("timeout")) {
        console.log(`    [ERR Check IP] Timeout - Proxy không phản hồi`);
      } else {
        console.log(`    [ERR] ${errorMsg.substring(0, 100)}...`);
      }

      if (errorCode) {
        console.log(`    [ERR] Error code: ${errorCode}`);
      }

      // Nếu là lỗi kết nối nghiêm trọng, throw ngay để fallback
      if (
        errorCode === "ECONNREFUSED" ||
        errorCode === "ETIMEDOUT" ||
        errorCode === "ENOTFOUND"
      ) {
        throw error; // Throw để caller biết proxy không hoạt động
      }
    }
  }

  return { ip: null, timezone: "Asia/Ho_Chi_Minh" };
};

/**
 * Get IP info khi không dùng proxy
 */
const getDirectIPInfo = async () => {
  console.log("[*] Đang lấy thông tin IP mạng gốc (Direct)...");

  const apis = [
    { url: "http://ip-api.com/json", timezoneKey: "timezone" },
    { url: "https://api.ipify.org?format=json" },
  ];

  for (const api of apis) {
    try {
      const resp = await axios.get(api.url, { timeout: 5000 }); // Giảm timeout để tăng tốc độ
      if (resp.status === 200) {
        const data = resp.data;
        const ip = data.query || data.ip;
        let timezone = "Asia/Ho_Chi_Minh";
        if (api.timezoneKey && data[api.timezoneKey]) {
          timezone = data[api.timezoneKey];
        }
        console.log(`    [OK] IP: ${ip} | Timezone: ${timezone}`);
        return { ip, timezone };
      }
    } catch (error) {
      console.log(`    [SKIP] Lỗi kết nối API: ${error.message}`);
    }
  }

  return { ip: "127.0.0.1", timezone: "Asia/Ho_Chi_Minh" };
};

/**
 * Parse screen resolution
 */
const parseResolution = (resolution) => {
  const [width, height] = resolution.split("x").map(Number);
  return { width: width || 1920, height: height || 1080 };
};

/**
 * Parse GPU để tạo WebGL info (giống test.py format)
 */
const parseGPU = (gpu) => {
  let vendor = "Google Inc. (NVIDIA)";
  let renderer =
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)";

  if (gpu.includes("NVIDIA")) {
    vendor = "Google Inc. (NVIDIA)";
    // Format: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)"
    // Đảm bảo format đúng như test.py
    renderer = `ANGLE (NVIDIA, ${gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
  } else if (gpu.includes("AMD")) {
    vendor = "Google Inc. (AMD)";
    renderer = `ANGLE (AMD, ${gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
  } else if (gpu.includes("Intel")) {
    vendor = "Google Inc. (Intel)";
    renderer = `ANGLE (Intel, ${gpu} Direct3D11 vs_5_0 ps_5_0, D3D11)`;
  } else if (gpu.includes("Apple")) {
    vendor = "Apple Inc.";
    // Apple GPU format khác
    renderer = `Apple GPU (${gpu})`;
  }

  return { vendor, renderer };
};

/**
 * Extract Chrome version từ User Agent
 */
const extractChromeVersion = (userAgent) => {
  const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
  return match ? match[1] : "142.0.0.0";
};

const extractFullVersion = (userAgent) => {
  const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
  if (match) {
    const version = match[1];
    const majorVersion = version.split(".")[0];
    // Đảm bảo version đủ cao để tránh "Update your browser" warning
    // Nếu version < 120, force lên 142 (giống test.py)
    const finalMajor = parseInt(majorVersion) < 120 ? "142" : majorVersion;
    return `${finalMajor}.0.7444.177`;
  }
  return "142.0.7444.177";
};

/**
 * Build RUYI config từ ProfileItem
 * Tất cả thông tin từ profile (OS, User Agent, Hardware) sẽ được áp dụng vào fingerprint
 */
const buildRuyiConfig = (profile, proxyIP) => {
  // Parse resolution từ profile hardware
  const resolution = parseResolution(profile.hardware.screenResolution);

  // Parse GPU từ profile hardware
  const gpuInfo = parseGPU(profile.hardware.gpu);

  // Extract Chrome version từ User Agent của profile
  const chromeVersion = extractChromeVersion(profile.userAgent);
  const fullVersion = extractFullVersion(profile.userAgent);
  // Đảm bảo major version đủ cao để tránh browser detection
  let majorVersion = chromeVersion.split(".")[0];
  if (parseInt(majorVersion) < 120) {
    majorVersion = "142"; // Force lên version cao để tránh "Update your browser"
  }

  // Build brands array từ User Agent version
  const brands = [
    { brand: "Chromium", version: majorVersion },
    { brand: "Google Chrome", version: majorVersion },
    { brand: "Not_A Brand", version: "24" },
  ];

  // Map OS từ profile sang platform info (thay thế thông tin gốc của máy)
  let platform = "Windows";
  let legacyPlatform = "Win32";
  let platformVersion = "15.0.0";
  let architecture = "x86";
  let bitness = "64";

  if (profile.os === "mac") {
    platform = "MacIntel";
    legacyPlatform = "MacIntel";
    platformVersion = "10_15_7";
    architecture = "x86";
    bitness = "64";
  } else if (profile.os === "linux") {
    platform = "Linux x86_64";
    legacyPlatform = "Linux x86_64";
    platformVersion = "5.0.0";
    architecture = "x86";
    bitness = "64";
  } else if (profile.os === "android") {
    platform = "Linux armv8l";
    legacyPlatform = "Linux armv8l";
    platformVersion = "10";
    architecture = "arm";
    bitness = "64";
  }

  // Adjust screen info cho mobile devices (thay thế thông tin screen gốc)
  let screenAvailHeight = resolution.height - 40; // Default desktop
  if (profile.deviceType === "mobile") {
    screenAvailHeight = resolution.height - 20; // Mobile có taskbar nhỏ hơn
  }

  const ruyiConfig = {
    uaFullVersion: fullVersion,
    ua: profile.userAgent,
    brands: brands,
    platform: platform,
    legacy_platform: legacyPlatform,
    platformVersion: platformVersion,
    architecture: architecture,
    bitness: bitness,
    mobile: profile.deviceType === "mobile",
    cpu: profile.hardware.cpuCores,
    memory: profile.hardware.ram,
    screen_width: resolution.width,
    screen_height: resolution.height,
    screen_availWidth: resolution.width,
    screen_availHeight: screenAvailHeight,
    screen_colorDepth: 24,
    screen_pixelDepth: 24,
    devicePixelRatio: 1.0,
    webgl_vendor: gpuInfo.vendor,
    webgl_renderer: gpuInfo.renderer,
    webgl_max_texture_size: 16384,
    webgl_max_cube_map_texture_size: 16384,
    webgl_max_render_buffer: 16384,
    webgl_max_viewport_dims: 16384,
    webgl_max_vertex_texture_image_units: 32,
    webgl_max_texture_image_units: 32,
    // QUAN TRỌNG: Inject proxy IP vào WebRTC để prevent IP leak
    webrtc_public_ip: proxyIP || "127.0.0.1", // Fallback nếu không có proxy
    net_downlink: 10.0,
    net_rtt: 50,
    dnt: "1",
    noise_seed: Math.floor(Math.random() * 100000),
    battery_level: 1.0,
    battery_charging: true,
  };

  // Format JSON không có spaces và newlines (giống Python json.dumps với separators)
  // Python: json.dumps(RUYI_CONFIG, separators=(",", ":"))
  // QUAN TRỌNG: Phải dùng separators để match với Python format
  // Loại bỏ tất cả spaces, newlines, và tabs
  const jsonString = JSON.stringify(ruyiConfig);
  const compactJson = jsonString.replace(/\s+/g, "");

  // Debug: Log để verify format
  console.log("[RUYI] Config length:", compactJson.length);
  console.log(
    "[RUYI] Config preview (first 200 chars):",
    compactJson.substring(0, 200)
  );

  return compactJson;
};

/**
 * Tìm đường dẫn Chrome executable
 */
const findChromePath = () => {
  const platform = process.platform;

  if (platform === "win32") {
    // Tìm Chrome executable - tự động detect
    const possiblePaths = [
      // RUYI Chrome (nếu có trong project)
      path.join(__dirname, "../../Chrome-bin/chrome.exe"),
      // Standard Chrome installations
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      (process.env.LOCALAPPDATA || "") +
        "\\Google\\Chrome\\Application\\chrome.exe",
      // User Downloads folder (common for RUYI Chrome)
      path.join(
        process.env.USERPROFILE || "",
        "Downloads/chrome/Chrome-bin/chrome.exe"
      ),
      path.join(
        process.env.USERPROFILE || "",
        "Downloads/Chrome-bin/chrome.exe"
      ),
    ];

    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        console.log(`[FIND] Found Chrome at: ${chromePath}`);
        return chromePath;
      }
    }
  } else if (platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else if (platform === "linux") {
    return "/usr/bin/google-chrome";
  }

  console.error("[FIND] Chrome not found in any of the paths");
  return null;
};

/**
 * Tạo Chrome extension để xử lý proxy authentication
 * Giống với proxy_auth_plugin trong code_test_nhan
 */
const createProxyAuthExtension = (host, port, user, pass) => {
  const pluginDir = path.join(
    os.tmpdir(),
    `proxy_auth_plugin_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  );
  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  const manifest = {
    manifest_version: 3,
    name: "Proxy Auth Helper",
    version: "1.0.0",
    permissions: [
      "proxy",
      "tabs",
      "unlimitedStorage",
      "storage",
      "<all_urls>",
      "webRequest",
      "webRequestAuthProvider",
    ],
    host_permissions: ["<all_urls>"],
    background: { service_worker: "background.js" },
  };

  // Background Script để xử lý proxy auth (giống code_test_nhan/proxy_auth_plugin/background.js)
  const backgroundJs = `
    const config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: "${host}",
          port: parseInt(${port})
        },
        bypassList: ["localhost"]
      }
    };

    // Ép Chrome nhận config proxy
    chrome.proxy.settings.set({value: config, scope: 'regular'}, function() {});

    // Xử lý Auth
    chrome.webRequest.onAuthRequired.addListener(
      function(details) {
        return {
          authCredentials: {
            username: "${user}",
            password: "${pass}"
          }
        };
      },
      {urls: ["<all_urls>"]},
      ["blocking"]
    );
  `;

  fs.writeFileSync(
    path.join(pluginDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  fs.writeFileSync(path.join(pluginDir, "background.js"), backgroundJs);

  console.log(`[DEBUG] Created proxy extension at: ${pluginDir}`);
  console.log(`[DEBUG] Proxy config: ${host}:${port} with user: ${user}`);

  return pluginDir;
};

/**
 * Kill Chrome process by profile ID
 */
const killBrowserByProfileId = async (profileId) => {
  const processInfo = runningProcesses.get(profileId);
  if (!processInfo) {
    console.log(`[KILL] No running process found for profile ${profileId}`);
    return { success: true };
  }

  try {
    const { process, userDataDir, chromePath } = processInfo;

    // Kill process nếu còn sống
    if (process && !process.killed) {
      try {
        process.kill("SIGTERM");
        console.log(`[KILL] Sent SIGTERM to process for profile ${profileId}`);

        // Wait 2 seconds, nếu chưa chết thì force kill
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!process.killed) {
          process.kill("SIGKILL");
          console.log(`[KILL] Force killed process for profile ${profileId}`);
        }
      } catch (error) {
        console.error(`[KILL] Error killing process:`, error.message);
      }
    }

    // Kill all Chrome processes with this user-data-dir (Windows)
    if (os.platform() === "win32") {
      try {
        // Kill Chrome processes bằng cách tìm theo user-data-dir trong command line
        const escapedPath = userDataDir
          .replace(/\\/g, "\\\\")
          .replace(/:/g, "\\:");
        const killCmd = `wmic process where "commandline like '%${escapedPath}%'" delete 2>nul || taskkill /F /IM chrome.exe /T 2>nul || echo "No process found"`;
        exec(killCmd, (error, stdout, stderr) => {
          if (!error) {
            console.log(`[KILL] Windows kill result: ${stdout}`);
          } else {
            console.log(
              `[KILL] Windows kill error (may be normal): ${error.message}`
            );
          }
        });
      } catch (error) {
        console.error(`[KILL] Windows kill error:`, error.message);
      }
    }

    // Cleanup user data dir (optional - có thể giữ để debug)
    // if (userDataDir && fs.existsSync(userDataDir)) {
    //   try {
    //     fs.rmSync(userDataDir, { recursive: true, force: true });
    //     console.log(`[KILL] Cleaned up user data dir: ${userDataDir}`);
    //   } catch (error) {
    //     console.error(`[KILL] Error cleaning user data dir:`, error.message);
    //   }
    // }

    // Remove from tracking
    runningProcesses.delete(profileId);
    console.log(`[KILL] Removed profile ${profileId} from tracking`);

    return { success: true };
  } catch (error) {
    console.error(
      `[KILL] Error killing browser for profile ${profileId}:`,
      error
    );
    return { success: false, error: error.message };
  }
};

/**
 * Launch browser với fingerprint và proxy
 */
const launchBrowser = async (
  profile,
  proxy,
  urlToOpen = "https://www.google.com/"
) => {
  console.log("\n========================================");
  console.log("[LAUNCH BROWSER] Starting...");
  console.log("========================================\n");

  try {
    console.log("[1] Finding Chrome path...");
    const chromePath = findChromePath();
    if (!chromePath) {
      console.error("[ERROR] Chrome not found!");
      return {
        success: false,
        error:
          "Không tìm thấy Chrome executable. Vui lòng cài đặt Google Chrome.",
      };
    }
    console.log(`[OK] Chrome path: ${chromePath}`);

    // 1. Get proxy IP và timezone
    let proxyIP;
    let timezone;
    let proxyExtensionPath = null;

    if (proxy) {
      console.log("[DEBUG] Proxy object:", JSON.stringify(proxy, null, 2));
      const proxyConfig = parseProxyConfig(proxy);
      if (!proxyConfig) {
        console.error(
          "[ERROR] Proxy config không hợp lệ. Proxy object:",
          proxy
        );
        return { success: false, error: "Proxy config không hợp lệ" };
      }

      console.log("[DEBUG] Parsed proxy config:", {
        ip: proxyConfig.ip,
        port: proxyConfig.port,
        hasAuth: !!(proxyConfig.username && proxyConfig.password),
        url: proxyConfig.url.substring(0, 50) + "...",
      });

      // Kiểm tra proxy với timeout ngắn hơn để tăng tốc độ
      let proxyInfo;
      let proxyWorking = false;

      try {
        console.log("[DEBUG] Checking proxy connectivity...");
        // Timeout ngắn hơn (5s thay vì 10s) để tăng tốc độ load
        proxyInfo = await Promise.race([
          getProxyInfo(proxyConfig.url),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Proxy check timeout after 5s")),
              5000
            )
          ),
        ]);

        if (proxyInfo && proxyInfo.ip) {
          proxyWorking = true;
          proxyIP = proxyInfo.ip;
          timezone = proxyInfo.timezone;
          console.log(
            `[OK] Proxy hoạt động. IP: ${proxyIP} | Location: ${
              proxyInfo.location || "Unknown"
            }`
          );
        } else {
          throw new Error("Proxy không trả về IP hợp lệ");
        }
      } catch (error) {
        console.error(
          `[ERR Check IP] ${error.message || error.code || "Unknown error"}`
        );
        console.warn("[!!!] Proxy timeout/lỗi, sử dụng kết nối trực tiếp...");

        // Fallback: dùng direct connection
        const directInfo = await getDirectIPInfo();
        proxyIP = directInfo.ip;
        timezone = directInfo.timezone;
        proxyExtensionPath = null;
        proxy = null; // Disable proxy hoàn toàn để browser không dùng proxy
        console.warn(
          "[!!!] Đã tắt proxy do lỗi kết nối. Browser sẽ dùng kết nối trực tiếp."
        );
      }

      // Chỉ tạo extension nếu proxy hoạt động
      if (proxyWorking && proxy) {
        try {
          proxyExtensionPath = createProxyAuthExtension(
            proxyConfig.ip,
            proxyConfig.port,
            proxyConfig.username,
            proxyConfig.password
          );
          console.log("[OK] Proxy extension đã được tạo");
        } catch (error) {
          console.error(
            `[ERROR] Failed to create proxy extension: ${error.message}`
          );
          proxyExtensionPath = null;
          proxy = null; // Disable proxy nếu không tạo được extension
          console.warn(
            "[!!!] Đã tắt proxy do lỗi tạo extension. Browser sẽ dùng kết nối trực tiếp."
          );
        }
      }
    } else {
      const directInfo = await getDirectIPInfo();
      proxyIP = directInfo.ip;
      timezone =
        profile.timezone === "auto" ? directInfo.timezone : profile.timezone;
    }

    // 2. Build RUYI config
    const ruyiConfigJson = buildRuyiConfig(profile, proxyIP);

    // Parse để log chi tiết WebGL và verify format
    try {
      const ruyiConfigObj = JSON.parse(ruyiConfigJson);
      console.log("\n[DEBUG] ========== RUYI CONFIG ==========");
      console.log("[DEBUG] WebGL Vendor:", ruyiConfigObj.webgl_vendor);
      console.log("[DEBUG] WebGL Renderer:", ruyiConfigObj.webgl_renderer);
      console.log("[DEBUG] CPU Cores:", ruyiConfigObj.cpu);
      console.log("[DEBUG] Memory (GB):", ruyiConfigObj.memory);
      console.log(
        "[DEBUG] Screen:",
        `${ruyiConfigObj.screen_width}x${ruyiConfigObj.screen_height}`
      );
      console.log("[DEBUG] Platform:", ruyiConfigObj.platform);
      console.log("[DEBUG] User Agent:", ruyiConfigObj.ua);
      console.log("[DEBUG] WebRTC IP:", ruyiConfigObj.webrtc_public_ip);
      console.log("[DEBUG] ===================================\n");
    } catch (error) {
      console.error("[ERROR] Failed to parse RUYI config:", error.message);
    }
    console.log("[DEBUG] Profile Info:", {
      os: profile.os,
      userAgent: profile.userAgent,
      cpu: profile.hardware.cpuCores,
      ram: profile.hardware.ram,
      gpu: profile.hardware.gpu,
      screen: profile.hardware.screenResolution,
      proxyIP: proxyIP,
    });

    // 3. Tạo user data dir
    const userDataDir = path.join(
      os.tmpdir(),
      `ruyi_live_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    );
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    // 4. Build launch args (giống test.py - EXACT MATCH)
    // Tối ưu tốc độ load: Thêm các flags để tăng tốc độ
    const launchArgs = [
      `--ruyi=${ruyiConfigJson}`, // QUAN TRỌNG: RUYI config phải ở đầu tiên
      "--no-first-run",
      "--disable-infobars",

      // Tối ưu Network & DNS - Tăng tốc độ load
      "--disable-features=DnsOverHttps",
      "--disable-async-dns",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-ipc-flooding-protection",

      // Tắt prefetch/preload để tăng tốc độ khởi động
      "--disable-preconnect",
      "--disable-preload",
      "--disable-prefetch",
      "--disable-hang-monitor",

      // Tối ưu Rendering - Tăng tốc độ render (giữ GPU để fingerprinting tốt hơn)
      "--disable-gpu-vsync",
      "--disable-software-rasterizer",
      "--disable-extensions-file-access-check",
      "--disable-extensions-http-throttling",
      "--enable-features=VaapiVideoDecoder", // Tăng tốc decode video nếu có GPU

      // Tắt các tính năng không cần thiết - Giảm overhead
      "--disable-plugins-discovery",
      "--disable-plugins",
      "--disable-default-apps",
      "--disable-session-crashed-bubble",
      "--disable-translate",
      "--disable-features=TranslateUI",
      "--disable-features=AutofillServerCommunication",
      "--disable-features=MediaRouter",
      "--disable-features=RendererCodeIntegrity",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-features=AudioServiceOutOfProcess",

      // WebRTC flags để prevent IP leak
      "--force-webrtc-ip-handling-policy=default_public_interface_only",
      "--webrtc-ip-handling-policy=default_public_interface_only",

      // Memory & Performance
      `--device-memory=${profile.hardware.ram}`,
      "--memory-pressure-off",
      "--max_old_space_size=4096",

      // Bypass browser detection
      "--disable-blink-features=AutomationControlled",
      "--exclude-switches=enable-automation",
      "--disable-blink-features=AutomationControlled",

      // Language & Timezone
      "--lang=en-US",
      `--timezone-override=${timezone}`,
      `--user-data-dir=${userDataDir}`,

      // Update & Sync - Tắt để tăng tốc
      "--disable-component-update", // Fix "Update your browser" warning
      "--disable-sync",
      "--disable-background-downloads",

      // SSL flags (không dùng --disable-web-security vì gây warning)
      "--ignore-certificate-errors",
      "--ignore-ssl-errors",
      "--ignore-certificate-errors-spki-list",
      "--ignore-certificate-errors-spki-list",

      // Tối ưu thêm
      "--no-pings",
      "--no-sandbox", // Tăng tốc nhưng giảm security (OK cho automation)
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // Giảm memory usage
      "--disable-accelerated-2d-canvas",
      "--disable-accelerated-video-decode",
    ];

    console.log("[DEBUG] Launch args count:", launchArgs.length);
    console.log("[DEBUG] RUYI flag length:", `--ruyi=${ruyiConfigJson}`.length);
    console.log(
      "[DEBUG] RUYI flag preview:",
      `--ruyi=${ruyiConfigJson.substring(0, 100)}...`
    );

    // 5. Add proxy extension nếu có proxy với auth và proxy đang hoạt động
    if (proxy && proxyExtensionPath) {
      console.log(
        `[DEBUG] Loading proxy extension from: ${proxyExtensionPath}`
      );
      launchArgs.push(`--load-extension=${proxyExtensionPath}`);
      const proxyConfig = parseProxyConfig(proxy);
      console.log(
        `[DEBUG] Proxy extension will handle: ${proxyConfig?.server || "N/A"}`
      );
    } else if (proxy && !proxyExtensionPath) {
      // Fallback: dùng --proxy-server nếu proxy không có auth và proxy đang hoạt động
      const proxyConfig = parseProxyConfig(proxy);
      if (proxyConfig && (!proxyConfig.username || !proxyConfig.password)) {
        console.log(`[DEBUG] Using --proxy-server: ${proxyConfig.server}`);
        launchArgs.push(`--proxy-server=${proxyConfig.server}`);
      }
    } else {
      // Không có proxy hoặc proxy đã bị disable
      console.log("[DEBUG] Không sử dụng proxy - kết nối trực tiếp");
    }

    // 6. Add URL to open
    launchArgs.push(urlToOpen);

    // 7. Launch Chrome
    console.log(
      `[*] Mở Browser với Proxy: ${
        proxy ? parseProxyConfig(proxy)?.server : "Direct"
      }...`
    );

    // Log launch args để debug (chỉ log một phần để không quá dài)
    console.log("[DEBUG] Launch Args (first 3):", launchArgs.slice(0, 3));
    console.log("[DEBUG] Total launch args:", launchArgs.length);

    const chromeProcess = spawn(chromePath, launchArgs, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"], // Cho phép xem stdout/stderr nếu cần
    });

    // Track process by profile ID
    runningProcesses.set(profile.id, {
      process: chromeProcess,
      userDataDir: userDataDir,
      chromePath: chromePath,
    });
    console.log(`[TRACK] Tracking Chrome process for profile ${profile.id}`);

    // Log errors nếu có
    chromeProcess.stderr?.on("data", (data) => {
      const errorMsg = data.toString();
      if (
        errorMsg.includes("error") ||
        errorMsg.includes("Error") ||
        errorMsg.includes("ERROR")
      ) {
        console.error("[Chrome Error]:", errorMsg.substring(0, 200));
      }
    });

    // Handle process exit
    chromeProcess.on("exit", (code, signal) => {
      console.log(
        `[PROCESS] Chrome process exited for profile ${profile.id} with code ${code}, signal ${signal}`
      );
      runningProcesses.delete(profile.id);
    });

    chromeProcess.unref();

    return { success: true, profileId: profile.id };
  } catch (error) {
    console.error("[CRASH] Lỗi khi chạy Browser:", error);
    return {
      success: false,
      error: error.message || "Lỗi không xác định khi khởi động browser",
    };
  }
};

module.exports = { launchBrowser, killBrowserByProfileId };
