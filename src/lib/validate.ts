import { z, ZodType } from 'zod';
import { NextResponse } from 'next/server';

/**
 * Validate request body against a Zod schema.
 * Returns parsed data if valid, or a 400 NextResponse if invalid.
 */
export async function validateBody<T>(schema: ZodType<T>, body: unknown): Promise<
  { success: true; data: T } | { success: false; error: NextResponse }
> {
  try {
    const data = await schema.parseAsync(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return {
        success: false,
        error: NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: issues,
          },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      error: NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate search params against a Zod schema.
 */
export function validateSearchParams<T>(schema: ZodType<T>, params: URLSearchParams): {
  success: true; data: T;
} | {
  success: false; error: NextResponse;
} {
  const obj: Record<string, string> = {};
  params.forEach((value, key) => {
    obj[key] = value;
  });

  try {
    const data = schema.parse(obj);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return {
        success: false,
        error: NextResponse.json(
          {
            success: false,
            error: 'Invalid query parameters',
            details: issues,
          },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      error: NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      ),
    };
  }
}
