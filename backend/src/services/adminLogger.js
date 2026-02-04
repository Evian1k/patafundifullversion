import { query } from '../db.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Log an admin action to the database
 * @param {string} adminId - The admin user ID
 * @param {string} actionType - Type of action (approve, reject, suspend, etc)
 * @param {string} targetType - Type of target (fundi, job, customer, etc)
 * @param {string} targetId - ID of the target object
 * @param {object} oldValue - Previous value (optional)
 * @param {object} newValue - New value (optional)
 * @param {string} reason - Reason for action (optional)
 * @param {string} ipAddress - IP address of request (optional)
 */
export async function logAdminAction(
  adminId,
  actionType,
  targetType,
  targetId,
  oldValue = null,
  newValue = null,
  reason = null,
  ipAddress = null
) {
  try {
    await query(
      `INSERT INTO admin_action_logs (
        id, admin_id, action_type, target_type, target_id, 
        old_value, new_value, reason, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
      [
        uuidv4(),
        adminId,
        actionType,
        targetType,
        targetId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        reason,
        ipAddress
      ]
    );
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Don't throw - logging failure should not break the main operation
  }
}

/**
 * Get action logs for pagination and viewing
 */
export async function getAdminActionLogs(limit = 50, offset = 0, filters = {}) {
  try {
    let sqlQuery = 'SELECT * FROM admin_action_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.adminId) {
      sqlQuery += ` AND admin_id = $${paramIndex}`;
      params.push(filters.adminId);
      paramIndex++;
    }

    if (filters.actionType) {
      sqlQuery += ` AND action_type = $${paramIndex}`;
      params.push(filters.actionType);
      paramIndex++;
    }

    if (filters.targetType) {
      sqlQuery += ` AND target_type = $${paramIndex}`;
      params.push(filters.targetType);
      paramIndex++;
    }

    if (filters.targetId) {
      sqlQuery += ` AND target_id = $${paramIndex}`;
      params.push(filters.targetId);
      paramIndex++;
    }

    sqlQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sqlQuery, params);

    return result.rows.map(log => ({
      id: log.id,
      adminId: log.admin_id,
      actionType: log.action_type,
      targetType: log.target_type,
      targetId: log.target_id,
      oldValue: log.old_value ? JSON.parse(log.old_value) : null,
      newValue: log.new_value ? JSON.parse(log.new_value) : null,
      reason: log.reason,
      ipAddress: log.ip_address,
      createdAt: log.created_at
    }));
  } catch (error) {
    console.error('Failed to get admin action logs:', error);
    return [];
  }
}
