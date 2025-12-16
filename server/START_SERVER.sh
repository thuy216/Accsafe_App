#!/bin/bash

# Script để khởi động server AccSafe API

echo "=========================================="
echo "   KHỞI ĐỘNG SERVER ACCSAFE API"
echo "=========================================="
echo ""

# Lấy thư mục hiện tại
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 1. Kiểm tra Node.js
echo "1. Kiểm tra Node.js..."
if ! command -v node &> /dev/null; then
    echo "   ❌ Node.js chưa được cài đặt"
    echo "   💡 Cài đặt: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "   💡 Sau đó: sudo apt-get install -y nodejs"
    exit 1
fi
echo "   ✅ Node.js version: $(node -v)"
echo ""

# 2. Kiểm tra file server.js
echo "2. Kiểm tra file server.js..."
if [ ! -f "server.js" ]; then
    echo "   ❌ Không tìm thấy server.js"
    exit 1
fi
echo "   ✅ server.js tồn tại"
echo ""

# 3. Kiểm tra server.js có listen trên 0.0.0.0 không
echo "3. Kiểm tra cấu hình server..."
if grep -q 'app.listen(PORT, "0.0.0.0"' server.js; then
    echo "   ✅ Server đã được cấu hình để listen trên 0.0.0.0"
else
    echo "   ⚠️  Server chưa listen trên 0.0.0.0"
    echo "   💡 Đang sửa..."
    # Backup
    cp server.js server.js.bak.$(date +%Y%m%d_%H%M%S)
    
    # Sửa listen
    sed -i 's/app.listen(PORT)/app.listen(PORT, "0.0.0.0"/g' server.js
    sed -i 's/app.listen(PORT, ()/app.listen(PORT, "0.0.0.0", ()/g' server.js
    echo "   ✅ Đã sửa server.js"
fi
echo ""

# 4. Kiểm tra dependencies
echo "4. Kiểm tra dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   ⚠️  node_modules chưa có, đang cài đặt..."
    npm install
    if [ $? -ne 0 ]; then
        echo "   ❌ Lỗi khi cài đặt dependencies"
        exit 1
    fi
    echo "   ✅ Đã cài đặt dependencies"
else
    echo "   ✅ node_modules đã tồn tại"
fi
echo ""

# 5. Kiểm tra port 3000 có đang được sử dụng không
echo "5. Kiểm tra port 3000..."
if netstat -tuln 2>/dev/null | grep -q ":3000 "; then
    PID=$(netstat -tulpn 2>/dev/null | grep ":3000 " | awk '{print $7}' | cut -d'/' -f1)
    echo "   ⚠️  Port 3000 đang được sử dụng bởi process $PID"
    echo "   💡 Bạn có muốn kill process này và khởi động lại? (y/n)"
    read -r answer
    if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
        kill -9 $PID 2>/dev/null
        sleep 1
        echo "   ✅ Đã kill process cũ"
    else
        echo "   ❌ Không thể khởi động server vì port đang được sử dụng"
        exit 1
    fi
else
    echo "   ✅ Port 3000 đang trống"
fi
echo ""

# 6. Khởi động server
echo "6. Khởi động server..."

# Kiểm tra PM2
if command -v pm2 &> /dev/null; then
    echo "   💡 Sử dụng PM2 để khởi động server..."
    
    # Kiểm tra xem đã có process nào chạy chưa
    if pm2 list | grep -q "accsafe-api"; then
        echo "   ⚠️  Process accsafe-api đã tồn tại trong PM2"
        echo "   💡 Đang restart..."
        pm2 restart accsafe-api
    else
        echo "   💡 Đang start server với PM2..."
        pm2 start server.js --name accsafe-api
    fi
    
    sleep 2
    
    # Kiểm tra status
    if pm2 list | grep -q "accsafe-api.*online"; then
        echo "   ✅ Server đã khởi động thành công với PM2"
        echo ""
        echo "   📊 PM2 Status:"
        pm2 list | grep accsafe-api
        echo ""
        echo "   💡 Các lệnh hữu ích:"
        echo "      - Xem logs: pm2 logs accsafe-api"
        echo "      - Restart: pm2 restart accsafe-api"
        echo "      - Stop: pm2 stop accsafe-api"
        echo "      - Status: pm2 status"
    else
        echo "   ❌ Server không khởi động được với PM2"
        echo "   💡 Xem logs: pm2 logs accsafe-api"
        exit 1
    fi
else
    echo "   💡 PM2 chưa được cài đặt, khởi động trực tiếp với node..."
    echo "   ⚠️  Lưu ý: Server sẽ chạy trong foreground"
    echo "   💡 Để chạy background, dùng: nohup node server.js > server.log 2>&1 &"
    echo ""
    
    # Hỏi có muốn cài PM2 không
    echo "   💡 Bạn có muốn cài PM2 để quản lý server tốt hơn? (y/n)"
    read -r install_pm2
    if [ "$install_pm2" = "y" ] || [ "$install_pm2" = "Y" ]; then
        echo "   💡 Đang cài PM2..."
        npm install -g pm2
        if [ $? -eq 0 ]; then
            pm2 start server.js --name accsafe-api
            pm2 startup
            pm2 save
            echo "   ✅ Đã cài PM2 và khởi động server"
        else
            echo "   ❌ Lỗi khi cài PM2, khởi động trực tiếp với node..."
            nohup node server.js > server.log 2>&1 &
            echo "   ✅ Server đã khởi động (PID: $!)"
            echo "   💡 Xem logs: tail -f server.log"
        fi
    else
        nohup node server.js > server.log 2>&1 &
        echo "   ✅ Server đã khởi động (PID: $!)"
        echo "   💡 Xem logs: tail -f server.log"
    fi
fi
echo ""

# 7. Kiểm tra server có chạy không
echo "7. Kiểm tra server..."
sleep 2

if pgrep -f "node.*server.js" > /dev/null; then
    PID=$(pgrep -f "node.*server.js" | head -1)
    echo "   ✅ Server đang chạy (PID: $PID)"
    
    # Kiểm tra port
    if netstat -tuln 2>/dev/null | grep -q ":3000.*0.0.0.0"; then
        echo "   ✅ Server đang listen trên 0.0.0.0:3000 (có thể truy cập từ bên ngoài)"
    elif netstat -tuln 2>/dev/null | grep -q ":3000"; then
        echo "   ⚠️  Server đang listen trên port 3000 nhưng có thể chỉ localhost"
    fi
else
    echo "   ❌ Server không chạy"
    exit 1
fi
echo ""

# 8. Test health check
echo "8. Test health check endpoint..."
sleep 1
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "   ✅ Health check: OK"
    curl -s http://localhost:3000/api/health | head -c 200
    echo ""
else
    echo "   ⚠️  Health check: HTTP $HEALTH_RESPONSE"
    echo "   💡 Server có thể đang khởi động, đợi thêm vài giây..."
fi
echo ""

# 9. Kiểm tra firewall
echo "9. Kiểm tra firewall..."
if command -v ufw &> /dev/null; then
    if ufw status | grep -q "3000/tcp"; then
        echo "   ✅ Port 3000 đã được mở trong UFW"
    else
        echo "   ⚠️  Port 3000 chưa được mở trong UFW"
        echo "   💡 Chạy: sudo ufw allow 3000/tcp && sudo ufw reload"
    fi
elif command -v firewall-cmd &> /dev/null; then
    if firewall-cmd --list-ports 2>/dev/null | grep -q "3000"; then
        echo "   ✅ Port 3000 đã được mở trong firewalld"
    else
        echo "   ⚠️  Port 3000 chưa được mở trong firewalld"
        echo "   💡 Chạy: sudo firewall-cmd --permanent --add-port=3000/tcp && sudo firewall-cmd --reload"
    fi
else
    echo "   ⚠️  Không tìm thấy firewall tool"
fi
echo ""

echo "=========================================="
echo "   KHỞI ĐỘNG HOÀN TẤT"
echo "=========================================="
echo ""
echo "📋 THÔNG TIN SERVER:"
echo "   - URL: http://163.44.193.71:3000"
echo "   - Health Check: http://163.44.193.71:3000/api/health"
echo "   - Login API: http://163.44.193.71:3000/api/auth/login"
echo ""
echo "🔧 LỆNH HỮU ÍCH:"
if command -v pm2 &> /dev/null; then
    echo "   - Xem logs: pm2 logs accsafe-api"
    echo "   - Restart: pm2 restart accsafe-api"
    echo "   - Stop: pm2 stop accsafe-api"
    echo "   - Status: pm2 status"
else
    echo "   - Xem logs: tail -f server.log"
    echo "   - Kill server: pkill -f 'node.*server.js'"
fi
echo ""
echo "🧪 TEST KẾT NỐI:"
echo "   curl http://localhost:3000/api/health"
echo "   curl http://163.44.193.71:3000/api/health"
echo ""

