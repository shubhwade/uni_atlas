PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,
  google_id TEXT,
  avatar TEXT,
  email_verified INTEGER DEFAULT 0,
  onboarding_done INTEGER DEFAULT 0,
  subscription_tier TEXT DEFAULT 'free',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE REFERENCES users(id),
  tenth_board TEXT, tenth_percent REAL,
  twelfth_board TEXT, twelfth_stream TEXT, twelfth_percent REAL,
  bachelors_university TEXT, bachelors_university_tier TEXT,
  bachelors_field TEXT, bachelors_gpa REAL, bachelors_gpa_scale REAL DEFAULT 10,
  bachelors_gpa_percent REAL, bachelors_graduation_year INTEGER,
  currently_pursuing INTEGER DEFAULT 0, current_year INTEGER,
  gre_total INTEGER, gre_verbal INTEGER, gre_quant INTEGER, gre_awa REAL,
  gmat_total INTEGER, gmat_verbal INTEGER, gmat_quant INTEGER,
  ielts_overall REAL, ielts_listening REAL, ielts_reading REAL,
  ielts_writing REAL, ielts_speaking REAL,
  toefl_total INTEGER, toefl_reading INTEGER, toefl_listening INTEGER,
  toefl_speaking INTEGER, toefl_writing INTEGER,
  sat_total INTEGER, act_total INTEGER, duolingo_score INTEGER,
  total_work_exp_months INTEGER DEFAULT 0,
  current_employer TEXT, current_role TEXT, current_ctc REAL,
  work_exp_details TEXT,
  research_papers INTEGER DEFAULT 0, patents INTEGER DEFAULT 0,
  open_source_contribs INTEGER DEFAULT 0, kaggle_rank TEXT,
  github_url TEXT, leetcode_rating INTEGER, codeforces_rating INTEGER,
  projects_count INTEGER DEFAULT 0,
  has_leadership_exp INTEGER DEFAULT 0, volunteering_hours INTEGER DEFAULT 0,
  awards_and_honors TEXT,
  family_income_lpa REAL, savings_lakhs REAL,
  property_value_lakhs REAL, property_type TEXT, property_city TEXT,
  property_lien_free INTEGER, existing_emis_monthly REAL, cibil_score INTEGER,
  has_co_applicant INTEGER DEFAULT 1, co_applicant_income_lpa REAL, co_applicant_relation TEXT,
  target_degree TEXT, target_fields TEXT, target_countries TEXT,
  target_year INTEGER, target_semester TEXT,
  budget_total_lakhs REAL, willing_for_loan INTEGER DEFAULT 1, max_loan_lakhs REAL,
  overall_profile_score REAL, academic_score REAL, test_score REAL,
  work_exp_score REAL, research_score REAL, extracurric_score REAL,
  financial_health_score REAL, last_analyzed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resumes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  file_name TEXT, file_url TEXT, file_size INTEGER,
  uploaded_at TEXT DEFAULT (datetime('now')),
  is_primary INTEGER DEFAULT 0,
  parsed_data TEXT,
  extracted_name TEXT, extracted_email TEXT, extracted_phone TEXT,
  extracted_skills TEXT, extracted_gpa REAL, extracted_degree TEXT,
  extracted_university TEXT, extracted_work_years REAL,
  ai_analysis TEXT, ai_score_overall REAL, ai_score_academic REAL,
  ai_score_skills REAL, ai_score_presentation REAL, ai_feedback_summary TEXT,
  ai_analyzed_at TEXT, analysis_status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS portfolios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  url TEXT, screenshot_url TEXT, crawled_content TEXT,
  tech_stack_found TEXT, projects_found TEXT,
  design_score REAL, technical_score REAL, content_score REAL, overall_score REAL,
  ai_summary TEXT, improvement_tips TEXT,
  crawl_status TEXT DEFAULT 'pending', crawled_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT, continent TEXT, currency TEXT, currency_symbol TEXT, flag_emoji TEXT,
  exchange_rate_to_inr REAL, exchange_rate_updated_at TEXT,
  student_visa_name TEXT, student_visa_fee_local REAL, student_visa_fee_inr REAL,
  visa_processing_days_min INTEGER, visa_processing_days_max INTEGER,
  visa_rejection_rate_percent REAL, visa_renewal_required INTEGER,
  dependent_visa_allowed INTEGER, visa_application_url TEXT, visa_requirements TEXT,
  work_hrs_week_during_study INTEGER, work_hrs_week_during_holiday INTEGER,
  work_starts_after TEXT, post_study_work_name TEXT, post_study_work_months INTEGER,
  post_study_work_extension TEXT, campus_jobs_allowed INTEGER,
  off_campus_jobs_allowed INTEGER,
  freelance_allowed INTEGER DEFAULT 0,
  avg_rent_shared_1bhk REAL, avg_rent_shared_2bhk REAL, avg_rent_solo_1bhk REAL,
  avg_groceries_monthly REAL, avg_transport_monthly REAL,
  avg_health_insurance_monthly REAL, avg_phone_internet_monthly REAL,
  avg_meal_restaurant REAL, avg_coffee REAL, avg_cinema_ticket REAL,
  living_cost_updated_at TEXT, numbeo_city TEXT, numbeo_city_budget TEXT,
  avg_min_wage_hourly REAL, avg_grad_salary_local REAL,
  avg_salary_ms REAL, avg_salary_mba REAL, avg_salary_engineering REAL,
  avg_salary_data_science REAL, unemployment_rate_percent REAL,
  tech_job_market_rating TEXT, top_cities_for_jobs TEXT, top_companies_hiring TEXT,
  healthcare_system_type TEXT, student_healthcare_free INTEGER,
  mandatory_health_insurance INTEGER, avg_health_insurance_annual REAL,
  emergency_room_cost REAL, gp_visit_cost REAL, healthcare_notes TEXT,
  recommended_banks TEXT, banking_setup_docs TEXT, remittance_services TEXT,
  tax_treaty_with_india INTEGER, dtaa_active INTEGER, income_tax_rates TEXT,
  tax_free_threshold_local REAL, tax_free_threshold_inr REAL,
  section_80e_applicable INTEGER, tax_filing_required INTEGER,
  tax_filing_deadline TEXT, tax_filing_notes TEXT,
  sim_card_providers TEXT, transport_passes TEXT, grocery_stores TEXT,
  indian_grocery_tip TEXT, indian_restaurants TEXT, indian_student_association INTEGER,
  indian_embassy_url TEXT, emergency_number TEXT, police_number TEXT,
  safety_rating_out_of_10 REAL, safety_notes TEXT, racism_incidents_rating TEXT,
  indian_community_size TEXT, weather_summary TEXT, climate_type TEXT,
  driving_license_exchange INTEGER, public_transport_quality TEXT, internet_quality TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS universities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id INTEGER REFERENCES countries(id),
  name TEXT, short_name TEXT, slug TEXT UNIQUE, city TEXT, state_province TEXT,
  website TEXT, logo_url TEXT, cover_image_url TEXT, maps_url TEXT,
  college_scorecard_id INTEGER, open_alex_id TEXT,
  qs_ranking_world INTEGER, qs_ranking_country INTEGER, qs_ranking_subject TEXT,
  times_ranking_world INTEGER, us_news_ranking_world INTEGER, arwu_ranking INTEGER,
  tier_category TEXT, rankings_updated_at TEXT,
  founded_year INTEGER, university_type TEXT, affiliation TEXT, campus_type TEXT,
  campus_size_acres REAL, number_of_faculty INTEGER,
  total_students INTEGER, undergrad_students INTEGER, grad_students INTEGER,
  international_students INTEGER, international_percent REAL,
  indian_students_estimate INTEGER, indian_student_assoc_name TEXT, indian_student_assoc_url TEXT,
  semester_system TEXT, fall_start TEXT, spring_start TEXT,
  fall_application_open TEXT, fall_deadline_early TEXT, fall_deadline_regular TEXT,
  fall_deadline_rolling INTEGER DEFAULT 0,
  spring_application_open TEXT, spring_deadline TEXT, spring_available INTEGER DEFAULT 0,
  research_output_score REAL, citation_score REAL, h_index REAL,
  top_research_areas TEXT, research_centers TEXT,
  scholarships_budget_annual REAL, avg_scholarship_amount REAL,
  percent_receiving_aid REAL, ta_ra_positions_available INTEGER DEFAULT 0,
  overall_placement_rate REAL, top_3_employers_overall TEXT,
  library_rating REAL, gym_facilities INTEGER, housing_available INTEGER,
  housing_cost_local_monthly REAL, campus_dining_available INTEGER,
  avg_student_rating_out_of_5 REAL, rmp_rating REAL,
  data_source TEXT DEFAULT 'manual', last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  university_id INTEGER REFERENCES universities(id),
  name TEXT, short_name TEXT, slug TEXT, department TEXT, school TEXT,
  degree TEXT, cip_code TEXT, specializations TEXT, tracks TEXT,
  is_online INTEGER DEFAULT 0, is_hybrid INTEGER DEFAULT 0,
  duration_months INTEGER, credits_total INTEGER, thesis_option INTEGER DEFAULT 0,
  course_work_option INTEGER DEFAULT 1, dissertation_required INTEGER DEFAULT 0,
  tuition_per_year REAL, tuition_total REAL, application_fee REAL DEFAULT 0,
  technology_fee REAL, health_fee REAL, activity_fee REAL,
  total_program_fees_local REAL,
  coa_tuition_local REAL, coa_living_local REAL, coa_books_local REAL,
  coa_personal_local REAL, coa_transport_local REAL, coa_health_insurance_local REAL,
  coa_total_local REAL, coa_total_inr REAL, coa_updated_at TEXT,
  min_gpa_forty REAL, min_gpa_percent REAL, preferred_gpa_forty REAL,
  gre_required INTEGER DEFAULT 0, gre_waiver INTEGER DEFAULT 0,
  min_gre_total INTEGER, min_gre_verbal INTEGER, min_gre_quant INTEGER, min_gre_awa REAL,
  avg_gre_accepted_total INTEGER, avg_gre_accepted_quant INTEGER,
  gmat_accepted INTEGER DEFAULT 0, gmat_required INTEGER DEFAULT 0,
  min_gmat INTEGER, avg_gmat_accepted INTEGER,
  ielts_required INTEGER DEFAULT 1, min_ielts REAL, min_ielts_per_band REAL,
  toefl_required INTEGER DEFAULT 1, min_toefl INTEGER,
  duolingo_accepted INTEGER DEFAULT 0, min_duolingo INTEGER,
  work_exp_required INTEGER DEFAULT 0, min_work_exp_years REAL, preferred_work_exp_years REAL,
  loa_required INTEGER DEFAULT 1, loa_word_limit INTEGER, loa_prompts TEXT,
  reco_letters_required INTEGER DEFAULT 3, reco_letter_type TEXT,
  sop_required INTEGER DEFAULT 1, sop_word_limit INTEGER,
  portfolio_required INTEGER DEFAULT 0, interview_required INTEGER DEFAULT 0,
  interview_type TEXT, cv_required INTEGER DEFAULT 1, transcripts_required INTEGER DEFAULT 1,
  overall_acceptance_rate REAL, international_acceptance_rate REAL,
  indian_applicant_success_rate REAL, avg_gpa_accepted REAL,
  total_applicants_last_year INTEGER, offers_last_year INTEGER, enrolled_last_year INTEGER,
  placement_rate_percent REAL, placement_within_3_months REAL,
  avg_starting_salary_local REAL, median_starting_salary_local REAL,
  p25_salary_local REAL, p75_salary_local REAL, avg_starting_salary_inr REAL,
  top_5_employers TEXT, top_5_industries TEXT, top_5_roles TEXT,
  internship_rate REAL, internship_avg_compensation REAL,
  cpt_available INTEGER DEFAULT 0, cpt_from_semester INTEGER,
  opt_available INTEGER DEFAULT 0, stem_designated INTEGER DEFAULT 0, stem_cip_code TEXT,
  ta_positions_available INTEGER, ra_positions_available INTEGER,
  avg_ta_stipend_local REAL, avg_ra_stipend_local REAL,
  tuition_waiver_with_assistantship INTEGER DEFAULT 0,
  fellowships_internal TEXT, application_portal_url TEXT, program_page_url TEXT,
  contact_email TEXT, data_source TEXT DEFAULT 'scraped', last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(university_id, slug)
);

CREATE TABLE IF NOT EXISTS crowdsourced_data_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER REFERENCES courses(id),
  submitted_by_user_id INTEGER,
  gpa_forty REAL, gpa_percent REAL,
  gre_total INTEGER, gre_verbal INTEGER, gre_quant INTEGER,
  gmat_total INTEGER, ielts_score REAL, toefl_score INTEGER,
  work_exp_years REAL, bachelors_institution_tier TEXT, bachelors_field TEXT,
  has_research INTEGER DEFAULT 0, research_papers_count INTEGER,
  has_publications INTEGER DEFAULT 0, internships_count INTEGER, projects_count INTEGER,
  india_city TEXT, application_round TEXT, semester_applied TEXT,
  result TEXT, result_date TEXT, admit_with_scholarship INTEGER DEFAULT 0,
  scholarship_amount_local REAL, scholarship_type TEXT,
  took_loan INTEGER, loan_amount_lakhs REAL, loan_bank_name TEXT,
  loan_interest_rate REAL, collateral_used INTEGER, collateral_type TEXT,
  got_internship INTEGER, internship_company TEXT, internship_compensation_local REAL,
  got_job_offer INTEGER, employed_within_3_months INTEGER,
  first_job_title TEXT, first_job_company TEXT, first_job_salary_local REAL,
  current_country_of_work TEXT, verified INTEGER DEFAULT 0,
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lenders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, short_name TEXT, type TEXT, logo_url TEXT, website_url TEXT,
  apply_url TEXT, contact_number TEXT, product_name TEXT, product_description TEXT,
  rate_min REAL, rate_max REAL, rate_type TEXT, benchmark_rate TEXT,
  spread_above_benchmark REAL, rate_reset_frequency TEXT,
  max_loan_lakhs_secured REAL, max_loan_lakhs_unsecured REAL DEFAULT 0,
  min_loan_lakhs REAL DEFAULT 1,
  processing_fee_percent REAL, processing_fee_flat REAL,
  processing_fee_min REAL, processing_fee_max REAL,
  prepayment_penalty_percent REAL DEFAULT 0, legal_fee REAL, stamp_duty INTEGER DEFAULT 1,
  collateral_mandatory INTEGER, max_loan_without_collateral REAL DEFAULT 0,
  margin_money_percent REAL DEFAULT 15, accepted_collateral_types TEXT,
  property_ltv REAL, fd_ltv REAL,
  coapplicant_required INTEGER DEFAULT 1, accepted_coapplicants TEXT,
  min_applicant_age INTEGER, max_applicant_age INTEGER,
  cibil_score_min INTEGER, cibil_score_preferred INTEGER,
  term_insurance_mandatory INTEGER DEFAULT 0, term_insurance_min_cover REAL,
  countries_supported TEXT, degrees_supported TEXT, courses_excluded TEXT,
  ranked_universities_only INTEGER DEFAULT 0,
  avg_sanction_days INTEGER, avg_disbursement_days INTEGER,
  online_application_available INTEGER DEFAULT 1, doorstep_service_available INTEGER DEFAULT 0,
  moratorium_course INTEGER DEFAULT 1, moratorium_post_grad INTEGER DEFAULT 6,
  simple_interest_during_moratorium INTEGER DEFAULT 1,
  special_features TEXT, watch_out_for TEXT,
  padho_pardes_scheme INTEGER DEFAULT 0, dr_ambedkar_scheme INTEGER DEFAULT 0,
  avg_user_rating REAL, total_user_reviews INTEGER DEFAULT 0,
  processing_speed_rating REAL, customer_service_rating REAL,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admit_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  course_id INTEGER REFERENCES courses(id),
  university_id INTEGER REFERENCES universities(id),
  profile_snapshot TEXT, resume_score_used REAL, portfolio_score_used REAL,
  admit_probability REAL, admit_category TEXT, confidence_score REAL,
  strength_factors TEXT, weakness_factors TEXT, missing_requirements TEXT,
  improvement_actions TEXT, total_cost_inr REAL, loan_required_inr REAL,
  financial_feasibility_score REAL, financial_risks TEXT,
  similar_admitted INTEGER DEFAULT 0, similar_rejected INTEGER DEFAULT 0,
  similar_data_points INTEGER DEFAULT 0, ai_narrative TEXT, checklist TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scholarships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, slug TEXT UNIQUE, provider TEXT, provider_type TEXT, provider_country TEXT,
  target_nationalities TEXT, target_countries TEXT, target_degrees TEXT,
  target_fields TEXT, target_gender TEXT DEFAULT 'all',
  target_caste TEXT, target_income_lpa_max REAL,
  min_gpa REAL, min_gre_score INTEGER, min_ielts REAL,
  amount_local REAL, amount_inr REAL, currency TEXT DEFAULT 'USD',
  covers_tuition INTEGER DEFAULT 0, covers_tuition_percent REAL,
  covers_living_stipend INTEGER DEFAULT 0, covers_living_amount REAL,
  covers_flights INTEGER DEFAULT 0, covers_health_insurance INTEGER DEFAULT 0,
  total_value_local REAL, total_value_inr REAL,
  renewable INTEGER DEFAULT 0, renewal_years INTEGER, renewal_conditions TEXT,
  application_url TEXT, deadline TEXT, deadline_month INTEGER, deadline_day INTEGER,
  is_rolling INTEGER DEFAULT 0, interview_required INTEGER DEFAULT 0,
  essay_required INTEGER DEFAULT 0, indians_received INTEGER, awards_per_year INTEGER,
  competition_level TEXT, description TEXT, eligibility_details TEXT,
  how_to_apply TEXT, tips TEXT, verified_at TEXT, last_checked_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scholarship_saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  scholarship_id INTEGER REFERENCES scholarships(id),
  saved_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, scholarship_id)
);

CREATE TABLE IF NOT EXISTS earning_resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id INTEGER REFERENCES countries(id),
  category TEXT, title TEXT, description TEXT,
  platforms TEXT, avg_hourly_local REAL, avg_hourly_inr REAL,
  avg_monthly_local REAL, avg_monthly_inr REAL, payment_frequency TEXT,
  visa_legal_status TEXT, hours_cap_per_week INTEGER,
  requires_ssn INTEGER DEFAULT 0, requires_sin INTEGER DEFAULT 0,
  requires_tfn INTEGER DEFAULT 0, requires_work_permit INTEGER DEFAULT 0,
  best_for_degrees TEXT, best_for_skills TEXT, best_for_year TEXT,
  difficulty_to_get TEXT, how_to_start TEXT, first_steps TEXT,
  income_tax_notes TEXT, tip_from_students TEXT, example_job_titles TEXT,
  avg_hours_per_week REAL, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budget_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  month INTEGER, year INTEGER, country_code TEXT, city_name TEXT,
  currency TEXT, exchange_rate_used REAL,
  part_time_income REAL DEFAULT 0, ta_ra_stipend REAL DEFAULT 0,
  freelance_income REAL DEFAULT 0, other_income REAL DEFAULT 0,
  rent REAL DEFAULT 0, groceries REAL DEFAULT 0, dining_out REAL DEFAULT 0,
  transport REAL DEFAULT 0, utilities REAL DEFAULT 0,
  phone_internet REAL DEFAULT 0, health_insurance REAL DEFAULT 0,
  medical_expenses REAL DEFAULT 0, entertainment REAL DEFAULT 0,
  clothing REAL DEFAULT 0, books REAL DEFAULT 0,
  travel_within_country REAL DEFAULT 0, travel_to_india REAL DEFAULT 0,
  remittance_to_india REAL DEFAULT 0, university_fees REAL DEFAULT 0,
  miscellaneous REAL DEFAULT 0, notes TEXT,
  total_income REAL DEFAULT 0, total_expense REAL DEFAULT 0, net_savings REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, month, year)
);

CREATE TABLE IF NOT EXISTS loan_trackers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  lender_name TEXT, product_name TEXT, principal_inr REAL, interest_rate REAL,
  rate_type TEXT DEFAULT 'floating', disbursed_date TEXT, first_emi_date TEXT,
  tenure_months INTEGER, collateral_type TEXT, collateral_value_inr REAL,
  emi_amount_monthly REAL, total_paid_so_far REAL DEFAULT 0,
  principal_repaid REAL DEFAULT 0, interest_paid_so_far REAL DEFAULT 0,
  prepaid_amount REAL DEFAULT 0, remaining_principal REAL,
  status TEXT DEFAULT 'sanctioned', missed_emis INTEGER DEFAULT 0,
  last_payment_date TEXT, notes TEXT,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emi_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_tracker_id INTEGER REFERENCES loan_trackers(id),
  due_date TEXT, paid_date TEXT, amount REAL,
  principal_part REAL, interest_part REAL, late_fee REAL DEFAULT 0,
  status TEXT
);

CREATE TABLE IF NOT EXISTS community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  category TEXT, country_code TEXT, university_slug TEXT, course_id INTEGER, city TEXT,
  title TEXT, content TEXT, structured_data TEXT,
  upvotes INTEGER DEFAULT 0, downvotes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0, views_count INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0, is_anonymous INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES community_posts(id),
  user_id INTEGER REFERENCES users(id),
  content TEXT, upvotes INTEGER DEFAULT 0, is_anonymous INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES community_posts(id),
  user_id INTEGER REFERENCES users(id),
  type TEXT, UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_universities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  university_id INTEGER REFERENCES universities(id),
  notes TEXT, priority TEXT DEFAULT 'medium',
  saved_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, university_id)
);

CREATE TABLE IF NOT EXISTS saved_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  course_id INTEGER REFERENCES courses(id),
  priority TEXT DEFAULT 'medium', notes TEXT,
  saved_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  type TEXT, title TEXT, body TEXT, action_url TEXT,
  is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  query TEXT, filters TEXT, result_count INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_shortlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE REFERENCES users(id),
  kanban_state TEXT, -- JSON blob of the kanban columns
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forex_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency_code TEXT UNIQUE, rate_to_inr REAL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country_id);
CREATE INDEX IF NOT EXISTS idx_universities_slug ON universities(slug);
CREATE INDEX IF NOT EXISTS idx_universities_qs ON universities(qs_ranking_world);
CREATE INDEX IF NOT EXISTS idx_courses_university ON courses(university_id);
CREATE INDEX IF NOT EXISTS idx_courses_degree ON courses(degree);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user ON admit_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_community_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_community_country ON community_posts(country_code);
CREATE INDEX IF NOT EXISTS idx_budget_user_year ON budget_logs(user_id, year);

