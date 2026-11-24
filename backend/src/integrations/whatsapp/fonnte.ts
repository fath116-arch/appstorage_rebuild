/**
 * Fonnte WhatsApp Gateway Provider Implementation
 * FieldOps IT Inventory
 */

import { WhatsAppProvider, SendResult } from './provider';

export type WaGatewayProviderType = 'fonnte' | 'wablas' | 'webhook';

export class FonnteProvider implements WhatsAppProvider {
  private apiUrl: string;
  private apiToken: string;
  private providerType: WaGatewayProviderType;

  constructor(apiUrl?: string, apiToken?: string, providerType: WaGatewayProviderType = 'fonnte') {
    this.apiUrl = apiUrl || process.env.WHATSAPP_API_URL || 'https://api.fonnte.com/send';
    this.apiToken = apiToken || process.env.WHATSAPP_API_TOKEN || '';
    this.providerType = providerType;
  }

  async sendMessage(to: string, text: string): Promise<SendResult> {
    if (!this.apiToken && this.providerType !== 'webhook') {
      return {
        success: false,
        details: `Simulasi pengiriman backend (${this.providerType}: Token API belum dikonfigurasi di env/database).`
      };
    }

    if (!this.apiUrl) {
      return {
        success: false,
        details: `URL endpoint gateway (${this.providerType}) belum diisi.`
      };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (this.apiToken) {
        headers['Authorization'] = this.apiToken;
      }

      const payload =
        this.providerType === 'wablas'
          ? { phone: to, message: text }
          : this.providerType === 'webhook'
            ? { to, target: to, message: text, source: 'fieldops-it' }
            : { target: to, message: text };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await response.text();
      return {
        success: response.ok,
        details: `${this.providerType.toUpperCase()} Response (${response.status}): ${data}`
      };
    } catch (err: any) {
      return {
        success: false,
        details: `HTTP Connection Error ke ${this.providerType.toUpperCase()} API: ${err.message || String(err)}`
      };
    }
  }
}
