import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
} from '@nestjs/common';

/**
 * Global pipe that strips dangerous HTML tags from all incoming string values.
 *
 * Removes <script>, <iframe>, <object>, <embed>, <form>, <link>, <meta>,
 * <style>, <base> tags and any tag with event-handler attributes
 * (onerror, onload, onclick, etc.).
 *
 * Register globally in main.ts via app.useGlobalPipes(new SanitizePipe()).
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  /** Tags that are always stripped entirely (with content). */
  private static readonly DANGEROUS_TAGS =
    /<\s*\/?\s*(script|iframe|object|embed|form|link|meta|style|base)\b[^>]*>/gi;

  /** Tags with event-handler attributes like onerror, onload, onclick, etc. */
  private static readonly EVENT_HANDLER_ATTRS =
    /<[^>]+\s+on\w+\s*=\s*[^>]*>/gi;

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        typeof item === 'string' ? this.sanitizeString(item) : item,
      );
    }

    if (value !== null && typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>);
    }

    return value;
  }

  private sanitizeString(input: string): string {
    return input
      .replace(SanitizePipe.DANGEROUS_TAGS, '')
      .replace(SanitizePipe.EVENT_HANDLER_ATTRS, '');
  }

  private sanitizeObject(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        result[key] = this.sanitizeString(val);
      } else if (Array.isArray(val)) {
        result[key] = val.map((item) =>
          typeof item === 'string' ? this.sanitizeString(item) : item,
        );
      } else if (val !== null && typeof val === 'object') {
        result[key] = this.sanitizeObject(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }

    return result;
  }
}
