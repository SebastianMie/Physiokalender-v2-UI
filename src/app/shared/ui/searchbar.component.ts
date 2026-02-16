import { Component, EventEmitter, Input, Output, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-searchbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="searchbar-container">
      <input
        type="text"
        class="searchbar-input"
        [placeholder]="placeholder"
        [(ngModel)]="searchTerm"
        (input)="onInput()"
        (keydown)="onKeydown($event)"
        autocomplete="off"
      />
      <div class="searchbar-dropdown" *ngIf="dropdownOpen && (results?.length || (searchTerm && searchTerm.length >= 3))" role="listbox">
        <ng-container *ngIf="results?.length; else noResults">
          <div
            class="searchbar-result"
            *ngFor="let result of results; let i = index"
            (click)="selectResult(result)"
            (mouseenter)="setHighlighted(i)"
            (mouseleave)="clearHighlight()"
            [class.highlighted]="i === highlightedIndex"
            role="option"
            [attr.aria-selected]="i === highlightedIndex"
          >
            <div class="result-main">
              <ng-container *ngIf="result.type === 'patient'">👤 {{ result.name }}</ng-container>
              <ng-container *ngIf="result.type === 'appointment'">{{ result.patientName || result.appointment?.patientName }}</ng-container>
            </div>
            <div class="result-meta">
              <ng-container *ngIf="result.type === 'patient'">
                <span *ngIf="result.patient?.telefon">{{ result.patient.telefon }}</span>
              </ng-container>
              <ng-container *ngIf="result.type === 'appointment'">{{ formatAppointmentDate(result) }}</ng-container>
            </div>
          </div>
        </ng-container>
        <ng-template #noResults>
          <div class="searchbar-result no-results">Keine Treffer</div>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .searchbar-container {
      display: flex;
      align-items: center;
      position: relative;
      width: 100%;
      max-width: none; /* allow parent to control width */
      min-width: 260px;
      margin-left: 0;
    }
    .searchbar-input {
      flex: 1;
      padding: 0.4rem 0.75rem;
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      font-size: 0.95rem;
      min-width: 0;
    }

    .searchbar-dropdown {
      position: absolute;
      top: 110%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      box-shadow: 0 6px 20px rgba(2,6,23,0.08);
      z-index: 100;
      max-height: 420px; /* larger max-height so scrollbar appears for many results */
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #CBD5E1 transparent;
      -webkit-overflow-scrolling: touch;
    }
    .searchbar-dropdown::-webkit-scrollbar { width: 8px; }
    .searchbar-dropdown::-webkit-scrollbar-track { background: transparent; }
    .searchbar-dropdown::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 9999px; }
    .searchbar-result {
      padding: 0.25rem 0.75rem;
      cursor: pointer;
      font-size: 0.9rem;
      border-bottom: 1px solid #F3F4F6;
      transition: background 0.12s;
      min-height: 32px; /* slim rows */
      display: flex;
      align-items: center;
      justify-content: space-between; /* main left, meta right */
      gap: 0.5rem;
    }
    .searchbar-result:last-child {
      border-bottom: none;
    }
    .searchbar-result:hover, .searchbar-result.highlighted {
      background: #E6F2FF;
    }
    .searchbar-result.no-results {
      color: #6B7280;
      font-style: italic;
      cursor: default;
    }
    .result-main { font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result-meta { font-size: 0.8rem; color: #6B7280; margin-left: 0.75rem; flex-shrink: 0; }

    /* ensure keyboard focus visibility but without blue outline */
    .searchbar-input:focus { outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.08); }

  `]
})
export class SearchbarComponent {
  private hostEl = inject(ElementRef);

  @Input() placeholder = 'Termine suchen...';
  @Input() results: any[] = [];
  @Output() search = new EventEmitter<string>();
  @Output() enter = new EventEmitter<string>();
  @Output() select = new EventEmitter<any>();

  searchTerm = '';
  highlightedIndex = -1;
  dropdownOpen = false;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as Node;
    if (!this.hostEl.nativeElement.contains(target)) {
      // click outside -> close dropdown (keep input text)
      this.dropdownOpen = false;
      this.highlightedIndex = -1;
    }
  }

  onInput() {
    // clear highlight when user types and open dropdown
    this.highlightedIndex = -1;
    this.dropdownOpen = true;
    this.search.emit(this.searchTerm);
  }

  onKeydown(event: KeyboardEvent) {
    if (!this.results || this.results.length === 0) return;
    const key = event.key;
    if (key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.results.length - 1);
      this.scrollToHighlighted();
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
      this.scrollToHighlighted();
    } else if (key === 'Enter') {
      if (this.highlightedIndex >= 0 && this.highlightedIndex < this.results.length) {
        event.preventDefault();
        this.selectResult(this.results[this.highlightedIndex]);
      } else {
        this.onEnter();
      }
    } else if (key === 'Escape') {
      this.highlightedIndex = -1;
      this.dropdownOpen = false;
    }
  }

  onEnter() {
    // emit a dedicated enter event so the consumer can run an immediate search
    this.enter.emit(this.searchTerm);
    this.dropdownOpen = true;
  }

  setHighlighted(index: number) {
    this.highlightedIndex = index;
  }

  clearHighlight() {
    this.highlightedIndex = -1;
  }

  private scrollToHighlighted() {
    setTimeout(() => {
      const dropdown = document.querySelector('.searchbar-dropdown');
      if (!dropdown) return;
      const items = dropdown.querySelectorAll('.searchbar-result');
      const el = items[this.highlightedIndex] as HTMLElement | undefined;
      if (el) el.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  formatAppointmentDate(result: any): string {
    const appt = result.appointment || result;
    const dateRaw = (appt.date || result.date || '').split('T')[0];
    let timeRaw = appt.startTime || '';

    // extract HH:mm
    if (timeRaw.includes('T')) {
      timeRaw = timeRaw.split('T')[1].substring(0,5);
    } else if (timeRaw.length >= 5) {
      timeRaw = timeRaw.substring(0,5);
    }

    if (dateRaw) {
      const parts = dateRaw.split('-');
      if (parts.length === 3) {
        const formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
        return timeRaw ? `${formattedDate} ${timeRaw}` : formattedDate;
      }
    }

    // fallback: try parsing a full ISO timestamp
    try {
      const d = new Date(appt.startTime || appt.date || '');
      return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  selectResult(result: any) {
    this.select.emit(result);
    this.highlightedIndex = -1;
    this.dropdownOpen = false;
  }
}
