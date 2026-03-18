import SiteLayout from "@/components/layout/SiteLayout";

export default function Socials() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">PataFundi Socials</h1>
          <p className="text-muted-foreground mt-3">
            Official social accounts will be published here once they’re verified.
          </p>
          <div className="mt-10 rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              For now, reach us via Support at{" "}
              <a className="underline underline-offset-4" href="mailto:patafundi6@gmail.com">
                patafundi6@gmail.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

