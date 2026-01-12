import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Environment, EnvironmentStatus } from './entities/environment.entity';
import { SalesforceCredential } from './entities/salesforce-credential.entity';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';

@Injectable()
export class EnvironmentsService {
  constructor(
    @InjectRepository(Environment)
    private environmentsRepository: Repository<Environment>,
    @InjectRepository(SalesforceCredential)
    private credentialsRepository: Repository<SalesforceCredential>,
  ) {}

  async findAll(userId: string): Promise<Environment[]> {
    return this.environmentsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId: string): Promise<Environment> {
    const environment = await this.environmentsRepository.findOne({
      where: { id },
      relations: ['credential'],
    });

    if (!environment) {
      throw new NotFoundException('Environment not found');
    }

    if (environment.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return environment;
  }

  async create(userId: string, dto: CreateEnvironmentDto): Promise<Environment> {
    const environment = this.environmentsRepository.create({
      ...dto,
      userId,
      status: EnvironmentStatus.DISCONNECTED,
    });

    return this.environmentsRepository.save(environment);
  }

  async update(id: string, userId: string, dto: UpdateEnvironmentDto): Promise<Environment> {
    const environment = await this.findById(id, userId);
    Object.assign(environment, dto);
    return this.environmentsRepository.save(environment);
  }

  async delete(id: string, userId: string): Promise<void> {
    const environment = await this.findById(id, userId);
    await this.environmentsRepository.remove(environment);
  }

  async updateStatus(id: string, status: EnvironmentStatus): Promise<void> {
    await this.environmentsRepository.update(id, { status });
  }

  async saveCredential(
    environmentId: string,
    data: {
      accessTokenEncrypted: string;
      refreshTokenEncrypted: string;
      tokenExpiresAt: Date;
      connectedUserEmail: string;
      connectedUserId: string;
      instanceUrl: string;
      orgId?: string;
    },
  ): Promise<void> {
    // Check if credential already exists
    let credential = await this.credentialsRepository.findOne({
      where: { environmentId },
    });

    if (credential) {
      Object.assign(credential, {
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        tokenExpiresAt: data.tokenExpiresAt,
        connectedUserEmail: data.connectedUserEmail,
        connectedUserId: data.connectedUserId,
      });
    } else {
      credential = this.credentialsRepository.create({
        environmentId,
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        tokenExpiresAt: data.tokenExpiresAt,
        connectedUserEmail: data.connectedUserEmail,
        connectedUserId: data.connectedUserId,
      });
    }

    await this.credentialsRepository.save(credential);

    // Update environment with Salesforce info
    await this.environmentsRepository.update(environmentId, {
      salesforceInstanceUrl: data.instanceUrl,
      salesforceOrgId: data.orgId,
      status: EnvironmentStatus.CONNECTED,
      lastSyncedAt: new Date(),
    });
  }

  async getCredential(environmentId: string): Promise<SalesforceCredential | null> {
    return this.credentialsRepository.findOne({
      where: { environmentId },
    });
  }

  async updateCredentialTokens(
    environmentId: string,
    accessTokenEncrypted: string,
    tokenExpiresAt: Date,
  ): Promise<void> {
    await this.credentialsRepository.update(
      { environmentId },
      { accessTokenEncrypted, tokenExpiresAt },
    );
  }

  async disconnect(id: string, userId: string): Promise<void> {
    const environment = await this.findById(id, userId);

    // Delete credential
    await this.credentialsRepository.delete({ environmentId: id });

    // Update environment status
    await this.environmentsRepository.update(id, {
      status: EnvironmentStatus.DISCONNECTED,
      salesforceInstanceUrl: null,
      salesforceOrgId: null,
    });
  }
}
