import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Thin wrapper around Safaricom's Daraja API. Deliberately has zero
 * knowledge of Invoice/Patient/tenants - it only knows how to talk to
 * Safaricom. All the "what does this mean for our billing" logic lives
 * in MpesaService, one layer up. This split is what makes sandbox vs.
 * production just an env var away (MPESA_ENV), not a code change.
 */
@Injectable()
export class MpesaClientService {
  private readonly logger = new Logger(MpesaClientService.name);
  private cachedToken: CachedToken | null = null;

  constructor(private config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get('MPESA_ENV') === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.token;
    }

    const consumerKey = this.config.get('MPESA_CONSUMER_KEY');
    const consumerSecret = this.config.get('MPESA_CONSUMER_SECRET');
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!response.ok) {
      this.logger.error(`Daraja OAuth failed: ${response.status}`);
      throw new InternalServerErrorException('Could not authenticate with M-Pesa');
    }

    const data = await response.json();
    // expires_in is seconds; cache with a 60s safety margin.
    this.cachedToken = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 };
    return this.cachedToken.token;
  }

  /**
   * Initiates an STK Push ("Lipa na M-Pesa Online") - sends a payment
   * prompt to the patient's phone. The result arrives later, async, via
   * the callback URL provided here (see MpesaCallbackController) - this
   * call only confirms the PROMPT was sent, not that payment succeeded.
   */
  async stkPush(params: {
    phoneNumber: string; // format 2547XXXXXXXX, no leading +
    amount: number;
    accountReference: string; // shows on the patient's phone - we use the invoice id
    transactionDesc: string;
    callbackUrl: string;
  }): Promise<{ checkoutRequestId: string; merchantRequestId: string; customerMessage: string }> {
    const token = await this.getAccessToken();
    const shortcode = this.config.get('MPESA_SHORTCODE');
    const passkey = this.config.get('MPESA_PASSKEY');
    const timestamp = this.generateTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const response = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount),
        PartyA: params.phoneNumber,
        PartyB: shortcode,
        PhoneNumber: params.phoneNumber,
        CallBackURL: params.callbackUrl,
        AccountReference: params.accountReference,
        TransactionDesc: params.transactionDesc,
      }),
    });

    const data = await response.json();
    if (!response.ok || data.ResponseCode !== '0') {
      this.logger.error(`STK push failed: ${JSON.stringify(data)}`);
      throw new InternalServerErrorException(data.errorMessage || 'Could not initiate M-Pesa payment');
    }

    return {
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
      customerMessage: data.CustomerMessage,
    };
  }

  /**
   * Registers the validation/confirmation URLs Safaricom calls for C2B
   * (Paybill) payments. Run once per shortcode, not per-payment - Daraja
   * remembers the registration. Exposed as a method so it can be called
   * from a one-off admin action rather than needing manual Daraja portal
   * config, but the portal works too if preferred.
   */
  async registerC2bUrls(validationUrl: string, confirmationUrl: string): Promise<void> {
    const token = await this.getAccessToken();
    const shortcode = this.config.get('MPESA_SHORTCODE');

    const response = await fetch(`${this.baseUrl}/mpesa/c2b/v1/registerurl`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ShortCode: shortcode,
        ResponseType: 'Completed',
        ConfirmationURL: confirmationUrl,
        ValidationURL: validationUrl,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`C2B URL registration failed: ${text}`);
      throw new InternalServerErrorException('Could not register M-Pesa C2B URLs');
    }
  }

  private generateTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
