import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Conversation, ConversationChannel, ConversationStatus, Message, MessageSenderType } from './conversation.entity';

@Injectable()
export class ConversationsService {
  async createConversation(
    tenantDataSource: DataSource,
    data: Partial<Conversation>,
  ): Promise<Conversation> {
    const repo = tenantDataSource.getRepository(Conversation);
    return repo.save(repo.create(data));
  }

  async appendMessage(tenantDataSource: DataSource, data: Partial<Message>): Promise<Message> {
    const repo = tenantDataSource.getRepository(Message);
    return repo.save(repo.create(data));
  }

  async setStatus(tenantDataSource: DataSource, conversationId: string, status: ConversationStatus): Promise<void> {
    await tenantDataSource.getRepository(Conversation).update({ id: conversationId }, { status });
  }

  async getHistory(tenantDataSource: DataSource, conversationId: string): Promise<Message[]> {
    return tenantDataSource.getRepository(Message).find({ where: { conversationId }, order: { createdAt: 'ASC' } });
  }

  async listByChannel(
    tenantDataSource: DataSource,
    channel: ConversationChannel,
    status?: ConversationStatus,
  ): Promise<Conversation[]> {
    return tenantDataSource.getRepository(Conversation).find({
      where: { channel, ...(status ? { status } : {}) },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(tenantDataSource: DataSource, id: string): Promise<Conversation | null> {
    return tenantDataSource.getRepository(Conversation).findOne({ where: { id } });
  }
}
