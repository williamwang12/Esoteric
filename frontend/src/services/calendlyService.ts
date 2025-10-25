interface CalendlyUser {
  uri: string;
  name: string;
  slug: string;
  email: string;
  scheduling_url: string;
  timezone: string;
}

interface CalendlyUserResponse {
  resource: CalendlyUser;
}

interface CalendlyAvailableTime {
  start_time: string;
  invitees_counter: {
    total: number;
    limit: number;
  };
}

interface CalendlyAvailableTimesResponse {
  collection: CalendlyAvailableTime[];
  pagination: {
    count: number;
    next_page?: string;
    previous_page?: string;
  };
}

interface CalendlyEventType {
  uri: string;
  name: string;
  duration: number;
  kind: string;
  scheduling_url: string;
}

interface CalendlyEventTypesResponse {
  collection: CalendlyEventType[];
  pagination: {
    count: number;
    next_page?: string;
    previous_page?: string;
  };
}

class CalendlyService {
  private readonly baseUrl = 'https://api.calendly.com';
  private readonly accessToken = process.env.REACT_APP_CALENDLY_ACCESS_TOKEN;

  private async makeRequest<T>(endpoint: string): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Calendly access token not configured');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Calendly API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getCurrentUser(): Promise<CalendlyUserResponse> {
    return this.makeRequest<CalendlyUserResponse>('/users/me');
  }

  async getEventTypes(userUri: string): Promise<CalendlyEventTypesResponse> {
    return this.makeRequest(`/event_types?user=${encodeURIComponent(userUri)}`);
  }

  async getAvailableTimes(
    eventTypeUri: string,
    startTime: string,
    endTime: string
  ): Promise<CalendlyAvailableTimesResponse> {
    const params = new URLSearchParams({
      event_type: eventTypeUri,
      start_time: startTime,
      end_time: endTime,
    });

    return this.makeRequest(`/event_type_available_times?${params.toString()}`);
  }

  async getNextAvailableSlots(days: number = 7, limit: number = 5): Promise<CalendlyAvailableTime[]> {
    try {
      // Get current user to find their event types
      const user = await this.getCurrentUser();
      
      // Get event types for the user
      const eventTypesResponse = await this.getEventTypes(user.resource.uri);
      
      // Find the 30-minute meeting event type (assuming it's the one we want)
      const targetEventType = eventTypesResponse.collection.find(
        eventType => eventType.duration === 30 || eventType.name.includes('30')
      );

      if (!targetEventType) {
        throw new Error('30-minute event type not found');
      }

      // Calculate date range
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 1); // Start from next hour
      const endTime = new Date(startTime);
      endTime.setDate(endTime.getDate() + days);

      // Get available times
      const availableTimesResponse = await this.getAvailableTimes(
        targetEventType.uri,
        startTime.toISOString(),
        endTime.toISOString()
      );

      // Return limited number of slots
      return availableTimesResponse.collection.slice(0, limit);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      return [];
    }
  }

  formatSlotTime(dateString: string): { date: string; time: string; dayOfWeek: string } {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    };

    return {
      date: date.toLocaleDateString('en-US', options),
      time: date.toLocaleTimeString('en-US', timeOptions),
      dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
    };
  }
}

export const calendlyService = new CalendlyService();
export type { CalendlyAvailableTime };