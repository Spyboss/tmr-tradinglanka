import { Request, Response, NextFunction } from 'express';
import { logUserActivity } from '../controllers/userActivity.controller.js';
import { ActivityType } from '../models/UserActivity.js';

// Define the extended Request type with user property
interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

/**
 * Middleware to automatically log user activities based on route patterns
 */
export const activityLogger = (req: AuthRequest, res: Response, next: NextFunction): void => {
  // Only log for authenticated users
  if (!req.user?.id) {
    next();
    return;
  }

  // Store original res.json to intercept successful responses
  const originalJson = res.json;
  
  res.json = function(body: any) {
    // Only log on successful responses (2xx status codes)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Determine activity type and description based on route and method
      const activityInfo = getActivityInfo(req);
      
      if (activityInfo) {
        // Log activity asynchronously (don't wait for it)
        logUserActivity(
          req.user!.id,
          activityInfo.type,
          activityInfo.description,
          activityInfo.metadata,
          req
        ).catch(error => {
          console.error('Failed to log user activity:', error);
        });
      }
    }
    
    // Call original json method
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Determine activity type and description based on request
 */
function getActivityInfo(req: AuthRequest): {
  type: ActivityType;
  description: string;
  metadata?: any;
} | null {
  const { method, path, body } = req;
  const pathSegments = path.split('/').filter(Boolean);

  // Auth routes
  if (pathSegments[1] === 'auth') {
    switch (pathSegments[2]) {
      case 'login':
        if (method === 'POST') {
          return {
            type: ActivityType.LOGIN,
            description: 'User logged in'
          };
        }
        break;
      case 'logout':
        if (method === 'POST') {
          return {
            type: ActivityType.LOGOUT,
            description: 'User logged out'
          };
        }
        break;
      case 'profile':
        if (method === 'PUT') {
          return {
            type: ActivityType.PROFILE_UPDATE,
            description: 'User updated profile information',
            metadata: {
              updatedFields: Object.keys(body || {})
            }
          };
        }
        break;
      case 'password':
        if (method === 'PUT') {
          return {
            type: ActivityType.PASSWORD_CHANGE,
            description: 'User changed password'
          };
        }
        break;
    }
  }

  // User routes
  if (pathSegments[1] === 'user') {
    switch (pathSegments[2]) {
      case 'preferences':
        if (method === 'PUT') {
          return {
            type: ActivityType.SETTINGS_UPDATE,
            description: 'User updated preferences',
            metadata: {
              updatedFields: Object.keys(body || {})
            }
          };
        }
        break;
    }
  }

  // Bill routes
  if (pathSegments[1] === 'bills') {
    const billId = pathSegments[2];
    
    switch (method) {
      case 'POST':
        if (!billId) {
          return {
            type: ActivityType.BILL_CREATE,
            description: 'Created new bill',
            metadata: {
              resourceType: 'bill'
            }
          };
        }
        break;
      case 'PUT':
        if (billId) {
          return {
            type: ActivityType.BILL_UPDATE,
            description: `Updated bill ${billId}`,
            metadata: {
              resourceId: billId,
              resourceType: 'bill'
            }
          };
        }
        break;
      case 'DELETE':
        if (billId) {
          return {
            type: ActivityType.BILL_DELETE,
            description: `Deleted bill ${billId}`,
            metadata: {
              resourceId: billId,
              resourceType: 'bill'
            }
          };
        }
        break;
    }
  }

  // Quotation routes
  if (pathSegments[1] === 'quotations') {
    const quotationId = pathSegments[2];
    
    switch (method) {
      case 'POST':
        if (!quotationId) {
          return {
            type: ActivityType.QUOTATION_CREATE,
            description: 'Created new quotation',
            metadata: {
              resourceType: 'quotation'
            }
          };
        }
        break;
      case 'PUT':
        if (quotationId) {
          return {
            type: ActivityType.QUOTATION_UPDATE,
            description: `Updated quotation ${quotationId}`,
            metadata: {
              resourceId: quotationId,
              resourceType: 'quotation'
            }
          };
        }
        break;
      case 'DELETE':
        if (quotationId) {
          return {
            type: ActivityType.QUOTATION_DELETE,
            description: `Deleted quotation ${quotationId}`,
            metadata: {
              resourceId: quotationId,
              resourceType: 'quotation'
            }
          };
        }
        break;
    }
  }

  // Inventory routes
  if (pathSegments[1] === 'inventory') {
    const inventoryId = pathSegments[2];
    
    switch (method) {
      case 'POST':
        if (!inventoryId) {
          return {
            type: ActivityType.INVENTORY_CREATE,
            description: 'Added new inventory item',
            metadata: {
              resourceType: 'inventory'
            }
          };
        }
        break;
      case 'PUT':
        if (inventoryId) {
          return {
            type: ActivityType.INVENTORY_UPDATE,
            description: `Updated inventory item ${inventoryId}`,
            metadata: {
              resourceId: inventoryId,
              resourceType: 'inventory'
            }
          };
        }
        break;
      case 'DELETE':
        if (inventoryId) {
          return {
            type: ActivityType.INVENTORY_DELETE,
            description: `Deleted inventory item ${inventoryId}`,
            metadata: {
              resourceId: inventoryId,
              resourceType: 'inventory',
              reason: (body && typeof body === 'object' ? (body as any).reason : undefined) ?? (req.headers['x-delete-reason'] as string | undefined)
            }
          };
        }
        break;
    }
  }

  return null;
}
