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
  Headphones,
  CheckCircle2,
  Clock
} from "lucide-react";
import Link from 'next/link';

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
        setError("E-mail ou senha inválidos. Verifique suas credenciais.");
      } else {
        window.location.href = callbackUrl;
        router.refresh();
      }
    } catch {
      setError("Ocorreu um erro ao conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#060913] text-slate-100 px-4 py-8 lg:p-12 select-none">
      {/* Dynamic Animated Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-[36rem] h-[36rem] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] bg-cyan-500/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45rem] h-[45rem] bg-emerald-500/10 rounded-full blur-[180px] pointer-events-none" />
      
      {/* High-tech Subtle Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Main Container - Split Screen Presentation */}
      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
        
        {/* Left Column: Brand Showcase Hero */}
        <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left space-y-7">
          
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-semibold backdrop-blur-md shadow-sm shadow-blue-500/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="tracking-wide">Nexus Chat Enterprise v2.0 • Online</span>
          </div>

          {/* Official Nexus Chat Brand Box */}
          <div className="flex flex-col items-center lg:items-start gap-4">
            <div className="relative group">
              {/* Backglow behind logo */}
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 opacity-30 blur-2xl group-hover:opacity-50 transition duration-700" />
              
              {/* Official Logo Card Frame */}
              <div className="relative p-5 sm:p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl shadow-blue-500/20 flex items-center justify-center transition-all duration-300 group-hover:scale-[1.02]">
                <img 
                  src="/nexus-chat-logo.png" 
                  alt="Nexus Chat Oficial" 
                  className="h-14 sm:h-18 md:h-20 w-auto object-contain drop-shadow-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Comunicação <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">Ágil & Segura</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base font-normal mt-2.5 max-w-lg leading-relaxed">
                Centralize o atendimento via WhatsApp da sua equipe com distribuição inteligente, isolamento privativo entre atendentes e fila em tempo real.
              </p>
            </div>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg text-left pt-1">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md hover:border-blue-500/40 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <Clock className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-white">Fila de Espera</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Clientes que aguardam ou retornam entram em espera para qualquer operador disponível.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-white">Sigilo por Atendente</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Ao aceitar, a conversa é 100% blindada e visível apenas para o atendente responsável.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md hover:border-purple-500/40 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <Users className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-white">Transferência Fácil</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Transfira atendimentos para outros colegas ou departamentos com histórico preservado.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md hover:border-amber-500/40 transition-colors">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                  <Zap className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-white">Respostas Rápidas</h4>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Atalhos com <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[9px]">/</kbd> para agilizar o suporte com mensagens prontas.
              </p>
            </div>
          </div>

          {/* Security guarantee line */}
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Criptografia de ponta a ponta
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" /> Multi-sessões simultâneas
            </span>
          </div>

        </div>

        {/* Right Column: Modern Glassmorphic Login Card */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="relative rounded-3xl bg-[#0b101e]/85 border border-white/[0.12] p-7 sm:p-9 shadow-2xl shadow-black/80 backdrop-blur-2xl">
            
            {/* Ambient subtle light bar at top of card */}
            <div className="absolute top-0 inset-x-12 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-75" />

            {/* Mobile Header Logo */}
            <div className="flex lg:hidden flex-col items-center mb-6">
              <div className="p-3 rounded-2xl bg-white/95 shadow-md border border-white/20 mb-3">
                <img 
                  src="/nexus-chat-logo.png" 
                  alt="Nexus Chat" 
                  className="h-10 w-auto object-contain"
                />
              </div>
            </div>

            {/* Form Header */}
            <div className="mb-6 space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">Entrar na Plataforma</h2>
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-400">
                Acesse com seu e-mail e senha para gerenciar seus chamados
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium text-center animate-in fade-in duration-200">
                {error}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold text-slate-300">E-mail Corporativo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                          <Input
                            placeholder="seu.email@empresa.com"
                            className="h-11 pl-10 pr-4 rounded-xl bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/60 transition-all text-sm font-medium"
                            autoFocus
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs text-red-400" />
                    </FormItem>
                  )}
                />

                {/* Password Field */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel className="text-xs font-semibold text-slate-300">Senha de Acesso</FormLabel>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="h-11 pl-10 pr-10 rounded-xl bg-white/[0.04] border-white/[0.1] text-white placeholder-slate-500 focus-visible:ring-blue-500/40 focus-visible:border-blue-500/60 transition-all text-sm font-medium"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                      <FormMessage className="text-xs text-red-400" />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 mt-2 cursor-pointer active:scale-[0.99]"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Acessar Nexus Chat
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {/* Bottom Info & Register */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Headphones className="h-3.5 w-3.5 text-blue-400" /> Central de Atendimento
              </span>
              <Link href="/auth/register" className="font-semibold text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                Criar nova conta
              </Link>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-[#060913]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
