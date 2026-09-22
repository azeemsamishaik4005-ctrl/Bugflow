/**
 * DefectX Input Validation & Sanitization Middleware
 * Enforces schema constraints, value white-listing, and state transitions.
 */

const ALLOWED_SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Major', 'Minor'];
const ALLOWED_PRIORITIES = ['P1', 'P2', 'P3'];
const ALLOWED_STATUSES = [
  'Open',
  'Assigned',
  'In Progress',
  'In Review',
  'Resolved',
  'Verified',
  'Reopened',
  'Closed',
  'Retest/Verify' // for backwards compatibility
];

const ALLOWED_COMPONENTS = [
  'Authentication',
  'Billing & Payments',
  'API & Backend',
  'Frontend UI',
  'Database',
  'Mobile & Responsive',
  'Performance & Memory',
  'Security',
  'General'
];

const ALLOWED_ENVIRONMENTS = [
  'Production',
  'Staging',
  'QA',
  'Development',
  'UAT'
];

const VALID_STATE_TRANSITIONS = {
  'Open': ['Assigned', 'In Progress', 'Retest/Verify', 'Resolved', 'Closed'],
  'Assigned': ['In Progress', 'Open', 'Retest/Verify', 'Resolved', 'Closed'],
  'In Progress': ['In Review', 'Retest/Verify', 'Resolved', 'Open', 'Closed'],
  'In Review': ['Resolved', 'In Progress', 'Reopened', 'Retest/Verify', 'Closed'],
  'Retest/Verify': ['Resolved', 'Verified', 'Closed', 'In Progress', 'Open', 'Reopened'],
  'Resolved': ['Verified', 'Closed', 'Reopened', 'Retest/Verify', 'In Progress', 'Open'],
  'Verified': ['Closed', 'Reopened', 'In Progress'],
  'Reopened': ['Assigned', 'In Progress', 'In Review', 'Resolved', 'Closed'],
  'Closed': ['Reopened', 'Open', 'In Progress']
};

/**
 * Validates state transition legality
 */
const isValidTransition = (currentStatus, newStatus) => {
  if (!currentStatus || !newStatus || currentStatus === newStatus) return true;
  const allowed = VALID_STATE_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(newStatus) : true;
};

/**
 * Validates request payload for creating a defect
 */
const validateCreateIssue = (req, res, next) => {
  const { title, description, severity, priority, status, component, environment, project_id, sprint_id } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: 'Defect title is required and must be at least 3 characters long.',
      message: 'Defect title is required and must be at least 3 characters long.'
    });
  }

  if (title.trim().length > 255) {
    return res.status(400).json({
      success: false,
      error: 'Defect title cannot exceed 255 characters.',
      message: 'Defect title cannot exceed 255 characters.'
    });
  }

  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error: 'Defect description is required and must be at least 5 characters long.',
      message: 'Defect description is required and must be at least 5 characters long.'
    });
  }

  if (severity && !ALLOWED_SEVERITIES.includes(severity)) {
    return res.status(400).json({
      success: false,
      error: `Invalid severity '${severity}'. Allowed values: ${ALLOWED_SEVERITIES.join(', ')}`,
      message: `Invalid severity '${severity}'. Allowed values: ${ALLOWED_SEVERITIES.join(', ')}`
    });
  }

  if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: `Invalid priority '${priority}'. Allowed values: ${ALLOWED_PRIORITIES.join(', ')}`,
      message: `Invalid priority '${priority}'. Allowed values: ${ALLOWED_PRIORITIES.join(', ')}`
    });
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      message: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
    });
  }

  if (component && !ALLOWED_COMPONENTS.includes(component)) {
    return res.status(400).json({
      success: false,
      error: `Invalid component '${component}'. Allowed values: ${ALLOWED_COMPONENTS.join(', ')}`,
      message: `Invalid component '${component}'. Allowed values: ${ALLOWED_COMPONENTS.join(', ')}`
    });
  }

  if (environment && !ALLOWED_ENVIRONMENTS.includes(environment)) {
    return res.status(400).json({
      success: false,
      error: `Invalid environment '${environment}'. Allowed values: ${ALLOWED_ENVIRONMENTS.join(', ')}`,
      message: `Invalid environment '${environment}'. Allowed values: ${ALLOWED_ENVIRONMENTS.join(', ')}`
    });
  }

  next();
};

/**
 * Validates request payload for updating a defect
 */
const validateUpdateIssue = (req, res, next) => {
  const { title, description, severity, priority, status, component, environment } = req.body;

  if (title !== undefined && (typeof title !== 'string' || title.trim().length < 3)) {
    return res.status(400).json({
      success: false,
      error: 'Defect title must be at least 3 characters long.',
      message: 'Defect title must be at least 3 characters long.'
    });
  }

  if (description !== undefined && (typeof description !== 'string' || description.trim().length < 5)) {
    return res.status(400).json({
      success: false,
      error: 'Defect description must be at least 5 characters long.',
      message: 'Defect description must be at least 5 characters long.'
    });
  }

  if (severity && !ALLOWED_SEVERITIES.includes(severity)) {
    return res.status(400).json({
      success: false,
      error: `Invalid severity '${severity}'. Allowed values: ${ALLOWED_SEVERITIES.join(', ')}`,
      message: `Invalid severity '${severity}'. Allowed values: ${ALLOWED_SEVERITIES.join(', ')}`
    });
  }

  if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: `Invalid priority '${priority}'. Allowed values: ${ALLOWED_PRIORITIES.join(', ')}`,
      message: `Invalid priority '${priority}'. Allowed values: ${ALLOWED_PRIORITIES.join(', ')}`
    });
  }

  if (status && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(', ')}`,
      message: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(', ')}`
    });
  }

  if (component && !ALLOWED_COMPONENTS.includes(component)) {
    return res.status(400).json({
      success: false,
      error: `Invalid component '${component}'. Allowed values: ${ALLOWED_COMPONENTS.join(', ')}`,
      message: `Invalid component '${component}'. Allowed values: ${ALLOWED_COMPONENTS.join(', ')}`
    });
  }

  if (environment && !ALLOWED_ENVIRONMENTS.includes(environment)) {
    return res.status(400).json({
      success: false,
      error: `Invalid environment '${environment}'. Allowed values: ${ALLOWED_ENVIRONMENTS.join(', ')}`,
      message: `Invalid environment '${environment}'. Allowed values: ${ALLOWED_ENVIRONMENTS.join(', ')}`
    });
  }

  next();
};

/**
 * Validates comment payload
 */
const validateComment = (req, res, next) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Comment content cannot be empty.',
      message: 'Comment content cannot be empty.'
    });
  }
  if (content.length > 5000) {
    return res.status(400).json({
      success: false,
      error: 'Comment content exceeds maximum limit of 5000 characters.',
      message: 'Comment content exceeds maximum limit of 5000 characters.'
    });
  }
  next();
};

const ALLOWED_RELATIONSHIP_TYPES = ['Depends On', 'Blocks', 'Related To', 'Caused By'];

const normalizeRelationshipType = (type) => {
  if (!type || typeof type !== 'string') return null;
  const t = type.trim().toLowerCase().replace(/_/g, ' ');
  if (t === 'depends on') return 'Depends On';
  if (t === 'blocks') return 'Blocks';
  if (t === 'related to') return 'Related To';
  if (t === 'caused by') return 'Caused By';
  return null;
};

/**
 * Validates request payload for defect dependency creation
 */
const validateDependency = (req, res, next) => {
  const rawRelated = req.body.related_issue_id || req.body.target_issue_id;
  const issueId = parseInt(req.params.id, 10);
  const relatedId = parseInt(rawRelated, 10);

  if (isNaN(issueId)) {
    return res.status(400).json({ success: false, error: 'Invalid parent defect ID.' });
  }

  if (!rawRelated || isNaN(relatedId)) {
    return res.status(400).json({
      success: false,
      error: 'Related defect ID is required and must be an integer.',
      message: 'Related defect ID is required and must be an integer.'
    });
  }

  if (issueId === relatedId) {
    return res.status(400).json({
      success: false,
      error: 'A defect cannot create a dependency relationship to itself.',
      message: 'A defect cannot create a dependency relationship to itself.'
    });
  }

  const normalized = normalizeRelationshipType(req.body.relationship_type);
  if (!normalized) {
    return res.status(400).json({
      success: false,
      error: `Invalid relationship type '${req.body.relationship_type}'. Allowed types: ${ALLOWED_RELATIONSHIP_TYPES.join(', ')}`,
      message: `Invalid relationship type '${req.body.relationship_type}'. Allowed types: ${ALLOWED_RELATIONSHIP_TYPES.join(', ')}`
    });
  }

  req.body.relationship_type = normalized;
  req.body.related_issue_id = relatedId;

  next();
};

module.exports = {
  ALLOWED_SEVERITIES,
  ALLOWED_PRIORITIES,
  ALLOWED_STATUSES,
  ALLOWED_COMPONENTS,
  ALLOWED_ENVIRONMENTS,
  ALLOWED_RELATIONSHIP_TYPES,
  VALID_STATE_TRANSITIONS,
  isValidTransition,
  validateCreateIssue,
  validateUpdateIssue,
  validateComment,
  validateDependency
};
