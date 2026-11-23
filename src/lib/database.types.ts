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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      tasks: {
        Row: { id: string; title: string; description: string; instructions: string; reward_amount: number; status: string; starts_at: string | null; deadline: string | null; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; title: string; description?: string; instructions?: string; reward_amount?: number; status?: string; starts_at?: string | null; deadline?: string | null; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; title?: string; description?: string; instructions?: string; reward_amount?: number; status?: string; starts_at?: string | null; deadline?: string | null; created_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      task_submissions: {
        Row: { id: string; task_id: string; user_id: string; status: string; submitted_at: string; reviewed_at: string | null; reviewed_by: string | null; review_note: string | null; reward_amount_snapshot: number }
        Insert: { id?: string; task_id: string; user_id: string; status?: string; submitted_at?: string; reviewed_at?: string | null; reviewed_by?: string | null; review_note?: string | null; reward_amount_snapshot: number }
        Update: { id?: string; task_id?: string; user_id?: string; status?: string; submitted_at?: string; reviewed_at?: string | null; reviewed_by?: string | null; review_note?: string | null; reward_amount_snapshot?: number }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          config: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          position: number
          reward_amount: number
          title: string
        }
        Insert: {
          activity_type?: string
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          position?: number
          reward_amount?: number
          title: string
        }
        Update: {
          activity_type?: string
          config?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          position?: number
          reward_amount?: number
          title?: string
        }
        Relationships: []
      }
      ad_placements: {
        Row: {
          enabled: boolean
          format: string
          id: string
          key: string
          location: string
          name: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          format?: string
          id?: string
          key: string
          location: string
          name: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          format?: string
          id?: string
          key?: string
          location?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          content_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget_coins: number | null
          clicks: number
          content_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          impressions: number
          name: string
          sponsor: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
        }
        Insert: {
          budget_coins?: number | null
          clicks?: number
          content_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          name: string
          sponsor?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Update: {
          budget_coins?: number | null
          clicks?: number
          content_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          impressions?: number
          name?: string
          sponsor?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      ac_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          reason: string
          reward_event_id: string | null
          source: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          reason: string
          reward_event_id?: string | null
          source?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          reason?: string
          reward_event_id?: string | null
          source?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ac_transactions_reward_event_id_fkey"
            columns: ["reward_event_id"]
            isOneToOne: false
            referencedRelation: "reward_events"
            referencedColumns: ["id"]
          },
        ]
      }
      ac_wallets: {
        Row: {
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          reason: string
          reward_event_id: string | null
          source: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          usd_submission_id: string | null
          usd_adjustment_request_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          reason: string
          reward_event_id?: string | null
          source?: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
          usd_submission_id?: string | null
          usd_adjustment_request_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          reason?: string
          reward_event_id?: string | null
          source?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
          usd_submission_id?: string | null
          usd_adjustment_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coin_transactions_reward_event_id_fkey"
            columns: ["reward_event_id"]
            isOneToOne: false
            referencedRelation: "reward_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_transactions_usd_submission_id_fkey"
            columns: ["usd_submission_id"]
            isOneToOne: true
            referencedRelation: "usd_reward_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_transactions_usd_adjustment_request_id_fkey"
            columns: ["usd_adjustment_request_id"]
            isOneToOne: true
            referencedRelation: "usd_admin_adjustments"
            referencedColumns: ["request_id"]
          },
        ]
      }
      consents: {
        Row: {
          consent_type: string
          created_at: string
          granted: boolean
          id: string
          source: string
          user_id: string
        }
        Insert: {
          consent_type: string
          created_at?: string
          granted: boolean
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          consent_type?: string
          created_at?: string
          granted?: boolean
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      content: {
        Row: {
          author_id: string | null
          body: string | null
          cover_url: string | null
          created_at: string
          duration_seconds: number | null
          excerpt: string | null
          id: string
          is_sponsored: boolean
          published_at: string | null
          slug: string
          sponsor_name: string | null
          status: Database["public"]["Enums"]["content_status"]
          tags: string[]
          title: string
          type: Database["public"]["Enums"]["content_type"]
          updated_at: string
          video_url: string | null
          view_count: number
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          excerpt?: string | null
          id?: string
          is_sponsored?: boolean
          published_at?: string | null
          slug: string
          sponsor_name?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Update: {
          author_id?: string | null
          body?: string | null
          cover_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          excerpt?: string | null
          id?: string
          is_sponsored?: boolean
          published_at?: string | null
          slug?: string
          sponsor_name?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          tags?: string[]
          title?: string
          type?: Database["public"]["Enums"]["content_type"]
          updated_at?: string
          video_url?: string | null
          view_count?: number
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          content_id: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          content_id: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          content_id?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          coins_awarded: number
          created_at: string
          id: string
          streak_count: number
          user_id: string
        }
        Insert: {
          checkin_date: string
          coins_awarded?: number
          created_at?: string
          id?: string
          streak_count?: number
          user_id: string
        }
        Update: {
          checkin_date?: string
          coins_awarded?: number
          created_at?: string
          id?: string
          streak_count?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          href: string | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          href?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_banned: boolean
          join_date: string
          referral_code: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_banned?: boolean
          join_date?: string
          referral_code?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_banned?: boolean
          join_date?: string
          referral_code?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          rewarded: boolean
          score: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          rewarded?: boolean
          score?: number
          total?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          rewarded?: boolean
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          answers: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_attempts_per_day: number
          questions: Json
          reward_amount: number
          slug: string
          title: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_attempts_per_day?: number
          questions?: Json
          reward_amount?: number
          slug: string
          title: string
        }
        Update: {
          answers?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_attempts_per_day?: number
          questions?: Json
          reward_amount?: number
          slug?: string
          title?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          credited_at: string | null
          id: string
          referred_id: string
          referrer_id: string
          status: Database["public"]["Enums"]["referral_status"]
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_id: string
          referrer_id: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          id?: string
          referred_id?: string
          referrer_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
        }
        Relationships: []
      }
      reward_configs: {
        Row: {
          amount: number
          daily_limit: number | null
          description: string | null
          enabled: boolean
          id: string
          key: string
          label: string
          per_user_limit: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          daily_limit?: number | null
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          label: string
          per_user_limit?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          daily_limit?: number | null
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          per_user_limit?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reward_events: {
        Row: {
          amount: number
          business_key: string
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          metadata: Json
          source: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          business_key: string
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          metadata?: Json
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          business_key?: string
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          metadata?: Json
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          email_notifications: boolean
          marketing_consent: boolean
          rewarded_ads_enabled: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          email_notifications?: boolean
          marketing_consent?: boolean
          rewarded_ads_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          email_notifications?: boolean
          marketing_consent?: boolean
          rewarded_ads_enabled?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_records: {
        Row: { id: string; created_at: string; deleted_at: string | null }
        Insert: { id: string; created_at?: string; deleted_at?: string | null }
        Update: { id?: string; created_at?: string; deleted_at?: string | null }
        Relationships: []
      }
      usd_reward_configs: {
        Row: { id: string; key: string; category: string; label: string; amount_cents: number; daily_limit: number | null; per_user_limit: number | null; enabled: boolean; created_by: string | null; updated_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; key: string; category: string; label: string; amount_cents: number; daily_limit?: number | null; per_user_limit?: number | null; enabled?: boolean; created_by?: string | null; updated_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; key?: string; category?: string; label?: string; amount_cents?: number; daily_limit?: number | null; per_user_limit?: number | null; enabled?: boolean; created_by?: string | null; updated_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      usd_reward_submissions: {
        Row: { id: string; config_id: string; user_id: string; details: string; activity_reference: string; reward_cents: number; status: string; reviewed_by: string | null; reviewed_at: string | null; review_note: string | null; created_at: string }
        Insert: { id?: string; config_id: string; user_id: string; details: string; activity_reference: string; reward_cents: number; status?: string; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; created_at?: string }
        Update: { id?: string; config_id?: string; user_id?: string; details?: string; activity_reference?: string; reward_cents?: number; status?: string; reviewed_by?: string | null; reviewed_at?: string | null; review_note?: string | null; created_at?: string }
        Relationships: []
      }
      usd_admin_adjustments: {
        Row: { request_id: string; user_id: string; amount_cents: number; reason: string; balance_after: number; created_by: string | null; created_at: string }
        Insert: { request_id: string; user_id: string; amount_cents: number; reason: string; balance_after: number; created_by?: string | null; created_at?: string }
        Update: { request_id?: string; user_id?: string; amount_cents?: number; reason?: string; balance_after?: number; created_by?: string | null; created_at?: string }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_task_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      submit_usd_activity: {
        Args: {
          p_config_id: string;
          p_details: string;
          p_activity_reference: string;
        };
        Returns: Json;
      }
      review_usd_activity: { Args: { p_submission_id: string; p_decision: string; p_review_note?: string | null }; Returns: Json }
      admin_adjust_usd_balance: { Args: { p_user_id: string; p_amount_cents: number; p_reason: string; p_request_id: string }; Returns: Json }
      submit_task_completion: { Args: { p_task_id: string }; Returns: Json }
      review_task_completion: { Args: { p_submission_id: string; p_decision: string; p_review_note?: string | null }; Returns: Json }
      admin_adjust_balance: {
        Args: { p_amount: number; p_reason: string; p_user_id: string }
        Returns: Json
      }
      apply_reward: {
        Args: {
          p_amount_override?: number
          p_business_key: string
          p_event_type: string
          p_metadata?: Json
          p_source: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_reward: {
        Args: {
          p_business_key: string
          p_event_type: string
          p_metadata?: Json
          p_source?: string
        }
        Returns: Json
      }
      get_balance: { Args: never; Returns: number }
      get_balance_for: { Args: { p_user_id: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_target_id?: string
          p_target_type?: string
        }
        Returns: string
      }
      submit_quiz_attempt: {
        Args: { p_answers: Json; p_quiz_slug: string; p_source?: string }
        Returns: Json
      }
    }
    Enums: {
      campaign_status: "draft" | "active" | "paused" | "ended"
      content_status: "draft" | "pending" | "published" | "rejected" | "removed"
      content_type: "article" | "video" | "short" | "community"
      referral_status: "pending" | "credited" | "rejected"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      transaction_type: "credit" | "debit"
      user_role: "member" | "moderator" | "admin" | "super_admin"
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
    Enums: {
      campaign_status: ["draft", "active", "paused", "ended"],
      content_status: ["draft", "pending", "published", "rejected", "removed"],
      content_type: ["article", "video", "short", "community"],
      referral_status: ["pending", "credited", "rejected"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      transaction_type: ["credit", "debit"],
      user_role: ["member", "moderator", "admin", "super_admin"],
    },
  },
} as const
export type CoinTransaction =
  Database["public"]["Tables"]["coin_transactions"]["Row"];

export type Activity = Tables<"activities">;
export type Task = Tables<"tasks">;
export type TaskSubmission = Tables<"task_submissions">;
export type AdPlacement = Tables<"ad_placements">;
export type AuditLog = Tables<"audit_logs">;
export type Campaign = Tables<"campaigns">;
export type Content = Tables<"content">;
export type ContentReport = Tables<"content_reports">;
export type AppNotification = Tables<"notifications">;
export type Profile = Tables<"profiles">;
export type Referral = Tables<"referrals">;
export type RewardConfig = Tables<"reward_configs">;

export type UserRole = Enums<"user_role">;
export type ContentStatus = Enums<"content_status">;
export type ContentType = Enums<"content_type">;

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
};

export type Quiz = Omit<Tables<"quizzes">, "questions"> & {
  questions: QuizQuestion[];
};

export function parseQuizQuestions(value: Json): QuizQuestion[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is { id: string; question: string; options: string[] } =>
      typeof item === "object" &&
      item !== null &&
      !Array.isArray(item) &&
      typeof item.id === "string" &&
      typeof item.question === "string" &&
      Array.isArray(item.options) &&
      item.options.every((option) => typeof option === "string"),
  );
}
