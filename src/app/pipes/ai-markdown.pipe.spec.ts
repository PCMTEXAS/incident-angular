import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { AiMarkdownPipe } from './ai-markdown.pipe';

describe('AiMarkdownPipe', () => {
  let pipe: AiMarkdownPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = new AiMarkdownPipe(TestBed.inject(DomSanitizer));
  });

  it('should return an empty string for an empty input', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('should return an empty string for null input', () => {
    expect(pipe.transform(null as any)).toBe('');
  });

  it('should return an empty string for undefined input', () => {
    expect(pipe.transform(undefined as any)).toBe('');
  });

  it('should convert ## headings to <h2>', () => {
    const result = pipe.transform('## Section Title');
    expect(result).toContain('<h2>Section Title</h2>');
  });

  it('should convert ### headings to <h3>', () => {
    const result = pipe.transform('### Sub-section');
    expect(result).toContain('<h3>Sub-section</h3>');
  });

  it('should convert **text** to <strong>', () => {
    const result = pipe.transform('This is **bold** text.');
    expect(result).toContain('<strong>bold</strong>');
  });

  it('should convert - list items to <li> inside <ul>', () => {
    const result = pipe.transform('- first\n- second');
    expect(result).toContain('<li>first</li>');
    expect(result).toContain('<li>second</li>');
    expect(result).toContain('<ul>');
  });

  it('should HTML-escape < and > to prevent XSS via raw tags', () => {
    const result = pipe.transform('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
  });

  it('should HTML-escape ampersands', () => {
    const result = pipe.transform('Tom & Jerry');
    expect(result).toContain('&amp;');
  });

  it('should wrap plain text in <p> tags', () => {
    const result = pipe.transform('Hello world');
    expect(result).toContain('<p>');
  });

  it('should handle multiple paragraphs separated by double newlines', () => {
    const result = pipe.transform('Para one.\n\nPara two.');
    expect(result).toContain('</p><p>');
  });
});
