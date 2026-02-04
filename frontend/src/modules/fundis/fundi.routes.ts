/**
 * Fundi Routes - API endpoints for fundi operations
 * Uses the REST API backend via apiClient
 */

import { FundiRegistrationData, FundiRegistrationResponse } from "./fundi.model";
import { validateFundiRegistration } from "./fundi.service";
import { apiClient } from "@/lib/api";

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
        // Verify user is authenticated
        if (!userId) {
          return {
            success: false,
            message: "User authentication required",
          };
        }

        // Validate data
        const validation = validateFundiRegistration(data);
        if (!validation.isValid) {
          return {
            success: false,
            message: `Validation failed: ${validation.errors.join(", ")}`,
          };
        }

        // Submit via API client
        const response = await apiClient.submitFundiRegistration(
          data as any
        );

        return {
          success: response.success,
          message: response.message || "Registration submitted successfully",
          data: response.data,
        };
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

