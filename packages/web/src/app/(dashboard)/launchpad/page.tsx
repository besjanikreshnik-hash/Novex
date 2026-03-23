'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Rocket,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ArrowLeft,
  Loader2,
  ExternalLink,
  X,
} from 'lucide-react';
import {
  launchpadApi,
  type LaunchpadProjectDto,
  type LaunchpadContributionDto,
} from '@/lib/api';

/* ─── Status helpers ────────────────────────────────── */

function statusBadge(status: string) {
  switch (status) {
    case 'upcoming':
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-nvx-primary/10 text-nvx-primary">
          <Clock size={10} /> Upcoming
        </span>
      );
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-nvx-buy/10 text-nvx-buy">
          <Rocket size={10} /> Active
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-nvx-text-muted/10 text-nvx-text-muted">
          <CheckCircle2 size={10} /> Completed
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium bg-nvx-sell/10 text-nvx-sell">
          <XCircle size={10} /> Cancelled
        </span>
      );
    default:
      return null;
  }
}

function contributionStatusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
    confirmed: { bg: 'bg-nvx-buy/10', text: 'text-nvx-buy' },
    claimed: { bg: 'bg-nvx-primary/10', text: 'text-nvx-primary' },
    refunded: { bg: 'bg-nvx-text-muted/10', text: 'text-nvx-text-muted' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}>
      {status}
    </span>
  );
}

/* ─── Countdown Timer ───────────────────────────────── */

function useCountdown(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Started');
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}

function CountdownDisplay({ date, label }: { date: string; label: string }) {
  const timeLeft = useCountdown(date);
  return (
    <div className="text-center">
      <p className="text-[10px] text-nvx-text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-mono font-bold text-nvx-text-primary">{timeLeft}</p>
    </div>
  );
}

/* ─── Progress Bar ──────────────────────────────────── */

function ProgressBar({ raised, hardCap, progress }: { raised: string; hardCap: string; progress: number }) {
  const pct = Math.min(progress, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] text-nvx-text-muted mb-1">
        <span>${parseFloat(raised).toLocaleString()} raised</span>
        <span>${parseFloat(hardCap).toLocaleString()} goal</span>
      </div>
      <div className="h-2 rounded-full bg-nvx-bg-tertiary overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-nvx-primary to-nvx-buy transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-nvx-text-muted mt-1 text-right">{pct.toFixed(1)}%</p>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────── */

export default function LaunchpadPage() {
  const [projects, setProjects] = useState<LaunchpadProjectDto[]>([]);
  const [contributions, setContributions] = useState<LaunchpadContributionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState<LaunchpadProjectDto | null>(null);

  // Contribute modal
  const [contributeModal, setContributeModal] = useState<LaunchpadProjectDto | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributeLoading, setContributeLoading] = useState(false);
  const [contributeError, setContributeError] = useState('');

  // Claim/refund loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projs, contribs] = await Promise.all([
        launchpadApi.getProjects(),
        launchpadApi.getMyContributions().catch(() => [] as LaunchpadContributionDto[]),
      ]);
      setProjects(projs);
      setContributions(contribs);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load launchpad data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'all') return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const totalContributed = useMemo(() => {
    return contributions.reduce((sum, c) => sum + parseFloat(c.amount || '0'), 0);
  }, [contributions]);

  // Handle contribute
  const handleContribute = async () => {
    if (!contributeModal || !contributeAmount) return;
    setContributeLoading(true);
    setContributeError('');
    try {
      await launchpadApi.contribute(contributeModal.id, contributeAmount);
      setContributeModal(null);
      setContributeAmount('');
      await loadData();
    } catch (err) {
      setContributeError(err instanceof Error ? err.message : 'Contribution failed');
    } finally {
      setContributeLoading(false);
    }
  };

  // Handle claim
  const handleClaim = async (contributionId: string) => {
    setActionLoading(contributionId);
    try {
      await launchpadApi.claimTokens(contributionId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claim failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-nvx-bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-nvx-primary border-t-transparent mx-auto mb-4" />
          <p className="text-nvx-text-secondary text-sm">Loading launchpad...</p>
        </div>
      </div>
    );
  }

  // ─── Project Detail View ────────────────────────────
  if (selectedProject) {
    return (
      <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedProject(null)}
            className="flex items-center gap-1 text-sm text-nvx-text-secondary hover:text-nvx-text-primary mb-4 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Projects
          </button>

          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-lg font-bold">
                  {selectedProject.tokenSymbol.slice(0, 2)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-nvx-text-primary">
                    {selectedProject.name}
                  </h1>
                  <p className="text-sm text-nvx-text-muted">${selectedProject.tokenSymbol}</p>
                </div>
              </div>
              {statusBadge(selectedProject.status)}
            </div>

            {/* Description */}
            <p className="text-sm text-nvx-text-secondary mb-6 leading-relaxed">
              {selectedProject.description}
            </p>

            {/* Progress */}
            <div className="mb-6">
              <ProgressBar
                raised={selectedProject.raised}
                hardCap={selectedProject.hardCap}
                progress={selectedProject.progress}
              />
            </div>

            {/* Countdown */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-nvx-bg-primary rounded-lg p-3">
                <CountdownDisplay date={selectedProject.startDate} label="Sale Starts" />
              </div>
              <div className="bg-nvx-bg-primary rounded-lg p-3">
                <CountdownDisplay date={selectedProject.endDate} label="Sale Ends" />
              </div>
            </div>

            {/* Tokenomics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Price', value: `$${parseFloat(selectedProject.pricePerToken).toFixed(4)}` },
                { label: 'Hard Cap', value: `$${parseFloat(selectedProject.hardCap).toLocaleString()}` },
                { label: 'Soft Cap', value: `$${parseFloat(selectedProject.softCap).toLocaleString()}` },
                { label: 'Total Supply', value: parseFloat(selectedProject.totalSupply).toLocaleString() },
              ].map((item) => (
                <div key={item.label} className="bg-nvx-bg-primary rounded-lg p-3 text-center">
                  <p className="text-[10px] text-nvx-text-muted uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-bold text-nvx-text-primary font-mono">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Vesting */}
            {selectedProject.vestingSchedule && Object.keys(selectedProject.vestingSchedule).length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-nvx-text-primary mb-2 uppercase tracking-wider">
                  Vesting Schedule
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(selectedProject.vestingSchedule).map(([key, value]) => (
                    <div key={key} className="bg-nvx-bg-primary rounded-lg p-2 text-center">
                      <p className="text-[10px] text-nvx-text-muted capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                      <p className="text-sm font-bold text-nvx-primary">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Social Links */}
            {selectedProject.socialLinks && Object.keys(selectedProject.socialLinks).length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-nvx-text-primary mb-2 uppercase tracking-wider">
                  Links
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selectedProject.socialLinks).map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-nvx-bg-primary px-3 py-1.5 text-xs text-nvx-text-secondary hover:text-nvx-primary transition-colors capitalize"
                    >
                      {key} <ExternalLink size={10} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Contribute Button */}
            {selectedProject.status === 'active' && (
              <button
                onClick={() => {
                  setContributeModal(selectedProject);
                  setContributeAmount('');
                  setContributeError('');
                }}
                className="w-full py-3 px-4 rounded-lg bg-nvx-primary text-white text-sm font-medium hover:bg-nvx-primary/90 transition-colors"
              >
                Contribute USDT
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Main List View ─────────────────────────────────
  return (
    <div className="bg-nvx-bg-primary min-h-[calc(100vh-56px)] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-nvx-text-primary flex items-center gap-2">
              <Rocket size={22} className="text-nvx-primary" />
              Token Launchpad
            </h1>
            <p className="text-sm text-nvx-text-muted mt-1">
              Discover and participate in new token launches
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
            <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
              Active Projects
            </p>
            <p className="text-lg font-bold text-nvx-text-primary font-mono">
              {projects.filter((p) => p.status === 'active').length}
            </p>
          </div>
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
            <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
              My Total Contributed
            </p>
            <p className="text-lg font-bold text-nvx-buy font-mono">
              ${totalContributed.toFixed(2)}
            </p>
          </div>
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-4">
            <p className="text-xs text-nvx-text-muted uppercase tracking-wider mb-1">
              My Contributions
            </p>
            <p className="text-lg font-bold text-nvx-text-primary font-mono">
              {contributions.length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          {['all', 'upcoming', 'active', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f
                  ? 'bg-nvx-primary text-white'
                  : 'bg-nvx-bg-secondary text-nvx-text-secondary hover:bg-nvx-bg-tertiary'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Project Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-nvx-bg-secondary border border-nvx-border rounded-xl p-5 hover:border-nvx-primary/40 transition-colors cursor-pointer"
              onClick={() => setSelectedProject(project)}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-nvx-primary/20 flex items-center justify-center text-nvx-primary text-sm font-bold">
                    {project.tokenSymbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-nvx-text-primary">
                      {project.name}
                    </p>
                    <p className="text-xs text-nvx-text-muted">${project.tokenSymbol}</p>
                  </div>
                </div>
                {statusBadge(project.status)}
              </div>

              {/* Price */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-nvx-text-muted">Price per Token</p>
                  <p className="text-lg font-bold text-nvx-text-primary font-mono">
                    ${parseFloat(project.pricePerToken).toFixed(4)}
                  </p>
                </div>
                <ChevronRight size={18} className="text-nvx-text-muted" />
              </div>

              {/* Progress */}
              <ProgressBar
                raised={project.raised}
                hardCap={project.hardCap}
                progress={project.progress}
              />

              {/* Countdown */}
              <div className="mt-3 flex justify-between">
                {project.status === 'upcoming' ? (
                  <CountdownDisplay date={project.startDate} label="Starts in" />
                ) : project.status === 'active' ? (
                  <CountdownDisplay date={project.endDate} label="Ends in" />
                ) : (
                  <div className="text-center">
                    <p className="text-[10px] text-nvx-text-muted">Status</p>
                    <p className="text-sm font-medium text-nvx-text-secondary capitalize">{project.status}</p>
                  </div>
                )}
                {project.status === 'active' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContributeModal(project);
                      setContributeAmount('');
                      setContributeError('');
                    }}
                    className="px-4 py-1.5 rounded-lg bg-nvx-primary text-white text-xs font-medium hover:bg-nvx-primary/90 transition-colors"
                  >
                    Contribute
                  </button>
                )}
              </div>
            </div>
          ))}

          {filteredProjects.length === 0 && (
            <div className="col-span-full text-center py-12 text-nvx-text-muted text-sm">
              No projects found for this filter.
            </div>
          )}
        </div>

        {/* My Contributions */}
        <h2 className="text-base font-semibold text-nvx-text-primary mb-3">
          My Contributions
        </h2>
        <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-nvx-border text-nvx-text-muted text-xs">
                  <th className="text-left py-3 px-4 font-medium">Project</th>
                  <th className="text-right py-3 px-4 font-medium">Amount (USDT)</th>
                  <th className="text-right py-3 px-4 font-medium">Token Allocation</th>
                  <th className="text-right py-3 px-4 font-medium">Status</th>
                  <th className="text-right py-3 px-4 font-medium">Date</th>
                  <th className="text-right py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contributions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-nvx-text-muted text-sm">
                      No contributions yet. Participate in a launchpad project to get started.
                    </td>
                  </tr>
                ) : (
                  contributions.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-nvx-border/30 hover:bg-nvx-bg-tertiary/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-nvx-text-primary">{c.projectName}</p>
                          <p className="text-[10px] text-nvx-text-muted">${c.tokenSymbol}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        ${parseFloat(c.amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm text-nvx-text-primary">
                        {parseFloat(c.tokenAllocation).toLocaleString()} {c.tokenSymbol}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {contributionStatusBadge(c.status)}
                      </td>
                      <td className="py-3 px-4 text-right text-xs text-nvx-text-secondary">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.status === 'confirmed' && (
                          <button
                            onClick={() => handleClaim(c.id)}
                            disabled={actionLoading === c.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded text-nvx-primary bg-nvx-primary/10 hover:bg-nvx-primary/20 transition-colors"
                          >
                            {actionLoading === c.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            Claim
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Contribute Modal */}
      {contributeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-nvx-bg-secondary border border-nvx-border rounded-xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nvx-text-primary">
                Contribute to {contributeModal.name}
              </h3>
              <button
                onClick={() => setContributeModal(null)}
                className="p-1 rounded hover:bg-nvx-bg-tertiary text-nvx-text-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="bg-nvx-bg-primary rounded-lg p-3">
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>Token</span>
                  <span>{contributeModal.name} ({contributeModal.tokenSymbol})</span>
                </div>
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>Price per Token</span>
                  <span className="text-nvx-buy font-medium">
                    ${parseFloat(contributeModal.pricePerToken).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-nvx-text-muted mb-1">
                  <span>Remaining Cap</span>
                  <span>
                    ${(parseFloat(contributeModal.hardCap) - parseFloat(contributeModal.raised)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-nvx-text-muted mb-1">
                  Amount (USDT)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  placeholder="Enter USDT amount"
                  className="w-full px-3 py-2.5 bg-nvx-bg-primary border border-nvx-border rounded-lg text-sm text-nvx-text-primary placeholder-nvx-text-muted focus:outline-none focus:border-nvx-primary font-mono"
                />
              </div>

              {contributeAmount && parseFloat(contributeAmount) > 0 && (
                <div className="bg-nvx-buy/5 border border-nvx-buy/20 rounded-lg p-3">
                  <p className="text-xs text-nvx-text-muted mb-1">You will receive</p>
                  <p className="text-sm font-mono text-nvx-buy">
                    {(parseFloat(contributeAmount) / parseFloat(contributeModal.pricePerToken)).toLocaleString()}{' '}
                    {contributeModal.tokenSymbol}
                  </p>
                </div>
              )}
            </div>

            {contributeError && (
              <div className="bg-nvx-sell/10 border border-nvx-sell/30 text-nvx-sell text-xs rounded-lg px-3 py-2 mb-3">
                {contributeError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setContributeModal(null)}
                className="flex-1 py-2.5 px-4 rounded-lg border border-nvx-border text-sm font-medium text-nvx-text-secondary hover:bg-nvx-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleContribute}
                disabled={contributeLoading || !contributeAmount || parseFloat(contributeAmount) <= 0}
                className="flex-1 py-2.5 px-4 rounded-lg bg-nvx-primary text-white text-sm font-medium hover:bg-nvx-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {contributeLoading && <Loader2 size={14} className="animate-spin" />}
                Confirm Contribution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
