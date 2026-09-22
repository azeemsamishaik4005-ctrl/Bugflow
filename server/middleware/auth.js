const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Access denied. No authentication token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defectx_super_secret_jwt_key_2026');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
};

/**
 * Normalizes user role string to one of standard canonical roles:
 * 'admin', 'project_manager', 'developer', 'tester'
 */
const normalizeRole = (role = '') => {
  const r = String(role).toLowerCase().trim();
  if (r === 'admin' || r.includes('administrator')) return 'admin';
  if (r.includes('manager') || r.includes('lead') || r === 'pm') return 'project_manager';
  if (r.includes('qa') || r.includes('test') || r.includes('reporter')) return 'tester';
  if (r.includes('dev') || r.includes('engineer') || r.includes('developer')) return 'developer';
  return r || 'user';
};

/**
 * Role-Based Access Control Middleware
 * Supports granular permissions: e.g. authorizeRoles('admin', 'project_manager')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }

    const rawRole = req.user.role || 'user';
    const userRole = normalizeRole(rawRole);
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());

    // Admin has superuser access to all actions
    if (userRole === 'admin' || rawRole.toLowerCase() === 'admin') {
      return next();
    }

    if (normalizedAllowed.includes(userRole) || normalizedAllowed.includes(rawRole.toLowerCase())) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Access forbidden: Role '${rawRole}' is not authorized to perform this operation. Allowed roles: ${allowedRoles.join(', ')}`
    });
  };
};

authMiddleware.authMiddleware = authMiddleware;
authMiddleware.authorizeRoles = authorizeRoles;
authMiddleware.normalizeRole = normalizeRole;

module.exports = authMiddleware;
