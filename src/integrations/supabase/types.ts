export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          kind: string
          model: string | null
          ok: boolean
          provider: string | null
          summary: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          model?: string | null
          ok?: boolean
          provider?: string | null
          summary: string
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          model?: string | null
          ok?: boolean
          provider?: string | null
          summary?: string
        }
        Relationships: []
      }
      agent_memory: {
        Row: {
          content: string
          created_at: string
          id: string
          importance: number
          kind: string
          source: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          importance?: number
          kind?: string
          source?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          importance?: number
          kind?: string
          source?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      auth_members: {
        Row: {
          id: string
          label: string
          hash: string
          permissions: string[]
          created_at: number
          from_temp_id: string | null
        }
        Insert: {
          id: string
          label: string
          hash: string
          permissions?: string[]
          created_at: number
          from_temp_id?: string | null
        }
        Update: {
          id?: string
          label?: string
          hash?: string
          permissions?: string[]
          created_at?: number
          from_temp_id?: string | null
        }
        Relationships: []
      }
      auth_temp_passwords: {
        Row: {
          id: string
          label: string
          icon: string
          hash: string
          created_at: number
          expires_at: number
          uses: number
          max_uses: number | null
          permissions: string[]
        }
        Insert: {
          id: string
          label: string
          icon?: string
          hash: string
          created_at: number
          expires_at: number
          uses?: number
          max_uses?: number | null
          permissions?: string[]
        }
        Update: {
          id?: string
          label?: string
          icon?: string
          hash?: string
          created_at?: number
          expires_at?: number
          uses?: number
          max_uses?: number | null
          permissions?: string[]
        }
        Relationships: []
      }
      auth_ip_bindings: {
        Row: {
          credential_key: string
          ip: string
          updated_at: number
        }
        Insert: {
          credential_key: string
          ip: string
          updated_at: number
        }
        Update: {
          credential_key?: string
          ip?: string
          updated_at?: number
        }
        Relationships: []
      }
      auth_ip_bans: {
        Row: {
          ip: string
          count: number
          locked_until: number
          first_seen: number
          total_fails: number
          ban_until: number
          updated_at: number
        }
        Insert: {
          ip: string
          count?: number
          locked_until?: number
          first_seen: number
          total_fails?: number
          ban_until?: number
          updated_at: number
        }
        Update: {
          ip?: string
          count?: number
          locked_until?: number
          first_seen?: number
          total_fails?: number
          ban_until?: number
          updated_at?: number
        }
        Relationships: []
      }
      auth_admin_profile: {
        Row: {
          id: number
          label: string
          created_at: number
          updated_at: number
        }
        Insert: {
          id: number
          label: string
          created_at: number
          updated_at: number
        }
        Update: {
          id?: number
          label?: string
          created_at?: number
          updated_at?: number
        }
        Relationships: []
      }
      auth_revoked_tokens: {
        Row: {
          jti: string
          revoked_at: number
        }
        Insert: {
          jti: string
          revoked_at: number
        }
        Update: {
          jti?: string
          revoked_at?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
