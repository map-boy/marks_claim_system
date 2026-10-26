export type Lang = 'en' | 'ar';
export type Intake = 'september' | 'january' | 'june';
export type Problem = 'cat2' | 'fat' | 'both';
export type Status = 'new' | 'in_review' | 'resolved' | 'rejected';

export interface ModuleRow {
  id: string;
  name: string;
  lecturer: string | null;
  is_english: boolean;
}

export interface Submission {
  id: string;
  ref_no: number;
  created_at: string;
  language: string;
  full_name: string;
  roll_number: string;
  whatsapp: string;
  intake: Intake;
  module_name: string;
  lecturer: string;
  problem: Problem;
  note: string | null;
  status: Status;
  admin_note: string | null;
}