import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Therapist, TherapistService } from '../../data-access/api/therapist.service';
import { ToastService } from '../../core/services/toast.service';

type SortField = 'fullName' | 'email' | 'telefon' | 'isActive';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-therapist-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Therapeuten-Verwaltung</h1>
        <button class="btn btn-primary" (click)="openCreateModal()">+ Neuer Therapeut</button>
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
              <th class="sortable" (click)="sort('isActive')">Status {{ getSortIcon('isActive') }}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (therapist of filteredTherapists(); track therapist.id) {
              <tr class="row-clickable" (click)="goToDetail(therapist)">
                <td class="name-cell">{{ therapist.fullName || therapist.firstName + ' ' + therapist.lastName }}</td>
                <td>{{ therapist.email || '-' }}</td>
                <td>{{ therapist.telefon || '-' }}</td>
                <td><span [class]="therapist.isActive ? 'badge badge-success' : 'badge badge-inactive'">{{ therapist.isActive ? 'Aktiv' : 'Inaktiv' }}</span></td>
                <td class="col-actions" (click)="$event.stopPropagation()">
                  <button class="btn-icon-trash" title="Löschen" (click)="confirmDelete(therapist)">🗑️</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">Keine Therapeuten gefunden</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (showModal) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>{{ editingId ? 'Therapeut bearbeiten' : 'Neuer Therapeut' }}</h2>
            <form (ngSubmit)="saveTherapist()">
              <div class="form-row">
                <div class="form-group"><label>Vorname *</label><input type="text" [(ngModel)]="formData.firstName" name="firstName" required /></div>
                <div class="form-group"><label>Nachname *</label><input type="text" [(ngModel)]="formData.lastName" name="lastName" required /></div>
              </div>
              <div class="form-group"><label>E-Mail</label><input type="email" [(ngModel)]="formData.email" name="email" /></div>
              <div class="form-group"><label>Telefon</label><input type="tel" [(ngModel)]="formData.telefon" name="telefon" /></div>
              <div class="form-group checkbox-group"><label><input type="checkbox" [(ngModel)]="formData.isActive" name="isActive" /> Aktiv</label></div>
              @if (!editingId) {
                <hr class="divider" /><p class="section-label">Benutzerkonto (optional)</p>
                <div class="form-row">
                  <div class="form-group"><label>Benutzername</label><input type="text" [(ngModel)]="formData.userName" name="userName" /></div>
                  <div class="form-group"><label>Passwort</label><input type="password" [(ngModel)]="formData.password" name="password" /></div>
                </div>
              }
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeModal()">Abbrechen</button>
                <button type="submit" class="btn btn-primary">Speichern</button>
              </div>
            </form>
          </div>
        </div>
      }

      @if (showDeleteModal) {
        <div class="modal-overlay" (click)="showDeleteModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Therapeut löschen?</h2>
            <p>Möchten Sie "{{ therapistToDelete?.fullName || therapistToDelete?.firstName + ' ' + therapistToDelete?.lastName }}" wirklich löschen?</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showDeleteModal = false">Abbrechen</button>
              <button class="btn-danger" (click)="deleteTherapist()">Löschen</button>
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
    .badge-success { background: #D1FAE5; color: #065F46; }
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
    .modal-sm { max-width: 400px; }
    .modal h2 { margin: 0 0 1.5rem 0; color: #1F2937; font-size: 1.25rem; }
    .modal p { color: #6B7280; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input[type="text"], .form-group input[type="email"], .form-group input[type="tel"], .form-group input[type="password"] { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .checkbox-group label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .checkbox-group input[type="checkbox"] { width: 1rem; height: 1rem; }
    .divider { border: none; border-top: 1px solid #E5E7EB; margin: 1rem 0; }
    .section-label { font-size: 0.875rem; color: #6B7280; margin-bottom: 0.75rem; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
  `]
})
export class TherapistListComponent implements OnInit {
  therapists = signal<Therapist[]>([]);
  searchTerm = signal('');
  sortField = signal<SortField>('fullName');
  sortDirection = signal<SortDirection>('asc');
  showModal = false;
  showDeleteModal = false;
  editingId: number | null = null;
  therapistToDelete: Therapist | null = null;
  formData = { firstName: '', lastName: '', email: '', telefon: '', isActive: true, userName: '', password: '' };

  filteredTherapists = computed(() => {
    let result = [...this.therapists()];
    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      result = result.filter(t => (t.fullName?.toLowerCase().includes(term)) || (t.firstName?.toLowerCase().includes(term)) || (t.lastName?.toLowerCase().includes(term)) || (t.email?.toLowerCase().includes(term)) || (t.telefon?.toLowerCase().includes(term)));
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

  constructor(private therapistService: TherapistService, private toast: ToastService, private router: Router) {}
  ngOnInit() { this.loadTherapists(); }
  loadTherapists() { this.therapistService.getAll().subscribe({ next: (data) => this.therapists.set(data), error: () => this.toast.error('Fehler beim Laden') }); }
  onSearch(event: Event) { this.searchTerm.set((event.target as HTMLInputElement).value); }
  sort(field: SortField) { if (this.sortField() === field) { this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc'); } else { this.sortField.set(field); this.sortDirection.set('asc'); } }
  getSortIcon(field: SortField): string { return this.sortField() !== field ? '' : this.sortDirection() === 'asc' ? '↑' : '↓'; }
  goToDetail(t: Therapist) { this.router.navigate(['/dashboard/therapists', t.id]); }
  openCreateModal() { this.editingId = null; this.formData = { firstName: '', lastName: '', email: '', telefon: '', isActive: true, userName: '', password: '' }; this.showModal = true; }
  editTherapist(t: Therapist) { this.editingId = t.id; this.formData = { firstName: t.firstName || '', lastName: t.lastName || '', email: t.email || '', telefon: t.telefon || '', isActive: t.isActive ?? true, userName: '', password: '' }; this.showModal = true; }
  confirmDelete(t: Therapist) { this.therapistToDelete = t; this.showDeleteModal = true; }
  closeModal() { this.showModal = false; this.editingId = null; }
  saveTherapist() {
    const p: any = { firstName: this.formData.firstName, lastName: this.formData.lastName, email: this.formData.email || null, telefon: this.formData.telefon || null, isActive: this.formData.isActive };
    if (!this.editingId && this.formData.userName) { p.userName = this.formData.userName; p.password = this.formData.password; }
    const obs = this.editingId ? this.therapistService.update(this.editingId, p) : this.therapistService.create(p);
    obs.subscribe({ next: () => { this.toast.success(this.editingId ? 'Aktualisiert' : 'Erstellt'); this.loadTherapists(); this.closeModal(); }, error: () => this.toast.error('Fehler') });
  }
  deleteTherapist() { if (this.therapistToDelete) { this.therapistService.delete(this.therapistToDelete.id).subscribe({ next: () => { this.toast.success('Gelöscht'); this.loadTherapists(); this.showDeleteModal = false; this.therapistToDelete = null; }, error: () => this.toast.error('Fehler') }); } }
}
