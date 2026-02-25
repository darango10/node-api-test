/**
 * Port for retrieving VTEX API credentials (outbound).
 * Implemented by env or vault adapter; consumed by ProcessOrderStatusUpdate use case.
 */

export interface VtexCredentials {
  appKey: string;
  appToken: string;
}

export interface SecretsPort {
  /**
   * Get VTEX API credentials (App Key and App Token) from a secure store.
   * @returns Credentials for X-VTEX-API-AppKey and X-VTEX-API-AppToken headers.
   * @throws If credentials are not configured or unavailable.
   */
  getVtexCredentials(): Promise<VtexCredentials>;
}
