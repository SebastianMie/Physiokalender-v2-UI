import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';

export interface PrintableAppointment {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  patientName: string;
  therapistName: string;
  status: string;
}

/**
 * PrintService generates PDFs for patient appointment overviews.
 * Based on the old Printer class, adapted for Angular.
 */
@Injectable({
  providedIn: 'root'
})
export class PrintService {
  private readonly MAX_APPOINTMENTS_PER_PAGE = 12;

  /**
   * Print selected appointments for a patient.
   * Generates a PDF with appointment cards on the left and right side.
   */
  printAppointments(patientName: string, appointments: PrintableAppointment[]): void {
    if (appointments.length === 0) {
      console.warn('No appointments to print');
      return;
    }

    // Sort appointments by date and time
    const sortedAppointments = [...appointments].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    // Split into pages
    const pages: string[] = [];
    let currentPage = '';

    sortedAppointments.forEach((apt, index) => {
      if (index > 0 && index % this.MAX_APPOINTMENTS_PER_PAGE === 0) {
        pages.push(currentPage);
        currentPage = '';
      }

      const dateFormatted = this.formatDateReadable(apt.date);
      const weekday = this.getWeekday(apt.date);
      currentPage += `${weekday}${dateFormatted} um ${this.formatTime(apt.startTime)}\n`;
    });

    if (currentPage) {
      pages.push(currentPage);
    }

    this.generatePDF(patientName, pages);
  }

  private generatePDF(patientName: string, pdfContents: string[]): void {
    const doc = new jsPDF({ orientation: 'landscape' });

    pdfContents.forEach((pdfContent, i) => {
      const textOptions: { align: 'center' } = { align: 'center' };

      doc.setFontSize(16);
      doc.setDrawColor('#2a2f79');

      // Left outline box
      doc.line(5, 5, 143, 5);
      doc.line(5, 205, 5, 5);
      doc.line(143, 5, 143, 205);
      doc.line(5, 205, 143, 205);

      // Right outline box
      doc.line(153, 5, 291, 5);
      doc.line(153, 205, 153, 5);
      doc.line(291, 5, 291, 205);
      doc.line(153, 205, 291, 205);

      // Header for appointments
      const nextAppointment = 'IHRE NÄCHSTEN BEHANDLUNGSTERMINE';
      doc.setTextColor('#2a2f79');
      doc.text(nextAppointment, 74, 20, textOptions);
      doc.text(nextAppointment, 222, 20, textOptions);

      // Praxis information
      doc.setFontSize(12);
      const praxisHeader = 'Praxis Meyer\nAm Hans-Teich 16\n51674 Wiehl\nTelefon: 02262/797919';
      doc.text(praxisHeader, 74, 40, textOptions);
      doc.text(praxisHeader, 222, 40, textOptions);

      // Name of patient
      doc.setFontSize(14);
      doc.setTextColor('#000000');
      doc.text(`Name: ${patientName}`, 74, 75, textOptions);
      doc.text(`Name: ${patientName}`, 222, 75, textOptions);

      // Appointments
      doc.setTextColor('#000000');
      doc.text(pdfContent, 74, 85, textOptions);
      doc.text(pdfContent, 222, 85, textOptions);

      // Page number
      doc.setFontSize(10);
      doc.setTextColor('#000000');
      doc.text(`Seite ${i + 1} von ${pdfContents.length}`, 74, 160, textOptions);
      doc.text(`Seite ${i + 1} von ${pdfContents.length}`, 222, 160, textOptions);

      // Legal disclaimer
      const disclaimer = 'Bitte beachten Sie:\nFür unsere Patienten bemühen wir uns stets unsere Terminorganisation so effizient wie möglich zu gestalten. Eine Absage sollte daher nur in dringenden Fällen, spätestens jedoch 24 Stunden vor der Behandlung, erfolgen. Nicht rechtzeitig abgesagte Termine müssen wir Ihnen leider privat in Rechnung stellen.';
      doc.setTextColor('#2a2f79');
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(disclaimer, 120), 74, 175, textOptions);
      doc.text(doc.splitTextToSize(disclaimer, 120), 222, 175, textOptions);

      if (i < pdfContents.length - 1) {
        doc.addPage();
      }
    });

    doc.autoPrint();
    doc.output('dataurlnewwindow');
  }

  private formatDateReadable(dateStr: string): string {
    const date = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return date;
  }

  private getWeekday(dateStr: string): string {
    const date = new Date(dateStr.includes('T') ? dateStr.split('T')[0] : dateStr);
    const weekdays = ['Sonntag, ', 'Montag, ', 'Dienstag, ', 'Mittwoch, ', 'Donnerstag, ', 'Freitag, ', 'Samstag, '];
    return weekdays[date.getDay()] || '';
  }

  private formatTime(timeStr: string): string {
    if (!timeStr) return '';
    if (timeStr.includes('T')) return timeStr.split('T')[1].substring(0, 5);
    return timeStr.substring(0, 5);
  }
}
