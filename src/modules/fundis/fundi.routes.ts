/**
 * Fundi Routes - API endpoints for fundi operations
 * Note: These are helper functions for client-side integration
 * Actual API calls are made directly to Supabase via the service layer
 */

import { FundiRegistrationData, FundiRegistrationResponse } from "./fundi.model";
import { saveFundiRegistration, uploadFundiFile } from "./fundi.service";

export type FundiRouteHandler = {
  submitRegistration: (
    userId: string,
    data: Partial<FundiRegistrationData>
  ) => Promise<FundiRegistrationResponse>;
};

/**
 * Create route handlers for fundi operations
 * All operations check user authentication and ownership
 */
export const createFundiRoutes = (): FundiRouteHandler => {
  return {
    submitRegistration: async (userId: string, data: Partial<FundiRegistrationData>) => {
      try {
        // Verify user is authenticated and matches the submission
        if (!userId) {
          return {
            success: false,
            message: "User authentication required",
          };
        }

        if (data.userId && data.userId !== userId) {
          return {
            success: false,
            message: "Unauthorized: Cannot submit registration for another user",
          };
        }

        // Save to database and return response
        return await saveFundiRegistration(userId, data);
      } catch (err) {
        console.error("submitRegistration route error:", err);
        return {
          success: false,
          message: `Submission failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
      }
    },
  };
};

// Export handler instance
export const fundiRoutes = createFundiRoutes();
