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
      events: {
        Row: {
          city: string | null
          confidence_score: number | null
          country: string
          created_at: string
          dedup_hash: string | null
          description: string | null
          end_date: string | null
          event_date: string | null
          event_time: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          image_url: string | null
          is_online: boolean
          organizer: string | null
          popularity_score: number | null
          posted_at: string | null
          posted_to_telegram: boolean
          registration_link: string | null
          source_platform: string | null
          source_url: string | null
          state: string
          status: Database["public"]["Enums"]["event_status"]
          submission_count: number
          tags: string[] | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          city?: string | null
          confidence_score?: number | null
          country?: string
          created_at?: string
          dedup_hash?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string | null
          event_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          image_url?: string | null
          is_online?: boolean
          organizer?: string | null
          popularity_score?: number | null
          posted_at?: string | null
          posted_to_telegram?: boolean
          registration_link?: string | null
          source_platform?: string | null
          source_url?: string | null
          state: string
          status?: Database["public"]["Enums"]["event_status"]
          submission_count?: number
          tags?: string[] | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          city?: string | null
          confidence_score?: number | null
          country?: string
          created_at?: string
          dedup_hash?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string | null
          event_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          image_url?: string | null
          is_online?: boolean
          organizer?: string | null
          popularity_score?: number | null
          posted_at?: string | null
          posted_to_telegram?: boolean
          registration_link?: string | null
          source_platform?: string | null
          source_url?: string | null
          state?: string
          status?: Database["public"]["Enums"]["event_status"]
          submission_count?: number
          tags?: string[] | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      scrape_logs: {
        Row: {
          created_at: string
          duplicates_skipped: number
          errors: string | null
          events_found: number
          events_inserted: number
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          duplicates_skipped?: number
          errors?: string | null
          events_found?: number
          events_inserted?: number
          id?: string
          source: string
        }
        Update: {
          created_at?: string
          duplicates_skipped?: number
          errors?: string | null
          events_found?: number
          events_inserted?: number
          id?: string
          source?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
      }
      telegram_posted_events: {
        Row: {
          event_id: string
          id: string
          message_id: number | null
          posted_at: string
        }
        Insert: {
          event_id: string
          id?: string
          message_id?: number | null
          posted_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          message_id?: number | null
          posted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_posted_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_submitted_events: {
        Row: {
          created_at: string
          dedup_hash: string | null
          id: string
          link: string | null
          normalized_date: string | null
          normalized_title: string | null
          processed: boolean
          raw_text: string | null
          submission_count: number
          submitted_by: string[] | null
        }
        Insert: {
          created_at?: string
          dedup_hash?: string | null
          id?: string
          link?: string | null
          normalized_date?: string | null
          normalized_title?: string | null
          processed?: boolean
          raw_text?: string | null
          submission_count?: number
          submitted_by?: string[] | null
        }
        Update: {
          created_at?: string
          dedup_hash?: string | null
          id?: string
          link?: string | null
          normalized_date?: string | null
          normalized_title?: string | null
          processed?: boolean
          raw_text?: string | null
          submission_count?: number
          submitted_by?: string[] | null
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
      event_status:
        | "upcoming"
        | "ongoing"
        | "completed"
        | "cancelled"
        | "pending_review"
        | "rejected"
      event_type:
        | "meetup"
        | "hackathon"
        | "workshop"
        | "conference"
        | "ama"
        | "online_session"
        | "bootcamp"
        | "summit"
        | "webinar"
        | "other"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      event_status: [
        "upcoming",
        "ongoing",
        "completed",
        "cancelled",
        "pending_review",
        "rejected",
      ],
      event_type: [
        "meetup",
        "hackathon",
        "workshop",
        "conference",
        "ama",
        "online_session",
        "bootcamp",
        "summit",
        "webinar",
        "other",
      ],
    },
  },
} as const
