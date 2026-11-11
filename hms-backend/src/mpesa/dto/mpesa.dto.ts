import { IsString, Matches } from 'class-validator';

export class InitiateStkPushDto {
  // Kenyan MSISDN format Safaricom expects: 2547XXXXXXXX or 2541XXXXXXXX
  @IsString()
  @Matches(/^254(7|1)\d{8}$/, { message: 'phoneNumber must be in format 2547XXXXXXXX' })
  phoneNumber: string;
}

export class LinkTransactionToInvoiceDto {
  @IsString()
  invoiceId: string;
}
