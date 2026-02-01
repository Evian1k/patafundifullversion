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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_accounts: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_login_at: string | null
          role: string
          two_factor_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role?: string
          two_factor_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          role?: string
          two_factor_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fundi_profiles: {
        Row: {
          bio: string | null
          created_at: string
          experience_years: number | null
          hourly_rate: number | null
          id: string
          id_number: string | null
          id_photo_url: string | null
          is_available: boolean | null
          mpesa_number: string | null
          rating: number | null
          selfie_url: string | null
          skills: string[]
          subscription_active: boolean | null
          subscription_expires_at: string | null
          total_jobs: number | null
          updated_at: string
          user_id: string
          verification_status:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          hourly_rate?: number | null
          id?: string
          id_number?: string | null
          id_photo_url?: string | null
          is_available?: boolean | null
          mpesa_number?: string | null
          rating?: number | null
          selfie_url?: string | null
          skills?: string[]
          subscription_active?: boolean | null
          subscription_expires_at?: string | null
          total_jobs?: number | null
          updated_at?: string
          user_id: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          experience_years?: number | null
          hourly_rate?: number | null
          id?: string
          id_number?: string | null
          id_photo_url?: string | null
          is_available?: boolean | null
          mpesa_number?: string | null
          rating?: number | null
          selfie_url?: string | null
          skills?: string[]
          subscription_active?: boolean | null
          subscription_expires_at?: string | null
          total_jobs?: number | null
          updated_at?: string
          user_id?: string
          verification_status?:
            | Database["public"]["Enums"]["verification_status"]
            | null
        }
        Relationships: []
      }
      job_bids: {
        Row: {
          created_at: string
          eta_minutes: number | null
          fundi_id: string
          id: string
          job_id: string
          message: string | null
          price: number
          status: string | null
        }
        Insert: {
          created_at?: string
          eta_minutes?: number | null
          fundi_id: string
          id?: string
          job_id: string
          message?: string | null
          price: number
          status?: string | null
        }
        Update: {
          created_at?: string
          eta_minutes?: number | null
          fundi_id?: string
          id?: string
          job_id?: string
          message?: string | null
          price?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_bids_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          created_at: string
          id: string
          job_id: string
          photo_type: string | null
          photo_url: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          photo_type?: string | null
          photo_url: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          photo_type?: string | null
          photo_url?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          category_id: string | null
          completed_at: string | null
          completion_code: string | null
          created_at: string
          customer_id: string
          description: string
          estimated_price: number | null
          final_price: number | null
          fundi_id: string | null
          id: string
          latitude: number | null
          location: string
          longitude: number | null
          platform_fee: number | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at: string
          urgency: string
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          completion_code?: string | null
          created_at?: string
          customer_id: string
          description: string
          estimated_price?: number | null
          final_price?: number | null
          fundi_id?: string | null
          id?: string
          latitude?: number | null
          location: string
          longitude?: number | null
          platform_fee?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          completion_code?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          estimated_price?: number | null
          final_price?: number | null
          fundi_id?: string | null
          id?: string
          latitude?: number | null
          location?: string
          longitude?: number | null
          platform_fee?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          title?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          job_id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          job_id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          job_id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          fundi_earnings: number
          fundi_id: string
          id: string
          job_id: string
          payment_method: string
          payment_status: string | null
          platform_fee: number
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          fundi_earnings: number
          fundi_id: string
          id?: string
          job_id: string
          payment_method: string
          payment_status?: string | null
          platform_fee: number
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          fundi_earnings?: number
          fundi_id?: string
          id?: string
          job_id?: string
          payment_method?: string
          payment_status?: string | null
          platform_fee?: number
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          location: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          location?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          job_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          job_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          job_id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      job_status:
        | "pending"
        | "matching"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
      user_role: "customer" | "fundi" | "admin"
      verification_status: "pending" | "verified" | "rejected"
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
      job_status: [
        "pending",
        "matching",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
        "disputed",
      ],
      user_role: ["customer", "fundi", "admin"],
      verification_status: ["pending", "verified", "rejected"],
    },
  },
} as const
