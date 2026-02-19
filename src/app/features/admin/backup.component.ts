import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../core/services/toast.service';

interface BackupFile {
  filename: string;
  size: string;
  sizeBytes: number;
  created: Date;
}

@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container">
      <h1>Datenbank Backup</h1>

      <!-- Backup Actions Section -->
      <div class="card">
        <div class="card-header">
          <h2>Backup erstellen</h2>
          <span class="subtitle">Vollständiges MySQL Datenbank Backup</span>
        </div>
        <div class="card-body">
          <div class="backup-action">
            <p class="description">
              Erstellt ein vollständiges Backup der Datenbank im Verzeichnis <code>/backups</code>.
              Das Backup beinhaltet alle Tabellen, Routinen, Trigger und Events.
            </p>
            <button
              class="btn btn-primary btn-large"
              (click)="createBackup()"
              [disabled]="isCreatingBackup()"
            >
              @if (isCreatingBackup()) {
                ⏳ Backup wird erstellt...
              } @else {
                💾 Backup jetzt erstellen
              }
            </button>
          </div>
        </div>
      </div>

      <!-- Backups List Section -->
      <div class="card">
        <div class="card-header">
          <h2>Verfügbare Backups</h2>
          <span class="subtitle">Übersicht aller erstellten Backups</span>
        </div>
        <div class="card-body">
          @if (isLoadingBackups()) {
            <div class="loading">
              <p>⏳ Laden...</p>
            </div>
          } @else if (backupFiles().length === 0) {
            <p class="empty-text">Keine Backups vorhanden</p>
          } @else {
            <table class="table">
              <thead>
                <tr>
                  <th>Dateiname</th>
                  <th>Größe</th>
                  <th>Erstellt am</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (backup of backupFiles(); track backup.filename) {
                  <tr>
                    <td>
                      <code class="filename">{{ backup.filename }}</code>
                    </td>
                    <td>{{ backup.size }}</td>
                    <td>{{ formatDate(backup.created) }}</td>
                    <td class="col-action">
                      <button
                        class="btn-delete"
                        (click)="deleteBackup(backup.filename)"
                        title="Backup löschen"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    h1 {
      font-size: 2rem;
      color: #111827;
      margin-bottom: 2rem;
      font-weight: 700;
    }

    .card {
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 0.5rem;
      margin-bottom: 2rem;
      overflow: hidden;
    }

    .card-header {
      padding: 1.5rem;
      border-bottom: 1px solid #E5E7EB;
      display: flex;
      align-items: baseline;
      justify-content: space-between;

      h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #111827;
        font-weight: 600;
      }

      .subtitle {
        font-size: 0.875rem;
        color: #6B7280;
        margin-left: 1rem;
      }
    }

    .card-body {
      padding: 2rem;
    }

    .backup-action {
      text-align: center;

      .description {
        color: #374151;
        margin-bottom: 1.5rem;
        font-size: 0.95rem;
        line-height: 1.5;

        code {
          background: #F3F4F6;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-family: 'Courier New', monospace;
          color: #DC2626;
        }
      }
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .btn-primary {
      background-color: #0066CC;
      color: white;

      &:hover:not(:disabled) {
        background-color: #0052A3;
      }
    }

    .btn-large {
      padding: 0.75rem 2rem;
      font-size: 1rem;
    }

    .table {
      width: 100%;
      border-collapse: collapse;

      thead {
        background-color: #F9FAFB;

        th {
          padding: 0.75rem;
          text-align: left;
          font-weight: 500;
          color: #374151;
          font-size: 0.875rem;
          border-bottom: 1px solid #E5E7EB;
        }
      }

      tbody {
        tr {
          border-bottom: 1px solid #E5E7EB;

          &:hover {
            background-color: #F9FAFB;
          }

          td {
            padding: 0.75rem;
            color: #374151;
            font-size: 0.875rem;
          }

          .filename {
            background: #F3F4F6;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-family: 'Courier New', monospace;
            color: #374151;
            word-break: break-all;
          }

          .col-action {
            text-align: right;
          }
        }
      }
    }

    .btn-delete {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.25rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      transition: background-color 0.15s;

      &:hover {
        background-color: #FEE2E2;
      }
    }

    .empty-text {
      color: #6B7280;
      text-align: center;
      padding: 2rem;
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: #6B7280;
    }
  `]
})
export class BackupComponent implements OnInit {
  backupFiles = signal<BackupFile[]>([]);
  isCreatingBackup = signal(false);
  isLoadingBackups = signal(false);

  constructor(
    private http: HttpClient,
    private toastService: ToastService
  ) {}

  ngOnInit() {
    this.loadBackups();
  }

  createBackup() {
    if (this.isCreatingBackup()) return;

    if (!confirm('Möchten Sie wirklich ein Backup erstellen? Dies kann einige Minuten dauern.')) {
      return;
    }

    this.isCreatingBackup.set(true);
    this.http.post<any>('/api/admin/backup/create', {}).subscribe({
      next: (response) => {
        this.isCreatingBackup.set(false);
        if (response.success) {
          this.toastService.success(response.message);
          setTimeout(() => this.loadBackups(), 1000);
        } else {
          this.toastService.error(response.message);
        }
      },
      error: (error) => {
        this.isCreatingBackup.set(false);
        this.toastService.error('Fehler beim Erstellen des Backups');
        console.error('Backup error:', error);
      }
    });
  }

  loadBackups() {
    this.isLoadingBackups.set(true);
    this.http.get<BackupFile[]>('/api/admin/backup/list').subscribe({
      next: (files) => {
        this.isLoadingBackups.set(false);
        // Convert string dates to Date objects if needed
        this.backupFiles.set(files.map(f => ({
          ...f,
          created: typeof f.created === 'string' ? new Date(f.created) : f.created
        })));
      },
      error: (error) => {
        this.isLoadingBackups.set(false);
        this.toastService.error('Fehler beim Laden der Backups');
        console.error('Load backups error:', error);
      }
    });
  }

  deleteBackup(filename: string) {
    if (!confirm(`Sollen Sie das Backup "${filename}" wirklich löschen?`)) {
      return;
    }

    this.http.delete<any>(`/api/admin/backup/delete/${filename}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('✅ ' + response.message);
          this.loadBackups();
        } else {
          this.toastService.error('❌ ' + response.message);
        }
      },
      error: (error) => {
        this.toastService.error('❌ Fehler beim Löschen des Backups');
        console.error('Delete backup error:', error);
      }
    });
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}
