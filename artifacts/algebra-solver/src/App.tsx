import { type ChangeEvent, type DragEvent, type FormEvent, type ReactNode, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BookOpen,
  Camera,
  Check,
  Clipboard,
  FileImage,
  ImagePlus,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react';
import { getHealthCheckQueryKey, useHealthCheck, useSolveAlgebra, type SolveInput, type SolveResult } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

const examples = [
  { label: 'Linear', equation: '3x + 7 = 22' },
  { label: 'Quadratic', equation: 'x² - 5x + 6 = 0' },
  { label: 'Fractions', equation: '2(x - 3) = x + 9' },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-3" data-testid="brand-mark">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[4px_4px_0_hsl(var(--accent))]">
        <span className="font-mono text-lg font-medium">x</span>
        <span className="absolute bottom-[5px] right-[7px] h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />
      </div>
      <div>
        <p className="font-[var(--app-font-display)] text-lg font-bold leading-none tracking-tight">solve / it</p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">algebra workbench</p>
      </div>
    </div>
  );
}

function Header() {
  const health = useHealthCheck({ query: { retry: 0, staleTime: 30_000, queryKey: getHealthCheckQueryKey() } });
  const isOnline = health.data?.status === 'ok' || health.data?.status === 'healthy';

  return (
    <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10" data-testid="header-main">
      <BrandMark />
      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex" data-testid="status-health">
          <span className={`h-2 w-2 rounded-full ${health.isLoading ? 'animate-pulse-soft bg-[hsl(var(--accent))]' : isOnline ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--destructive))]'}`} />
          {health.isLoading ? 'checking engine' : isOnline ? 'solver online' : 'solver unavailable'}
        </div>
        <button className="focus-ring rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[hsl(var(--muted))] hover:text-foreground" type="button" aria-label="About solve it" data-testid="button-about">
          <BookOpen className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}

function ModeTab({ active, icon, label, onClick, testId }: { active: boolean; icon: ReactNode; label: string; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition-all ${active ? 'bg-[hsl(var(--card))] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
      data-testid={testId}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

function EquationInput({ value, onChange, onSubmit, disabled }: { value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; disabled: boolean }) {
  return (
    <form onSubmit={onSubmit} className="relative" data-testid="form-equation">
      <label className="sr-only" htmlFor="equation">Type an equation</label>
      <textarea
        id="equation"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Type an equation to solve..."
        className="focus-ring min-h-[180px] w-full resize-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 pb-16 pt-5 font-mono text-[18px] leading-relaxed text-foreground placeholder:text-muted-foreground/60"
        disabled={disabled}
        data-testid="input-equation"
        autoComplete="off"
        spellCheck={false}
      />
      <div className="pointer-events-none absolute bottom-4 left-5 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono text-[hsl(var(--primary))]">∑</span>
        <span>Use = to set both sides equal</span>
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="focus-ring absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_hsl(var(--accent))] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        data-testid="button-solve-equation"
      >
        {disabled ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
        Solve
      </button>
    </form>
  );
}

function ImageDropzone({ preview, fileName, onFile, onClear, onSubmit, disabled }: { preview: string | null; fileName: string | null; onFile: (file: File) => void; onClear: () => void; onSubmit: () => void; disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFile = (file?: File) => {
    if (file && file.type.startsWith('image/')) onFile(file);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  return (
    <div
      className={`relative min-h-[266px] overflow-hidden rounded-xl border border-dashed transition-colors ${dragging ? 'border-[hsl(var(--primary))] bg-[hsl(var(--secondary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background))]'}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      data-testid="dropzone-image"
    >
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0])} data-testid="input-image-file" />
      {preview ? (
        <div className="flex h-full min-h-[266px] flex-col items-center justify-center p-4">
          <div className="relative max-h-[170px] overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
            <img src={preview} alt="Uploaded equation preview" className="max-h-[170px] max-w-full object-contain" data-testid="img-equation-preview" />
            <button type="button" onClick={onClear} className="focus-ring absolute right-2 top-2 rounded-full bg-[hsl(var(--foreground))] p-1.5 text-[hsl(var(--background))] transition-transform hover:scale-105" aria-label="Remove uploaded image" data-testid="button-remove-image">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-3 max-w-full truncate px-4 text-sm font-medium" data-testid="text-image-filename">{fileName}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="focus-ring rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[hsl(var(--muted))]" data-testid="button-change-image">Change image</button>
            <button type="button" disabled={disabled} onClick={onSubmit} className="focus-ring flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition-all hover:-translate-y-0.5 disabled:opacity-40" data-testid="button-solve-image">
              {disabled ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
              Solve image
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="focus-ring flex min-h-[266px] w-full flex-col items-center justify-center px-6 text-center" data-testid="button-upload-image">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
            <ImagePlus className="h-7 w-7" strokeWidth={1.6} />
          </div>
          <p className="font-semibold">Drop a photo of your equation</p>
          <p className="mt-1.5 text-sm text-muted-foreground">or click to browse · PNG, JPG, WEBP</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-semibold text-foreground shadow-sm">
            <Upload className="h-3.5 w-3.5" /> Choose image
          </span>
        </button>
      )}
    </div>
  );
}

function LoadingResult() {
  return (
    <div className="animate-rise flex min-h-[370px] flex-col justify-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-[var(--shadow-soft)] sm:p-8" data-testid="state-solving">
      <div className="mx-auto flex max-w-xs flex-col items-center text-center">
        <div className="relative mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]">
          <span className="absolute inset-2 rounded-xl border border-[hsl(var(--primary))]/30 animate-pulse-soft" />
          <LoaderCircle className="h-7 w-7 animate-spin" />
        </div>
        <p className="font-[var(--app-font-display)] text-xl font-bold">Working it out</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Parsing the equation, isolating the variable, and checking the result.</p>
        <div className="mt-7 flex w-full flex-col gap-2 text-left">
          {['Reading your equation', 'Applying algebra rules', 'Checking the answer'].map((label, index) => (
            <div key={label} className="flex items-center gap-3 rounded-lg bg-[hsl(var(--background))] px-3 py-2.5 text-xs text-muted-foreground">
              <span className={`grid h-5 w-5 place-items-center rounded-full ${index === 0 ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))]'}`}>
                {index === 0 ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--border))]" />}
              </span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="grid min-h-[370px] place-items-center rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 shadow-[var(--shadow-soft)]" data-testid="state-empty">
      <div className="max-w-xs text-center">
        <div className="grid-paper mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full border border-[hsl(var(--border))] text-[hsl(var(--primary))]">
          <span className="font-mono text-3xl">x?</span>
        </div>
        <p className="font-[var(--app-font-display)] text-xl font-bold">Your answer will land here</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Enter an equation or upload a photo. We will show every meaningful move, not just the final number.</p>
      </div>
    </div>
  );
}

function ErrorResult({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="animate-rise flex min-h-[370px] flex-col items-center justify-center rounded-2xl border border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/5 p-8 text-center" data-testid="state-error">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]">
        <X className="h-7 w-7" />
      </div>
      <p className="font-[var(--app-font-display)] text-xl font-bold">That one did not parse</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground" data-testid="text-error-message">{message}</p>
      <button type="button" onClick={onRetry} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[hsl(var(--muted))]" data-testid="button-retry">
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}

function ResultView({ result, onNewSolve }: { result: SolveResult; onNewSolve: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyAnswer = async () => {
    await navigator.clipboard?.writeText(`${result.equation}\n${result.solution}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="animate-rise space-y-4" data-testid="state-result">
      <div className="overflow-hidden rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--card))] shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-[hsl(var(--primary))]">
            <Check className="h-4 w-4" /> Solved
          </div>
          <button type="button" onClick={copyAnswer} className="focus-ring inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-[hsl(var(--muted))] hover:text-foreground" data-testid="button-copy-answer">
            {copied ? <Check className="h-3.5 w-3.5 text-[hsl(var(--primary))]" /> : <Clipboard className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="px-5 pb-7 pt-6 sm:px-7">
          <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">Equation</p>
          <p className="font-mono text-lg text-foreground" data-testid="text-result-equation">{result.equation}</p>
          <div className="my-6 h-px bg-[hsl(var(--border))]" />
          <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">Answer</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-[var(--app-font-display)] text-4xl font-bold tracking-tight text-[hsl(var(--primary))]" data-testid="text-solution">{result.solution}</span>
            <span className="font-mono text-sm text-muted-foreground">{result.variable} = solution</span>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-[var(--app-font-display)] text-xl font-bold">The working</p>
            <p className="mt-1 text-sm text-muted-foreground">Follow the same path you would take on paper.</p>
          </div>
          <span className="rounded-full bg-[hsl(var(--secondary))] px-2.5 py-1 font-mono text-[10px] font-medium text-[hsl(var(--primary))]">{result.steps.length} steps</span>
        </div>
        <div className="space-y-0" data-testid="list-solution-steps">
          {result.steps.map((step, index) => (
            <div key={`${step.label}-${index}`} className="relative flex gap-4 pb-5 last:pb-0" data-testid={`step-solution-${index}`}>
              {index < result.steps.length - 1 && <div className="absolute left-[15px] top-8 h-[calc(100%-16px)] w-px bg-[hsl(var(--border))]" />}
              <div className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[hsl(var(--primary))]/35 bg-[hsl(var(--card))] font-mono text-xs text-[hsl(var(--primary))]">{index + 1}</div>
              <div className="min-w-0 pt-1">
                <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{step.label}</p>
                <p className="mt-1.5 break-words font-mono text-[15px] leading-relaxed text-foreground">{step.expression}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button type="button" onClick={onNewSolve} className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-[hsl(var(--primary))]/50 hover:shadow-sm" data-testid="button-new-solve">
        <Sparkles className="h-4 w-4 text-[hsl(var(--accent))]" /> Solve another equation
      </button>
    </div>
  );
}

function WorkflowNote() {
  return (
    <div className="mt-7 grid gap-4 border-t border-[hsl(var(--border))] pt-6 sm:grid-cols-3" data-testid="workflow-note">
      {[
        { icon: Camera, title: 'Read', body: 'Mathpix reads a photo when handwriting gets in the way.' },
        { icon: WandSparkles, title: 'Solve', body: 'SymPy applies the algebra rules and finds the variable.' },
        { icon: Lightbulb, title: 'Understand', body: 'Every result comes with a short, useful trail of steps.' },
      ].map(({ icon: Icon, title, body }, index) => (
        <div key={title} className="flex gap-3 sm:block">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))] sm:mb-3">
            <Icon className="h-4 w-4" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-sm font-semibold"><span className="mr-1 font-mono text-xs text-[hsl(var(--accent))]">0{index + 1}</span>{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Home() {
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [equation, setEquation] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const solve = useSolveAlgebra();

  const selectExample = (example: string) => {
    setMode('text');
    setEquation(example);
    setResult(null);
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1] ?? null);
      setMimeType(file.type);
      setFileName(file.name);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
    setFileName(null);
    setMimeType(null);
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const payload: SolveInput = mode === 'text'
      ? { mode: 'text', equation: equation.trim(), imageBase64: null, mimeType: null }
      : { mode: 'image', equation: null, imageBase64, mimeType };
    if (mode === 'text' ? !equation.trim() : !imageBase64) return;
    setResult(null);
    solve.mutate({ data: payload }, {
      onSuccess: (data) => setResult(data),
    });
  };

  const reset = () => {
    setResult(null);
    solve.reset();
  };

  const errorMessage = (solve.error as { error?: string } | null)?.error ?? 'Try writing the equation with a clear equals sign, such as 2x + 4 = 12.';

  return (
    <div className="min-h-[100dvh] overflow-hidden">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-5 pb-14 pt-10 sm:px-8 lg:px-10 lg:pt-16">
        <section className="mb-12 max-w-3xl animate-rise" data-testid="hero-section">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[.15em] text-[hsl(var(--primary))] shadow-sm">
            <Zap className="h-3.5 w-3.5" /> A clearer way through algebra
          </div>
          <h1 className="font-[var(--app-font-display)] text-[clamp(2.7rem,7vw,5.8rem)] font-bold leading-[.96] tracking-[-.06em]">
            Don’t just get<br /><span className="ink-underline">the answer.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Put in an equation. Get back the reasoning. A focused solver for the moments when one missing step makes everything feel harder.
          </p>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.03fr)_minmax(390px,.97fr)] lg:items-start lg:gap-12" data-testid="solver-workbench">
          <div className="animate-rise animate-rise-delay-1">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-[var(--shadow-soft)] sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-[var(--app-font-display)] text-xl font-bold">Start with your equation</p>
                  <p className="mt-1 text-sm text-muted-foreground">Text is fastest. A photo works too.</p>
                </div>
                <span className="hidden rounded-md bg-[hsl(var(--secondary))] px-2 py-1 font-mono text-[10px] text-[hsl(var(--primary))] sm:inline-block">INPUT</span>
              </div>
              <div className="mb-5 flex rounded-xl bg-[hsl(var(--muted))] p-1">
                <ModeTab active={mode === 'text'} onClick={() => { setMode('text'); setResult(null); }} icon={<WandSparkles className="h-4 w-4" />} label="Type it" testId="tab-text-mode" />
                <ModeTab active={mode === 'image'} onClick={() => { setMode('image'); setResult(null); }} icon={<FileImage className="h-4 w-4" />} label="Upload a photo" testId="tab-image-mode" />
              </div>
              {mode === 'text' ? (
                <EquationInput value={equation} onChange={setEquation} onSubmit={submit} disabled={solve.isPending} />
              ) : (
                <ImageDropzone preview={imagePreview} fileName={fileName} onFile={handleFile} onClear={clearImage} onSubmit={() => submit()} disabled={solve.isPending} />
              )}
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span>Try an example</span><span className="h-px flex-1 bg-[hsl(var(--border))]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {examples.map((example) => (
                    <button type="button" key={example.label} onClick={() => selectExample(example.equation)} className="focus-ring rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 font-mono text-xs transition-colors hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--secondary))]" data-testid={`button-example-${example.label.toLowerCase()}`}>
                      <span className="mr-1.5 font-sans text-muted-foreground">{example.label}</span>{example.equation}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <WorkflowNote />
          </div>

          <div className="animate-rise animate-rise-delay-2">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[hsl(var(--accent))]/20 font-mono text-xs font-medium text-[hsl(var(--accent-foreground))]">02</span>
                <p className="text-sm font-semibold">Your working</p>
              </div>
              {result && <button type="button" onClick={reset} className="focus-ring inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground" data-testid="button-reset-result"><RotateCcw className="h-3.5 w-3.5" /> Clear</button>}
            </div>
            {solve.isPending ? <LoadingResult /> : solve.isError ? <ErrorResult message={errorMessage} onRetry={() => submit()} /> : result ? <ResultView result={result} onNewSolve={reset} /> : <EmptyResult />}
          </div>
        </section>
        <footer className="mt-16 flex flex-col justify-between gap-3 border-t border-[hsl(var(--border))] pt-5 text-xs text-muted-foreground sm:flex-row">
          <p>Built for curious minds who want the why.</p>
          <p className="font-mono">Mathpix · SymPy · solve / it</p>
        </footer>
      </main>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;