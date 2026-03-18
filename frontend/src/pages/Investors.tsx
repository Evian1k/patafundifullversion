import SiteLayout from "@/components/layout/SiteLayout";

export default function Investors() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Investor Relations</h1>
          <p className="text-muted-foreground mt-3">
            We’ll publish investor updates and milestones here as PataFundi grows.
          </p>
          <div className="mt-10 rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              For investor inquiries, please contact the team via Support until the official investor mailbox is announced.
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

