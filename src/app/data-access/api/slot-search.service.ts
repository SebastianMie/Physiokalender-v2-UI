import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Time of day filter for slot search.
 */
export type DayPart = 'MORNING' | 'LATE_MORNING' | 'AFTERNOON' | 'EVENING';

/**
 * Request for slot search.
 */
export interface SlotSearchRequest {
  rangeFrom: string;        // ISO date: "2024-01-15"
  rangeTo: string;          // ISO date: "2024-01-30"
  durationMinutes: number;  // Appointment duration in minutes
  therapistId?: number;     // null = any therapist
  dayParts?: DayPart[];     // null/empty = any time
  excludePatientId?: number;
}



/**
 * Single available slot.
 */
export interface SlotDTO {
  therapistId: number;
  therapistName: string;
  date: string;             // ISO date: "2024-01-15"
  startTime: string;        // "09:00:00" or "09:00"
  endTime: string;          // "09:30:00" or "09:30"
  dayPart: DayPart;
}

/**
 * Group of slots for a specific day.
 */
export interface SlotGroupDTO {
  date: string;             // ISO date
  slots: SlotDTO[];
}

/**
 * Response containing available slots.
 */
export interface SlotSearchResponse {
  slotsByDay: SlotGroupDTO[];
  totalSlotsFound: number;
}

/**
 * Service for finding available appointment slots.
 * Communicates with the backend SlotController.
 */
@Injectable({
  providedIn: 'root',
})
export class SlotSearchService {
  private http = inject(HttpClient);
  private readonly apiUrl = '/api/slots';

  /**
   * Search for available appointment slots.
   *
   * @param request Search criteria
   * @returns Observable with available slots grouped by day
   */
  searchSlots(request: SlotSearchRequest): Observable<SlotSearchResponse> {
    return this.http.post<SlotSearchResponse>(`${this.apiUrl}/search`, request);
  }


  /**
   * Helper: Convert DayPart to German label.
   */
  static getDayPartLabel(dayPart: DayPart): string {
    switch (dayPart) {
      case 'MORNING': return 'Morgens (7:00-12:00 Uhr)';
      case 'LATE_MORNING': return 'Vormittags (12:00-15:00 Uhr)';
      case 'AFTERNOON': return 'Nachmittags (15:00-18:00 Uhr)';
      case 'EVENING': return 'Abends (18:00-20:00 Uhr)';
      default: return dayPart;
    }
  }

  /**
   * Helper: Get short label for DayPart.
   */
  static getDayPartShortLabel(dayPart: DayPart): string {
    switch (dayPart) {
      case 'MORNING': return 'Morgens';
      case 'LATE_MORNING': return 'Vormittags';
      case 'AFTERNOON': return 'Nachmittags';
      case 'EVENING': return 'Abends';
      default: return dayPart;
    }
  }
}
