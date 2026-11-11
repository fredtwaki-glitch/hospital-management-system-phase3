import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AnthropicClientService, AnthropicTool } from '../ai/anthropic-client.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import { LabOrdersService } from '../lab-orders/lab-orders.service';
import { LabOrder } from '../lab-orders/lab-order.entity';
import { PatientInsuranceCover } from '../insurance-covers/patient-insurance-cover.entity';
import { OrgProfileService } from '../org-profile/org-profile.service';
import { PayersService } from '../payers/payers.service';

const ESCALATE_TOOL: AnthropicTool = {
  name: 'escalate_to_staff',
  description:
    'Call this instead of answering directly whenever the question is clinical (diagnosis, treatment, medication advice), sounds urgent/emergency in nature, involves a complaint, or asks for something you cannot verify from the information you have. Do not attempt to answer these yourself.',
  input_schema: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Brief reason this needs a human' },
    },
    required: ['reason'],
  },
};

export interface AiTurnResult {
  replyText: string | null;
  needsHuman: boolean;
  escalationReason?: string;
}

@Injectable()
export class AiResponderService {
  constructor(
    private anthropic: AnthropicClientService,
    private orgProfileService: OrgProfileService,
    private payersService: PayersService,
    private appointmentsService: AppointmentsService,
    private prescriptionsService: PrescriptionsService,
    private labOrdersService: LabOrdersService,
  ) {}

  /**
   * PUBLIC persona: no patient data access whatsoever, grounded only in
   * OrgProfile + the active Payer registry. Deliberately the most
   * restricted of the three - this endpoint has no authentication in
   * front of it at all.
   */
  async respondToPublicInquiry(tenantDataSource: DataSource, messageHistory: { role: 'user' | 'assistant'; content: string }[]): Promise<AiTurnResult> {
    const profile = await this.orgProfileService.get(tenantDataSource);
    const orgContext = this.orgProfileService.toPromptContext(profile);
    const payers = await this.payersService.findAll(tenantDataSource, true);
    const payerContext = payers.length
      ? `Accepted insurance payers: ${payers.map((p) => p.name).join(', ')}`
      : 'No insurance payers are currently configured as accepted - if asked about a specific insurer, say you cannot confirm and suggest contacting the front desk directly.';

    const system = `You are a public-facing front-desk assistant for a healthcare provider. You answer general questions from members of the public - opening hours, location, accepted insurance, general "do you offer X service" questions.

Ground every factual claim ONLY in the information below. Never invent hours, prices, insurance acceptance, or medical information.

--- Organization Information ---
${orgContext}
${payerContext}
--- End Organization Information ---

You do not have access to any patient records, appointments, or clinical information, and must never claim otherwise. If asked anything clinical, urgent, or complaint-related, or anything not covered by the information above, use the escalate_to_staff tool rather than guessing.`;

    const response = await this.anthropic.send({
      system,
      messages: messageHistory.map((m) => ({ role: m.role, content: m.content })),
      tools: [ESCALATE_TOOL],
    });

    return this.interpretResponse(response);
  }

  /**
   * PATIENT persona: scoped tool access to exactly one patient's own
   * records. The patientId is fixed by the caller (from the verified
   * portal session), never taken from the model's tool input, so the
   * model cannot be prompted into fetching another patient's data.
   */
  async respondToPatientMessage(
    tenantDataSource: DataSource,
    patientId: string,
    messageHistory: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<AiTurnResult> {
    const tools: AnthropicTool[] = [
      ESCALATE_TOOL,
      {
        name: 'get_my_appointments',
        description: "Look up the current patient's own appointments.",
        input_schema: { type: 'object', properties: {} },
      },
      {
        name: 'get_my_prescriptions',
        description: "Look up the current patient's own prescriptions.",
        input_schema: { type: 'object', properties: {} },
      },
      {
        name: 'get_my_lab_orders',
        description: "Look up the current patient's own lab orders/results.",
        input_schema: { type: 'object', properties: {} },
      },
      {
        name: 'get_my_insurance_covers',
        description: "Look up the current patient's own insurance covers on file (payer name, category, member number, priority, status).",
        input_schema: { type: 'object', properties: {} },
      },
    ];

    const system = `You are a patient portal assistant for a healthcare provider, talking directly with an authenticated patient about their own records.

You may look up the patient's own appointments, prescriptions, lab orders, and insurance covers using the tools provided - never claim to have information you have not fetched with a tool.

You must NOT: give medical advice, interpret lab results or explain what a diagnosis means, suggest medication changes, quote specific invoice/billing amounts (direct them to billing/front desk for exact figures), or discuss anything clinical beyond reading back factual record data (e.g. "your appointment is scheduled for X", "your prescription for Y is active", "you have an active SHA cover on file"). For anything clinical in nature, anything about a specific bill/charge, or anything that sounds urgent, use escalate_to_staff instead of answering.`;

    let messages: any[] = messageHistory.map((m) => ({ role: m.role, content: m.content }));
    let response = await this.anthropic.send({ system, messages, tools });

    // Simple single round-trip tool loop: execute any tool calls, feed
    // results back, get a final answer. Sufficient for read-only
    // lookups; a multi-step agent loop isn't needed for this use case.
    if (response.toolUseBlocks.length > 0 && !response.toolUseBlocks.some((t) => t.name === 'escalate_to_staff')) {
      const toolResults = await Promise.all(
        response.toolUseBlocks.map(async (block) => ({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(await this.executePatientTool(tenantDataSource, patientId, block.name)),
        })),
      );

      messages = [
        ...messages,
        { role: 'assistant', content: response.raw.content },
        { role: 'user', content: toolResults },
      ];

      response = await this.anthropic.send({ system, messages, tools });
    }

    return this.interpretResponse(response);
  }

  /**
   * SUPPLIER persona: never talks to anyone directly. It only ever
   * drafts a message for staff to review - triggered by an
   * inventory.low_stock event, not by inbound contact. There is no
   * escalate tool here because everything it produces already requires
   * human approval before anything is sent.
   */
  async draftSupplierMessage(params: {
    supplierName: string;
    items: { name: string; sku: string; quantityOnHand: number; reorderThreshold: number }[];
  }): Promise<string> {
    const system = `You draft short, professional restock request emails from a healthcare provider to a pharmaceutical supplier. Be concise and factual. List the items and quantities needed based on what's provided. Do not invent prices, delivery dates, or contract terms - leave placeholders like [QUANTITY TO ORDER] and [REQUESTED DELIVERY DATE] for staff to fill in. This draft will be reviewed and edited by staff before sending, so favor clarity over polish.`;

    const itemLines = params.items
      .map((i) => `- ${i.name} (SKU ${i.sku}): ${i.quantityOnHand} on hand, reorder threshold ${i.reorderThreshold}`)
      .join('\n');

    const response = await this.anthropic.send({
      system,
      messages: [
        {
          role: 'user',
          content: `Draft a restock request to supplier "${params.supplierName}" for the following low-stock items:\n${itemLines}`,
        },
      ],
    });

    return response.textBlocks.join('\n\n') || '(AI draft unavailable - please write manually)';
  }

  private async executePatientTool(tenantDataSource: DataSource, patientId: string, toolName: string): Promise<unknown> {
    switch (toolName) {
      case 'get_my_appointments':
        return this.appointmentsService.findAll(tenantDataSource, { patientId });
      case 'get_my_prescriptions':
        return this.prescriptionsService.findByPatient(tenantDataSource, patientId);
      case 'get_my_lab_orders':
        // Uses the repository directly (bypasses the staff-only
        // controller/RBAC layer, which is appropriate here - the
        // restriction being enforced is "only this patient's own data",
        // not "no non-clinical roles", and that's enforced by always
        // passing the session's own patientId above, never a
        // model-supplied one).
        return tenantDataSource.getRepository(LabOrder).find({
          where: { patientId },
          order: { createdAt: 'DESC' },
        });
      case 'get_my_insurance_covers':
        return tenantDataSource.getRepository(PatientInsuranceCover).find({
          where: { patientId },
          order: { priority: 'ASC' },
        });
      default:
        return { error: `Unknown tool ${toolName}` };
    }
  }

  private interpretResponse(response: Awaited<ReturnType<AnthropicClientService['send']>>): AiTurnResult {
    const escalation = response.toolUseBlocks.find((t) => t.name === 'escalate_to_staff');
    if (escalation) {
      return {
        replyText: response.textBlocks.join('\n\n') || null,
        needsHuman: true,
        escalationReason: (escalation.input as any)?.reason,
      };
    }
    return { replyText: response.textBlocks.join('\n\n'), needsHuman: false };
  }
}
