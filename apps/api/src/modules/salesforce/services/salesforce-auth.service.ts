import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Environment, EnvironmentStatus } from '../../environments/entities/environment.entity';
import { SalesforceCredential } from '../../environments/entities/salesforce-credential.entity';
import { EncryptionService } from './encryption.service';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  instance_url: string;
  id: string;
  token_type: string;
  issued_at: string;
  signature: string;
}

interface UserInfoResponse {
  user_id: string;
  organization_id: string;
  email: string;
  username: string;
}

@Injectable()
export class SalesforceAuthService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private encryptionService: EncryptionService,
    @InjectRepository(Environment)
    private environmentsRepository: Repository<Environment>,
    @InjectRepository(SalesforceCredential)
    private credentialsRepository: Repository<SalesforceCredential>,
  ) {}

  getAuthorizationUrl(environmentId: string, isSandbox = false): string {
    const clientId = this.configService.get<string>('salesforce.clientId');
    const callbackUrl = this.configService.get<string>('salesforce.callbackUrl');
    const baseUrl = this.getLoginUrl(isSandbox);

    const state = Buffer.from(JSON.stringify({ environmentId, isSandbox })).toString('base64');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId!,
      redirect_uri: callbackUrl!,
      scope: 'api refresh_token',
      state,
    });

    return `${baseUrl}/services/oauth2/authorize?${params.toString()}`;
  }

  async handleCallback(environmentId: string, code: string, isSandbox = false): Promise<void> {
    const baseUrl = this.getLoginUrl(isSandbox);

    // Exchange code for tokens
    const tokenResponse = await this.exchangeCodeForTokens(code, baseUrl);

    // Get user info
    const userInfo = await this.getUserInfo(tokenResponse.access_token, tokenResponse.instance_url);

    // Encrypt tokens
    const accessTokenEncrypted = this.encryptionService.encrypt(tokenResponse.access_token);
    const refreshTokenEncrypted = this.encryptionService.encrypt(tokenResponse.refresh_token);

    // Token expires in 2 hours by default
    const tokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    // Save or update credential
    let credential = await this.credentialsRepository.findOne({
      where: { environmentId },
    });

    if (credential) {
      credential.accessTokenEncrypted = accessTokenEncrypted;
      credential.refreshTokenEncrypted = refreshTokenEncrypted;
      credential.tokenExpiresAt = tokenExpiresAt;
      credential.connectedUserEmail = userInfo.email;
      credential.connectedUserId = userInfo.user_id;
    } else {
      credential = this.credentialsRepository.create({
        environmentId,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        connectedUserEmail: userInfo.email,
        connectedUserId: userInfo.user_id,
      });
    }

    await this.credentialsRepository.save(credential);

    // Update environment
    await this.environmentsRepository.update(environmentId, {
      salesforceInstanceUrl: tokenResponse.instance_url,
      salesforceOrgId: userInfo.organization_id,
      status: EnvironmentStatus.CONNECTED,
      isSandbox,
      lastSyncedAt: new Date(),
    });
  }

  async refreshAccessToken(environmentId: string): Promise<string> {
    const credential = await this.credentialsRepository.findOne({
      where: { environmentId },
      relations: ['environment'],
    });

    if (!credential) {
      throw new BadRequestException('No Salesforce credential found');
    }

    const refreshToken = this.encryptionService.decrypt(credential.refreshTokenEncrypted);
    const baseUrl = this.getLoginUrl(credential.environment.isSandbox);

    const clientId = this.configService.get<string>('salesforce.clientId');
    const clientSecret = this.configService.get<string>('salesforce.clientSecret');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          `${baseUrl}/services/oauth2/token`,
          params.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      const accessTokenEncrypted = this.encryptionService.encrypt(response.data.access_token);
      const tokenExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      await this.credentialsRepository.update(credential.id, {
        accessTokenEncrypted,
        tokenExpiresAt,
      });

      return response.data.access_token;
    } catch (error: any) {
      await this.environmentsRepository.update(environmentId, {
        status: EnvironmentStatus.ERROR,
      });
      throw new BadRequestException('Failed to refresh Salesforce token');
    }
  }

  async getAccessToken(environmentId: string): Promise<string> {
    const credential = await this.credentialsRepository.findOne({
      where: { environmentId },
      relations: ['environment'],
    });

    if (!credential) {
      throw new BadRequestException('Salesforce not connected');
    }

    // Check if token is expired or about to expire (5 minutes buffer)
    const now = new Date();
    const expiresAt = credential.tokenExpiresAt;
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt && expiresAt.getTime() - now.getTime() < bufferTime) {
      return this.refreshAccessToken(environmentId);
    }

    return this.encryptionService.decrypt(credential.accessTokenEncrypted);
  }

  async getInstanceUrl(environmentId: string): Promise<string> {
    const environment = await this.environmentsRepository.findOne({
      where: { id: environmentId },
    });

    if (!environment || !environment.salesforceInstanceUrl) {
      throw new BadRequestException('Salesforce not connected');
    }

    return environment.salesforceInstanceUrl;
  }

  async verifyConnection(environmentId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken(environmentId);
      const instanceUrl = await this.getInstanceUrl(environmentId);

      const response = await firstValueFrom(
        this.httpService.get(`${instanceUrl}/services/data/v59.0/`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      return response.status === 200;
    } catch {
      return false;
    }
  }

  private async exchangeCodeForTokens(code: string, baseUrl: string): Promise<TokenResponse> {
    const clientId = this.configService.get<string>('salesforce.clientId');
    const clientSecret = this.configService.get<string>('salesforce.clientSecret');
    const callbackUrl = this.configService.get<string>('salesforce.callbackUrl');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: callbackUrl!,
      code,
    });

    try {
      const response = await firstValueFrom(
        this.httpService.post<TokenResponse>(
          `${baseUrl}/services/oauth2/token`,
          params.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      throw new BadRequestException(
        error.response?.data?.error_description || 'Failed to exchange authorization code',
      );
    }
  }

  private async getUserInfo(accessToken: string, instanceUrl: string): Promise<UserInfoResponse> {
    const response = await firstValueFrom(
      this.httpService.get<UserInfoResponse>(
        `${instanceUrl}/services/oauth2/userinfo`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      ),
    );

    return response.data;
  }

  private getLoginUrl(isSandbox: boolean): string {
    const defaultUrl = this.configService.get<string>('salesforce.loginUrl')!;
    if (isSandbox) {
      return defaultUrl.replace('login.salesforce.com', 'test.salesforce.com');
    }
    return defaultUrl;
  }
}
