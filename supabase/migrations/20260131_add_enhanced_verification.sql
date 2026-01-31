-- Enhanced Fundi Verification Schema with Security Hardening

-- Verification attempt status enum
CREATE TYPE public.verification_attempt_status AS ENUM ('pending_review', 'approved', 'rejected', 'flagged_fraud');

-- Verification step enum
CREATE TYPE public.verification_step AS ENUM ('name_match', 'id_verification', 'selfie_liveness', 'location_verification', 'all_complete');

-- Verification data table (immutable after approval)
CREATE TABLE public.fundi_verification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    -- Submitted data
    submitted_full_name TEXT NOT NULL,
    submitted_email TEXT NOT NULL,
    submitted_phone TEXT NOT NULL,
    submitted_id_number TEXT NOT NULL,
    
    -- ID Photo verification
    id_photo_url TEXT NOT NULL,
    id_photo_public_url TEXT,
    extracted_name_from_id TEXT, -- OCR extracted name
    id_extraction_confidence DECIMAL(3,2), -- 0.00-1.00 confidence score
    id_name_matches BOOLEAN, -- Does extracted name match submitted name?
    
    -- Selfie verification
    selfie_url TEXT NOT NULL,
    selfie_public_url TEXT,
    selfie_timestamp TIMESTAMP WITH TIME ZONE,
    face_match_score DECIMAL(3,2), -- 0.00-1.00 similarity score
    liveness_score DECIMAL(3,2), -- 0.00-1.00 liveness confidence
    selfie_quality_issues TEXT[], -- blurry, too_dark, no_face, etc
    
    -- Location verification
    gps_latitude DECIMAL(10,8) NOT NULL,
    gps_longitude DECIMAL(11,8) NOT NULL,
    gps_accuracy DECIMAL(7,2), -- Accuracy in meters
    gps_captured_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- IP-based location check
    ip_address INET,
    ip_country TEXT,
    ip_region TEXT,
    location_mismatch_flagged BOOLEAN DEFAULT false,
    location_mismatch_reason TEXT,
    
    -- Verification status
    verification_status verification_attempt_status DEFAULT 'pending_review',
    completed_steps verification_step[] DEFAULT '{}', -- Steps that passed
    failed_steps verification_step[] DEFAULT '{}', -- Steps that failed
    
    -- Immutability flags (after approval, these cannot be changed)
    is_locked BOOLEAN DEFAULT false,
    locked_at TIMESTAMP WITH TIME ZONE,
    locked_by_user_id UUID REFERENCES auth.users(id),
    
    -- Admin review info
    reviewed_by_admin_id UUID REFERENCES auth.users(id),
    review_notes TEXT,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    
    -- Duplicate detection flags
    duplicate_id_conflict_user_id UUID REFERENCES auth.users(id), -- If ID already used
    duplicate_phone_conflict_user_id UUID REFERENCES auth.users(id), -- If phone already used
    duplicate_email_conflict_user_id UUID REFERENCES auth.users(id), -- If email already used
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Verification audit log (immutable, append-only)
CREATE TABLE public.fundi_verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    verification_id UUID REFERENCES public.fundi_verification(id) ON DELETE CASCADE,
    
    -- Audit entry details
    action TEXT NOT NULL, -- 'submitted', 'name_extracted', 'face_compared', 'location_checked', 'approved', 'rejected', 'flagged', 'attempted_edit'
    step verification_step,
    status verification_attempt_status,
    
    -- Result details
    success BOOLEAN NOT NULL DEFAULT false,
    failure_reason TEXT,
    
    -- Anomaly detection
    fraud_flags TEXT[], -- 'multiple_attempts', 'rapid_resubmission', 'proxy_detected', 'screenshot_detected', etc
    
    -- Change tracking (if audit of changes)
    old_value TEXT,
    new_value TEXT,
    attempted_change_field TEXT,
    
    -- Request metadata
    user_agent TEXT,
    ip_address INET,
    country_from_ip TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Fundi verification blocklist (prevent abuse)
CREATE TABLE public.fundi_verification_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- What's blocked
    blocked_id_number TEXT UNIQUE, -- Block specific ID numbers
    blocked_phone TEXT UNIQUE, -- Block specific phone numbers
    blocked_email TEXT UNIQUE, -- Block specific emails
    blocked_ip_range INET, -- Block IP ranges from fraud attempts
    
    -- Why it's blocked
    reason TEXT NOT NULL,
    blocked_due_to_fraud BOOLEAN DEFAULT false,
    fraud_severity TEXT, -- 'low', 'medium', 'high'
    
    -- Admin action
    blocked_by_admin_id UUID REFERENCES auth.users(id),
    
    -- Timestamps
    blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique indexes to prevent duplicates (database-level enforcement)
CREATE UNIQUE INDEX idx_fundi_id_number_unique ON public.fundi_verification(submitted_id_number) 
    WHERE verification_status IN ('approved', 'pending_review');

CREATE UNIQUE INDEX idx_fundi_phone_unique ON public.fundi_verification(submitted_phone) 
    WHERE verification_status IN ('approved', 'pending_review');

CREATE UNIQUE INDEX idx_fundi_email_unique ON public.fundi_verification(submitted_email) 
    WHERE verification_status IN ('approved', 'pending_review');

-- Create indexes for performance
CREATE INDEX idx_verification_status ON public.fundi_verification(verification_status);
CREATE INDEX idx_verification_user_id ON public.fundi_verification(user_id);
CREATE INDEX idx_verification_created ON public.fundi_verification(created_at);
CREATE INDEX idx_audit_user_id ON public.fundi_verification_audit(user_id);
CREATE INDEX idx_audit_action ON public.fundi_verification_audit(action);
CREATE INDEX idx_audit_fraud_flags ON public.fundi_verification_audit USING GIN(fraud_flags);
CREATE INDEX idx_blocklist_id_number ON public.fundi_verification_blocklist(blocked_id_number);
CREATE INDEX idx_blocklist_phone ON public.fundi_verification_blocklist(blocked_phone);
CREATE INDEX idx_blocklist_email ON public.fundi_verification_blocklist(blocked_email);

-- Enable RLS
ALTER TABLE public.fundi_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundi_verification_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundi_verification_blocklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fundi_verification
CREATE POLICY "Users can view their own verification"
ON public.fundi_verification FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own verification"
ON public.fundi_verification FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Fundis CANNOT update verification data after approval (immutable)
CREATE POLICY "Cannot update locked verification"
ON public.fundi_verification FOR UPDATE
USING (auth.uid() = user_id AND NOT is_locked)
WITH CHECK (auth.uid() = user_id AND NOT is_locked);

-- Only admins can approve/reject/flag
CREATE POLICY "Admins can update all verification"
ON public.fundi_verification FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for fundi_verification_audit
CREATE POLICY "Users can view their own audit"
ON public.fundi_verification_audit FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.fundi_verification_audit FOR INSERT
WITH CHECK (true);

-- RLS Policies for blocklist
CREATE POLICY "Only admins can view blocklist"
ON public.fundi_verification_blocklist FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can modify blocklist"
ON public.fundi_verification_blocklist FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update fundi_profiles to reference verification status
ALTER TABLE public.fundi_profiles 
ADD COLUMN verification_data_locked BOOLEAN DEFAULT false,
ADD COLUMN verification_locked_fields TEXT[] DEFAULT '{}',
ADD COLUMN last_verification_attempt_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN verification_attempt_count INTEGER DEFAULT 0;

-- Add constraints to prevent unverified fundis from accepting jobs
ALTER TABLE public.jobs
ADD CONSTRAINT fundi_must_be_verified CHECK (
    fundi_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM public.fundi_profiles fp
        JOIN public.fundi_verification fv ON fp.user_id = fv.user_id
        WHERE fp.user_id = fundi_id 
        AND fv.verification_status = 'approved'
        AND fp.is_available = true
    )
);

-- Function to log verification attempts
CREATE OR REPLACE FUNCTION public.log_verification_attempt(
    _user_id UUID,
    _verification_id UUID,
    _action TEXT,
    _step verification_step,
    _success BOOLEAN,
    _failure_reason TEXT DEFAULT NULL,
    _fraud_flags TEXT[] DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.fundi_verification_audit (
        user_id,
        verification_id,
        action,
        step,
        success,
        failure_reason,
        fraud_flags,
        user_agent,
        ip_address
    ) VALUES (
        _user_id,
        _verification_id,
        _action,
        _step,
        _success,
        _failure_reason,
        _fraud_flags,
        current_setting('request.headers')::jsonb->>'user-agent',
        split_part(current_setting('request.headers')::jsonb->>'x-forwarded-for', ',', 1)::inet
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent verification data modification after approval
CREATE OR REPLACE FUNCTION public.check_verification_not_locked()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_locked = true THEN
        RAISE EXCEPTION 'Verification data is locked. Contact admin for changes.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verify_not_locked_on_update
BEFORE UPDATE ON public.fundi_verification
FOR EACH ROW EXECUTE FUNCTION public.check_verification_not_locked();

-- Function to detect duplicate verification attempts
CREATE OR REPLACE FUNCTION public.check_duplicate_credentials()
RETURNS TRIGGER AS $$
DECLARE
    _duplicate_id_user UUID;
    _duplicate_phone_user UUID;
    _duplicate_email_user UUID;
BEGIN
    -- Check for duplicate ID number
    SELECT user_id INTO _duplicate_id_user
    FROM public.fundi_verification
    WHERE submitted_id_number = NEW.submitted_id_number
    AND user_id != NEW.user_id
    AND verification_status IN ('approved', 'pending_review')
    LIMIT 1;

    IF _duplicate_id_user IS NOT NULL THEN
        NEW.duplicate_id_conflict_user_id = _duplicate_id_user;
        PERFORM public.log_verification_attempt(
            NEW.user_id,
            NEW.id,
            'duplicate_id_detected',
            'id_verification',
            false,
            'ID number already in use',
            ARRAY['duplicate_id']
        );
    END IF;

    -- Check for duplicate phone
    SELECT user_id INTO _duplicate_phone_user
    FROM public.fundi_verification
    WHERE submitted_phone = NEW.submitted_phone
    AND user_id != NEW.user_id
    AND verification_status IN ('approved', 'pending_review')
    LIMIT 1;

    IF _duplicate_phone_user IS NOT NULL THEN
        NEW.duplicate_phone_conflict_user_id = _duplicate_phone_user;
        PERFORM public.log_verification_attempt(
            NEW.user_id,
            NEW.id,
            'duplicate_phone_detected',
            'id_verification',
            false,
            'Phone number already in use',
            ARRAY['duplicate_phone']
        );
    END IF;

    -- Check for duplicate email
    SELECT user_id INTO _duplicate_email_user
    FROM public.fundi_verification
    WHERE submitted_email = NEW.submitted_email
    AND user_id != NEW.user_id
    AND verification_status IN ('approved', 'pending_review')
    LIMIT 1;

    IF _duplicate_email_user IS NOT NULL THEN
        NEW.duplicate_email_conflict_user_id = _duplicate_email_user;
        PERFORM public.log_verification_attempt(
            NEW.user_id,
            NEW.id,
            'duplicate_email_detected',
            'id_verification',
            false,
            'Email already in use',
            ARRAY['duplicate_email']
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_duplicate_credentials_on_insert
BEFORE INSERT ON public.fundi_verification
FOR EACH ROW EXECUTE FUNCTION public.check_duplicate_credentials();

-- Grant audit table access to service role
GRANT INSERT ON public.fundi_verification_audit TO authenticated;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_verification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_verification_updated_at
BEFORE UPDATE ON public.fundi_verification
FOR EACH ROW EXECUTE FUNCTION public.update_verification_updated_at();

CREATE TRIGGER update_blocklist_updated_at
BEFORE UPDATE ON public.fundi_verification_blocklist
FOR EACH ROW EXECUTE FUNCTION public.update_verification_updated_at();
