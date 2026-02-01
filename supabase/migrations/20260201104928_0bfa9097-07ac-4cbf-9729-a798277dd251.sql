-- Create admin_accounts table for secure admin authentication
CREATE TABLE IF NOT EXISTS public.admin_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'support_admin' CHECK (role IN ('super_admin', 'support_admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can read their own record
CREATE POLICY "Admins can view their own account"
ON public.admin_accounts
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_admin_accounts_updated_at
    BEFORE UPDATE ON public.admin_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create admin login audit log table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.admin_accounts(id),
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admins can read audit logs (using the has_role function)
CREATE POLICY "Super admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.admin_accounts 
        WHERE user_id = auth.uid() 
        AND role = 'super_admin'
    )
);