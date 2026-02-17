import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentFinderComponent } from './appointment-finder.component';

@Component({
  standalone: true,
  selector: 'app-appointment-finder-wizard',
  imports: [CommonModule, AppointmentFinderComponent],
  template: `
    <div class="wizard-wrapper">
      <app-appointment-finder></app-appointment-finder>
    </div>
  `,
  styles: [`.wizard-wrapper { padding: 0.5rem; }`]
})
export class AppointmentFinderWizardComponent implements OnInit {
  ngOnInit(): void {}
}
