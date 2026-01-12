import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface GenerationPrompt {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
    }

    this.client = new OpenAI({ apiKey });
    this.model = this.configService.get<string>('openai.model') || 'gpt-4-turbo-preview';
    this.maxTokens = this.configService.get<number>('openai.maxTokens') || 4000;
  }

  async generateStructuredData(prompt: GenerationPrompt): Promise<any> {
    try {
      this.logger.debug(`Generating data with model: ${this.model}`);

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: prompt.systemPrompt },
          { role: 'user', content: prompt.userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: prompt.temperature ?? 0.7,
        max_tokens: this.maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new BadRequestException('No content in OpenAI response');
      }

      this.logger.debug(`Generated response: ${content.substring(0, 200)}...`);

      try {
        return JSON.parse(content);
      } catch (parseError) {
        this.logger.error(`Failed to parse OpenAI response as JSON: ${content}`);
        throw new BadRequestException('Invalid JSON response from OpenAI');
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`OpenAI API error: ${error.message}`);

      if (error.status === 429) {
        throw new BadRequestException('OpenAI rate limit exceeded. Please try again later.');
      }

      if (error.status === 401) {
        throw new BadRequestException('Invalid OpenAI API key');
      }

      throw new BadRequestException(`Failed to generate data: ${error.message}`);
    }
  }

  async generateText(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.7,
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: this.maxTokens,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      this.logger.error(`OpenAI API error: ${error.message}`);
      throw new BadRequestException(`Failed to generate text: ${error.message}`);
    }
  }

  async generateEmailThread(
    context: {
      accountName: string;
      contactName: string;
      contactTitle: string;
      opportunityStage: string;
      industry: string;
    },
    emailCount = 3,
  ): Promise<{ subject: string; body: string; direction: 'inbound' | 'outbound' }[]> {
    const systemPrompt = `You are generating realistic sales email threads for demo purposes.
Generate professional B2B sales emails that feel authentic.
All data must be fictional - do not use real company names or personal information.`;

    const userPrompt = `Generate a ${emailCount}-email thread between a sales rep and ${context.contactName} (${context.contactTitle}) at ${context.accountName} (${context.industry} industry).

The opportunity is currently in the "${context.opportunityStage}" stage.

For each email, provide:
- subject: Email subject line
- body: Full email body text
- direction: "inbound" (from customer) or "outbound" (from sales rep)

Start with an outbound email. Make the conversation realistic and relevant to the sales stage.

Return as JSON: { "emails": [...] }`;

    const result = await this.generateStructuredData({
      systemPrompt,
      userPrompt,
      temperature: 0.8,
    });

    return result.emails || [];
  }

  async generateCallTranscript(
    context: {
      accountName: string;
      contactName: string;
      contactTitle: string;
      opportunityStage: string;
      industry: string;
      callType: string;
    },
    duration = 30,
  ): Promise<{ transcript: string; summary: string; nextSteps: string[] }> {
    const systemPrompt = `You are generating realistic sales call transcripts for demo purposes.
Create authentic-sounding dialogue between a sales rep and a prospect.
All data must be fictional - do not use real company names or personal information.`;

    const userPrompt = `Generate a ${duration}-minute ${context.callType} sales call transcript between a sales rep and ${context.contactName} (${context.contactTitle}) at ${context.accountName} (${context.industry} industry).

The opportunity is currently in the "${context.opportunityStage}" stage.

Format the transcript as a dialogue with speaker labels:
"Rep: [dialogue]"
"${context.contactName}: [dialogue]"

Also provide:
- A brief summary (2-3 sentences)
- A list of next steps discussed

Return as JSON:
{
  "transcript": "Full transcript text...",
  "summary": "Call summary...",
  "nextSteps": ["Step 1", "Step 2"]
}`;

    return this.generateStructuredData({
      systemPrompt,
      userPrompt,
      temperature: 0.8,
    });
  }
}
