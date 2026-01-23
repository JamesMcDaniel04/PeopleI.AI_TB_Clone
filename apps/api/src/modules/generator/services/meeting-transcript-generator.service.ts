import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService, GenerationPrompt } from './openai.service';

export interface MeetingParticipant {
  name: string;
  title: string;
  company: string;
  role: 'host' | 'attendee' | 'presenter';
  speakingStyle?: string;
}

export interface MeetingConfig {
  type: 'discovery' | 'demo' | 'negotiation' | 'kickoff' | 'qbr' | 'technical' | 'executive';
  durationMinutes: number;
  participants: MeetingParticipant[];
  agenda?: string[];
  industry?: string;
  opportunityStage?: string;
  productContext?: string;
}

export interface MeetingTranscript {
  transcript: string;
  summary: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  engagementScore: number; // 0-100
  speakerStats: SpeakerStats[];
  topics: TopicMention[];
  nextSteps: string[];
  objections?: string[];
  competitorMentions?: string[];
}

export interface ActionItem {
  description: string;
  owner: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SpeakerStats {
  name: string;
  talkTimePercent: number;
  questionCount: number;
  sentimentScore: number;
}

export interface TopicMention {
  topic: string;
  frequency: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

@Injectable()
export class MeetingTranscriptGeneratorService {
  private readonly logger = new Logger(MeetingTranscriptGeneratorService.name);

  constructor(private openaiService: OpenAIService) {}

  /**
   * Generate a full meeting transcript with analysis
   */
  async generateMeetingTranscript(config: MeetingConfig): Promise<MeetingTranscript> {
    const prompt = this.buildMeetingPrompt(config);
    const schema = this.getMeetingSchema();

    const result = await this.openaiService.generateStructuredData(prompt, {
      schema,
      schemaName: 'meeting transcript schema',
      maxRetries: 2,
    });

    return this.validateAndEnhanceResult(result, config);
  }

  /**
   * Generate a discovery call transcript
   */
  async generateDiscoveryCall(
    salesRep: { name: string; title: string },
    prospect: { name: string; title: string; company: string },
    context: {
      industry: string;
      companySize?: string;
      painPoints?: string[];
      budget?: string;
    },
  ): Promise<MeetingTranscript> {
    const config: MeetingConfig = {
      type: 'discovery',
      durationMinutes: 30,
      participants: [
        { ...salesRep, company: 'Our Company', role: 'host' },
        { ...prospect, role: 'attendee' },
      ],
      agenda: [
        'Introduction and rapport building',
        'Understanding current situation',
        'Exploring pain points and challenges',
        'Discussing goals and timeline',
        'Next steps',
      ],
      industry: context.industry,
      opportunityStage: 'Qualification',
      productContext: context.painPoints?.join(', '),
    };

    return this.generateMeetingTranscript(config);
  }

  /**
   * Generate a product demo transcript
   */
  async generateDemoCall(
    salesTeam: Array<{ name: string; title: string }>,
    buyerTeam: Array<{ name: string; title: string; company: string }>,
    context: {
      industry: string;
      productFeatures?: string[];
      competitorContext?: string;
    },
  ): Promise<MeetingTranscript> {
    const participants: MeetingParticipant[] = [
      ...salesTeam.map((rep, i) => ({
        ...rep,
        company: 'Our Company',
        role: (i === 0 ? 'presenter' : 'attendee') as MeetingParticipant['role'],
      })),
      ...buyerTeam.map((buyer) => ({
        ...buyer,
        role: 'attendee' as MeetingParticipant['role'],
      })),
    ];

    const config: MeetingConfig = {
      type: 'demo',
      durationMinutes: 45,
      participants,
      agenda: [
        'Quick introductions',
        'Recap of requirements',
        'Product demonstration',
        'Q&A session',
        'Discussion of next steps',
      ],
      industry: context.industry,
      opportunityStage: 'Value Proposition',
      productContext: context.productFeatures?.join(', '),
    };

    return this.generateMeetingTranscript(config);
  }

  /**
   * Generate a negotiation call transcript
   */
  async generateNegotiationCall(
    salesRep: { name: string; title: string },
    decisionMakers: Array<{ name: string; title: string; company: string }>,
    context: {
      dealValue: number;
      discount?: number;
      competitorPressure?: boolean;
      timeline?: string;
    },
  ): Promise<MeetingTranscript> {
    const participants: MeetingParticipant[] = [
      { ...salesRep, company: 'Our Company', role: 'host' },
      ...decisionMakers.map((dm) => ({ ...dm, role: 'attendee' as MeetingParticipant['role'] })),
    ];

    const config: MeetingConfig = {
      type: 'negotiation',
      durationMinutes: 45,
      participants,
      agenda: [
        'Review of proposal',
        'Discussion of terms',
        'Addressing concerns',
        'Finding common ground',
        'Finalizing next steps',
      ],
      opportunityStage: 'Negotiation/Review',
      productContext: `Deal value: $${context.dealValue.toLocaleString()}`,
    };

    return this.generateMeetingTranscript(config);
  }

  /**
   * Generate an executive briefing transcript
   */
  async generateExecutiveBriefing(
    salesLeadership: Array<{ name: string; title: string }>,
    executiveBuyers: Array<{ name: string; title: string; company: string }>,
    context: {
      strategicInitiative?: string;
      businessOutcomes?: string[];
    },
  ): Promise<MeetingTranscript> {
    const participants: MeetingParticipant[] = [
      ...salesLeadership.map((rep) => ({
        ...rep,
        company: 'Our Company',
        role: 'presenter' as MeetingParticipant['role'],
        speakingStyle: 'executive',
      })),
      ...executiveBuyers.map((exec) => ({
        ...exec,
        role: 'attendee' as MeetingParticipant['role'],
        speakingStyle: 'executive',
      })),
    ];

    const config: MeetingConfig = {
      type: 'executive',
      durationMinutes: 30,
      participants,
      agenda: [
        'Strategic alignment discussion',
        'Business outcomes overview',
        'Partnership vision',
        'Executive commitment',
      ],
      opportunityStage: 'Proposal/Price Quote',
      productContext: context.strategicInitiative,
    };

    return this.generateMeetingTranscript(config);
  }

  private buildMeetingPrompt(config: MeetingConfig): GenerationPrompt {
    const participantList = config.participants
      .map((p) => `- ${p.name} (${p.title} at ${p.company}) - ${p.role}`)
      .join('\n');

    const agendaList = config.agenda ? config.agenda.map((item, i) => `${i + 1}. ${item}`).join('\n') : '';

    const meetingTypeDescriptions: Record<MeetingConfig['type'], string> = {
      discovery: 'Initial discovery call to understand prospect needs and challenges',
      demo: 'Product demonstration showcasing key features and value proposition',
      negotiation: 'Contract negotiation and terms discussion',
      kickoff: 'Project kickoff meeting to align on goals and timeline',
      qbr: 'Quarterly business review to assess progress and plan ahead',
      technical: 'Technical deep-dive with engineering/IT stakeholders',
      executive: 'Executive-level strategic discussion',
    };

    const systemPrompt = `You are generating a realistic B2B sales meeting transcript for demo purposes.

CRITICAL RULES:
1. All names, companies, and details are FICTIONAL
2. Create natural dialogue with realistic back-and-forth conversation
3. Include verbal fillers, interruptions, and natural speech patterns
4. Show genuine business value discussions
5. Include realistic questions and objections
6. Match the speaking style to each participant's role and seniority

MEETING TYPE: ${meetingTypeDescriptions[config.type]}
DURATION: ${config.durationMinutes} minutes
${config.industry ? `INDUSTRY: ${config.industry}` : ''}
${config.opportunityStage ? `SALES STAGE: ${config.opportunityStage}` : ''}

PARTICIPANTS:
${participantList}

${agendaList ? `AGENDA:\n${agendaList}` : ''}

${config.productContext ? `CONTEXT: ${config.productContext}` : ''}`;

    const userPrompt = `Generate a complete ${config.durationMinutes}-minute ${config.type} meeting transcript.

The transcript should:
1. Include all participants with natural dialogue
2. Cover all agenda items naturally
3. Include timestamps [00:00], [05:30], etc.
4. Show realistic engagement and interaction
5. Include a summary, key points, action items, and sentiment analysis

Format the transcript with speaker labels:
"[00:00] ${config.participants[0].name}: Opening remarks..."

Return as JSON with this structure:
{
  "transcript": "Full transcript with timestamps...",
  "summary": "2-3 sentence executive summary",
  "keyPoints": ["Point 1", "Point 2", ...],
  "actionItems": [{"description": "...", "owner": "Name", "priority": "high|medium|low"}],
  "sentiment": "positive|neutral|negative|mixed",
  "engagementScore": 75,
  "speakerStats": [{"name": "...", "talkTimePercent": 40, "questionCount": 5, "sentimentScore": 80}],
  "topics": [{"topic": "pricing", "frequency": 5, "sentiment": "neutral"}],
  "nextSteps": ["Step 1", "Step 2"],
  "objections": ["Any objections raised"],
  "competitorMentions": ["Any competitors mentioned"]
}`;

    return {
      systemPrompt,
      userPrompt,
      temperature: 0.8,
    };
  }

  private getMeetingSchema(): Record<string, any> {
    return {
      type: 'object',
      required: ['transcript', 'summary', 'keyPoints', 'actionItems', 'sentiment', 'engagementScore'],
      properties: {
        transcript: { type: 'string' },
        summary: { type: 'string' },
        keyPoints: {
          type: 'array',
          items: { type: 'string' },
        },
        actionItems: {
          type: 'array',
          items: {
            type: 'object',
            required: ['description', 'owner', 'priority'],
            properties: {
              description: { type: 'string' },
              owner: { type: 'string' },
              dueDate: { type: 'string' },
              priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
          },
        },
        sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] },
        engagementScore: { type: 'number', minimum: 0, maximum: 100 },
        speakerStats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              talkTimePercent: { type: 'number' },
              questionCount: { type: 'number' },
              sentimentScore: { type: 'number' },
            },
          },
        },
        topics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              frequency: { type: 'number' },
              sentiment: { type: 'string' },
            },
          },
        },
        nextSteps: {
          type: 'array',
          items: { type: 'string' },
        },
        objections: {
          type: 'array',
          items: { type: 'string' },
        },
        competitorMentions: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      additionalProperties: true,
    };
  }

  private validateAndEnhanceResult(result: any, config: MeetingConfig): MeetingTranscript {
    // Ensure all required fields have defaults
    return {
      transcript: result.transcript || '',
      summary: result.summary || 'Meeting summary not available',
      keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
      actionItems: Array.isArray(result.actionItems)
        ? result.actionItems.map((item: any) => ({
            description: item.description || '',
            owner: item.owner || 'TBD',
            dueDate: item.dueDate,
            priority: item.priority || 'medium',
          }))
        : [],
      sentiment: result.sentiment || 'neutral',
      engagementScore: typeof result.engagementScore === 'number' ? result.engagementScore : 50,
      speakerStats: Array.isArray(result.speakerStats)
        ? result.speakerStats
        : config.participants.map((p) => ({
            name: p.name,
            talkTimePercent: Math.floor(100 / config.participants.length),
            questionCount: 0,
            sentimentScore: 50,
          })),
      topics: Array.isArray(result.topics) ? result.topics : [],
      nextSteps: Array.isArray(result.nextSteps) ? result.nextSteps : [],
      objections: Array.isArray(result.objections) ? result.objections : [],
      competitorMentions: Array.isArray(result.competitorMentions) ? result.competitorMentions : [],
    };
  }

  /**
   * Convert transcript to Salesforce Event format
   */
  toSalesforceEvent(
    transcript: MeetingTranscript,
    config: MeetingConfig,
    startDateTime: Date,
    contactLocalId: string,
    opportunityLocalId?: string,
  ): Record<string, any> {
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + config.durationMinutes);

    const participantNames = config.participants.map((p) => p.name).join(', ');

    return {
      _localId: `Event_${Date.now()}`,
      Subject: `${this.getMeetingTypeLabel(config.type)} - ${config.participants.find((p) => p.role === 'attendee')?.company || 'Meeting'}`,
      Description: `${transcript.summary}\n\n**Key Points:**\n${transcript.keyPoints.map((p) => `• ${p}`).join('\n')}\n\n**Next Steps:**\n${transcript.nextSteps.map((s) => `• ${s}`).join('\n')}\n\n**Participants:** ${participantNames}\n\n**Engagement Score:** ${transcript.engagementScore}/100\n\n---\nFull transcript available in meeting notes.`,
      StartDateTime: startDateTime.toISOString(),
      EndDateTime: endDateTime.toISOString(),
      Type: 'Meeting',
      Location: 'Virtual (Zoom/Teams)',
      WhoId_localId: contactLocalId,
      WhatId_localId: opportunityLocalId,
      // Custom fields for enhanced data
      _meetingTranscript: transcript.transcript,
      _meetingSentiment: transcript.sentiment,
      _meetingEngagementScore: transcript.engagementScore,
      _meetingActionItems: transcript.actionItems,
    };
  }

  private getMeetingTypeLabel(type: MeetingConfig['type']): string {
    const labels: Record<MeetingConfig['type'], string> = {
      discovery: 'Discovery Call',
      demo: 'Product Demo',
      negotiation: 'Negotiation Meeting',
      kickoff: 'Project Kickoff',
      qbr: 'Quarterly Business Review',
      technical: 'Technical Review',
      executive: 'Executive Briefing',
    };
    return labels[type] || 'Meeting';
  }
}
