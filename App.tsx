import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  Compass,
  Database,
  FileText,
  HardDriveDownload,
  History,
  LayoutDashboard,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
} from 'lucide-react';
import {
  api,
  type BackupRestoreResult,
  type HealthInfo,
  type StoragePersistenceInfo,
  type WorkspaceData,
} from './api/client.ts';
import type { Attempt, Journey } from './shared/types.ts';
import { DashboardView } from './components/DashboardView.tsx';
import { JourneyView } from './components/JourneyView.tsx';
import { ExamRunnerView } from './components/ExamRunnerView.tsx';
import { PerformanceView } from './components/PerformanceView.tsx';
import { SyllabusView } from './components/SyllabusView.tsx';
import { QuestionBankView } from './components/QuestionBankView.tsx';
import { DocumentsView } from './components/DocumentsView.tsx';
import { PlannerView } from './components/PlannerView.tsx';
import { TutorAndMaterialsView } from './components/TutorAndMaterialsView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { BackupRestoreModal } from './components/ui/BackupRestoreModal.tsx';
import { BrandMark } from './components/ui/BrandMark.tsx';
import { FeedbackToast, type ToastMessage } from './components/ui/FeedbackToast.tsx';

type NavTab =
  | 'dashboard'
  | 'journey'
  | 'performance'
  | 'syllabus'
  | 'questions'
  | 'documents'
  | 'planner'
  | 'tutor'
  | 'history';

const NAV_GROUPS: Array<{
  groupLabel: string;
  items: Array<{ id: NavTab; label: string; shortLabel: string; Icon: typeof LayoutDashboard }>;
}> = [
  {
    groupLabel: 'Diagnóstico & Jornada',
    items: [
      { id: 'dashboard', label: 'Visão Geral', shortLabel: 'Visão Geral', Icon: LayoutDashboard },
      { id: 'journey', label: 'Minha Jornada', shortLabel: 'Jornada', Icon: Compass },
      { id: 'performance', label: 'Quadro de Performance', shortLabel: 'Performance', Icon: BarChart3 },
    ],
  },
  {
    groupLabel: 'Edital & Acervo',
    items: [
      { id: 'syllabus', label: 'Edital Verticalizado', shortLabel: 'Edital', Icon: BookOpen },
      { id: 'questions', label: 'Banco de Questões', shortLabel: 'Questões', Icon: Database },
      { id: 'documents', label: 'Central de Documentos', shortLabel: 'Documentos', Icon: FileText },
    ],
  },
  {
    groupLabel: 'Estudo & Registros',
    items: [
      { id: 'planner', label: 'Planejamento', shortLabel: 'Planejamento', Icon: Calendar },
      { id: 'tutor', label: 'Tutor & Materiais', shortLabel: 'Tutor', Icon: MessageSquare },
      { id: 'history', label: 'Histórico & Backup', shortLabel: 'Histórico', Icon: History },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function App() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [activeJourneyId, setActiveJourneyId] = useState<string>('');
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingJourney, setSwitchingJourney] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('mr_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  // Feedback toast with optional Undo
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const notify = useCallback((payload: Omit<ToastMessage, 'id'>) => {
    setToast({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...payload,
    });
  }, []);

  // Exam runner state
  const [runningExamId, setRunningExamId] = useState<string | null>(null);
  const [inspectAttempt, setInspectAttempt] = useState<Attempt | null>(null);

  // New Journey Modal
  const [showNewJourneyModal, setShowNewJourneyModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOrg, setNewOrg] = useState('Petrobras');
  const [newEmphasis, setNewEmphasis] = useState('');
  const [newBoard, setNewBoard] = useState('CESGRANRIO');
  const [newDailyMin, setNewDailyMin] = useState(90);
  const [creatingJourney, setCreatingJourney] = useState(false);

  // Backup & Restore JSON Modal + Persistent Storage Status
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [persistenceInfo, setPersistenceInfo] = useState<StoragePersistenceInfo | null>(null);
  const [backupRevision, setBackupRevision] = useState(0);

  const refreshPersistenceInfo = useCallback(async () => {
    const info = await api.getStoragePersistenceInfo();
    setPersistenceInfo(info);
  }, []);

  const loadWorkspace = useCallback(async (journeyId: string) => {
    const [data, info] = await Promise.all([
      api.getWorkspace(journeyId),
      api.getStoragePersistenceInfo(),
    ]);
    setWorkspace(data);
    setPersistenceInfo(info);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      try {
        setLoading(true);
        const [h, jRes, pInfo] = await Promise.all([
          api.getHealth(),
          api.listJourneys(),
          api.getStoragePersistenceInfo(),
        ]);
        if (!mounted) return;
        setHealth(h);
        setJourneys(jRes.journeys);
        setPersistenceInfo(pInfo);
        if (jRes.journeys.length > 0) {
          const firstId = jRes.journeys[0].id;
          setActiveJourneyId(firstId);
          await loadWorkspace(firstId);
        }
      } catch (err: any) {
        if (mounted) setErrorMsg(err?.message || 'Erro ao inicializar plataforma.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [loadWorkspace]);

  // Keyboard Escape handler for mobile drawer & modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showNewJourneyModal) setShowNewJourneyModal(false);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showNewJourneyModal, mobileMenuOpen]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('mr_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const handleSelectJourney = async (id: string) => {
    setActiveJourneyId(id);
    setRunningExamId(null);
    setInspectAttempt(null);
    setSwitchingJourney(true);
    try {
      await loadWorkspace(id);
      const selected = journeys.find((j) => j.id === id);
      if (selected) {
        notify({ tone: 'info', message: `Jornada ativa alterada para ${selected.title}.` });
      }
    } finally {
      setSwitchingJourney(false);
    }
  };

  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreatingJourney(true);
    try {
      const res = await api.createJourney({
        title: newTitle.trim(),
        organization: newOrg.trim() || 'Petrobras',
        roleEmphasis: newEmphasis.trim() || 'Geral',
        board: newBoard.trim() || 'CESGRANRIO',
        dailyMinutes: newDailyMin,
      });
      const jList = await api.listJourneys();
      setJourneys(jList.journeys);
      setActiveJourneyId(res.journey.id);
      await loadWorkspace(res.journey.id);
      setShowNewJourneyModal(false);
      setNewTitle('');
      setNewEmphasis('');
      setActiveTab('documents');
      notify({
        tone: 'success',
        message: `Jornada "${res.journey.title}" criada. Importe o edital ou provas para começar.`,
      });
    } finally {
      setCreatingJourney(false);
    }
  };

  const handleStartExam = (examId: string) => {
    setInspectAttempt(null);
    setRunningExamId(examId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInspectAttempt = (attemptId: string) => {
    if (!workspace) return;
    const found = workspace.attempts.find((a) => a.id === attemptId);
    if (!found) return;
    setInspectAttempt(found);
    setRunningExamId(found.examId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (tab: string) => {
    setRunningExamId(null);
    setInspectAttempt(null);
    setActiveTab(tab as NavTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExportBackup = useCallback(async () => {
    const data = await api.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metodo_reverso_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    await refreshPersistenceInfo();
    notify({
      tone: 'success',
      message: 'Arquivo de backup JSON exportado com sucesso.',
    });
  }, [notify, refreshPersistenceInfo]);

  const handleImportBackup = useCallback(
    async (
      rawJson: string,
      options?: { mode?: 'merge' | 'replace' }
    ): Promise<BackupRestoreResult> => {
      const res = await api.importBackup(rawJson, options);
      const jList = await api.listJourneys();
      setJourneys(jList.journeys);
      const keepActive =
        activeJourneyId && jList.journeys.some((j) => j.id === activeJourneyId)
          ? activeJourneyId
          : jList.journeys[0]?.id ?? '';
      if (keepActive) {
        setActiveJourneyId(keepActive);
        await loadWorkspace(keepActive);
      } else {
        await refreshPersistenceInfo();
      }
      setBackupRevision((rev) => rev + 1);
      notify({
        tone: 'success',
        message:
          res.mode === 'merge'
            ? `Backup mesclado mantendo os itens já anexados: ${res.addedCount} novo(s) registro(s) incorporado(s).`
            : `Backup restaurado: ${res.journeysCount} jornada(s) e ${res.attemptsCount} tentativa(s).`,
      });
      return res;
    },
    [activeJourneyId, loadWorkspace, notify, refreshPersistenceInfo]
  );

  const activeExam =
    runningExamId && workspace
      ? workspace.exams.find((e) => e.id === runningExamId) ?? null
      : null;

  const activeExamQuestions =
    activeExam && workspace
      ? workspace.questions
          .filter((q) => q.examId === activeExam.id)
          .sort((a, b) => a.questionNumber - b.questionNumber)
      : [];

  if (loading && !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] p-6">
        <div className="app-surface p-8 max-w-md w-full space-y-4">
          <div className="flex items-center gap-3">
            <BrandMark className="w-8 h-8" />
            <div>
              <div className="font-display text-base font-bold text-[var(--text-primary)]">
                Método Reverso
              </div>
              <div className="text-[var(--text-xs)] text-[var(--text-muted)]">
                Preparando banco relacional local...
              </div>
            </div>
          </div>
          <div className="space-y-2.5">
            <div className="h-3 rounded bg-[var(--bg-surface-subtle)] animate-pulse w-3/4" />
            <div className="h-3 rounded bg-[var(--bg-surface-subtle)] animate-pulse w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMsg && !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-canvas)] p-6">
        <div className="app-surface p-6 max-w-md w-full space-y-4 border-[var(--color-danger-border)]">
          <h1 className="text-base font-semibold text-[var(--color-danger)]">
            Não foi possível carregar o ambiente
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">{errorMsg}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary w-full"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const currentSectionTitle = activeExam
    ? activeExam.title
    : ALL_NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Visão Geral';

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo principal
      </a>

      {/* Sidebar Desktop Recolhível */}
      <aside
        aria-label="Navegação principal"
        className={`hidden lg:flex lg:flex-col bg-[var(--bg-chrome)] border-r border-[var(--border-subtle)] shrink-0 no-print transition-[width] duration-200 ${
          sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 px-4 border-b border-[var(--border-subtle)] flex items-center ${
            sidebarCollapsed ? 'justify-center' : 'justify-between gap-2'
          }`}
        >
          <button
            type="button"
            onClick={() => handleNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left min-w-0 rounded-[var(--radius-sm)]"
            title="Ir para Visão Geral"
          >
            <BrandMark className="w-7 h-7 shrink-0" />
            {!sidebarCollapsed && (
              <span className="font-display text-[15px] font-bold tracking-tight text-[var(--text-primary)] whitespace-nowrap truncate">
                Método Reverso
              </span>
            )}
          </button>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={true}
              aria-label="Recolher menu lateral"
              title="Recolher menu lateral"
              className="p-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="p-2 border-b border-[var(--border-subtle)] flex justify-center">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={false}
              aria-label="Expandir menu lateral"
              title="Expandir menu lateral"
              className="p-2.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
            >
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Seletor de Jornada Isolada */}
        {!sidebarCollapsed && (
          <div className="p-4 border-b border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="desktop-journey-select"
                className="text-[12px] font-semibold text-[var(--text-muted)]"
              >
                Jornada ativa
              </label>
              <button
                type="button"
                onClick={() => setShowNewJourneyModal(true)}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)] hover:underline px-1.5 py-0.5 rounded-[var(--radius-sm)]"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Nova</span>
              </button>
            </div>
            <select
              id="desktop-journey-select"
              value={activeJourneyId}
              disabled={switchingJourney}
              onChange={(e) => handleSelectJourney(e.target.value)}
              className="form-select !min-h-[40px] !py-1.5 !text-[13px] font-medium"
            >
              {journeys.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Menu de Navegação Agrupado */}
        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupLabel} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-[11px] font-semibold text-[var(--text-muted)]">
                  {group.groupLabel}
                </div>
              )}
              {group.items.map(({ id, label, Icon }) => {
                const isActive = !runningExamId && activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    title={sidebarCollapsed ? label : undefined}
                    onClick={() => handleNavigate(id)}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2' : 'gap-2.5 px-3'
                    } min-h-[40px] py-2 text-[13px] font-medium rounded-[var(--radius-md)] transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-text-on-soft)] font-semibold'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'
                      }`}
                      aria-hidden="true"
                    />
                    {!sidebarCollapsed && <span className="truncate">{label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Backup / Restauração JSON sempre acessível */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-3">
          <button
            type="button"
            onClick={() => {
              setShowBackupModal(true);
            }}
            title="Backup / Restauração em JSON"
            aria-label="Backup / Restauração em JSON"
            className={`w-full btn-secondary ${
              sidebarCollapsed ? '!px-2 justify-center' : 'justify-start'
            } !text-[13px]`}
          >
            <HardDriveDownload
              className="w-4 h-4 text-[var(--color-primary)] shrink-0"
              aria-hidden="true"
            />
            {!sidebarCollapsed && (
              <span className="truncate">Backup / Restauração JSON</span>
            )}
          </button>

          {!sidebarCollapsed && (
            <div className="px-1 text-[12px] text-[var(--text-muted)] leading-snug">
              <div className="font-medium text-[var(--text-secondary)]">Ciclo do Método Reverso</div>
              <div className="mt-0.5">Prova · Lacunas · Estudo · Domínio</div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navegação"
          className="fixed inset-0 z-50 lg:hidden flex"
        >
          <div
            className="fixed inset-0 bg-slate-950/45"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-80 max-w-[88vw] bg-[var(--bg-surface)] h-full border-r border-[var(--border-subtle)] flex flex-col z-10 shadow-[var(--shadow-modal)]">
            <div className="px-4 h-16 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BrandMark className="w-7 h-7" />
                <span className="font-display font-bold text-base text-[var(--text-primary)]">
                  Método Reverso
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Fechar menu"
                className="p-2.5 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 border-b border-[var(--border-subtle)] space-y-2.5">
              <label
                htmlFor="mobile-journey-select"
                className="block text-[12px] font-semibold text-[var(--text-muted)]"
              >
                Jornada ativa
              </label>
              <select
                id="mobile-journey-select"
                value={activeJourneyId}
                onChange={(e) => {
                  handleSelectJourney(e.target.value);
                  setMobileMenuOpen(false);
                }}
                className="form-select"
              >
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setShowNewJourneyModal(true);
                  setMobileMenuOpen(false);
                }}
                className="btn-secondary w-full"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Nova Jornada</span>
              </button>
            </div>

            <nav className="p-3 space-y-4 flex-1 overflow-y-auto">
              {NAV_GROUPS.map((group) => (
                <div key={group.groupLabel} className="space-y-1">
                  <div className="px-3 pb-1 text-[11px] font-semibold text-[var(--text-muted)]">
                    {group.groupLabel}
                  </div>
                  {group.items.map(({ id, label, Icon }) => {
                    const isActive = !runningExamId && activeTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => {
                          handleNavigate(id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 min-h-[44px] py-2.5 text-sm font-medium rounded-[var(--radius-md)] transition-colors ${
                          isActive
                            ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-text-on-soft)] font-semibold'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="p-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowBackupModal(true);
                }}
                className="btn-secondary w-full justify-start"
              >
                <HardDriveDownload
                  className="w-4 h-4 text-[var(--color-primary)] shrink-0"
                  aria-hidden="true"
                />
                <span>Backup / Restauração JSON</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contrato Limpo (3 zonas) */}
        <header className="sticky top-0 z-30 h-16 bg-[var(--bg-chrome)]/95 backdrop-blur-xs border-b border-[var(--border-subtle)] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 -ml-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <nav aria-label="Localização atual" className="flex items-center gap-2 min-w-0 text-sm">
              <span className="hidden sm:inline text-[var(--text-muted)] truncate">
                {workspace?.journey.organization}
              </span>
              <span className="hidden sm:inline text-[var(--text-muted)]" aria-hidden="true">
                /
              </span>
              <span className="font-display font-semibold text-[var(--text-primary)] truncate">
                {currentSectionTitle}
              </span>
            </nav>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {!activeExam && (
              <button
                type="button"
                onClick={() => setShowBackupModal(true)}
                title="Backup / Restauração em JSON"
                aria-label="Backup / Restauração em JSON"
                className="btn-secondary"
              >
                <HardDriveDownload
                  className="w-4 h-4 text-[var(--color-primary)] shrink-0"
                  aria-hidden="true"
                />
                <span className="hidden md:inline">Backup / Restauração JSON</span>
                <span className="md:hidden">Backup JSON</span>
              </button>
            )}

            {activeExam ? (
              <button
                type="button"
                onClick={() => {
                  setRunningExamId(null);
                  setInspectAttempt(null);
                }}
                className="btn-secondary"
              >
                Sair do Modo Prova
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNavigate('questions')}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">Novo Caderno / Simulado</span>
                <span className="sm:hidden">Novo Caderno</span>
              </button>
            )}
          </div>
        </header>

        {/* Main Content Viewport */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-[1320px] w-full mx-auto focus:outline-none"
        >
          {switchingJourney && (
            <div className="alert-box alert-info mb-6" role="status">
              Carregando dados da jornada selecionada...
            </div>
          )}

          {!workspace ? null : activeExam ? (
            <div key={`exam_${activeExam.id}`} className="view-enter">
              <ExamRunnerView
                exam={activeExam}
                questions={activeExamQuestions}
                initialAttemptToInspect={inspectAttempt}
                onSubmitAttempt={async (answers) => {
                  const res = await api.submitAttempt(
                    workspace.journey.id,
                    activeExam.id,
                    answers
                  );
                  await loadWorkspace(workspace.journey.id);
                  notify({
                    tone: 'success',
                    message: `Tentativa #${res.attempt.attemptNumber} corrigida e salva no histórico.`,
                  });
                  return res.attempt;
                }}
                onExit={() => {
                  setRunningExamId(null);
                  setInspectAttempt(null);
                }}
                onNotify={notify}
              />
            </div>
          ) : (
            <div key={`${activeTab}_${backupRevision}`} className="view-enter">
              {activeTab === 'dashboard' && (
                <DashboardView
                  workspace={workspace}
                  onStartExam={handleStartExam}
                  onNavigate={handleNavigate}
                  onGeneratePlan={async () => {
                    await api.generatePlan(workspace.journey.id);
                    await loadWorkspace(workspace.journey.id);
                    setActiveTab('planner');
                    notify({
                      tone: 'success',
                      message: 'Cronograma semanal gerado com base nas suas prioridades.',
                    });
                  }}
                />
              )}

              {activeTab === 'journey' && (
                <JourneyView
                  workspace={workspace}
                  onStartExam={handleStartExam}
                  onInspectAttempt={handleInspectAttempt}
                  onUpdateJourneySettings={async (payload) => {
                    await api.updateJourney(workspace.journey.id, payload);
                    await loadWorkspace(workspace.journey.id);
                    notify({
                      tone: 'success',
                      message: 'Critérios de aptidão e regras do edital salvos.',
                    });
                  }}
                  onCreateSimuladoInedito={async (count) => {
                    const res = await api.createCustomExam(workspace.journey.id, {
                      mode: 'proporcional_edital',
                      count,
                    });
                    await loadWorkspace(workspace.journey.id);
                    handleStartExam(res.examId);
                  }}
                  onNavigate={handleNavigate}
                  aiConfigured={Boolean(health?.ai.configured)}
                />
              )}

              {activeTab === 'performance' && <PerformanceView workspace={workspace} />}

              {activeTab === 'syllabus' && (
                <SyllabusView
                  workspace={workspace}
                  onAddDiscipline={async (payload) => {
                    await api.addDiscipline(workspace.journey.id, payload);
                    await loadWorkspace(workspace.journey.id);
                    notify({
                      tone: 'success',
                      message: `Disciplina "${payload.name}" adicionada ao edital.`,
                    });
                  }}
                  onAddSubtopic={async (payload) => {
                    await api.addSubtopic(workspace.journey.id, payload);
                    await loadWorkspace(workspace.journey.id);
                    notify({
                      tone: 'success',
                      message: `Subtópico "${payload.title}" incluído na disciplina.`,
                    });
                  }}
                  onPracticeSubtopic={async (subtopicId) => {
                    const res = await api.createCustomExam(workspace.journey.id, {
                      mode: 'subtopico',
                      count: workspace.journey.defaultCustomExamQuestions || 15,
                      subtopicId,
                    });
                    await loadWorkspace(workspace.journey.id);
                    handleStartExam(res.examId);
                  }}
                />
              )}

              {activeTab === 'questions' && (
                <QuestionBankView
                  workspace={workspace}
                  onCreateCustomExam={async (payload) => {
                    const res = await api.createCustomExam(workspace.journey.id, payload);
                    await loadWorkspace(workspace.journey.id);
                    handleStartExam(res.examId);
                  }}
                  onUpdateQuestion={async (qId, payload) => {
                    const prevQ = workspace.questions.find((q) => q.id === qId);
                    await api.updateQuestion(qId, payload);
                    await loadWorkspace(workspace.journey.id);
                    if ('isFavorite' in payload && prevQ) {
                      notify({
                        tone: 'info',
                        message: payload.isFavorite
                          ? 'Questão adicionada aos favoritos.'
                          : 'Questão removida dos favoritos.',
                        onUndo: async () => {
                          await api.updateQuestion(qId, { isFavorite: prevQ.isFavorite });
                          await loadWorkspace(workspace.journey.id);
                        },
                      });
                    } else if ('markedForReview' in payload && prevQ) {
                      notify({
                        tone: 'info',
                        message: payload.markedForReview
                          ? 'Questão marcada para revisão.'
                          : 'Marcação de revisão removida.',
                        onUndo: async () => {
                          await api.updateQuestion(qId, {
                            markedForReview: prevQ.markedForReview,
                          });
                          await loadWorkspace(workspace.journey.id);
                        },
                      });
                    } else if (payload.classificationReviewed) {
                      notify({
                        tone: 'success',
                        message: 'Classificação e gabarito da questão atualizados.',
                      });
                    }
                  }}
                  aiConfigured={Boolean(health?.ai.configured)}
                />
              )}

              {activeTab === 'documents' && (
                <DocumentsView
                  workspace={workspace}
                  onImportDocument={async (payload) => {
                    const res = await api.importDocument(workspace.journey.id, payload);
                    await loadWorkspace(workspace.journey.id);
                    notify({
                      tone: res.needsManualReview ? 'warning' : 'success',
                      message: `Documento "${payload.title}" importado para o acervo.`,
                    });
                    return res;
                  }}
                  aiConfigured={Boolean(health?.ai.configured)}
                />
              )}

              {activeTab === 'planner' && (
                <PlannerView
                  workspace={workspace}
                  onGeneratePlan={async (dailyMin) => {
                    await api.generatePlan(workspace.journey.id, dailyMin);
                    await loadWorkspace(workspace.journey.id);
                    notify({
                      tone: 'success',
                      message: 'Ciclo semanal atualizado com base nas suas lacunas atuais.',
                    });
                  }}
                  onToggleItem={async (itemId, completed) => {
                    await api.togglePlanItem(itemId, completed);
                    await loadWorkspace(workspace.journey.id);
                    notify({
                      tone: completed ? 'success' : 'info',
                      message: completed
                        ? 'Atividade marcada como concluída.'
                        : 'Atividade reaberta no ciclo.',
                      onUndo: async () => {
                        await api.togglePlanItem(itemId, !completed);
                        await loadWorkspace(workspace.journey.id);
                      },
                    });
                  }}
                />
              )}

              {activeTab === 'tutor' && (
                <TutorAndMaterialsView
                  workspace={workspace}
                  onAskTutor={async (msg) => {
                    await api.askTutor(workspace.journey.id, msg);
                    await loadWorkspace(workspace.journey.id);
                  }}
                  onGenerateMaterial={async (payload) => {
                    await api.generateMaterial(workspace.journey.id, payload);
                    await loadWorkspace(workspace.journey.id);
                    notify({
                      tone: 'success',
                      message: 'Material direcionado gerado e salvo na biblioteca.',
                    });
                  }}
                  aiConfigured={Boolean(health?.ai.configured)}
                  onNotify={notify}
                />
              )}

              {activeTab === 'history' && (
                <HistoryView
                  workspace={workspace}
                  onInspectAttempt={handleInspectAttempt}
                  onExportBackup={handleExportBackup}
                  onImportBackup={handleImportBackup}
                  onOpenBackupModal={() => setShowBackupModal(true)}
                />
              )}
            </div>
          )}
        </main>

        {/* Rodapé limpo e útil */}
        <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-chrome)] px-4 sm:px-6 lg:px-8 py-4 no-print">
          <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[12px] text-[var(--text-muted)]">
            <div>
              <span className="font-semibold text-[var(--text-secondary)]">Método Reverso</span>
              <span className="mx-2" aria-hidden="true">·</span>
              <span>Armazenamento local em JSON relacional no navegador</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => handleNavigate('syllabus')}
                className="hover:text-[var(--text-primary)] hover:underline py-1"
              >
                Edital Verticalizado
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('documents')}
                className="hover:text-[var(--text-primary)] hover:underline py-1"
              >
                Importar Provas
              </button>
              <button
                type="button"
                onClick={() => setShowBackupModal(true)}
                className="hover:text-[var(--text-primary)] hover:underline py-1 font-medium text-[var(--text-secondary)]"
              >
                Backup / Restauração JSON
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Modal Nova Jornada Acessível */}
      {showNewJourneyModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-new-journey-title"
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateJourney}
            className="app-surface w-full max-w-lg p-6 space-y-5 shadow-[var(--shadow-modal)] view-enter"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <h2
                id="modal-new-journey-title"
                className="text-lg font-semibold text-[var(--text-primary)]"
              >
                Cadastrar Nova Jornada Isolada
              </h2>
              <button
                type="button"
                onClick={() => setShowNewJourneyModal(false)}
                aria-label="Fechar modal"
                className="p-2 -mr-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] rounded-[var(--radius-sm)]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
                  Nome da Jornada
                </span>
                <input
                  required
                  autoFocus
                  placeholder="Ex: Transpetro — Dutos e Terminais"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="form-input"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
                    Órgão / Empresa
                  </span>
                  <input
                    value={newOrg}
                    onChange={(e) => setNewOrg(e.target.value)}
                    className="form-input"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
                    Banca Examinadora
                  </span>
                  <input
                    value={newBoard}
                    onChange={(e) => setNewBoard(e.target.value)}
                    className="form-input"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5">
                  <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
                    Cargo / Ênfase
                  </span>
                  <input
                    placeholder="Ex: Dutos e Terminais"
                    value={newEmphasis}
                    onChange={(e) => setNewEmphasis(e.target.value)}
                    className="form-input"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-[13px] font-semibold text-[var(--text-secondary)]">
                    Minutos/dia de estudo
                  </span>
                  <input
                    type="number"
                    min={30}
                    max={480}
                    value={newDailyMin}
                    onChange={(e) => setNewDailyMin(Number(e.target.value))}
                    className="form-input font-mono"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setShowNewJourneyModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                disabled={creatingJourney}
                type="submit"
                className="btn-primary"
              >
                {creatingJourney ? 'Criando jornada...' : 'Criar Jornada'}
              </button>
            </div>
          </form>
        </div>
      )}

      <BackupRestoreModal
        open={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        persistenceInfo={persistenceInfo}
        onRefreshPersistence={refreshPersistenceInfo}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />

      <FeedbackToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
