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
      admin_permissions: {
        Row: {
          allowed_categories: string[] | null
          created_at: string
          created_by: string | null
          crew_id: string
          display_name: string | null
          id: string
          is_super_admin: boolean
          user_id: string
        }
        Insert: {
          allowed_categories?: string[] | null
          created_at?: string
          created_by?: string | null
          crew_id?: string
          display_name?: string | null
          id?: string
          is_super_admin?: boolean
          user_id: string
        }
        Update: {
          allowed_categories?: string[] | null
          created_at?: string
          created_by?: string | null
          crew_id?: string
          display_name?: string | null
          id?: string
          is_super_admin?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_permissions_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_definitions: {
        Row: {
          category: string
          crew_id: string
          description: string
          emoji: string
          id: string
          is_active: boolean
          key: string
          name: string
          sort_order: number
          threshold: number | null
        }
        Insert: {
          category: string
          crew_id?: string
          description: string
          emoji: string
          id?: string
          is_active?: boolean
          key: string
          name: string
          sort_order?: number
          threshold?: number | null
        }
        Update: {
          category?: string
          crew_id?: string
          description?: string
          emoji?: string
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          sort_order?: number
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "badge_definitions_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          bonus_points: number
          challenged_id: string
          challenged_pts: number | null
          challenger_id: string
          challenger_pts: number | null
          created_at: string
          crew_id: string
          id: string
          resolved_at: string | null
          season_id: string | null
          status: string
          week: number
          winner_id: string | null
        }
        Insert: {
          bonus_points?: number
          challenged_id: string
          challenged_pts?: number | null
          challenger_id: string
          challenger_pts?: number | null
          created_at?: string
          crew_id?: string
          id?: string
          resolved_at?: string | null
          season_id?: string | null
          status?: string
          week: number
          winner_id?: string | null
        }
        Update: {
          bonus_points?: number
          challenged_id?: string
          challenged_pts?: number | null
          challenger_id?: string
          challenger_pts?: number | null
          created_at?: string
          crew_id?: string
          id?: string
          resolved_at?: string | null
          season_id?: string | null
          status?: string
          week?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenges_challenged_id_fkey"
            columns: ["challenged_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_events: {
        Row: {
          coach_id: string
          created_at: string
          crew_id: string
          id: string
          match_id: string | null
          notes: string | null
          quantity: number
          rule_key: string
          season: string
          season_id: string | null
          week: number
        }
        Insert: {
          coach_id: string
          created_at?: string
          crew_id?: string
          id?: string
          match_id?: string | null
          notes?: string | null
          quantity?: number
          rule_key: string
          season?: string
          season_id?: string | null
          week: number
        }
        Update: {
          coach_id?: string
          created_at?: string
          crew_id?: string
          id?: string
          match_id?: string | null
          notes?: string | null
          quantity?: number
          rule_key?: string
          season?: string
          season_id?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_events_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          category: string
          created_at: string
          crew_id: string
          full_name: string
          id: string
          photo_url: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          crew_id?: string
          full_name: string
          id?: string
          photo_url?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          crew_id?: string
          full_name?: string
          id?: string
          photo_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "player_categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "coaches_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_user_roles: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_user_roles_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          is_active: boolean
          logo_url: string | null
          name: string
          owner_user_id: string | null
          primary_color: string | null
          slug: string
          sport_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          primary_color?: string | null
          slug: string
          sport_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          primary_color?: string | null
          slug?: string
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_snapshots: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          rank: number
          season: string
          season_id: string | null
          team_id: string
          total_points: number
          week: number
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          rank: number
          season?: string
          season_id?: string | null
          team_id: string
          total_points: number
          week: number
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          rank?: number
          season?: string
          season_id?: string | null
          team_id?: string
          total_points?: number
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_snapshots_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_snapshots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          crew_id: string
          id: string
          joined_at: string
          league_id: string
          user_id: string
        }
        Insert: {
          crew_id?: string
          id?: string
          joined_at?: string
          league_id: string
          user_id: string
        }
        Update: {
          crew_id?: string
          id?: string
          joined_at?: string
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_teams: {
        Row: {
          crew_id: string
          id: string
          league_id: string
          team_id: string
        }
        Insert: {
          crew_id?: string
          id?: string
          league_id: string
          team_id: string
        }
        Update: {
          crew_id?: string
          id?: string
          league_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_teams_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      mandatory_slots: {
        Row: {
          created_at: string
          crew_id: string
          description: string | null
          duration_type: Database["public"]["Enums"]["mandatory_duration"]
          eligible_player_ids: string[]
          ends_at: string
          id: string
          penalties_applied: boolean
          season: string
          season_id: string | null
          starts_at: string
          title: string
          warning_sent: boolean
        }
        Insert: {
          created_at?: string
          crew_id?: string
          description?: string | null
          duration_type: Database["public"]["Enums"]["mandatory_duration"]
          eligible_player_ids?: string[]
          ends_at: string
          id?: string
          penalties_applied?: boolean
          season?: string
          season_id?: string | null
          starts_at: string
          title: string
          warning_sent?: boolean
        }
        Update: {
          created_at?: string
          crew_id?: string
          description?: string | null
          duration_type?: Database["public"]["Enums"]["mandatory_duration"]
          eligible_player_ids?: string[]
          ends_at?: string
          id?: string
          penalties_applied?: boolean
          season?: string
          season_id?: string | null
          starts_at?: string
          title?: string
          warning_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mandatory_slots_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandatory_slots_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      match_call_ups: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          jersey_number: number | null
          match_id: string
          player_id: string
          squad_role: string
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          jersey_number?: number | null
          match_id: string
          player_id: string
          squad_role?: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          jersey_number?: number | null
          match_id?: string
          player_id?: string
          squad_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_call_ups_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_call_ups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_call_ups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "match_call_ups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          category: string
          coach_id: string | null
          created_at: string
          crew_id: string
          home_away: string
          id: string
          match_date: string
          match_time: string | null
          notes: string | null
          opponent: string
          season: string
          season_id: string | null
          status: string
          week: number
        }
        Insert: {
          category: string
          coach_id?: string | null
          created_at?: string
          crew_id?: string
          home_away?: string
          id?: string
          match_date: string
          match_time?: string | null
          notes?: string | null
          opponent: string
          season?: string
          season_id?: string | null
          status?: string
          week: number
        }
        Update: {
          category?: string
          coach_id?: string | null
          created_at?: string
          crew_id?: string
          home_away?: string
          id?: string
          match_date?: string
          match_time?: string | null
          notes?: string | null
          opponent?: string
          season?: string
          season_id?: string | null
          status?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "matches_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_history: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          crew_id: string
          delivery_count: number
          id: string
          scheduled_for: string | null
          sent_at: string | null
          title: string
          url: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by?: string | null
          crew_id?: string
          delivery_count?: number
          id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          title: string
          url?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          crew_id?: string
          delivery_count?: number
          id?: string
          scheduled_for?: string | null
          sent_at?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_history_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          audience: string
          crew_id: string
          failure_count: number
          id: string
          payload: Json | null
          recipient_count: number
          sent_at: string
          success_count: number
          template_id: string | null
        }
        Insert: {
          audience: string
          crew_id?: string
          failure_count?: number
          id?: string
          payload?: Json | null
          recipient_count?: number
          sent_at?: string
          success_count?: number
          template_id?: string | null
        }
        Update: {
          audience?: string
          crew_id?: string
          failure_count?: number
          id?: string
          payload?: Json | null
          recipient_count?: number
          sent_at?: string
          success_count?: number
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          audience: string
          created_at: string
          crew_id: string
          cron_expression: string | null
          event_trigger: string | null
          id: string
          is_active: boolean
          push_body: string
          push_title: string
          push_url: string | null
          scheduled_at: string | null
          send_hour: number | null
          send_minute: number | null
          sent_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_template_type"]
        }
        Insert: {
          audience?: string
          created_at?: string
          crew_id?: string
          cron_expression?: string | null
          event_trigger?: string | null
          id?: string
          is_active?: boolean
          push_body: string
          push_title: string
          push_url?: string | null
          scheduled_at?: string | null
          send_hour?: number | null
          send_minute?: number | null
          sent_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_template_type"]
        }
        Update: {
          audience?: string
          created_at?: string
          crew_id?: string
          cron_expression?: string | null
          event_trigger?: string | null
          id?: string
          is_active?: boolean
          push_body?: string
          push_title?: string
          push_url?: string | null
          scheduled_at?: string | null
          send_hour?: number | null
          send_minute?: number | null
          sent_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_template_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notification_templates_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      player_badges: {
        Row: {
          badge_key: string
          crew_id: string
          earned_at: string
          id: string
          player_id: string
          season_id: string | null
        }
        Insert: {
          badge_key: string
          crew_id?: string
          earned_at?: string
          id?: string
          player_id: string
          season_id?: string | null
        }
        Update: {
          badge_key?: string
          crew_id?: string
          earned_at?: string
          id?: string
          player_id?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_badges_badge_key_fkey"
            columns: ["badge_key"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "player_badges_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_badges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_badges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_badges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_categories: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          is_active: boolean
          label: string
          name: string
          sort_order: number
          training_days: number[]
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          is_active?: boolean
          label: string
          name: string
          sort_order?: number
          training_days?: number[]
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          is_active?: boolean
          label?: string
          name?: string
          sort_order?: number
          training_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "player_categories_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          category: string
          created_at: string
          crew_id: string
          full_name: string
          height_cm: number | null
          id: string
          photo_url: string | null
          role: string
          user_id: string | null
          value_zaghetti: number
          weight_kg: number | null
        }
        Insert: {
          category: string
          created_at?: string
          crew_id?: string
          full_name: string
          height_cm?: number | null
          id?: string
          photo_url?: string | null
          role: string
          user_id?: string | null
          value_zaghetti?: number
          weight_kg?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          crew_id?: string
          full_name?: string
          height_cm?: number | null
          id?: string
          photo_url?: string | null
          role?: string
          user_id?: string | null
          value_zaghetti?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "player_categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "players_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      role_assignment_history: {
        Row: {
          assigned_at: string
          created_at: string
          crew_id: string
          id: string
          player_id: string
          removed_at: string | null
          role: string
          season_id: string | null
          team_id: string
        }
        Insert: {
          assigned_at?: string
          created_at?: string
          crew_id?: string
          id?: string
          player_id: string
          removed_at?: string | null
          role: string
          season_id?: string | null
          team_id: string
        }
        Update: {
          assigned_at?: string
          created_at?: string
          crew_id?: string
          id?: string
          player_id?: string
          removed_at?: string | null
          role?: string
          season_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignment_history_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignment_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "role_assignment_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignment_history_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_assignment_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          applies_to: string
          crew_id: string
          is_active: boolean
          is_malus: boolean
          key: string
          label: string
          points: number
          score_type: string
          sort_order: number
        }
        Insert: {
          applies_to?: string
          crew_id?: string
          is_active?: boolean
          is_malus?: boolean
          key: string
          label: string
          points: number
          score_type?: string
          sort_order?: number
        }
        Update: {
          applies_to?: string
          crew_id?: string
          is_active?: boolean
          is_malus?: boolean
          key?: string
          label?: string
          points?: number
          score_type?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      season_player_results: {
        Row: {
          category: string
          created_at: string
          crew_id: string
          final_points: number
          final_rank: number
          full_name: string
          id: string
          player_id: string
          season_id: string
        }
        Insert: {
          category: string
          created_at?: string
          crew_id?: string
          final_points: number
          final_rank: number
          full_name: string
          id?: string
          player_id: string
          season_id: string
        }
        Update: {
          category?: string
          created_at?: string
          crew_id?: string
          final_points?: number
          final_rank?: number
          full_name?: string
          id?: string
          player_id?: string
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_player_results_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_player_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_results: {
        Row: {
          created_at: string
          crew_id: string
          final_points: number
          final_rank: number
          id: string
          manager_name: string | null
          season_id: string
          team_id: string
          team_name: string
        }
        Insert: {
          created_at?: string
          crew_id?: string
          final_points: number
          final_rank: number
          id?: string
          manager_name?: string | null
          season_id: string
          team_id: string
          team_name: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          final_points?: number
          final_rank?: number
          id?: string
          manager_name?: string | null
          season_id?: string
          team_id?: string
          team_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_results_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_results_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          crew_id: string
          ends_at: string
          id: string
          is_active: boolean
          is_archived: boolean
          name: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          crew_id?: string
          ends_at: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          name: string
          starts_at: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          name?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      special_action_completions: {
        Row: {
          action_id: string
          coach_id: string | null
          created_at: string
          crew_id: string
          id: string
          player_id: string | null
        }
        Insert: {
          action_id: string
          coach_id?: string | null
          created_at?: string
          crew_id?: string
          id?: string
          player_id?: string | null
        }
        Update: {
          action_id?: string
          coach_id?: string | null
          created_at?: string
          crew_id?: string
          id?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "special_action_completions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "special_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_action_completions_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_action_completions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "special_action_completions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      special_actions: {
        Row: {
          created_at: string
          crew_id: string
          description: string | null
          expires_at: string | null
          id: string
          points: number
          season: string
          season_id: string | null
          title: string
          week: number
        }
        Insert: {
          created_at?: string
          crew_id?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          points: number
          season?: string
          season_id?: string | null
          title: string
          week: number
        }
        Update: {
          created_at?: string
          crew_id?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          points?: number
          season?: string
          season_id?: string | null
          title?: string
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "special_actions_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_actions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_scoring_rules: {
        Row: {
          applies_to: string
          created_at: string
          id: string
          is_active: boolean
          is_malus: boolean
          key: string
          label: string
          points: number
          score_type: string
          sort_order: number
          sport_id: string
        }
        Insert: {
          applies_to?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_malus?: boolean
          key: string
          label: string
          points?: number
          score_type?: string
          sort_order?: number
          sport_id: string
        }
        Update: {
          applies_to?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_malus?: boolean
          key?: string
          label?: string
          points?: number
          score_type?: string
          sort_order?: number
          sport_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_scoring_rules_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      super_admin_seeds: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      team_coaches: {
        Row: {
          coach_id: string
          crew_id: string
          id: string
          team_id: string
        }
        Insert: {
          coach_id: string
          crew_id?: string
          id?: string
          team_id: string
        }
        Update: {
          coach_id?: string
          crew_id?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      team_config: {
        Row: {
          crew_id: string
          group_name: string
          key: string
          label: string
          sort_order: number
          value: number
        }
        Insert: {
          crew_id?: string
          group_name: string
          key: string
          label: string
          sort_order?: number
          value: number
        }
        Update: {
          crew_id?: string
          group_name?: string
          key?: string
          label?: string
          sort_order?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_config_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      team_manager_assignments: {
        Row: {
          category: string
          created_at: string
          created_by: string
          crew_id: string
          id: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by: string
          crew_id?: string
          id?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          crew_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_manager_assignments_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      team_penalties: {
        Row: {
          applied_at: string
          crew_id: string
          id: string
          mandatory_slot_id: string | null
          points: number
          reason: string
          season: string
          team_id: string
        }
        Insert: {
          applied_at?: string
          crew_id?: string
          id?: string
          mandatory_slot_id?: string | null
          points: number
          reason: string
          season?: string
          team_id: string
        }
        Update: {
          applied_at?: string
          crew_id?: string
          id?: string
          mandatory_slot_id?: string | null
          points?: number
          reason?: string
          season?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_penalties_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_penalties_mandatory_slot_id_fkey"
            columns: ["mandatory_slot_id"]
            isOneToOne: false
            referencedRelation: "mandatory_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      team_player_history: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          joined_at: string
          left_at: string | null
          player_id: string
          season: string
          season_id_ref: string | null
          team_id: string
          transfer_type: string
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          player_id: string
          season?: string
          season_id_ref?: string | null
          team_id: string
          transfer_type?: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          player_id?: string
          season?: string
          season_id_ref?: string | null
          team_id?: string
          transfer_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_player_history_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_player_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "team_player_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_player_history_season_id_ref_fkey"
            columns: ["season_id_ref"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_player_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_players: {
        Row: {
          crew_id: string
          id: string
          player_id: string
          team_id: string
        }
        Insert: {
          crew_id?: string
          id?: string
          player_id: string
          team_id: string
        }
        Update: {
          crew_id?: string
          id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_players_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          captain_changed_at: string | null
          captain_player_id: string | null
          created_at: string
          crew_id: string
          id: string
          manager_id: string
          name: string
          season: string
          season_id: string | null
          silverback_changed_at: string | null
          silverback_player_id: string | null
          talisman_changed_at: string | null
          talisman_player_id: string | null
        }
        Insert: {
          captain_changed_at?: string | null
          captain_player_id?: string | null
          created_at?: string
          crew_id?: string
          id?: string
          manager_id: string
          name: string
          season?: string
          season_id?: string | null
          silverback_changed_at?: string | null
          silverback_player_id?: string | null
          talisman_changed_at?: string | null
          talisman_player_id?: string | null
        }
        Update: {
          captain_changed_at?: string | null
          captain_player_id?: string | null
          created_at?: string
          crew_id?: string
          id?: string
          manager_id?: string
          name?: string
          season?: string
          season_id?: string | null
          silverback_changed_at?: string | null
          silverback_player_id?: string | null
          talisman_changed_at?: string | null
          talisman_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_player_id_fkey"
            columns: ["captain_player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "teams_captain_player_id_fkey"
            columns: ["captain_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      training_absence_reads: {
        Row: {
          absence_id: string
          coach_id: string
          crew_id: string
          id: string
          read_at: string
        }
        Insert: {
          absence_id: string
          coach_id: string
          crew_id?: string
          id?: string
          read_at?: string
        }
        Update: {
          absence_id?: string
          coach_id?: string
          crew_id?: string
          id?: string
          read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_absence_reads_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "training_absences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_absence_reads_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      training_absences: {
        Row: {
          category: string
          created_at: string
          crew_id: string
          id: string
          justification: string
          player_id: string
          training_date: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          crew_id?: string
          id?: string
          justification: string
          player_id: string
          training_date: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          crew_id?: string
          id?: string
          justification?: string
          player_id?: string
          training_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_absences_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_absences_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "training_absences_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      training_schedules: {
        Row: {
          category: string
          created_at: string
          crew_id: string
          day_of_week: number
          id: string
          is_active: boolean
          location: string | null
          season_id: string | null
          start_time: string | null
        }
        Insert: {
          category: string
          created_at?: string
          crew_id?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          location?: string | null
          season_id?: string | null
          start_time?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          crew_id?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          location?: string | null
          season_id?: string | null
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_schedules_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "player_categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "training_schedules_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_schedules_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          category: string
          created_at: string
          crew_id: string
          id: string
          location: string | null
          season_id: string | null
          start_time: string | null
          training_date: string
        }
        Insert: {
          category: string
          created_at?: string
          crew_id?: string
          id?: string
          location?: string | null
          season_id?: string | null
          start_time?: string | null
          training_date: string
        }
        Update: {
          category?: string
          created_at?: string
          crew_id?: string
          id?: string
          location?: string | null
          season_id?: string | null
          start_time?: string | null
          training_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "player_categories"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "trainings_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainings_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_sessions: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          saved_at: string
          season_id: string | null
          team_id: string
          transfer_type: string
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          saved_at?: string
          season_id?: string | null
          team_id: string
          transfer_type?: string
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          saved_at?: string
          season_id?: string | null
          team_id?: string
          transfer_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_sessions_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          crew_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          crew_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          crew_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_events: {
        Row: {
          created_at: string
          crew_id: string
          id: string
          inserted_at: string | null
          inserted_by: string | null
          jersey_number: number | null
          match_id: string | null
          notes: string | null
          player_id: string
          quantity: number
          rule_key: string
          season: string
          season_id: string | null
          training_id: string | null
          week: number
        }
        Insert: {
          created_at?: string
          crew_id?: string
          id?: string
          inserted_at?: string | null
          inserted_by?: string | null
          jersey_number?: number | null
          match_id?: string | null
          notes?: string | null
          player_id: string
          quantity?: number
          rule_key: string
          season?: string
          season_id?: string | null
          training_id?: string | null
          week: number
        }
        Update: {
          created_at?: string
          crew_id?: string
          id?: string
          inserted_at?: string | null
          inserted_by?: string | null
          jersey_number?: number | null
          match_id?: string | null
          notes?: string | null
          player_id?: string
          quantity?: number
          rule_key?: string
          season?: string
          season_id?: string | null
          training_id?: string | null
          week?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_events_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_scores"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "weekly_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_events_rule_key_fkey"
            columns: ["crew_id", "rule_key"]
            isOneToOne: false
            referencedRelation: "scoring_rules"
            referencedColumns: ["crew_id", "key"]
          },
          {
            foreignKeyName: "weekly_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      zaghetti_history: {
        Row: {
          created_at: string
          delta: number
          id: string
          month: number
          new_value: number
          old_value: number
          player_id: string
          season: string
          season_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          month: number
          new_value: number
          old_value: number
          player_id: string
          season?: string
          season_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          month?: number
          new_value?: number
          old_value?: number
          player_id?: string
          season?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zaghetti_history_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      coach_scores: {
        Row: {
          coach_id: string | null
          total_points: number | null
        }
        Relationships: []
      }
      my_crew_roles: {
        Row: {
          role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
      player_event_log: {
        Row: {
          action_id: string | null
          category: string | null
          event_date: string | null
          event_key: string | null
          event_label: string | null
          full_name: string | null
          id: string | null
          is_malus: boolean | null
          player_id: string | null
          points: number | null
          role: string | null
          score_type: string | null
          season_id: string | null
          source: string | null
          week: number | null
        }
        Relationships: []
      }
      player_scores: {
        Row: {
          player_id: string | null
          total_points: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_can_manage_category: {
        Args: { _category: string }
        Returns: boolean
      }
      assign_admin_role: { Args: { user_id_param: string }; Returns: undefined }
      bootstrap_first_admin: { Args: never; Returns: boolean }
      create_crew_as_admin: {
        Args: {
          _logo_url?: string
          _name: string
          _primary_color?: string
          _slug: string
          _sport_id: string
        }
        Returns: {
          new_crew_id: string
          new_invite_code: string
        }[]
      }
      crew_id_from_slug: { Args: { _slug: string }; Returns: string }
      current_crew_id: { Args: never; Returns: string }
      current_crew_slug: { Args: never; Returns: string }
      generate_crew_invite_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_crew: {
        Args: {
          _crew_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      join_crew_by_invite: { Args: { _code: string }; Returns: string }
      notify_event_trigger: { Args: { _event: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "manager" | "super_admin" | "team_manager"
      mandatory_duration: "1_week" | "2_weeks" | "1_month"
      notification_template_type: "recurring" | "one_time" | "event_triggered"
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
      app_role: ["admin", "manager", "super_admin", "team_manager"],
      mandatory_duration: ["1_week", "2_weeks", "1_month"],
      notification_template_type: ["recurring", "one_time", "event_triggered"],
    },
  },
} as const
