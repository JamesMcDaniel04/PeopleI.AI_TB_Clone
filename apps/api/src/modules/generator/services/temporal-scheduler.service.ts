import { Injectable } from '@nestjs/common';

export interface TemporalConfig {
  // Date range for activities
  startDate?: Date;
  endDate?: Date;
  // Business hours configuration
  businessHoursStart?: number; // 0-23
  businessHoursEnd?: number; // 0-23
  // Include weekends
  includeWeekends?: boolean;
  // Activity density pattern
  densityPattern?: 'uniform' | 'front-loaded' | 'back-loaded' | 'bell-curve';
  // Time zone offset (hours from UTC)
  timezoneOffset?: number;
}

export interface ActivitySlot {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dateTimeString: string; // ISO 8601
  dayOfWeek: number; // 0 = Sunday
  isBusinessDay: boolean;
  slotIndex: number;
}

@Injectable()
export class TemporalSchedulerService {
  private readonly DEFAULT_CONFIG: TemporalConfig = {
    businessHoursStart: 9,
    businessHoursEnd: 17,
    includeWeekends: false,
    densityPattern: 'bell-curve',
    timezoneOffset: -5, // EST
  };

  /**
   * Generate a realistic date range for a sales cycle
   * based on opportunity stage and close date
   */
  generateSalesCycleDates(
    closeDate: Date,
    stage: string,
    config?: Partial<TemporalConfig>,
  ): { startDate: Date; endDate: Date; daysInCycle: number } {
    const stageDurations: Record<string, number> = {
      Prospecting: 90,
      Qualification: 75,
      'Needs Analysis': 60,
      'Value Proposition': 45,
      'Id. Decision Makers': 40,
      'Perception Analysis': 30,
      'Proposal/Price Quote': 21,
      'Negotiation/Review': 14,
      'Closed Won': 0,
      'Closed Lost': 0,
    };

    const daysRemaining = stageDurations[stage] || 30;
    const totalCycleDays = 90; // Typical B2B sales cycle

    const endDate = new Date(closeDate);
    const startDate = new Date(closeDate);
    startDate.setDate(startDate.getDate() - totalCycleDays + daysRemaining);

    return {
      startDate,
      endDate,
      daysInCycle: totalCycleDays - daysRemaining,
    };
  }

  /**
   * Generate activity slots distributed over a date range
   */
  generateActivitySlots(
    count: number,
    config?: Partial<TemporalConfig>,
  ): ActivitySlot[] {
    const cfg = { ...this.DEFAULT_CONFIG, ...config };
    const startDate = cfg.startDate || this.getDefaultStartDate();
    const endDate = cfg.endDate || this.getDefaultEndDate();

    const slots: ActivitySlot[] = [];
    const availableDays = this.getAvailableDays(startDate, endDate, cfg);

    if (availableDays.length === 0) {
      // Fallback: use the date range anyway
      for (let i = 0; i < count; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + Math.floor((i / count) * this.daysBetween(startDate, endDate)));
        slots.push(this.createSlot(date, i, cfg));
      }
      return slots;
    }

    // Distribute activities based on density pattern
    const distribution = this.calculateDistribution(count, availableDays.length, cfg.densityPattern);

    let slotIndex = 0;
    for (let dayIndex = 0; dayIndex < availableDays.length; dayIndex++) {
      const activitiesForDay = distribution[dayIndex] || 0;
      const dayDate = availableDays[dayIndex];

      for (let i = 0; i < activitiesForDay; i++) {
        const activityDate = this.addBusinessHourTime(dayDate, i, activitiesForDay, cfg);
        slots.push(this.createSlot(activityDate, slotIndex++, cfg));
      }
    }

    return slots.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Generate meeting slots (pairs of start/end times)
   */
  generateMeetingSlots(
    count: number,
    durationMinutes: number = 30,
    config?: Partial<TemporalConfig>,
  ): { startDateTime: string; endDateTime: string; date: Date }[] {
    const slots = this.generateActivitySlots(count, config);

    return slots.map((slot) => {
      const endTime = new Date(slot.date);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);

      return {
        startDateTime: slot.date.toISOString(),
        endDateTime: endTime.toISOString(),
        date: slot.date,
      };
    });
  }

  /**
   * Generate email thread timestamps with realistic response delays
   */
  generateEmailThreadTimestamps(
    emailCount: number,
    startDate: Date,
    config?: {
      minResponseDelayHours?: number;
      maxResponseDelayHours?: number;
      businessHoursOnly?: boolean;
    },
  ): Date[] {
    const cfg = {
      minResponseDelayHours: 2,
      maxResponseDelayHours: 48,
      businessHoursOnly: true,
      ...config,
    };

    const timestamps: Date[] = [startDate];

    for (let i = 1; i < emailCount; i++) {
      const prevTime = timestamps[i - 1];
      const delayHours =
        cfg.minResponseDelayHours +
        Math.random() * (cfg.maxResponseDelayHours - cfg.minResponseDelayHours);

      const nextTime = new Date(prevTime);
      nextTime.setHours(nextTime.getHours() + Math.floor(delayHours));

      // Adjust to business hours if needed
      if (cfg.businessHoursOnly) {
        this.adjustToBusinessHours(nextTime);
      }

      timestamps.push(nextTime);
    }

    return timestamps;
  }

  /**
   * Spread activities realistically across opportunities
   * Returns a map of opportunityLocalId -> activity dates
   */
  generateOpportunityActivityTimeline(
    opportunities: Array<{
      localId: string;
      stageName: string;
      closeDate: string;
    }>,
    activitiesPerOpportunity: number,
    config?: Partial<TemporalConfig>,
  ): Map<string, ActivitySlot[]> {
    const result = new Map<string, ActivitySlot[]>();

    for (const opp of opportunities) {
      const closeDate = new Date(opp.closeDate);
      const { startDate, endDate } = this.generateSalesCycleDates(
        closeDate,
        opp.stageName,
        config,
      );

      const slots = this.generateActivitySlots(activitiesPerOpportunity, {
        ...config,
        startDate,
        endDate,
      });

      result.set(opp.localId, slots);
    }

    return result;
  }

  /**
   * Generate past activity dates (for historical data)
   */
  generatePastActivityDates(
    count: number,
    daysBack: number = 90,
    config?: Partial<TemporalConfig>,
  ): ActivitySlot[] {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    return this.generateActivitySlots(count, {
      ...config,
      startDate,
      endDate,
    });
  }

  /**
   * Generate future activity dates (for scheduled activities)
   */
  generateFutureActivityDates(
    count: number,
    daysAhead: number = 30,
    config?: Partial<TemporalConfig>,
  ): ActivitySlot[] {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    return this.generateActivitySlots(count, {
      ...config,
      startDate,
      endDate,
    });
  }

  private getDefaultStartDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() - 60); // 60 days ago
    return date;
  }

  private getDefaultEndDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 30); // 30 days from now
    return date;
  }

  private getAvailableDays(
    startDate: Date,
    endDate: Date,
    config: TemporalConfig,
  ): Date[] {
    const days: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (config.includeWeekends || !isWeekend) {
        days.push(new Date(current));
      }

      current.setDate(current.getDate() + 1);
    }

    return days;
  }

  private calculateDistribution(
    totalActivities: number,
    totalDays: number,
    pattern?: string,
  ): number[] {
    if (totalDays === 0) return [];

    const distribution: number[] = new Array(totalDays).fill(0);

    switch (pattern) {
      case 'front-loaded':
        // More activities at the beginning
        for (let i = 0; i < totalActivities; i++) {
          const dayIndex = Math.floor(Math.pow(Math.random(), 2) * totalDays);
          distribution[Math.min(dayIndex, totalDays - 1)]++;
        }
        break;

      case 'back-loaded':
        // More activities toward the end
        for (let i = 0; i < totalActivities; i++) {
          const dayIndex = Math.floor((1 - Math.pow(Math.random(), 2)) * totalDays);
          distribution[Math.min(dayIndex, totalDays - 1)]++;
        }
        break;

      case 'bell-curve':
        // Normal distribution centered in the middle
        for (let i = 0; i < totalActivities; i++) {
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          const normalized = (z + 3) / 6; // Normalize to 0-1 range
          const dayIndex = Math.floor(Math.max(0, Math.min(1, normalized)) * totalDays);
          distribution[Math.min(dayIndex, totalDays - 1)]++;
        }
        break;

      case 'uniform':
      default:
        // Even distribution
        const basePerDay = Math.floor(totalActivities / totalDays);
        const remainder = totalActivities % totalDays;

        for (let i = 0; i < totalDays; i++) {
          distribution[i] = basePerDay + (i < remainder ? 1 : 0);
        }
        break;
    }

    return distribution;
  }

  private addBusinessHourTime(
    date: Date,
    activityIndex: number,
    totalForDay: number,
    config: TemporalConfig,
  ): Date {
    const result = new Date(date);
    const businessHoursStart = config.businessHoursStart || 9;
    const businessHoursEnd = config.businessHoursEnd || 17;
    const businessHours = businessHoursEnd - businessHoursStart;

    // Distribute activities throughout business hours
    const hourOffset = (activityIndex / Math.max(totalForDay, 1)) * businessHours;
    const randomMinutes = Math.floor(Math.random() * 60);

    result.setHours(businessHoursStart + Math.floor(hourOffset), randomMinutes, 0, 0);

    return result;
  }

  private adjustToBusinessHours(date: Date): void {
    const hours = date.getHours();

    if (hours < 9) {
      date.setHours(9 + Math.floor(Math.random() * 2));
    } else if (hours >= 17) {
      // Move to next business day
      date.setDate(date.getDate() + 1);
      date.setHours(9 + Math.floor(Math.random() * 2));
    }

    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }
  }

  private createSlot(
    date: Date,
    slotIndex: number,
    config: TemporalConfig,
  ): ActivitySlot {
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      date,
      dateString: date.toISOString().split('T')[0],
      dateTimeString: date.toISOString(),
      dayOfWeek,
      isBusinessDay: !isWeekend,
      slotIndex,
    };
  }

  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((end.getTime() - start.getTime()) / msPerDay);
  }
}
