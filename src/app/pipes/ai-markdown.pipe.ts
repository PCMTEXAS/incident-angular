import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({ name: 'aiMarkdown', standalone: true })
export class AiMarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Converts a limited subset of Markdown to HTML.
   *
   * SECURITY: The input is first HTML-entity-escaped so that any embedded
   * script tags, event handlers, or other malicious markup are neutralised
   * before the Markdown-to-HTML conversion runs. The result is then passed
   * through Angular's built-in DomSanitizer (SecurityContext.HTML) rather
   * than bypassSecurityTrustHtml, providing defence-in-depth.
   */
  transform(value: string): string {
    if (!value) return '';

    // 1. Escape raw HTML entities to prevent XSS injection
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // 2. Convert safe Markdown constructs to HTML
    let html = escaped
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = `<p>${html}</p>`
      .replace(/<p><\/p>/g, '')
      .replace(/<p>(<h[23]>)/g, '$1')
      .replace(/(<\/h[23]>)<\/p>/g, '$1');

    // Use Angular's built-in sanitizer instead of bypassSecurityTrustHtml.
    // This strips dangerous elements/attributes while preserving safe
    // formatting tags (h2, h3, strong, ul, li, br, p).
    return this.sanitizer.sanitize(SecurityContext.HTML, html) || '';
  }
}
