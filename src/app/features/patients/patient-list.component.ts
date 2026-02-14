import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Patient, PatientService } from '../../data-access/api/patient.service';
import { ToastService } from '../../core/services/toast.service';

type SortField = 'fullName' | 'email' | 'telefon' | 'city' | 'isBWO';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-patient-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Patienten-Verwaltung</h1>
        <button class="btn-primary" (click)="openCreateModal()">+ Neuer Patient</button>
      </div>

      <div class="card">
        <div class="search-bar">
          <input type="text" placeholder="Suchen..." [value]="searchTerm()" (input)="onSearch($event)" class="search-input" />
        </div>
        <table class="table">
          <thead>
            <tr>
              <th class="sortable" (click)="sort('fullName')">Name {{ getSortIcon('fullName') }}</th>
              <th class="sortable" (click)="sort('email')">E-Mail {{ getSortIcon('email') }}</th>
              <th class="sortable" (click)="sort('telefon')">Telefon {{ getSortIcon('telefon') }}</th>
              <th class="sortable" (click)="sort('city')">Ort {{ getSortIcon('city') }}</th>
              <th class="sortable" (click)="sort('isBWO')">BWO {{ getSortIcon('isBWO') }}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (patient of filteredPatients(); track patient.id) {
              <tr class="row-clickable" (click)="editPatient(patient)">
                <td class="name-cell">{{ patient.fullName || patient.firstName + ' ' + patient.lastName }}</td>
                <td>{{ patient.email || '-' }}</td>
                <td>{{ patient.telefon || '-' }}</td>
                <td>{{ patient.city || '-' }}</td>
                <td><span [class]="patient.isBWO ? 'badge badge-info' : 'badge badge-inactive'">{{ patient.isBWO ? 'Ja' : 'Nein' }}</span></td>
                <td class="col-actions" (click)="$event.stopPropagation()">
                  <button class="btn-delete" title="Löschen" (click)="confirmDelete(patient)">🗑️</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty">Keine Patienten gefunden</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (showModal) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal modal-lg" (click)="$event.stopPropagation()">
            <h2>{{ editingId ? 'Patient bearbeiten' : 'Neuer Patient' }}</h2>
            <form (ngSubmit)="savePatient()">
              <div class="form-row">
                <div class="form-group"><label>Vorname *</label><input type="text" [(ngModel)]="formData.firstName" name="firstName" required /></div>
                <div class="form-group"><label>Nachname *</label><input type="text" [(ngModel)]="formData.lastName" name="lastName" required /></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>E-Mail</label><input type="email" [(ngModel)]="formData.email" name="email" /></div>
                <div class="form-group"><label>Telefon</label><input type="tel" [(ngModel)]="formData.telefon" name="telefon" /></div>
              </div>
              <hr class="divider" /><p class="section-label">Adresse</p>
              <div class="form-row">
                <div class="form-group flex-3"><label>Straße</label><input type="text" [(ngModel)]="formData.street" name="street" /></div>
                <div class="form-group flex-1"><label>Hausnr.</label><input type="text" [(ngModel)]="formData.houseNumber" name="houseNumber" /></div>
              </div>
              <div class="form-row">
                <div class="form-group flex-1"><label>PLZ</label><input type="text" [(ngModel)]="formData.postalCode" name="postalCode" /></div>
                <div class="form-group flex-3"><label>Ort</label><input type="text" [(ngModel)]="formData.city" name="city" /></div>
              </div>
              <hr class="divider" />
              <div class="form-group checkbox-group"><label><input type="checkbox" [(ngModel)]="formData.isBWO" name="isBWO" /> BWO Patient</label></div>
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeModal()">Abbrechen</button>
                <button type="submit" class="btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (showDeleteModal) {
        <div class="modal-overlay" (click)="showDeleteModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Patient löschen?</h2>
            <p>Möchten Sie "{{ patientToDelete?.fullName || patientToDelete?.firstName + ' ' + patientToDelete?.lastName }}" wirklich löschen?</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showDeleteModal = false">Abbrechen</button>
              <button class="btn-danger" (click)="deletePatient()">Löschen</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .container { padding: 1.5rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    h1 { margin: 0; color: #1F2937; font-size: 1.5rem; }
    .card { background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .search-bar { padding: 1rem; border-bottom: 1px solid #E5E7EB; }
    .search-input { max-width: 300px; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .search-input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .table { width: 100%; border-collapse: collapse; }
    .table th { background: #F9FAFB; padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #E5E7EB; }
    .table td { padding: 0.75rem 1rem; border-bottom: 1px solid #E5E7EB; color: #1F2937; }
    .sortable { cursor: pointer; user-select: none; }
    .sortable:hover { background: #F3F4F6; }
    .row-clickable { cursor: pointer; transition: background-color 0.15s; }
    .row-clickable:hover { background: #F9FAFB; }
    .name-cell { font-weight: 500; }
    .badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
    .badge-info { background: #DBEAFE; color: #1E40AF; }
    .badge-inactive { background: #E5E7EB; color: #6B7280; }
    .col-actions { width: 50px; text-align: right; }
    .btn-delete { background: none; border: none; cursor: pointer; padding: 0.25rem 0.5rem; font-size: 0.875rem; opacity: 0.4; transition: opacity 0.2s; }
    .btn-delete:hover { opacity: 1; }
    .btn-primary { background: #2563EB; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-primary:hover { background: #1D4ED8; }
    .btn-secondary { background: #E5E7EB; color: #374151; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-secondary:hover { background: #D1D5DB; }
    .btn-danger { background: #EF4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 500; }
    .btn-danger:hover { background: #DC2626; }
    .empty { text-align: center; color: #9CA3AF; padding: 2rem; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: white; border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
    .modal-lg { max-width: 600px; }
    .modal-sm { max-width: 400px; }
    .modal h2 { margin: 0 0 1.5rem 0; color: #1F2937; font-size: 1.25rem; }
    .modal p { color: #6B7280; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-row { display: flex; gap: 1rem; }
    .form-row .form-group { flex: 1; }
    .flex-1 { flex: 1 !important; }
    .flex-3 { flex: 3 !important; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input[type="text"], .form-group input[type="email"], .form-group input[type="tel"] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .checkbox-group input[type="checkbox"] { width: 1rem; height: 1rem; }
    .divider { border: none; border-top: 1px solid #E5E7EB; margin: 1rem 0; }
    .section-label { font-size: 0.875rem; color: #6B7280; margin-bottom: 0.75rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
  `]
})
export class PatientListComponent implements OnInit {
  patients = signal<Patient[]>([]);
  searchTerm = signal('');
  sortField = signal<SortField>('fullName');
  sortDirection = signal<SortDirection>('asc');
  showModal = false;
  showDeleteModal = false;
  editingId: number | null = null;
  patientToDelete: Patient | null = null;
  formData = { firstName: '', lastName: '', email: '', telefon: '', isBWO: false, street: '', houseNumber: '', postalCode: '', city: '' };

  filteredPatients = computed(() => {
    let result = [...this.patients()];
    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      result = result.filter(p => (p.fullName?.toLowerCase().includes(term)) || (p.firstName?.toLowerCase().includes(term)) || (p.lastName?.toLowerCase().includes(term)) || (p.email?.toLowerCase().includes(term)) || (p.telefon?.toLowerCase().includes(term)) || (p.city?.toLowerCase().includes(term)) || (p.street?.toLowerCase().includes(term)));
    }
    const field = this.sortField();
    const dir = this.sortDirection();
    result.sort((a, b) => {
      let aVal: any = field === 'fullName' ? (a.fullName || `${a.firstName} ${a.lastName}`) : a[field];
      let bVal: any = field === 'fullName' ? (b.fullName || `${b.firstName} ${b.lastName}`) : b[field];
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  });

  constructor(private patientService: PatientService, private toast: ToastService) {}
  ngOnInit() { this.loadPatients(); }
  loadPatients() { this.patientService.getAll().subscribe({ next: (data) => this.patients.set(data), error: () => this.toast.error('Fehler beim Laden') }); }
  onSearch(event: Event) { this.searchTerm.set((event.target as HTMLInputElement).value); }
  sort(field: SortField) { if (this.sortField() === field) { this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc'); } else { this.sortField.set(field); this.sortDirection.set('asc'); } }
  getSortIcon(field: SortField): string { return this.sortField() !== field ? '' : this.sortDirection() === 'asc' ? '↑' : '↓'; }
  openCreateModal() { this.editingId = null; this.formData = { firstName: '', lastName: '', email: '', telefon: '', isBWO: false, street: '', houseNumber: '', postalCode: '', city: '' }; this.showModal = true; }
  editPatient(p: Patient) { this.editingId = p.id; this.formData = { firstName: p.firstName || '', lastName: p.lastName || '', email: p.email || '', telefon: p.telefon || '', isBWO: p.isBWO ?? false, street: p.street || '', houseNumber: p.houseNumber || '', postalCode: p.postalCode || '', city: p.city || '' }; this.showModal = true; }
  confirmDelete(p: Patient) { this.patientToDelete = p; this.showDeleteModal = true; }
  closeModal() { this.showModal = false; this.editingId = null; }
  savePatient() {
    const data: any = { firstName: this.formData.firstName, lastName: this.formData.lastName, email: this.formData.email || null, telefon: this.formData.telefon || null, isBWO: this.formData.isBWO, street: this.formData.street || null, houseNumber: this.formData.houseNumber || null, postalCode: this.formData.postalCode || null, city: this.formData.city || null };
    const obs = this.editingId ? this.patientService.update(this.editingId, data) : this.patientService.create(data);
    obs.subscribe({ next: () => { this.toast.success(this.editingId ? 'Aktualisiert' : 'Erstellt'); this.loadPatients(); this.closeModal(); }, error: () => this.toast.error('Fehler') });
  }
  deletePatient() { if (this.patientToDelete) { this.patientService.delete(this.patientToDelete.id).subscribe({ next: () => { this.toast.success('Gelöscht'); this.loadPatients(); this.showDeleteModal = false; this.patientToDelete = null; }, error: () => this.toast.error('Fehler') }); } }
}
