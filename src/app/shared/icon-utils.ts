/**
 * Emoji Icon Utilities for standardized icons across the application
 */

/**
 * Trash/Delete Icon Emoji
 */
export const TRASH_ICON_EMOJI = '🗑️';

/**
 * Edit/Pencil Icon Emoji
 */
export const EDIT_ICON_EMOJI = '✏️';

/**
 * Calendar Icon Emoji
 */
export const CALENDAR_ICON_EMOJI = '📅';

/**
 * Generate HTML string for a delete button with emoji icon
 * @param title Tooltip title
 * @returns HTML string with delete button and emoji
 */
export function getDeleteButtonHTML(title = 'Löschen'): string {
  return `<button class="btn-icon-trash" title="${title}">${TRASH_ICON_EMOJI}</button>`;
}

/**
 * Generate HTML string for an edit button with emoji icon
 * @param title Tooltip title
 * @returns HTML string with edit button and emoji
 */
export function getEditButtonHTML(title = 'Bearbeiten'): string {
  return `<button class="btn-icon-edit" title="${title}">${EDIT_ICON_EMOJI}</button>`;
}

/**
 * Generate HTML string for a calendar button with emoji icon
 * @param title Tooltip title
 * @returns HTML string with calendar button and emoji
 */
export function getCalendarButtonHTML(title = 'Kalender'): string {
  return `<button class="btn-icon-calendar" title="${title}">${CALENDAR_ICON_EMOJI}</button>`;
}
