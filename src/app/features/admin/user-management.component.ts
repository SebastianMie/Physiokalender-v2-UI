import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserData, UserService, CreateUserRequest } from '../../data-access/api/user.service';
import { Therapist, TherapistService } from '../../data-access/api/therapist.service';
import { ToastService } from '../../core/services/toast.service';

type SortField = 'username' | 'role' | 'therapistName';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h1>Benutzer-Verwaltung</h1>
        <button class="btn btn-primary" (click)="openCreateModal()">+ Neuer Benutzer</button>
      </div>

      <div class="card">
        <div class="search-bar">
          <input type="text" placeholder="Suchen..." [value]="searchTerm()" (input)="onSearch($event)" class="search-input" />
        </div>
        <table class="table">
          <thead>
            <tr>
              <th class="sortable" (click)="sort('username')">Benutzername {{ getSortIcon('username') }}</th>
              <th class="sortable" (click)="sort('role')">Rolle {{ getSortIcon('role') }}</th>
              <th class="sortable" (click)="sort('therapistName')">Therapeut {{ getSortIcon('therapistName') }}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (user of filteredUsers(); track user.id) {
              <tr class="row-clickable" (click)="editUser(user)">
                <td class="name-cell">{{ user.username }}</td>
                <td>
                  <span [class]="'badge badge-' + user.role.toLowerCase()">
                    {{ getRoleLabel(user.role) }}
                  </span>
                </td>
                <td>{{ getTherapistName(user.therapistId) }}</td>
                <td class="col-actions" (click)="$event.stopPropagation()">
                  <button class="btn-icon-trash" title="Löschen" (click)="confirmDelete(user)">🗑️</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="empty">Keine Benutzer gefunden</td></tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Create/Edit Modal -->
      @if (showModal) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>{{ editingId ? 'Benutzer bearbeiten' : 'Neuer Benutzer' }}</h2>
            <form (ngSubmit)="saveUser()">
              <div class="form-group">
                <label for="username">Benutzername *</label>
                <input id="username" type="text" [(ngModel)]="formData.username" name="username" required />
              </div>
              <div class="form-group">
                <label for="password">Passwort {{ editingId ? '(leer lassen für unverändert)' : '*' }}</label>
                <input id="password" type="password" [(ngModel)]="formData.password" name="password" [required]="!editingId" />
              </div>
              <div class="form-group">
                <label for="role">Rolle *</label>
                <select id="role" [(ngModel)]="formData.role" name="role" required>
                  <option value="ADMIN">Administrator</option>
                  <option value="RECEPTION">Rezeption</option>
                  <option value="THERAPIST">Therapeut</option>
                </select>
              </div>
              @if (formData.role === 'THERAPIST') {
                <div class="form-group">
                  <label for="therapistId">Verknüpfter Therapeut</label>
                  <select id="therapistId" [(ngModel)]="formData.therapistId" name="therapistId">
                    <option [ngValue]="null">-- Kein Therapeut --</option>
                    @for (therapist of therapists(); track therapist.id) {
                      <option [ngValue]="therapist.id">{{ therapist.fullName || therapist.firstName + ' ' + therapist.lastName }}</option>
                    }
                  </select>
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

      <!-- Delete Confirmation Modal -->
      @if (showDeleteModal) {
        <div class="modal-overlay" (click)="showDeleteModal = false">
          <div class="modal modal-sm" (click)="$event.stopPropagation()">
            <h2>Benutzer löschen?</h2>
            <p>Möchten Sie den Benutzer "{{ userToDelete?.username }}" wirklich löschen?</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showDeleteModal = false">Abbrechen</button>
              <button class="btn-danger" (click)="deleteUser()">Löschen</button>
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
    .badge-admin { background: #FEE2E2; color: #991B1B; }
    .badge-reception { background: #FEF3C7; color: #92400E; }
    .badge-therapist { background: #DBEAFE; color: #1E40AF; }
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
    .form-group label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #374151; font-size: 0.875rem; }
    .form-group input, .form-group select { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #D1D5DB; border-radius: 6px; font-size: 0.875rem; box-sizing: border-box; }
    .form-group input:focus, .form-group select:focus { outline: none; border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
  `]
})
export class UserManagementComponent implements OnInit {
  users = signal<UserData[]>([]);
  therapists = signal<Therapist[]>([]);
  searchTerm = signal('');
  sortField = signal<SortField>('username');
  sortDirection = signal<SortDirection>('asc');

  showModal = false;
  showDeleteModal = false;
  editingId: number | null = null;
  userToDelete: UserData | null = null;

  formData: CreateUserRequest = {
    username: '',
    password: '',
    role: 'THERAPIST',
    therapistId: null
  };

  filteredUsers = computed(() => {
    let result = [...this.users()];
    const term = this.searchTerm().trim().toLowerCase();
    if (term) {
      result = result.filter(u =>
        u.username?.toLowerCase().includes(term) ||
        this.getRoleLabel(u.role).toLowerCase().includes(term) ||
        this.getTherapistName(u.therapistId).toLowerCase().includes(term)
      );
    }
    const field = this.sortField();
    const dir = this.sortDirection();
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      if (field === 'therapistName') {
        aVal = this.getTherapistName(a.therapistId);
        bVal = this.getTherapistName(b.therapistId);
      } else if (field === 'role') {
        aVal = this.getRoleLabel(a.role);
        bVal = this.getRoleLabel(b.role);
      } else {
        aVal = a[field];
        bVal = b[field];
      }
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

  constructor(
    private userService: UserService,
    private therapistService: TherapistService,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.loadTherapists();
  }

  loadUsers() {
    this.userService.getAll().subscribe({
      next: (data) => this.users.set(data),
      error: () => this.toast.error('Fehler beim Laden der Benutzer')
    });
  }

  loadTherapists() {
    this.therapistService.getAll().subscribe({
      next: (data) => this.therapists.set(data),
      error: () => console.error('Fehler beim Laden der Therapeuten')
    });
  }

  onSearch(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  sort(field: SortField) {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: SortField): string {
    return this.sortField() !== field ? '' : this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'ADMIN': return 'Administrator';
      case 'RECEPTION': return 'Rezeption';
      case 'THERAPIST': return 'Therapeut';
      default: return role;
    }
  }

  getTherapistName(therapistId: number | null): string {
    if (!therapistId || therapistId === 0) return '-';
    const therapist = this.therapists().find(t => t.id === therapistId);
    return therapist ? (therapist.fullName || `${therapist.firstName} ${therapist.lastName}`) : '-';
  }

  openCreateModal() {
    this.editingId = null;
    this.formData = { username: '', password: '', role: 'THERAPIST', therapistId: null };
    this.showModal = true;
  }

  editUser(user: UserData) {
    this.editingId = user.id;
    this.formData = {
      username: user.username,
      password: '',
      role: user.role,
      therapistId: user.therapistId
    };
    this.showModal = true;
  }

  confirmDelete(user: UserData) {
    this.userToDelete = user;
    this.showDeleteModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.formData = { username: '', password: '', role: 'THERAPIST', therapistId: null };
    this.editingId = null;
  }

  saveUser() {
    if (this.editingId) {
      const updateData: any = {
        username: this.formData.username,
        role: this.formData.role,
        therapistId: this.formData.role === 'THERAPIST' ? this.formData.therapistId : null
      };
      if (this.formData.password) {
        updateData.password = this.formData.password;
      }
      this.userService.update(this.editingId, updateData).subscribe({
        next: () => { this.toast.success('Benutzer aktualisiert'); this.loadUsers(); this.closeModal(); },
        error: () => this.toast.error('Fehler beim Aktualisieren')
      });
    } else {
      const createData: CreateUserRequest = {
        username: this.formData.username,
        password: this.formData.password,
        role: this.formData.role,
        therapistId: this.formData.role === 'THERAPIST' ? this.formData.therapistId : null
      };
      this.userService.create(createData).subscribe({
        next: () => { this.toast.success('Benutzer erstellt'); this.loadUsers(); this.closeModal(); },
        error: () => this.toast.error('Fehler beim Erstellen')
      });
    }
  }

  deleteUser() {
    if (this.userToDelete) {
      this.userService.delete(this.userToDelete.id).subscribe({
        next: () => { this.toast.success('Benutzer gelöscht'); this.loadUsers(); this.showDeleteModal = false; this.userToDelete = null; },
        error: () => this.toast.error('Fehler beim Löschen')
      });
    }
  }
}
