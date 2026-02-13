import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-absence-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Abwesenheiten</h1>
      <p class="placeholder">Abwesenheiten-Verwaltung wird in Phase 1 implementiert.</p>
    </div>
  `,
  styles: [`
    .container {
      padding: 1rem;
    }

    h1 {
      margin: 0 0 1rem 0;
      color: #1F2937;
      font-size: 1.875rem;
    }

    .placeholder {
      color: #9CA3AF;
      font-size: 0.875rem;
      margin: 1rem 0;
    }
  `]
})
export class AbsenceListComponent {}
