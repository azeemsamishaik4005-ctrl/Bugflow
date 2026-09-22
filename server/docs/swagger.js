const express = require('express');
const swaggerUi = require('swagger-ui-express');

const router = express.Router();

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'DefectX REST API',
    version: '1.0.0',
    description: 'DefectX — Intelligent Software Defect Tracking System with Resolution Assistance API Documentation'
  },
  servers: [
    {
      url: '/api',
      description: 'DefectX Backend API Base'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT Bearer token obtained from /api/auth/login or /api/auth/register'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Admin User' },
          email: { type: 'string', example: 'admin@defectx.io' },
          role: { type: 'string', example: 'admin' },
          created_at: { type: 'string', format: 'date-time' }
        }
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'DefectX Core Platform' },
          description: { type: 'string', example: 'Main DefectX Web Application Service' },
          owner_id: { type: 'integer', example: 1 },
          issue_count: { type: 'integer', example: 5 }
        }
      },
      Issue: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          project_id: { type: 'integer', example: 1 },
          sprint_id: { type: 'integer', nullable: true, example: 2 },
          title: { type: 'string', example: 'Authentication Token Expiration Loop on Refresh' },
          description: { type: 'string', example: 'Session logout on page refresh due to timestamp mismatch.' },
          type: { type: 'string', enum: ['Bug', 'Feature'], example: 'Bug' },
          priority: { type: 'string', enum: ['P1', 'P2', 'P3'], example: 'P1' },
          severity: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'], example: 'Critical' },
          status: { type: 'string', enum: ['Open', 'In Progress', 'Retest/Verify', 'Resolved', 'Closed'], example: 'In Progress' },
          component: { type: 'string', example: 'Authentication' },
          reporter_id: { type: 'integer', example: 1 },
          assignee_id: { type: 'integer', nullable: true, example: 2 },
          root_cause: { type: 'string', nullable: true, example: 'Epoch millisecond comparison mismatch' },
          resolution_notes: { type: 'string', nullable: true, example: 'Corrected timestamp parser in auth middleware' },
          resolved_at: { type: 'string', format: 'date-time', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      },
      Analytics: {
        type: 'object',
        properties: {
          time_range: { type: 'string', example: '30d' },
          summary: {
            type: 'object',
            properties: {
              total_defects: { type: 'integer', example: 7 },
              open_defects: { type: 'integer', example: 2 },
              in_progress_defects: { type: 'integer', example: 2 },
              resolved_defects: { type: 'integer', example: 2 },
              closed_defects: { type: 'integer', example: 1 }
            }
          },
          by_severity: {
            type: 'object',
            properties: {
              Critical: { type: 'integer', example: 3 },
              High: { type: 'integer', example: 2 },
              Medium: { type: 'integer', example: 1 },
              Low: { type: 'integer', example: 1 }
            }
          },
          by_category: {
            type: 'object',
            additionalProperties: { type: 'integer' }
          },
          by_status: {
            type: 'object',
            additionalProperties: { type: 'integer' }
          },
          developer_workload: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                role: { type: 'string' },
                assigned_defects: { type: 'integer' },
                open_defects: { type: 'integer' },
                resolved_defects: { type: 'integer' },
                critical_high_defects: { type: 'integer' }
              }
            }
          },
          defect_trends: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', example: '2026-08-20' },
                created: { type: 'integer', example: 2 },
                resolved: { type: 'integer', example: 1 }
              }
            }
          },
          average_resolution_time: {
            type: 'object',
            properties: {
              hours: { type: 'number', example: 28.5 },
              days: { type: 'number', example: 1.2 },
              formatted: { type: 'string', example: '28.5 hrs' },
              resolved_count: { type: 'integer', example: 3 }
            }
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Resource not found or invalid input parameter.' }
        }
      }
    }
  },
  security: [
    {
      BearerAuth: []
    }
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Register a new user account',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'John Developer' },
                  email: { type: 'string', example: 'john@bugflow.io' },
                  password: { type: 'string', example: 'SecurePass123!' },
                  role: { type: 'string', example: 'Software Engineer' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Registration successful, returns user and JWT token' },
          400: { description: 'User already exists or missing required fields' }
        }
      }
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Log in to obtain JWT access token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@bugflow.io' },
                  password: { type: 'string', example: 'admin123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get current authenticated user profile',
        responses: {
          200: { description: 'Current profile data' },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Get list of team members for defect assignment and workload',
        responses: {
          200: { description: 'Array of users' }
        }
      }
    },
    '/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List all projects',
        responses: {
          200: { description: 'Array of projects' }
        }
      },
      post: {
        tags: ['Projects'],
        summary: 'Create a new project workspace',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'Payment Microservice' },
                  description: { type: 'string', example: 'Checkout gateway pipeline' }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Project created' }
        }
      }
    },
    '/issues': {
      get: {
        tags: ['Issues & Defects'],
        summary: 'Query and filter defects',
        parameters: [
          { name: 'project_id', in: 'query', schema: { type: 'integer' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'severity', in: 'query', schema: { type: 'string' } },
          { name: 'component', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          200: { description: 'List of matching issues and summary telemetry' }
        }
      },
      post: {
        tags: ['Issues & Defects'],
        summary: 'Report a new defect',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description'],
                properties: {
                  title: { type: 'string', example: 'Checkout API double submit' },
                  description: { type: 'string', example: 'Detailed steps to reproduce...' },
                  type: { type: 'string', example: 'Bug' },
                  priority: { type: 'string', example: 'P1' },
                  severity: { type: 'string', example: 'Critical' },
                  component: { type: 'string', example: 'Billing & Payments' },
                  project_id: { type: 'integer', example: 1 },
                  assignee_id: { type: 'integer', example: 2 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Issue created successfully' }
        }
      }
    },
    '/issues/{id}': {
      get: {
        tags: ['Issues & Defects'],
        summary: 'Get single defect details with comments and history',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Issue details object' },
          404: { description: 'Issue not found' }
        }
      },
      put: {
        tags: ['Issues & Defects'],
        summary: 'Update defect properties or status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'In Progress' },
                  priority: { type: 'string', example: 'P1' },
                  assignee_id: { type: 'integer', example: 2 },
                  root_cause: { type: 'string' },
                  resolution_notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Issue updated' },
          400: { description: 'Invalid transition or bad request' }
        }
      },
      delete: {
        tags: ['Issues & Defects'],
        summary: 'Delete a defect record',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Issue deleted' }
        }
      }
    },
    '/issues/{id}/resolve': {
      post: {
        tags: ['Resolution Workflow'],
        summary: 'Resolve an issue with root cause and resolution notes',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['resolution_notes'],
                properties: {
                  root_cause: { type: 'string', example: 'Lacked button debouncing on frontend' },
                  resolution_notes: { type: 'string', example: 'Added client-side debouncing and backend idempotency validation' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Issue successfully resolved with timestamp and activity log' },
          400: { description: 'Missing resolution notes' }
        }
      }
    },
    '/analytics': {
      get: {
        tags: ['Analytics Dashboard'],
        summary: 'Fetch real defect statistics, distributions, developer workload, and resolution times',
        parameters: [
          { name: 'time_range', in: 'query', schema: { type: 'string', enum: ['7d', '30d', '90d', 'all'], default: '30d' } },
          { name: 'project_id', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          200: {
            description: 'Analytics payload',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Analytics' } } }
          }
        }
      }
    },
    '/ai/summarize': {
      post: {
        tags: ['AI Intelligence'],
        summary: 'Generate concise executive summary of defect without modifying original text',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Authentication Token Expiration Loop' },
                  description: { type: 'string', example: 'Users experience session logout on page refresh...' },
                  component: { type: 'string', example: 'Authentication' },
                  severity: { type: 'string', example: 'Critical' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'AI generated summary' }
        }
      }
    },
    '/ai/resolution-recommendation': {
      post: {
        tags: ['AI Intelligence'],
        summary: 'Generate practical developer resolution recommendations based on defect & history',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  component: { type: 'string' },
                  commentsText: { type: 'string' },
                  similarResolutions: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Actionable guidance with steps and precautions' }
        }
      }
    },
    '/ai/historical-resolutions': {
      post: {
        tags: ['AI Intelligence'],
        summary: 'Semantic search across resolved/closed defects to retrieve past root causes and fixes',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string', example: 'Payment API triggered twice' },
                  description: { type: 'string' },
                  component: { type: 'string' },
                  issue_id: { type: 'integer' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Array of similar resolved defects with similarity scores and root causes' }
        }
      }
    },
    '/ai/investigate-root-cause': {
      post: {
        tags: ['AI Intelligence'],
        summary: 'Generate prioritized investigation suggestions checklist for developers',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  component: { type: 'string' },
                  severity: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: '5 prioritized investigation suggestions and disclaimer' }
        }
      }
    },
    '/ai/verify-resolution': {
      post: {
        tags: ['AI Intelligence'],
        summary: 'Verify developer resolution notes against reported defect',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['resolution_notes'],
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  resolution_notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Verification verdict (Verified / Needs Changes), confidence, and suggested tests' }
        }
      }
    },
    '/ai/assistant': {
      post: {
        tags: ['AI Intelligence'],
        summary: 'DefectX Floating AI Assistant & Grounded Intelligence Engine',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string', example: 'What are the critical P1 bugs in the system?' },
                  history: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant'] },
                        content: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Grounded assistant response with defect telemetry and historical context',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    answer: { type: 'string' },
                    intent: { type: 'string' },
                    grounded_defects: { type: 'array' },
                    historical_context: { type: 'array' },
                    telemetry: { type: 'object' },
                    suggestions: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          401: { description: 'Unauthorized' }
        }
      }
    },
    '/issues/{id}/dependencies': {
      get: {
        summary: 'Get defect dependencies',
        tags: ['Defect Dependencies'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'List of defect dependencies' } }
      },
      post: {
        summary: 'Create defect dependency',
        tags: ['Defect Dependencies'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['related_issue_id', 'relationship_type'],
                properties: {
                  related_issue_id: { type: 'integer', example: 2 },
                  relationship_type: { type: 'string', enum: ['Depends On', 'Blocks', 'Related To', 'Caused By'] }
                }
              }
            }
          }
        },
        responses: { 201: { description: 'Dependency created' }, 400: { description: 'Validation error' } }
      }
    },
    '/issues/{id}/dependencies/{depId}': {
      delete: {
        summary: 'Delete defect dependency',
        tags: ['Defect Dependencies'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'integer' } },
          { in: 'path', name: 'depId', required: true, schema: { type: 'integer' } }
        ],
        responses: { 200: { description: 'Dependency deleted' } }
      }
    },
    '/issues/{id}/dependency-graph': {
      get: {
        summary: 'Get visual defect dependency topology graph',
        tags: ['Defect Dependencies'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Graph with nodes and edges' } }
      }
    },
    '/ai/patterns': {
      get: {
        summary: 'AI Defect Pattern Detection',
        tags: ['AI Intelligence'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Recurring defect patterns by component and trigger' } }
      }
    },
    '/ai/regression-risk/{issueId}': {
      get: {
        summary: 'Evaluate component regression risk',
        tags: ['AI Intelligence'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'issueId', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Regression risk assessment with recommended checks' } }
      }
    },
    '/ai/semantic-search': {
      post: {
        summary: 'Semantic search across defect database',
        tags: ['AI Intelligence'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', example: 'login token expiration loop' },
                  limit: { type: 'integer', default: 20 }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Ranked defects with semantic similarity scores' } }
      }
    },
    '/analytics/trend-explanation': {
      get: {
        summary: 'Grounded natural language defect trend explanation',
        tags: ['Analytics & Telemetry'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Trend summary comparing 14-day rolling windows' } }
      }
    },
    '/analytics/early-warning': {
      get: {
        summary: 'Critical defect surge early warning alert',
        tags: ['Analytics & Telemetry'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Spike detection and recommendations' } }
      }
    },
    '/analytics/insight-of-the-day': {
      get: {
        summary: 'Grounded quality insight of the day',
        tags: ['Analytics & Telemetry'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Statistically sound daily quality metric' } }
      }
    },
    '/analytics/defect-clusters': {
      get: {
        summary: 'Defect cluster and issue map hierarchy',
        tags: ['Analytics & Telemetry'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Category -> Component -> Topic defect clusters' } }
      }
    },
    '/analytics/sprint-health/{sprintId}': {
      get: {
        summary: 'Sprint quality health score and velocity',
        tags: ['Analytics & Telemetry'],
        security: [{ BearerAuth: [] }],
        parameters: [{ in: 'path', name: 'sprintId', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Sprint health assessment 0-100' } }
      }
    }
  }
};

router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

module.exports = {
  router,
  swaggerDocument
};
