import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures we have a valid session before making API calls.
 * Returns the current session if valid, attempts refresh if expired,
 * or returns null if no session exists.
 */
export async function ensureValidSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.warn('Error getting session:', error.message);
      return null;
    }
    
    if (!session) {
      return null;
    }
    
    // Check if token is about to expire (within 60 seconds)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;
      
      if (timeUntilExpiry < 60) {
        // Token is about to expire, try to refresh
        console.log('Session expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.warn('Failed to refresh session:', refreshError.message);
          // If refresh fails with invalid token, sign out
          if (refreshError.message.includes('Invalid Refresh Token') || 
              refreshError.message.includes('Refresh Token Not Found')) {
            console.warn('Refresh token invalid, user needs to re-login');
            return null;
          }
        }
        
        return refreshData?.session ?? session;
      }
    }
    
    return session;
  } catch (err) {
    console.error('Unexpected error in ensureValidSession:', err);
    return null;
  }
}

/**
 * Wrapper for Supabase queries with automatic retry and session validation.
 * Handles network errors, CORS issues, and session expiration gracefully.
 * 
 * IMPORTANT: The operation function must return a Promise that resolves to { data, error }
 */
export async function withRetry<T>(
  operation: () => Promise<{ data: T | null; error: any | null }>,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    onSessionExpired?: () => void;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  const { maxRetries = 3, retryDelayMs = 1000, onSessionExpired } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ensure valid session before each attempt
      const session = await ensureValidSession();
      
      // If session check fails on first attempt and we need auth, bail early
      if (!session && attempt === 1) {
        // Check if this is a public operation or requires auth
        // For now, we proceed anyway as some operations may be public
      }
      
      const result = await operation();
      
      // Check for auth-related errors
      if (result.error) {
        const errorMessage = result.error.message?.toLowerCase() || '';
        
        // Handle session/auth errors
        if (errorMessage.includes('jwt') || 
            errorMessage.includes('token') || 
            errorMessage.includes('unauthorized') ||
            errorMessage.includes('auth')) {
          console.warn(`Auth error on attempt ${attempt}:`, result.error.message);
          
          if (attempt === maxRetries) {
            onSessionExpired?.();
            return { data: null, error: new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่') };
          }
          
          // Try to refresh session before retry
          await supabase.auth.refreshSession();
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
        
        // Handle network/CORS errors
        if (errorMessage.includes('fetch') || 
            errorMessage.includes('network') ||
            errorMessage.includes('cors')) {
          console.warn(`Network error on attempt ${attempt}:`, result.error.message);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
            continue;
          }
        }
      }
      
      return result;
      
    } catch (err: any) {
      lastError = err;
      const errorMessage = err?.message?.toLowerCase() || '';
      
      // Handle TypeError: Failed to fetch (network/CORS)
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        console.warn(`Network fetch failed on attempt ${attempt}`);
        
        if (attempt < maxRetries) {
          // Wait with exponential backoff
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
        
        return { 
          data: null, 
          error: new Error('การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่') 
        };
      }
      
      // Handle other fetch-related errors
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
          continue;
        }
      }
      
      // Unknown error, don't retry
      break;
    }
  }
  
  return { 
    data: null, 
    error: lastError ?? new Error('เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ') 
  };
}

/**
 * Wrapper for Supabase Storage operations with retry logic.
 */
export async function storageWithRetry<T>(
  operation: () => Promise<{ data: T | null; error: any | null }>,
  maxRetries = 3
): Promise<{ data: T | null; error: Error | null }> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ensure valid session before storage operations
      await ensureValidSession();
      
      const result = await operation();
      
      if (!result.error) {
        return result;
      }
      
      lastError = result.error;
      const errorMessage = result.error.message?.toLowerCase() || '';
      
      // Retry on network/auth errors
      if (errorMessage.includes('fetch') || 
          errorMessage.includes('network') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('jwt')) {
        
        if (attempt < maxRetries) {
          console.warn(`Storage operation failed on attempt ${attempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
      }
      
      // Don't retry other errors
      return result;
      
    } catch (err: any) {
      lastError = err;
      
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        if (attempt < maxRetries) {
          console.warn(`Storage fetch failed on attempt ${attempt}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        return { 
          data: null, 
          error: new Error('การเชื่อมต่อขัดข้อง กรุณาตรวจสอบอินเทอร์เน็ตและลองใหม่') 
        };
      }
      
      // Unknown error
      break;
    }
  }
  
  return { data: null, error: lastError };
}
