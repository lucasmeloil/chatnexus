'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  ArrowRight, 
  Loader2, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Users, 
  Zap, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  Building2,
  LockKeyhole
} from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

const formSchema = z.object({
  email: z.string().email("Por favor, insira um e-mail válido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
      });

      if (result?.error) {
        setError("E-mail ou senha incorretos. Verifique suas credenciais de operador.");
      } else {
        window.location.href = callbackUrl;
        router.refresh();
      }
    } catch {
      setError("Não foi possível conectar ao servidor institucional. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between relative overflow-hidden bg-background text-foreground px-4 py-8 lg:py-12 select-none">
      {/* Top Bar with Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Subtle Architectural Dot Grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.25] dark:opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Elegant Diffuse Corporate Light Gradients */}
      <div className="absolute -top-36 -left-36 w-[36rem] h-[36rem] bg-blue-100/40 dark:bg-blue-900/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-[40rem] h-[40rem] bg-indigo-100/30 dark:bg-indigo-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[48rem] h-[48rem] bg-primary/[0.04] rounded-full blur-3xl pointer-events-none" />

      {/* Main Container - Split Screen Enterprise Presentation */}
      <div className="relative z-10 w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        
        {/* Left Column: Brand Showcase & Institutional Values */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
          
          {/* Institutional Status Badge */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border border-border/80 bg-card/90 text-foreground text-xs font-semibold shadow-2xs backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="tracking-wide">Nexus Chat Enterprise • Portal Oficial</span>
          </div>

          {/* Professional Brand Logo Presentation (Clean, transparent, no clunky box) */}
          <div className="flex flex-col items-center lg:items-start pt-1">
            <div className="transition-transform duration-300 hover:scale-[1.01]">
              <img 
                src="/nexus-chat-logo.png" 
                alt="Nexus Chat Enterprise" 
                className="h-14 sm:h-16 lg:h-20 w-auto object-contain drop-shadow-2xs dark:hidden" 
              />
              <img 
                src="/nexus-chat-logo-white.png" 
                alt="Nexus Chat Enterprise" 
                className="h-14 sm:h-16 lg:h-20 w-auto object-contain drop-shadow-2xs hidden dark:block" 
              />
            </div>

            <div className="pt-4">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.16]">
                Comunicação <span className="text-primary">Institucional</span> & Atendimento Seguro
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base font-normal mt-3 max-w-lg leading-relaxed">
                Centralize o atendimento via WhatsApp da sua organização com governança, isolamento privativo entre operadores e alta disponibilidade.
              </p>
            </div>
          </div>

          {/* Institutional Feature Highlights (2x2 Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-lg text-left pt-1">
            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all duration-150">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-primary border border-primary/20">
                  <Clock className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Fila Centralizada</h4>
              </div>
              <p className="text-[12px] text-muted-foreground leading-normal">
                Distribuição equitativa de chamados com triagem ágil por atendente disponível.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-2xs hover:border-emerald-500/40 hover:shadow-xs transition-all duration-150">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Sigilo por Atendente</h4>
              </div>
              <p className="text-[12px] text-muted-foreground leading-normal">
                Conversas aceitas permanecem reservadas unicamente ao operador responsável.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-2xs hover:border-indigo-500/40 hover:shadow-xs transition-all duration-150">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Users className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Transferência Rápida</h4>
              </div>
              <p className="text-[12px] text-muted-foreground leading-normal">
                Encaminhamento entre setores e colegas com histórico integral preservado.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-2xs hover:border-amber-500/40 hover:shadow-xs transition-all duration-150">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <Zap className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-foreground">Respostas Ágeis</h4>
              </div>
              <p className="text-[12px] text-muted-foreground leading-normal">
                Agilidade no atendimento com atalhos de mensagens padronizadas via <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-foreground font-mono text-[10px]">/</kbd>.
              </p>
            </div>
          </div>

          {/* Institutional Compliance Badges */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Criptografia de ponta a ponta
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" /> Conformidade LGPD
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Plataforma Homologada
            </span>
          </div>

        </div>

        {/* Right Column: Institutional Login Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="relative rounded-2xl bg-card border border-border/80 p-8 sm:p-10 shadow-2xl">
            
            {/* Top Corporate Accent Bar */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary via-blue-500 to-indigo-500 rounded-t-2xl" />

            {/* Card Brand Header with Clean Logo */}
            <div className="flex flex-col items-center sm:items-start mb-6">
              <img 
                src="/nexus-chat-logo.png" 
                alt="Nexus Chat" 
                className="h-9 sm:h-10 w-auto object-contain mb-4 dark:hidden" 
              />
              <img 
                src="/nexus-chat-logo-white.png" 
                alt="Nexus Chat" 
                className="h-9 sm:h-10 w-auto object-contain mb-4 hidden dark:block" 
              />
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Acesso ao Sistema</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Insira suas credenciais corporativas para gerenciar seus atendimentos.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-xs font-semibold text-foreground/80">
                        E-mail Corporativo
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="colaborador@empresa.com"
                            className="h-11 pl-10 pr-4 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary transition-all text-sm font-medium shadow-2xs"
                            autoFocus
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-600 font-medium" />
                    </FormItem>
                  )}
                />

                {/* Password Field */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold text-foreground/80">
                          Senha de Acesso
                        </FormLabel>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-11 pl-10 pr-10 rounded-xl bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary transition-all text-sm font-medium shadow-2xs"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            tabIndex={-1}
                            title={showPassword ? "Ocultar senha" : "Exibir senha"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-600 font-medium" />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 active:scale-[0.99] transition-all duration-200 mt-2 cursor-pointer"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando Credenciais...
                    </>
                  ) : (
                    <>
                      Entrar no Nexus Chat
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* Institutional Restricted Access Notice */}
            <div className="mt-7 pt-5 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" /> Acesso Restrito
              </span>
              <span className="text-muted-foreground text-[11px] text-center sm:text-right">
                Novos acessos são criados pelo administrador
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* Institutional Legal & Copyright Notice */}
      <footer className="relative z-10 text-center text-xs text-slate-400 mt-8">
        <p>© 2026 Nexus Chat Enterprise • Todos os direitos reservados. Conexão criptografada e monitorada.</p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
