import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditService, AuditEventDTO } from '../../data-access/api/audit.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-audit-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Audit‑Events</h1>
      </div>

      <div class="card">
        <div class="filters">
          <select [(ngModel)]="filterEntityType" (change)="loadPage()">
            <option value="">-- Alle Entitäten --</option>
            @for (type of entityTypes(); track type) {
              <option [value]="type">{{ type }}</option>
            }
          </select>

          <select [(ngModel)]="filterAction" (change)="loadPage()">
            <option value="">-- Alle Aktionen --</option>
            @for (a of actions(); track a) {
              <option [value]="a">{{ a }}</option>
            }
          </select>

          <input placeholder="Suche Benutzer / Korrelation" [(ngModel)]="searchTerm" (input)="onSearch()" />
          <button class="btn btn-secondary" (click)="refresh()">Aktualisieren</button>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th class="sortable" (click)="sort('timestamp')">Zeitstempel {{ getSortIcon('timestamp') }}</th>
              <th class="sortable" (click)="sort('entityType')">Typ {{ getSortIcon('entityType') }}</th>
              <th class="sortable" (click)="sort('entityId')">Entity ID {{ getSortIcon('entityId') }}</th>
              <th>Aktion</th>
              <th>Benutzer</th>
              <th>Korrelation</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (evt of eventsFiltered(); track evt.id) {
              <tr>
                <td>{{ evt.timestamp | date:'dd.MM.yyyy HH:mm' }}</td>
                <td>{{ evt.entityType }}</td>
                <td>{{ evt.entityId || '-' }}</td>
                <td>{{ evt.action }}</td>
                <td>{{ evt.actorUsername || '-' }}</td>
                <td>{{ evt.correlationId || '-' }}</td>
                <td class="col-actions">
                  <button class="btn btn-primary" (click)="openDetails(evt)">Details</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="empty">Keine Audit‑Einträge</td></tr>
            }
          </tbody>
        </table>

        <div class="pager">
          <button class="btn-secondary" (click)="prevPage()" [disabled]="pageIndex() === 0">‹</button>
          <span>Seite {{ pageIndex() + 1 }} / {{ totalPages }}</span>
          <button class="btn-secondary" (click)="nextPage()" [disabled]="pageIndex() + 1 >= totalPages">›</button>
        </div>
      </div>

      @if (showDetails) {
        <div class="modal-overlay" (click)="closeDetails()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Audit‑Details</h2>
            <pre class="json-block">Before:\n{{ selectedEvent?.beforeJson || '-' }}</pre>
            <pre class="json-block">After:\n{{ selectedEvent?.afterJson || '-' }}</pre>
            <div class="modal-actions"><button class="btn btn-secondary" (click)="closeDetails()">Schließen</button></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
    .container { padding: 1.25rem; }
    .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
    .card { background: white; border-radius:8px; padding:1rem; }
    .filters { display:flex; gap:0.5rem; align-items:center; margin-bottom:1rem; }
    .filters input, .filters select { padding:0.4rem 0.6rem; border:1px solid #E5E7EB; border-radius:6px; }
    .table { width:100%; border-collapse:collapse; }
    .table th { text-align:left; padding:0.5rem; border-bottom:1px solid #E5E7EB; }
    .table td { padding:0.5rem; border-bottom:1px solid #F3F4F6; }
    .sortable { cursor:pointer; }
    .col-actions { width:120px; text-align:right; }
    .pager { display:flex; gap:0.5rem; align-items:center; margin-top:0.75rem; }
    .modal-overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.5); z-index:1000; }
    .modal { background:white; padding:1rem; border-radius:8px; width:min(900px, 95%); max-height:90vh; overflow:auto; }
    .json-block { background:#0f1724; color:#e6edf3; padding:1rem; border-radius:6px; font-family:monospace; white-space:pre-wrap; }
  `,
  ],
})
export class AuditEventsComponent implements OnInit {
  events = signal<AuditEventDTO[]>([]);
  entityTypes = signal<string[]>([]);
  actions = signal<string[]>([]);

  pageIndex = signal(0);
  pageSize = 20;
  total = signal(0);

  filterEntityType: string | null = null;
  filterAction: string | null = null;
  searchTerm = '';

  sortField = signal<'timestamp' | 'entityType' | 'entityId'>('timestamp');
  sortDir = signal<'asc' | 'desc'>('desc');

  showDetails = false;
  selectedEvent: AuditEventDTO | null = null;

  constructor(private audit: AuditService, private toast: ToastService) {}

  ngOnInit() {
    this.loadEnums();
    this.loadPage();
  }

  loadEnums() {
    this.audit.getEntityTypes().subscribe({ next: (data) => this.entityTypes.set(data), error: () => {} });
    this.audit.getActions().subscribe({ next: (data) => this.actions.set(data), error: () => {} });
  }

  loadPage() {
    this.audit
      .getEvents({ page: this.pageIndex(), size: this.pageSize, entityType: this.filterEntityType || null, action: this.filterAction || null })
      .subscribe({
        next: (page) => {
          this.events.set(page.content || page.items || []);
          this.total.set(page.totalElements || page.total || 0);
        },
        error: () => this.toast.error('Fehler beim Laden der Audit‑Events'),
      });
  }

  refresh() {
    this.loadPage();
  }

  onSearch() {
    // client-side filter of current page
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  prevPage() {
    if (this.pageIndex() > 0) {
      this.pageIndex.set(this.pageIndex() - 1);
      this.loadPage();
    }
  }

  nextPage() {
    if (this.pageIndex() + 1 < this.totalPages) {
      this.pageIndex.set(this.pageIndex() + 1);
      this.loadPage();
    }
  }

  eventsFiltered = computed(() => {
    const term = this.searchTerm.trim().toLowerCase();
    let list = [...this.events()];
    if (term) {
      list = list.filter(e => (e.actorUsername || '').toLowerCase().includes(term) || (e.correlationId || '').toLowerCase().includes(term));
    }
    const field = this.sortField();
    const dir = this.sortDir();
    list.sort((a, b) => {
      let av: any = a[field] ?? '';
      let bv: any = b[field] ?? '';
      if (field === 'timestamp') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  });

  sort(field: 'timestamp' | 'entityType' | 'entityId') {
    if (this.sortField() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('desc');
    }
  }

  getSortIcon(field: string): string {
    return this.sortField() !== field ? '' : this.sortDir() === 'asc' ? '↑' : '↓';
  }

  openDetails(evt: AuditEventDTO) {
    this.selectedEvent = evt;
    this.showDetails = true;
  }

  closeDetails() {
    this.showDetails = false;
    this.selectedEvent = null;
  }
}
