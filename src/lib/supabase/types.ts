/**
 * Supabase database types.
 *
 * This is a permissive placeholder so the app type-checks before the schema is
 * live. After applying migrations, regenerate the real, fully-typed definitions:
 *
 *   npm run db:types
 *
 * (which runs `supabase gen types typescript` against SUPABASE_DB_URL).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericRow = Record<string, Json>;

interface GenericTable {
  Row: GenericRow;
  Insert: GenericRow;
  Update: GenericRow;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: Record<string, GenericTable>;
    Views: Record<string, GenericTable>;
    Functions: Record<string, { Args: Record<string, Json>; Returns: Json }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, GenericRow>;
  };
}
