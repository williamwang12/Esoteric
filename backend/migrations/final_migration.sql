--
-- PostgreSQL database dump
--

-- Dumped from database version 14.18 (Homebrew)
-- Dumped by pg_dump version 16.9 (Homebrew)


--
--

-- *not* creating schema, since initdb creates it



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;





--
-- Name: account_verification_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_verification_requests (
    id integer NOT NULL,
    user_id integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp without time zone,
    reviewed_by integer,
    admin_notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: account_verification_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.account_verification_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: account_verification_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.account_verification_requests_id_seq OWNED BY public.account_verification_requests.id;


--
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_size integer,
    category character varying(100) NOT NULL,
    upload_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    docusign_envelope_id character varying(255),
    docusign_status character varying(50)
);



--
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
--

CREATE TABLE public.loan_accounts (
    id integer NOT NULL,
    user_id integer,
    account_number character varying(50) NOT NULL,
    principal_amount numeric(15,2) NOT NULL,
    current_balance numeric(15,2) NOT NULL,
    monthly_rate numeric(5,4) DEFAULT 0.01,
    total_bonuses numeric(15,2) DEFAULT 0.00,
    total_withdrawals numeric(15,2) DEFAULT 0.00,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
--

CREATE SEQUENCE public.loan_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.loan_accounts_id_seq OWNED BY public.loan_accounts.id;


--
--

CREATE TABLE public.loan_transactions (
    id integer NOT NULL,
    loan_account_id integer,
    amount numeric(15,2) NOT NULL,
    transaction_type character varying(50) NOT NULL,
    bonus_percentage numeric(5,4),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reference_id character varying(255),
    transaction_date timestamp without time zone NOT NULL
);



--
--

CREATE SEQUENCE public.loan_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.loan_transactions_id_seq OWNED BY public.loan_transactions.id;


--
-- Name: meeting_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meeting_requests (
    id integer NOT NULL,
    user_id integer,
    purpose text NOT NULL,
    preferred_date date NOT NULL,
    preferred_time time without time zone NOT NULL,
    meeting_type character varying(20) DEFAULT 'video'::character varying,
    urgency character varying(20) DEFAULT 'normal'::character varying,
    topics text,
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying,
    scheduled_date date,
    scheduled_time time without time zone,
    meeting_link text,
    admin_notes text,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone_number character varying(50),
    location text,
    CONSTRAINT meeting_requests_meeting_type_check CHECK (((meeting_type)::text = ANY ((ARRAY['video'::character varying, 'phone'::character varying, 'in_person'::character varying])::text[]))),
    CONSTRAINT meeting_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'scheduled'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT meeting_requests_urgency_check CHECK (((urgency)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);



--
-- Name: meeting_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.meeting_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: meeting_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.meeting_requests_id_seq OWNED BY public.meeting_requests.id;


--
--

CREATE TABLE public.monthly_balances (
    id integer NOT NULL,
    loan_account_id integer NOT NULL,
    month_end_date date NOT NULL,
    ending_balance numeric(15,2) NOT NULL,
    monthly_growth numeric(15,2) DEFAULT 0,
    total_deposits numeric(15,2) DEFAULT 0,
    total_withdrawals numeric(15,2) DEFAULT 0,
    total_bonuses numeric(15,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
--

CREATE SEQUENCE public.monthly_balances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.monthly_balances_id_seq OWNED BY public.monthly_balances.id;


--
--

CREATE TABLE public.payment_schedule (
    id integer NOT NULL,
    loan_account_id integer,
    payment_date date NOT NULL,
    base_amount numeric(15,2) NOT NULL,
    bonus_amount numeric(15,2) DEFAULT 0.00,
    total_amount numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
--

CREATE SEQUENCE public.payment_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.payment_schedule_id_seq OWNED BY public.payment_schedule.id;


--
--

CREATE TABLE public.user_2fa (
    id integer NOT NULL,
    user_id integer,
    secret character varying(255) NOT NULL,
    is_enabled boolean DEFAULT false,
    backup_codes text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    qr_code_shown_at timestamp without time zone,
    last_used timestamp without time zone
);



--
--

CREATE TABLE public.user_2fa_attempts (
    id integer NOT NULL,
    user_id integer,
    ip_address inet,
    success boolean DEFAULT false,
    token_used character varying(10),
    attempted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
--

CREATE SEQUENCE public.user_2fa_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.user_2fa_attempts_id_seq OWNED BY public.user_2fa_attempts.id;


--
--

CREATE SEQUENCE public.user_2fa_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.user_2fa_id_seq OWNED BY public.user_2fa.id;


--
--

CREATE TABLE public.user_sessions (
    id integer NOT NULL,
    user_id integer,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_2fa_complete boolean DEFAULT false,
    ip_address inet,
    user_agent text
);



--
--

CREATE SEQUENCE public.user_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    role character varying(20) DEFAULT 'user'::character varying,
    requires_2fa boolean DEFAULT false,
    last_login timestamp without time zone,
    email_verified boolean DEFAULT false,
    email_verification_token character varying(255),
    email_verification_expires_at timestamp without time zone,
    account_verified boolean DEFAULT false,
    verified_by_admin integer,
    verified_at timestamp without time zone,
    temp_password character varying(255)
);



--
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Set DEFAULT values for auto-incrementing ID columns
--

ALTER TABLE ONLY public.account_verification_requests ALTER COLUMN id SET DEFAULT nextval('public.account_verification_requests_id_seq'::regclass);
ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);
ALTER TABLE ONLY public.loan_accounts ALTER COLUMN id SET DEFAULT nextval('public.loan_accounts_id_seq'::regclass);
ALTER TABLE ONLY public.loan_transactions ALTER COLUMN id SET DEFAULT nextval('public.loan_transactions_id_seq'::regclass);
ALTER TABLE ONLY public.meeting_requests ALTER COLUMN id SET DEFAULT nextval('public.meeting_requests_id_seq'::regclass);
ALTER TABLE ONLY public.monthly_balances ALTER COLUMN id SET DEFAULT nextval('public.monthly_balances_id_seq'::regclass);
ALTER TABLE ONLY public.payment_schedule ALTER COLUMN id SET DEFAULT nextval('public.payment_schedule_id_seq'::regclass);
ALTER TABLE ONLY public.user_2fa ALTER COLUMN id SET DEFAULT nextval('public.user_2fa_id_seq'::regclass);
ALTER TABLE ONLY public.user_2fa_attempts ALTER COLUMN id SET DEFAULT nextval('public.user_2fa_attempts_id_seq'::regclass);
ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.withdrawal_requests ALTER COLUMN id SET DEFAULT nextval('public.withdrawal_requests_id_seq'::regclass);
ALTER TABLE ONLY public.yield_deposits ALTER COLUMN id SET DEFAULT nextval('public.yield_deposits_id_seq'::regclass);
ALTER TABLE ONLY public.yield_payouts ALTER COLUMN id SET DEFAULT nextval('public.yield_payouts_id_seq'::regclass);

--
-- Name: withdrawal_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.withdrawal_requests (
    id integer NOT NULL,
    user_id integer,
    loan_account_id integer,
    amount numeric(15,2) NOT NULL,
    reason text NOT NULL,
    urgency character varying(20) DEFAULT 'normal'::character varying,
    notes text,
    status character varying(20) DEFAULT 'pending'::character varying,
    admin_notes text,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    completed_by integer,
    CONSTRAINT withdrawal_requests_status_check CHECK (((status)::text = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'processed'::text, 'completed'::text]))),
    CONSTRAINT withdrawal_requests_urgency_check CHECK (((urgency)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);



--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.withdrawal_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
-- Name: withdrawal_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.withdrawal_requests_id_seq OWNED BY public.withdrawal_requests.id;


--
--

CREATE TABLE public.yield_deposits (
    id integer NOT NULL,
    user_id integer NOT NULL,
    principal_amount numeric(15,2) NOT NULL,
    annual_yield_rate numeric(5,4) DEFAULT 0.12 NOT NULL,
    start_date date NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_payout_date date,
    total_paid_out numeric(15,2) DEFAULT 0.00,
    created_by integer,
    notes text,
    CONSTRAINT yield_deposits_principal_amount_check CHECK (((((status)::text = 'active'::text) AND (principal_amount > (0)::numeric)) OR (((status)::text = ANY ((ARRAY['inactive'::character varying, 'completed'::character varying])::text[])) AND (principal_amount >= (0)::numeric)))),
    CONSTRAINT yield_deposits_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'completed'::character varying])::text[])))
);



--
--

CREATE SEQUENCE public.yield_deposits_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.yield_deposits_id_seq OWNED BY public.yield_deposits.id;


--
--

CREATE TABLE public.yield_payouts (
    id integer NOT NULL,
    deposit_id integer NOT NULL,
    amount numeric(15,2) NOT NULL,
    payout_date date NOT NULL,
    transaction_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_by integer,
    notes text,
    CONSTRAINT yield_payouts_amount_check CHECK ((amount >= (0)::numeric))
);


CREATE TABLE IF NOT EXISTS deposit_principal_adjustments (
    id SERIAL PRIMARY KEY,
    deposit_id INTEGER NOT NULL REFERENCES yield_deposits(id) ON DELETE CASCADE,
    reduction_amount DECIMAL(15, 2) NOT NULL CHECK (reduction_amount > 0),
    adjustment_date DATE NOT NULL,
    effective_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deposit_adjustments_deposit_id ON deposit_principal_adjustments(deposit_id);
CREATE INDEX idx_deposit_adjustments_effective_date ON deposit_principal_adjustments(effective_date);

--
--

CREATE SEQUENCE public.yield_payouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



--
--

ALTER SEQUENCE public.yield_payouts_id_seq OWNED BY public.yield_payouts.id;


--
-- Name: account_verification_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--



--
--



--
--



--
--



--
-- Name: meeting_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--



--
--



--
--



--
--



--
--



--
--



--
--



--
-- Name: withdrawal_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--



--
--



--
--



--
-- Name: account_verification_requests account_verification_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_verification_requests
    ADD CONSTRAINT account_verification_requests_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.loan_accounts
    ADD CONSTRAINT loan_accounts_account_number_key UNIQUE (account_number);


--
--

ALTER TABLE ONLY public.loan_accounts
    ADD CONSTRAINT loan_accounts_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.loan_transactions
    ADD CONSTRAINT loan_transactions_pkey PRIMARY KEY (id);


--
-- Name: meeting_requests meeting_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_requests
    ADD CONSTRAINT meeting_requests_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.monthly_balances
    ADD CONSTRAINT monthly_balances_loan_account_id_month_end_date_key UNIQUE (loan_account_id, month_end_date);


--
--

ALTER TABLE ONLY public.monthly_balances
    ADD CONSTRAINT monthly_balances_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.payment_schedule
    ADD CONSTRAINT payment_schedule_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.user_2fa_attempts
    ADD CONSTRAINT user_2fa_attempts_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.user_2fa
    ADD CONSTRAINT user_2fa_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: withdrawal_requests withdrawal_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.yield_deposits
    ADD CONSTRAINT yield_deposits_pkey PRIMARY KEY (id);


--
--

ALTER TABLE ONLY public.yield_payouts
    ADD CONSTRAINT yield_payouts_pkey PRIMARY KEY (id);


--
-- Name: idx_account_verification_requests_requested_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_account_verification_requests_requested_at ON public.account_verification_requests USING btree (requested_at);


--
-- Name: idx_account_verification_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_account_verification_requests_status ON public.account_verification_requests USING btree (status);


--
-- Name: idx_account_verification_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_account_verification_requests_user_id ON public.account_verification_requests USING btree (user_id);


--
--

CREATE INDEX idx_documents_user_id ON public.documents USING btree (user_id);


--
--

CREATE INDEX idx_loan_accounts_user_id ON public.loan_accounts USING btree (user_id);


--
--

CREATE INDEX idx_loan_transactions_account_id ON public.loan_transactions USING btree (loan_account_id);


--
-- Name: idx_meeting_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_requests_created_at ON public.meeting_requests USING btree (created_at);


--
-- Name: idx_meeting_requests_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_requests_location ON public.meeting_requests USING btree (location);


--
-- Name: idx_meeting_requests_phone_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_requests_phone_number ON public.meeting_requests USING btree (phone_number);


--
-- Name: idx_meeting_requests_preferred_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_requests_preferred_date ON public.meeting_requests USING btree (preferred_date);


--
-- Name: idx_meeting_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_requests_status ON public.meeting_requests USING btree (status);


--
-- Name: idx_meeting_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_meeting_requests_user_id ON public.meeting_requests USING btree (user_id);


--
--

CREATE INDEX idx_monthly_balances_loan_month ON public.monthly_balances USING btree (loan_account_id, month_end_date);


--
--

CREATE INDEX idx_payment_schedule_account_id ON public.payment_schedule USING btree (loan_account_id);


--
--

CREATE INDEX idx_user_2fa_attempts_attempted_at ON public.user_2fa_attempts USING btree (attempted_at);


--
--

CREATE INDEX idx_user_2fa_attempts_user_id ON public.user_2fa_attempts USING btree (user_id);


--
--

CREATE INDEX idx_user_2fa_user_id ON public.user_2fa USING btree (user_id);


--
--

CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions USING btree (expires_at);


--
--

CREATE INDEX idx_user_sessions_token_hash ON public.user_sessions USING btree (token_hash);


--
--

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_withdrawal_requests_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_withdrawal_requests_created_at ON public.withdrawal_requests USING btree (created_at);


--
-- Name: idx_withdrawal_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_withdrawal_requests_status ON public.withdrawal_requests USING btree (status);


--
-- Name: idx_withdrawal_requests_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_withdrawal_requests_user_id ON public.withdrawal_requests USING btree (user_id);


--
--

CREATE INDEX idx_yield_deposits_last_payout ON public.yield_deposits USING btree (last_payout_date);


--
--

CREATE INDEX idx_yield_deposits_start_date ON public.yield_deposits USING btree (start_date);


--
--

CREATE INDEX idx_yield_deposits_status ON public.yield_deposits USING btree (status);


--
--

CREATE INDEX idx_yield_deposits_user_id ON public.yield_deposits USING btree (user_id);


--
--

CREATE INDEX idx_yield_payouts_deposit_id ON public.yield_payouts USING btree (deposit_id);


--
--

CREATE INDEX idx_yield_payouts_payout_date ON public.yield_payouts USING btree (payout_date);


--
--

CREATE INDEX idx_yield_payouts_transaction_id ON public.yield_payouts USING btree (transaction_id);


--
-- Name: meeting_requests update_meeting_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_meeting_requests_updated_at BEFORE UPDATE ON public.meeting_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: withdrawal_requests update_withdrawal_requests_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: account_verification_requests account_verification_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_verification_requests
    ADD CONSTRAINT account_verification_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: account_verification_requests account_verification_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_verification_requests
    ADD CONSTRAINT account_verification_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
--

ALTER TABLE ONLY public.loan_accounts
    ADD CONSTRAINT loan_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
--

ALTER TABLE ONLY public.loan_transactions
    ADD CONSTRAINT loan_transactions_loan_account_id_fkey FOREIGN KEY (loan_account_id) REFERENCES public.loan_accounts(id);


--
-- Name: meeting_requests meeting_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_requests
    ADD CONSTRAINT meeting_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: meeting_requests meeting_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meeting_requests
    ADD CONSTRAINT meeting_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.monthly_balances
    ADD CONSTRAINT monthly_balances_loan_account_id_fkey FOREIGN KEY (loan_account_id) REFERENCES public.loan_accounts(id);


--
--

ALTER TABLE ONLY public.payment_schedule
    ADD CONSTRAINT payment_schedule_loan_account_id_fkey FOREIGN KEY (loan_account_id) REFERENCES public.loan_accounts(id);


--
--

ALTER TABLE ONLY public.user_2fa_attempts
    ADD CONSTRAINT user_2fa_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.user_2fa
    ADD CONSTRAINT user_2fa_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_verified_by_admin_fkey FOREIGN KEY (verified_by_admin) REFERENCES public.users(id);


--
-- Name: withdrawal_requests withdrawal_requests_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id);


--
-- Name: withdrawal_requests withdrawal_requests_loan_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_loan_account_id_fkey FOREIGN KEY (loan_account_id) REFERENCES public.loan_accounts(id) ON DELETE CASCADE;


--
-- Name: withdrawal_requests withdrawal_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: withdrawal_requests withdrawal_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.withdrawal_requests
    ADD CONSTRAINT withdrawal_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.yield_deposits
    ADD CONSTRAINT yield_deposits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
--

ALTER TABLE ONLY public.yield_deposits
    ADD CONSTRAINT yield_deposits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
--

ALTER TABLE ONLY public.yield_payouts
    ADD CONSTRAINT yield_payouts_deposit_id_fkey FOREIGN KEY (deposit_id) REFERENCES public.yield_deposits(id) ON DELETE CASCADE;


--
--

ALTER TABLE ONLY public.yield_payouts
    ADD CONSTRAINT yield_payouts_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id);


--
--

ALTER TABLE ONLY public.yield_payouts
    ADD CONSTRAINT yield_payouts_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.loan_transactions(id);


--
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

