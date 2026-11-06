export type Database = {
  public: {
    Tables: {
      game_catalog: {
        Row: {
          id: string;
          game_name: string;
          platform: "android" | "ios";
          minimum_os_version: string | null;
          recommended_ram_gb: number | null;
          minimum_opengles_version: string | null;
          processor_requirement: string | null;
          graphics_requirement: string | null;
          source_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_name: string;
          platform: "android" | "ios";
          minimum_os_version?: string | null;
          recommended_ram_gb?: number | null;
          minimum_opengles_version?: string | null;
          processor_requirement?: string | null;
          graphics_requirement?: string | null;
          source_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          game_name?: string;
          platform?: "android" | "ios";
          minimum_os_version?: string | null;
          recommended_ram_gb?: number | null;
          minimum_opengles_version?: string | null;
          processor_requirement?: string | null;
          graphics_requirement?: string | null;
          source_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      game_requests: {
        Row: {
          id: string;
          user_id: string;
          game_name: string;
          platform: "android" | "ios";
          minimum_os_version: string | null;
          recommended_ram_gb: number | null;
          minimum_opengles_version: string | null;
          processor_requirement: string | null;
          graphics_requirement: string | null;
          source_url: string | null;
          status: "pending" | "approved" | "rejected";
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_name: string;
          platform: "android" | "ios";
          minimum_os_version?: string | null;
          recommended_ram_gb?: number | null;
          minimum_opengles_version?: string | null;
          processor_requirement?: string | null;
          graphics_requirement?: string | null;
          source_url?: string | null;
          status?: "pending";
          admin_note?: never;
          reviewed_by?: never;
          reviewed_at?: never;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      admin_users: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      approve_game_request: {
        Args: { p_request_id: string };
        Returns: string;
      };
      reject_game_request: {
        Args: { p_request_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type GameRecord = Database["public"]["Tables"]["game_catalog"]["Row"];
export type GameRequest = Database["public"]["Tables"]["game_requests"]["Row"];
