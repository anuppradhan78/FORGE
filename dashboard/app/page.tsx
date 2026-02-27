import SponsorGrid from '@/components/SponsorGrid';
import AgentStatus from '@/components/AgentStatus';
import DemoControls from '@/components/DemoControls';
import FluxReport from '@/components/FluxReport';
import AuditTrail from '@/components/AuditTrail';

export default function Home() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl">
      {/* Sponsor Grid */}
      <div className="mb-4 sm:mb-6">
        <SponsorGrid />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Demo Controls Section */}
        <section className="lg:col-span-2">
          <DemoControls />
        </section>

        {/* Agent Status Section */}
        <section className="order-1 lg:order-none">
          <AgentStatus />
        </section>

        {/* Flux Report Section */}
        <section className="order-2 lg:order-none">
          <FluxReport autoRefresh={true} refreshInterval={5000} />
        </section>

        {/* Audit Trail Section */}
        <section className="lg:col-span-2 order-3 lg:order-none">
          <AuditTrail limit={10} autoRefresh={true} refreshInterval={5000} />
        </section>
      </div>
    </div>
  );
}
