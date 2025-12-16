const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, "database.json");
const PROFILES_FILE = path.join(__dirname, "profiles.json");
const PROXIES_FILE = path.join(__dirname, "proxies.json");

// --- CẤU HÌNH ---
app.use(cors());
app.use(express.json());

// --- HÀM HỖ TRỢ ĐỌC/GHI FILE ---

// Hàm đọc dữ liệu từ file
const readDatabase = () => {
  try {
    if (!fs.existsSync(DB_FILE)) {
      // Nếu file chưa có, tạo file mới với tài khoản Admin mặc định
      const defaultData = [
        {
          email: "admin@gmail.com",
          password: "123",
          name: "Super Admin",
          role: "admin",
        },
      ];
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const data = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi đọc database:", error);
    return [];
  }
};

// Hàm ghi dữ liệu vào file
const writeDatabase = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Lỗi ghi database:", error);
    return false;
  }
};

// --- HÀM HỖ TRỢ CHO PROFILES ---

// Đọc profiles từ file
const readProfiles = () => {
  try {
    if (!fs.existsSync(PROFILES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(PROFILES_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi đọc profiles:", error);
    return [];
  }
};

// Ghi profiles vào file
const writeProfiles = (data) => {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Lỗi ghi profiles:", error);
    return false;
  }
};

// --- HÀM HỖ TRỢ CHO PROXIES ---

// Đọc proxies từ file
const readProxies = () => {
  try {
    if (!fs.existsSync(PROXIES_FILE)) {
      return [];
    }
    const data = fs.readFileSync(PROXIES_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Lỗi đọc proxies:", error);
    return [];
  }
};

// Ghi proxies vào file
const writeProxies = (data) => {
  try {
    fs.writeFileSync(PROXIES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Lỗi ghi proxies:", error);
    return false;
  }
};

// --- MIDDLEWARE: Lấy userId từ token (đơn giản) ---
const getUserIdFromToken = (req) => {
  // Lấy token từ header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  // Token đơn giản: "fake-jwt-{timestamp}"
  // Trong thực tế, cần decode JWT để lấy email
  // Tạm thời lấy từ body hoặc query nếu có
  return req.body.userId || req.query.userId || null;
};

// Middleware xác thực đơn giản
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Token không được cung cấp",
    });
  }
  next();
};

// --- API ROUTES ---

// Health Check Endpoint - để kiểm tra server có đang chạy không
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "AccSafe API Server",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      register: "POST /api/auth/register",
      login: "POST /api/auth/login",
    },
  });
});

// 0. API DEBUG: Xem tất cả users (ĐÃ BẢO MẬT)
// Cách dùng: http://IP:3000/api/users?key=AccsafeSecret2024
app.get("/api/users", (req, res) => {
  const secretKey = req.query.key;

  // Chỉ cho phép xem nếu nhập đúng mã bí mật
  if (secretKey !== "AccsafeSecret2024") {
    return res
      .status(403)
      .json({ message: "Bạn không có quyền truy cập danh sách này!" });
  }

  const users = readDatabase();
  // Ẩn mật khẩu khi trả về
  const safeUsers = users.map((u) => ({
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt,
  }));
  res.json(safeUsers);
});

// 1. API Đăng ký
app.post("/api/auth/register", (req, res) => {
  const { email, password } = req.body;
  console.log(`[REGISTER] Yêu cầu từ: ${email}`);

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Vui lòng nhập email và mật khẩu!" });
  }

  const users = readDatabase(); // Đọc dữ liệu mới nhất

  // Kiểm tra trùng email
  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ message: "Email này đã được sử dụng!" });
  }

  // Tạo user mới
  const newUser = {
    email,
    password,
    name: email.split("@")[0],
    role: "user",
    createdAt: new Date().toISOString(),
  };

  users.push(newUser); // Thêm vào danh sách
  writeDatabase(users); // Ghi xuống ổ cứng

  console.log(`[REGISTER] Thành công: ${email}`);
  res.json({
    message: "Đăng ký thành công",
    token: "fake-jwt-" + Date.now(),
    user: { email: newUser.email, name: newUser.name, role: newUser.role },
  });
});

// 2. API Đăng nhập
app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  console.log(`[LOGIN] Kiểm tra: ${email}`);

  const users = readDatabase(); // Đọc dữ liệu mới nhất

  const user = users.find((u) => u.email === email && u.password === password);

  if (!user) {
    return res.status(401).json({ message: "Email hoặc mật khẩu không đúng!" });
  }

  res.json({
    message: "Đăng nhập thành công",
    token: "fake-jwt-" + Date.now(),
    user: { email: user.email, name: user.name, role: user.role },
  });
});

// --- API PROFILES ---

// GET /api/profiles - Lấy profiles của user
app.get("/api/profiles", authenticate, (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    const profiles = readProfiles();
    // Lọc profiles theo userId
    const userProfiles = profiles.filter((p) => p.userId === userId);

    res.json({ profiles: userProfiles });
  } catch (error) {
    console.error("[Profiles] Get error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể tải danh sách profiles",
    });
  }
});

// POST /api/profiles - Tạo profile mới
app.post("/api/profiles", authenticate, (req, res) => {
  try {
    const profileData = req.body;
    const userId = profileData.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    const profiles = readProfiles();

    // Tạo profile mới
    const newProfile = {
      ...profileData,
      id: Date.now().toString(),
      userId, // Đảm bảo userId đúng
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    profiles.push(newProfile);
    writeProfiles(profiles);

    console.log(`[Profiles] Created: ${newProfile.name} for user ${userId}`);
    res.status(201).json({ profile: newProfile });
  } catch (error) {
    console.error("[Profiles] Create error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể tạo profile",
    });
  }
});

// PUT /api/profiles/:id - Cập nhật profile
app.put("/api/profiles/:id", authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = updates.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    const profiles = readProfiles();
    const profileIndex = profiles.findIndex(
      (p) => p.id === id && p.userId === userId
    );

    if (profileIndex === -1) {
      return res.status(404).json({
        error: "Not Found",
        message: "Không tìm thấy profile",
      });
    }

    // Cập nhật profile
    profiles[profileIndex] = {
      ...profiles[profileIndex],
      ...updates,
      id, // Giữ nguyên id
      userId, // Giữ nguyên userId
      updatedAt: Date.now(),
    };

    writeProfiles(profiles);

    console.log(`[Profiles] Updated: ${id} for user ${userId}`);
    res.json({ profile: profiles[profileIndex] });
  } catch (error) {
    console.error("[Profiles] Update error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể cập nhật profile",
    });
  }
});

// DELETE /api/profiles/:id - Xóa profile
app.delete("/api/profiles/:id", authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    const profiles = readProfiles();
    const profileIndex = profiles.findIndex(
      (p) => p.id === id && p.userId === userId
    );

    if (profileIndex === -1) {
      return res.status(404).json({
        error: "Not Found",
        message: "Không tìm thấy profile",
      });
    }

    // Xóa profile
    profiles.splice(profileIndex, 1);
    const writeSuccess = writeProfiles(profiles);

    if (!writeSuccess) {
      console.error(`[Profiles] Failed to write profiles file after deletion`);
      return res.status(500).json({
        error: "Internal Server Error",
        message: "Không thể lưu thay đổi vào file",
      });
    }

    console.log(`[Profiles] Deleted: ${id} for user ${userId}`);
    res.json({ success: true, message: "Profile đã được xóa" });
  } catch (error) {
    console.error("[Profiles] Delete error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể xóa profile",
    });
  }
});

// --- API PROXIES ---

// GET /api/proxies - Lấy proxies của user
app.get("/api/proxies", authenticate, (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    const proxies = readProxies();
    // Lọc proxies theo userId
    const userProxies = proxies.filter((p) => p.userId === userId);

    res.json({ proxies: userProxies });
  } catch (error) {
    console.error("[Proxies] Get error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể tải danh sách proxies",
    });
  }
});

// POST /api/proxies - Tạo proxy mới
app.post("/api/proxies", authenticate, (req, res) => {
  try {
    const proxyData = req.body;
    const userId = proxyData.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    if (!proxyData.ip || !proxyData.port) {
      return res.status(400).json({
        error: "Bad Request",
        message: "IP và Port là bắt buộc",
      });
    }

    const proxies = readProxies();

    // Tạo proxy mới
    const newProxy = {
      ...proxyData,
      id: Date.now().toString(),
      userId, // Đảm bảo userId đúng
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    proxies.push(newProxy);
    writeProxies(proxies);

    console.log(`[Proxies] Created: ${newProxy.name} for user ${userId}`);
    res.status(201).json({ proxy: newProxy });
  } catch (error) {
    console.error("[Proxies] Create error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể tạo proxy",
    });
  }
});

// PUT /api/proxies/:id - Cập nhật proxy
app.put("/api/proxies/:id", authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = updates.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    const proxies = readProxies();
    const proxyIndex = proxies.findIndex(
      (p) => p.id === id && p.userId === userId
    );

    if (proxyIndex === -1) {
      return res.status(404).json({
        error: "Not Found",
        message: "Không tìm thấy proxy",
      });
    }

    // Cập nhật proxy
    proxies[proxyIndex] = {
      ...proxies[proxyIndex],
      ...updates,
      id, // Giữ nguyên id
      userId, // Giữ nguyên userId
      updatedAt: Date.now(),
    };

    writeProxies(proxies);

    console.log(`[Proxies] Updated: ${id} for user ${userId}`);
    res.json({ proxy: proxies[proxyIndex] });
  } catch (error) {
    console.error("[Proxies] Update error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể cập nhật proxy",
    });
  }
});

// DELETE /api/proxies/:id - Xóa proxy
app.delete("/api/proxies/:id", authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        error: "Bad Request",
        message: "userId is required",
      });
    }

    const proxies = readProxies();
    const proxyIndex = proxies.findIndex(
      (p) => p.id === id && p.userId === userId
    );

    if (proxyIndex === -1) {
      return res.status(404).json({
        error: "Not Found",
        message: "Không tìm thấy proxy",
      });
    }

    // Xóa proxy
    proxies.splice(proxyIndex, 1);
    writeProxies(proxies);

    console.log(`[Proxies] Deleted: ${id} for user ${userId}`);
    res.json({ success: true, message: "Proxy đã được xóa" });
  } catch (error) {
    console.error("[Proxies] Delete error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Không thể xóa proxy",
    });
  }
});

// Khởi chạy Server
// Listen trên 0.0.0.0 để có thể kết nối từ bên ngoài (không chỉ localhost)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`=============================================`);
  console.log(`   SERVER ĐANG CHẠY TẠI PORT ${PORT}`);
  console.log(`   Listen trên: 0.0.0.0:${PORT} (có thể truy cập từ bên ngoài)`);
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Network: http://0.0.0.0:${PORT}`);
  console.log(`   Users: ${DB_FILE}`);
  console.log(`   Profiles: ${PROFILES_FILE}`);
  console.log(`   Proxies: ${PROXIES_FILE}`);
  console.log(`   Health Check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`=============================================`);
});
