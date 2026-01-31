-- FundiHub Database Schema

-- User roles enum
CREATE TYPE public.user_role AS ENUM ('customer', 'fundi', 'admin');

-- Job status enum
CREATE TYPE public.job_status AS ENUM ('pending', 'matching', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed');

-- Verification status enum
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Profiles table for all users
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- Fundi profiles (extended info for service providers)
CREATE TABLE public.fundi_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    skills TEXT[] NOT NULL DEFAULT '{}',
    experience_years INTEGER,
    bio TEXT,
    hourly_rate DECIMAL(10,2),
    rating DECIMAL(3,2) DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    verification_status verification_status DEFAULT 'pending',
    id_number TEXT,
    id_photo_url TEXT,
    selfie_url TEXT,
    mpesa_number TEXT,
    is_available BOOLEAN DEFAULT true,
    subscription_active BOOLEAN DEFAULT false,
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Service categories
CREATE TABLE public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Jobs table
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    fundi_id UUID REFERENCES auth.users(id),
    category_id UUID REFERENCES public.service_categories(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'scheduled',
    location TEXT NOT NULL,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    status job_status DEFAULT 'pending',
    estimated_price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    platform_fee DECIMAL(10,2),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Job photos
CREATE TABLE public.job_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL,
    photo_type TEXT DEFAULT 'before',
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Job bids (fundi responses to job requests)
CREATE TABLE public.job_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    fundi_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    eta_minutes INTEGER,
    message TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(job_id, fundi_id)
);

-- Reviews
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL UNIQUE,
    reviewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reviewee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Messages (job-related chat)
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES auth.users(id) NOT NULL,
    fundi_id UUID REFERENCES auth.users(id) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    fundi_earnings DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default service categories
INSERT INTO public.service_categories (name, description, icon) VALUES
    ('Plumbing', 'Pipes, leaks, installations', 'droplets'),
    ('Electrical', 'Wiring, repairs, installations', 'zap'),
    ('AC & HVAC', 'Cooling, heating, maintenance', 'wind'),
    ('Cleaning', 'Home, office, deep cleaning', 'sparkles'),
    ('Carpentry', 'Furniture, repairs, custom work', 'hammer'),
    ('Auto Repair', 'Mechanics, diagnostics, service', 'car'),
    ('Painting', 'Interior, exterior, finishing', 'paint-bucket'),
    ('General Repair', 'Handyman services', 'wrench');

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundi_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- RLS Policies

-- Profiles: Users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- User roles: Users can read their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Fundi profiles: Public read, fundis can update their own
CREATE POLICY "Fundi profiles are viewable by everyone"
ON public.fundi_profiles FOR SELECT
USING (true);

CREATE POLICY "Fundis can update their own profile"
ON public.fundi_profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Fundis can insert their own profile"
ON public.fundi_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service categories: Public read
CREATE POLICY "Service categories are viewable by everyone"
ON public.service_categories FOR SELECT
USING (true);

-- Jobs: Customers see their jobs, fundis see relevant jobs
CREATE POLICY "Customers can view their own jobs"
ON public.jobs FOR SELECT
USING (auth.uid() = customer_id OR auth.uid() = fundi_id);

CREATE POLICY "Customers can create jobs"
ON public.jobs FOR INSERT
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Job participants can update jobs"
ON public.jobs FOR UPDATE
USING (auth.uid() = customer_id OR auth.uid() = fundi_id);

-- Job photos: Job participants can view and upload
CREATE POLICY "Job participants can view photos"
ON public.job_photos FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.jobs
        WHERE jobs.id = job_photos.job_id
        AND (jobs.customer_id = auth.uid() OR jobs.fundi_id = auth.uid())
    )
);

CREATE POLICY "Job participants can upload photos"
ON public.job_photos FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

-- Job bids: Customers see bids on their jobs, fundis see their bids
CREATE POLICY "View job bids"
ON public.job_bids FOR SELECT
USING (
    auth.uid() = fundi_id OR
    EXISTS (
        SELECT 1 FROM public.jobs
        WHERE jobs.id = job_bids.job_id
        AND jobs.customer_id = auth.uid()
    )
);

CREATE POLICY "Fundis can create bids"
ON public.job_bids FOR INSERT
WITH CHECK (auth.uid() = fundi_id);

CREATE POLICY "Fundis can update their bids"
ON public.job_bids FOR UPDATE
USING (auth.uid() = fundi_id);

-- Reviews: Public read, participants can write
CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews FOR SELECT
USING (true);

CREATE POLICY "Participants can create reviews"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = reviewer_id);

-- Messages: Job participants can read and send
CREATE POLICY "Job participants can view messages"
ON public.messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.jobs
        WHERE jobs.id = messages.job_id
        AND (jobs.customer_id = auth.uid() OR jobs.fundi_id = auth.uid())
    )
);

CREATE POLICY "Job participants can send messages"
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Payments: Participants can view their payments
CREATE POLICY "Payment participants can view payments"
ON public.payments FOR SELECT
USING (auth.uid() = customer_id OR auth.uid() = fundi_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fundi_profiles_updated_at
BEFORE UPDATE ON public.fundi_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        NEW.raw_user_meta_data->>'phone'
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
        NEW.id,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
    );
    
    IF NEW.raw_user_meta_data->>'role' = 'fundi' THEN
        INSERT INTO public.fundi_profiles (user_id)
        VALUES (NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;