#!/bin/bash

# Script để fix lỗi kết nối server - ERR_CONNECTION_REFUSED
# Chạy script này trên VPS để đảm bảo server có thể kết nối từ bên ngoài

echo "=========================================="
echo "   FIX SERVER CONNECTION ISSUES"
echo "=========================================="
echo ""

# Lấy thư mục hiện tại
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 1. Kiểm tra server.js có listen trên 0.0.0.0 không
echo "1. Kiểm tra server.js configuration..."
if grep -q 'app.listen(PORT, "0.0.0.0"' server.js; then
    echo "   ✅ Server đã được cấu hình để listen trên 0.0.0.0"
else
    echo "   ⚠️  Server chưa listen trên 0.0.0.0, đang sửa..."
    # Backup
    cp server.js server.js.bak
    
    # Sửa listen
    sed -i 's/app.listen(PORT/app.listen(PORT, "0.0.0.0"/g' server.js
    echo "   ✅ Đã sửa server.js"
fi
echo ""

# 2. Kiểm tra health check endpoint
echo "2. Kiểm tra health check endpoint..."
if grep -q 'app.get("/api/health"' server.js || grep -q 'app.get("/api/health"' server.js; then
    echo "   ✅ Health check endpoint đã có"
else
    echo "   ⚠️  Health check endpoint chưa có, đang thêm..."
    # Tìm vị trí sau app.use(express.json())
    # Thêm health check endpoint
    cat > /tmp/health_endpoint.txt << 'EOF'
// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    port: PORT
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
      login: "POST /api/auth/login"
    }
  });
});

EOF
    # Chèn vào sau app.use(express.json())
    sed -i '/app.use(express.json());/r /tmp/health_endpoint.txt' server.js
    rm /tmp/health_endpoint.txt
    echo "   ✅ Đã thêm health check endpoint"
fi
echo ""

# 3. Kiểm tra CORS
echo "3. Kiểm tra CORS configuration..."
if grep -q "origin: '*'" server.js || grep -q "origin: \"*\"" server.js; then
    echo "   ✅ CORS đã được cấu hình để cho phép tất cả origins"
else
    echo "   ⚠️  CORS có thể chưa được cấu hình đúng"
    echo "   💡 Đảm bảo có: app.use(cors({ origin: '*' }))"
fi
echo ""

# 4. Kiểm tra firewall
echo "4. Kiểm tra Firewall (Port 3000)..."
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "3000/tcp"; then
        echo "   ✅ Port 3000 đã được mở trong UFW"
    else
        echo "   ⚠️  Port 3000 chưa được mở trong UFW"
        echo "   💡 Chạy: sudo ufw allow 3000/tcp"
        echo "   💡 Sau đó: sudo ufw reload"
    fi
elif command -v firewall-cmd &> /dev/null; then
    if firewall-cmd --list-ports 2>/dev/null | grep -q "3000"; then
        echo "   ✅ Port 3000 đã được mở trong firewalld"
    else
        echo "   ⚠️  Port 3000 chưa được mở trong firewalld"
        echo "   💡 Chạy: sudo firewall-cmd --permanent --add-port=3000/tcp"
        echo "   💡 Sau đó: sudo firewall-cmd --reload"
    fi
else
    echo "   ⚠️  Không tìm thấy firewall tool (ufw hoặc firewalld)"
    echo "   💡 Kiểm tra iptables hoặc firewall khác"
fi
echo ""

# 5. Kiểm tra server có đang chạy không
echo "5. Kiểm tra server process..."
if pgrep -f "node.*server.js" > /dev/null; then
    echo "   ✅ Server đang chạy"
    PID=$(pgrep -f "node.*server.js" | head -1)
    echo "   📊 PID: $PID"
    
    # Kiểm tra xem process có listen trên 0.0.0.0:3000 không
    if netstat -tuln 2>/dev/null | grep -q ":3000.*0.0.0.0"; then
        echo "   ✅ Server đang listen trên 0.0.0.0:3000 (có thể truy cập từ bên ngoài)"
    elif netstat -tuln 2>/dev/null | grep -q ":3000.*127.0.0.1"; then
        echo "   ❌ Server chỉ listen trên 127.0.0.1:3000 (chỉ localhost)"
        echo "   💡 Cần restart server sau khi sửa server.js"
    else
        echo "   ⚠️  Không thể xác định interface server đang listen"
    fi
else
    echo "   ❌ Server không chạy"
    echo "   💡 Khởi động server:"
    if command -v pm2 &> /dev/null; then
        echo "      pm2 start server.js --name accsafe-api"
    else
        echo "      node server.js"
        echo "      hoặc: nohup node server.js > server.log 2>&1 &"
    fi
fi
echo ""

# 6. Test kết nối local
echo "6. Test kết nối local..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
    echo "   ✅ Server phản hồi trên localhost"
    curl -s http://localhost:3000/api/health | head -c 100
    echo ""
else
    echo "   ❌ Server không phản hồi trên localhost"
    echo "   💡 Kiểm tra server có đang chạy không"
fi
echo ""

# 7. Test kết nối từ bên ngoài (nếu có IP public)
echo "7. Test kết nối từ bên ngoài..."
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "unknown")
if [ "$PUBLIC_IP" != "unknown" ]; then
    echo "   📍 Public IP: $PUBLIC_IP"
    if curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://$PUBLIC_IP:3000/api/health 2>/dev/null | grep -q "200"; then
        echo "   ✅ Server có thể truy cập từ bên ngoài"
    else
        echo "   ⚠️  Server không thể truy cập từ bên ngoài"
        echo "   💡 Kiểm tra:"
        echo "      1. Firewall đã mở port 3000 chưa?"
        echo "      2. Server có listen trên 0.0.0.0 chưa?"
        echo "      3. Cloud provider security group có cho phép port 3000 không?"
    fi
else
    echo "   ⚠️  Không thể lấy public IP để test"
fi
echo ""

# 8. Hướng dẫn restart server
echo "8. Hướng dẫn restart server..."
if command -v pm2 &> /dev/null; then
    echo "   💡 Để restart server với PM2:"
    echo "      pm2 restart accsafe-api"
    echo "      hoặc: pm2 restart all"
    echo ""
    echo "   💡 Để xem logs:"
    echo "      pm2 logs accsafe-api"
else
    echo "   💡 Để restart server:"
    echo "      1. Tìm PID: ps aux | grep 'node.*server.js'"
    echo "      2. Kill process: kill <PID>"
    echo "      3. Khởi động lại: node server.js"
fi
echo ""

echo "=========================================="
echo "   KẾT THÚC KIỂM TRA"
echo "=========================================="
echo ""
echo "📋 TÓM TẮT CÁC BƯỚC CẦN LÀM:"
echo ""
echo "1. ✅ Đảm bảo server.js listen trên 0.0.0.0:3000"
echo "2. ✅ Mở port 3000 trong firewall"
echo "3. ✅ Restart server sau khi sửa"
echo "4. ✅ Kiểm tra cloud provider security group (nếu dùng VPS)"
echo ""
echo "🔧 LỆNH NHANH:"
echo "   # Mở firewall (Ubuntu/Debian):"
echo "   sudo ufw allow 3000/tcp && sudo ufw reload"
echo ""
echo "   # Restart với PM2:"
echo "   pm2 restart accsafe-api"
echo ""
echo "   # Test kết nối:"
echo "   curl http://localhost:3000/api/health"
echo "   curl http://YOUR_PUBLIC_IP:3000/api/health"
echo ""

