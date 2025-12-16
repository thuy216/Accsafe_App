// Middleware xác thực và kiểm tra quyền
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Token không được cung cấp' 
    });
  }
  
  const token = authHeader.replace('Bearer ', '');
  if (!token || !token.startsWith('fake-jwt-')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Token không hợp lệ' 
    });
  }
  
  next();
};

// Middleware kiểm tra user có quyền truy cập data của chính họ
const checkUserOwnership = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Token không được cung cấp' 
    });
  }
  
  const token = authHeader.replace('Bearer ', '');
  const requestedUserId = req.query.userId || req.body.userId;
  
  if (!requestedUserId) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'userId is required' 
    });
  }
  
  // Extract email từ token: fake-jwt-{timestamp}-{email}
  const tokenParts = token.split('-');
  
  // Hỗ trợ cả token format cũ (không có email) và mới (có email)
  if (tokenParts.length < 4) {
    // Token format cũ (fake-jwt-{timestamp}) - cho phép nhưng cảnh báo
    console.warn('[WARN] Token format cũ, không thể verify ownership. Cho phép truy cập.');
    return next();
  }
  
  // Token format mới: fake-jwt-{timestamp}-{email}
  // Lấy phần email (từ phần tử thứ 3 trở đi, join lại vì email có thể chứa dấu -)
  const tokenEmail = tokenParts.slice(3).join('-');
  
  // Kiểm tra email trong token có khớp với requestedUserId không
  if (tokenEmail !== requestedUserId) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Không có quyền truy cập dữ liệu của người khác' 
    });
  }
  
  next();
};

module.exports = { authenticate, checkUserOwnership };

