import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrgProfile } from './org-profile.entity';

@Injectable()
export class OrgProfileService {
  async get(tenantDataSource: DataSource): Promise<OrgProfile | null> {
    const repo = tenantDataSource.getRepository(OrgProfile);
    const rows = await repo.find({ take: 1 });
    return rows[0] ?? null;
  }

  async upsert(tenantDataSource: DataSource, data: Partial<OrgProfile>): Promise<OrgProfile> {
    const repo = tenantDataSource.getRepository(OrgProfile);
    const existing = await this.get(tenantDataSource);
    const merged = existing ? Object.assign(existing, data) : repo.create(data);
    return repo.save(merged);
  }

  /** Renders the profile as plain text for injection into the AI system prompt. */
  toPromptContext(profile: OrgProfile | null): string {
    if (!profile) {
      return 'No organization profile has been configured yet. Do not invent hours, contact details, or insurance information - tell the person you cannot confirm this and to contact the front desk directly.';
    }
    return [
      profile.publicPhone ? `Phone: ${profile.publicPhone}` : null,
      profile.publicEmail ? `Email: ${profile.publicEmail}` : null,
      profile.address ? `Address: ${profile.address}` : null,
      profile.openingHours ? `Opening hours: ${profile.openingHours}` : null,
      profile.acceptedInsuranceProviders?.length
        ? `Accepted insurance providers: ${profile.acceptedInsuranceProviders.join(', ')}`
        : null,
      profile.additionalPublicNotes ? `Additional notes: ${profile.additionalPublicNotes}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
