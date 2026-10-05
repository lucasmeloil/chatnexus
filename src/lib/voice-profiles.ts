export type VoiceProfile = 'broadcast' | 'clarity' | 'warm' | 'denoise' | 'natural';

export interface VoiceProfileConfig {
    id: VoiceProfile;
    name: string;
    tagline: string;
    description: string;
    badge: string;
    filterChain: string;
}

export const VOICE_PROFILES: Record<VoiceProfile, VoiceProfileConfig> = {
    broadcast: {
        id: 'broadcast',
        name: "Studio Broadcast",
        tagline: "Padrão Podcast / Rádio",
        description: "Voz equilibrada, quente, aveludada e com ganho nivelado para call center e atendimento.",
        badge: "Recomendado",
        filterChain: "highpass=f=80,lowpass=f=12000,afftdn=nr=16:nf=-50,equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=-24dB:ratio=2.5:attack=10:release=80,loudnorm=I=-16:TP=-1.5:LRA=11"
    },
    clarity: {
        id: 'clarity',
        name: "Sonar Clarity",
        tagline: "Agudos Cristalinos & Nitidez",
        description: "Ênfase na articulação e presença de agudos, ideal para microfones abafados ou headsets simples.",
        badge: "Mais Nítido",
        filterChain: "highpass=f=100,lowpass=f=13000,afftdn=nr=18:nf=-50,equalizer=f=300:t=q:w=1:g=-3,equalizer=f=3600:t=q:w=1.2:g=3.5,equalizer=f=7500:t=q:w=1.5:g=2,acompressor=threshold=-22dB:ratio=2.5:attack=10:release=80,loudnorm=I=-16:TP=-1.5:LRA=11"
    },
    warm: {
        id: 'warm',
        name: "Warm & Deep",
        tagline: "Voz Encorpada de Locutor",
        description: "Realça graves aveludados e médios aconchegantes, criando uma presença acolhedora e confiante.",
        badge: "Encorpado",
        filterChain: "highpass=f=70,lowpass=f=11000,afftdn=nr=15:nf=-50,equalizer=f=150:t=q:w=1.2:g=3,equalizer=f=2600:t=q:w=1.2:g=1.5,acompressor=threshold=-22dB:ratio=2.5:attack=15:release=100,loudnorm=I=-16:TP=-1.5:LRA=11"
    },
    denoise: {
        id: 'denoise',
        name: "Anti-Ruído Extremo",
        tagline: "Foco Total na Voz",
        description: "Atenuação de ruído reforçada para escritórios com barulho de fundo, ar-condicionado ou trânsito.",
        badge: "Ambientes Barulhentos",
        filterChain: "highpass=f=100,lowpass=f=10000,afftdn=nr=24:nf=-45:tn=1,equalizer=f=220:t=q:w=1:g=-3,equalizer=f=3000:t=q:w=1.2:g=3,acompressor=threshold=-24dB:ratio=3:attack=10:release=80,loudnorm=I=-16:TP=-1.5:LRA=11"
    },
    natural: {
        id: 'natural',
        name: "Natural / Direto",
        tagline: "Sem Equalização Adicional",
        description: "Converte o áudio bruto direto para o padrão de voz do WhatsApp sem alterar o timbre original.",
        badge: "Original",
        filterChain: "highpass=f=60,lowpass=f=14000,loudnorm=I=-16:TP=-1.5:LRA=11"
    }
};
