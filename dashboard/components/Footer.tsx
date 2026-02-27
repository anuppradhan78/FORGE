export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-700 mt-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-forge-accent rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">
              F
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-semibold text-slate-300">
                FORGE - Agentic Commerce Platform
              </p>
              <p className="text-xs text-slate-500">
                Powered by IronClaw TEE • Built for Hackathon 2026
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>9 Sponsor Integrations</span>
            <span>•</span>
            <span>Secure • Governed • Verifiable</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
