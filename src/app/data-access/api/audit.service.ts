import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditEventDTO {
  id: number;
  timestamp: string;
  actorUserId?: number | null;
  actorUsername?: string | null;
  entityType: string;
  entityId?: number | null;
  action: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  metadataJson?: string | null;
  correlationId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private apiUrl = '/api/audit';

  constructor(private http: HttpClient) {}

  getEvents(options: {
    page?: number;
    size?: number;
    entityType?: string | null;
    action?: string | null;
    actorUserId?: number | null;
    from?: string | null;
    to?: string | null;
  } = {}): Observable<any> {
    let params = new HttpParams()
      .set('page', (options.page ?? 0).toString())
      .set('size', (options.size ?? 20).toString());
    if (options.entityType) params = params.set('entityType', options.entityType);
    if (options.action) params = params.set('action', options.action);
    if (options.actorUserId != null) params = params.set('actorUserId', options.actorUserId.toString());
    if (options.from) params = params.set('from', options.from);
    if (options.to) params = params.set('to', options.to);
    return this.http.get<any>(this.apiUrl, { params });
  }

  getEntityTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/entity-types`);
  }

  getActions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/actions`);
  }

  getEntityHistory(entityType: string, entityId: number): Observable<AuditEventDTO[]> {
    return this.http.get<AuditEventDTO[]>(`${this.apiUrl}/entity/${entityType}/${entityId}`);
  }
}
