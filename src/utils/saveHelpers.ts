/**
 * Save operation utilities with automatic retry, validation, and user feedback
 */

import { toast } from "sonner";
import { logger } from "./logger";

export interface SaveResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
}

export interface SaveOptions {
  /**
   * Show toast notifications for save status
   */
  showToast?: boolean;
  /**
   * Custom success message
   */
  successMessage?: string;
  /**
   * Custom error message
   */
  errorMessage?: string;
  /**
   * Number of retry attempts on failure
   */
  retryAttempts?: number;
  /**
   * Delay between retries in ms
   */
  retryDelay?: number;
}

/**
 * Safely execute a save operation with error handling and user feedback
 */
export async function safeSave<T>(
  operation: () => Promise<T>,
  options: SaveOptions = {}
): Promise<SaveResult<T>> {
  const {
    showToast = true,
    successMessage = "Saved successfully",
    errorMessage = "Failed to save changes",
    retryAttempts = 0,
    retryDelay = 1000,
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const data = await operation();
      
      if (showToast) {
        toast.success(successMessage);
      }
      
      return { success: true, data };
    } catch (error) {
      lastError = error as Error;
      logger.error(`Save attempt ${attempt + 1} failed:`, error);
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  // All attempts failed
  if (showToast) {
    toast.error(errorMessage);
  }
  
  return { success: false, error: lastError! };
}

/**
 * Debounced save manager that ensures the last save completes
 */
export class DebouncedSaveManager {
  private timeouts = new Map<string, number>();
  private pendingSaves = new Map<string, Promise<any>>();
  
  /**
   * Schedule a debounced save operation
   * @param key - Unique key for this save operation
   * @param operation - The save function to execute
   * @param delay - Debounce delay in ms
   * @param onSaving - Optional callback when save starts
   * @param onComplete - Optional callback when save completes
   */
  async debouncedSave<T>(
    key: string,
    operation: () => Promise<T>,
    delay: number = 500,
    onSaving?: () => void,
    onComplete?: (success: boolean) => void
  ): Promise<void> {
    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout
    const timeoutId = window.setTimeout(async () => {
      if (onSaving) onSaving();
      
      try {
        const savePromise = operation();
        this.pendingSaves.set(key, savePromise);
        
        await savePromise;
        
        if (onComplete) onComplete(true);
      } catch (error) {
        logger.error(`Debounced save failed for key ${key}:`, error);
        if (onComplete) onComplete(false);
      } finally {
        this.pendingSaves.delete(key);
        this.timeouts.delete(key);
      }
    }, delay);
    
    this.timeouts.set(key, timeoutId);
  }
  
  /**
   * Wait for all pending saves to complete before cleanup
   * Call this before component unmount or navigation
   */
  async waitForPendingSaves(): Promise<void> {
    const pending = Array.from(this.pendingSaves.values());
    if (pending.length > 0) {
      await Promise.allSettled(pending);
    }
  }
  
  /**
   * Cancel all pending saves
   */
  cancelAll(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    this.pendingSaves.clear();
  }
}

/**
 * Validate required fields before save
 */
export function validateRequired(
  fields: Record<string, any>,
  fieldNames: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const [key, displayName] of Object.entries(fieldNames)) {
    const value = fields[key];
    if (value === null || value === undefined || value === '') {
      missing.push(displayName);
    }
  }
  
  if (missing.length > 0) {
    toast.error(`Please fill in required fields: ${missing.join(', ')}`);
    return { valid: false, missing };
  }
  
  return { valid: true, missing: [] };
}
