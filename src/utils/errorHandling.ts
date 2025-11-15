/**
 * Centralized error handling utilities
 * Provides consistent error messages and logging
 */

import { toast } from 'sonner';
import { logger } from './logger';

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Safely handle Supabase errors with user-friendly messages
 */
export function handleSupabaseError(error: unknown, context: string): AppError {
  logger.error(`${context}:`, error);
  
  if (error && typeof error === 'object' && 'message' in error) {
    const errorMessage = (error as { message: string }).message;
    
    // Map common Supabase errors to user-friendly messages
    if (errorMessage.includes('violates foreign key constraint')) {
      return {
        message: 'Unable to complete operation due to related data constraints.',
        code: 'FOREIGN_KEY_VIOLATION',
        details: error,
      };
    }
    
    if (errorMessage.includes('duplicate key value')) {
      return {
        message: 'This record already exists.',
        code: 'DUPLICATE_KEY',
        details: error,
      };
    }
    
    if (errorMessage.includes('permission denied') || errorMessage.includes('RLS')) {
      return {
        message: 'You do not have permission to perform this action.',
        code: 'PERMISSION_DENIED',
        details: error,
      };
    }
    
    if (errorMessage.includes('no rows')) {
      return {
        message: 'The requested data was not found.',
        code: 'NOT_FOUND',
        details: error,
      };
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return {
        message: 'Network error. Please check your connection and try again.',
        code: 'NETWORK_ERROR',
        details: error,
      };
    }
    
    return {
      message: errorMessage,
      code: 'UNKNOWN',
      details: error,
    };
  }
  
  return {
    message: 'An unexpected error occurred. Please try again.',
    code: 'UNKNOWN',
    details: error,
  };
}

/**
 * Show error toast with consistent styling
 */
export function showErrorToast(error: AppError | string, title: string = 'Error') {
  const message = typeof error === 'string' ? error : error.message;
  
  toast.error(title, {
    description: message,
    duration: 5000,
  });
}

/**
 * Show success toast with consistent styling
 */
export function showSuccessToast(message: string, title: string = 'Success') {
  toast.success(title, {
    description: message,
    duration: 3000,
  });
}

/**
 * Safely execute an async operation with error handling
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
  options?: {
    showErrorToast?: boolean;
    onError?: (error: AppError) => void;
    defaultValue?: T;
  }
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const appError = handleSupabaseError(error, context);
    
    if (options?.showErrorToast !== false) {
      showErrorToast(appError);
    }
    
    if (options?.onError) {
      options.onError(appError);
    }
    
    return options?.defaultValue ?? null;
  }
}

/**
 * Validate required parameters and throw if missing
 */
export function requireParams<T extends Record<string, unknown>>(
  params: T,
  requiredKeys: (keyof T)[]
): void {
  const missing = requiredKeys.filter(key => !params[key]);
  
  if (missing.length > 0) {
    const error = new Error(`Missing required parameters: ${missing.join(', ')}`);
    logger.error('Parameter validation failed:', error);
    throw error;
  }
}

/**
 * Safe property access with default value
 */
export function safeGet<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K,
  defaultValue: T[K]
): T[K] {
  return obj?.[key] ?? defaultValue;
}

/**
 * Safe array access with bounds checking
 */
export function safeArrayAccess<T>(
  arr: T[] | null | undefined,
  index: number,
  defaultValue: T
): T {
  if (!arr || index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index];
}

/**
 * Check if value is null or undefined
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Ensure value is not null/undefined, throw otherwise
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message: string = 'Value is null or undefined'
): T {
  if (isNullOrUndefined(value)) {
    throw new Error(message);
  }
  return value;
}
