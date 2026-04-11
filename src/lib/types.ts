export interface Event {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  state: string;
  country: string;
  venue: string | null;
  event_date: string | null;
  event_time: string | null;
  end_date: string | null;
  organizer: string | null;
  registration_link: string | null;
  source_url: string | null;
  event_type: string;
  tags: string[];
  is_online: boolean;
  confidence_score: number | null;
  dedup_hash: string | null;
  status: string;
  source_platform: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventFilters {
  search: string;
  state: string;
  eventType: string;
  isOnline: string;
  dateFrom: string;
  dateTo: string;
}
