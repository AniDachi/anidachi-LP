export type ContactStatus =
  | "active"
  | "replied"
  | "booked"
  | "closed"
  | "dnc";

export type Contact = {
  id: string;
  email: string;
  company: string;
  first_name: string;
  segments: string[];
  notes: string;
  status: ContactStatus;
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Touch = {
  id: string;
  contact_id: string;
  sent_at: string;
  summary: string;
};
