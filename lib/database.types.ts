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
      applications: {
        Row: {
          company_counter_offer: string | null
          company_id: string | null
          created_at: string | null
          id: string
          job_id: string
          negotiation_message: string | null
          negotiation_status: string | null
          note: string | null
          requested_pay: string | null
          requested_pay_rate: string | null
          status: string
          worker_id: string
        }
        Insert: {
          company_counter_offer?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          negotiation_message?: string | null
          negotiation_status?: string | null
          note?: string | null
          requested_pay?: string | null
          requested_pay_rate?: string | null
          status?: string
          worker_id: string
        }
        Update: {
          company_counter_offer?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          negotiation_message?: string | null
          negotiation_status?: string | null
          note?: string | null
          requested_pay?: string | null
          requested_pay_rate?: string | null
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived_by_company: boolean | null
          archived_by_worker: boolean | null
          company_id: string
          company_last_read_at: string | null
          created_at: string | null
          id: string
          job_id: string | null
          worker_id: string
          worker_last_read_at: string | null
        }
        Insert: {
          archived_by_company?: boolean | null
          archived_by_worker?: boolean | null
          company_id: string
          company_last_read_at?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          worker_id: string
          worker_last_read_at?: string | null
        }
        Update: {
          archived_by_company?: boolean | null
          archived_by_worker?: boolean | null
          company_id?: string
          company_last_read_at?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          worker_id?: string
          worker_last_read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          status: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          status?: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          status?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_files: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          job_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          job_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          job_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_files_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_invites: {
        Row: {
          company_id: string | null
          company_seen: boolean | null
          created_at: string | null
          id: string
          job_id: string | null
          status: string | null
          worker_id: string | null
          worker_seen: boolean | null
        }
        Insert: {
          company_id?: string | null
          company_seen?: boolean | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          worker_id?: string | null
          worker_seen?: boolean | null
        }
        Update: {
          company_id?: string | null
          company_seen?: boolean | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          status?: string | null
          worker_id?: string | null
          worker_seen?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "job_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_invites_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_invites_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_views: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_application_id: string | null
          assigned_to: string | null
          assigned_worker_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          escrow_amount_cents: number | null
          escrow_status: string | null
          featured_until: string | null
          hired_worker_id: string | null
          id: string
          is_featured: boolean | null
          lat: number | null
          lng: number | null
          location: string
          paid: boolean | null
          paid_at: string | null
          paid_to_worker_at: string | null
          pay_rate: string | null
          payment_status: string | null
          payout_released_at: string | null
          payout_status: string | null
          platform_fee_amount: number | null
          platform_fee_cents: number | null
          platform_fee_percent: number | null
          price_cents: number | null
          start_date: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          stripe_transfer_id: string | null
          title: string
          trade: string
          worker_id: string | null
          worker_payout_amount: number | null
          worker_payout_cents: number | null
        }
        Insert: {
          assigned_application_id?: string | null
          assigned_to?: string | null
          assigned_worker_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          escrow_amount_cents?: number | null
          escrow_status?: string | null
          featured_until?: string | null
          hired_worker_id?: string | null
          id?: string
          is_featured?: boolean | null
          lat?: number | null
          lng?: number | null
          location: string
          paid?: boolean | null
          paid_at?: string | null
          paid_to_worker_at?: string | null
          pay_rate?: string | null
          payment_status?: string | null
          payout_released_at?: string | null
          payout_status?: string | null
          platform_fee_amount?: number | null
          platform_fee_cents?: number | null
          platform_fee_percent?: number | null
          price_cents?: number | null
          start_date?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          title: string
          trade: string
          worker_id?: string | null
          worker_payout_amount?: number | null
          worker_payout_cents?: number | null
        }
        Update: {
          assigned_application_id?: string | null
          assigned_to?: string | null
          assigned_worker_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          escrow_amount_cents?: number | null
          escrow_status?: string | null
          featured_until?: string | null
          hired_worker_id?: string | null
          id?: string
          is_featured?: boolean | null
          lat?: number | null
          lng?: number | null
          location?: string
          paid?: boolean | null
          paid_at?: string | null
          paid_to_worker_at?: string | null
          pay_rate?: string | null
          payment_status?: string | null
          payout_released_at?: string | null
          payout_status?: string | null
          platform_fee_amount?: number | null
          platform_fee_cents?: number | null
          platform_fee_percent?: number | null
          price_cents?: number | null
          start_date?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          title?: string
          trade?: string
          worker_id?: string | null
          worker_payout_amount?: number | null
          worker_payout_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_application_id_fkey"
            columns: ["assigned_application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_worker_id_fkey"
            columns: ["assigned_worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_hired_worker_id_fkey"
            columns: ["hired_worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          content: string | null
          conversation_id: string
          created_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_read: boolean | null
          job_id: string | null
          read_at: string | null
          read_by: string[] | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          content?: string | null
          conversation_id: string
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          read_at?: string | null
          read_by?: string[] | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          job_id?: string | null
          read_at?: string | null
          read_by?: string[] | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean
          link: string | null
          link_url: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          link_url?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          link_url?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_files: {
        Row: {
          category: string | null
          created_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          availability: string | null
          availability_status: string | null
          available_for_work: boolean | null
          avatar_url: string | null
          bio: string | null
          booked_until: string | null
          certifications: string | null
          city: string | null
          company_name: string | null
          company_verified: boolean | null
          created_at: string | null
          currently_working: boolean | null
          description: string | null
          full_name: string | null
          id: string
          insurance_company: string | null
          insurance_expiration: string | null
          insurance_file_path: string | null
          insurance_policy_number: string | null
          insurance_provider: string | null
          insurance_status: string | null
          insurance_url: string | null
          insurance_verified: boolean | null
          insured: boolean | null
          is_admin: boolean | null
          is_online: boolean | null
          job_experience: string | null
          last_seen: string | null
          lat: number | null
          liability_file_path: string | null
          liability_form_signed: boolean | null
          liability_form_url: string | null
          liability_form_verified: boolean | null
          liability_status: string | null
          license_number: string | null
          license_url: string | null
          lng: number | null
          phone: string | null
          primary_trade: string | null
          rating_average: number | null
          rating_count: number | null
          role: string
          state: string | null
          stripe_account_id: string | null
          stripe_charges_enabled: boolean | null
          stripe_details_submitted: boolean | null
          stripe_onboarded: boolean | null
          stripe_onboarding_complete: boolean | null
          stripe_payouts_enabled: boolean | null
          trade: string | null
          trades: string[] | null
          trades_hiring: string | null
          verified: boolean
          years_experience: number | null
        }
        Insert: {
          availability?: string | null
          availability_status?: string | null
          available_for_work?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          booked_until?: string | null
          certifications?: string | null
          city?: string | null
          company_name?: string | null
          company_verified?: boolean | null
          created_at?: string | null
          currently_working?: boolean | null
          description?: string | null
          full_name?: string | null
          id: string
          insurance_company?: string | null
          insurance_expiration?: string | null
          insurance_file_path?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          insurance_status?: string | null
          insurance_url?: string | null
          insurance_verified?: boolean | null
          insured?: boolean | null
          is_admin?: boolean | null
          is_online?: boolean | null
          job_experience?: string | null
          last_seen?: string | null
          lat?: number | null
          liability_file_path?: string | null
          liability_form_signed?: boolean | null
          liability_form_url?: string | null
          liability_form_verified?: boolean | null
          liability_status?: string | null
          license_number?: string | null
          license_url?: string | null
          lng?: number | null
          phone?: string | null
          primary_trade?: string | null
          rating_average?: number | null
          rating_count?: number | null
          role: string
          state?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_onboarded?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          trade?: string | null
          trades?: string[] | null
          trades_hiring?: string | null
          verified?: boolean
          years_experience?: number | null
        }
        Update: {
          availability?: string | null
          availability_status?: string | null
          available_for_work?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          booked_until?: string | null
          certifications?: string | null
          city?: string | null
          company_name?: string | null
          company_verified?: boolean | null
          created_at?: string | null
          currently_working?: boolean | null
          description?: string | null
          full_name?: string | null
          id?: string
          insurance_company?: string | null
          insurance_expiration?: string | null
          insurance_file_path?: string | null
          insurance_policy_number?: string | null
          insurance_provider?: string | null
          insurance_status?: string | null
          insurance_url?: string | null
          insurance_verified?: boolean | null
          insured?: boolean | null
          is_admin?: boolean | null
          is_online?: boolean | null
          job_experience?: string | null
          last_seen?: string | null
          lat?: number | null
          liability_file_path?: string | null
          liability_form_signed?: boolean | null
          liability_form_url?: string | null
          liability_form_verified?: boolean | null
          liability_status?: string | null
          license_number?: string | null
          license_url?: string | null
          lng?: number | null
          phone?: string | null
          primary_trade?: string | null
          rating_average?: number | null
          rating_count?: number | null
          role?: string
          state?: string | null
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean | null
          stripe_details_submitted?: boolean | null
          stripe_onboarded?: boolean | null
          stripe_onboarding_complete?: boolean | null
          stripe_payouts_enabled?: boolean | null
          trade?: string | null
          trades?: string[] | null
          trades_hiring?: string | null
          verified?: boolean
          years_experience?: number | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          job_id: string | null
          rating: number
          reviewee_id: string | null
          reviewer_id: string | null
        }
        Insert: {
          comment?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          rating: number
          reviewee_id?: string | null
          reviewer_id?: string | null
        }
        Update: {
          comment?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          rating?: number
          reviewee_id?: string | null
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          worker_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_jobs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_workers: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          worker_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          worker_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_workers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_workers_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      typing_status: {
        Row: {
          conversation_id: string
          display_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          display_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_status_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "typing_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_presence: {
        Row: {
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
    Enums: {},
  },
} as const
