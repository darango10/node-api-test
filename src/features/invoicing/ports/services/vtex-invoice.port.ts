/**
 * Port for VTEX OMS Invoice API (outbound).
 * Implemented by infrastructure adapter; consumed by ProcessOrderStatusUpdate use case.
 */

/** VTEX invoice request body (transformed from order status payload). */
export interface VtexInvoiceRequestBody {
  type: string;
  issuanceDate: string;
  invoiceNumber: string;
  invoiceValue: number;
  items: Array<{
    id: string;
    price: number;
    quantity: number;
    description: string;
  }>;
}

/** Result of submitting an invoice to VTEX. */
export interface VtexInvoiceResult {
  success: boolean;
  statusCode?: number;
  error?: string;
}

export interface VtexInvoicePort {
  /**
   * Submit an invoice to the VTEX OMS for the given order.
   * @param orderId - Order identifier (used in VTEX URL path).
   * @param body - Transformed invoice payload (type, issuanceDate, invoiceNumber, invoiceValue, items).
   * @returns Result with success flag and optional status code or error.
   */
  submitInvoice(orderId: string, body: VtexInvoiceRequestBody): Promise<VtexInvoiceResult>;
}
